# Cue — Realtime LAN Teleprompter Prototype

An interaction-first teleprompter with three separate browser surfaces connected by Phoenix Channels:

- editor and pairing screen;
- teleprompter display;
- phone remote with a tactile jog wheel.

## Run

```bash
npm install
npm run dev
```

This starts Vite on port `5173` and Phoenix on port `4000`. Open the **Network** URL printed by Vite rather than `localhost` when pairing a phone. Both devices must be on the same LAN.

The internet is not used by a running session. Once dependencies are installed, editor, remote, display, transport state and QR pairing all work entirely over the local network.

## Public website mode

The same frontend can be hosted on a normal HTTPS domain. Phoenix Channels then relay commands over secure WebSockets, so the display and phone can be on different networks. Host both behind one domain with `/socket` proxied to Phoenix, or set `VITE_SOCKET_URL` to a separate public Phoenix endpoint before building.

Public mode and local mode are complementary:

- **Public:** easiest zero-install experience; requires internet during the session.
- **Local:** runs from a computer on the LAN; keeps working without internet after dependencies are installed.

## Controls

- Paste or edit the script and start a local session.
- Open the display in a second browser tab or device.
- Scan the QR code with a phone to open the remote.
- Press the center of the wheel to play or pause.
- Drag the wheel clockwise or counterclockwise to seek.
- Use the vertical control to adjust speed.
- Use Previous / Next to jump between phrases.
- Desktop: Space toggles playback, arrow keys seek, `+` / `-` change speed, and `F` opens the display fullscreen.

The display scroll loop runs locally against a transform in `requestAnimationFrame`; React and the network do not render every animation frame. Phoenix sends authoritative transport anchors and semantic commands. If the socket briefly drops while playing, the display continues scrolling from its last known state.

Sessions are ephemeral supervised Elixir processes and expire after six hours of inactivity. No database or account is required.
