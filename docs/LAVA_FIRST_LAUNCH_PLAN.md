# IZZY V1 — lava-first launch plan

**Superseded delivery priority (2026-10-11):** launch free and online-only; follow [FREE_LAUNCH.md](FREE_LAUNCH.md). Payment activation is deferred. Prodamus is the probable future provider, not an instruction to activate it or remove lava. The earlier proposal below is historical.

Date: 2026-10-10. Status: **proposal for approval, not implemented or activated**.

Inputs: the owner's lava-first decision, `izzy_lava_payment_integration_for_codex.md`, current repository code, and lava's public API/terms checked on this date. The attachment is a proposal, not an instruction to rebuild working modules or activate checkout.

## 1. Recommendation and scope

Launch with lava as the only customer-facing payment provider. Keep the existing Prodamus adapter and historical processing intact but disabled/hidden for new checkout; do not delete tested code or force another provider into V1. This interprets “lava first” and the brief's single-provider MVP together.

Keep the existing product:

- Guest paste → pair → prompt without login.
- Free verified account: three saved scripts.
- Lifetime Pro: unlimited script count and named/default presets, with existing document/resource limits.
- US$29 default. Preserve the existing ₽2,490 price only where merchant-approved RUB checkout is enabled. No geographic routing or automatic exchange rates.
- EUR is deferred until the owner explicitly chooses a fixed price and approves it. API currency support alone is not a pricing decision.
- English-first purchase flow and emails. Make locale data explicit, but do not expand this payment milestone into full Russian product localization.
- Phoenix remains the realtime transport. No WebRTC, subscriptions, catalogue, coupons, billing dashboard or new payment/entitlement service.

## 2. Use the architecture already built

| Proposal concept | Existing implementation | Decision |
| --- | --- | --- |
| Public payments API | `Teleprompter.Commerce` | Keep the name and boundary |
| Provider behaviour / lava adapter | `Commerce.Provider`, `Commerce.Lava` | Refine the existing adapter |
| Payment and licence records | `purchase_intents`, `checkout_attempts`, `entitlement_grants` | Keep intent/attempt/grant separation and IDs |
| Durable webhook processing | `payment_events`, `Commerce.Worker` | Extend, don't replace |
| Internal support | `commerce_audits`, operator functions | Keep audited release/IEx tooling |
| Account notifications / email | authenticated account channel, Swoosh | Reuse for activation and confirmation |

The shared intent represents one lifetime product for an account; each checkout attempt stores its own immutable price/currency and provider invoice ID. Multiple paid attempts grant one effective Pro status, while each grant can be refunded/suspended independently. This is more appropriate than collapsing records into the brief's single generic payments table.

Keep the internal product code `lifetime_pro`; use “IZZY Pro — lifetime access” as its public name. No schema/module rename is needed solely to match the brief's example spelling. IZZY's database remains the access authority; provider availability is never checked to decide existing Pro access.

## 3. Corrections to the brief

1. Before verification, say **“Checking your payment…”**, not “Payment received.” Redirect parameters are navigation hints only. The paid attempt and its grant must both be confirmed server-side before claiming activation.
2. Full refunds revoke only the associated grant. Partial refunds retain Pro; disputes suspend the affected grant pending review. Another valid purchase keeps Pro active. Never delete scripts/presets.
3. A checkout timeout is **ambiguous**, not automatically failed/retryable. Do not issue another invoice until its outcome is resolved or the buyer explicitly acknowledges duplicate-payment risk. A known invoice can be looked up; a timeout before its ID was returned may require operator investigation.
4. Keep authenticated accounts mandatory. The suggested email-only purchase alternative is unnecessary here, and matching payments by email alone is unsafe.
5. Persist normalized, bounded payment facts and processing history, not raw buyer/card payloads. Trace private transaction IDs in restricted support records, not unrestricted analytics/logs.
6. Legal/receipt readiness is a paid-launch gate even if no tax engine is built. Calling an email “Order confirmation” does not replace legally required documentation.

Lava documents a separate webhook `X-Api-Key` secret and distinct refund/dispute envelopes. Its refund examples do not provide an invoice ID: unmatched events must go to operator review, not an email-based guess. Existing code already takes this conservative approach. [Official developer documentation](https://developers.lava.top/en).

## 4. Implementation sequence

### A. Launch configuration and contract checks

- Make the checkout provider list server-configured. Enable/expose only lava for V1, default USD, and derive currency choices/labels from the server rather than hard-coded provider/ruble defaults in `ProPanel`.
- Keep provider callbacks and historical records usable when new checkout is disabled. A kill switch must not discard late payment/refund notifications or revoke existing Pro.
- Use an approved one-time offer. The existing adapter uses custom-amount invoice creation; verify the offer setup with the actual merchant. Pin sanitized contract fixtures and check creation, lookup, event identity, amount/currency and product association before activation. Associate through the stored invoice created for that offer; compare product IDs when supplied, without inventing mandatory fields absent from a documented response.
- Persist the offer/product association and necessary purchase-label/locale snapshots with each new attempt so later configuration changes cannot reinterpret an old purchase. Add explicit outcome timestamps for support/confirmation; use additive migrations, preserving all existing grants/data.
- Use documented `buyerLanguage: EN` where applicable. The API supports this field, but documents no generic checkout metadata or invoice-creation idempotency key in the inspected request schema. Do not invent either, or repurpose marketing UTM fields as a licence identifier. [Official OpenAPI specification](https://gate.lava.top/docs/documentation.yaml).

Acceptance: with only lava enabled, no Prodamus selection/recommendation remains; the UI selects an actually available currency; price/product are always controlled on the server; existing users/grants are unchanged.

### B. Account-owned payment return and status

- Add `/account/purchases/:id` as the return page and an authenticated `GET /api/account/purchases/:id` status endpoint. Update explicit Phoenix SPA routes and React routing; do not add a catch-all.
- Look up the internal attempt under the authenticated account. Foreign/unknown IDs reveal no purchase details. Login returns to a validated same-origin purchase route, never an arbitrary external redirect target.
- Show distinct checking, confirmed/active, failed, cancelled-return-but-unconfirmed, delayed/support-review, refunded and disputed states. Do not infer a terminal payment outcome from a redirect or a client timer.
- Use the existing account channel for fast changes and bounded, visible-tab polling as fallback. Refresh account entitlement state too, not just the purchase list. Stop on terminal state/page exit and back off after a short wait; offer “Check again” and a support reference rather than an endless spinner or another Buy button.
- Lava requires HTTPS return URLs; local verification uses mocked provider responses, not live checkout from the HTTP preview. [Return URL documentation](https://developers.lava.top/en).

Acceptance: redirect before/after notification, refresh, reconnect, missing account channel and forged redirect status all produce correct server-confirmed UI; returning users cannot accidentally pay again just because activation is delayed.

### C. Durable reconciliation and operational recovery

- Extend the current commerce worker with a bounded durable reconciliation schedule for known pending lava invoice IDs: attempt count, next check time, last result and review state. Use capped backoff, jitter and provider 429 guidance; do not call lava on every browser poll.
- Run slow lookup tasks with bounded concurrency outside playback and account request paths. One failed lookup/event must not starve unrelated events. Reuse the same event-validation/grant transaction as authenticated notifications.
- Reconcile paid results through existing idempotent processing; never reactivate a refunded/disputed grant on a late success. Provider downtime does not remove Pro or stop prompting.
- Unknown-ID invoice-creation timeouts and unmatched refunds/disputes enter a visible restricted review queue. Keep audited manual match/confirm/refund-result workflows, without a public admin endpoint or automatic refund API assumption.

Acceptance: an omitted notification with a known invoice eventually resolves through authenticated lookup; restarts preserve retries; ambiguous unknown-ID attempts never auto-create another invoice; operator recovery remains auditable.

### D. IZZY order confirmation

- Reuse Swoosh. Insert a small durable confirmation job in the same database transaction as first verified activation; deduplicate by attempt/message type. Existing grants must not cause retroactive demo/customer mail when deploying the migration.
- A second actual purchase enters duplicate-payment/refund review; do not describe it as a second licence or a new Pro activation. Its support communication is separate from the original activation confirmation.
- Store the immutable purchased item/amount/currency/date/internal order reference needed for the message. Send to the account identity, not an untrusted redirect/email override. Include support contact and a normal sign-in/account link, not payment credentials or reusable login tokens.
- Retry mail independently with capped backoff. Email failure cannot roll back Pro. SMTP cannot guarantee exactly-once delivery after an ambiguous acknowledgement: deduplicate scheduling and make occasional delivery retry harmless.
- English first. Label it **Order confirmation**; keep fiscal/tax documentation outside this email until the approved business process is known.

Acceptance: duplicate/delayed success events create one confirmation job; SMTP outage/restart preserves it; Pro is usable while mail is pending; test fixtures cannot send real mail.

### E. Verification and launch gate

Extend the existing suites for lava-only USD/RUB configuration, non-owner status access, forged returns, missing notifications, stale/terminal-state races, exact amount/currency/product checks, provider timeouts/429s/redirects, worker restarts/starvation, duplicate payments, full/partial refunds, disputes and confirmation failure/retries. Run the full client/Phoenix/PostgreSQL/browser/release/restore matrix again. Test the migrated account-enabled container on a Docker-capable runner.

Then, separately, verify the actual HTTPS host, SMTP, merchant notifications, buyer-facing checkout language/currency/conversion, international target-market payment methods and authorized purchase/refund/payout checks. No universal international-card acceptance or identical sandbox availability is assumed.

## 5. Owner inputs and external gates

- Merchant approval for **lifetime access to externally hosted software**, one-time offer/product identifiers, supported currencies/payment methods, and the chosen API pricing mode. Provide secrets through the host secret manager, never chat or frontend code.
- Public domain/HTTPS hosting and verified transactional email, plus customer support contact.
- Approved seller identity/jurisdiction, terms, privacy, refund policy, definition of “lifetime,” and receipt/tax handling. Confirm whether advertised amounts are final totals or require applicable-tax disclosure before checkout; do not alter old purchase amounts.
- Lava's terms describe an agency/direct author-customer relationship and place invoicing/tax responsibilities on users. Do not assume global Merchant-of-Record tax coverage; get merchant-specific confirmation and appropriate professional advice. This plan is not a tax determination. [Current terms, sections 3, 6 and 7](https://lava.top/docs/terms).
- Explicit authorization and agreed amounts/accounts for real purchase/refund/payout checks.

**Recommended delivery order:** A → B → C → D → E. A–D and mock verification can be completed locally. Real notifications/delivery/payment acceptance and production release approval need the external setup. No application configuration or live checkout was changed while preparing this plan.
