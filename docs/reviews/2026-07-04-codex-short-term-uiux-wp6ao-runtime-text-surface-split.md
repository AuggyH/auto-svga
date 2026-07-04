# Short-Term UI/UX WP6AO Runtime Text Surface Split Review

## Summary

This UI/UX checkpoint moves short-term runtime text preview coordination out of the app entry file into a dedicated runtime text surface module.

The change is behavior-preserving. It does not alter visible UI, runtime text copy, modal behavior, source-byte immutability, reset behavior, product scope, or user-facing labels. The app entry keeps the existing handler names for click events, shortcuts, action bridge calls, and smoke flows; the new surface owns opening the text preview sheet, applying runtime overlay preview, and resetting the runtime text preview state.

## Git State

- Base before this slice: `058f016e uiux: split short-term save surface`
- Working branch: `agent/codex/svga-workbench-v1-autonomous`
- Product/PRD files: not modified

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-runtime-text-surface.mjs`
  - New runtime text surface module.
  - Owns text preview sheet orchestration.
  - Owns runtime text overlay apply/reset coordination.
  - Reuses existing text model and text renderer helpers.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Replaces inline runtime text preview state mutation with calls into the runtime text surface.
  - Keeps existing action names and handler wiring unchanged.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates structural assertions so runtime text overlay and dialog orchestration are owned by the runtime text surface, not the app entry file.

## Requirement Checks

- Touched PRD IDs: S13 at implementation-structure level.
- Owner-visible product scope: unchanged.
- Visible text/copy: unchanged.
- Product documentation ownership: no PM-owned PRD or product docs changed.
- Runtime text source-byte immutability: unchanged.
- Text preview sheet focus behavior: unchanged.
- Additional explanatory labels/statuses: not introduced.
- Componentization direction: improved by separating runtime text preview coordination from the app entry.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `git diff --check` passed.

## Evidence Boundary

This checkpoint proves implementation structure and automated regression only. It does not claim final UI/UX visual or real-use interaction acceptance.

Foreground macOS desktop-client review remains required for UI/UX acceptance, using native menu bar/titlebar/window chrome and multiple real production SVGA files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.

## Risks

- The app entry still coordinates imageKey rename, image replacement, optimization, compare, and smoke proof flows; this slice only moves runtime text preview orchestration.
- Real foreground text-preview modal, keyboard focus, reset, and playback interaction review remains outstanding for visual/interaction acceptance.

## Next Steps

1. Continue extracting one clear surface boundary at a time from the app entry.
2. Consider a later rename or replacement workflow slice only if it can preserve command/menu/smoke behavior with focused verification.
3. Run foreground macOS review before making any visual or interaction acceptance claim.
