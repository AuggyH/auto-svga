# Short-Term UI/UX WP6AI Resource Menu Surface Split Review

## Summary

This UI/UX implementation checkpoint continues the short-term macOS client design-system landing work by moving the resource context menu interaction surface out of the monolithic app entry file and into a dedicated surface module.

The change does not alter product scope, visible copy, menu labels, or resource actions. It keeps the existing resource menu behavior while making the implementation boundary closer to the documented `token -> atom -> molecule -> component -> module -> page state` direction: the app entry remains orchestration, the resource menu model owns placement data, renderers own DOM mutation, and the new surface owns menu open/close/focus interaction wiring.

## Git State

- Base before this slice: `1184161a uiux: split short-term compare surface`
- Working branch: `agent/codex/svga-workbench-v1-autonomous`
- Product/PRD files: not modified

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-resource-menu-surface.mjs`
  - New resource-menu surface module.
  - Owns mouse open, keyboard open, close with focus restoration, and menu keyboard navigation.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Replaces inline resource menu implementation with calls into the new surface module.
  - Keeps existing app-level handler names stable for event binding.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates implementation-boundary assertions so the entry file is not allowed to own resource menu model/rendering details directly.

## Requirement Checks

- Owner-visible product scope: unchanged.
- Visible text/copy: unchanged.
- Product documentation ownership: no PM-owned PRD or product docs changed.
- Historical Web Preview / Workbench visual baseline: not used.
- "Inspector" framing: not introduced.
- Existing file fact density and approved layout choices: untouched.
- Componentization direction: improved by separating a focused resource menu surface from the app entry.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `git diff --check` passed.

## Evidence Boundary

This checkpoint only proves that the code boundary and regression checks still pass. It does not claim final UI/UX visual acceptance.

Per current UI/UX review rules, real visual and interaction acceptance still requires foreground macOS desktop-client capture with native menu bar/titlebar/window chrome and multiple real SVGA files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.

## Risks

- Resource menu behavior is covered by implementation assertions and existing smoke-oriented flows, but not yet by a foreground desktop interaction pass in this slice.
- The broader short-term app still has large orchestration areas in `short-term-macos-app.mjs`; further slices should continue extracting state-specific surfaces without changing visible product behavior.

## Next Steps

1. Continue splitting the app entry around tab/navigation, selection, and file-load surfaces.
2. Keep each slice behavior-preserving, with no added visible labels or product capabilities.
3. After enough structure lands, run a real foreground macOS review using varied production SVGA samples before making any visual-quality claim.
