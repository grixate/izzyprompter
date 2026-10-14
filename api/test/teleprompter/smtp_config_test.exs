defmodule Teleprompter.SmtpConfigTest do
  use ExUnit.Case, async: true
  alias Teleprompter.SmtpConfig

  defp env(overrides) do
    values =
      Map.merge(
        %{
          "SMTP_HOST" => "postbox.cloud.yandex.net",
          "SMTP_USERNAME" => "test-key-id",
          "SMTP_PASSWORD" => "test-secret"
        },
        overrides
      )

    &Map.get(values, &1)
  end

  test "Postbox requires authenticated TLS with CA and hostname validation" do
    config = SmtpConfig.from_env(env(%{}))
    assert config[:port] == 587
    assert config[:ssl] == false
    assert config[:auth] == :always
    assert config[:tls] == :always
    assert config[:no_mx_lookups]
    assert config[:tls_options][:verify] == :verify_peer
    assert config[:tls_options][:cacerts] != []
    assert config[:tls_options][:server_name_indication] == ~c"postbox.cloud.yandex.net"
    assert config[:tls_options][:versions] == [:"tlsv1.2", :"tlsv1.3"]
    assert is_function(config[:tls_options][:customize_hostname_check][:match_fun], 2)
  end

  test "incomplete credentials and wrong transport fail without disclosing values" do
    for key <- ["SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD"], value <- ["", "\nsecret", " "] do
      assert_raise RuntimeError, "#{key} is required and must be a single nonempty line", fn ->
        SmtpConfig.from_env(env(%{key => value}))
      end
    end

    for value <- [nil, ""] do
      assert_raise RuntimeError, ~r/SMTP_PASSWORD is required/, fn ->
        SmtpConfig.from_env(env(%{"SMTP_PASSWORD" => value}))
      end
    end

    assert_raise RuntimeError, "SMTP_PORT must be 587 (authenticated STARTTLS)", fn ->
      SmtpConfig.from_env(env(%{"SMTP_PORT" => "465"}))
    end
  end

  test "guest/local mode needs no SMTP configuration" do
    assert SmtpConfig.from_env(fn _ -> nil end) == nil
  end
end
