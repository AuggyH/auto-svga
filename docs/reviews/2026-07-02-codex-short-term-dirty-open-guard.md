# Short-term Dirty Open Guard

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous
Base: 681fc212

## Summary

Extended the short-term host dirty-output guard from close to open flows. When
the current file has unsaved output bytes or an active persisted-output record,
opening another local file or a recent file now returns a blocked result with
diagnostic code `open_requires_discard_confirmation`. The current preview,
source path, active output, and recent persistence state are preserved.

The caller can proceed only by passing `discardUnsavedChanges: true`; confirmed
opens clear the dirty output and load the requested file normally.

## Requirement Checks

- S1 local open and S16 recent open: both still use the same host open pipeline
  after explicit discard confirmation.
- S14 save/dirty behavior: unsaved optimization or edit output is not silently
  discarded by another open action.
- S16 recent persistence: blocked dirty open does not rewrite recent-file
  storage; confirmed open persists the newly opened file.
- Product scope: no UI shell wiring, no new controls, and no deferred sequence
  repair or export-acceptance surface.

## Changed Files

- `src/workbench/short-term-host-actions.ts`
- `src/tests/short-term-host-actions.test.ts`
- `src/tests/short-term-host-session.test.ts`

## Verification

- `npm run build` PASS
- `git diff --check` PASS
- `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-workbench-facade.test.js` PASS, 27 tests
- `npm run test:all` PASS, 333 tests

## Risks And Next Step

The future native shell must show a confirmation prompt and retry the open
action with `discardUnsavedChanges: true` only after the user chooses to discard
the current output. The host boundary is now ready for that confirmation flow.
