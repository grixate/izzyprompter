# Legal pages and moderation review

Implementation prepared 17 October 2026. **Draft for review; not approved for
public publication.** No merchant setup, real charge or hosted change is part
of this implementation. Follow [the implementation plan](LEGAL_LAVA_READINESS_PLAN.md).

## Public details

The owner supplied Greg Mikkelsen, Germany, and `grix08@gmail.com` for public
support/privacy contact. These are centralized in `src/legal/siteDetails.json`.
No support mailbox or DNS change was created; no test message was sent.

The owner also supplied the public service address: Gagarinstrasse 57,
19063 Schwerin, Germany. For a Germany-based
commercial service, [section 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html)
generally requires provider name, address and electronic contact. A name and
country alone do not complete that disclosure. Confirm any additional seller
details and applicable consumer/privacy obligations before publication.

`policiesApproved` remains false. The legal pages show a draft notice until the
public details are complete and the final wording is approved. The text is an
implementation draft, not a finding of legal compliance. In particular, confirm
the applicable withdrawal/refund obligations, privacy legal bases and rights,
processing locations/transfers, retention and operator disclosure for the actual
seller before approval. Do not publish fictional details or invent dates,
mailboxes, tax registration numbers, certifications or response-time promises.

## Implementation

- `/terms`, `/privacy`, `/refunds`, `/contact` have explicit Phoenix HTML routes
  and React documents; trailing slashes open the same document. They bypass
  account/product providers and do not need login or a database.
- Existing public footers now include a shared legal navigation. The sign-in,
  library and purchase-return screens expose the same links; fullscreen takes
  and saved-script editing keep their existing layout. Draft workspaces flush
  pending writes when following footer links.
- Existing public/finish-dialog and account checkout actions include Terms and
  Refund Policy links. They open separately to preserve the current workflow.
  `/pro` explains the scope of lifetime access. Server-owned pricing remains
  $29 in launch mode and $49 otherwise. Payments retain their existing gates.
- The offline workspace indicates that policy pages require a connection when
  disconnected. Legal documents are not added to the offline navigation cache.
- Draft wording describes actual guest/server/browser/account data, paid
  features, conditional Lava processing, refunds and multiple-grant behavior.
  Final wording approval remains the content gate.

## Publication gate

After approving the policies and recording that approval in the public details, run:

```sh
npm run check:legal
```

It fails when identity/contact/address/approval is incomplete. This is an
explicit release check, not a new app startup requirement or a deployment hook.
Builds and CI can validate the draft while the public release remains unchanged.
Changing JSON alone does not deploy or update a running app; public details
are bundled into the reviewed build.

Follow [RELEASE_WORKFLOW.md](RELEASE_WORKFLOW.md): all required GitHub jobs,
retained tested image, private staging review, then explicit production
publication approval and verification between takes. A merge does not deploy.
The image may include earlier additive migrations; inspect target schema and
follow [ACCOUNT_OPERATIONS.md](ACCOUNT_OPERATIONS.md) before starting it.

Merchant credentials, staging webhook reachability and authorized purchase,
refund and receipt verification remain separate. Follow
[PAYMENT_READINESS_2026-10-15.md](PAYMENT_READINESS_2026-10-15.md). This legal
implementation does not enable sales or modify staging's authentication.
