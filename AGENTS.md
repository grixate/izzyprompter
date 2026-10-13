# IZZY development and releases

- Keep `izzyprompter.com` on its approved release while developing changes.
  Local edits, commits, and GitHub checks must not automatically deploy it.
- Start unrelated work on a descriptive `codex/` branch from current `main`.
  Keep fixes focused; preserve the design studies and existing user work.
- Run checks appropriate to the change. Use a pull request for integration;
  the `test`, `accounts`, and `container` GitHub jobs should pass before merge.
- Use `staging.izzyprompter.com` for hosted review. It has separate app state,
  environment secrets, and a resource-limited container. Use synthetic scripts.
  Read `docs/RELEASE_WORKFLOW.md` before changing either hosted environment.
- Publish production updates only when the user authorizes publication.
  Promote the exact tested image, retain the previous image, and verify the
  public flow. App restarts end active sessions: schedule between takes.
- Keep credentials, login links, capability fragments, runtime environment
  files, private keys, and database backups out of Git, screenshots, and logs.
  Staging credentials are stored locally outside this repository.
- Do not report physical iPad/iPhone checks or GitHub checks as passed unless
  they actually ran successfully. Read the current runbook for remaining limits.

Explicit user instructions take precedence over this default workflow.
