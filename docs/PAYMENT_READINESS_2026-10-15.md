# Payment readiness — 15 October 2026

The local candidate now covers checkout, verified activation, missed-notification
recovery and account-return recovery. **Sales are not activated.** Production
and staging retain their approved images and runtime configuration. No real
invoice, charge, refund, merchant message or payout was initiated during this work.

## Observed environment state

Read-only inspection of both running containers found:

| Item | Production | Staging |
| --- | --- | --- |
| Account database | Configured | Configured |
| SMTP configuration | Present | Present |
| Lava API key | Absent | Absent |
| Lava offer ID | Absent | Absent |
| Separate webhook secret | Absent | Absent |
| Merchant approval / new sales flags | Off | Off |

Only presence/boolean results were emitted; no credentials or customer records
were copied. Existing Gmail sign-in acceptance is recorded in ACCOUNT_OPERATIONS.md.
The staging callback probe returned HTTP 401 with a Basic authentication challenge.
A Lava callback using its service API key cannot currently cross that boundary.
No proxy/authentication change was made.

## Corrected in this candidate

- Known pending Lava invoices are checked in the background after one minute.
  Scheduling, retry count, reservation lease and last normalized error live in
  PostgreSQL. One provider lookup runs outside the webhook worker. Delays grow
  from one minute to a day; after twelve unconfirmed checks, the purchase remains
  unconfirmed and enters support review, including a crash during the final lookup.
  Numeric Retry-After delays are respected.
- Reconciliation works while new sales are off, provided the provider credentials
  remain configured. It only queries an existing stored invoice ID. It never
  retries invoice creation or matches an invoice by email.
- Interrupted invoice creation without a known ID is marked uncertain for review
  after fifteen minutes. Another payable invoice is not created automatically.
- Receipt mismatches become visible support-review states. They do not grant PRO.
  Refund/dispute terminal states remain protected against delayed success.
- Reauthentication preserves a strict, account-owned purchase destination through
  email sign-in and Google fallback. Provider return query claims do not grant
  access or select a different invoice.
- An existing unresolved Lava checkout hides the account's new-purchase action.
  It offers status recovery and the existing link where available. Legacy
  provider switches retain their explicit confirmation path. Order references
  are available inside the authenticated account, outside public analytics.
- Each new attempt snapshots its offer ID and price. Invoice requests explicitly
  ask for ONE_TIME and English. A supplied invoice total must match the stored
  price/currency before checkout redirection.
- Trusted release-eval support now boots only the necessary repository/PubSub
  dependencies. It works with an unnamed release node and does not start the
  endpoint, payment worker, or send email.

## Required before accepting real payments

1. **Merchant setup.** In Lava, confirm the account is approved, create/verify the
   one-time IZZY offer with API-controlled pricing, and check the actual checkout
   shows USD 29 and the features being released. Verify the intended countries
   and payment methods in that merchant account. Merchant access was unavailable
   here; no dashboard readiness is inferred from code tests.
2. **Secrets.** Install the outbound API key, offer ID and a distinct inbound
   webhook secret in the protected environment for the chosen acceptance host.
   Keep sales disabled until that host and callback are ready. Keep credentials
   installed when temporarily disabling new sales, so late notifications and
   invoice recovery continue to work.
3. **Callback reachability.** Configure payment.success, payment.failed,
   refund.success and chargeback.initiated for `/api/payments/lava`. Staging needs
   an explicitly reviewed provider-accessible callback arrangement; preserve
   protection of its remaining routes. Test real provider delivery, not merely
   an authenticated operator curl. The current all-route Basic policy is an
   unresolved acceptance blocker, not something the app silently bypasses.
4. **Release candidate.** Pass `test`, `accounts`, `container`; retain the exact
   tested image. Back up the target database, apply additive migration
   `20261015000000_schedule_payment_checks` once with the migrator role, then start
   the matching candidate on the acceptance environment. Existing grants and
   purchase prices are preserved. The new migration has run only on disposable
   local databases so far.
5. **Authorized real acceptance.** Use a normal signed-in buyer: USD 29 one-time
   checkout, return, delivered callback, exactly one grant, refresh/re-login,
   library and remote finish access. Check cancellation/failure, duplicate
   callback delivery, and recovery with notifications delayed and sales off.
   Complete a separately authorized full refund and verify only its grant is
   revoked. Verify receipt delivery and merchant settlement separately. No real
   purchase/refund/payout pass is claimed.
6. **Support ownership.** Review the restricted queue routinely. Refund/dispute
   envelopes without an invoice identity require a verified provider reference
   and audited matching. Dispute outcomes also require operator confirmation.
   No email-only matching or guessed automatic revocation is introduced.

## Operator commands after deploying this candidate

Read-only summary, run inside the account-enabled release environment:

```sh
bin/teleprompter eval 'IO.inspect(Teleprompter.Release.payment_readiness())'
```

This prints configuration readiness and aggregate queue counts, no credentials,
checkout links, customer identities or provider payloads. `schema_ready` must be
true. This helper is new in the candidate; the currently approved server image
does not contain it yet.

Trusted support actions can use the same bootstrap wrapper:

```elixir
Teleprompter.Release.commerce(fn ->
  Teleprompter.Commerce.reconcile(attempt_id, "operator:YOUR_ID")
end)
```

For a verified refund, dispute outcome or ambiguous creation, wrap the existing
audited operator functions documented in ACCOUNTS_COMMERCE.md the same way.
These functions record an established outcome; they do not send money. A separate
eval process does not broadcast into the live node: its local UI notification is
best effort, and the live account refresh/poll reads the durable database result.
There is no new public operator endpoint and no need to enable distributed Erlang.

## Verification

- 88 JavaScript unit checks; production and bundled builds passed.
- 165 PostgreSQL-backed Phoenix tests passed, including missing callbacks, bounded
  retries, rate limits, expired leases, uncertain creation, mismatch review,
  duplicate grants and a slow lookup concurrent with webhook processing.
- 54 payment/product browser checks passed in Chromium, Firefox and WebKit,
  including expired-login return and a guarded unresolved checkout.
- Local backup/restore drill passed with pending-invoice schedule/lease/offer
  fields and existing paid grants; it started no application/provider workers.
- Two bundled-release/LAN smoke checks passed. The support bootstrap also passed
  in a fresh isolated process and the built production release binary, with sales
  off and no endpoint or payment worker started.
- Prior Linux CI exposed platform-font overflow in speed labels; intrinsic value
  columns and a fallback-font matrix correct it locally. Fresh CI is required for
  the final combined candidate; no Linux pass is inferred from macOS checks.

An additional IZZY order-confirmation email is not implemented. Provider receipt
acceptance is still required; a separate IZZY confirmation can be added later
with durable delivery/deduplication, independently of PRO activation.

Contract references checked on 15 October: [Lava developer guide](https://developers.lava.top/en)
and [official OpenAPI](https://gate.lava.top/docs/documentation.yaml). No live
provider credentials or charge endpoints were used for these contract checks.
