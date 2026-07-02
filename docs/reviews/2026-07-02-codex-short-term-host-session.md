# Codex Review: Short-Term Host Session

## Summary

Added a host-neutral session controller that composes the short-term host
actions with recent-file persistence. It loads persisted recent records at
session start, runs open/recent/menu actions through the existing host action
adapter, and automatically saves recent-file state when it changes.

This is main-engineering contract work only. It does not wire real behavior
into the temporary UI/UX shell.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `48f0a547 fix: guard short-term save as source path`
- Unrelated untracked file left untouched: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-session.ts`
  - Added `createShortTermHostSession`.
  - Added open-local, open-recent, menu-dispatch, and recent-persistence entry
    points over the existing host-action layer.
  - Returns a separate recent-persistence result so a successful open action is
    not falsely converted into an open failure if recent-file saving fails.
- `src/tests/short-term-host-session.test.ts`
  - Covers automatic recent persistence after open and clear actions.
  - Covers missing recent-file state being persisted.
  - Covers persistence failure redaction and later retry without invalidating a
    successful open action.

## Requirement Checks

- Mainline priority: P7 desktop-client preparation plus P1 infrastructure.
- PRD alignment: S1 local open, S14 save/menu action boundary, and S16 recent
  file persistence/recovery.
- No UI shell wiring, UI polish, telemetry, network dependency, or external AI.
- No parser, preview, optimization algorithm, replacement workflow, sequence
  repair, or product-scope behavior change.

## Verification

- `npm run build` passed.
- Targeted tests passed: `node --test dist/tests/short-term-host-session.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-node-recent-files-store.test.js dist/tests/short-term-node-host-environment.test.js`
  - Result: 14 tests passed.
- Full validation passed: `npm run test:all`
  - Result: 317 tests passed.

## Risks

- The controller is intentionally host-neutral. It does not decide where native
  menu, file dialog, or renderer events come from; the real macOS shell still
  needs stable integration points before wiring.
- Recent persistence failure is reported separately from the action result. The
  native shell should surface or log that result when it eventually consumes
  this controller.

## Next Steps

- Add a thin Node/Electron composition layer once the real UI shell exposes
  stable file-dialog and menu-event boundaries.
