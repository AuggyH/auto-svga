# Review: short-term UI/UX WP5B inspector component polish

## 1. Summary
This round continued the short-term macOS UI/UX redesign by polishing the right inspector panel components without changing product behavior.

The main visible change is that the Overview asset list now behaves more like a native inspector list instead of a stack of repeated cards. Tabs, fact cells, finding rows, badges, empty states, and inspector spacing were also tightened through component tokens.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `902491a0 uiux: refine short-term dark tool shell`
- Uncommitted PM-owned changes observed but not touched or staged:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/PRODUCT_ROADMAP.md`
  - `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
  - `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5b-inspector-components.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep PRD scope unchanged and subordinate to `PRODUCT_ROADMAP.md` | Done |
| 2 | Touch only UI/UX component styling, not feature logic | Done |
| 3 | Advance token -> component -> module traceability | Done |
| 4 | Improve inspector visual quality and scan density | Done |
| 5 | Preserve current short-term desktop behavior | Done |
| 6 | Validate with real foreground macOS screenshots | Done |

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
- `/tmp/auto-svga-uiux-wp5b-real-20260703/01-launch-foreground-display2.png`
- `/tmp/auto-svga-uiux-wp5b-real-20260703/02-real-overview-foreground-display2.png`
- `/tmp/auto-svga-uiux-wp5b-real-20260703/03-real-optimization-foreground-display2.png`
- `/tmp/auto-svga-uiux-wp5b-real-20260703/04-real-replaceable-foreground-display2.png`

Real SVGA material used:
- `金焰藏宝箱头像框.svga` from the local recent-file state, originally from the user-provided real material directory.

## 6. Output inspection
- Overview asset rows are now lower-emphasis inspector rows with separators, not repeated high-level cards.
- Fact cells keep actual/limit status visible while reducing border/background noise.
- Optimization review-only row remains visually distinct and does not imply safe executable output.
- No-replaceable empty states remain readable and visually secondary.
- Existing app identity still appears as `Electron`; this was not addressed in this UI component pass.

## 7. Risks
- This is still CSS-level high-fidelity work; component structure in JS/HTML remains mostly unchanged.
- Light mode received token-level coverage but did not receive the same real foreground screenshot coverage as dark mode in this pass.
- Full keyboard/focus-order validation is still pending for a dedicated interaction QA WP.

## 8. Next steps
- Continue with WP5C focused on toolbar/save-state/feedback components or keyboard/focus-path validation.
- Later split remaining typography and menu/dialog values into more complete component tokens.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
