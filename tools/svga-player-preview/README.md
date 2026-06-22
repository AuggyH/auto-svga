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

This page uses the local vendored `pako@2.1.0` and `svgaplayerweb@2.3.1` browser bundles. The SVGA parser loads `.svga` through HTTP, so use the local dev server instead of opening `index.html` through `file://`.

## Preview modes

### 本地预览 / Local Preview

This is the default mode. It shows one large SVGA player, with an on-demand right-side `SVGA 信息 / SVGA Info` panel opened from the toolbar.

To review a generated MVP job directly, pass its repository-relative job path:

```text
http://127.0.0.1:4173/tools/svga-player-preview/?job=jobs/avatar_frame_test_001
```

The page switches to Export Review and loads the job's exported SVGA, `report.json`, and `svga-map.json`. The reference side tries `preview.webm`, then `preview.mp4`, and finally the deprecated `preview.gif` fallback. A video candidate must reach `canplay`; a successful HTTP response alone is not treated as playable. Missing or unsupported auxiliary previews are logged as warnings without blocking SVGA playback.

Use it when you drag or choose a local `.svga` file and want to inspect playback, sizing, parse status, render status, assets, warnings, and logs. The page does not show a default GIF beside the SVGA in this mode, to avoid accidental false comparisons.

The info panel includes:

- file size, estimated memory usage, canvas size, duration, FPS
- layer count, image resource count, sprite/image relationships
- image dimensions and image byte sizes
- production warnings for embedded images larger than 300x300 or with unknown dimensions
- parse status and render status
- avatar-frame production specification status, issues, and calibration notes

When an SVGA is loaded, the page sends its bytes to the local preview server's
inspection endpoint. The server reuses the existing
`AvatarFrameInspectionReportService`; the browser only renders the structured
result and does not duplicate specification rules. A report failure is shown as
a non-blocking warning and does not stop playback.

The current file-size (`512 KiB`) and resource-count (`32`) limits are
provisional recommendations from two unique 300x300 repository outputs. They
remain listed under `待产品校准 / Calibration` until a larger delivery sample
confirms the product thresholds.
- warning badges for oversized or suspicious resources

`SVGA 信息 / SVGA Info` only contains `概览 / Overview` and `资源 / Assets`. The Assets tab merges sprite and image resource views, groups continuous numbered image resources into expandable `序列帧` groups, and uses thumbnail cards instead of plain text rows.

### 导出验收 / Export Review

Use this after exporting an SVGA from the tool. The page switches to a dual preview:

- left: exported SVGA
- right: `参考视频 / Reference Video`

Prefer `.webm` or `.mp4` as the reference video. `.gif` remains accepted as a fallback, but it is not the visual acceptance baseline or an online delivery artifact. The primary review target is always the real `.svga` playback.

The reference `<video>` uses `controls`, `muted`, `playsInline`, `loop`, and `preload=auto`. Source changes call `video.load()`, and both the card controls and synchronized controls operate on the same video element.

This mode provides synchronized play, pause, replay, and a progress slider. SVGA seeking uses `stepToFrame` when the public player exposes it; otherwise replay remains the reliable alignment point.

### Compare 开关

Click `开启对比 / Compare` from the Local Preview card header.

This opens a second local `.svga` card side by side:

- left: SVGA A
- right: SVGA B

Use it to compare different `bakedSweep.frameStride` exports such as stride 1, 2, and 3. The recommended default export setting is `frameStride = 2`, which balances visual smoothness and package size.

Top-level modes remain only:

- `本地预览 / Local Preview`
- `导出验收 / Export Review`

Compare is not a third top-level mode.

## Playback controls

Single-window controls live inside each preview card at the bottom of the canvas. They cover play / pause, replay, progress, time, and loop when applicable.

The top toolbar does not contain ordinary playback controls. In dual-window modes, synchronized controls are shown once in the bottom sync bar:

- `同步播放 / Sync Play`
- `同步暂停 / Sync Pause`
- `同步重播 / Sync Replay`
- synchronized progress slider

This avoids duplicate replay or play buttons across the same page.

File selection buttons belong to their preview cards. Fit mode controls also belong to each preview card, so each side can choose its own contain / original / fit-width behavior.

## Panels

The toolbar has two independent right-side panels:

- `SVGA 信息 / SVGA Info`: Overview and Assets only.
- `运行日志 / Runtime Logs`: copy logs, clear logs, and empty state. Open or close it with the toolbar log button.

Both panels use the same right-side panel style and can be open at the same time. Logs are no longer shown as a separate terminal-style drawer, and Logs are not restored as an info-panel tab.

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
