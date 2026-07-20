# R4 Canvas And Playback Contracts - 2026-07-08

Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Status: complete

## Pre-Read Plan

### Objective

Read the smallest shared component set needed to continue the short-term
canvas-first UI/UX refinement after the Preview right-surface pass:

1. center canvas shell and canvas-region structure;
2. bottom playback control bar;
3. Preview/Edit mode switch;
4. reusable icon-button behavior for compact controls.

This batch is meant to support the next implementation WP for the owner-visible
short-term macOS client. It must not read the full page state tree, the `备份`
page, all atoms, all molecules, or all modules.

### Approved Source

Owner confirmed that the Figma design file is now ready to guide UI/UX
refinement, while the main PRD remains the product authority. This packet uses
the implementation-eligible component library nodes already discovered in prior
R1-R4 reads.

### Nodes

| Layer | Node | Purpose |
| --- | --- | --- |
| Module | `Module/中间面板` (`238:4602`) | Canvas shell, artwork placement, control anchoring. |
| Module | `Module/播放控制栏/播放中` (`115:1098`) | Bottom playback control rhythm, sizes, icon/text balance. |
| Atom | `Atom/模式切换器` (`95:37`) | Top-center Preview/Edit switch contract. |
| Atom | `Atom/图标按钮` (`105:23`) | Shared compact icon-button dimensions and states. |

### Tools

Use `_get_design_context` for each target node. Do not use Figma write tools.
Do not request inline base64 screenshots.

### Expected Payload

For each node, capture only implementation-relevant details:

- visual screenshot context;
- major dimensions and layout;
- typography roles;
- spacing and radius values;
- visible text;
- control variants/states if returned;
- component relationships useful for mapping to existing CSS modules.

### Budget

- Planned quota-counted reads: 4.
- Hard cap: 5.
- Optional fifth read is allowed only if one returned node names a specific
  child that is required to interpret the contract and the original response is
  unusable or truncated.

Current local-day usage from `docs/research/figma-mcp-call-log.md`: no
`2026-07-08` entries found before this batch, so conservative usage starts at
0/160.

### Recording Path

- This packet: `docs/research/figma-mcp-read-packets/r4-canvas-playback-contracts-20260708.md`
- Call log: `docs/research/figma-mcp-call-log.md`
- Task review: `docs/reviews/2026-07-08-codex-figma-mcp-r4-canvas-playback-contracts.md`

### Application Target

- `PreviewStage`
- `PlaybackControls`
- `CanvasModeSwitch`
- `IconButton`
- related token/module CSS in the short-term macOS client

### Stop Condition

Stop after the four planned reads if they provide enough visual contract data
to start the canvas/playback implementation pass. Stop earlier if Figma returns
rate-limit, permission, quota, or repeated truncation errors.

## Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_get_design_context` | `238:4602` | Center canvas shell and embedded playback/mode-switch context | Yes | 6.6146s | Complete usable module context |
| 2 | `_get_design_context` | `115:1098` | Playback control bar contract | Yes | 5.2083s | Complete usable module context |
| 3 | `_get_design_context` | `95:37` | Preview/Edit mode switch contract | Yes | 4.2247s | Complete usable atom context |
| 4 | `_get_design_context` | `105:23` | Primary/secondary icon-button contract | Yes | 4.1495s | Complete usable atom context |

Actual total MCP calls: 4

Actual quota-counted reads, conservative: 4

Measured MCP tool wall time total: 20.1971s

Current local-day conservative usage after this batch: 4/160.

## Extracted Contract

### Module/中间面板

- Module size: `920 x 800`.
- Preview variant uses a single full center canvas region.
- Compare variant splits the canvas into two equal `460 x 800` visual regions.
- Artwork sample is centered at `300 x 300` with `4px` radius.
- Playback controls are anchored to the bottom, spanning the module width.
- Preview/Edit switch is anchored at top center, `16px` from the top.
- Returned drag-decision overlay still uses the older left/right split. This is
  stale versus current PRD and must not be copied into implementation.

### Module/播放控制栏/播放中

- Playback bar width: `920px`.
- Layout: horizontal flex, centered, `16px` gap.
- Padding: `24px` horizontal, `12px` vertical.
- Icon controls: `44 x 44`, control radius token `圆角/8（控件）`.
- Primary play/pause button: surface `操作色/主色`, icon `文字/操作按钮`.
- Secondary replay/loop/fullscreen controls: transparent surface, icon
  `文字/次要`.
- Icon placeholder size: `20 x 20`, `3px` radius.
- Progress track wrapper height: `20px`; track height: `3px`.
- Time text: `Inter Regular`, `12px`, line-height `18px`, `文字/次要`.

### Atom/模式切换器

- Outer shell: rounded full pill, background `边框/默认`, `4px` padding.
- Segment padding: `12px` horizontal, `8px` vertical.
- Active segment: `表面/浮层`, full radius, subtle `0 1px 1.5px rgba(0,0,0,0.1)` shadow.
- Inactive segment: transparent.
- Text: `Inter Regular`, `12px`, line-height `18px`.
- Active text: `文字/主要`; inactive text: `文字/次要`.
- Variants returned for Preview active and Edit active.

### Atom/图标按钮

- Button size: `44 x 44`.
- Radius: `圆角/8（控件）`.
- Primary variant: background `操作色/主色`, icon `文字/操作按钮`.
- Secondary variant: transparent background, icon `文字/次要`.
- Icon slot size: `20 x 20`.

## PRD Conflict / Override Notes

Current PRD has a newer drag-decision contract than the Figma `Module/中间面板`
context returned in this batch:

- `Add As Compare File` must be the top secondary strip, defaulting to 25% of
  canvas height and allowed to vary between 20%-30%.
- `Open File` must be the lower primary zone, defaulting to 75% and allowed to
  vary between 70%-80%.
- Canvas center and lower-center must resolve to Open File.

Implementation must follow the PRD for drag-decision overlay while still using
this Figma batch for canvas, playback, mode-switch, and icon-button styling.

## Implementation Use

This batch is sufficient to begin the next canvas/playback visual pass without
another Figma read. The first implementation pass should focus on:

1. aligning the top-center mode switch with the pill contract;
2. aligning playback controls to the 44px / 16px / 24px / 12px rhythm;
3. keeping compact controls icon-led and tokenized;
4. ensuring the drag overlay uses the PRD top/bottom contract rather than the
   stale Figma left/right contract.

## Verification

- All four planned reads completed.
- No optional fifth read was used.
- No Figma write operation was used.
- No `备份` page node was read.
- No Figma screenshot or design asset was committed.
- No response appeared truncated.

## Protocol Feedback

- The most efficient path remains component-targeted reads. This batch produced
  implementation-ready contracts in four calls.
- Figma can lag behind PM-corrected interaction contracts. Every read packet
  must explicitly record PRD overrides instead of blindly treating Figma output
  as product truth.
