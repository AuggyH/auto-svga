# Short-Term UI/UX WP6AJ Navigation Surface Split Review

## Summary

This UI/UX checkpoint moves short-term tab/navigation interaction behavior out of the app entry file and into a dedicated navigation surface module.

The change is behavior-preserving. It does not alter visible UI, copy, product scope, tab labels, app modes, or menu actions. The app entry keeps the existing handler names used by event binding and the internal action bridge, while the new surface owns tab selection state, tab keyboard navigation, and bridge-triggered tab opening behavior.

## Git State

- Base before this slice: `a4818ca8 uiux: split short-term resource menu surface`
- Working branch: `agent/codex/svga-workbench-v1-autonomous`
- Product/PRD files: not modified

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-navigation-surface.mjs`
  - New navigation surface module.
  - Owns tab state application, tablist keyboard movement, and action-bridge tab opening rules.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Replaces inline tab/navigation logic with calls into the new surface module.
  - Keeps existing `setTab`, `handleTabListKeydown`, and `openTab` handler names stable.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates structural assertions so tab interaction rules live in the navigation surface rather than the entry file.

## Requirement Checks

- Owner-visible product scope: unchanged.
- Visible text/copy: unchanged.
- Product documentation ownership: no PM-owned PRD or product docs changed.
- Historical Web Preview / Workbench visual baseline: not used.
- Additional explanatory labels/statuses: not introduced.
- Componentization direction: improved by reducing direct interaction ownership in the entry file.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `git diff --check` passed.

## Evidence Boundary

This review only covers code-structure and regression checks. It does not claim final visual quality or real-use interaction acceptance.

Foreground macOS desktop-client review remains required for UI/UX acceptance, using native titlebar/menu bar/window chrome and multiple real production SVGA files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.

## Risks

- Navigation behavior remains tested through structural assertions and existing smoke-oriented checks, but this slice did not collect real foreground keyboard-navigation evidence.
- The app entry still owns several larger workflow areas; future slices should continue extracting them only when the behavior boundary is clear.

## Next Steps

1. Continue with behavior-preserving surface extraction for selection/replaceable or file-loading workflows.
2. Avoid adding any new visible UI copy or product capability without Owner confirmation and product-doc update.
3. Rebuild the internal macOS trial package after this slice is committed so the shared package is bound to the latest HEAD.
