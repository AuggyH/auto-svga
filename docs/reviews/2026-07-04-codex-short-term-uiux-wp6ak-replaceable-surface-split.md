# Short-Term UI/UX WP6AK Replaceable Surface Split Review

## Summary

This UI/UX checkpoint moves replaceable-element selection and list rendering coordination out of the short-term app entry file into a dedicated replaceable surface module.

The change is behavior-preserving. It does not alter visible UI, copy, product scope, replacement behavior, imageKey rename behavior, runtime text modal behavior, or save/output behavior. The app entry keeps the same workflow function names, while the new surface owns replaceable image list rendering, runtime text list rendering, image row selection state, runtime text selection, and related action enablement.

## Git State

- Base before this slice: `16c216c8 uiux: split short-term navigation surface`
- Working branch: `agent/codex/svga-workbench-v1-autonomous`
- Product/PRD files: not modified

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-surface.mjs`
  - New replaceable surface module.
  - Owns replaceable image list view/render coordination.
  - Owns runtime text list view/render coordination and text action enablement.
  - Owns image/text selection state updates for the Preview replaceable surface.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Replaces inline replaceable/text list coordination with calls into the new surface module.
  - Keeps existing workflow function names stable for rename, replacement, runtime text, event binding, and smoke flows.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates structural assertions so replaceable model/rendering coordination is no longer allowed to live in the app entry file.

## Requirement Checks

- Touched PRD IDs: S7, S11, S12, S13 only at implementation-structure level.
- Owner-visible product scope: unchanged.
- Visible text/copy: unchanged.
- Product documentation ownership: no PM-owned PRD or product docs changed.
- Historical Web Preview / Workbench visual baseline: not used.
- Byte-producing workflows: not moved or changed in this slice.
- Additional explanatory labels/statuses: not introduced.
- Componentization direction: improved by separating Preview replaceable surface coordination from the app entry.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `git diff --check` passed.

## Evidence Boundary

This checkpoint proves implementation structure and automated regression only. It does not claim final UI/UX visual or real-use interaction acceptance.

Foreground macOS desktop-client review remains required for UI/UX acceptance, using native menu bar/titlebar/window chrome and multiple real production SVGA files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.

## Risks

- Replaceable selection behavior is still covered primarily by structural assertions and existing smoke-oriented flows, not by foreground desktop keyboard/mouse evidence in this slice.
- Rename, image replacement, runtime text modal, and save workflows still remain in the app entry; they should be extracted only as separate behavior-preserving slices with focused verification.

## Next Steps

1. Continue reducing the app entry by extracting one workflow boundary at a time.
2. Prefer the next slice around either file lifecycle/loading or persisted output/save state, but keep each slice small enough to validate.
3. Preserve the rule that no new visible copy, product capability, or product-doc edit is introduced without Owner/PM confirmation.
