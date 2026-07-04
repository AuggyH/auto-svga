# UI/UX Owner-confirmed Canvas Direction Sync

## Summary

This review records the Owner-confirmed UI/UX direction for the short-term
Auto SVGA desktop client after the static launch, preview, compare, drag,
optimization, and edit-reference sketches.

Owner confirmation status: confirmed by Owner in the UI/UX thread.

This document is a UI/UX synchronization note. It is not a PRD update and does
not directly modify `docs/product/PRODUCT_ROADMAP.md`.

## Owner Reference Sketches

Owner provided local sketch images for the confirmed direction. These images
are production references for review and should not be committed as repository
assets unless the Owner explicitly requests it. Stable local archive:
`/Users/huangtengxin/Documents/Auto_SVGA_References/2026-07-04-owner-canvas-direction/`.

- `/Users/huangtengxin/Documents/Auto_SVGA_References/2026-07-04-owner-canvas-direction/启动页.png`
- `/Users/huangtengxin/Documents/Auto_SVGA_References/2026-07-04-owner-canvas-direction/预览页.png`
- `/Users/huangtengxin/Documents/Auto_SVGA_References/2026-07-04-owner-canvas-direction/预览模式.png`
- `/Users/huangtengxin/Documents/Auto_SVGA_References/2026-07-04-owner-canvas-direction/拖拽对比.png`
- `/Users/huangtengxin/Documents/Auto_SVGA_References/2026-07-04-owner-canvas-direction/拖拽对比_不支持格式.png`
- `/Users/huangtengxin/Documents/Auto_SVGA_References/2026-07-04-owner-canvas-direction/编辑模式.png`
- `/Users/huangtengxin/Documents/Auto_SVGA_References/2026-07-04-owner-canvas-direction/预览模式_对比模式.png`
- `/Users/huangtengxin/Documents/Auto_SVGA_References/2026-07-04-owner-canvas-direction/预览模式_对比模式_空.png`
- `/Users/huangtengxin/Documents/Auto_SVGA_References/2026-07-04-owner-canvas-direction/预览模式_对比模式_拖拽.png`
- `/Users/huangtengxin/Documents/Auto_SVGA_References/2026-07-04-owner-canvas-direction/预览模式_优化对比.png`

## Product-doc Impact To Review With PM

- Launch keeps one immersive canvas surface with central drag/open affordance
  and a low-emphasis recent-file list.
- The launch recent-file trash icon clears all recent records.
- Preview has no visible Open Another File control; opening another file uses
  the macOS menu or drag-and-drop onto the canvas.
- Preview/Edit mode switch sits at the top center of the canvas.
- Dirty state is created only by imageKey key rename. Dirty display appends
  `*` to the filename and enables the right-side Save As button.
- After Save As succeeds, the filename `*` disappears and Save As remains
  visible but disabled until dirty again.
- Compare mode has no persistent main-surface entry. It is entered from the
  macOS menu or from drag-and-drop decision overlays.
- If the compare command is used with no current file, the app enters a
  two-file compare selection state.
- Dragging a supported file over an open preview shows a two-zone overlay:
  Open File and Add As Compare File. The focused half is green.
- Dragging an unsupported file shows the focused region in red with
  `不支持的文件格式`. Dropping it clears the canvas and shows a canvas toast
  with the same text.
- Optimization entry remains in the basic information metrics. Clicking an
  optimization entry replaces the right information surface with optimization
  detail or result comparison.
- Production-spec target thresholds are not shown in the default preview
  surface. They appear only inside optimization detail/result context.
- Optimization result comparison exposes Save As SVGA, Overwrite Save, and
  Abandon Optimization actions. Successful Overwrite Save returns to Preview.
- Compare empty state keeps bottom playback controls visible but disabled.
- Short-term Edit mode may show the left layer list. The right operation panel
  remains a quiet placeholder and must not expose inactive controls.
- The short-term client should support both light and dark appearance. Owner
  sketches are light-mode references, but dark mode must preserve the same
  canvas-first design language instead of reverting to the old Workbench look.
- Theme switching should be available from the macOS menu and a Settings sheet.
  The Settings sheet should expose Follow System, Light, and Dark options only
  unless the PM promotes additional settings.

## Static Direction Screens Added

- `tools/uiux-visual-reset/native-tool-mvp/preview.html`
- `tools/uiux-visual-reset/native-tool-mvp/compare-empty.html`
- `tools/uiux-visual-reset/native-tool-mvp/compare-loaded.html`
- `tools/uiux-visual-reset/native-tool-mvp/drag-compare.html`
- `tools/uiux-visual-reset/native-tool-mvp/drag-invalid.html`
- `tools/uiux-visual-reset/native-tool-mvp/optimization-compare.html`
- `tools/uiux-visual-reset/native-tool-mvp/edit.html`
- `tools/uiux-visual-reset/native-tool-mvp/preview-dark.html`
- `tools/uiux-visual-reset/native-tool-mvp/settings.html`

The static board is intentionally not an app. It has no JavaScript, parsing,
playback, optimization, save, or replacement logic.

## Design-system Notes

- Use the checkerboard canvas as the primary surface.
- Avoid returning to a toolbar-heavy engineering shell.
- Keep visible text traceable to PRD or approved UI/UX docs.
- Prefer icon-only controls for playback, replay, loop, full screen, clear,
  reset, and compact editing actions.
- Use page state and surface replacement instead of permanently displaying all
  feature entries.

## Files Changed In UI/UX Lane

- `DESIGN.md`
- `tools/uiux-visual-reset/native-tool-mvp/README.md`
- `tools/uiux-visual-reset/native-tool-mvp/preview.html`
- `tools/uiux-visual-reset/native-tool-mvp/styles.css`
- `tools/uiux-visual-reset/native-tool-mvp/compare-empty.html`
- `tools/uiux-visual-reset/native-tool-mvp/compare-loaded.html`
- `tools/uiux-visual-reset/native-tool-mvp/drag-compare.html`
- `tools/uiux-visual-reset/native-tool-mvp/drag-invalid.html`
- `tools/uiux-visual-reset/native-tool-mvp/optimization-compare.html`
- `tools/uiux-visual-reset/native-tool-mvp/edit.html`
- `tools/uiux-visual-reset/native-tool-mvp/preview-dark.html`
- `tools/uiux-visual-reset/native-tool-mvp/settings.html`
- `docs/reviews/2026-07-04-codex-uiux-owner-confirmed-canvas-direction-sync.md`

## Verification Needed Before Production Implementation

- PM must review and promote product-behavior changes into the main PRD before
  production client implementation treats them as authoritative.
- Real foreground macOS screenshots remain required for client acceptance.
  Browser/static screenshots only validate the direction board.
- Real production SVGA files from
  `/Users/huangtengxin/Downloads/auto-svga测试物料` should be used when the
  direction is implemented in the short-term client.
