# Review: UI/UX WP5 optimization visual pass

## Summary

This UI/UX slice aligns the short-term client optimization detail/result
surfaces closer to the Figma WP5 contracts while preserving the current product
logic. It uses Figma as design evidence and the PRD as product authority.

## Git State

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Base before this slice: `a5e992d4 uiux: refine right resource rows`
- Parallel PM/QA dirty files were left untouched.

## Changed Files

- `docs/research/figma-mcp-read-packets/r5-wp5-optimization-contracts-20260708.md`
- `docs/reviews/2026-07-08-codex-uiux-wp5-optimization-visual-pass.md`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-command-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.atoms.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-optimization-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-save-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`

## Requirement Checks

| Requirement | Status |
| --- | --- |
| Keep PRD as product authority | Done |
| Use Figma only for WP5 visual contracts | Done |
| Do not hard-code Figma sample optimization copy | Done |
| Preserve `另存为 SVGA`, `覆盖保存`, and `放弃优化` | Done |
| Preserve concrete optimization item output required by PRD | Done |
| Do not present no-benefit / failed optimization as success | Done |
| Disable Save As / Overwrite for non-saveable optimization result status | Done |
| Keep implementation token/component layered | Done |
| Avoid new visible explanatory copy | Done |

## Verification

- `npm run desktop:short-term:design-system-check` - pass
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` - pass, 35/35
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke` - pass
- `git diff --check -- <touched short-term UI files>` - pass
- Foreground second-display screenshots from promoted App:
  - `review/uiux-current-client-evidence-20260708/stable-after-wp5-promotion-optimization-detail-display2.png`
  - `review/uiux-current-client-evidence-20260708/stable-after-wp5-promotion-optimization-result-display2.png`

## Figma MCP Usage

- Planned cap: 3 reads
- Actual reads: 2
- Nodes read: `294:28133`, `227:2834`
- Estimated local-day usage after this slice: 6 / 160
- Record: `docs/research/figma-mcp-read-packets/r5-wp5-optimization-contracts-20260708.md`

## Risks

- Figma optimization result screenshot omits the PRD-required executed/skipped
  optimization items. This slice keeps those items and visually lowers their
  weight instead of removing product-required information.
- Foreground packaged-App evidence should be refreshed after the commit and
  local stable promotion.
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl` already contains unrelated
  parallel edits, so this slice keeps the retrospective inside this review
  instead of staging mixed ownership changes.

## Project Retrospective

- What worked: reading only two state nodes was enough to guide a scoped WP5
  visual pass without broad Figma scans.
- What to keep: whenever Figma and PRD differ, record the PRD override in the
  read packet before touching code.
- What improved during validation: foreground result evidence caught truncated
  metric values that smoke could not judge; the value sizing was repaired before
  handoff.
- What changed after PM sync: the optimization result surface now fails closed
  for `failed` / `no-benefit` statuses and keeps Save actions disabled unless
  the result status is saveable.
