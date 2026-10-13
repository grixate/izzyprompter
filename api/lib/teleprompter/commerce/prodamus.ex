defmodule Teleprompter.Commerce.Prodamus do
  @behaviour Teleprompter.Commerce.Provider
  alias Teleprompter.Commerce.Provider

  def checkout(attempt, user) do
    config = Provider.config("prodamus")

    data = %{
      "do" => "link",
      "order_id" => attempt.id,
      "customer_email" => user.email,
      "sys" => config[:sys],
      "currency" => String.downcase(attempt.currency),
      "payments_limit" => 1,
      "products" => [
        %{
          "name" => "IZZY Lifetime Pro",
          "price" => Decimal.to_string(Decimal.div(attempt.amount_minor, 100), :normal),
          "quantity" => 1
        }
      ],
      "urlSuccess" => Teleprompter.Accounts.origin() <> "/account?purchase=" <> attempt.id,
      "urlReturn" => Teleprompter.Accounts.origin() <> "/account?purchase=" <> attempt.id,
      "urlNotification" => Teleprompter.Accounts.origin() <> "/api/payments/prodamus",
      "demo_mode" => if(attempt.environment == "test", do: 1, else: 0)
    }

    if is_binary(config[:secret]) and is_binary(config[:sys]) and Provider.safe_url?(config[:url]) do
      payload = Map.put(data, "signature", sign(data, config[:secret]))

      with {:ok, %{status: 200, body: body}} <-
             Req.post(
               config[:url],
               Keyword.merge(
                 [
                   body: encode_form(payload),
                   headers: [{"content-type", "application/x-www-form-urlencoded"}],
                   retry: false,
                   redirect: false,
                   receive_timeout: 10_000
                 ],
                 config[:http_options] || []
               )
             ),
           url when is_binary(url) <- body,
           true <- Provider.safe_url?(String.trim(url)) do
        {:ok, %{external_id: attempt.id, checkout_url: String.trim(url)}}
      else
        _ -> {:error, :ambiguous_checkout}
      end
    else
      {:error, :provider_not_configured}
    end
  end

  def authenticate(payload, headers) do
    secret = Provider.config("prodamus")[:secret]

    is_binary(secret) and byte_size(secret) > 0 and
      Provider.secure_equal(sign(payload, secret), String.downcase(headers["sign"] || ""))
  end

  def normalize(payload) do
    %{
      external_id: payload["order_num"],
      type: if(payload["payment_status"] == "success", do: "paid", else: "unknown"),
      amount_minor: Provider.minor(payload["sum"]),
      currency: String.upcase(to_string(payload["currency"])),
      key:
        "payment:" <>
          to_string(payload["order_id"]) <> ":" <> to_string(payload["payment_status"]),
      test: to_string(payload["demo_mode"] || "0") == "1"
    }
  end

  # Payform's documented link API does not establish a status/cancellation
  # endpoint. Reconcile through the merchant dashboard and audited operator tool.
  def reconcile(_), do: {:error, :manual_reconciliation_required}

  # Matches the official PHP Hmac helper: recursive string conversion, sorted
  # object keys, unescaped Unicode, PHP's escaped slash representation.
  def sign(data, secret),
    do: :crypto.mac(:hmac, :sha256, secret, canonical(data)) |> Base.encode16(case: :lower)

  def canonical(data) when is_map(data) do
    keys = Map.keys(data)

    if keys != [] and
         Enum.sort(keys) == Enum.sort(Enum.map(0..(length(keys) - 1), &Integer.to_string/1)) do
      canonical(Enum.map(0..(length(keys) - 1), &Map.fetch!(data, Integer.to_string(&1))))
    else
      "{" <>
        (data
         |> Enum.sort_by(fn {key, _} -> key end)
         |> Enum.map_join(",", fn {k, v} -> json_string(k) <> ":" <> canonical(v) end)) <> "}"
    end
  end

  def canonical(data) when is_list(data), do: "[" <> Enum.map_join(data, ",", &canonical/1) <> "]"
  def canonical(nil), do: "\"\""
  def canonical(false), do: "\"\""
  def canonical(true), do: "\"1\""

  def canonical(data) when is_float(data),
    do: json_string(String.replace_suffix(to_string(data), ".0", ""))

  def canonical(data), do: data |> to_string() |> json_string()

  defp json_string(data),
    do:
      data
      |> Jason.encode!()
      |> String.replace("/", "\\/")
      |> String.replace("\u2028", "\\u2028")
      |> String.replace("\u2029", "\\u2029")

  defp encode_form(data), do: flatten(data, nil) |> URI.encode_query()

  defp flatten(data, prefix) when is_map(data),
    do:
      Enum.flat_map(data, fn {k, v} -> flatten(v, if(prefix, do: "#{prefix}[#{k}]", else: k)) end)

  defp flatten(data, prefix) when is_list(data),
    do: data |> Enum.with_index() |> Enum.flat_map(fn {v, i} -> flatten(v, "#{prefix}[#{i}]") end)

  defp flatten(data, prefix), do: [{prefix, to_string(data)}]
end
