# Review: short-term UI/UX WP6B module and page-state CSS split

## 1. Summary
WP6B completes the first CSS design-system landing pass by splitting the
remaining large page stylesheet into module and page-state layers.

This is a structural refactor only. It does not change product scope, visible
copy, DOM structure, labels, menus, feature behavior, or interaction flow.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `1d181cb1`
- Uncommitted changes at review authoring:
  - `docs/reviews/2026-07-03-codex-short-term-uiux-wp6b-module-page-state-css-split.md`
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/index.html`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
- Untracked files: ignored local evidence under `.artifacts/`, if present

## 3. Changed files
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp6b-module-page-state-css-split.md`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep work within UI implementation structure, not product scope. | Done |
| 2 | Do not add product-doc-external UI copy, labels, states, or components. | Done |
| 3 | Complete CSS physical layering through module and page-state files. | Done |
| 4 | Keep base CSS small and prevent module selectors from drifting back into it. | Done |
| 5 | Preserve Electron runtime and smoke coverage after stylesheet split. | Done |

## 5. Verification
Commands run and results:
```bash
git diff --check
# passed

npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
# passed, 29/29

npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
# passed
```

## 6. Output inspection
Final stylesheet order:
1. `short-term-macos.tokens.css`
2. `short-term-macos.atoms.css`
3. `short-term-macos.molecules.css`
4. `short-term-macos.components.css`
5. `short-term-macos.modules.css`
6. `short-term-macos.page-states.css`
7. `short-term-macos.css`

Layer responsibilities:
- Module layer: toolbar, save banner, launch surface internals, preview canvas,
  playback, right panel, lists, compare module, and edit-reserved panels.
- Page-state layer: app state, view layout, Launch/Preview/Compare/Edit view
  layout, reduced motion, reduced transparency, and viewport breakpoints.
- Base layer: reset, hidden rule, body text/window defaults only.

## 7. Risks
- JS is still the largest remaining implementation debt. It still mixes state,
  rendering, interaction handlers, host bridge actions, and smoke helpers.
- Module/page-state CSS naming still reflects existing implementation names;
  no internal rename was attempted in this WP to avoid product-semantic churn.

## 8. Next steps
- WP6C: split low-risk JS render helpers into module files without changing UI
  text or behavior.
- WP6D: add design-oriented interaction evidence for focus path, scroll
  containment, reduced motion, minimum window, and menu discoverability.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
