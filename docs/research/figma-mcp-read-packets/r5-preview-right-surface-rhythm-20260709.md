# R5 Preview Right Surface Rhythm - 2026-07-09

Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Status: complete

## Pre-Read Plan

### Objective

Read the smallest useful Figma context for the next Auto SVGA `0.1.x` Preview
right-surface visual polish slice. The goal was to decide whether the current
right information surface padding and section rhythm should be adjusted from
the existing implementation values.

This batch must not scan the full design file, must not read the `备份` page,
and must not redefine product scope.

### Approved Source

Owner confirmed the Figma design file is ready to guide UI/UX refinement.
Product authority remains `docs/product/PRODUCT_ROADMAP.md`.

### Nodes

| Layer | Node | Purpose |
| --- | --- | --- |
| Page | `auto-svga` (`0:1`) | Locate implementation-eligible frames and avoid `备份`. |
| Frame | `预览 / 默认` (`27:2`) | Extract right-surface layout rhythm and resource-row context. |

### Tools

- `_get_metadata` was attempted first for a cheap page index, but the MCP server
  returned `Tool get_metadata not found`.
- `_use_figma` was then used for compact read-only JSON queries after loading
  the `figma-use` guidance.

### Budget

- Planned quota-counted reads: 2
- Hard cap: 3
- Stop condition: stop after locating Preview default and extracting right
  surface rhythm, or earlier if Figma returns permission/quota/rate errors.

Current local-day usage from `docs/research/figma-mcp-call-log.md`: no
`2026-07-09` entries found before this batch, so conservative usage starts at
0/160.

## Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_get_metadata` | file root | Cheap page index | Conservative yes | 1.6275s | Failed: tool not found; no design data returned |
| 2 | `_use_figma` | file root | Compact page and top-level frame inventory | Yes | 3.2292s | Complete usable page/frame index |
| 3 | `_use_figma` | `预览 / 默认` (`27:2`) | Compact right-surface layout/typography inventory | Yes | 6.5214s | Usable; response truncated after key facts |

Actual MCP tool attempts: 3

Actual quota-counted reads, conservative: 3

Measured MCP tool wall time total: 11.3781s

Current local-day conservative usage after this batch: 3/160.

## Extracted Contract

### Preview Default Frame

- Frame: `预览 / 默认` (`27:2`)
- Size: `1280 x 800`
- Canvas area: `920 x 800`
- Right content instance: `右侧内容区` (`158:2709`)
- Right content size: `360 x 800`
- Right content layout: vertical
- Right content gap: `4`
- Right content padding: `16px` on all sides

### Header

- `Atom/文件信息头部/默认` width: `328px`
- Header padding: `12px 0`
- File name text: `18px`, line-height `26px`, Semi Bold
- Save button: `60 x 30`, padding `6px 12px`

### Statistics Grid

- `Molecule/统计信息网格` width: `328px`
- Statistics grid padding: `12px 0`
- Metric labels: `10-11px`
- Metric values: `15px`, line-height `22px`, Semi Bold
- Optimization entry chip: `49 x 18`, padding `2px 6px`

### Section Rhythm

- The Figma right surface uses a compact vertical rhythm after the file facts:
  the right content instance itself has `4px` vertical gap and section-specific
  padding does the detailed spacing.
- The implementation should not use the older looser `24px` right-panel padding
  or a large duplicated section gap for this Preview right surface.

### Resource Row

- Resource row width: `328px`
- Resource row height: `56px`
- Resource row gap: `12px`
- Resource row padding: `4px 0`
- Thumbnail: `48 x 48`

## Implementation Decision

Proceed with a token-only right-surface rhythm correction:

- `--asv-component-right-panel-padding`: `var(--asv-space-4)` (`16px`)
- `--asv-component-right-panel-section-gap`: `var(--asv-space-2)` (`8px`)

This aligns the implementation more closely with the Figma `预览 / 默认` right
surface while keeping product copy, functionality, and component structure
unchanged.

## Verification Notes

- No Figma write operation was performed.
- No Figma screenshot or remote asset was committed.
- The third call was truncated after the key facts needed for this WP; the hard
  cap was reached and no additional read was made.
- The stale `_get_metadata` tool exposure should not be used again unless the
  MCP tool list changes.
