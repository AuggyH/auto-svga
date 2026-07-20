# R7 Right Surface Default Contract - 2026-07-09

Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R7 - targeted right-surface structure
Target node: `模式=预览, 状态=默认` (`227:2796`)
Status: complete

This packet supports Auto SVGA `0.1.x / SVGA Preview MVP` UI/UX
implementation. It is an implementation input, not product scope authority.
The PRD remains `docs/product/PRODUCT_ROADMAP.md`.

## Why This Read Exists

R4 identified `Module/右侧栏` as the highest-reuse module for Preview,
Optimization, Edit, and Compare states, but the previous metadata path returned
only state shells and did not expose the default Preview right-surface internal
structure. WP-D needs one precise right-surface contract before module-level
visual alignment continues.

## Budget

- Current local-day conservative usage before this batch: 8/160.
- Planned MCP reads: 1.
- Hard cap: 2.
- Optional second read is allowed only if the first response is truncated or
  returns a shell without direct children.

## Read Plan

Use one read-only `use_figma` script targeting `227:2796`.

Return only compact implementation data:

- node identity, type, size, layout mode, padding, item spacing;
- direct children with relative geometry;
- visible text nodes with relative geometry and font size;
- instance/component names and variant properties when available;
- max 90 descendant summaries;
- no screenshots, image bytes, vectors, fills dumps, or deep style payloads.

## Truncation Prevention

- Do not serialize full node objects.
- Do not include image hashes, vector paths, export settings, full fills, or
  invisible instance interiors.
- Limit descendant list and text list.
- Prefer `name`, `type`, size, relative position, visible text, layout, and
  component identity only.

## Stop Condition

Stop after one successful compact response. If it returns only a symbol shell,
retry once with a direct-child-only script. If the retry still cannot expose the
structure, mark R7 blocked and proceed with existing R5 rhythm data only.

## Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_use_figma` | `227:2796` | Default Preview right-surface structure with descendants | Yes | 6.8383s | Direct children complete; tail truncated around 20 KB |
| 2 | `_use_figma` | `227:2796` | Direct-child-only compact retry | Yes | 3.2104s | Complete usable JSON |

Actual total MCP attempts: 2

Actual quota-counted reads, conservative: 2

Measured MCP tool wall time total: 10.0487s

Current local-day conservative usage after this batch: 10/160.

## Extracted Contract

Target:

- `模式=预览, 状态=默认`
- size: `360 x 800`
- layout: vertical, fixed/fixed
- padding: `16` on all sides
- item spacing: `4`
- variant properties: `模式=预览`, `状态=默认`

Direct children:

| # | Name | Type | Position | Size | Layout | Main component |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `Atom/文件信息头部/默认` | `INSTANCE` | `16,16` | `328 x 50` | horizontal, gap `8`, padding `12 0 12 0` | `Atom/文件信息头部/默认` |
| 2 | `分割线` | `INSTANCE` | `16,70` | `328 x 1` | none | `方向=水平` |
| 3 | `Molecule/统计信息网格` | `INSTANCE` | `16,75` | `328 x 204` | grid, padding `12 0 12 0` | `Molecule/统计信息网格` |
| 4 | `分割线` | `INSTANCE` | `16,283` | `328 x 1` | none | `方向=水平` |
| 5 | `可替换元素` | `FRAME` | `16,288` | `328 x 147` | vertical | n/a |
| 6 | `分割线` | `INSTANCE` | `16,439` | `328 x 1` | none | `方向=水平` |
| 7 | `图层列表` | `FRAME` | `16,444` | `328 x 301` | vertical | n/a |

Key visible text:

- Header: `文件名.svga`, font size `18`.
- Metrics: `文件大小`, `2.4`, `MiB`, `可优化`; `内存占用`,
  `20.6`, `MiB`, `可优化`; `动画时长`, `3`; plus lower metrics in
  the same `Molecule/统计信息网格`.
- Replaceable section: `imageKey (4)`, `输入文字以预览`, `替换图片`.
- Asset section: `资产列表 (60)`, `全部 (57)`, `图片 (48)`,
  `序列帧 (6)`, `音频 (3)`, row text examples such as `img_000` and
  `300×300  ·  41.8 KB`.

## Implementation Findings

- The current app's right panel width and 16px panel padding align with the
  Figma right-surface module.
- Figma uses 328px direct child width inside the 360px right surface. Existing
  `--asv-fact-grid-width: 328px` is correct and should be treated as a module
  contract, not a coincidental local tweak.
- Direct section vertical rhythm is compact: separators at y `70`, `283`,
  and `439`; content starts at y `75`, `288`, and `444`.
- The Figma default Preview right surface still names the asset-list frame
  `图层列表`, but Owner/PM terminology rules prohibit using `图层` for runtime
  structure. Implementation should keep user-visible `资源/资产` wording where
  the PRD requires it.
- This read is sufficient for the next RightSurface module alignment pass. Do
  not reread `227:2796` unless a specific nested molecule, such as
  `Molecule/数据指标块`, becomes the blocker.

## WP-R Implementation Retrospective

Implemented a narrow Preview page-level correction from this R7 contract:
`rightSurfaceHeader` now starts at the same 16px top/inline padding as the
right-surface module direct children instead of sitting at the old top edge.
The design-system check and short-term web experiment test now guard this
header placement.

This was intentionally kept small because the larger atom and molecule
contracts were already landed in R10. It improves Figma alignment without
changing product behavior, copy, menu commands, optimization logic, or asset
rendering.

Verification:

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed.

Lesson:

- Page-level polish should consume already-read module contracts and update
  guards at the same time, but packaging and foreground screenshots should wait
  until a larger owner-visible batch is ready.

## WP-S Implementation Retrospective

Implemented the Preview default right-surface information-flow correction:
runtime text preview rows now live inside the same `imageKey` section as
replaceable image rows. The visible standalone `运行时文本` block, heading, and
summary are removed from the default right surface, while the S13 runtime text
input, reset, focus, overlay preview, and byte-immutability logic remain owned
by the existing text preview modules.

The `imageKey` count now represents the combined visible preview/replacement
items in that section, matching the Owner/Figma direction where text inputs and
image replacement controls are presented as one compact list rather than two
competing modules.

Verification:

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed.

Lesson:

- When PRD functionality exists but Figma groups it differently, preserve the
  model and event logic while moving only the visual information architecture.
  This avoids adding or removing product capability while still reducing the
  old engineering-shell feel.
