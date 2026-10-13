IZZY LOCAL — Apple Silicon Mac preview

1. Extract the ZIP completely. Keep all files in the extracted folder together.
2. Double-click “Start IZZY.command”. A Terminal window starts the local server
   and opens your default browser when it is ready.
3. Join the same reachable Wi-Fi on the phone, paste your script on the computer,
   start a session, and scan the QR code inside IZZY.
4. Keep the computer awake and the Terminal window open. Press Control+C in that
   window to stop. Closing/stopping the server ends its in-memory sessions.

No Node.js, Elixir, Erlang, npm, Homebrew, or project checkout is needed at launch.
Nothing is downloaded or built at launch. You still need the local network; the
router's internet connection is not required by the app. Physical phone/router
acceptance remains unverified. This is not a native app or a signed installer.

Default port: 4174. A busy port is refused; no other app is stopped. For another
port or network address, run this file in Terminal with --port NUMBER and/or
--host PRIVATE_IP. Use --no-open to print the address without opening a browser.
Only a detected private address on this computer, or 127.0.0.1, is accepted.

If macOS asks about local-network access, it is needed for phone pairing. Guest
Wi-Fi isolation, a VPN, or a firewall can block devices even on the same Wi-Fi.
No eligible private address means computer-only mode. If Wi-Fi/IP changes, stop
and restart. There is no cloud relay, discovery service, or automatic handoff.

TRUSTED LAN ONLY: HTTP does not encrypt script text or pairing keys. Do not
forward the port or expose this server publicly. A pairing link grants access
to its holder. Browser drafts are per address/port, not a durable backup; export
important text and heed save warnings before closing the browser.

Compatibility and build versions are recorded in package-manifest.json. This
package has only been smoke-tested on its builder's Mac, not a clean second Mac.
The minimum OS reported there comes from binary metadata, not a tested OS matrix.
Intel Macs, Linux packages, and Windows packages are not included in this preview.

This internal preview is not Developer-ID signed or notarized. Downloaded copies
may be blocked by macOS security checks. Do not disable Gatekeeper or remove
security attributes to work around that. A distributable signed/notarized app
requires a separate release step. Licences/notices are included in licenses/.
