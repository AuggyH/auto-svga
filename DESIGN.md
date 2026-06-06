---
version: 0.1.0
name: auto-svga design system
description: Design guidance for auto-svga product surfaces, especially playback validation tools.
language:
  primary: zh-CN
  secondary: en
product_type: creator_tool
visual_tone:
  - precise
  - calm
  - technical
  - premium
colors:
  canvas: "#F4F5FB"
  surface: "rgba(255,255,255,0.76)"
  surface_strong: "#FFFFFF"
  text_primary: "#1C1C1E"
  text_secondary: "#8E8E93"
  text_muted: "#AEAEB2"
  action: "#007AFF"
  success: "#34C759"
  warning: "#FF9500"
  danger: "#FF3B30"
  compare_b: "#5856D6"
typography:
  family: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  code_family: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  page_title: "17-20px / 700"
  panel_title: "13-15px / 600"
  body: "12-14px / 400-500"
  meta: "10-11px / 400-600"
shape:
  panel_radius: 20
  control_radius: 10
  badge_radius: 6
spacing:
  page_margin: 16
  panel_gap: 14
  panel_padding: 14
components:
  - toolbar
  - preview_card
  - info_side_panel
  - sync_bar
  - report_grid
---

# auto-svga Design.md

`DESIGN.md` describes what auto-svga should feel like and how product surfaces should be assembled. `AGENTS.md` explains engineering priorities; this file explains the visual and interaction rules that should guide UI work.

The current product is a technical creator tool for validating generated SVGA animations. It should feel calm, exact, and trustworthy. Avoid marketing-page drama. The user is usually checking whether a generated animation is correct, so the interface must help them inspect playback, timing, resources, and warnings without decorative noise.

## Product Surfaces

Current primary surfaces:

- CLI and generated reports
- `tools/svga-player-preview` playback validation UI
- future product website or Figma-derived mockups

The preview validation UI is the reference surface for near-term product design. Future UI should reuse its mental model unless a new workflow clearly needs something different.

## Core Principles

Prefer inspection over presentation. The main canvas should make the SVGA easy to judge, not make the page itself visually loud.

Default to the user's actual task. Local preview should show one large SVGA by default. Side-by-side comparison is a mode, not the default for every scenario.

Keep Chinese primary and English traceable. User-facing labels should put Chinese first, while English labels and original report keys remain visible for debugging.

Treat playback truth as higher priority than generated previews. GIF preview can help local debugging, but real SVGA playback and report data should be visually privileged.

Never imply success before it is proven. If visual playback cannot be automatically judged, the UI should clearly show that manual review is required.

Use one interaction color. Action blue (`#0066cc`) is reserved for primary
actions, selection, focus, and links. Success, warning, and danger colors are
status semantics, not alternate brand colors.

Separate visual size from hit area. Toolbar icons may remain visually compact
(32-36px controls with 15-18px icons) while their practical hit area is
expanded without globally forcing every button to 44px.

## App Modes

### 本地预览 / Local Preview

Default mode. Show one large SVGA playback window. `Compare` is a stable switch inside Local Preview, not a separate top-level mode.

Use this mode when the user drags or chooses a local `.svga` file. The goal is to inspect the file, not compare it against a potentially unrelated asset.

Do:

- Give the SVGA player the largest area on screen.
- Keep the transparent checkerboard behind the canvas.
- Show `SVGA 信息 / SVGA Info` with tabs for overview and assets.
- Show `运行日志 / Runtime Logs` as a separate right-side panel.
- Keep lists scrollable inside the panel.

Do not:

- Show a default GIF beside a custom local SVGA.
- Force every local file into a side-by-side comparison.
- Hide parse or render warnings behind a decorative state.

### 导出验收 / Export Review

Dual-window validation mode after export.

Left side shows the exported SVGA. Right side shows a reference video, preferably MP4 or WebM. GIF may remain as a local debugging fallback, but should not be presented as the normal delivery reference.

Required controls:

- synchronous play
- synchronous pause
- synchronous replay
- progress alignment where the available player APIs allow it

The right panel should be named `参考视频 / Reference Video` or `对比预览 / Comparison Preview`, not `GIF Preview`.

### Compare 开关

Local Compare is a Compare switch inside Local Preview. It opens SVGA B beside SVGA A for comparing two `.svga` files, such as different `bakedSweep.frameStride` exports.

Do not expose Local Compare as a third top-level mode.

## Layout

Use a workbench layout, not a landing page.

The default preview page should use:

- a compact top toolbar
- a large central preview area
- right-side information and logs panels that can coexist
- a bottom sync bar only in comparison modes
- a report section below the primary work area

Panels may use a light translucent surface with subtle blur and soft shadow. This should feel like an application shell, not stacked marketing cards.

Avoid nested cards. A preview card can contain the canvas and quick metrics, but do not place decorative cards inside it.

Use an 8px-derived spacing system: 4, 8, 12, 16, 24, and 32px. Responsive
layouts must remain vertically scrollable. Never combine fixed viewport
heights and hidden overflow in a way that makes wrapped previews, sync
controls, or reports unreachable.

## Preview Cards

Preview cards should have:

- compact header with badge, bilingual title, and status pill
- large stage area with checkerboard background
- centered media frame that preserves aspect ratio
- concise drag hint near the bottom edge
- quick metrics below the stage

The media frame must never stretch the SVGA, reference video, or GIF out of its natural aspect ratio.

Sizing priority:

1. SVGA `viewBoxWidth` / `viewBoxHeight`
2. player-exposed `videoItem` size
3. decoded protobuf params fallback
4. natural video or image size for references

## Information Panel

The SVGA info panel should support these tabs:

- `概览 / Overview`
- `资源 / Assets`

Overview should show:

- file size
- estimated memory usage
- canvas size
- playback duration
- FPS
- layer count
- image resource count
- parse status
- render status

Layer and image lists must be scrollable. Use monospace for layer names, image keys, dimensions, and byte sizes.

The information panel is 320-560px wide with a 420px default. The logs panel
is 420-720px wide with a 560px default. Both support resizing and persist the
selected width. At narrow desktop widths they become dismissible overlay
panels rather than crushing preview cards into unreadable columns.

## Menus

Top-level mode selection and card display modes use one dropdown system.
Shared behavior includes selected state, focus-visible state, arrow-key
navigation, Enter/Space selection, Escape dismissal, outside-click dismissal,
viewport-aware positioning, and reduced-motion behavior. A hidden native
select may remain as a fallback, but it is not the primary visual control.

## Settings

Settings are grouped as:

- preview and appearance
- playback and acceptance
- debugging and accessibility

Every row uses the same title, description, and trailing-control hierarchy.
Rescanning artifacts is a workflow action with scanning, success, and error
feedback, not a temporary debug button.

Resource warnings should be visible but not alarming unless the state is truly blocking. Use warning color for:

- image dimensions that are unexpectedly large
- image byte size that is too large
- assets that appear suspiciously uncompressed
- missing dimensions or unreadable image metadata

## Reports And Debug Data

Report fields should use Chinese labels first and original keys second:

```text
文件大小 / fileSizeBytes
图像数量 / imageCount
精灵数量 / spriteCount
扫光采样步长 / bakedSweepFrameStride
```

Do not remove original keys. They are important for debugging and for aligning the UI with `report.json` and `svga-map.json`.

When showing unknown values, use `n/a` instead of hiding the row.

## Color Usage

Use color as state and orientation, not decoration.

- Action blue: primary controls, active tabs, focus rings, SVGA A
- Purple: SVGA B or secondary comparison target
- Green: successful parse, successful reference load, MP4/reference side
- Orange: warnings and resource risks
- Red: load failures and blocking errors

Avoid one-note purple, beige, dark slate, or gradient-heavy themes. The product should feel utilitarian and precise.

## Typography

Use compact type. This is an inspection tool, so space should be spent on the preview canvas and data density.

Rules:

- Chinese label first, English helper second.
- Use monospace for keys, dimensions, frame counts, hashes, and file names.
- Do not use hero-scale text inside tool panels.
- Keep button labels short and action-oriented.

## Motion

UI motion should be subtle. The animation under review is the content; the interface should not compete with it.

Motion only explains state changes: panel entry, modal entry, dropdown entry,
loading, success, error, and drag acceptance. `prefers-reduced-motion` and the
manual reduce-motion setting replace movement and scale with near-instant
state changes.

Allowed:

- hover state
- drag-over glow
- active tab indicator
- very short mode transitions if already present

Avoid:

- decorative floating objects
- animated backgrounds
- large entrance animations
- motion that can be mistaken for SVGA playback behavior

## Accessibility Status

WCAG AAA is a target, currently **Partial**. Do not mark it complete until
axe reports zero violations and contrast, keyboard order, focus visibility,
dropdown navigation, resize semantics, and reduced motion have all been
verified in both themes.

## Drag And Drop

Drag and drop is the primary local-file interaction.

Rules:

- `.svga` files go to SVGA preview cards.
- `.mp4` and `.webm` go to the reference video card in Export Review.
- `.gif` is allowed only as a debugging fallback for reference comparison.
- Page or toolbar drops may route by extension.
- Wrong file type errors must be bilingual and specific.

Example:

```text
文件类型不支持，请拖入 .svga 文件。/ Unsupported file type. Please drop a .svga file.
```

## Do

- Default to Local Preview for local files.
- Preserve media aspect ratio.
- Keep checkerboard transparency visible.
- Show parse and render states explicitly.
- Keep report keys traceable.
- Prefer MP4/WebM reference video for export review.
- Make warnings scannable in lists.

## Don't

- Do not default every workflow to left/right preview.
- Do not call GIF the primary reference for exported SVGA.
- Do not stretch non-square SVGA into a square.
- Do not bury playback errors in logs only.
- Do not create decorative hero pages for tooling surfaces.
- Do not imply automated playback success when only manual review is possible.

## Agent Prompt Guide

When implementing UI for this repository:

1. Read `AGENTS.md` for engineering constraints.
2. Read this `DESIGN.md` for product and visual constraints.
3. Keep UI changes scoped to the requested surface.
4. Prefer real playback and real decoded metadata over mocked values.
5. Keep Chinese primary, English secondary.
6. Verify the page through the local preview server when possible.

For `tools/svga-player-preview`, preserve the two top-level mode model:

```text
Local Preview -> one SVGA, optional Compare switch for SVGA B
Export Review -> exported SVGA + reference video
```

File selection controls belong to each preview card. Fit mode controls belong to each preview card. Single-window playback controls live inside the relevant preview card. Synchronized controls only affect both visible windows and live in the shared sync bar.
