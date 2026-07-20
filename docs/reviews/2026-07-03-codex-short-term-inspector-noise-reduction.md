# 2026-07-03 Codex Short-term Inspector Noise Reduction

## Summary

Reduced short-term macOS Preview inspector noise without changing product scope or backend evidence:

- Overview now renders only the five short-term PRD basic facts: file size, estimated memory, canvas, FPS, and asset count.
- Duration remains visible in the playback bar instead of competing with Overview facts.
- Overview fact styling changed from card stack to compact inspector rows.
- Optimization findings now group identical repeated items and show the count, avoiding long duplicate report lists.

## Git State

Branch: `agent/codex/svga-workbench-v1-autonomous`

Unrelated PM/UIUX documentation changes were present before this work and were not staged.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- S3/S4: Overview keeps actual value plus production requirement/status for the five short-term facts.
- S5/S6: Asset list remains in Overview with thumbnails and grouped resource rows.
- S8: Optimization candidates remain visible but duplicate review-only findings are grouped.
- Out-of-scope surfaces: no export acceptance, sequence repair, batch replacement, AI/cloud/account, or advanced editing surfaces were added.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` — 29/29 passed
- `git diff --check -- tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs tools/electron-prototype/experiments/svga-web/web/short-term-macos.css tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p2:normal-proof`
- `npm run desktop:short-term:acceptance-matrix` — `13 pass / 2 partial / 1 blocked`, release candidate still false due existing non-UI gaps

## Risks

- This is a display-layer cleanup. It does not resolve the existing S2 playback-failure-specific proof, S11 matte-key closure proof, or S13 parser/product-model blocker.
