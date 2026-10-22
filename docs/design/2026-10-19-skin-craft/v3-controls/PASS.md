# Curated control pass — 19 October 2026

This is the first, deliberately limited implementation pass from `../CURATED_DIRECTION.md`.

- The lower phrase bank, Quick Edit and finish key use each retained instrument’s material, shape and press treatment. Original, Orbit, Thumbprint, Groove, Field, Signal, Vector, Foundry, Cartridge, Switchboard, Correspondent and Observatory are shown.
- Field’s actual transport key is centred over its metal boss, with a recessed-looking glyph and no separate key below the wheel. Signal’s central key is round.
- Phrase navigation and the Quick Edit trigger share the same components between the real remote and the synthetic controls review. Protocol and permissions are unchanged. The synthetic editor does not touch saved scripts.
- `/lab/jog?review=controls` is an isolated development review with these twelve studies. The full historical lab and stable IDs remain available. This is not a promise of twelve final release skins.
- Clear/Arcade reconstructions, camera/console/telephone details, Observatory geometry and any new ship/skate directions remain separate next passes.

Validation: 90 client unit tests and a production build passed. The paired control-bank test passed in all three engines without retries/skips. Each engine exercised all twelve finishes, real Next/Previous, actual live paragraph editing and focus restoration, Play/Pause, contrast sampling and touch geometry at 320×568, 844×390 and 390×844. `checks.json` contains sanitized results. No physical device results or GitHub passes are claimed.

The first run identified an inherited Quick Edit ink rule that made the light keys of Switchboard and Observatory unreadable. The rule was corrected; the full control-bank run was repeated successfully.
