defmodule Teleprompter.Commerce.Provider do
  @callback checkout(struct(), struct()) :: {:ok, map()} | {:error, term()}
  @callback authenticate(map(), map()) :: boolean()
  @callback normalize(map()) :: map()
  @callback reconcile(struct()) :: {:ok, map()} | {:error, term()}
  def module("prodamus"), do: Teleprompter.Commerce.Prodamus
  def module("lava"), do: Teleprompter.Commerce.Lava
  def module(_), do: nil

  def config(provider),
    do: Application.get_env(:teleprompter, :payment_providers, %{})[provider] || []

  def environment(provider), do: Keyword.get(config(provider), :environment, "test")

  def enabled?(provider, currency),
    do:
      Application.get_env(:teleprompter, :payments_enabled, false) and
        provider == "lava" and Teleprompter.Commerce.Lava.configured?() and
        Keyword.get(config(provider), :approved, false) and
        currency in Keyword.get(config(provider), :currencies, [])

  def secure_equal(a, b),
    do:
      is_binary(a) and is_binary(b) and byte_size(a) > 0 and byte_size(a) == byte_size(b) and
        Plug.Crypto.secure_compare(a, b)

  def minor(value) when is_integer(value) and value >= 0 and value <= 1_000_000_000,
    do: value * 100

  def minor(value) when is_binary(value) or is_float(value) do
    text = to_string(value)
    # Payment amounts are fixed-point money, not arbitrary-precision exponent
    # expressions. Bound before Decimal operations to prevent enormous integers.
    if byte_size(text) <= 24 and Regex.match?(~r/^[0-9]{1,10}(\.[0-9]{1,2})?$/, text) do
      {decimal, ""} = Decimal.parse(text)

      if Decimal.compare(decimal, 1_000_000_000) != :gt,
        do: decimal |> Decimal.mult(100) |> Decimal.to_integer()
    end
  end

  def minor(_), do: nil

  def safe_url?(url) when is_binary(url) do
    uri = URI.parse(url)
    uri.scheme == "https" and is_binary(uri.host) and is_nil(uri.userinfo)
  end

  def safe_url?(_), do: false
end
