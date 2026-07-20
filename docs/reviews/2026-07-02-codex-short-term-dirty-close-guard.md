# Short-term Dirty Close Guard

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous
Base: 21ec8f85

## Summary

Added a fail-closed host boundary for closing a short-term SVGA file after an
operation has produced unsaved output. A plain `closeFile` menu action now
returns a blocked result with diagnostic code
`close_requires_discard_confirmation` and preserves the current file, output
bytes, recent-file state, and preview-ready session. The caller must explicitly
send `discardUnsavedChanges: true` to close and discard the unsaved output.

Clean files still close without confirmation.

## Requirement Checks

- S10/S14 dirty output behavior: unsaved optimized output is no longer silently
  discarded by a close action.
- S16 recent-file behavior: blocked close does not mutate recent persistence;
  confirmed close keeps recent records and still redacts local paths.
- Product scope: no UI shell wiring, no new product surface, and no sequence
  repair or export-acceptance scope was added.
- Preview/export safety: current SVGA preview, optimization output, Save As,
  and existing facade close behavior remain covered by tests.

## Changed Files

- `src/workbench/short-term-host-actions.ts`
- `src/tests/short-term-host-actions.test.ts`
- `src/tests/short-term-host-session.test.ts`

## Verification

- `npm run build` PASS
- `git diff --check` PASS
- `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-workbench-facade.test.js` PASS, 23 tests
- `npm run test:all` PASS, 329 tests

## Risks And Next Step

The future native shell still needs to show the confirmation UI before retrying
close with `discardUnsavedChanges: true`. The host action now gives that shell a
deterministic blocked state instead of silently discarding work.
