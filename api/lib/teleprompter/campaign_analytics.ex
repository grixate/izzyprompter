defmodule Teleprompter.CampaignAnalytics do
  @moduledoc "Bounded first-party acquisition counters; durable daily aggregates and checkout labels."
  use GenServer
  import Ecto.Query
  alias Teleprompter.Repo

  @dimensions ~w(source medium campaign content entry)
  @events ~w(start_clicked session_created remote_connected playback_started signed_in checkout_started)
  @max_visits 20_000
  @max_groups 256
  @columns [:day, :source, :medium, :campaign, :content, :entry, :event]
  @empty Map.new(@dimensions, &{&1, ""})
  @overflow Map.merge(@empty, %{"source" => "other", "entry" => "other"})

  def enabled?, do: Application.get_env(:teleprompter, :campaign_analytics_enabled, false)

  def admin?(%{email: email}) do
    email in Application.get_env(:teleprompter, :analytics_admin_emails, [])
  end

  def admin?(_), do: false
  def start_link(options), do: GenServer.start_link(__MODULE__, options, name: __MODULE__)

  def visit(params, peer, agent) do
    if enabled?(), do: safe_call({:visit, params, peer, agent}), else: {:error, :disabled}
  end

  def context(token) when is_binary(token) and byte_size(token) <= 512 do
    if enabled?(), do: safe_call({:context, token}), else: nil
  end

  def context(_), do: nil

  # These events are recorded by trusted application code after the action succeeds.
  # The public event endpoint only accepts start_clicked.
  def record(context, event) when is_map(context) and event in @events do
    if enabled?(), do: GenServer.cast(__MODULE__, {:event, context["id"], event})
    :ok
  end

  def record(_, _), do: :ok
  def record_token(token, event), do: record(context(token), event)
  def flush, do: safe_call(:flush, 5_000)

  defp safe_call(message, timeout \\ 250) do
    GenServer.call(__MODULE__, message, timeout)
  catch
    :exit, _ -> nil
  end

  @impl true
  def init(options) do
    Process.send_after(self(), :flush, 60_000)
    clock = Keyword.get(options, :clock, &DateTime.utc_now/0)

    {:ok,
     %{
       clock: clock,
       day: DateTime.to_date(clock.()),
       salt: :crypto.strong_rand_bytes(32),
       visits: %{},
       seen: MapSet.new(),
       groups: MapSet.new(),
       pending: %{},
       max_visits: Keyword.get(options, :max_visits, @max_visits),
       max_groups: Keyword.get(options, :max_groups, @max_groups)
     }}
  end

  @impl true
  def format_status(status), do: Map.new(status, fn {key, _} -> {key, :redacted} end)

  @impl true
  def handle_call({:visit, params, peer, agent}, _from, state) do
    state = rotate(state)
    dimensions = dimensions(params)

    dimensions =
      if MapSet.size(state.groups) < state.max_groups or MapSet.member?(state.groups, dimensions),
        do: dimensions,
        else: @overflow

    case valid_visit(state, params["token"]) do
      {token, visit} when visit.dimensions == dimensions ->
        {:reply, {:ok, token}, increment(state, visit.dimensions, "page_views")}

      _ ->
        if map_size(state.visits) >= state.max_visits do
          {:reply, {:error, :capacity}, state}
        else
          # Raw network data is used only here, never retained in state or the database.
          visitor = :crypto.mac(:hmac, :sha256, state.salt, :erlang.term_to_binary({peer, agent}))

          id = Ecto.UUID.generate()
          token = Phoenix.Token.sign(TeleprompterWeb.Endpoint, "campaign-visit-v1", id)

          visit = %{
            dimensions: dimensions,
            at: DateTime.to_unix(state.clock.()),
            events: MapSet.new()
          }

          state = %{
            state
            | visits: Map.put(state.visits, id, visit),
              groups: MapSet.put(state.groups, dimensions)
          }

          state = state |> increment(dimensions, "visits") |> increment(dimensions, "page_views")
          state = unique(state, {visitor, :site}, @empty, "site_visitors")
          state = unique(state, {visitor, dimensions}, dimensions, "visitors")
          {:reply, {:ok, token}, state}
        end
    end
  end

  def handle_call({:context, token}, _from, state) do
    state = rotate(state)

    context =
      case valid_visit(state, token) do
        {_token, visit} ->
          {:ok, id} =
            Phoenix.Token.verify(TeleprompterWeb.Endpoint, "campaign-visit-v1", token,
              max_age: 1800
            )

          Map.merge(visit.dimensions, %{"id" => id, "day" => Date.to_iso8601(state.day)})

        _ ->
          nil
      end

    {:reply, context, state}
  end

  def handle_call(:flush, _from, state) do
    {result, state} = persist(rotate(state))
    {:reply, result, state}
  end

  @impl true
  def handle_cast({:event, id, event}, state) do
    state = rotate(state)

    state =
      case Map.get(state.visits, id) do
        nil ->
          state

        visit ->
          if MapSet.member?(visit.events, event) do
            state
          else
            updated = %{visit | events: MapSet.put(visit.events, event)}

            %{state | visits: Map.put(state.visits, id, updated)}
            |> increment(visit.dimensions, event)
          end
      end

    {:noreply, state}
  end

  @impl true
  def handle_info(:flush, state) do
    {_, state} = persist(rotate(state))
    Process.send_after(self(), :flush, 60_000)
    {:noreply, state}
  end

  defp dimensions(params) do
    Map.new(@dimensions, fn key ->
      value = params[key]

      value =
        if is_binary(value) and Regex.match?(~r/\A[a-z0-9][a-z0-9_-]{0,47}\z/, value),
          do: value,
          else: ""

      {key, value}
    end)
    |> Map.update!("source", &if(&1 == "", do: "direct", else: &1))
    |> Map.update!("entry", &if(&1 in ~w(home pro skins account), do: &1, else: "home"))
  end

  defp valid_visit(state, token) when is_binary(token) and byte_size(token) <= 512 do
    with {:ok, id} <-
           Phoenix.Token.verify(TeleprompterWeb.Endpoint, "campaign-visit-v1", token,
             max_age: 1800
           ),
         %{at: at} = visit <- Map.get(state.visits, id),
         true <- (DateTime.to_unix(state.clock.()) - at) in 0..1799 do
      {token, visit}
    else
      _ -> nil
    end
  end

  defp valid_visit(_, _), do: nil

  defp unique(state, key, dimensions, event) do
    if MapSet.member?(state.seen, key),
      do: state,
      else: increment(%{state | seen: MapSet.put(state.seen, key)}, dimensions, event)
  end

  defp increment(state, dimensions, event) do
    key = {state.day, dimensions, event}
    %{state | pending: Map.update(state.pending, key, 1, &min(&1 + 1, 1_000_000))}
  end

  defp rotate(state) do
    day = DateTime.to_date(state.clock.())

    if day == state.day do
      state
    else
      # Retain yesterday's unflushed aggregate batch, but never its visitor keys.
      %{
        state
        | day: day,
          salt: :crypto.strong_rand_bytes(32),
          visits: %{},
          seen: MapSet.new(),
          groups: MapSet.new(),
          pending:
            Map.reject(state.pending, fn {{d, _, _}, _} ->
              Date.compare(d, Date.add(day, -1)) == :lt
            end)
      }
    end
  end

  defp persist(%{pending: pending} = state) when map_size(pending) == 0, do: {:ok, state}

  defp persist(state) do
    rows =
      Enum.map(state.pending, fn {{day, dimensions, event}, count} ->
        Map.new(@dimensions, &{String.to_existing_atom(&1), dimensions[&1]})
        |> Map.merge(%{day: day, event: event, count: count})
      end)

    result =
      Repo.transaction(
        fn ->
          Repo.insert_all("campaign_metrics", rows,
            conflict_target: @columns,
            on_conflict:
              from(m in "campaign_metrics",
                update: [set: [count: fragment("? + EXCLUDED.count", m.count)]]
              ),
            timeout: 2_000
          )

          Repo.delete_all(
            from(m in "campaign_metrics", where: m.day < ^Date.add(state.day, -365))
          )
        end,
        timeout: 5_000
      )

    if match?({:ok, _}, result), do: {:ok, %{state | pending: %{}}}, else: {:error, state}
  rescue
    _ -> {:error, state}
  end

  def report(days \\ 30) when is_integer(days) and days in 1..366 do
    cutoff = Date.add(Date.utc_today(), 1 - days)

    rows =
      Repo.all(
        from(m in "campaign_metrics",
          where: m.day >= ^cutoff,
          group_by: [m.day, m.event],
          order_by: [asc: m.day],
          select: %{day: m.day, event: m.event, count: type(sum(m.count), :integer)}
        )
      )

    # Bound report memory even if many different posts accumulate over the year.
    campaigns =
      Repo.all(
        from(m in "campaign_metrics",
          where: m.day >= ^cutoff and m.event != "site_visitors",
          group_by: [m.source, m.medium, m.campaign, m.content, m.entry],
          order_by: [desc: type(filter(sum(m.count), m.event == "visits"), :integer)],
          limit: 250,
          select: %{
            source: m.source,
            medium: m.medium,
            campaign: m.campaign,
            content: m.content,
            entry: m.entry,
            counts: %{
              "visitors" => type(filter(sum(m.count), m.event == "visitors"), :integer),
              "visits" => type(filter(sum(m.count), m.event == "visits"), :integer),
              "page_views" => type(filter(sum(m.count), m.event == "page_views"), :integer),
              "start_clicked" => type(filter(sum(m.count), m.event == "start_clicked"), :integer),
              "session_created" =>
                type(filter(sum(m.count), m.event == "session_created"), :integer),
              "remote_connected" =>
                type(filter(sum(m.count), m.event == "remote_connected"), :integer),
              "playback_started" =>
                type(filter(sum(m.count), m.event == "playback_started"), :integer),
              "signed_in" => type(filter(sum(m.count), m.event == "signed_in"), :integer),
              "checkout_started" =>
                type(filter(sum(m.count), m.event == "checkout_started"), :integer)
            }
          }
        )
      )
      |> Enum.map(fn row ->
        %{row | counts: Map.new(row.counts, fn {event, count} -> {event, count || 0} end)}
      end)

    payments =
      Repo.all(
        from(a in Teleprompter.Commerce.Attempt,
          where:
            a.environment == "production" and a.status in ["paid", "refunded", "disputed"] and
              fragment("?->>'day' >= ?", a.acquisition, ^Date.to_iso8601(cutoff)),
          group_by: [fragment("? - 'day'", a.acquisition), a.status, a.currency],
          select: %{
            campaign: fragment("? - 'day'", a.acquisition),
            status: a.status,
            currency: a.currency,
            count: count(a.id),
            amount_minor: sum(a.amount_minor)
          }
        )
      )

    %{
      enabled: enabled?(),
      days: days,
      from: cutoff,
      through: Date.utc_today(),
      totals: totals(rows),
      campaigns: campaigns,
      payments: payments,
      daily:
        rows
        |> Enum.group_by(& &1.day)
        |> Enum.sort_by(&elem(&1, 0))
        |> Enum.map(fn {day, events} -> %{day: day, counts: totals(events)} end)
    }
  end

  defp totals(events),
    do:
      Enum.reduce(events, %{}, fn row, acc ->
        Map.update(acc, row.event, row.count, &(&1 + row.count))
      end)
end
