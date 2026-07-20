# Codex Review: Short-Term Host Actions

## Summary

Added a short-term Host Action adapter for the main engineering line. It composes the existing Workbench facade with host-provided file I/O, inspection, recent-file availability checks, menu dispatch, optimization output capture, and Save/Save As write-read validation.

The adapter keeps local paths and output bytes host-only. Renderer-facing facade models continue to expose path-redacted state, command availability, recent-file views, workflow status, and output summaries only.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `fff57886 feat: expose command menu through short-term facade`
- Unrelated untracked file left untouched: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-actions.ts`
  - Added host action state with host-only `currentLocalPath` and `activeOutputBytes`.
  - Added local open, recent open, clear recent, optimization, imageKey rename, image replacement, Save/Save As, and menu dispatch entry points.
  - Save writes output bytes, reads the saved file back, validates the bytes, clears dirty only on a hash match, and keeps dirty on write/read/validation failure.
  - Host error diagnostics redact path-like local filesystem fragments.
- `src/workbench/short-term-workbench-facade.ts`
  - Added facade helpers for recent-file missing and save-write failure states.
- `src/tests/short-term-host-actions.test.ts`
  - Covers S1/S14/S16 host flows: local open, recent missing, path redaction, optimization Save As, read-back mismatch, and disabled menu fail-closed behavior.

## Requirement Checks

- Mainline priority: P7 desktop-client preparation plus P1 infrastructure.
- PRD alignment: S1 local open, S14 explicit save actions, and S16 recent-file reopening.
- No UI polish or temporary-shell wiring.
- No sequence repair, export acceptance, advanced edit mode, or deferred workflow exposure.
- No external AI, network dependency, telemetry, or asset upload.

## Verification

- `npm run build` passed.
- Targeted tests passed: `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-workbench-facade.test.js dist/tests/short-term-command-menu.test.js dist/tests/short-term-save-execution.test.js dist/tests/short-term-recent-files.test.js`
  - Result: 27 tests passed.
- Full validation passed: `npm run test:all`
  - Result: 309 tests passed.

## Risks

- This is still a host boundary, not Electron/macOS wiring. The native shell must implement the host environment interface before this becomes product-runtime behavior.
- The temporary UI shell remains separate and should not be treated as the product source of truth.

## Next Steps

- Add a small Node/Electron-oriented host environment implementation once the native shell boundary is ready.
- Continue keeping all command availability derived from the facade app state so UI and native menus cannot drift.
