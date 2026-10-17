# Legal pages and Lava moderation readiness

Prepared 17 October 2026 against refreshed `origin/main`, commit
`c88d58791991fe3c24b0ae3dc4562577e0894530`. This is an implementation plan,
not authorization to publish, enable sales, contact Lava, or charge a buyer.

## Recommendation

Deliver one focused legal/moderation release using the existing public pages,
footer, product facts and account checkout. Then complete merchant setup and
payment acceptance as a separate milestone. The supplied 21-phase proposal has
the right legal objectives but repeats substantial completed commerce work.

No new billing service, purchase schema, checkout endpoint, return pages,
authentication system, subscription UI, or marketing redesign is needed.

## Verified baseline

Read-only public HTTP checks on 17 October found:

| Surface | Observed result |
| --- | --- |
| `/pro`, `/skins`, `/local` | HTTP 200, HTML |
| `/terms`, `/privacy`, `/refunds`, `/contact` | HTTP 404 |
| `/api/account/` | Accounts enabled; Google disabled; anonymous request |
| `/api/product` | `lifetime_pro`; USD 2900 minor units; reference price 4900; launch offer on; checkout unavailable |

These observations establish public behavior, not the deployed commit/image,
current secret values, merchant approval, or a successful live transaction.

Current source provides:

- `src/components/PublicNav.tsx`: existing `PublicNav` and `PublicFooter`.
  Main, Pro, skins and the offline preparation workspace already use the footer.
- `src/pages/ProPage.tsx`, `src/product/ProAction.tsx`, and the account `ProPanel`:
  existing product presentation and purchase actions. There is one email-link
  flow for registration/sign-in, not separate login and registration products.
- `api/lib/teleprompter/product.ex`: one server-owned product and price. Launch
  mode is US$29; regular mode is US$49. `Offer` and `Discount` consume the public
  API. Preserve this behavior and immutable historic purchase prices.
- Sixteen remote finishes: Original is free and fifteen require Pro. The current
  candidate implements their application and server entitlement checks; they are
  no longer all lab-only designs. Pro also includes unlimited saved-script count
  and named display presets. Per-script/resource limits remain.
- Free prepared standalone offline prompting. Direct offline phone pairing is
  experimental; offline functionality must not be sold as a Pro-only benefit.
- Existing checkout at `POST /api/account/checkout`; callbacks at
  `POST /api/payments/lava`; owned invoice checks at
  `POST /api/account/purchases/:id/check`; return at
  `/account?purchase=INTERNAL_ATTEMPT_ID`.
- Purchase intents, checkout attempts, event inbox, grants and audit records;
  authenticated idempotent callbacks; bounded background reconciliation;
  uncertain-invoice review; preserved purchase destination through sign-in.
  `user.pro` is derived from valid grants, not a new writable account flag.
- Existing policies for full/partial refunds, disputes and multiple grants.
  Some refund/dispute notifications lack an invoice ID and require audited
  operator matching. Automatic revocation must not guess from buyer email.
- Accounts/PostgreSQL and Postbox sign-in already exist. The documented
  `account@izzyprompter.com` identity sends mail; it is not a receiving inbox.

Older sections of `LAVA_TOP.md`, `ACCOUNTS_COMMERCE.md`, `README.md` and historical
launch plans describe obsolete feature/hosting boundaries. Use current code,
observed behavior, and dated operations evidence together; correct conflicting
current setup guidance during this work instead of reviving historical plans.

## Changes to the supplied proposal

| Proposal | Adjustment for IZZY |
| --- | --- |
| Add a global footer | Extend the existing public footer; reuse a small legal-link group in account screens. |
| Add legal frontend routes | Add exact React path handling AND explicit Phoenix HTML routes. Vite navigation alone does not establish production routes. |
| Hard-code $29 everywhere | Keep the server-owned launch/regular price model. Describe the purchase price as the amount shown before payment. |
| Build phases 8–18 from scratch | Retain existing commerce modules and tests; fix only demonstrated gaps. |
| Create new checkout/webhook/return URLs | Keep existing URLs and account-owned recovery behavior. |
| Create provider invoice, then internal purchase | Persist the attempt before the external request, as the current implementation does. |
| Show “Payment received” on the success route | Claim payment/activation only after backend verification. A browser return is unverified. |
| Retry every invoice failure | Preserve ambiguous outcomes and block another automatic invoice. |
| Remove Pro on any refund | Revoke only the refunded grant on full refund; partial refunds retain access; another active grant keeps Pro. |
| Add user/invoice IDs to general logs | Use restricted purchase/audit records; retain aggregate public diagnostics and filtered payloads. |
| Assume a support email exists | Verify an actual receiving address before publication. No invented mailbox. |
| Publish phases 1–6 immediately | Complete review and staging first; production publication needs explicit authorization. |

## Milestone 1 — Public legal and moderation release

### 1. Establish the content facts

Before public publication, obtain and record owner-approved:

1. Seller/operator identity, country and any public business/contact details
   required for this seller profile. Never invent a company or postal address.
2. A real monitored receiving support address. Verify inbound delivery and a
   reply. Postbox outbound acceptance is insufficient. A dedicated domain inbox
   or an existing approved address can satisfy this; mailbox provisioning is a
   separate service choice, not an automatic DNS change.
3. Lifetime scope, included updates, refund policy and applicable seller terms.
   Proposed lifetime definition: access to the purchased Pro features for as
   long as IZZY operates the service, without recurring fees. Final wording needs
   owner approval; avoid arbitrary removal of purchased rights or an absolute
   guarantee of perpetual hosting.
4. Retention/contact procedures that can actually be fulfilled, including account
   deletion requests, backups and payment-record obligations. Do not advertise
   a self-service delete/export control or response deadline that does not exist.

Implementation and draft copy can proceed while these facts are unresolved.
Mark drafts in the working material; do not ship placeholders or a dead contact
address publicly. No secrets or personal details beyond the approved public
seller information belong in the plan or repository.

Use a single non-secret site-details module for approved public identity,
support address and policy dates, for example `src/legal/siteDetails.ts`.
An invented `PUBLIC_SUPPORT_EMAIL` variable has no effect in Vite/Phoenix.
For this static content, a centralized build-time value is enough; runtime
configuration would need explicit backend/public-response wiring if selected.

### 2. Build four independent legal documents

Add `src/pages/LegalPage.tsx` and a small typed content module under `src/legal/`
for `/terms`, `/privacy`, `/refunds`, `/contact`. Reuse BrandLogo, existing colors,
fonts and the public footer. Use a readable approximately 720px article, semantic
headings, page title, effective/updated date and home/Pro navigation.

Handle these exact paths in `src/App.tsx` before account/product providers.
Legal reading must not require login, database availability, a product fetch,
or creation of an account-session cookie. A lightweight legal header can reuse
the existing brand and navigation styling without mounting provider-dependent
marketing widgets. Add the four explicit GET routes to the existing Phoenix
browser scope; preserve missing API/asset 404 behavior. Avoid a catch-all router
or a new routing dependency. Set a consistent trailing-slash behavior.

The global body currently has `overflow: hidden`; give the legal page its own
viewport scroll container, following `.product-page`, without changing display,
remote or local-take scroll behavior. Retain visible focus, readable contrast,
wrapping links and touch targets. Do not reuse the legacy 7px footer text.

Content requirements:

- **Terms:** identify the operator and browser-based service; explain guest use,
  passwordless accounts, free/Pro features, lifetime scope, purchased updates,
  acceptable use, service availability, refunds and support. Describe offline
  preparation and experimental pairing accurately. Keep future unrelated
  products outside the purchased promise. Link to current `/pro` for the offer
  rather than embedding a permanent $29 contractual price.
- **Privacy:** describe the data map below and actual service providers. Treat
  Lava data transfer as conditional on starting checkout while sales are closed.
  Explain purposes, recipients, retention and available requests without
  unsupported compliance, residency or encryption claims.
- **Refunds:** explain non-delivery, duplicate charges, serious technical issues,
  mandatory rights and provider procedures; identify the receiving support
  address. Ask for purchase email, approximate date, order reference if available
  and issue description, never card details or sign-in links. Full refunds remove
  that purchase's grant; partial refunds and independent valid grants follow the
  existing behavior. Do not promise immediate bank settlement, automatic matching,
  or a blanket no-refund rule. Resolve any policy time limit against applicable
  obligations and Lava's procedures before publication.
- **Contact:** public operator/support identity, actual receiving email, website,
  and concise account/payment/technical help instructions. No contact-form
  backend is necessary. Only promise response hours/timeframes the owner accepts.

Privacy evidence to incorporate:

| Area | Current behavior / publication constraint |
| --- | --- |
| Guest editing | Drafts, settings, positions and quick-edit recovery use browser storage. Starting hosted prompting transmits text to Phoenix and paired devices; guest text is not exclusively local. |
| Hosted sessions | Live state is held in server memory; the current session idle timeout is six hours. Do not describe this as a fixed six-hour deletion guarantee while activity continues. |
| Account library | Email/account identities, scripts, presets and mutation records are stored in PostgreSQL. Account-linked live edits can save back to the library. |
| Browser/offline data | localStorage, sessionStorage and IndexedDB hold drafts, pending account edits, prepared scripts, appearance/mode preferences and purchase-return hints. Service-worker caches hold the prepared app; they do not cache account/API responses. Clearing browser data can remove local content. |
| Authentication | Single-use 15-minute email links; hashed login/session tokens; HttpOnly, Secure-on-HTTPS, SameSite=Lax cookie and 30-day session. Google exists in source but is currently disabled publicly. |
| Payments | Checkout sends account email, offer, amount/currency and return destinations to Lava. IZZY keeps normalized purchase, provider reference, entitlement, reconciliation and audit facts; hosted checkout owns card entry. Do not claim IZZY handles full card details. |
| Operations | IP/connection information is processed for networking and rate limits. Application diagnostics are aggregate; Phoenix parameters and database query logging are restricted. Verify deployed proxy/host logging and actual retention before making policy claims. |
| Analytics | `src/product/events.ts` dispatches bounded browser CustomEvents; no external collector is implemented there. Check production integrations before stating there is no third-party analytics. |
| Retention | Cleanup selects trashed scripts/mutation records after 30 days and expired tokens in bounded batches. Active scripts and commerce records are not deleted by that cleanup. Backups have separate server/Mac retention; deletion is not an immediate wipe of every backup. No account-deletion endpoint currently exists. |
| Infrastructure | Documented hosting is netcup, email is Yandex Cloud Postbox, and payment provider is Lava. Confirm processing locations/contract details before adding jurisdiction-specific transfer claims. |

Evidence: `src/domain/storage.ts`, `src/local/store.ts`,
`src/account/pendingEdits.ts`, `src/realtime/credentials.ts`,
`api/lib/teleprompter/accounts*`, `library*`, `saved_sessions.ex`,
`sessions/session.ex`, `maintenance.ex`, `commerce*`, `diagnostics.ex`,
`scripts/offlinePlugin.ts`, `docs/ACCOUNT_OPERATIONS.md`, `docs/POSTBOX_EMAIL.md`.

### 3. Add legal access where people already are

Extend `PublicFooter` with Terms, Privacy, Refunds and Contact. Preserve its
existing destinations and use one shared legal-link component/data list.
Cover `/`, `/pro`, `/skins`, `/local`, login and the account library/purchase
return screen. The account screen currently has no public footer: add the small
shared legal links without replacing its account navigation.

Keep legal footer space out of fullscreen display/remote/local takes and the
saved-script editor. Keep the current pairing/status footer functional.
Footer navigation from draft workspaces must flush pending draft writes before
leaving, following the existing `beforeNavigate` pattern. Avoid unnecessary
navigation in the current tab during a take.

Offline workspace links remain ordinary online legal destinations for this
milestone. Make their online requirement clear when disconnected. Do not expand
the service-worker cache or promise offline legal-page availability as part of
this change.

### 4. Attach purchase wording to both existing checkout entry points

Add concise Terms/Refunds links near active purchase actions in `ProAction` and
the account `ProPanel`; keep Privacy reachable. Cover the finish-unlock dialog,
which reuses `ProAction`, including keyboard/dialog behavior. Include a short
lifetime explanation on `/pro` with a Terms link near the offer; do not turn
the existing page into a long legal document.

Retain the server-owned Offer/Discount behavior, the $29 launch/$49 regular modes,
and “Purchases opening soon” while checkout is unavailable. Use existing product
naming consistently; avoid a global uppercase PRO rewrite or historical-doc
search-and-replace. Check “Yours for good” against the approved lifetime scope.
Sign-in should expose Privacy/Terms without inventing a separate registration
flow. An obligatory checkbox or consent-record migration is not assumed; add
only if the approved seller/provider requirements call for it.

### 5. Verify and prepare a reviewable release

Meaningful acceptance coverage for the implementation:

1. Four URLs work on direct visit/reload in the bundled Phoenix release and
   container, without login. Missing API routes/assets still return 404. Legal
   content is readable with account/product endpoints unavailable.
2. Shared links are reachable on public, sign-in and purchase-return surfaces;
   long articles scroll to their final paragraph/footer at 320/390px and desktop
   widths, with zoom, keyboard focus and wrapping checked.
3. Navigating to a legal document preserves a just-edited guest/offline draft.
   Existing display, remote, pairing, local prompting and account editing remain
   usable; footer/layout rules do not leak into those surfaces.
4. Purchase links work from `/pro`, finish-unlock dialog and account. Both price
   modes remain consistent; disabled sales remain disabled; existing forged-return,
   invoice-ambiguity, ownership and reconciliation coverage remains intact.
5. Content review finds no placeholders, fictitious inbox, wrong feature counts,
   stale provider claims, unrealistic data promises or credentials.

Extend existing product/payment browser suites and bundled/container route
checks rather than building a second harness. Run build/unit/server checks
appropriate to the touched files, existing browser/offline/release checks, and
PostgreSQL account checks. Require fresh `test`, `accounts`, `container` GitHub
jobs for the implementation PR; earlier results are not this change's pass.
Use synthetic text/accounts and keep real sign-in/capability URLs out of captures.
No app tests are necessary merely to add this planning document.

Then use `docs/RELEASE_WORKFLOW.md`: retain the tested image and deploy the
candidate to staging for content/layout review. Identify the actual target
image/schema before deployment; the latest candidate includes additive migration
`20261015000000_schedule_payment_checks`. If absent on the target, follow the
backup/migrator procedure before starting that image. A legal-only code change
does not prove the whole image has no pending migrations.

Keep sales off. After owner approval of public identity, policies and publication,
promote the exact tested image between takes, retain the preceding image and
verify the public legal URLs, offer and critical guest/account flow. Physical
device checks remain unverified until performed; carry forward any explicit
owner deferral rather than recording an automatic mobile-browser pass as one.
Public publication is required before treating the website as moderation-ready.

Prepare a matching Lava listing draft for the approved one-time Pro feature set
and launch offer. Owner registration/profile/product submission can proceed
alongside development; submit the final package when public links and contact
work. Actual submission or messaging is a separate authorized action.

## Milestone 2 — Merchant acceptance and payment activation

Reuse `docs/PAYMENT_READINESS_2026-10-15.md` and current commerce code. This is
external configuration and acceptance work, with code changes only for concrete
contract gaps discovered during verification.

1. Obtain product moderation and seller approval. Verify the offer/tier ID and
   API-controlled one-time pricing, matching the advertised price/features.
2. Clarify whether a USD invoice supports Russian cards/СБП with conversion, or
   requires RUB; confirm actual target-market methods, fees, payout eligibility,
   settlement/conversion and receipt/tax responsibilities for this seller.
   Broad platform coverage is not proof of availability on our USD offer.
   Adding RUB or removing the existing regular-price mode is a product decision,
   not an incidental legal-page change.
3. Inspect current hosted readiness without emitting secrets. The 15 October
   note records absent merchant credentials; this plan did not re-inspect runtime
   secrets and does not claim that observation is current.
4. Resolve staging callback reachability before provider acceptance. Current
   tracked proxy policy Basic-protects every staging route. Prepare an exact
   POST `/api/payments/lava` arrangement that preserves application X-Api-Key
   authentication, body limits and protection of all other routes; validate the
   proxy config and test invalid/missing keys as well as actual provider delivery.
   Keep app/DB state isolated; do not weaken staging globally. Use separate
   staging and production webhook URLs/secrets and review how Lava routes
   invoice events so acceptance cannot affect production grants.
5. Install merchant credentials only in protected host runtime configuration.
   Complete synthetic checks first. Real provider credentials on staging can
   create real charges: “staging” does not mean Lava sandbox. No sandbox is assumed.
6. After explicit authorization of the buyer, amount and refund scope, enable
   sales only on the chosen acceptance host and run the real purchase/return,
   webhook/replay, re-login, missing-notification recovery, cancellation/failure,
   full-refund and provider-receipt checks. Review settlement separately. Use
   synthetic script content, not personal scripts, in the account acceptance.
7. Establish the monitored support workflow for unknown-invoice events, ambiguous
   creation, duplicate charges and disputes. Use existing audited operator tools;
   no admin HTTP surface or payment identifiers in general analytics/logging.
8. Production activation requires explicit publication authorization, verified
   production callback/configuration, retained rollback image and live-flow
   verification. Turning sales off must keep late callbacks/reconciliation and
   existing entitlements working. An additional IZZY purchase email remains a
   separate enhancement; provider receipt acceptance is still required.

## Completion boundaries

- **Legal implementation complete:** pages, shared links, accurate content and
  purchase disclosures reviewed locally/staging; appropriate checks pass.
- **Moderation-ready website:** approved policies/operator/contact are published
  at working public URLs and match the submitted product description.
- **Ready for paid launch:** merchant approval, credentials, callback delivery,
  authorized payment/refund/receipt acceptance and support procedures verified.
- **Live sales:** explicit production authorization has been executed and the
  actual public purchase flow verified. Earlier milestones do not imply this.

## References and scope of evidence

- Owner-provided Lava support reply: externally hosted lifetime software access
  is eligible in principle; final moderation remains necessary; legal documents
  and contact details are requested. This is not a merchant approval record.
- [Lava developer guide](https://developers.lava.top/en), checked 17 October:
  API pricing, return verification, separate webhook authentication and event
  envelopes. Keep the existing authenticated account-owned activation flow.
- [Lava terms](https://lava.top/docs/terms/), checked 17 October: seller/provider
  roles, fees, refund procedures and tax responsibilities require seller-specific
  review. Do not assume platform registration removes those responsibilities.
- `docs/RELEASE_WORKFLOW.md`, `docs/ACCOUNT_OPERATIONS.md`,
  `docs/POSTBOX_EMAIL.md`, `docs/PAYMENT_READINESS_2026-10-15.md` and current source.
  Historical test/hosting notes are dated evidence, not fresh acceptance.
