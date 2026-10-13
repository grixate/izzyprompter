# Browser verification and repeatable builds

Slice 5.6 extends the existing product-flow suite to Chromium, Firefox, and WebKit. It does not introduce a second UI or change the approved industrial design.

## Commands

```sh
npx playwright install chromium firefox webkit
npm test
npm run test:browsers
npm run test:release
```

`npm run test:all` remains the faster client/server/build plus Chromium check. `npm run test:browsers` runs all three engines, using the same independent editor/display/remote contexts and assertions. It starts its own servers on 4173/4002 and refuses already occupied test ports; it does not restart the development app or the normal LAN release. Do not run two browser suites simultaneously against those ports.

GitHub Actions is configured to install all three engines and run the wider suite, then production/LAN release smoke checks. A local pass is not evidence of a remote CI pass; that requires a push and inspection of the actual run.

## Coverage and deliberate differences

All engines exercise pairing and role permissions, wheel scrubbing, playback, speed, exact reading anchors through reflow, multi-display source handoff, live current-paragraph editing on multiple screens, draft conflicts/recovery, network loss, lifecycle-event simulation, a real isolated server restart, file imports/drop, keyboard navigation, storage refusal/export/retry, and terminal recovery.

Slice 5.8 adds a tablet-sized editor opening its actual display tab with an independent phone controller, plus short-screen pairing overflow and recovery-control reachability. These are browser/viewport checks, not physical tablet or camera-QR certification. Visible product naming is IZZY; local/loopback guidance depends on the advertised pairing address and is not shown for a public website URL.

- The native OS clipboard test runs only on Chromium. Its permission setup is not portable. The other two instances are explicitly skipped, not reported as passes. All engines also run a separately named simulated paste-event test: it checks plain-text normalization and ignores foreign markup, but does not prove OS clipboard integration. Firefox strips payloads from constructed `ClipboardEvent`s, so the simulated event supplies its data explicitly.
- Firefox does not support mobile-emulation mode. Its narrow-screen tests use the same responsive viewport and touch capability without `isMobile`. Chromium and WebKit use mobile emulation. None of these is a physical phone test.
- On macOS WebKit, keyboard tests use Option+Tab to include native buttons/links without changing system preferences. Safari exposes this distinction in its [keyboard shortcut guidance](https://help.apple.com/safari/mac/8.0/en.lproj/cpsh003.html). The app's accessible keyboard instructions mention the fallback.
- Native modal dialogs make background page controls inert, but may allow tabbing to browser chrome or the dialog container. Tests verify the modal state and exclusion of underlying controls, not an engine-specific number of Tab presses.
- Storage retry tests wait for the actual current script's failed write, not an earlier warning from an empty draft. This prevents enabling storage while the current draft's debounce is still pending.

## What a pass does not mean

Playwright's bundled WebKit is not the installed Safari application; bundled Chromium is not a separate acceptance run of branded Chrome and Edge. Desktop engine checks do not certify iOS Safari, Android Chrome, real keyboards/IME, wake locks, OS clipboard permissions, device sleep, Wi-Fi changes, or internet-disconnected router operation. VoiceOver/NVDA acceptance is still open. Physical-device testing remains deferred at the user's request.

The two real release smoke tests remain Chromium-based. The three-engine suite uses the same app source through the development test server, not three independent production deployments. No public hosting or external infrastructure was provisioned.

## Dependency policy

All direct frontend and development-tool dependencies in `package.json` use exact versions already resolved in `package-lock.json`. This slice does not upgrade those packages or change any transitive resolved version. A unit test checks exact versions and manifest/lockfile agreement; `npm ci` remains the install path for repeatable builds.

Updates should be deliberate: change the desired exact version and lockfile together, inspect the dependency changes, then run client/server, browser, and release checks. Exact pins are not a vulnerability audit or a promise that every dependency is current. Elixir dependencies continue to use `mix.lock`; their version constraints were not changed.

Pinning supports predictable offline package preparation, but it is not an installer. The source launcher needs Node.js and a compatible prebuilt OTP release. Slice 5.7's [portable Mac preview](PORTABLE_PACKAGE.md) includes those runtimes and the required native library; signed installers and physical acceptance remain open.
