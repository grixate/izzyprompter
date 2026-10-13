defmodule Teleprompter.Commerce.Lava do
  @behaviour Teleprompter.Commerce.Provider
  alias Teleprompter.Commerce.Provider

  def configured? do
    config = Provider.config("lava")

    Enum.all?([:api_key, :offer_id, :webhook_secret], fn key ->
      is_binary(config[key]) and String.trim(config[key]) != ""
    end) and config[:api_key] != config[:webhook_secret] and
      Provider.environment("lava") == "production"
  end

  def checkout(attempt, user) do
    config = Provider.config("lava")
    # lava.top test mode is not assumed to exist. Production API calls are
    # possible only after explicit merchant approval and the payments flag.
    if configured?() and
         attempt.environment == "production" do
      return_url = Teleprompter.Accounts.origin() <> "/account?purchase=" <> attempt.id

      body = %{
        email: user.email,
        offerId: config[:offer_id],
        amount: attempt.amount_minor / 100,
        currency: attempt.currency
      }

      # Lava accepts HTTPS return URLs only. Local HTTP development can still
      # exercise requests with fixtures without sending invalid return fields.
      body =
        if URI.parse(return_url).scheme == "https" do
          Map.merge(body, %{
            successful_return_url: return_url,
            failure_return_url: return_url,
            cancel_return_url: return_url
          })
        else
          body
        end

      case Req.post(
             "https://gate.lava.top/api/v3/invoice",
             Keyword.merge(
               [
                 json: body,
                 headers: [{"x-api-key", config[:api_key]}],
                 retry: false,
                 redirect: false,
                 receive_timeout: 10_000
               ],
               config[:http_options] || []
             )
           ) do
        {:ok, %{status: status, body: %{"id" => id, "paymentUrl" => url}}}
        when status in 200..299 and is_binary(id) and byte_size(id) in 1..256 ->
          if checkout_url?(url),
            do: {:ok, %{external_id: id, checkout_url: url}},
            else: {:error, :invalid_provider_response}

        {:ok, %{status: status}} when status in [400, 401, 403, 404, 422] ->
          {:error, :checkout_rejected}

        _ ->
          {:error, :ambiguous_checkout}
      end
    else
      {:error, :provider_not_configured}
    end
  end

  defp checkout_url?(url) do
    if Provider.safe_url?(url) do
      host = URI.parse(url).host
      host == "lava.top" or String.ends_with?(host, ".lava.top")
    else
      false
    end
  end

  def authenticate(_, headers) do
    config = Provider.config("lava")

    config[:webhook_secret] != config[:api_key] and
      Provider.secure_equal(config[:webhook_secret], headers["x-api-key"])
  end

  def normalize(%{"event_type" => type, "event_id" => event_id, "data" => data})
      when is_binary(type) and is_binary(event_id) and is_map(data) do
    # The documented refund/dispute envelope may omit invoice identity. Do not
    # guess a purchase from an email: such an event requires operator review.
    %{
      external_id: data["invoice_id"],
      key: event_id,
      type:
        case type do
          "refund.success" ->
            if(data["refund_type"] == "full", do: "refunded", else: "partial_refund")

          "chargeback.initiated" ->
            "disputed"

          _ ->
            "unknown"
        end,
      amount_minor: Provider.minor(data["amount"]),
      currency: data["currency"],
      test: false
    }
  end

  def normalize(%{"event_type" => type})
      when type not in ["refund.success", "chargeback.initiated"],
      do: %{type: "unknown", key: nil}

  def normalize(%{"event_type" => _}), do: %{key: nil}

  def normalize(%{"eventType" => type})
      when is_binary(type) and type not in ["payment.success", "payment.failed"],
      do: %{type: "unknown", key: nil}

  def normalize(%{"contractId" => id, "eventType" => type} = payload)
      when is_binary(id) and byte_size(id) in 1..256 and is_binary(type) do
    %{
      external_id: payload["contractId"],
      key: "#{payload["contractId"]}:#{payload["eventType"]}",
      type:
        case payload["eventType"] do
          "payment.success" -> "paid"
          "payment.failed" -> "failed"
          _ -> "unknown"
        end,
      amount_minor: Provider.minor(payload["amount"]),
      currency: payload["currency"],
      test: false
    }
  end

  def normalize(_), do: %{key: nil}

  def reconcile(attempt) do
    if is_binary(attempt.external_id) and attempt.external_id != "" and
         is_binary(Provider.config("lava")[:api_key]) do
      fetch_status(attempt)
    else
      {:error, :status_unconfirmed}
    end
  end

  defp fetch_status(attempt) do
    case Req.get(
           "https://gate.lava.top/api/v1/invoices/" <> URI.encode(attempt.external_id || ""),
           Keyword.merge(
             [
               headers: [{"x-api-key", Provider.config("lava")[:api_key]}],
               retry: false,
               redirect: false,
               receive_timeout: 10_000
             ],
             Provider.config("lava")[:http_options] || []
           )
         ) do
      {:ok, %{status: 200, body: %{"id" => id, "status" => "COMPLETED", "receipt" => receipt}}}
      when id == attempt.external_id and is_map(receipt) ->
        {:ok,
         %{
           external_id: attempt.external_id,
           key: "reconcile:" <> attempt.external_id,
           type: "paid",
           amount_minor: Provider.minor(receipt["amount"]),
           currency: receipt["currency"],
           test: false
         }}

      {:ok, %{status: 200, body: %{"id" => id, "status" => "FAILED", "receipt" => receipt}}}
      when id == attempt.external_id and is_map(receipt) ->
        {:ok,
         %{
           external_id: id,
           key: "reconcile:failed:" <> id,
           type: "failed",
           amount_minor: Provider.minor(receipt["amount"]),
           currency: receipt["currency"],
           test: false
         }}

      _ ->
        {:error, :status_unconfirmed}
    end
  end
end
