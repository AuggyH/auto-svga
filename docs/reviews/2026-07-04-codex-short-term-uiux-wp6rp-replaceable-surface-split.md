# Short-Term UI/UX WP6RP Replaceable Surface Split Review

## Summary

This UI/UX checkpoint moves short-term imageKey rename and image replacement workflow coordination out of the app entry file and into the existing replaceable surface.

The change is behavior-preserving. It does not alter visible UI, product scope, copy, menu actions, keyboard shortcuts, save-state behavior, rename validation, replacement validation, or playback refresh behavior. The entry file keeps the existing handler names for event bindings and action bridge calls; the replaceable surface now owns the replaceable-resource workflow details.

## Git State

- Base before this slice: `faa62b24 uiux: split short-term optimization surface`
- Working branch: `agent/codex/svga-workbench-v1-autonomous`
- Product/PRD files: not modified

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-surface.mjs`
  - Adds imageKey rename workflow coordination.
  - Adds inline rename confirm/cancel coordination.
  - Adds replacement file selection, apply, and reset workflow coordination.
  - Reuses existing API client, byte helpers, render model, and replaceable rendering state.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Replaces inline rename and replacement workflow implementation with thin calls into the replaceable surface.
  - Removes direct rename/replacement API and render-model ownership from the app entry file.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates structure assertions so rename/replacement workflow and render-model ownership are traced to the replaceable surface.

## Requirement Checks

- Touched PRD IDs: S11, S12, S13 at implementation-structure level.
- Owner-visible product scope: unchanged.
- Visible text/copy: unchanged.
- Product documentation ownership: no PM-owned PRD or product docs changed.
- Rename workflow: unchanged.
- Replacement workflow: unchanged.
- Reset replacement workflow: unchanged.
- Additional explanatory labels/statuses: not introduced.
- Componentization direction: improved by moving replaceable-resource workflow coordination to the replaceable surface.

## Verification

- `git diff --check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `npm run desktop:short-term:design-system-check` passed.

## Evidence Boundary

This checkpoint proves implementation structure and automated regression only. It does not claim final UI/UX visual or real-use interaction acceptance.

Foreground macOS desktop-client review remains required for UI/UX acceptance, using native menu bar/titlebar/window chrome and multiple real production SVGA files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.

## Risks

- The app entry still owns file open/load, general compare orchestration, and smoke proof orchestration.
- Real foreground rename/replacement interaction, focus order, save recovery, and resource-menu review remains outstanding for visual/interaction acceptance.

## Next Steps

1. Split smoke proof orchestration out of the app entry.
2. Audit whether general compare and file-load orchestration should stay as entry-level shell coordination or move into dedicated surfaces.
3. Run foreground macOS review before making any visual or interaction acceptance claim.
