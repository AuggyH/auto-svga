# Review: short-term UI/UX WP5A dark tool shell polish

## 1. Summary
This round refined the short-term macOS client shell toward a quieter native-tool feel without changing product behavior or feature logic.

The work focused on design-token-backed dark/light surface tuning, lower-noise component borders, tighter control density, and clearer preview/inspector separation.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `280a6b70 uiux: extract short-term render model helpers`
- Uncommitted PM-owned changes observed but not touched or staged:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/PRODUCT_ROADMAP.md`
  - `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
  - `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5a-dark-tool-shell.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Follow PRD/subordinate UI doc authority; do not change product scope | Done |
| 2 | Keep changes UI/UX-only and avoid feature logic edits | Done |
| 3 | Continue token -> component -> page-state separation | Done |
| 4 | Improve visual quality of the current engineering shell | Done |
| 5 | Validate with real foreground macOS screenshots, not only smoke captures | Done |
| 6 | Preserve current short-term desktop behavior | Done |

## 5. Verification
Commands run and results:
```
$ git diff --check -- tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css tools/electron-prototype/experiments/svga-web/web/short-term-macos.css
passed

$ npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
passed: 29/29

$ npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
passed=true
```

Foreground screenshots with macOS menu bar and titlebar:
- `/tmp/auto-svga-uiux-wp5a-real-20260703/01-launch-foreground-display2.png`
- `/tmp/auto-svga-uiux-wp5a-real-20260703/02-real-overview-foreground-display2-active.png`
- `/tmp/auto-svga-uiux-wp5a-real-20260703/03-real-optimization-foreground-display2-active.png`
- `/tmp/auto-svga-uiux-wp5a-real-20260703/04-real-replaceable-foreground-display2-active.png`

Real SVGA material used:
- `金焰藏宝箱头像框.svga` from the local recent-file state, originally from the user-provided real material directory.

## 6. Output inspection
- Launch state remains a single full-window canvas with the open-file action above recent records.
- Overview state keeps the preview-first layout and makes the inspector panel less card-heavy.
- Optimization state preserves the one-click optimization affordance and safe/review/unsupported boundary.
- Replaceable state keeps empty-state copy visible without adding new product behavior.
- The app menu name still appears as `Electron`; this is a packaging/app-identity issue, not changed in this UI-only pass.

## 7. Risks
- This pass improves visual tone but does not complete the full high-fidelity redesign.
- Existing CSS still contains older hardcoded typography and utility values outside the touched visual polish area.
- More real-material coverage is still needed across file size, memory estimate, replaceable resources, and failure states.

## 8. Next steps
- Continue with component-by-component high-fidelity work, starting with inspector tabs, fact cells, resource rows, and empty states.
- Add focused keyboard/focus-order validation after the next interactive component pass.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
