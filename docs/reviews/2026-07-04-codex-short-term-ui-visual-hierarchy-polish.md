# Short-term UI Visual Hierarchy Polish Review

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Refined the short-term macOS client visual layer without changing product
scope, copy, renderer logic, menu logic, save logic, recent-file behavior, or
SVGA processing.

This slice focuses on making the existing right-side information area feel
less like an engineering card stack and more like a restrained local macOS
tool surface:

- reduced heavy panel and selected-row shadows through design tokens;
- softened row, hover, selected, and fact surfaces through semantic tokens;
- converted Overview facts from separate cards into a compact fact matrix;
- kept the owner-requested two-column fact density for paired file facts;
- let the fifth fact item span the matrix width to avoid a misleading empty
  cell;
- updated the short-term UI test assertions so they guard the new fact-matrix
  structure instead of the old fact-card shadow.

## Product And Design Boundary

Consulted:

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `DESIGN.md`

Touched PRD surface:

- S3-S5: Overview file facts, production-spec comparison, and asset summary
  presentation only.

Non-goals retained:

- no new product feature;
- no new owner-visible explanatory copy;
- no new product status or badge;
- no single-column fact rewrite;
- no PM-owned product document change;
- no main-process, save, menu, parser, optimizer, or SVGA byte logic change.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Screenshot Evidence

Automated smoke screenshots refreshed at:

- `.artifacts/product/short-term/short-term-preview-overview.png`
- `.artifacts/product/short-term/short-term-preview-replaceable.png`
- `.artifacts/product/short-term/short-term-preview-optimization.png`
- `.artifacts/product/short-term/short-term-optimization-result.png`
- `.artifacts/product/short-term/short-term-preview-minimum.png`

Important boundary: these screenshots are automated regression evidence only.
They do not include the full foreground macOS menu bar/titlebar context and do
not use multiple real production SVGA files from
`/Users/huangtengxin/Downloads/auto-svga测试物料`. Visual and interaction
acceptance remains unclaimed until foreground desktop validation is completed.

## Verification

Passed:

- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm run desktop:short-term:design-system-check`
- `npm run desktop:smoke`
- `git diff --check`

Observed smoke result:

- `AUTO_SVGA_WEB_EXPERIMENT_SMOKE ... "passed":true`
- `shortTermScreenshots:true`
- `shortTermSpecComparison:true`
- `shortTermDesignInteraction:true`
- `shortTermOptimization:true`
- `shortTermRename:true`
- `shortTermReplacement:true`
- `shortTermMenuState:true`

## Risks And Follow-up

- Current screenshot review was performed against automated Electron smoke
  captures, not foreground macOS screenshots.
- The current system appearance during smoke was dark mode; light-mode visual
  review still needs foreground or controlled appearance evidence before final
  acceptance.
- Further polish should continue in small, traceable slices and avoid adding
  copy, labels, summary blocks, or components outside the PRD and design docs.
