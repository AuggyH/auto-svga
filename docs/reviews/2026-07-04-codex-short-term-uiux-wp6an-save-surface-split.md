# Short-Term UI/UX WP6AN Save Surface Split Review

## Summary

This UI/UX checkpoint moves short-term S14 save workflow coordination out of the app entry file into a dedicated save surface module.

The change is behavior-preserving. It does not alter visible UI, save button state, Overwrite Save, Save As, save proof generation, save failure recovery, product scope, or user-facing copy. The app entry keeps the existing handler names for menus, shortcuts, action bridge calls, and smoke flows; the new surface owns save-output validation orchestration, save proof output generation, save failure proof output creation, and post-save source-state refresh.

## Git State

- Base before this slice: `3315acab uiux: split short-term file surface`
- Working branch: `agent/codex/svga-workbench-v1-autonomous`
- Product/PRD files: not modified

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-save-surface.mjs`
  - New save surface module.
  - Owns S14 save-output validation coordination.
  - Owns save proof output generation through the existing imageKey rename workflow.
  - Owns save failure proof output creation.
  - Keeps saved-output reopen inspection before promoting bytes to current source state.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Replaces inline save workflow state mutation with calls into the save surface.
  - Keeps existing action names and handler wiring unchanged.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates structural assertions so save model helpers and host save calls are owned by the save surface, not the app entry file.

## Requirement Checks

- Touched PRD IDs: S14 at implementation-structure level.
- Owner-visible product scope: unchanged.
- Visible text/copy: unchanged.
- Product documentation ownership: no PM-owned PRD or product docs changed.
- Save As and Overwrite Save entry points: unchanged.
- Save output validation order: preserved; output bytes are reopened/inspected before becoming current source bytes.
- Additional explanatory labels/statuses: not introduced.
- Componentization direction: improved by separating save workflow coordination from the app entry.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `git diff --check` passed.

## Evidence Boundary

This checkpoint proves implementation structure and automated regression only. It does not claim final UI/UX visual or real-use interaction acceptance.

Foreground macOS desktop-client review remains required for UI/UX acceptance, using native menu bar/titlebar/window chrome and multiple real production SVGA files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.

## Risks

- The app entry still coordinates rename, replacement, runtime text, and smoke proof flows; this slice only moves save-specific orchestration.
- Real foreground Save As, overwrite eligibility, cancel, and save-failure recovery review remains outstanding for visual/interaction acceptance.

## Next Steps

1. Continue extracting one clear surface boundary at a time from the app entry.
2. Consider a later workflow slice for runtime text or rename only if it can preserve command/menu/smoke behavior with focused verification.
3. Run foreground macOS review before making any visual or interaction acceptance claim.
