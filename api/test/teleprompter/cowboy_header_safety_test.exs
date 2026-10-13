defmodule Teleprompter.CowboyHeaderSafetyTest.Handler do
  def init(req, state) do
    # Deliberately bypass Plug's own header validation to exercise Cowboy's
    # actual on-wire defense for EEF-CVE-2026-43966.
    value = :cow_http_struct_hd.item({:item, {:string, "safe\r\nx-injected: unsafe"}, []})
    req = :cowboy_req.reply(200, %{"x-structured" => value}, "body", req)
    {:ok, req, state}
  end
end

defmodule Teleprompter.CowboyHeaderSafetyTest do
  use ExUnit.Case, async: false
  @tag capture_log: true
  test "Cowboy rejects structured header CRLF before it reaches the wire" do
    name = __MODULE__

    dispatch =
      :cowboy_router.compile([{:_, [{"/", Teleprompter.CowboyHeaderSafetyTest.Handler, []}]}])

    {:ok, _} =
      :cowboy.start_clear(name, %{socket_opts: [ip: {127, 0, 0, 1}, port: 0]}, %{
        env: %{dispatch: dispatch}
      })

    on_exit(fn -> :cowboy.stop_listener(name) end)
    port = :ranch.get_port(name)
    {:ok, socket} = :gen_tcp.connect({127, 0, 0, 1}, port, [:binary, active: false], 2000)
    :ok = :gen_tcp.send(socket, "GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
    response = read(socket, "")
    :gen_tcp.close(socket)
    refute response =~ "\r\nx-injected:"
    refute response =~ "HTTP/1.1 200"
    assert response =~ "HTTP/1.1 500"
  end

  defp read(socket, acc) do
    case :gen_tcp.recv(socket, 0, 2000) do
      {:ok, data} -> read(socket, acc <> data)
      {:error, :closed} -> acc
      other -> flunk("Unexpected socket result: #{inspect(other)}")
    end
  end
end
