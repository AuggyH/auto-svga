# Review: short-term reduced transparency support

## 1. Summary
Improved the short-term design-system support for macOS reduced transparency. Titlebar and context-menu backdrop effects now route through effect tokens, and the reduced-transparency media query disables both surfaces while moving panel/toolbar surfaces to solid tokens.

No product scope, visible copy, layout structure, or component inventory changed.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `31a051f7`
- Uncommitted changes: `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`, `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`, `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`, `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`, this review
- Untracked files: none staged

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `docs/reviews/2026-07-04-codex-short-term-reduced-transparency.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep owner-visible UI values tokenized | Done |
| 2 | Support reduced transparency mode without adding product UI | Done |
| 3 | Cover titlebar and context-menu blur effects | Done |
| 4 | Add a design-system check so the support cannot silently regress | Done |

## 5. Verification
Commands run and results:
```
$ npm run desktop:short-term:design-system-check
passed: true, including reduced-transparency-covered

$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs --test-name-pattern "default Electron renderer is the short-term macOS client"
31 tests passed

$ npm run desktop:smoke
passed: true
```

## 6. Output inspection
- `--asv-effect-titlebar-backdrop-filter` and `--asv-effect-menu-backdrop-filter` own the blur effects.
- `prefers-reduced-transparency: reduce` sets both effect tokens to `none`.
- The design-system checker now records `reduced-transparency-covered`.

## 7. Risks
- Foreground visual acceptance under an actual macOS reduced-transparency setting is not claimed in this review; this slice proves token wiring and regression coverage.

## 8. Next steps
- Add foreground reduced-transparency screenshot evidence when it can be tested without changing the Owner's system settings unexpectedly.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
