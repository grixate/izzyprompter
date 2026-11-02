# Campaign measurement

IZZY's first-party collector answers which posts bring visits that create a take,
connect a remote, or start playback. It has no external analytics vendor.
The old `Teleprompter.Metrics` feature-use totals remain independent.

## Owner report and post links

Sign in using an email listed in the server's `ANALYTICS_ADMIN_EMAILS`, then open
`/analytics` or **Campaigns** in account navigation. Other accounts and anonymous
requests cannot read the report API. Report responses are `no-store`; the public
HTML shell contains no report data. Opening the authenticated owner report
excludes that browser from future collection.

The report compares UTC windows of today, 7, 30 or 90 days and includes a post-link
builder. Use a different `utm_content` for every post, keeping `utm_campaign`
the same for the overall campaign. For example:

```text
https://izzyprompter.com/?utm_source=telegram&utm_medium=social&utm_campaign=launch&utm_content=demo_01
```

The four supported UTM values use lowercase ASCII letters, digits, underscores
and hyphens, maximum 48 characters, beginning with a letter or digit. Invalid
values are discarded. Never put names, emails, customer IDs or secrets in tags.
Known external referring sites map to fixed source labels; unknown sites map to
`other-referral`. No available source becomes `direct` (direct **or unknown**).
Do not infer that direct traffic proves someone typed the address.

UTM tags measure attributed response, not incremental causal lift. Compare with
post-platform impressions and outbound clicks; those are not collected by IZZY.
Earlier unmeasured visits cannot be reconstructed.

## Definitions and limits

- **Page views:** successful collector calls on `/`, `/pro`, `/skins`, `/account`.
  Display, remote, saved-script, login, legal, owner and offline pages do not
  create page-view events. Reloads count as views. They are measured browser
  page loads, not HTTP requests or asset requests.
- **Visits:** a new server-issued, signed token, valid for at most 30 minutes
  from creation and held in tab-scoped session storage. Internal navigation
  preserves the original campaign and entry. A different tagged campaign/post
  starts a new visit. New tabs, cleared storage, restarts, expiry and UTC midnight
  can start another visit. This is a fixed window, not a rolling inactivity timer.
- **Visitor days:** the sum of daily visitor estimates, **not period-unique
  people**. An in-memory, daily salted HMAC of the trusted client address plus
  bounded user-agent estimates unique daily browsers. Raw addresses and agents
  are not retained by this feature. The salt, hashes and visits are discarded
  at UTC midnight or process restart. Site estimates deduplicate campaigns;
  campaign-level estimates may overlap. Shared networks/browsers can merge
  people; network or browser changes can split them. Restarts can overcount.
- **Activation goals:** each allowed action counts once per visit. Start is a
  browser-reported click; take creation, first authenticated remote connection,
  and first playback come from application code after success. Guest and saved
  account takes are covered. Repeat Play, reconnect and repeat take creation do
  not create another conversion of the same type in that visit. Goals can occur
  in any order, and are not a strictly sequential funnel. A take attributed
  during the 30-minute window may contribute actions until UTC midnight.
- **Signed in:** successful email sign-in in the tracked tab, including returning
  customers; **not new registrations**. A link opened in a different tab/browser
  may lack attribution. Google callbacks are not included in this goal.
- **Checkout opened:** a successful checkout response, once per visit. Resuming
  an older checkout does not rewrite that checkout's original campaign.
- **Payments:** campaign labels and visit date are attached when a new checkout
  record is created; the ephemeral visit identifier is removed. Provider state
  determines paid/refunded/disputed totals even if the buyer never returns to
  IZZY. Reports filter by acquisition date, not charge date. Pending, unverified,
  test and unattributed purchases are absent. These are gross current states,
  not net revenue; currencies are kept separate and refunds change the report.

Counts flush to PostgreSQL about once a minute. Unflushed counts and deduplication
state can be lost on a crash. Storage-denied browsers use memory if possible;
otherwise collection is skipped. Failed, excluded or blocked collection must
never block creating or controlling a take. Token lookup has a 250 ms ceiling;
live action recording is an asynchronous cast.

## Data and exclusions

Only UTC day, bounded campaign/source/entry labels, allowlisted event and count
are stored in `campaign_metrics`. It contains no visitor/account/session IDs,
scripts, full URLs, referrer URLs, pairing or sign-in credentials. Token and
campaign context stay in memory; campaign labels also accompany checkout records
under existing commerce retention. The tab token does not authorize user data,
pairing or account actions.

Aggregate buckets older than 365 days become eligible for cleanup on the next
nonempty successful flush. Cleanup stops when collection is disabled. Existing
encrypted backup retention applies; deleting live buckets does not erase backups.

Do Not Track, Global Privacy Control, `navigator.webdriver`, common bot/preview
agents and browser opt-out are excluded. For manual QA or your own visits, open
`/?analytics=off` **before** browsing. It sets `izzy:analytics:exclude=1` locally;
remove that key to opt back in. Automated tests explicitly opt in only for
synthetic measurement checks. Filters are best effort, not perfect bot detection.
Opening the owner report excludes that browser automatically after verification.

Collector requests must have the configured same-origin `Origin`; their bodies
are limited to 2 KB. A separate pre-parser admission gate caps 120 requests per
peer/minute and 1,200 per node/minute. This never spends the take-creation budget.
The worker caps daily visits at 20,000 and campaign groups at 256 plus an overflow
`other` bucket. Further visits are skipped after the capacity ceiling. The public
event endpoint only admits `start_clicked`; it cannot claim playback or payment.

## Configuration and rollout

Read RELEASE_WORKFLOW.md and ACCOUNT_OPERATIONS.md first. Keep production on its
approved release. Use a recorded commit, passing `test`, `accounts`, `container`
jobs, the retained tested image, a verified backup, then additive migration
`20261102000001` using the migrator role. The application role needs the existing
default DML grants on the new table. Never run tests or fixtures on production.

Protected server environment settings, separate for staging/production:

```text
CAMPAIGN_ANALYTICS_ENABLED=true
ANALYTICS_ADMIN_EMAILS=owner-address-configured-privately
```

Accounts/PostgreSQL are required. No browser build secret, access-log change,
external account, account-role migration or proxy reload is required. Defaults
keep collection disabled and report access denied to every account.

The Privacy change in this branch describes the new processing. Review that
wording before publication. Implementing the feature or staging it does not
authorize production publication. `policiesApproved` for the existing legal
documents does not record approval of the new acquisition processing.

For staging, configure a synthetic owner email, use synthetic scripts and tagged
post links, check reload deduplication and all application-confirmed goals, verify
ordinary/anonymous refusal and privacy exclusions, then check the private report
after a flush. The hosted verification script reads staging credentials from the
existing protected Mac file and must never print them or capture login/capability
links. Do not create real provider invoices for analytics acceptance.

After owner approval, promote the exact staging-tested image between takes;
the app restart ends sessions. Retain the previous image/configuration. Roll back
the image/configuration without dropping the new table or checkout column.
Old code ignores the additive schema. Turning collection off keeps saved reports
readable for configured owners; it does not delete historical data.

Trusted operator report, including when browser access is unavailable:

```elixir
Teleprompter.CampaignAnalytics.report(30)
```

This is read-only and excludes personal data. Do not replace the existing public
metrics with synthetic campaign totals or claim historical unique visitors.

Hosted automation: `ops/releases/analytics-fixture.exs` seeds a staging-only synthetic owner (email `campaign-analytics-review@example.invalid`, configured on staging only). Its credential remains in `/app/tmp/izzy-analytics-fixture.json`; copy privately to a mode-0600 Mac file and pass that path as `IZZY_ANALYTICS_FIXTURE` to `node scripts/verify-analytics-hosted.mjs`. The script opts its synthetic browser into measurement, uses a unique tagged campaign, verifies actual paired playback and a successful email-token consume, waits for the normal flush and checks the protected report. It sends no email and never requests an invoice. Run the fixture with `IZZY_ANALYTICS_FIXTURE_CLEANUP=1` afterward; it refuses any account with commerce history. Never print the credential or a pairing URL.
