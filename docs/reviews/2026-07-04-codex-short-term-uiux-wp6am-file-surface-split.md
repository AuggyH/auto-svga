# Short-Term UI/UX WP6AM File Surface Split Review

## Summary

This UI/UX checkpoint moves short-term file lifecycle state coordination out of the app entry file into a dedicated file surface module.

The change is behavior-preserving. It does not alter visible UI, file-open behavior, recent-file behavior, drag/drop behavior, parse/playback recovery, product scope, or user-facing copy. The app entry keeps the existing workflow function names, while the new surface owns recent-file loading feedback, source-load preparation, current-file clearing, and launch-surface reset after closing a file.

## Git State

- Base before this slice: `4ede44dd uiux: split short-term output surface`
- Working branch: `agent/codex/svga-workbench-v1-autonomous`
- Product/PRD files: not modified

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-file-surface.mjs`
  - New file surface module.
  - Owns recent-file loading feedback.
  - Owns source-load state preparation and runtime text overlay clearing.
  - Owns current-file clearing and closing back to the launch surface.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Replaces inline file lifecycle state mutation with calls into the file surface.
  - Keeps inspection, playback mounting, recent-file host calls, and smoke workflow names in place.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates structural assertions so file lifecycle state coordination is no longer allowed to live directly in the app entry file.

## Requirement Checks

- Touched PRD IDs: S1, S2, S16 at implementation-structure level.
- Owner-visible product scope: unchanged.
- Visible text/copy: unchanged.
- Product documentation ownership: no PM-owned PRD or product docs changed.
- File opening and recent-file host behavior: unchanged.
- Inspection and playback mounting order: unchanged.
- Additional explanatory labels/statuses: not introduced.
- Componentization direction: improved by separating file lifecycle coordination from the app entry.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `git diff --check` passed.

## Evidence Boundary

This checkpoint proves implementation structure and automated regression only. It does not claim final UI/UX visual or real-use interaction acceptance.

Foreground macOS desktop-client review remains required for UI/UX acceptance, using native menu bar/titlebar/window chrome and multiple real production SVGA files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.

## Risks

- The actual host open/recent calls and parse/playback recovery still remain in the app entry; this slice only moved state preparation and launch reset.
- Real foreground drag/drop, recent-file missing, and launch recovery review remains outstanding for visual/interaction acceptance.

## Next Steps

1. Continue extracting one clear surface boundary at a time from the app entry.
2. Consider a later open/recent workflow slice only if it can preserve host-call and recovery order with focused verification.
3. Run foreground macOS review before making any visual or interaction acceptance claim.
