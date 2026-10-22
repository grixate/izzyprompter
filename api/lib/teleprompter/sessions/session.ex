defmodule Teleprompter.Sessions.Session do
  use GenServer, restart: :temporary

  alias Teleprompter.{Diagnostics, Document, TrafficBudget}

  @idle_timeout :timer.hours(6)

  def start_link(%{id: id} = options) do
    GenServer.start_link(__MODULE__, options,
      name: {:via, Registry, {Teleprompter.Sessions.Registry, id}}
    )
  end

  @impl true
  def format_status(status) do
    # OTP crash/status reports must not dump the canonical script, last patch,
    # capabilities or message history. Operational counters are separate.
    Map.new(status, fn {key, value} ->
      {key, if(key in [:state, :message, :reason, :log], do: :redacted, else: value)}
    end)
  end

  @impl true
  def init(%{id: id, token_hashes: token_hashes, content: content, speed: speed} = options) do
    now = now_ms()

    document =
      if options[:document],
        do: atom_document(options.document),
        else: Document.build(content, id)

    saved = options[:saved]

    if saved,
      do: {:ok, _} = Registry.register(Teleprompter.SavedSessions.Registry, saved.script_id, id)

    Diagnostics.record(:session, :ok)

    {:ok,
     %{
       id: id,
       saved: saved,
       appearance_owner: if(saved, do: saved.user, else: options[:appearance_owner]),
       settings:
         options[:settings] || Map.put(Teleprompter.PromptSettings.defaults(), "speed", speed),
       settings_revision: 0,
       preferences: options[:preferences] || Teleprompter.ReadingPreferences.get(nil),
       preferences_status_revision: 0,
       preference_timer: nil,
       preference_task: nil,
       preference_refresh: false,
       remote_counted: false,
       playback_counted: false,
       pending_save: nil,
       epoch: Base.url_encode64(:crypto.strong_rand_bytes(16), padding: false),
       token_hashes: token_hashes,
       sequences: %{},
       traffic: TrafficBudget.new(:session),
       script: Document.text(document),
       document: document,
       block_lengths: Document.lengths(document),
       display_order: [],
       reading: %{revision: 0, source_id: nil, checkpoint: nil},
       editing: %{revision: 0, active: nil},
       script_revision: 1,
       transport: %{
         status: "paused",
         anchor_position: 0.0,
         speed: speed,
         anchor_server_time: now,
         revision: 0
       },
       clients: %{}
     }, @idle_timeout}
  end

  @impl true
  def handle_call(:snapshot, _from, state) do
    {:reply, {:ok, snapshot(state)}, state, @idle_timeout}
  end

  def handle_call({:appearance_owner, token}, _from, state) do
    valid =
      is_binary(token) and byte_size(token) == 43 and
        Plug.Crypto.secure_compare(state.token_hashes["remote"], :crypto.hash(:sha256, token))

    {:reply, if(valid, do: {:ok, state.appearance_owner}, else: {:error, :unauthorized}), state,
     @idle_timeout}
  end

  def handle_call({:end_saved, user}, _from, state) do
    if state.saved && state.saved.user.id == user.id,
      do: {:stop, :normal, :ok, state},
      else: {:reply, {:error, :forbidden}, state, @idle_timeout}
  end

  def handle_call({:apply_preset, user, settings}, _from, state) do
    cond do
      is_nil(state.saved) or state.saved.user.id != user.id ->
        {:reply, {:error, :forbidden}, state, @idle_timeout}

      state.editing.active != nil ->
        {:reply, {:error, :editing_active}, state, @idle_timeout}

      not match?({:ok, _}, Teleprompter.PromptSettings.validate(settings)) ->
        {:reply, {:error, :invalid_settings}, state, @idle_timeout}

      true ->
        {:ok, settings} = Teleprompter.PromptSettings.validate(settings)
        now = now_ms()

        transport =
          anchor(state.transport, current_position(state.transport, now), now, %{
            speed: settings["speed"]
          })

        next = %{
          state
          | settings: settings,
            settings_revision: state.settings_revision + 1,
            transport: transport
        }

        TeleprompterWeb.Endpoint.broadcast(
          "session:#{state.id}",
          "session:update",
          snapshot(next)
        )

        {:reply, {:ok, %{applied: true}}, next, @idle_timeout}
    end
  end

  def handle_call({:saved_update, user, params}, from, state) do
    cond do
      is_nil(state.saved) or state.saved.user.id != user.id ->
        {:reply, {:error, :forbidden}, state, @idle_timeout}

      state.pending_save != nil ->
        {:reply, {:error, :save_in_progress}, state, @idle_timeout}

      state.editing.active != nil ->
        {:reply, {:error, :editing_active}, state, @idle_timeout}

      true ->
        start_save(state, from, {:library, params}, nil)
    end
  end

  def handle_call({:join, role, token, connection_id}, _from, state) do
    expected = state.token_hashes[role]

    cond do
      not is_binary(token) or byte_size(token) != 43 or is_nil(expected) ->
        {:reply, {:error, :unauthorized}, state, @idle_timeout}

      not Plug.Crypto.secure_compare(expected, :crypto.hash(:sha256, token)) ->
        {:reply, {:error, :unauthorized}, state, @idle_timeout}

      map_size(state.clients) >= 64 ->
        {:reply, {:error, :session_limit}, state, @idle_timeout}

      true ->
        order =
          if role == "display",
            do: state.display_order ++ [connection_id],
            else: state.display_order

        next =
          %{state | clients: Map.put(state.clients, connection_id, role), display_order: order}
          |> elect_reader()

        if role == "remote" and not state.remote_counted,
          do: Teleprompter.Metrics.record("remote_connected")

        next = %{next | remote_counted: next.remote_counted or role == "remote"}

        {:reply, {:ok, snapshot(next)}, next, @idle_timeout}
    end
  end

  def handle_call({:leave, client_id}, _from, state) do
    next =
      %{
        state
        | clients: Map.delete(state.clients, client_id),
          display_order: List.delete(state.display_order, client_id)
      }
      |> elect_reader()

    next =
      if next.editing.active && next.editing.active.owner_id == client_id,
        do: %{next | editing: %{revision: next.editing.revision + 1, active: nil}},
        else: next

    {:reply, {:ok, snapshot(next)}, next, @idle_timeout}
  end

  def handle_call(message, from, state)
      when elem(message, 0) in [:script, :command, :edit, :checkpoint] do
    {event, payload} = traffic_input(message)

    case TrafficBudget.admit(state.traffic, event, payload) do
      {:ok, budget} ->
        next = %{state | traffic: budget}

        if state.pending_save && elem(message, 0) == :edit do
          {:reply, {:error, :save_in_progress}, next, @idle_timeout}
        else
          if state.saved &&
               (elem(message, 0) == :script or
                  (elem(message, 0) == :edit and
                     (match?({:patch, _}, elem(message, 4)) or
                        match?({:replace, _}, elem(message, 4))))) do
            if state.pending_save,
              do: {:reply, {:error, :save_in_progress}, next, @idle_timeout},
              else: persist_live(message, from, next)
          else
            command_reply(message, next)
          end
        end

      {:error, reason, _retry, budget} ->
        {:reply, {:error, reason}, %{state | traffic: budget}, @idle_timeout}
    end
  end

  defp persist_live(message, from, state) do
    case command_reply(message, state) do
      {:reply, {:ok, _}, candidate, _} ->
        params = %{
          "title" => state.saved.title,
          "document" => Jason.decode!(Jason.encode!(candidate.document)),
          "expected_revision" => state.saved.revision,
          "mutation_id" =>
            "live:" <>
              state.epoch <>
              ":" <>
              Base.url_encode64(:crypto.hash(:sha256, elem(message, 3)["command_id"]),
                padding: false
              )
        }

        start_save(state, from, {:live, params}, candidate)

      result ->
        result
    end
  end

  defp start_save(state, from, {source, params}, candidate) do
    saved = state.saved

    task =
      Task.Supervisor.async_nolink(Teleprompter.PersistenceTasks, fn ->
        Teleprompter.Library.commit(saved.user, saved.script_id, params)
      end)

    {:noreply,
     %{state | pending_save: %{task: task, from: from, source: source, candidate: candidate}},
     @idle_timeout}
  end

  @impl true
  def handle_info(:save_preferences, %{preference_task: nil} = state) do
    state = %{state | preference_timer: nil}

    if state.appearance_owner && state.preferences.status == "pending" do
      task =
        Task.Supervisor.async_nolink(Teleprompter.PersistenceTasks, fn ->
          revision =
            if state.preference_refresh,
              do: Teleprompter.ReadingPreferences.get(state.appearance_owner).revision,
              else: state.preferences.revision

          Teleprompter.ReadingPreferences.save(state.appearance_owner, state.settings, revision)
        end)

      {:noreply,
       %{
         state
         | preference_refresh: false,
           preference_task: %{task: task, revision: state.settings_revision}
       }, @idle_timeout}
    else
      {:noreply, state, @idle_timeout}
    end
  end

  def handle_info(:save_preferences, state),
    do: {:noreply, %{state | preference_timer: nil}, @idle_timeout}

  def handle_info({ref, result}, %{preference_task: %{task: %{ref: ref}} = pending} = state) do
    Process.demonitor(ref, [:flush])

    preferences =
      case result do
        {:ok, revision} ->
          %{
            state.preferences
            | revision: revision,
              status:
                if(pending.revision == state.settings_revision, do: "saved", else: "pending")
          }

        {:error, :preferences_conflict} ->
          %{state.preferences | status: "conflict"}

        _ ->
          %{state.preferences | status: "unavailable"}
      end

    next = %{
      state
      | preferences: preferences,
        preference_task: nil,
        preferences_status_revision: state.preferences_status_revision + 1
    }

    next = if preferences.status == "pending", do: schedule_preferences(next), else: next
    TeleprompterWeb.Endpoint.broadcast("session:#{state.id}", "session:update", snapshot(next))
    {:noreply, next, @idle_timeout}
  end

  def handle_info({:DOWN, ref, :process, _, _}, %{preference_task: %{task: %{ref: ref}}} = state) do
    next = %{
      state
      | preference_task: nil,
        preferences: %{state.preferences | status: "unavailable"},
        preferences_status_revision: state.preferences_status_revision + 1
    }

    TeleprompterWeb.Endpoint.broadcast("session:#{state.id}", "session:update", snapshot(next))
    {:noreply, next, @idle_timeout}
  end

  def handle_info({ref, result}, %{pending_save: %{task: %{ref: ref}} = pending} = state) do
    Process.demonitor(ref, [:flush])

    case result do
      {:ok, saved_script} ->
        # Transport/presence may have advanced during the database write. Merge
        # only document fields, never restore a stale playback snapshot.
        next =
          if saved_script.revision <= state.saved.revision do
            state
          else
            if pending.source == :live do
              candidate = pending.candidate

              %{
                state
                | document: candidate.document,
                  script: candidate.script,
                  script_revision: candidate.script_revision,
                  block_lengths: candidate.block_lengths,
                  reading: candidate.reading,
                  editing:
                    if(is_nil(state.editing.active), do: state.editing, else: candidate.editing),
                  sequences:
                    Map.merge(state.sequences, candidate.sequences, fn _, a, b -> max(a, b) end)
              }
              |> preserve_patch_anchor(candidate)
            else
              doc = atom_document(saved_script.document)
              replace_saved_document(state, doc)
            end
          end

        next = %{
          next
          | saved:
              if(saved_script.revision > state.saved.revision,
                do: %{state.saved | revision: saved_script.revision, title: saved_script.title},
                else: state.saved
              ),
            pending_save: nil
        }

        snap = snapshot(next)
        TeleprompterWeb.Endpoint.broadcast("session:#{state.id}", "session:update", snap)

        GenServer.reply(
          pending.from,
          if(pending.source == :live, do: {:ok, snap}, else: {:ok, saved_script})
        )

        {:noreply, next, @idle_timeout}

      {:error, reason} ->
        GenServer.reply(
          pending.from,
          {:error, if(pending.source == :live, do: :save_failed, else: reason)}
        )

        {:noreply, %{state | pending_save: nil}, @idle_timeout}
    end
  end

  def handle_info(
        {:DOWN, ref, :process, _, _},
        %{pending_save: %{task: %{ref: ref}} = pending} = state
      ) do
    GenServer.reply(pending.from, {:error, :database_unavailable})
    {:noreply, %{state | pending_save: nil}, @idle_timeout}
  end

  def handle_info(:timeout, state) do
    Diagnostics.record(:session, :ended)
    {:stop, :normal, state}
  end

  defp preserve_patch_anchor(state, %{transport: %{semantic_anchor: intent}}) do
    # A Quick Edit remains paused. Rebase its semantic anchor on the current
    # transport revision without allowing a transport command to be undone.
    transport =
      anchor(state.transport, current_position(state.transport, now_ms()), now_ms(), %{})

    %{
      state
      | transport:
          Map.put(transport, :semantic_anchor, %{
            intent
            | revision: transport.revision,
              transport_position: transport.anchor_position
          })
    }
  end

  defp preserve_patch_anchor(state, _), do: state

  defp atom_document(doc),
    do: %{
      schemaVersion: doc["schemaVersion"],
      id: doc["id"],
      title: doc["title"],
      blocks: Enum.map(doc["blocks"], &%{id: &1["id"], type: &1["type"], text: &1["text"]})
    }

  defp traffic_input({:script, _, _, payload, content}) when is_map(payload),
    do: {"script:update", Map.put(payload, "content", content)}

  defp traffic_input({:edit, _, _, payload, {:patch, text}}) when is_map(payload),
    do: {"script:patch_block", Map.put(payload, "text", text)}

  defp traffic_input({:edit, _, _, payload, {:replace, text}}) when is_map(payload),
    do: {"script:patch_document", Map.put(payload, "text", text)}

  defp traffic_input({:command, _, _, payload, _}), do: {"control", payload}
  defp traffic_input(message), do: {"control", elem(message, 3)}

  defp command_reply({:script, role, client_id, envelope, content}, state) do
    with :ok <- editor_only(role),
         true <- is_nil(state.editing.active),
         :ok <- validate_envelope(state, role, client_id, envelope),
         true <-
           Document.valid_content?(content, true),
         true <-
           is_integer(envelope["base_revision"]) and
             envelope["base_revision"] == state.script_revision do
      document = Document.build(content, state.id)

      next =
        remember(
          %{
            state
            | script: Document.text(document),
              document: document,
              block_lengths: Document.lengths(document),
              script_revision: state.script_revision + 1,
              reading: %{state.reading | revision: state.reading.revision + 1, checkpoint: nil}
          },
          role,
          client_id,
          envelope
        )

      {:reply, {:ok, snapshot(next)}, next, @idle_timeout}
    else
      false -> {:reply, {:error, :invalid_or_stale_script}, state, @idle_timeout}
      error -> {:reply, error, state, @idle_timeout}
    end
  end

  defp command_reply({:command, role, client_id, envelope, :remember_settings}, state) do
    with :ok <- validate_envelope(state, role, client_id, envelope),
         true <- not is_nil(state.appearance_owner) and is_nil(state.preference_task) do
      next =
        remember(
          %{
            state
            | preferences: %{state.preferences | status: "pending"},
              preference_refresh: true
          },
          role,
          client_id,
          envelope
        )
        |> schedule_preferences()

      {:reply, {:ok, snapshot(next)}, next, @idle_timeout}
    else
      false -> {:reply, {:error, :preferences_unavailable}, state, @idle_timeout}
      error -> {:reply, error, state, @idle_timeout}
    end
  end

  defp command_reply({:command, role, client_id, envelope, {:settings, patch}}, state) do
    with :ok <- validate_envelope(state, role, client_id, envelope),
         :ok <- transport_available(state),
         true <- envelope["settings_revision"] === state.settings_revision,
         true <-
           is_map(patch) and map_size(patch) > 0 and
             Enum.all?(
               Map.keys(patch),
               &(&1 in ["fontSize", "lineHeight", "textWidth", "mirrored"])
             ),
         {:ok, settings} <- Teleprompter.PromptSettings.validate(Map.merge(state.settings, patch)) do
      next =
        remember(
          %{state | settings: settings, settings_revision: state.settings_revision + 1},
          role,
          client_id,
          envelope
        )
        |> schedule_preferences()

      {:reply, {:ok, snapshot(next)}, next, @idle_timeout}
    else
      false -> {:reply, {:error, :settings_conflict}, state, @idle_timeout}
      error -> {:reply, error, state, @idle_timeout}
    end
  end

  defp command_reply({:command, role, client_id, envelope, command}, state) do
    with :ok <- validate_envelope(state, role, client_id, envelope),
         :ok <- transport_available(state),
         {:ok, transport} <- command_transport(state, command) do
      next =
        remember(
          %{state | transport: transport},
          role,
          client_id,
          envelope
        )

      next =
        if match?({:set_speed, _}, command) do
          %{
            next
            | settings: Map.put(next.settings, "speed", transport.speed),
              settings_revision: next.settings_revision + 1
          }
          |> schedule_preferences()
        else
          next
        end

      if command == :play and not state.playback_counted,
        do: Teleprompter.Metrics.record("playback_started")

      next = %{next | playback_counted: next.playback_counted or command == :play}
      {:reply, {:ok, snapshot(next)}, next, @idle_timeout}
    else
      false -> {:reply, {:error, :invalid_command}, state, @idle_timeout}
      error -> {:reply, error, state, @idle_timeout}
    end
  end

  defp command_reply({:edit, connection_id, client_id, envelope, action}, state) do
    role = state.clients[connection_id]

    with :ok <- edit_role(role),
         :ok <- validate_envelope(state, role, client_id, envelope),
         {:ok, changed} <- edit_action(state, connection_id, envelope, action) do
      next = remember(changed, role, client_id, envelope)
      {:reply, {:ok, snapshot(next)}, next, @idle_timeout}
    else
      error -> {:reply, error, state, @idle_timeout}
    end
  end

  defp command_reply({:checkpoint, connection_id, client_id, envelope}, state) do
    with true <-
           state.clients[connection_id] == "display" and state.reading.source_id == connection_id,
         :ok <- validate_envelope(state, "display", client_id, envelope),
         true <- valid_checkpoint?(state, envelope) do
      checkpoint = %{
        anchor: envelope["anchor"],
        position: envelope["position"],
        maximum: envelope["maximum"],
        transport_position: envelope["transport_position"],
        transport_revision: envelope["transport_revision"],
        script_revision: envelope["script_revision"],
        source_id: connection_id,
        server_time: now_ms()
      }

      next =
        remember(
          %{
            state
            | reading: %{
                state.reading
                | revision: state.reading.revision + 1,
                  checkpoint: checkpoint
              }
          },
          "display",
          client_id,
          envelope
        )

      {:reply, {:ok, snapshot(next)}, next, @idle_timeout}
    else
      false -> {:reply, {:error, :stale_reading}, state, @idle_timeout}
      error -> {:reply, error, state, @idle_timeout}
    end
  end

  defp transport_available(%{editing: %{active: nil}}), do: :ok
  defp transport_available(_), do: {:error, :editing_active}
  defp edit_role(role) when role in ["editor", "remote"], do: :ok
  defp edit_role(_), do: {:error, :forbidden}

  defp schedule_preferences(state) do
    if state.appearance_owner && state.preferences.status not in ["conflict", "unavailable"] do
      if state.preference_timer, do: Process.cancel_timer(state.preference_timer)

      %{
        state
        | preference_timer: Process.send_after(self(), :save_preferences, 600),
          preferences: %{state.preferences | status: "pending"},
          preferences_status_revision: state.preferences_status_revision + 1
      }
    else
      state
    end
  end

  defp edit_action(state, owner, payload, :begin) do
    cp = state.reading.checkpoint

    cond do
      state.editing.active != nil ->
        {:error, :editing_active}

      state.transport.status != "paused" ->
        {:error, :pause_required}

      is_nil(cp) or cp.source_id != state.reading.source_id or is_nil(state.reading.source_id) or
        cp.script_revision != state.script_revision or
          cp.transport_revision != state.transport.revision ->
        {:error, :reading_unavailable}

      Map.has_key?(payload, "block_id") and
          not Map.has_key?(state.block_lengths, payload["block_id"]) ->
        {:error, :invalid_block}

      true ->
        active = %{
          owner_id: owner,
          block_id: payload["block_id"] || cp.anchor["blockId"],
          anchor: cp.anchor,
          scope: if(payload["scope"] == "document", do: "document", else: "paragraph")
        }

        {:ok, %{state | editing: %{revision: state.editing.revision + 1, active: active}}}
    end
  end

  defp edit_action(state, owner, %{"block_id" => block_id}, :select) do
    cond do
      is_nil(state.editing.active) or state.editing.active.owner_id != owner ->
        {:error, :edit_not_owned}

      not Map.has_key?(state.block_lengths, block_id) ->
        {:error, :invalid_block}

      true ->
        {:ok,
         %{
           state
           | editing: %{
               revision: state.editing.revision + 1,
               active: %{state.editing.active | block_id: block_id, scope: "paragraph"}
             }
         }}
    end
  end

  defp edit_action(state, owner, _payload, :document) do
    if state.editing.active && state.editing.active.owner_id == owner do
      {:ok,
       %{
         state
         | editing: %{
             revision: state.editing.revision + 1,
             active: %{state.editing.active | scope: "document"}
           }
       }}
    else
      {:error, :edit_not_owned}
    end
  end

  defp edit_action(state, owner, payload, {:replace, text}) do
    edit = state.editing.active

    cond do
      is_nil(edit) or edit.owner_id != owner ->
        {:error, :edit_not_owned}

      edit.scope != "document" ->
        {:error, :invalid_scope}

      payload["base_revision"] !== state.script_revision ->
        {:error, :edit_conflict}

      not Document.valid_content?(text, true) ->
        {:error, :invalid_patch}

      true ->
        {document, target} = Document.replace(state.document, text, edit.anchor)
        install_edit(state, document, target)
    end
  end

  defp edit_action(state, owner, payload, {:patch, text}) do
    edit = state.editing.active

    cond do
      is_nil(edit) or edit.owner_id != owner ->
        {:error, :edit_not_owned}

      payload["base_revision"] !== state.script_revision ->
        {:error, :edit_conflict}

      payload["block_id"] != edit.block_id ->
        {:error, :invalid_block}

      edit.scope != "paragraph" ->
        {:error, :invalid_scope}

      not is_binary(text) or not String.valid?(text) or byte_size(text) > 2 * 1024 * 1024 ->
        {:error, :invalid_patch}

      true ->
        {document, target} = Document.patch(state.document, edit.block_id, text, edit.anchor)
        content = Document.text(document)

        if byte_size(content) > 2 * 1024 * 1024 do
          {:error, :invalid_patch}
        else
          install_edit(state, document, target)
        end
    end
  end

  defp edit_action(state, owner, _payload, :end) do
    if state.editing.active && state.editing.active.owner_id == owner,
      do: {:ok, %{state | editing: %{revision: state.editing.revision + 1, active: nil}}},
      else: {:error, :edit_not_owned}
  end

  defp install_edit(state, document, target) do
    edit = state.editing.active
    content = Document.text(document)
    revision = state.script_revision + 1
    now = now_ms()

    transport =
      anchor(state.transport, current_position(state.transport, now), now, %{
        status: "paused"
      })

    intent = %{
      anchor: target,
      script_revision: revision,
      revision: transport.revision,
      transport_position: transport.anchor_position
    }

    {:ok,
     %{
       state
       | document: document,
         script: content,
         script_revision: revision,
         block_lengths: Document.lengths(document),
         transport: Map.put(transport, :semantic_anchor, intent),
         reading: %{state.reading | revision: state.reading.revision + 1, checkpoint: nil},
         editing: %{revision: state.editing.revision + 1, active: %{edit | anchor: target}}
     }}
  end

  defp elect_reader(state) do
    source = List.first(state.display_order)

    if source == state.reading.source_id,
      do: state,
      else: %{
        state
        | reading: %{state.reading | source_id: source, revision: state.reading.revision + 1}
      }
  end

  defp valid_checkpoint?(state, payload) do
    payload["script_revision"] === state.script_revision and
      payload["transport_revision"] === state.transport.revision and
      Document.valid_anchor?(payload["anchor"], state.block_lengths) and
      bounded_pixel?(payload["position"]) and bounded_pixel?(payload["maximum"]) and
      payload["position"] <= payload["maximum"] and
      is_number(payload["transport_position"]) and
      abs(payload["transport_position"]) <= 100_000_000
  end

  defp bounded_pixel?(value), do: is_number(value) and value >= 0 and value <= 100_000_000

  defp command_transport(state, {:seek_anchor, target}) do
    if Document.valid_anchor?(target, state.block_lengths) do
      position = current_position(state.transport, now_ms())
      transport = anchor(state.transport, position, now_ms(), %{})

      intent = %{
        anchor: target,
        script_revision: state.script_revision,
        revision: transport.revision,
        transport_position: position
      }

      {:ok, Map.put(transport, :semantic_anchor, intent)}
    else
      {:error, :invalid_anchor}
    end
  end

  defp command_transport(state, {:step_block, direction}) when direction in [-1, 1] do
    target = latest_anchor(state)
    index = target && Enum.find_index(state.document.blocks, &(&1.id == target["blockId"]))

    if is_integer(index) do
      block =
        Enum.at(
          state.document.blocks,
          min(length(state.document.blocks) - 1, max(0, index + direction))
        )

      command_transport(state, {:seek_anchor, %{"blockId" => block.id, "characterOffset" => 0}})
    else
      {:error, :reading_unavailable}
    end
  end

  defp command_transport(state, {:seek_delta, delta})
       when is_number(delta) and abs(delta) <= 10_000 do
    now = now_ms()
    canonical = current_position(state.transport, now)
    checkpoint = state.reading.checkpoint
    intent = Map.get(state.transport, :semantic_anchor)
    current_intent = not is_nil(intent) and intent.script_revision == state.script_revision

    position =
      cond do
        checkpoint && checkpoint.script_revision == state.script_revision &&
            (not current_intent || checkpoint.transport_revision >= intent.revision) ->
          # Transport is a distance cursor, not the reflowed display's origin.
          # Apply the delta at the measured screen bounds, discarding overshoot.
          local =
            clamp(
              checkpoint.position + canonical - checkpoint.transport_position,
              0,
              checkpoint.maximum
            )

          target = clamp(local + delta, 0, checkpoint.maximum)
          checkpoint.transport_position + target - checkpoint.position

        current_intent ->
          canonical + delta

        true ->
          max(0.0, canonical + delta)
      end

    {:ok, anchor(state.transport, position, now, %{})}
  end

  defp command_transport(state, command) do
    if valid_command?(command),
      do: {:ok, apply_command(state.transport, command, now_ms())},
      else: {:error, :invalid_command}
  end

  defp latest_anchor(state) do
    intent = Map.get(state.transport, :semantic_anchor)
    checkpoint = state.reading.checkpoint

    cond do
      intent && intent.script_revision == state.script_revision &&
          (is_nil(checkpoint) || intent.revision > checkpoint.transport_revision) ->
        intent.anchor

      checkpoint && checkpoint.script_revision == state.script_revision ->
        checkpoint.anchor

      true ->
        nil
    end
  end

  defp replace_saved_document(state, doc) do
    revision = state.script_revision + 1
    target = latest_anchor(state)

    transport =
      if target && doc.blocks != [] do
        old_index = Enum.find_index(state.document.blocks, &(&1.id == target["blockId"])) || 0
        prior = Enum.at(state.document.blocks, old_index)

        block =
          Enum.find(doc.blocks, &(&1.id == target["blockId"])) ||
            Enum.at(doc.blocks, min(old_index, length(doc.blocks) - 1))

        offset =
          if prior && block.id == prior.id,
            do: Document.remap_offset(prior.text, block.text, target["characterOffset"]),
            else: 0

        now = now_ms()
        anchored = anchor(state.transport, current_position(state.transport, now), now, %{})

        Map.put(anchored, :semantic_anchor, %{
          anchor: %{"blockId" => block.id, "characterOffset" => offset},
          script_revision: revision,
          revision: anchored.revision,
          transport_position: anchored.anchor_position
        })
      else
        state.transport
      end

    %{
      state
      | document: doc,
        script: Document.text(doc),
        script_revision: revision,
        block_lengths: Document.lengths(doc),
        transport: transport,
        reading: %{state.reading | revision: state.reading.revision + 1, checkpoint: nil}
    }
  end

  defp editor_only("editor"), do: :ok
  defp editor_only(_), do: {:error, :forbidden}

  defp validate_envelope(state, role, client_id, %{
         "protocol_version" => 2,
         "sequence" => sequence,
         "command_id" => command_id
       })
       when role in ["editor", "display", "remote"] and is_binary(client_id) and
              is_integer(sequence) and sequence > 0 and sequence <= 9_007_199_254_740_991 do
    cond do
      command_id != "#{client_id}:#{sequence}" ->
        {:error, :invalid_command}

      sequence <= Map.get(state.sequences, {role, client_id}, 0) ->
        {:error, :stale_command}

      map_size(state.sequences) >= 1024 and not Map.has_key?(state.sequences, {role, client_id}) ->
        {:error, :session_limit}

      true ->
        :ok
    end
  end

  defp validate_envelope(_, _, _, _), do: {:error, :invalid_command}

  defp remember(state, role, client_id, envelope) do
    key = {role, client_id}

    # Never evict a high-water mark: that would allow old seeks to replay.
    %{state | sequences: Map.put(state.sequences, key, envelope["sequence"])}
  end

  defp valid_command?(command) when command in [:play, :pause], do: true

  defp valid_command?({:set_speed, speed}) when is_number(speed),
    do: speed >= 0.2 and speed <= 1.5

  defp valid_command?({:seek_delta, delta}) when is_number(delta), do: abs(delta) <= 10_000

  defp valid_command?({:seek_to, position}) when is_number(position),
    do: position >= 0 and position <= 100_000_000

  defp valid_command?(_), do: false

  defp apply_command(transport, :play, now) do
    anchor(transport, current_position(transport, now), now, %{status: "playing"})
  end

  defp apply_command(transport, :pause, now) do
    anchor(transport, current_position(transport, now), now, %{status: "paused"})
  end

  defp apply_command(transport, {:set_speed, speed}, now) when is_number(speed) do
    anchor(transport, current_position(transport, now), now, %{speed: clamp(speed, 0.2, 1.0)})
  end

  defp apply_command(transport, {:seek_delta, delta}, now) when is_number(delta) do
    position = max(0.0, current_position(transport, now) + delta)
    anchor(transport, position, now, %{})
  end

  defp apply_command(transport, {:seek_to, position}, now) when is_number(position) do
    anchor(transport, max(0.0, position), now, %{})
  end

  defp apply_command(transport, _unknown, _now), do: transport

  defp current_position(%{status: "playing"} = transport, now) do
    elapsed_seconds = max(0, now - transport.anchor_server_time) / 1_000
    transport.anchor_position + elapsed_seconds * 52 * transport.speed
  end

  defp current_position(transport, _now), do: transport.anchor_position

  defp anchor(transport, position, now, changes) do
    transport
    |> Map.merge(changes)
    |> Map.merge(%{
      anchor_position: position,
      anchor_server_time: now,
      revision: transport.revision + 1
    })
  end

  defp snapshot(state) do
    %{
      protocol_version: 2,
      saved_revision: if(state.saved, do: state.saved.revision, else: nil),
      display_settings: state.settings,
      settings_revision: state.settings_revision,
      preferences_status: state.preferences.status,
      preferences_status_revision: state.preferences_status_revision,
      session_id: state.id,
      session_epoch: state.epoch,
      script: %{content: state.script, revision: state.script_revision, document: state.document},
      reading: state.reading,
      editing: state.editing,
      transport: state.transport,
      presence: presence(state.clients),
      server_time: now_ms()
    }
  end

  defp presence(clients) do
    clients
    |> Map.values()
    |> Enum.frequencies()
    |> Map.merge(%{"editor" => 0, "display" => 0, "remote" => 0}, fn _key, count, _ -> count end)
  end

  defp now_ms, do: System.system_time(:millisecond)
  defp clamp(value, min, max), do: value |> Kernel.max(min) |> Kernel.min(max)
end
