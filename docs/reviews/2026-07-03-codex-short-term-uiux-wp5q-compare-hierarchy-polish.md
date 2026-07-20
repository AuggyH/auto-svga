# Codex Review: Short-Term UI/UX WP5Q Compare Hierarchy Polish

## Summary

Polished the short-term macOS client compare page after foreground review with
real SVGA files. This is a P8 UI/UX pass only: it improves hierarchy,
componentization, and readability for `GeneralCompareModule` and
`OptimizationCompareModule` without changing parsing, optimization, saving, or
recent-file product behavior.

## Product Authority

- Main PRD authority remains `docs/product/PRODUCT_ROADMAP.md`.
- Short-term scope remains S1-S16.
- This work supports S4/S6/S8/S10/S15 compare and inspection presentation.
- No PM-owned PRD/product scope files were modified.
- Mid-term/AE bridge changes being explored by PM were not considered here.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
  - Replaced pseudo-label-only compare canvases with explicit compare preview
    headers containing A/B, display name, and compact metadata.
  - Preserved `data-compare-label` attributes for stable proof/test handles.
  - Added `ComparePreviewCard` component trace and default
    `GeneralCompareModule` trace.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Added `setCompareSlot` and `compareSlotMeta` to keep compare preview card
    titles and metadata synchronized with real A/B files and optimization
    output.
  - Added compare module trace switching between `GeneralCompareModule` and
    `OptimizationCompareModule`.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-render-model.mjs`
  - Rendered compare metrics as compact `FactCell` variants with status and
    requirement context instead of value-only cards.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
  - Added compare-side, compare-header, and compare-metric component tokens.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
  - Updated compare layout to token-backed widths/gaps.
  - Added `ComparePreviewCard` header styling and compact compare metric rows.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updated short-term structure guard to assert the new compare header,
    metric row, and token contracts.

## Foreground Evidence

Real foreground desktop review used:

- `/Users/huangtengxin/Downloads/iOS活动资源/头框-剑翼荣光/155366-剑翼荣光.svga`
- `/Users/huangtengxin/Downloads/中东表情包/中东贵族表情包/微笑.svga`

Evidence screenshots are local ignored artifacts:

- `.artifacts/uiux-foreground-review/06-real-loaded-compare-fullscreen.png`
- `.artifacts/uiux-foreground-review/08-polished-real-loaded-compare-fullscreen.png`

The requested directory `/Users/huangtengxin/Downloads/auto-svga测试物料` was
checked, but it currently contained no `.svga` files.

## Verification

- `git diff --check` passed.
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs` passed.
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-render-model.mjs` passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test` passed, 29/29.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke` passed.
- Foreground Electron client was restarted and manually checked with two real
  SVGA files in compare mode.

Note: an initial parallel validation attempt caused a transient runtime
directory race. The affected test was rerun serially and passed.

## Risks And Follow-Up

- This is still a targeted compare-page polish, not the full formal
  high-fidelity design pass for the whole app.
- The dev Electron menu bar still shows `Electron`; existing source/test
  confirms `app.setName("Auto SVGA")`, so packaged-client foreground review
  should be used before treating this as a product identity bug.
- Next UI/UX pass should address total visual quality in preview/inspector
  density, not only compare mode.
