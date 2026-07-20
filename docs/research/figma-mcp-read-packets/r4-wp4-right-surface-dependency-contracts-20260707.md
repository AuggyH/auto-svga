# R4 WP4 Right Surface Dependency Contracts

Date: 2026-07-07
Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R4 - WP4 molecule/atom dependency contracts
Status: complete for first WP4 implementation pass

This packet records the Owner-authorized Figma reads for the key molecule and
atom dependencies used by the short-term Preview right surface. It is an
implementation input, not PRD authority. Product scope remains governed by
`docs/product/PRODUCT_ROADMAP.md`.

## Budget Result

Planned:

- expected MCP calls: 3
- hard cap: 5
- targets: only WP4 right-surface dependencies, not the full component library

Actual:

| # | Tool | Target | Time | Result |
| ---: | --- | --- | ---: | --- |
| 1 | `_get_design_context` | `Molecule/统计信息网格` (`236:4479`) | 6.6398s | Complete component code/context and screenshot |
| 2 | `_get_design_context` | `Molecule/资源列表行` (`95:81`) | 7.6002s | Complete component code/context and screenshot |
| 3 | `_get_design_context` | `Atom/文件信息头部/默认` (`115:1114`) | 11.1256s | Complete component code/context and screenshot |
| 4 | `_get_design_context` | `Atom/筛选标签栏` (`154:2476`) | 4.5797s | Complete component code/context and screenshot |
| 5 | `_get_design_context` | `Molecule/缺省` (`298:7215`) | 9.5353s | Complete component code/context and screenshot |

Actual total MCP calls: 5

Actual quota-counted reads, conservative: 5

Measured MCP tool wall time total: 39.4806s

Reason for using the full hard cap: the first dependency read proved
`_get_design_context` can expand molecule internals. The remaining four reads
filled the minimum WP4 dependency set: resource rows, file header, asset tabs,
and right-surface empty states.

## Implementation Route Decision

The earlier right-surface module metadata read only returned a state-symbol
index. This batch shows that targeted molecule/atom reads do return usable
structure, visual styles, visible copy, variants, and screenshots.

Therefore WP4 should not wait for a full component-library read and should not
fall back to screenshot-only rough alignment. The recommended implementation
route is:

1. R1 screenshot targets for whole-page visual proportion.
2. R2 token foundation for color, spacing, radius, and typography values.
3. R4 right-surface state index for state coverage and right-panel width.
4. This R4 dependency packet for concrete right-surface component contracts.
5. Current code structure and foreground app validation for integration.

This is enough for a first high-fidelity WP4 Preview right-surface pass. Final
pixel acceptance can still request one targeted follow-up read if a visible
mismatch cannot be resolved from these contracts and screenshots.

## Component Contracts

### `Molecule/统计信息网格` (`236:4479`)

Purpose:

- File facts grid in Preview right surface.
- Also validates the nested `Molecule/数据指标块` and
  `Atom/指标优化入口` visual contracts.

Key layout:

- width: `280px`
- display: 2-column grid
- rows: 3 fit-content rows
- row gap: `16px`
- vertical padding: `12px`
- metric block gap: `4px`
- metric block padding: `0`

Visible metric set:

| Position | Label | Value example | Unit | Optimization entry |
| --- | --- | --- | --- | --- |
| row 1 col 1 | `文件大小` | `2.4` | `MiB` | yes |
| row 1 col 2 | `内存占用` | `20.6` | `MiB` | yes |
| row 2 col 1 | `动画时长` | `3` | `s` | no |
| row 2 col 2 | `帧率` | `30` | `fps` | no |
| row 3 col 1 | `画布尺寸` | `300×300` | `px` | no |

Typography:

- label: Inter Regular, `10px/14px`, letter spacing `0.2px` for file size;
  other labels use `11px/16px`, letter spacing `0.1px`
- value: Inter Semi Bold, `15px/22px`
- unit: Inter Regular, `10px/14px` or `11px/16px`
- optimization entry: Inter Medium `10px/14px`, letter spacing `0.2px`

Token use:

- label color: `var(--文字/次要, #737373)`
- value color: `var(--文字/主要, #111)`
- optimization background: `var(--状态色/危险背景, #fff0ee)`
- optimization text: `var(--状态色/危险, #e03030)`
- optimization radius: `var(--圆角/4, 4px)`
- optimization padding: horizontal `6px`, vertical `2px`

Implementation note:

- Keep the Owner-confirmed two-column fact density. Do not collapse into
  single-row inspector-style key/value rows.
- Production spec target thresholds are not shown here; only status entry
  points are visible.

### `Molecule/资源列表行` (`95:81`)

Purpose:

- Generic asset rows and replaceable image/text rows in the Preview right
  surface.

Variants:

- `普通图片`
- `序列帧`
- `音频`
- `可替换文字`
- `可替换图片`

Shared layout:

- standard width: `320px`
- row vertical padding: `4px`
- non-replaceable rows: thumbnail `48px`, content gap `12px`
- thumbnail frame: `48 x 48`, rounded `4px`, inner preview border `0.667px`
  with `rgba(0,0,0,0.15)`, visual preview rounded `8px`

Text hierarchy:

- primary row text: Inter Medium `12px/18px`, color `var(--文字/主要, #111)`
- secondary metadata: Inter Regular `11px/16px`, color
  `var(--文字/次要, #737373)`, letter spacing `0.1px`

Visible examples:

| Variant | Primary | Secondary / action |
| --- | --- | --- |
| `普通图片` | `img_000` | `300×300 · 41.8 KB` |
| `序列帧` | `序列帧` | `90帧 · 300×300 · 2.7 MB` |
| `音频` | `音频资产` | `2.3 s` |
| `可替换文字` | `text` | editable text input + reset icon |
| `可替换图片` | `image` | `替换图片` button + reset icon |

Replaceable row details:

- leading index text appears before thumbnail.
- key name uses 12px medium and can show edit icon.
- text input uses `Atom/文字输入框` with width up to `168px`.
- replace image action uses secondary operation background and primary action
  text color.

Implementation note:

- The component output contains transient asset URLs. Do not commit, depend on,
  or treat them as stable implementation assets.
- Use existing runtime thumbnails / generated placeholders in the app, not
  Figma-exported assets.

### `Atom/文件信息头部/默认` (`115:1114`)

Purpose:

- Preview right-surface file header with dirty star and Save As action.

Key layout:

- width: `312px`
- vertical padding: `12px`
- layout: horizontal, space-between
- title group gap: `4px`
- Save As button: width `60px`, height `30px`, horizontal padding `12px`,
  vertical padding `6px`, radius `6px`

Variants:

- `propValue=false`: no dirty star
- `propValue=true`: shows `*` after file name
- Save As button can render disabled style.

Typography:

- filename: Inter Semi Bold `18px/26px`
- Save As text: Inter Medium `12px/18px`

Token use:

- filename color: `var(--文字/主要, #111)`
- disabled Save As text: `var(--文字/禁用, #c4c4c4)`
- disabled Save As background: `var(--表面/淡色背景, #f8f8f8)`

Implementation note:

- This matches the Owner-confirmed dirty rule: only dirty states show `*`; the
  Save As button remains visible but disabled when there is no dirty state.

### `Atom/筛选标签栏` (`154:2476`)

Purpose:

- Asset-list category filter in Preview right surface.

Key layout:

- container gap: `4px`
- container vertical padding: `4px`
- focused/default tab padding: horizontal `8px`, vertical `6px`
- focused tab background: `var(--表面/画布, #f0f0f0)`
- focused tab radius: `4px`

Visible examples:

- `全部 (57)`
- `图片 (48)`
- `光效 (6)`
- `粒子 (3)`

Typography:

- Inter Regular `10px/14px`, letter spacing `0.2px`
- focused tab color: `var(--文字/主要, #111)`
- default tab color: `var(--文字/次要, #737373)`

Implementation note:

- Counts are data-driven and must come from the loaded SVGA, not fixed Figma
  example values.

### `Molecule/缺省` (`298:7215`)

Purpose:

- Right-surface empty states for no replaceable elements, no audio assets, and
  no sequence assets.

Variants:

- `可替换元素_空态`
- `音频资产_空态`
- `序列帧资产_空态`

Key layout:

- width: `312px`
- vertical layout
- gap: `12px`
- vertical padding: `4px`
- radius: `6px`
- icon size: `28px` or `30px`

Visible copy:

- `未发现可替换元素`
- `当前文件暂无音频资产`
- `当前文件暂无序列帧资产`

Typography:

- Inter Regular `12px/18px`
- color: `var(--文字/辅助, #a0a0a0)`
- centered text

Implementation note:

- These are product-approved empty states only where the corresponding asset
  group exists in the short-term scope. Do not add extra helper copy.

## Coverage Assessment

Enough for WP4 first implementation pass:

- file header
- dirty Save As affordance
- fact/stat grid
- metric optimization entry
- asset-list rows
- replaceable text/image row primitives
- asset filter tabs
- no replaceable/audio/sequence empty states

Still not covered:

- exact composition of the whole `模式=预览, 状态=默认` right-surface variant
  as one nested tree
- exact section vertical offsets and dividers between header, stats,
  imageKey, and asset list
- dark-mode component screenshots
- hover/focus states beyond visible default/focused variants

These gaps can be handled by R1 screenshot alignment plus foreground validation
for the first pass. A future targeted read is justified only if a specific
visible mismatch cannot be resolved after implementation.

## Follow-up Need

No additional Figma MCP read is required before starting the first WP4 Preview
right-surface implementation pass.

Recommended next implementation action:

- implement WP4 Preview default right surface using this packet, the R1
  preview-default screenshot, R2 tokens, and existing code component layers;
- preserve current product behavior and data flow;
- avoid new visible copy or unapproved controls;
- validate with automated checks first, then foreground desktop screenshots
  with real SVGA materials.
