# Short-Term UI/UX WP6AL Output Surface Split Review

## Summary

This UI/UX checkpoint moves short-term active-output and save-banner state coordination out of the app entry file into a dedicated output surface module.

The change is behavior-preserving. It does not alter visible UI, save labels, save eligibility, save writing, hash validation, reopen validation, product scope, or user-facing copy. The app entry keeps the existing workflow function names, while the new surface owns dirty active-output state, clean/idle transient-output clearing, and save banner dispatch through the existing feedback surface.

## Git State

- Base before this slice: `5d38f689 uiux: split short-term replaceable surface`
- Working branch: `agent/codex/svga-workbench-v1-autonomous`
- Product/PRD files: not modified

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-output-surface.mjs`
  - New output surface module.
  - Owns active-output creation, dirty save state, transient-output clearing, and save banner dispatch.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Replaces inline active-output and transient-output state mutation with calls into the output surface.
  - Keeps `saveActiveOutput`, write/reopen validation, and workflow function names in place.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates structural assertions so output state coordination is no longer allowed to live directly in the app entry file.

## Requirement Checks

- Touched PRD IDs: S10, S11, S12, S14 at implementation-structure level.
- Owner-visible product scope: unchanged.
- Visible text/copy: unchanged.
- Product documentation ownership: no PM-owned PRD or product docs changed.
- Save writing and validation order: unchanged.
- Additional explanatory labels/statuses: not introduced.
- Componentization direction: improved by separating output/save-state coordination from the app entry.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `git diff --check` passed.

## Evidence Boundary

This checkpoint proves implementation structure and automated regression only. It does not claim final UI/UX visual or real-use interaction acceptance.

Foreground macOS desktop-client review remains required for UI/UX acceptance, using native menu bar/titlebar/window chrome and multiple real production SVGA files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.

## Risks

- Save validating, cancelled, and failed states still remain in `saveActiveOutput`; this slice only moved dirty/idle active-output coordination.
- The actual save workflow is intentionally left in place to avoid combining a structural split with persisted-file behavior changes.

## Next Steps

1. Consider a later dedicated save-workflow slice only if it can preserve write/reopen validation order with narrow tests.
2. Continue extracting one clear surface boundary at a time from the app entry.
3. Run foreground macOS review before making any visual or interaction acceptance claim.
