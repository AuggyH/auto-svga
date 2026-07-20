# Short-Term UI/UX Compare Surface Alignment Review

## Summary

Updated the short-term client compare surface toward the latest PRD and Owner-confirmed canvas-first direction. General compare now uses a two-column screen structure: two preview canvases on the left and one comparison-focused information surface on the right. The old left/right standalone info-panel pattern is removed from the visible compare layout.

This slice keeps existing compare behavior and smoke coverage intact. It does not claim final visual acceptance because foreground desktop screenshots with real production SVGA files are still required.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base HEAD before this slice: `b6a2202e uiux: align short-term shell with canvas direction`
- Scope: UI/UX lane, compare surface only

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- General compare has no persistent visible main-surface entry.
- Compare visible layout now follows `two preview canvases + one right comparison surface`.
- Right compare surface emphasizes A/B comparison rows instead of two separate standalone file summaries.
- Empty B state still exposes `打开 B 文件` and `退出对比`.
- Existing optimization comparison rendering remains routed through the same right information surface.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `npm run desktop:smoke` passed.
- `git diff --check` passed.

## Risks

- The compare visual style is still an implementation alignment step, not final high-fidelity polish.
- Drag-decision overlays and unsupported drag states are not implemented in this slice.
- Real foreground desktop validation is still pending and must use multiple production SVGA files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.

## Next Steps

- Continue with Preview right information surface polish and optimization-detail replacement behavior.
- Later validate compare layout in the foreground desktop client with real SVGA samples and macOS window/menu chrome visible.
