defmodule Teleprompter.DiagnosticsTest do
  use ExUnit.Case, async: false
  import ExUnit.CaptureLog
  alias Teleprompter.Diagnostics

  setup do
    pid = start_supervised!({Diagnostics, named_table: false, interval: 0})
    %{pid: pid, table: GenServer.call(pid, :table)}
  end

  test "concurrent counting is bounded and never accepts user-controlled labels", %{
    pid: pid,
    table: table
  } do
    1..1000
    |> Task.async_stream(fn _ -> Diagnostics.record(:command, :ok, table) end)
    |> Stream.run()

    for text <- ["private script", "secret key", "client-id", "session-id"] do
      Diagnostics.record(text, :ok, table)
      Diagnostics.record(:join, text, table)
    end

    summary = Diagnostics.snapshot(pid)
    assert summary.counters.command.ok == 1000
    assert :ets.info(table, :size) == 32
    refute inspect(summary) =~ "private script"

    assert Enum.all?(Map.values(summary.counters), fn counts ->
             Enum.all?(Map.values(counts), &is_integer/1)
           end)
  end

  test "reports contain aggregate counters only", %{pid: pid, table: table} do
    previous = Logger.level()
    Logger.configure(level: :info)
    on_exit(fn -> Logger.configure(level: previous) end)
    Diagnostics.record(:command, :rate_limited, table)

    log =
      capture_log([level: :info], fn ->
        send(pid, :report)
        assert Diagnostics.snapshot(pid).counters.command.rate_limited == 1
      end)

    assert log =~ "izzy_diagnostics"
    assert log =~ "rate_limited"

    for forbidden <- ["content", "token", "session_id", "client_id", "remote_ip", "text"] do
      refute log =~ forbidden
    end
  end

  test "missing diagnostics never interrupt a session operation" do
    assert :ok = Diagnostics.record(:command, :ok, :absent_diagnostics)
    result = {:error, :payload_too_large}
    assert Diagnostics.result(:command, result) == result
  end
end
