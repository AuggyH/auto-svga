# R4 Right Surface State Index

Date: 2026-07-07
Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R4 - Module-first component contract attempt
Target node: `Module/右侧栏` (`227:2861`)
Status: partial

This packet records the Owner-authorized R4 read for the short-term right
surface module. It is an implementation input, not PRD authority. Product scope
remains governed by `docs/product/PRODUCT_ROADMAP.md`.

## Budget Result

Planned:

- expected MCP calls: 1
- hard cap: 2
- expected target: one right-surface module contract
- fallback: drill into the default Preview variant only if the module root
  returned state shells instead of structure

Actual:

| # | Tool | Target | Time | Result |
| ---: | --- | --- | ---: | --- |
| 1 | `_get_metadata` | `227:2861` | 15.2526s | Complete state-variant index; no truncation |
| 2 | `_get_metadata` | `227:2796` | 11.6318s | Returned only the default Preview symbol shell; no internal structure |

Actual total MCP calls: 2

Actual quota-counted reads, conservative: 2

Measured MCP tool wall time total: 26.8844s

Reason for second call: the module root returned the right-surface variant
index but not the nested default Preview right-surface structure. The second
read tested whether drilling into a single symbol would expose child layout.
It did not.

## Target Summary

| Field | Value |
| --- | --- |
| ID | `227:2861` |
| Name | `Module/右侧栏` |
| Type returned | `FRAME` |
| Position | `x: 4193`, `y: 364` |
| Size | `6408 x 848` |
| Direct state symbols | 16 |

## State Variant Index

| # | ID | Name | Relative position | Size | Supports |
| ---: | --- | --- | --- | --- | --- |
| 1 | `227:2796` | `模式=预览, 状态=默认` | `24, 24` | `360 x 800` | WP4 Preview default |
| 2 | `298:6529` | `模式=预览, 状态=无可替换元素` | `424, 24` | `360 x 800` | WP4 no replaceable elements |
| 3 | `298:7241` | `模式=预览, 状态=无音频资产` | `824, 24` | `360 x 800` | WP4 no audio assets |
| 4 | `298:7361` | `模式=预览, 状态=无序列帧资产` | `1224, 24` | `360 x 800` | WP4 no sequence assets |
| 5 | `294:22569` | `模式=预览, 状态=空态` | `1624, 24` | `360 x 800` | WP4 empty preview |
| 6 | `227:2815` | `模式=预览, 状态=Dirty` | `2024, 24` | `360 x 800` | WP4 dirty Save As |
| 7 | `294:23326` | `模式=预览, 状态=保存中` | `2424, 24` | `360 x 800` | WP7 saving |
| 8 | `294:26951` | `模式=预览, 状态=保存失败` | `2824, 24` | `360 x 800` | WP7 save failed |
| 9 | `294:25280` | `模式=预览, 状态=保存成功` | `3224, 24` | `360 x 800` | WP7 save success |
| 10 | `294:28133` | `模式=优化, 状态=优化详情` | `3624, 24` | `360 x 800` | WP5 optimization detail |
| 11 | `294:27925` | `模式=优化, 状态=优化执行中` | `4024, 24` | `360 x 800` | WP5 optimization running |
| 12 | `227:2834` | `模式=优化, 状态=优化结果对比` | `4424, 24` | `360 x 800` | WP5 optimization result compare |
| 13 | `227:2858` | `模式=编辑, 状态=-` | `4824, 24` | `360 x 800` | WP7 edit reserved right surface |
| 14 | `256:3110` | `模式=对比, 状态=空态` | `5224, 24` | `360 x 800` | WP6 compare empty |
| 15 | `294:21284` | `模式=对比, 状态=等待另一文件` | `5624, 24` | `360 x 800` | WP6 compare waiting |
| 16 | `294:21361` | `模式=对比, 状态=双文件` | `6024, 24` | `360 x 800` | WP6 compare two files |

## Implementation Findings

- The right-surface component set covers Preview, Optimization, Edit, and
  Compare states in one module, confirming that it is the highest-reuse R4
  target for WP4-WP7.
- Every state symbol is `360 x 800`, matching the intended fixed right-panel
  width used by the design screenshots.
- The current metadata tool is useful for state indexing but does not expose
  the internal layout of a state symbol. Drilling into `227:2796` returned only
  `<symbol id="227:2796" name="模式=预览, 状态=默认" ... />`.
- This packet must not be treated as a complete implementation contract for
  WP4 pixel work. It lacks direct children, visible text, geometry, instance
  main-component IDs, component properties, token bindings, and nested layout.

## Follow-up Need

Before starting pixel-level WP4 implementation, one of these must happen:

1. regain access to a Figma MCP read path that can execute a compact
   `use_figma` script or otherwise expand symbol internals; or
2. use a targeted screenshot-only visual pass for rough alignment and mark it
   explicitly as not pixel-level, then return to component-contract reading
   before final high-fidelity acceptance.

Recommended next Figma request, if Owner authorizes another read batch:

- target: `模式=预览, 状态=默认` (`227:2796`)
- tool need: structured child/context read, not metadata-only shell
- expected calls: 1
- hard cap: 2 only if the first response is truncated
- payload: direct children, visible text, geometry, instance main-component IDs,
  component properties, and implementation findings only

Do not read all right-surface variants in detail as one batch.
