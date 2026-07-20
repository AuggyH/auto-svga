# Short-Term UI/UX WP6I Recent Files Model Split Review

## Summary

Moved the launch recent-files list rendering and five-row filtering into a dedicated short-term recent-files model module.

This is a structural UI/UX implementation slice for S16. It keeps the existing recent-file copy, limit, actions, and host flow unchanged.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit target: UI/UX-only S16 module split

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-recent-files-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`; no PM-owned PRD document was modified.
- Scope touched: S16 recent SVGA files.
- Page state touched: Launch.
- Module/component touched: `LaunchModule` and `LaunchRecentFilesList`.
- The launch page still shows up to five recent records, keeps recent rows secondary, preserves path-redacted display copy, and keeps clear-history behavior wired through the host.
- No new product feature, visible information block, state, label, or explanatory copy was added.
- The app entry now delegates recent-list filtering and rendering to a reusable module boundary instead of assembling recent rows inline.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-recent-files-model.mjs`
- Keyword guard for previously rejected extra summary/inspection wording
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Result: all checks passed.

## Risks

- This split improves implementation boundaries, but recent-file host persistence and missing-file proof still live in the existing host/smoke layers.
- Visual polish for the launch recent list is intentionally unchanged in this slice.

## Next Steps

- Continue extracting remaining short-term page modules from `short-term-macos-app.mjs`.
- Keep each follow-up slice bound to S1-S16 and avoid adding product-facing copy outside the PRD.
