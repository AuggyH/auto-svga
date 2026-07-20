# ST-RC0 Save Source Rebase Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`
Scope: short-term Workbench host/action boundary, S14/S16

## Summary

Fixed a short-term Save As / overwrite boundary bug: after a validated save,
the host state now rebases the current workbench source bytes, current file
display name, reopened inspection model, and recent-file identity onto the
saved output. This prevents follow-up actions from using the old source bytes
while the host path points at the saved copy.

The fix also adds a fail-closed write-read-reopen path: if bytes write and read
back correctly but the saved SVGA cannot be inspected again, the dirty output is
kept and the save result is failed with `saved_reopen_validation_failed`.

## Changed Files

- `src/workbench/short-term-app-state.ts`
- `src/workbench/short-term-workbench-facade.ts`
- `src/workbench/short-term-host-actions.ts`
- `src/workbench/short-term-save-execution.ts`
- `src/tests/short-term-host-actions.test.ts`
- `src/tests/short-term-host-session.test.ts`
- `src/tests/short-term-workbench-facade.test.ts`
- `src/tests/short-term-node-host-environment.test.ts`

## Requirement Checks

- S14 Save edited output: validated output now becomes the clean current source
  after successful save; failed write-read-reopen validation keeps dirty state.
- S16 Recent files: Save As now records the saved copy as the latest recent
  file without exposing full local paths to renderer-facing models.
- Scope guard: no UI shell wiring, no deferred sequence repair, no export
  acceptance, no new product feature.

## Verification

- `npm run build` passed.
- Targeted host/session/facade/node-host/save tests passed: 74/74.
- `npm run test:all` passed: 406/406.
- `npm run svga-workbench:v1:validate` passed: 15 commands, `failed=[]`.
- `npm run svga-workbench:v1:distribution-readiness` passed with
  `state=PREP_READY_RELEASE_BLOCKED`; release blockers remain Product Owner
  review readiness, macOS signing identity, and macOS notary credentials.

## Risks

- The saved output is re-inspected through the existing host inspection path.
  If a future operation produces bytes that pass hash validation but cannot be
  parsed by inspection, save will correctly remain failed and dirty.
- No remaining blocking host/action gap is known for ST-RC0 at this point.

## Next Step

Stop open-ended hardening for this slice after final post-commit validation.
Further work should be limited to Product Owner findings, UI/UX handoff
integration after the real shell is ready, or externally blocked distribution
credentials.
