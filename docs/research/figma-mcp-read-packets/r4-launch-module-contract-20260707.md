# R4 Launch Module Contract

Date: 2026-07-07
Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R4 - Module-first component contract
Target node: `Module/启动页模块/默认` (`125:42`)
Status: complete

This packet records the first R4 module contract read for the short-term
launch page. It is an implementation input, not PRD authority. Product scope
remains governed by `docs/product/PRODUCT_ROADMAP.md`.

## Budget Result

Planned:

- expected MCP calls: 1
- hard cap: 2
- expected target: one launch module contract

Actual:

| # | Tool | Target | Time | Result |
| ---: | --- | --- | ---: | --- |
| 1 | `use_figma` | `125:42` | 4.5312s | Completed in Figma but response was truncated around 20 KB; not used as final source |
| 2 | `use_figma` | `125:42` | 3.5509s | Compact retry; complete final source |

Actual total MCP calls: 2

Actual quota-counted reads, conservative: 2

Measured MCP tool wall time total: 8.0821s

Reason for second call: the first call returned too much nested data for the
tool output channel. The retry reduced the payload to contract essentials only.

## Target Summary

| Field | Value |
| --- | --- |
| ID | `125:42` |
| Name | `Module/启动页模块/默认` |
| Type | `COMPONENT` |
| Component key | `2aadef0dbb5ee57ad86d6407a414edcb44905c9d` |
| Size | `640 x 592` |
| Position | `x: 660`, `y: 364` |
| Layout mode | `NONE` |
| Primary sizing | `AUTO` |
| Counter sizing | `FIXED` |
| Padding | `0` |
| Item spacing | `0` |
| Clips content | `false` |

Counts:

- direct children: 3
- descendants: 25
- instances: 7
- text nodes: 13
- recent rows: 5

## Direct Children

| ID | Name | Type | Relative position | Size | Notes |
| --- | --- | --- | --- | --- | --- |
| `125:43` | `棋盘格背景` | `RECTANGLE` | `0, 0` | `640 x 560` | Background rectangle for launch canvas module |
| `125:44` | `Molecule/空态画布` | `INSTANCE` | `170, 46` | `300 x 300` | Central empty canvas/drop prompt |
| `125:49` | `最近文件区` | `FRAME` | `140, 346` | `360 x 200` | Recent file area nested inside launch module |

## Empty Canvas Contract

`Molecule/空态画布`:

- node ID: `125:44`
- main component ID: `124:58`
- main component name: `Molecule/空态画布`
- layout: vertical
- sizing: fixed / fixed
- alignment: center / center
- item spacing: `12`
- padding: `24` on all sides
- child count: 3
- corner radius: `20`

Nested button instance:

- node ID: `I125:44;124:61`
- node name: `文字按钮`
- main component ID: `95:82`
- main component name: `类型=另存为, 状态=启用`
- visible text: `打开文件`
- size: `72 x 30`
- relative position in module: `284, 226`
- layout: horizontal
- alignment: center / center
- padding: `12` left/right, `6` top/bottom
- component properties: `类型=另存为`, `状态=启用`

Visible empty-canvas text:

| Text | Font size | Relative position | Size |
| --- | ---: | --- | --- |
| `拖拽文件到此处` | 12 | `278, 196` | `84 x 18` |
| `打开文件` | 12 | `296, 232` | `48 x 18` |

Implementation note: the button component variant name says `另存为`, but the
visible launch action copy is `打开文件`. Implementation should follow PRD and
visible design copy for the launch action, not the stale/generic variant name.

## Recent Files Contract

`最近文件区`:

- node ID: `125:49`
- type: `FRAME`
- relative position in module: `140, 346`
- size: `360 x 200`
- layout: vertical
- sizing: fixed / fixed
- padding: `0`
- item spacing: `0`
- child count: 6

Header:

- node ID: `125:50`
- size: `360 x 32`
- layout: horizontal
- padding: `8` left/right
- visible text: `最近打开`
- text font size: `12`

Clear-all control:

- node ID: `125:52`
- node name: `上传图标`
- type: `ELLIPSE`
- relative position in module: `478, 355`
- size: `14 x 14`

Implementation note: the clear-all control is visually placed as the header
trash/clear icon, but the raw node name is `上传图标`. Implementation should
map it by its role and Owner-confirmed behavior: clear all recent records.

Recent rows:

| Row | Node ID | Name | Main component | Relative Y | Size | State | Texts |
| ---: | --- | --- | --- | ---: | --- | --- | --- |
| 1 | `125:53` | `Atom/最近文件行/正常` | `Atom/最近文件行/正常` (`124:71`) | 378 | `360 x 32` | normal | `战狼头像框.svga`, `4 分钟前` |
| 2 | `125:56` | `最近文件行/失效` | `最近文件行/失效` (`124:74`) | 410 | `360 x 32` | invalid, opacity `0.45` | `战狼头像框.svga`, `文件不可访问` |
| 3 | `125:59` | `Atom/最近文件行/正常` | `Atom/最近文件行/正常` (`124:71`) | 442 | `360 x 32` | normal | `战狼头像框.svga`, `4 分钟前` |
| 4 | `125:62` | `Atom/最近文件行/正常` | `Atom/最近文件行/正常` (`124:71`) | 474 | `360 x 32` | normal | `战狼头像框.svga`, `4 分钟前` |
| 5 | `125:65` | `Atom/最近文件行/正常` | `Atom/最近文件行/正常` (`124:71`) | 506 | `360 x 32` | normal | `战狼头像框.svga`, `4 分钟前` |

All recent rows use:

- width: `360`
- height: `32`
- corner radius: `12`
- horizontal padding: `8` left/right

Visible recent text:

- `最近打开`
- `战狼头像框.svga`
- `4 分钟前`
- `文件不可访问`

## Implementation Findings

- The launch module is `640 x 592`, not a full `640 x 640` app frame.
- The checkerboard/background node is present as `棋盘格背景`.
- The empty canvas/drop prompt is a nested instance of `Molecule/空态画布`.
- The recent list is nested directly in the launch module, so WP3 does not
  need a separate broad read to prove that recent rows belong on the launch
  surface.
- Five recent rows are visible in the module, matching PRD S16.
- An invalid recent row example is included in the module contract, supporting
  the missing/inaccessible recent-file state.
- The launch recent clear-all control is in the recent header, matching the
  Owner-confirmed trash-icon behavior.

## Follow-up Need

No additional Figma MCP read is required before starting WP3 launch visual
alignment, unless implementation hits one of these specific blockers:

- exact nested icon geometry inside `Molecule/空态画布` is needed;
- exact text/button token binding cannot be resolved from existing tokens;
- the invalid recent row state needs atom-level detail beyond opacity and
  visible text.

If any blocker appears, read only the named component involved. Do not rescan
the component library.
