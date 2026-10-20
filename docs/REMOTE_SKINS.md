# Remote skins — product direction

> **19 October — owner-directed curation:** the goal is recognisable objects and interests, with no finish-count quota. See [the current brief](design/2026-10-19-skin-craft/CURATED_DIRECTION.md). The [first control pass](design/2026-10-19-skin-craft/v3-controls/PASS.md) styles the lower controls and centres Field's engraved Play; Signal's key is round. Previous 25-candidate records below are historical, not an approved release selection.

Creative development follows the [remote instrument design playbook](REMOTE_DESIGN_PLAYBOOK.md). It records the reference collection, reusable workflow and collaboration/quality gates; this file records product scope and entitlement decisions.

Owner direction, 2026-10-12: preserve the wheel studies, explore more variants, and offer remote skins as a future Pro feature. Preferred default: **R–03 / Orbit**. Current implementation is the twelve-study development playground only, not a shipped theme selector or paid entitlement. Collection 03 closes this exploration for now at the owner's request; retain all three collections and their previews.

Owner update, 2026-10-13: explicitly resumed exploration for four raw-material studies. Collection 04 adds Correspondent, Foundry, Inox and Airframe; the lab now contains sixteen studies. Retain the founding archive unchanged. Orbit remains the preferred default candidate; the production remote and Pro scope remain unchanged. See [Material memory](design/remote-skins/2026-10-13-material-memory/COLLECTION.md).

## 14 October implementation candidate

The owner authorized the UX/PRO implementation. The review branch now extracts all sixteen studies into a public `/skins` showroom and a shared live remote finish selector, backed by verified online PRO grants. Original remains the free default; fifteen finishes are optional PRO choices. The device stores the preference separately from effective permission. Revocation returns to Original without deleting the choice or user scripts. Local/DIRECT takes currently use the free default. All lab collections remain preserved.

This is a review candidate, not a production release or payment activation. Per-skin physical Safari/Android review, merchant acceptance and owner visual review remain open. See [implementation evidence](design/2026-10-14-ux-pro/IMPLEMENTATION.md).

## 15 October navigation and speed repair

The owner asked to hide the separate library entry without deleting it. Header,
mobile menu and footer omit the showroom link; `/skins` and its deep links remain
available. PRO keeps its contextual finish previews. Redundant How it works and
Start prompting navigation entries are removed; the logo returns to the editor.

Decorative instruments now use the established speed-module structure and skin
material selectors, with inert step keys, a full-width rail and a defined 0.86×
example (36% of the shared 0.5–1.5 range). The earlier flex rail had collapsed to
zero width. Container-based sizing handles small teaser objects as well as
showroom cards; obsolete viewport overrides no longer distort the step keys.
Live speed controls and the preserved lab studies keep their input semantics.

## 17 October in-session library candidate

The online remote's skin button is a 44 px swatch icon beside Quick Edit.
It opens an in-session library with all sixteen static instrument previews,
material labels and a check on the effective current skin. On phones this is
a two-column bottom sheet; larger screens use a centered library. A compact
“Skins” heading and close button stay visible while the collection scrolls.
There is no promotional heading, eyebrow, subtitle or redundant selection footer;
the bottom status area appears only while applying or reporting an error.
Opening the library focuses and reveals the current choice. One tap verifies
the existing Pro grant, saves the browser preference, closes the library and
returns focus to the icon. Opening or applying does not pause playback, edit
the script or navigate away from the session. Pending seek input is flushed
before opening.

Locked choices explain Pro access within the library. The contextual Pro link
opens separately to retain the paired remote. Failed verification or storage
keeps the library open with recovery text. Selection requests are serialized;
Escape and Close remain available during verification. Revocation still falls
back to Original without deleting the saved preference. Local/DIRECT behavior,
the public showroom and all archived design studies are preserved.

Browser automation covers one-tap selection across the full catalog, playback
continuity, phone portrait/landscape and desktop sizing, complete previews,
keyboard focus, saved preference/reload, locked choices, verification revocation,
denied storage and closing during an in-flight request. Physical iPhone/iPad and
Android acceptance remains pending under REMOTE_DEVICE_QA.md. This is a review
candidate; production publication requires separate owner authorization.

## 18 October live-remote readiness review

All sixteen live finishes now have catalog-driven acceptance checks against a
paired local display, alongside responsive, keyboard, reduced-motion and rendered
contrast checks. The review repairs touch targets, legibility/focus, short-screen
scrolling, missing material cues and a shared interrupted-drag capture bug.
The reproducible playbook now maps both lab construction and live integration.
See [the per-finish acceptance record and remaining device gates](REMOTE_SKIN_QA.md).
This is still a review candidate; physical-device and screen-reader approval
remain open, and no production publication is implied.

## 19 October skin craft candidate

The owner authorized execution of the revised skin research: full transparent
bodies, more ambitious moving mechanisms and a coherent colour system. The review
catalog now has Original plus 25 PRO candidates. Clear and Spool lead the six
primary additions; four further distinct directions are implemented for review,
not automatically approved for publication. Groove gains the state-linked
arm; tape, iris, belt and geared mechanisms share the same accessible controls.
Prices, permissions and the free default are retained.

See [the collection and actual renders](design/2026-10-19-skin-craft/COLLECTION.md)
and [implementation evidence](SKIN_CRAFT_IMPLEMENTATION.md). Owner selection,
physical-device and audience acceptance remain open. This supersedes the earlier
pause on exploration, not the separate requirement for production authorization.

## Historical launch scope

- Online free V1 remains the delivery priority. Do not activate checkout, add a paid-launch dependency or change existing script limits for this experiment.
- Keep all sixteen studies on `/lab/jog`; they are reusable visual directions, not approved production skins.
- The actual remote, entry preview, session protocol and saved settings have not changed. Applying Orbit to the real remote is a separate implementation step.

## Future implementation constraints

- Free gets a polished default, not a deliberately degraded remote. Orbit is the current preference, subject to final phone/tablet review.
- Pro adds optional appearance, not different playback correctness. All skins use the same accessible jog/transport implementation, bounds, connection safeguards and editing behavior.
- Use an explicit, allowlisted skin identifier and scoped style tokens; never accept custom CSS, arbitrary asset URLs or HTML from accounts.
- Decide whether appearance follows the account/device or session before adding persistence. A remote's skin should not unexpectedly restyle connected reading screens.
- Resolve server-side Pro entitlement when exposing paid choices. Revocation falls back to the free skin without deleting scripts, presets or the stored preference; existing no-payment launch behavior remains intact.
- Verify contrast, focus, minimum touch targets, reduced motion, text zoom, portrait/landscape and real iPhone Safari on each approved skin. Material imitation must not obscure controls.
- Preserve the owner's existing designs and the lab when a production skin is selected. Do not silently replace the collection with its winner.

No payment activation, database migration, entitlement change, production default change or Git push is authorized by this note.


19 October — Clear and Arcade rebuilt around graphite Phone (1) glass and a TAITO paddle spinner. Synthetic review and paired browser evidence: [object pass](design/2026-10-19-skin-craft/v4-objects/PASS.md). No new IDs, release selection, grants or hosted app update.


20 October — owner accepted refined Clear and praised Arcade. Next priority is distinct time displays and speed controls for all 14 selected instruments. Groove/Clear/Arcade are examples, not a three-skin scope limit. Excluded and reserve studies stay outside this pass. [Saved plan](design/2026-10-19-skin-craft/TIME_AND_SPEED_PLAN.md); planning only, implementation has not started.


20 October — first time/speed batch implemented for Groove, Clear and Arcade. The selected collection remains14. [Implementation, gallery and actual validation](design/2026-10-20-time-speed/PASS.md).21 paired browser cases,90 unit tests and build passed; no hosted app publication or physical-device claim.


20 October — the full selected14 now have instrument-specific time and self-contained speed controls. No duplicate +/-; editable exact speed, native keyboard precision, captured relative gestures, and ACK ordering are shared. [Current collection and evidence](design/2026-10-20-collection/PASS.md).87 paired browser cases have successful latest results across Chromium/Firefox/WebKit; static review and miniatures checked separately. No merge, hosted publication or physical-device claim.


20 October — phone remote is now a fixed viewport instrument. Grid allocation keeps all controls visible without page scrolling; short portrait and landscape layouts preserve touch targets. Shared Quick Edit is a native drawer outside the casing, including the standalone fourteen-skin demo. [Current implementation and actual evidence](design/2026-10-20-fixed-remote/PASS.md). Historical previews remain preserved.
