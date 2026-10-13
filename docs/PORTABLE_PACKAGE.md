# Portable Mac preview — Slice 5.7

## Available package

Further offline packaging is parked at the user's request. The verified ZIP below preserves the Slice 5.7 UI snapshot; later browser branding/copy refinements do not silently change that archive. It still requires a host Mac and does not provide phone + tablet-only offline operation.

The first verified package is `artifacts/IZZY-local-0.1.0-darwin-arm64-preview2.zip` (approximately 50 MB compressed / 157 MB extracted). It includes the client, Phoenix OTP release and Erlang runtime, a pinned standalone Node runtime for the launcher, the required OpenSSL library, and third-party notices. The earlier initial build is unverified; use the `preview2` ZIP.

Extract the ZIP completely and double-click **Start IZZY.command**. It starts the server in a Terminal window, then opens the default browser after that exact server is ready. Create a session and scan the QR from a phone on the same reachable local network. Keep the computer awake and Terminal open. Control+C or closing Terminal stops the owned server; sessions are ephemeral and do not survive a server restart.

The default is port **4174**. A running ordinary LAN release already using that port is not replaced or stopped. To try the package alongside it, run the extracted command in Terminal with `--port 4175`. Other options are `--host PRIVATE_IP` and `--no-open`; `--help` prints guidance. Separate address/port origins have separate browser drafts.

No project checkout, installed Node.js, npm, Mix, Elixir, Erlang, or Homebrew is required by the finished package's startup path. There are no runtime builds/downloads. The wrapper uses the included runtime and release, a restricted OS-only command path, and the same trusted-LAN validation as the existing launcher. Browser opening is best effort; if it fails, use the printed address. Local-network/firewall permissions and Wi-Fi client isolation can still prevent phone access. There is no cloud relay or automatic discovery/handoff.

## Compatibility and distribution limits

- **Apple Silicon Mac only.** This build's native binaries report **macOS 26.0** as their highest minimum OS requirement. This is binary metadata, not an older-OS acceptance test. Do not advertise macOS 13/14/15 compatibility from Node's own minimum requirement.
- The actual package was moved and smoke-tested on the builder's Mac with no development tools in its command path. A clean second Mac has not been tested. Intel Mac, Linux package, and Windows package support are not implemented; the existing source launcher still supports macOS/Linux with its normal prerequisites.
- This is an internal unsigned preview, not a `.app` installer. Modified native libraries receive ad-hoc signatures for local loading; these are **not** Developer ID signing or notarization. Downloaded copies may be blocked by Gatekeeper. No security attributes are removed and users should not disable OS protections. A public signed/notarized release needs a separate release process.
- Physical iOS/Android, router-uplink-disconnected, firewall onboarding, actual Terminal/Finder gestures, and sleep/keyboard acceptance remain unverified. Automated signal/browser checks do not substitute for them. Physical testing remains deferred at the user's request.
- Trusted-LAN HTTP is unencrypted. Never expose/forward this port publicly. A complete pairing link grants its holder the corresponding role. No live scripts, browser storage, or live pairing credentials are copied into the package.

## Prepare a package

On native Apple Silicon macOS, with project dependencies and developer tooling already installed:

```sh
npm run package:local
```

Choose a new destination when rebuilding:

```sh
npm run package:local -- --out artifacts/IZZY-local-next
```

Existing output directories/ZIPs are refused. The builder exclusively creates its new output, builds the OTP release there, and never overwrites `api/_build/prod/rel/teleprompter` or restarts a running server. It rebuilds the shared ignored static-asset staging directory, not the live release's copied assets. A failed build cleans up only the new directory/ZIP it created; existing files remain untouched.

Preparation downloads Node **24.21.0** from its [official release distribution](https://nodejs.org/dist/v24.21.0/). Its SHA-256 is pinned to the [published checksum manifest](https://nodejs.org/dist/v24.21.0/SHASUMS256.txt) before extraction. This is checksum/TLS verification, not a release-signing-key verification process. To prepare without that download, supply the exact previously obtained archive:

```sh
npm run package:local -- --out artifacts/IZZY-local-next --node-archive /absolute/path/node-v24.21.0-darwin-arm64.tar.gz
```

No dependency upgrades or package installation happen in the builder. It requires `npm`, Mix/OTP, and macOS tools (`tar`, `ditto`, `otool`, `lipo`, `install_name_tool`, `codesign`). A standalone archive checksum is written beside the ZIP for later integrity checks.

## Native dependency checks and notices

Copying a Homebrew OTP release alone is insufficient: its crypto module uses a dynamically linked OpenSSL library, consistent with [OTP's build configuration](https://www.erlang.org/doc/system/INSTALL.html). The builder detects this dependency, copies its library/licence, and rewrites the copied module's load reference to `@loader_path`. The installed Homebrew files are never modified.

The first builder accepts only the known OpenSSL 3 dependency family; other non-system external libraries fail the build instead of being silently omitted. Every packaged Mach-O file is checked for arm64 support and remaining dependency paths. Only OS libraries or existing package-relative references are accepted. Symlinks, escaping references, name collisions, and missing attribution files are refused. Binary hashes, dependency paths, minimum OS metadata, runtime pin, and explicit acceptance/signing flags are recorded in `package-manifest.json`. This does not prove arbitrary same-OS machines are compatible.

`licenses/` includes Node, OTP, Elixir, OpenSSL, runtime JavaScript package notices, and backend dependency attribution files. This is an automated notice inventory, not a legal compliance audit or a choice of licence for IZZY itself.

## Automated verification

```sh
npm run test:package
```

On native macOS arm64 this creates a disposable fresh package and tests its ZIP. To verify an existing delivered ZIP without rebuilding/downloading:

```sh
IZZY_PACKAGE_ZIP=/absolute/path/IZZY-local-0.1.0-darwin-arm64-preview2.zip npm run test:package
```

The test extracts and moves the package into a path containing spaces; verifies the archive digest, native inventory and notices; starts it from an unrelated directory with an OS-only command path; verifies busy-port refusal; exercises pairing, playback, live edits before Done, and reload with external browser HTTP blocked; checks Control+C/SIGHUP shutdown; and verifies an unrelated server survives. It also checks existing output preservation, tampered-archive rejection, and failed-build cleanup. On other platforms this test is explicitly skipped, not passed. Current Ubuntu CI does not build or certify the Mac package.

The smoke test leaves the delivered archive and running development/LAN servers untouched. It deletes only its own extracted temporary package after stopping its own processes. Keep [physical-device acceptance](REMOTE_DEVICE_QA.md) unverified until real results are available.
