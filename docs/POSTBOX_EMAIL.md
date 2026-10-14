# IZZY transactional email — Yandex Cloud Postbox

Setup completed and Gmail acceptance checked 2026-10-14. Registration and returning-user sign-in use the same
passwordless flow: `Accounts.request_login/1` sends a 15-minute, single-use link;
`consume_login/1` verifies the email identity on first sign-in. There is no
password-reset email because IZZY does not use passwords.

## Resources and exact DNS records

Created in existing cloud `cloud-grix08`, folder `default`
(`b1gj694h9ngpvq1bq69q`): Postbox identity `egtcprlb57itsvl74a36` for
`izzyprompter.com`. Easy DKIM manages key rotation. The allowed-sender list is
restricted to `account@izzyprompter.com`; sending logs are disabled.

Added at REG.ru under izzyprompter.com → DNS servers and zone management.
Preserved existing A records for `@`, `www`, and `staging`. All four mail records
resolve from authoritative DNS; Postbox reports **Success**, with both DKIM
records **OK**. Names below are relative to the domain; TTL uses the zone default.

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `egtcprlb57itsvl74a36-1._domainkey` | `egtcprlb57itsvl74a36-1.dkim.pstbx.ru.` |
| CNAME | `egtcprlb57itsvl74a36-2._domainkey` | `egtcprlb57itsvl74a36-2.dkim.pstbx.ru.` |
| TXT | `@` | `v=spf1 include:spf.postbox.yandexcloud.net ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=none` |

No SPF, DMARC or MX records existed before this setup. For future changes,
recheck the authoritative zone before editing. If SPF already exists, merge the
Postbox include before its `all` mechanism; never create a second SPF record.
Preserve an existing DMARC policy unless an intentional policy change is approved.
Start with monitoring; move to quarantine/reject only after legitimate senders
and actual authentication results are validated. No report mailbox was invented.

Postbox sends outbound mail; it does not create a receiving mailbox. No MX
change is needed for outbound sending. `account@` is the From address, not a
provisioned inbox. Reply handling needs a real mailbox/forwarder separately.

After propagation, use **Run verification** on the Postbox identity. Both DKIM
delegations must be present for automatic key rotation. Do not replace these
records with guessed selectors or keys.

## Sender credentials

Created service account `izzy-postbox-sender` (`ajep6ccsgjdvc5546q4k`) in the
**same folder** as the identity, with only `postbox.sender`. Its SMTP API key
has only `yc.postbox.send` and expires **12 January 2027 at 12:00 Moscow time**.
Rotate before expiry. The secret was saved outside Git in a private mode-0600
environment file on the setup Mac, then installed into `/etc/izzy/app.env`
(root-owned 0600). A protected original backup is retained at
`/etc/izzy/app.env.before-postbox-20261014`. The running app was not restarted;
these settings take effect on its next approved recreation.

For subsequent replacement keys, create an **API key**, with the sole scope
`yc.postbox.send` (not a static AWS access key and not the Yandex account password).
Record its expiration and rotate before expiry. Save the one-time secret directly
to the host's secret store or a mode-0600 runtime file outside the repository;
never paste it into chat, command arguments, commits, screenshots or browser code.

An SMTP API key's ID is the username and its secret is the password. A static
access key uses a different password-conversion procedure; do not substitute it.

Non-secret environment settings:

```dotenv
MAIL_FROM=account@izzyprompter.com
SMTP_HOST=postbox.cloud.yandex.net
SMTP_PORT=587
PUBLIC_ORIGIN=https://staging.izzyprompter.com
```

Supply `SMTP_USERNAME` and `SMTP_PASSWORD` separately from the protected secret
store. Phoenix does not load `.env` automatically. Never prefix secrets with
`VITE_` or bake them into Docker build arguments/images. Production's origin is
`https://izzyprompter.com`; use it only when promoting the reviewed release.

The adapter requires authenticated STARTTLS, TLS 1.2/1.3, system-trusted CA and
hostname verification. Certificate-chain depth is explicitly 99: the real
Postbox chain exceeded the Erlang default depth; peer, CA and hostname verification
remain enabled and actual STARTTLS delivery passed. This integration uses port **587**, not implicit TLS 465.
Missing/empty credentials fail startup without printing their values. Test mode
always keeps Swoosh.Test even when SMTP variables exist in the caller's shell.

## Safe integration and release

The existing account flow already calls Swoosh; no second email service or
frontend key is needed. Sender display name remains `IZZY`. Existing login
tokens remain hashed at rest, expire after 15 minutes, are single-use, and are
consumed by explicit POST rather than email-scanner GET requests.

Production and staging currently run the guest-only release. Setting SMTP
alone does not enable accounts. Follow RELEASE_WORKFLOW.md: create the account
database, migrations, backups and actual restore drill before enabling accounts;
use separate staging state/secrets and verify staging first. Do not add a
production DATABASE_URL casually or restart the live app during a take.

Store staging runtime settings in `/etc/izzy-staging/app.env` (root-owned 0600)
and production settings in `/etc/izzy/app.env` through the approved deployment
process. Retain protected backups of previous settings. Do not print these files
or full Compose configuration, which can expand secrets.

Use a separate SMTP key for staging before its account-enabled rollout. This
setup installed credentials only into the production environment; it did not
enable a database, accounts, payments, or deploy a new application image.

### Host SMTP connectivity

The owner-approved policy `izzy-smtp-submission` (netcup policy 325444) is now
applied to server 159.195.86.205, replacing the default `netcup Mail block`:

| Order | Direction | Protocol | Destination port | Action |
| --- | --- | --- | --- | --- |
| 1 | Outgoing | TCP | 25 | DROP |
| 2 | Outgoing | TCP | 465 | DROP |
| 3 | Outgoing | TCP | Any | ACCEPT |
| 4 | Outgoing | UDP | Any | ACCEPT |

Existing default IPv4/IPv6 ping policies remain. Netcup's applied custom policy
has implicit outgoing DROP and incoming ACCEPT. Explicit TCP/UDP accepts preserve
ordinary outbound traffic, including SMTP submission on 587; other IP protocols
follow the provider's implicit rules. The host UFW remains active, with inbound
22/80/443 allowed and other unsolicited inbound traffic denied. No host firewall
rule was changed.

Verified from the VPS: Postbox 587 and 443 connected; Postbox 465 and Gmail 25
timed out. An authenticated, certificate-verified STARTTLS session succeeded.
See [netcup's firewall documentation](https://www.netcup.com/en/helpcenter/documentation/server/firewall).

**Panel behavior and setup history:** deleting/restoring a default policy applies
immediately even while an unrelated custom assignment shows an unsaved banner.
An initial deletion briefly removed the mail block. It was restored immediately
when connection checks revealed the effect, and SMTP blocking was reconfirmed;
no email was sent in that interval. After explicit owner approval, the final
replacement above was applied and its allowed/blocked ports checked. Also, the
custom-policy draft preview showed implicit outgoing ACCEPT, but the applied
policy used DROP; the final explicit TCP/UDP rules account for that difference.

## Delivery acceptance

1. Verify Postbox domain status and active billing. Check the actual daily/rate
   quota in the console; the creation form currently describes 200 emails/day.
2. With protected environment variables supplied to the API process, run
   `mix izzy.email_check --to OWNER_CONTROLLED_INBOX` from `api/`. This sends no
   login token. Space probes at least 1.1 seconds apart while on the starter quota.
3. Confirm receipt in owner-controlled Gmail, Outlook/Hotmail, Yahoo, Proton and
   Yandex inboxes as available. Record SMTP acceptance, inbox/spam placement,
   timestamp and the received header results separately. SMTP acceptance does
   not prove delivery or inbox placement. Check `dkim=pass` with
   `header.d=izzyprompter.com`, `dmarc=pass`, and SPF results for the actual
   Return-Path; DKIM alignment can satisfy DMARC even if envelope SPF is not
   aligned to the From domain.
4. In the private staging UI, request sign-in with a fresh controlled address.
   Receive and explicitly confirm the link. Verify account creation, reload,
   logout, returning-user login, rejection on link reuse, and rejection after
   expiry. Check that the link points to staging. Do not screenshot or log it.
5. Confirm an unauthorized From address is refused by Postbox, and handle a
   delivery failure without exposing account existence or a provider response.
6. Request a quota increase before launch if projected traffic exceeds the
   starter quota. Keep this identity for transactional mail only.

### Results on 14 October 2026

- Harmless probe and both real passwordless emails reached the authorized Gmail
  inbox, rather than Spam. Gmail's received-message view reports SPF **PASS**,
  DKIM **PASS** for `izzyprompter.com`, and DMARC **PASS**.
- Registration and returning-user sign-in were exercised through the actual UI
  and Swoosh SMTP adapter using isolated local PostgreSQL state. The Mac's direct
  SMTP path was unavailable, so a loopback SSH forward through the VPS carried
  SMTP while retaining Postbox's TLS hostname/SNI and certificate validation.
- First sign-in created one user and one verified identity. Opening the link
  alone did not consume it; explicit confirmation did. Logout removed the
  session; a second delivered link signed into the same user. Reuse was refused.
- Real tokens had a 900-second lifetime. A separately issued, already-expired
  token in that isolated database was refused by the UI; no 15-minute wall-clock
  expiry wait is claimed.
- A send from `blocked-sender@izzyprompter.com` was rejected with SMTP 550,
  confirming the allowed-sender restriction. No email was delivered by that test.
- PostgreSQL-backed API checks: **147 tests, zero failures**, including a run
  with synthetic SMTP variables exported. Compilation with warnings as errors
  and formatting checks passed. GitHub checks are recorded in the setup report.
- Outlook/Hotmail, Yahoo, Proton and Yandex receipt/placement remain untested:
  no owner-controlled addresses for those providers were supplied.

These are local account-flow checks with real Postbox delivery, not a hosted
account-enabled staging or production release. No production database or account
was created. The temporary local services and SMTP tunnel were stopped after
testing; the isolated acceptance database is retained locally for review.

## Changes in this branch

- `.env.example`: concrete Postbox host, sender and credential guidance.
- `api/lib/teleprompter/smtp_config.ex`: validated SMTP configuration and TLS.
- `api/config/runtime.exs`: SMTP config integration, verified-domain sender
  requirement for production accounts, and protection against real mail in tests.
- `api/lib/mix/tasks/izzy.email_check.ex`: harmless delivery check with generic
  results; no credentials, recipient addresses, receipts or login tokens printed.
- `api/test/teleprompter/smtp_config_test.exs`: required credentials, transport
  security, safe error messages and guest-mode coverage.
- This runbook: exact DNS values, account setup, environment storage and acceptance.

## Source documentation

- [Postbox quickstart](https://yandex.cloud/en/docs/postbox/quickstart)
- [DNS and DKIM/SPF/DMARC](https://yandex.cloud/en/docs/postbox/concepts/dns-records)
- [SMTP authentication](https://yandex.cloud/en/docs/postbox/operations/send-email)

The setup report records the final code review, GitHub checks, and remaining
account-release and cross-provider acceptance work.
