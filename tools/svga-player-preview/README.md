# SVGA Player Preview

Minimal local Web preview for comparing:

- `examples/avatar_frame_basic/output/preview.gif`
- `examples/avatar_frame_basic/output/avatar_frame_basic.svga`

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

By default, the page opens in `SVGA vs GIF` mode and loads the example SVGA and example GIF together. To test another file, drag it into the matching preview panel:

- left `SVGA 播放器 / SVGA Player`: drop a local `.svga` file
- right `GIF 预览 / GIF Preview`: drop a local `.gif` file

The top file controls are still available:

- `SVGA 文件 / SVGA file`: choose a local `.svga` file
- `GIF 预览 / GIF preview`: choose a local `.gif` file
- `显示模式 / Display mode`: choose `SVGA vs GIF` or `SVGA A/B`
- `尺寸模式 / Fit mode`: choose `Fit contain`, `Original size`, or `Fit width`

You can also drop a file on the top controls area; `.svga` and `.gif` files are routed by extension.

When a custom local `.svga` file is loaded, the GIF preview is cleared automatically. This avoids accidentally comparing an uploaded SVGA against the default example GIF. Drop or choose a matching `.gif` afterward if you want a side-by-side comparison.

## Comparing frameStride exports

Switch `显示模式 / Display mode` to `SVGA A/B` to compare two `.svga` exports side by side:

1. Drag a stride 1 export into `SVGA 播放器 A / SVGA Player A`.
2. Drag a stride 2 or stride 3 export into `SVGA 播放器 B / SVGA Player B`.
3. Click `同步重播 / Sync Replay` to restart both animations at the same time.
4. Compare sweep smoothness, file size, image count, sprite count, `bakedSweepFrameStride`, and sampled frame count.

The recommended default export setting is `frameStride = 2`, which balances visual smoothness and package size. Use `frameStride = 1` for the highest quality and largest file size. Use `frameStride = 3` for smaller files when slight stepping in the sweep is acceptable.

For the built-in example loaded over HTTP, the page reads `report.json` automatically. For a single local `.svga` file dragged from disk, browsers do not allow the page to automatically read sibling files from the same directory. In that case, the page displays file size plus metadata decoded from the `.svga` itself, and report-only fields remain `n/a`.

Sizing rules:

- SVGA display size comes from the file viewBox, not from a fixed square container.
- The tool first tries to read size from the SVGA Web Player `videoItem`, then falls back to inflating and minimally decoding `MovieEntity.params.viewBoxWidth/viewBoxHeight`.
- The visible player box is computed from `aspectRatio = viewBoxWidth / viewBoxHeight`.
- `preview.gif` uses its own natural image dimensions and the same contain-style rules.
- If the image looks squeezed, check `viewBoxWidth/viewBoxHeight` first, then inspect CSS `object-fit`, canvas width, and canvas height.

Playback success is not automatically asserted. Use the page for manual visual confirmation against `preview.gif`.
