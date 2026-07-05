# Short-term UI/UX Drag Decision Overlay Review

## Summary

UI/UX lane implemented the owner-confirmed canvas drag decision overlay for the short-term macOS client. The preview and compare canvas surfaces now expose a two-zone drag overlay for supported SVGA files, reject unsupported files with the required red focused state, clear the canvas on unsupported drop, and show a centered canvas toast with `不支持的文件格式`.

This review covers implementation and evidence only. It does not change PRD/product scope.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit target: UI/UX drag decision overlay WP
- Product authority consulted: `docs/product/PRODUCT_ROADMAP.md`, `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`, `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`, `DESIGN.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-nodes.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-drag-decision-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-drag-decision-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-event-bindings.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- S1 canvas open flow remains local-only and path-redacted.
- Supported drag over an opened preview shows the two-zone overlay:
  `打开文件` and `添加为对比文件`.
- Supported drag in the compare half loads the dropped SVGA as compare B.
- Unsupported drag shows focused red rejection copy `不支持的文件格式`.
- Unsupported drop clears the current canvas and shows the centered canvas toast.
- The new overlay/toast use registered components and token-backed CSS.
- Entry assembly remains clean; drag decision logic lives in dedicated model/surface files.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `npm run desktop:smoke` passed.
- `git diff --check` passed.
- Smoke artifact inspected:
  `.artifacts/product/short-term/short-term-open-flow-proof.json`
  confirms `dragDecisionOverlayVisible`, `dragDecisionSupportedState`,
  `dragDecisionCompareFocus`, `dragDecisionOffersOpenAndCompare`,
  `unsupportedDragRejected`, `unsupportedDropClearedCanvas`,
  `unsupportedDropToastVisible`, and recovery all true.

## Risks

- This WP uses smoke evidence for functional regression. It does not replace the required foreground desktop visual review with macOS chrome and real production SVGA files.
- Unsupported file detection currently uses the short-term filename extension boundary. Invalid `.svga` bytes still follow the existing invalid-SVGA failure path.

## Next Steps

- Continue the high-fidelity UI application work from the owner-confirmed canvas-first visual direction.
- Before final visual acceptance, run foreground desktop review with real owner SVGA materials and light/dark modes.
