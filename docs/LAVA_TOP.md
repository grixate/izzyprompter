# Lava.top — Lifetime Pro

Owner decision, 2026-10-12: use **lava.top exclusively**, with **US$29 paid once**. New checkout uses USD only. No recurring billing. Existing RUB/Prodamus history and entitlements remain supported, but neither is offered for new purchases.

## What is implemented

- The signed-in account workspace offers US$29 Lifetime Pro: unlimited saved scripts and named display presets. The remote skins are still design studies; this offer does not claim they are shipped.
- The server creates a stored purchase attempt before requesting `POST https://gate.lava.top/api/v3/invoice`. It sends the account email, offer ID, server-owned amount 29 and currency USD. Lava selects its available payment methods; IZZY does not force a card processor or collect card details.
- On HTTPS deployments, success, failure and cancellation all return to `/account?purchase=OUR_ATTEMPT_ID`. Lava appends `invoiceId` and `status`; neither is used to select the invoice or grant access.
- Returning to the account automatically checks the owned pending purchase once. `POST /api/account/purchases/:id/check` uses the stored provider invoice ID, requires login/ownership/CSRF, and shares the six-per-account/minute checkout budget. Buyers can also check again or resume an existing hosted checkout.
- Authenticated webhooks enter a unique, durable inbox; the worker applies them every five seconds. The browser polls local purchase status while pending and refreshes account entitlement even if its WebSocket misses an update.
- Invoice checks use `GET /api/v1/invoices/:id`, require the returned invoice ID to match, and verify the receipt's amount/currency before granting Pro. They remain available when new sales are disabled.
- Repeated checkout requests reuse the pending link. Invoice creation is never retried automatically. A definite 400/401/403/404/422 rejection records a failed attempt; a timeout, redirect, malformed success response or server error stays ambiguous and blocks automatic re-creation. A legacy-provider switch needs explicit buyer confirmation.
- Replayed success events do not duplicate access. Refunds/disputes cannot be undone by delayed success events. Unknown authenticated event types return 2xx. Buyer/card payloads are not retained in the payment inbox.

## Merchant setup

1. In Lava.top, create a **one-time Digital Product** for IZZY Lifetime Pro. Enable **Price on request via API**, which lets the integration supply US$29 without editing the product for every invoice. Use a product description that matches the features currently shipped. Confirm your merchant supports the intended countries and USD sales.
2. In **Integrations → API**, create an API key and obtain the product's **offer/tier ID** (not its product ID). Put these in the server's secret store as `LAVA_API_KEY` and `LAVA_OFFER_ID`.
3. Generate a separate random inbound secret, for example with `openssl rand -hex 32`. Store it as `LAVA_WEBHOOK_SECRET`. Do not reuse the outbound API key, and keep the webhook secret within Lava's 80-character limit.
4. Add a webhook at `https://YOUR_DOMAIN/api/payments/lava`, authenticate it with **Your service's API key / X-Api-Key**, and enter that inbound secret. Select **payment.success**, **payment.failed**, **refund.success** and **chargeback.initiated**. Subscription events are unnecessary for this offer; unknown events are acknowledged safely.
5. Deploy the account-enabled app behind HTTPS using [account setup](ACCOUNTS_COMMERCE.md) and [deployment instructions](DEPLOYMENT.md). Apply migrations once, configure mail, and verify account sign-in. If your network filters incoming webhooks, consult Lava's current documented source IP.
6. Set the runtime variables below in the server environment. Phoenix does not load `.env` files automatically. No key belongs in `VITE_*`, browser code, source control, screenshots or chat.

```sh
PUBLIC_ORIGIN=https://YOUR_DOMAIN
LAVA_CURRENCIES=USD
LAVA_OFFER_ID=YOUR_ONE_TIME_OFFER_UUID
LAVA_API_KEY=YOUR_OUTBOUND_KEY
LAVA_WEBHOOK_SECRET=YOUR_SEPARATE_INBOUND_SECRET
LAVA_APPROVED=true
IZZY_PAYMENTS_ENABLED=true
```

Restart the service after changing runtime configuration. Leave `IZZY_PAYMENTS_ENABLED=false` until merchant setup is ready for the payment acceptance check. `LAVA_APPROVED` records merchant readiness; it is not a second provider choice. The app hides the offer when required credentials are missing or outbound and inbound secrets are identical. HTTP local development omits return URLs because Lava requires HTTPS for them.

## Real payment acceptance

No universal Lava sandbox is assumed. Automated tests use synthetic HTTP responses and do not charge money. Once the merchant is ready, perform an explicitly authorized real purchase through a normal signed-in account and verify:

1. The hosted checkout shows US$29, one-time billing and the correct product.
2. A successful payment returns to IZZY; the webhook is delivered, the stored attempt becomes paid, and the account gains Pro exactly once. Refresh/re-login preserves access.
3. Cancelling or failing payment leaves the account Free. A pending purchase resumes the same link. An unverified timeout does not create another invoice automatically.
4. Re-send a payment webhook from Lava's history; it must not create another grant. With new sales temporarily off, **Check payment status** can still recover a confirmed owned invoice whose notification was missed.
5. Complete an authorized full refund in Lava, verify the event and revoke only that purchase's grant. Partial refunds preserve access. Inspect the merchant's settlement/payout separately.

Lava's documented refund/chargeback envelopes may lack an invoice ID. These events are stored for **operator review**, with no automatic email matching. Use the audited `operator_match_event` workflow in [account/payment support](ACCOUNTS_COMMERCE.md) after verifying the transaction in Lava. The operator functions record results; they do not send money or issue refunds.

For ambiguous creation with no stored invoice ID, support must establish the outcome with Lava before permitting another attempt. After verifying that no payable invoice exists, use audited `operator_confirm(attempt_id, "failed", actor, verified_reference)` to release the pending attempt. It cannot downgrade an already paid/refunded/disputed attempt.

## Verification

Local verification on 2026-10-12: the frontend production build, JavaScript unit tests, full PostgreSQL-backed Elixir suite, and checkout/return browser tests pass. The payment browser tests cover the USD-only offer, hosted redirect, forged return status, explicit checking, entitlement refresh, failed payment retry and disabled-sales recovery. Provider/controller tests cover authenticated duplicate callbacks, ownership/CSRF, receipt mismatch, unrelated invoice IDs, unknown event acknowledgements, rejected requests and ambiguous failures. All provider requests in these tests are fixtures.

**Still external:** production domain/server configuration, merchant credentials/offer, webhook setup, real purchase/refund and settlement verification. No real payment or deployment was performed.

References checked 2026-10-12: [Lava.top developer guide](https://developers.lava.top/en), [official OpenAPI specification](https://gate.lava.top/docs/documentation.yaml).
