# Short-term UI/UX Compare Empty Polish

Date: 2026-07-05
Agent: Codex
Lane: UI/UX
Status: evidence-ready for this UI/UX slice; not Product Owner acceptance

## Summary

This slice aligns the short-term general compare surface with the current PRD
and Owner-confirmed canvas direction:

- The macOS menu compare command can enter compare mode even when no file is
  open.
- General compare empty state shows two canvas slots, each with its own
  low-scope `打开文件` action.
- Compare empty and half-empty states keep bottom playback controls visible but
  disabled.
- The right compare surface keeps `退出对比` in the compare header and removes
  the separate `打开 B 文件` right-panel action.
- The A/B file panel emphasizes pair facts instead of two independent reports.
- `CompareCanvasSurface` is registered in `DESIGN.md` and the design-system
  checker so the new surface is traceable to the canonical component list.

## Product Authority

- Main PRD: `docs/product/PRODUCT_ROADMAP.md`
- UI/UX input: `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- Design manifest: `DESIGN.md`

Relevant PRD/brief requirements:

- General compare may be entered from the macOS menu with no currently opened
  file.
- General compare empty keeps playback controls visible but disabled.
- Loaded compare uses two canvases and one right comparison panel focused on
  A/B information.
- Preview mode still has no visible `Open Another File` button; the new open
  buttons are limited to compare canvas slots.

## Changed Files

- `DESIGN.md`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-command-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-event-bindings.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Verification

Automated checks:

- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`
  - Result: passed
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Result: passed, 31/31
- `git diff --check`
  - Result: passed
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - Result: passed

Foreground UI/UX evidence:

- `review/uiux-high-fidelity-packages/foreground-hf14-evidence-20260705/02-dev-compare-empty-dark-fullscreen.png`
- `review/uiux-high-fidelity-packages/foreground-hf14-evidence-20260705/08-dev-compare-a-loaded-dark-warwolf-active-electron-final-fullscreen.png`

Foreground evidence was captured from the real Electron desktop client with
native macOS window chrome and menu bar. Smoke screenshots remain regression
evidence only; they are not used as the sole UI/UX judgment source.

Real material used:

- `/Users/huangtengxin/Downloads/auto-svga测试物料/头像框/战狼头像框/战狼头像框.svga`

## Package

The owner-facing package is generated after the final commit to avoid
self-referential review-document/package hash drift. It lives in the ignored
local package directory:

- `review/uiux-high-fidelity-packages/`

Package commands used:

- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:proof:mac`

The final handoff should cite the exact package path and SHA-256 from the
latest generated zip. Keep only the three newest `Auto-SVGA-macOS-uiux-*.zip`
files in that directory.

## Risks And Notes

- The foreground proof for this slice covers compare empty and A-loaded
  half-empty compare using real production material. A full A/B real-material
  foreground capture should be included in a later compare-focused validation
  pass.
- In this run, the macOS open panel reached a second real SVGA file but did not
  enable the Open button from the foreground path selection state. This was not
  treated as a product-code issue because the same dialog path opened the first
  real SVGA and automated smoke still covers the compare flow; it should be
  rechecked in a later real-asset validation pass.
- This slice does not implement active synchronized playback controls for loaded
  compare. The explicit PRD point addressed here is that empty compare controls
  remain visible but disabled.

## Next UI/UX Work

- Continue the high-fidelity mainline on Preview default and optimization
  surfaces using the same canvas-first, boundary-light design language.
- Capture a later foreground A/B compare proof with two real production SVGA
  files once the next compare validation pass is scheduled.
