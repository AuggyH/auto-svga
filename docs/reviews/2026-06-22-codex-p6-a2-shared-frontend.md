# P6 A2 Shared Frontend

## Summary

- Moved Web preview product app, report presentation, and core styles into `tools/shared/product-frontend/`.
- Kept `tools/svga-player-preview/` as thin compatibility entries so existing Web URLs and HTML stay stable.
- Added `WebHostAdapter` boundary for fetch, object URLs, storage, and host capability flags.
- Updated Electron prototype runtime preparation to copy the complete shared frontend directory.

## Git State

- Branch: `agent/codex/p6-a2-shared-frontend`
- Base commit: `66e6b5848dabaffcf89f78385cd5c90fc5a69ba2`
- Head commit: pending until this review is committed

## Changed Files

- `tools/shared/product-frontend/product-app.mjs`
- `tools/shared/product-frontend/inspection-report-view.mjs`
- `tools/shared/product-frontend/product-styles.css`
- `tools/shared/product-frontend/web-host-adapter.mjs`
- `tools/shared/product-frontend/source-sharing.test.mjs`
- `tools/svga-player-preview/main.js`
- `tools/svga-player-preview/inspection-report-view.mjs`
- `tools/svga-player-preview/styles.css`
- `tools/electron-prototype/scripts/prepare-runtime.mjs`
- `src/tests/mvp-planner.test.ts`

## Requirement Checks

- Web behavior preserved through thin entry files and existing HTML paths.
- Shared product source established for product app, report view, and styles.
- Host-specific behavior moved behind the Web host adapter.
- P3-P5 editor incubation remains outside the default Web product surface.
- Protected coordinator files and root `package.json` were not edited.

## Verification

- `npm run build && node --test tools/shared/product-frontend/source-sharing.test.mjs tools/svga-player-preview/*.test.mjs` passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test` passed.
- `npm test` passed, 200 tests.
- `git diff --check` passed.

## Risks

- This is a shared source migration, not the final Electron product page switch.
- A3/A5 may conflict in Electron prototype files during integration.

## Requested Integration Changes

- Cherry-pick A2 before A3/A4/A5.
- Keep any future root script additions coordinator-owned.
