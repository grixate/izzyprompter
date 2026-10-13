defmodule TeleprompterWeb.LimitedBodyTest do
  use ExUnit.Case, async: true
  import Plug.Conn

  test "oversized JSON fails before decoding or entering the session controller" do
    options =
      Plug.Parsers.init(
        parsers: [:json],
        json_decoder: Jason,
        length: 10,
        body_reader: {TeleprompterWeb.LimitedBody, :read_body, []}
      )

    conn =
      Plug.Test.conn(:post, "/api/sessions", ~s({"content":"too long"}))
      |> put_req_header("content-type", "application/json")

    assert_raise Plug.Parsers.RequestTooLargeError, fn -> Plug.Parsers.call(conn, options) end
  end

  test "bounded JSON and unsupported media types have explicit parser outcomes" do
    options =
      Plug.Parsers.init(
        parsers: [:json],
        json_decoder: Jason,
        length: 100,
        body_reader: {TeleprompterWeb.LimitedBody, :read_body, []}
      )

    conn =
      Plug.Test.conn(:post, "/api/sessions", ~s({"content":"small"}))
      |> put_req_header("content-type", "application/json")

    assert Plug.Parsers.call(conn, options).body_params == %{"content" => "small"}

    invalid =
      Plug.Test.conn(:post, "/api/sessions", "unsupported")
      |> put_req_header("content-type", "application/octet-stream")

    assert_raise Plug.Parsers.UnsupportedMediaTypeError, fn ->
      Plug.Parsers.call(invalid, options)
    end
  end
end
