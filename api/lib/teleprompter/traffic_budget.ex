defmodule Teleprompter.TrafficBudget do
  @moduledoc "Constant-size token buckets; no payloads or client identities are retained."

  @heavy ~w(script:update script:patch_block script:patch_document)

  def new(scope, now \\ System.monotonic_time(:millisecond)) do
    limits =
      case scope do
        :channel ->
          %{messages: {120, 60}, bytes: {8 * 1024 * 1024, 2 * 1024 * 1024}, edits: {8, 6}}

        :session ->
          %{messages: {240, 120}, bytes: {16 * 1024 * 1024, 4 * 1024 * 1024}, edits: {16, 12}}
      end

    %{at: now, limits: limits, tokens: Map.new(limits, fn {key, {burst, _}} -> {key, burst} end)}
  end

  def admit(budget, event, payload, now \\ System.monotonic_time(:millisecond)) do
    elapsed = max(0, now - budget.at) / 1000

    tokens =
      Map.new(budget.limits, fn {key, {burst, rate}} ->
        {key, min(burst, budget.tokens[key] + elapsed * rate)}
      end)

    budget = %{budget | at: now, tokens: tokens}
    bytes = :erlang.external_size(payload)
    maximum = if event in @heavy, do: 3 * 1024 * 1024, else: 4096

    cond do
      tokens.messages < 1 ->
        refuse(budget, 1 / elem(budget.limits.messages, 1))

      true ->
        # Even malformed/oversized attempts consume the cheap message budget.
        budget = put_in(budget.tokens.messages, tokens.messages - 1)

        cond do
          not is_map(payload) ->
            {:error, :invalid_command, 0, budget}

          bytes > maximum ->
            {:error, :payload_too_large, 0, budget}

          tokens.bytes < bytes ->
            refuse(budget, (bytes - tokens.bytes) / elem(budget.limits.bytes, 1))

          event in @heavy and tokens.edits < 1 ->
            refuse(budget, (1 - tokens.edits) / elem(budget.limits.edits, 1))

          true ->
            budget = put_in(budget.tokens.bytes, tokens.bytes - bytes)

            budget =
              if event in @heavy, do: put_in(budget.tokens.edits, tokens.edits - 1), else: budget

            {:ok, budget}
        end
    end
  end

  defp refuse(budget, seconds), do: {:error, :rate_limited, max(1, ceil(seconds * 1000)), budget}
end
