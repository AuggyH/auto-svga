# Short-Term UI/UX Canvas Shell Alignment Review

## Summary

Aligned the short-term desktop client shell with the latest PRD and Owner-confirmed canvas-first design direction. This change removes the old visible toolbar command cluster from the main surface, keeps macOS window chrome lightweight, moves mode switching into the canvas, and moves file identity/save actions into the right information surface.

This is a mainline implementation slice, not a full visual high-fidelity pass. Smoke evidence proves the functional flow still runs, but real foreground desktop screenshots with macOS title/menu chrome and real production SVGA files are still required before visual acceptance.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base HEAD before this slice: `f4125f60 uiux: add canvas direction static board`
- Scope: UI/UX lane only

## Changed Files

- `DESIGN.md`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- PRD authority: `docs/product/PRODUCT_ROADMAP.md`
- Design manifest: `DESIGN.md`
- S1/S10 alignment:
  - Preview surface no longer exposes a visible `打开另一个 SVGA` or persistent compare button.
  - Opening another file remains menu/drag driven.
  - Compare remains menu/state driven, not a persistent main-surface button.
- Owner-confirmed canvas direction:
  - Main titlebar is now `WindowChrome`, a lightweight window region rather than a product toolbar.
  - `CanvasModeSwitch` is located inside the canvas area.
  - Right side is `RightInformationSurface`, with file identity and save actions grouped there.
- Design-system alignment:
  - Updated canonical component names in `DESIGN.md` and the design-system checker.
  - Updated smoke proof from old toolbar focus expectations to new canvas-shell expectations.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `npm run desktop:smoke` passed.
- `git diff --check` passed.

## Risks

- Real foreground desktop visual validation has not been completed in this slice. Smoke screenshots do not include the full Owner-visible macOS usage context and must not be treated as final visual acceptance.
- Compare mode still needs a later layout pass to match the Owner-provided two-canvas plus right comparison-surface direction.
- Preview/Edit right-side content is still mostly existing short-term function surface; this slice only repositions the shell and entry model.

## Next Steps

- Continue mainline UI/UX implementation by applying the Owner-confirmed design language to preview details, information density, and compare layout.
- Before claiming visual acceptance, run real foreground desktop checks using multiple SVGA files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.
