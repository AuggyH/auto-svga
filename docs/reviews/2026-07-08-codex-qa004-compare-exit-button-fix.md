# Review: ASV-QA-20260708-004 Compare Exit Button Fix

## Summary

- Fixed the Compare page exit button pointer path by moving right-surface content below the native titlebar hit area.
- Added renderer smoke evidence for coordinate hit testing on the visible `back-preview` button.
- Added main-process proof validation so the callback evidence preserves the hit-test details instead of only a high-level pass.

## Git State

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit: this review is intended to be committed with the fix.
- Pre-existing unrelated dirty files were present before this work and are not part of the fix.

## Requirement Checks

- ASV-QA-20260708-004 original bug: addressed in source and smoke proof.
- Menu exit behavior: unchanged.
- Product scope: no new short-term feature added.
- Real production asset handling: no production asset committed.

## Verification

- `npm run build` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed with normal local permissions.
- `npm run desktop:short-term:design-system-check` passed.
- `npm run desktop:smoke` passed.
- Runtime proof: `compareExitButtonPointerPathWorks=true`, `compareExitButtonBelowTitlebar=true`, hit target action `back-preview`, exited to Preview.

## Risks And Follow-Up

- The owner local stable app still needs to be refreshed before QA can regress the owner-used baseline.
- The pre-existing dirty project docs and retrospective ledger were intentionally left untouched.

## Project Retrospective

- Lesson: native titlebar hit zones need coordinate-based proof, not only programmatic action proof. A visible button can be wired correctly and still fail real pointer use when it sits under draggable chrome.
- Ledger update: skipped in this commit because `docs/retrospectives/TASK_RETRO_LEDGER.jsonl` already had unrelated uncommitted changes before this task, and staging it would risk mixing ownership.
