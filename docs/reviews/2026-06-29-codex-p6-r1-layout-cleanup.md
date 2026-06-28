# P6-R1 Layout Single-Source Cleanup

## Summary

Removed duplicated workbench layout logic so `src/layout/layoutEngine.ts` is the single source of truth for layout mode, panel sizes, and collapse state.

## Git State

- Implementation commit: `8c44a593b1be2899b2f350670bc34da3ce95e376`
- Implementation tree: `08dbe6486e22bfce315f56956124032b6a4bd93f`
- Branch: `agent/codex/p6-r1-contract-r3`

## Changed Files

- Removed duplicate layout helpers: `src/layout/breakpoints.ts`, `src/layout/index.ts`, `src/layout/layoutTokens.ts`, `src/layout/regionRules.ts`, `src/layout/useLayoutEngine.ts`, `tools/shared/product-frontend/workbench-layout-engine.mjs`
- Added `src/layout/layoutAdapter.ts`
- Updated `src/layout/layoutEngine.ts`, `src/layout/layoutTypes.ts`
- Updated product frontend wiring and CSS under `tools/shared/product-frontend/`
- Updated layout contract docs/config and targeted layout/source checks

## Verification

- `npm run build` — PASS
- `node --test dist/tests/layout-engine.test.js` — PASS, 8/8
- `node --test tools/shared/product-frontend/source-sharing.test.mjs` — PASS, 7/7
- `node tools/p6/visual-system-audit.mjs --source-only` — PASS
- `node --check tools/shared/product-frontend/product-app.mjs && node --check tools/p6/visual-system-audit.mjs && node --check dist/layout/layoutEngine.js && node --check dist/layout/layoutAdapter.js` — PASS
- `npm test` — PASS, 226/226
- `git diff --check` — PASS
- Local preview static smoke using existing `127.0.0.1:4173` service — PASS

## Boundaries

- No dependencies or lockfiles changed.
- No exporter, CLI default flow, import, drag-drop, comparison, packaging, Electron runtime, or Phase 2 changes.
- No AI, external model, multimodal, telemetry, or network analysis service used.

## Visible Review Material

- `review/P6-R1-layout-cleanup-8c44a59/`
- `review/P6-R1-layout-cleanup-8c44a59/REVIEW_PACKET.md`
- `review/P6-R1-layout-cleanup-8c44a59/P6-R1-layout-cleanup-8c44a59-review-upload.zip`

## Risks

- CSS width/height breakpoint blocks were removed to avoid a second layout system. The remaining legacy viewport waits in `tools/p6/p6-web-baseline-capture.cjs` are capture readiness checks, not product layout decisions.
