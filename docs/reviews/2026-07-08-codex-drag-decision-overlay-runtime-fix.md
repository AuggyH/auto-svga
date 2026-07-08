# Review: Drag Decision Overlay Runtime Fix

## Summary

- Implemented the PM correction from `f136b895`: the short-term drag-decision overlay now uses unequal top/bottom zones instead of the old left/right split.
- Open File is the primary 75% zone, Add As Compare File is the secondary 25% zone.
- Center and lower-center drag points resolve to Open File; only the bottom secondary zone resolves to Compare.
- Fix commit: `fadcca5b`.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-drag-decision-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-drag-decision-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/quality/evidence/PM-20260708-drag-decision-overlay/callback-evidence.json`

## Verification

- `npm run build` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed.
- `npm run desktop:short-term:design-system-check` passed.
- `npm run desktop:smoke` passed.

## Evidence

- Runtime proof: `.artifacts/product/short-term/short-term-open-flow-proof.json`
- Handoff evidence: `docs/quality/evidence/PM-20260708-drag-decision-overlay/callback-evidence.json`
- Confirmed proof fields:
  - `dragDecisionSplit=top-bottom-75-25`
  - `dragDecisionCenterPointOpen=true`
  - `dragDecisionLowerCenterPointOpen=true`
  - `dragDecisionSecondaryPointCompare=true`
  - `unsupportedDragRejected=true`
  - `unsupportedDropToastVisible=true`

## Risks And Follow-Up

- The owner local stable app was not refreshed in this implementation turn because unrelated pre-existing dirty files remain in the main worktree.
- QA or Release/Packaging should refresh `/Users/huangtengxin/Applications/Auto SVGA.app` from a clean package/promotion lane before owner-baseline regression.

## Retrospective

- Interaction hit testing should prove the high-probability physical drop path, not only the visible overlay. For this contract that means center and lower-center points are as important as the secondary compare target.
