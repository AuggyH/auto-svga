# Short-term Dirty Operation Guard

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous
Base: ed263177

## Summary

Added a host-side dirty-output guard for output-producing operations. When an
optimized, renamed, or replacement SVGA output is already unsaved, starting a
different output-producing workflow now returns a blocked result with
diagnostic code `operation_requires_discard_confirmation`. The prior active
output bytes and active-output model stay intact until the caller explicitly
passes `discardUnsavedChanges: true`.

Repeated image replacement inside the same image-replacement preview workflow
remains allowed without discard confirmation, so designers can continue trying
replacement images before saving or resetting.

## Requirement Checks

- S9/S10 optimization output: repeated optimization no longer silently replaces
  the active unsaved optimization output.
- S11 rename and S12 replacement: cross-workflow switches require explicit
  discard confirmation before replacing the active output.
- S14 dirty/save behavior: one unsaved persisted output remains the active save
  target until saved, reset by its workflow, or explicitly discarded.
- Product scope: no UI shell wiring, no new product surface, no sequence repair
  scope change.

## Changed Files

- `src/workbench/short-term-host-actions.ts`
- `src/tests/short-term-host-actions.test.ts`

## Verification

- `npm run build` PASS
- `git diff --check` PASS
- `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-workbench-facade.test.js dist/tests/short-term-image-replacement-preview-session.test.js` PASS, 33 tests
- `npm run test:all` PASS, 335 tests

## Risks And Next Step

The future renderer/native shell still needs a confirmation prompt and should
retry output-producing commands with `discardUnsavedChanges: true` only after a
deliberate discard choice. The host boundary now preserves the currently active
save target by default.
