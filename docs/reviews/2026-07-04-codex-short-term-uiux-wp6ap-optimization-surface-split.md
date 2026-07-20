# Short-Term UI/UX WP6AP Optimization Surface Split Review

## Summary

This UI/UX checkpoint moves short-term optimization workflow coordination out of the app entry file into a dedicated optimization surface module.

The change is behavior-preserving. It does not alter visible UI, optimization copy, safe batch optimization behavior, before/after comparison behavior, save state, product scope, or user-facing labels. The app entry keeps the existing handler names for toolbar actions, action bridge calls, and smoke flows; the new surface owns optimization tab rendering, optimization result insertion, optimization execution, and optimization compare orchestration.

## Git State

- Base before this slice: `c4157e1b uiux: split short-term runtime text surface`
- Working branch: `agent/codex/svga-workbench-v1-autonomous`
- Product/PRD files: not modified

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-optimization-surface.mjs`
  - New optimization surface module.
  - Owns S8 optimization finding rendering coordination.
  - Owns S9 safe optimization execution workflow.
  - Owns S10 optimization before/after compare orchestration.
  - Reuses existing optimization model, optimization renderers, API client, compare surface, byte helpers, and output surface callbacks.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Replaces inline optimization workflow state mutation with calls into the optimization surface.
  - Keeps existing action names and handler wiring unchanged.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates structural assertions so optimization model/rendering/API/compare details are owned by the optimization surface, not the app entry file.

## Requirement Checks

- Touched PRD IDs: S8, S9, S10 at implementation-structure level.
- Owner-visible product scope: unchanged.
- Visible text/copy: unchanged.
- Product documentation ownership: no PM-owned PRD or product docs changed.
- Safe optimization execution order: unchanged.
- Optimization compare entry behavior: unchanged.
- Additional explanatory labels/statuses: not introduced.
- Componentization direction: improved by separating optimization workflow coordination from the app entry.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `git diff --check` passed.

## Evidence Boundary

This checkpoint proves implementation structure and automated regression only. It does not claim final UI/UX visual or real-use interaction acceptance.

Foreground macOS desktop-client review remains required for UI/UX acceptance, using native menu bar/titlebar/window chrome and multiple real production SVGA files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.

## Risks

- The app entry still coordinates imageKey rename, image replacement, compare entry, and smoke proof flows; this slice only moves optimization orchestration.
- Real foreground optimization interaction, before/after comparison, and save recovery review remains outstanding for visual/interaction acceptance.

## Next Steps

1. Continue extracting rename and replacement workflow coordination from the app entry.
2. Split smoke proof orchestration after product workflow surfaces are complete.
3. Run foreground macOS review before making any visual or interaction acceptance claim.
