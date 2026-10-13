---
name: izzy-remote-design
description: "Create, extend or repair IZZY's industrial remote-skin studies and brand-collaboration concepts using the preserved design playbook. Use for IZZY wheel collections, material/retro explorations and skin craft, not unrelated frontend work, billing or deployment."
---

# IZZY Remote Design

Repeat the founding collection's design process without flattening its ideas into recolours. Build expressive instruments around the same accessible controls; preserve the owner's previous studies.

## Locate the project and load the guide

This skill belongs to the IZZY repository. Its canonical source lives in `.agents/skills/izzy-remote-design`; a local installation may be a symlink. Resolve the physical skill directory before resolving relative links when necessary. The repository is three parents above that canonical directory.

Read [the canonical playbook](../../../docs/REMOTE_DESIGN_PLAYBOOK.md) before task actions. Read [current product decisions](../../../docs/REMOTE_SKINS.md) and the relevant parts of [the lab record](../../../docs/JOG_WHEEL_LAB.md). If those files cannot be found in the current workspace or the resolved skill repository, ask for the IZZY checkout; do not reconstruct the current collection from memory or search unrelated directories.

The playbook contains the reference gallery, concept method, material/motion system, implementation map, quality gates, collaboration rules, reusable brief and preservation procedure. For an extension, read the creative workflow and brief as well as the common constraints. For a repair, load the affected source/artwork and relevant geometry/interaction checks. For a collaboration, read the brand section before using supplied assets. No other skill or paid research service is required; use specialised tools only when the task benefits and they are available.

## Select the actual task

- **Explore:** append the requested number of distinct, working lab studies. Four was the founding convention, not a fixed count. Inspect the existing collection and screen first, then curate concepts before coding. Explain the source world, physical principle, digital interpretation and signature for each selected idea.
- **Repair:** diagnose the visible/interaction defect; make a narrow correction and verify it at rest and in motion. Preserve the study's ID and the rest of the collection. Do not turn a repair into a new generation round.
- **Collaborate:** translate approved brand attributes into material and geometry. Missing rights permit only clearly unapproved, neutral/private concept work—not logo use, partnership claims or publication.
- **Production:** treat promotion of a selected skin as a separately scoped product change. The lab's disposable state and enabled demo controls are not a production implementation.

## Essential constraints

Keep `JogControls`/`TransportReadout` and their shared input semantics; style faces through lab-scoped CSS and inert local SVG/CSS artwork. Do not fork the protocol or interaction logic per appearance. Keep fixed layers fixed, moving layers meaningful, and state truthful. The same gesture must have the same effect in every skin.

Preserve existing studies, stable IDs and prior evidence. At the founding baseline there are twelve studies; Orbit is the preferred default candidate, Vector was especially praised, and exploration is paused until another round is requested. Re-read the product record rather than treating these preferences as permanent or as production approval.

Development-only exploration does not authorise a default switch, entitlement changes, account persistence, payment activation, public brand use, deployment, commit or Git push. Follow the user's actual scope and current applicable instructions. Stop at the requested deliverable count; do not generate another round automatically.

## Verify and hand off

Execute the playbook's visual, accessibility and functional gates in proportion to the changed scope. Use real browser observations, not only a build or attractive still. In particular, test geometry's closing seam, bidirectional drag, transport, keyboard bounds, speed, narrow-phone layout and decorative motion-off behaviour. Record any checks not run; emulation does not certify physical iPhone/iPad operation.

For code changes run the current client unit tests, production build and diff checks. Confirm lab-only additions remain out of the release bundle. Avoid unrelated account/session data when testing; restore temporary viewport overrides.

Save dated, reviewed screenshots and source references outside ignored scratch folders. Update collection facts and meaningful lessons without duplicating the playbook. Deliver a working preview, concise concept descriptions and actual verification results. Repeatable process and preserved source are achievable; identical future creative output is not guaranteed.

When checking a preserved archive, run `node .agents/skills/izzy-remote-design/scripts/verify-baseline.mjs <baseline-directory>` from the repository. It validates recorded file hashes without requiring the evolving live code to match. Do not rewrite the manifest to hide an unexpected mismatch.
