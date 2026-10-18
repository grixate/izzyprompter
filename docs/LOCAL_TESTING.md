# Local IZZY testing

Prepared 2026-10-10. No hosting, real email, Google account or payment is needed for these checks.

## Open the app

Use **http://192.168.1.13:5174/** on this Mac, phone or tablet on the same Wi-Fi. Keep the Mac awake: it is the temporary server. This is a development preview, not the future hosted service. Do not port-forward it or use it on an untrusted network. HTTP does not encrypt scripts or login links; use synthetic text, not confidential material.

Use the same network address consistently. `localhost:5174` has separate browser cookies/drafts and cannot be used as a phone's server address. The IP may change when Wi-Fi changes.

## Free and Pro demo sign-in

Two reserved demo identities are available:

- `preview@izzy.example`: Free, three active saved scripts.
- `pro@izzy.example`: synthetic Pro, unlimited script count and named presets. No money was charged.

From the repository's `api` directory, this opens a fresh sign-in in the default browser:

```sh
DATABASE_URL=postgresql://grixate@127.0.0.1:55432/izzy_dev PUBLIC_ORIGIN=http://192.168.1.13:5174 mix izzy.preview_login --email pro@izzy.example --pro --open
```

Click **Sign in to IZZY**. Links expire in 15 minutes and work once; rerun for another link. For Free, change the email to `preview@izzy.example` and `--pro` to `--free`. These are separate libraries. To test revocation without deleting data, run the command for `pro@izzy.example` with `--free`, refresh its workspace, then restore it with `--pro`.

To sign in on a tablet, copy the freshly opened link to that device **before** confirming it on the Mac. Treat it as a password: do not post it in chat/screenshots. The helper never prints the token. A phone used only as the paired remote needs no account login.

This helper is restricted to development, loopback PostgreSQL, private HTTP origins, reserved demo addresses, local mail and disabled payments. Synthetic grants are ignored outside the explicitly enabled development preview. There is no test-login HTTP endpoint.

## Suggested hands-on checks

1. **Guest:** paste a long script, set up, open the display on the tablet and scan the remote QR with the phone. Play, pause, jog, change speed and Quick Edit. Text should change on every connected screen before Done.
2. **Library before pairing:** sign in, create and edit a script. Wait for **Saved to account**, refresh, rename, search, duplicate, export, trash and restore. Free creation/duplication/restoration must respect three active scripts; trash does not count.
3. **Two editors:** open the same saved script in two tabs. Make competing edits. Review the explicit saved/local/copy choices rather than expecting automatic merging.
4. **Disconnected editing:** load a saved script first, then set that tab offline using browser developer tools. Edit and wait for **Saved on this device**. Refresh that tab while offline only if the browser can still load the app; this is not an offline-installable website. Reconnect and wait for **Saved to account**. Browser clearing/private storage restrictions can remove device drafts: export important text.
5. **Pro:** save a named/default preset, start a session, explicitly apply a different preset. Both displays should update without resetting the reading position. Temporarily revoke demo Pro: existing scripts and presets stay, editing/export remain, excess creation and preset application stop.
6. **Real devices:** lock the phone, switch apps, rotate the tablet and briefly change Wi-Fi. Verify fresh state on return and no replay of old jog gestures. These physical checks still need your observation; automated browser emulation is not proof.

Playback speed uses the last setting on this device for previews and new guest, saved and offline sessions. A selected Pro preset takes priority when starting a saved session. Changes from a paired phone are remembered by the connected reading screen/editor as well. This is a browser preference; it does not sync through the account to an unrelated device. Empty previews stay blank and paused until you add your own text.

Do not expect real email delivery, Google login or checkout in this preview. Both payment integrations are tested with synthetic responses; activation remains off.

## Restart this preview

PostgreSQL (only if stopped):

```sh
/opt/homebrew/opt/postgresql@16/bin/pg_ctl -D /Users/grixate/Documents/ChatGPT/Teleprompter/artifacts/account-preview-postgres -o '-h 127.0.0.1 -p 55432' -l /Users/grixate/Documents/ChatGPT/Teleprompter/artifacts/account-preview-postgres/server.log start
```

Phoenix, from `api`:

```sh
DATABASE_URL=postgresql://grixate@127.0.0.1:55432/izzy_dev PUBLIC_ORIGIN=http://192.168.1.13:5174 TELEPROMPTER_DEV_PORT=4004 mix phx.server
```

Frontend, from the repository root, in another terminal:

```sh
IZZY_API_PROXY=http://127.0.0.1:4004 npm run dev:web -- --port 5174 --strictPort
```

Existing servers on 5173/4000 are separate; don't stop them by name or reset their data. Restarting the account preview ends its live sessions, not saved scripts. Pair again afterwards.

Preview data is in `artifacts/account-preview-postgres`, ignored by Git and Docker. Local trust authentication is loopback-only and must never be reused for production. Export important scripts. The disposable automation database `izzy_qa_20261010` is separate from `izzy_dev`.

## Repeat automated verification

Use a migrated, disposable database, never a customer's or the preview library. Browser commands own ports 4173/4002; do not run two browser suites concurrently.

```sh
npm test
npm run test:security-deps
cd api
DATABASE_URL=postgresql://grixate@127.0.0.1:55432/izzy_qa_20261010 MIX_ENV=test mix ecto.migrate
DATABASE_URL=postgresql://grixate@127.0.0.1:55432/izzy_qa_20261010 mix test
cd ..
IZZY_E2E_DATABASE_URL=postgresql://grixate@127.0.0.1:55432/izzy_qa_20261010 npm run test:browsers
npm run test:restore
npm run test:release
```

`test:restore` creates two uniquely named fixture databases, verifies a dump/restore and removes **only** those databases and its temporary dump. It never restores over `izzy_dev`. Override `IZZY_RESTORE_PG_URL` and `IZZY_PG_BIN` for another loopback PostgreSQL installation. A managed-host restore and container startup still need their actual environments.
