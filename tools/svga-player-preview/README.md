# SVGA Player Preview

Minimal local Web preview for real SVGA playback validation.

The Web UI uses Chinese as the primary language and keeps English labels / original report keys as debugging references.

Run from the repository root:

```bash
pnpm preview:player
```

Open:

```text
http://localhost:4173/tools/svga-player-preview/
```

This page uses the public `svgaplayerweb@2.3.1` prebuilt browser bundle from jsDelivr. The SVGA parser loads `.svga` through HTTP, so use the local dev server instead of opening `index.html` through `file://`.

## Preview modes

### 本地预览 / Local Preview

This is the default mode. It shows one large SVGA player, with an on-demand right-side `SVGA 信息 / SVGA Info` panel opened from the toolbar.

Use it when you drag or choose a local `.svga` file and want to inspect playback, sizing, parse status, render status, layers, image resources, warnings, and logs. The page does not show a default GIF beside the SVGA in this mode, to avoid accidental false comparisons.

The info panel includes:

- file size, estimated memory usage, canvas size, duration, FPS
- layer count, image resource count, layer names
- image dimensions and image byte sizes
- parse status and render status
- warning badges for oversized or suspicious resources

`图层 / Layers` and `图片资源 / Images` use thumbnail cards instead of plain text rows. Click a row to select it, or click the thumbnail / `查看` button to open a larger checkerboard preview with imageKey, dimensions, and byte size.

### 导出验收 / Export Review

Use this after exporting an SVGA from the tool. The page switches to a dual preview:

- left: exported SVGA
- right: `参考视频 / Reference Video`

Prefer `.mp4` or `.webm` as the reference video. `.gif` is still accepted as a temporary fallback, but `preview.gif` is only for local debugging and is not an online delivery artifact.

This mode provides synchronized play, pause, replay, and a progress slider. SVGA seeking uses `stepToFrame` when the public player exposes it; otherwise replay remains the reliable alignment point.

### 本地对比 / Local Compare

Click `开启对比模式 / Enable Compare` from Local Preview, or choose `本地对比 / Local Compare` from the display mode selector.

This mode compares two local `.svga` files side by side:

- left: SVGA A
- right: SVGA B

Use it to compare different `bakedSweep.frameStride` exports such as stride 1, 2, and 3. The recommended default export setting is `frameStride = 2`, which balances visual smoothness and package size.

## Playback controls

Single-window controls live inside each preview card at the bottom of the canvas. They cover play / pause, replay, progress, time, and loop when applicable.

The top toolbar does not contain ordinary playback controls. In dual-window modes, synchronized controls are shown once in the bottom sync bar:

- `同步播放 / Sync Play`
- `同步暂停 / Sync Pause`
- `同步重播 / Sync Replay`
- synchronized progress slider

This avoids duplicate replay or play buttons across the same page.

## Appearance

The settings dialog supports:

- `跟随系统 / System`
- `浅色 / Light`
- `深色 / Dark`

The choice is stored in `localStorage` and restored after refresh. The page uses shared CSS variables for background, surfaces, text, borders, accent, warning, danger, and checkerboard colors.

Preview background is separate from App appearance. The App can be dark while the preview canvas stays checkerboard, light, dark, or transparent.

## Drag and drop

- Drop `.svga` onto an SVGA player card.
- Drop `.mp4` or `.webm` onto the Reference Video card in Export Review mode.
- Drop `.gif` onto the Reference Video card only as a debugging fallback.
- Drop files onto the top toolbar to route them by extension.

For local files dragged from disk, browsers do not allow the page to automatically read sibling `report.json` from the same directory. The page displays file size plus metadata decoded from the `.svga` itself; report-only fields are available for the built-in example loaded over HTTP.

## Sizing rules

- SVGA display size comes from the file viewBox, not from a fixed square container.
- The tool first tries to read size from the SVGA Web Player `videoItem`, then falls back to inflating and minimally decoding `MovieEntity.params.viewBoxWidth/viewBoxHeight`.
- The visible player box is computed from `aspectRatio = viewBoxWidth / viewBoxHeight`.
- Reference video and GIF fallback use their own natural dimensions and the same contain-style rules.
- If the image looks squeezed, check `viewBoxWidth/viewBoxHeight` first, then inspect CSS `object-fit`, canvas width, and canvas height.

Playback success is not automatically asserted. Use the page for manual visual confirmation.
