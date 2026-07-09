# R5 Optimization Detail Surface - 2026-07-09

Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Status: complete

## Pre-Read Plan

### Objective

Read the smallest useful Figma context needed to refine the Auto SVGA `0.1.x`
Preview optimization detail surface. The goal was to determine whether the
current optimization candidate rows should remain visually heavy or align to
the compact row rhythm in the design file.

This read must not scan the full design file, must not read the `备份` page, and
must not redefine product scope.

### Approved Source

Owner confirmed the Figma design file is ready to guide UI/UX refinement.
Product authority remains `docs/product/PRODUCT_ROADMAP.md`.

### Node

| Layer | Node | Purpose |
| --- | --- | --- |
| Frame | `预览 / 优化详情` (`82:2669`) | Extract right-surface optimization detail layout, candidate-row rhythm, and action rhythm. |

### Budget

- Planned quota-counted reads: 1
- Hard cap: 2
- Stop condition: stop after extracting the optimization detail row contract, or
  earlier if Figma returns permission/quota/rate errors.

Current local-day conservative usage before this batch: 3/160.

## Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_use_figma` | `预览 / 优化详情` (`82:2669`) | Compact right-surface and optimization-row layout inventory | Yes | 5.1170s | Complete usable JSON; no truncation |

Actual MCP tool attempts: 1

Actual quota-counted reads, conservative: 1

Measured MCP tool wall time total: 5.1170s

Current local-day conservative usage after this batch: 4/160.

## Extracted Contract

### Optimization Detail Frame

- Frame: `预览 / 优化详情` (`82:2669`)
- Size: `1280 x 800`
- Right module: `Module/右侧栏` (`253:6229`)
- Right module size: `360 x 800`
- Right module layout: vertical
- Right module gap: `4`
- Right module padding: `16px`

### Header

- Header component: `Atom/文件信息头部/默认`
- Header size: `328 x 50`
- Header padding: `12px 0`
- Header title text: `优化`
- Title text: `18px`, line-height `26px`, Semi Bold

### Candidate Rows

- Row component: `优化候选项行`
- Row size: `328 x 62`
- Row layout: horizontal
- Row gap: `8`
- Row padding: `12px`
- Row radius: `12px`
- Candidate title: `12px`, line-height `18px`, Medium
- Candidate summary: `11px`, line-height `16px`, Regular

Candidate states:

- `可安全执行`: success soft background and success badge.
- `需复核`: warning soft background and warning badge.
- `暂不支持`: neutral/recessed background and neutral badge.

### Actions

- Action group width: `328px`
- Action group padding: `12px 0`
- Action group gap: `8`
- Primary action: `一键优化`, `328 x 30`, radius `6`
- Secondary action: `放弃优化`, `328 x 30`, radius `6`

## Implementation Decision

Proceed with a tokenized optimization candidate-row visual correction:

- Keep existing product copy and optimization logic unchanged.
- Preserve existing impact value and disposition badge, but place them in the
  same row rhythm so the candidate item no longer expands into a heavy card.
- Add explicit token aliases for candidate summary, impact, badge, and neutral
  unsupported-row styling.
- Keep PRD behavior above Figma sample details when they differ.

## Verification Notes

- No Figma write operation was performed.
- No Figma screenshot or remote asset was committed.
- The read returned a complete compact JSON response, so no follow-up read was
  needed.
