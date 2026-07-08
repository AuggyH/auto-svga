# R5 WP5 Optimization Contracts - 2026-07-08

Figma file: `7hIydrsyIzxs6E5dJQ53tu`

Scope: short-term UI/UX WP5 optimization detail and optimization result
surfaces. Product authority remains `docs/product/PRODUCT_ROADMAP.md`.

## Read Budget

- Local day: 2026-07-08
- Conservative daily budget: 160 quota-counted reads
- Estimated usage before this batch: 4 / 160
- Planned cap: 3 reads
- Actual quota-counted reads: 2
- Estimated usage after this batch: 6 / 160
- Figma write operations: 0
- PNG/design assets committed: 0

## Calls

| Call | Tool | Node | Target | Duration | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | `_get_design_context` | `294:28133` | `Module/右侧栏`, optimization detail | 5.4487s | Succeeded |
| 2 | `_get_design_context` | `227:2834` | `Module/右侧栏`, optimization result compare | 4.0266s | Succeeded |

The optional third read for optimization running state was skipped because the
first two reads were sufficient for this implementation pass.

## Contracts Extracted

### Optimization Detail

- Right surface: `360 x 800`, panel padding `16`, vertical gap `4`.
- Header: large title `优化`, 18px semibold, 26px line height.
- Candidate rows: 54px visual rhythm, 12px horizontal padding, 12px vertical
  padding, 8px gap, 8px radius.
- Candidate states:
  - `可安全执行`: success soft background and success badge.
  - `需复核`: warning soft background and warning badge.
  - `暂不支持`: recessed surface and neutral badge.
- Actions: full-width 30px buttons, primary `一键优化`, secondary `放弃优化`.

### Optimization Result

- Header: large title `优化结果`.
- Metrics: two-column grid; labels use small secondary text; improved values use
  success color.
- Actions: full-width 30px button rhythm, primary save action, low-emphasis
  discard action.
- PRD override: the design context only shows save/discard, but the PRD
  explicitly requires `另存为 SVGA`, `覆盖保存`, and `放弃优化`, plus concrete
  optimization items. Implementation must preserve these product requirements
  and only reduce their visual weight.

## Implementation Notes

- Do not hard-code Figma sample optimization copy.
- Keep real optimization row titles, summaries, impacts, and dispositions driven
  by the existing model.
- Use tokenized CSS in the existing `tokens -> atoms -> components -> modules`
  layers.
- Do not add new user-visible states or explanatory copy.

