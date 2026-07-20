# Review: short-term UI/UX WP6A CSS layer split

## 1. Summary
WP6A starts the implementation-side design-system cleanup requested by Owner:
move the short-term desktop client away from a single large component CSS file
toward the documented token -> atom -> molecule -> component layering.

This round is intentionally structural. It does not add UI copy, labels,
states, components, product behavior, menus, or interactions.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `77c3d87c`
- Uncommitted changes at review authoring:
  - `docs/reviews/2026-07-03-codex-short-term-uiux-optimization-program.md`
  - `docs/reviews/2026-07-03-codex-short-term-uiux-wp6a-css-layer-split.md`
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/index.html`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.atoms.css`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- Untracked files: ignored local evidence under `.artifacts/`, if present

## 3. Changed files
- `docs/reviews/2026-07-03-codex-short-term-uiux-optimization-program.md`
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp6a-css-layer-split.md`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.atoms.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep `PRODUCT_ROADMAP.md` as product authority and avoid redefining scope. | Done |
| 2 | Do not add product-doc-external UI copy, states, labels, or components. | Done |
| 3 | Start design-system physical layering below tokens. | Done |
| 4 | Preserve existing component behavior and selector order through stylesheet ordering. | Done |
| 5 | Add tests proving atom and molecule files are loaded and not folded back into the component file. | Done |

## 5. Verification
Commands run and results:
```bash
git diff --check
# passed

node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs
# passed

npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
# passed, 29/29

npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
# passed
```

## 6. Output inspection
- Stylesheet order is now:
  1. tokens
  2. atoms
  3. molecules
  4. components
  5. page/module styles
- Atom layer now owns base controls, spinner, thumbnails, row text helpers,
  badges, and empty text styling.
- Molecule layer now owns toolbar buttons, launch open button, segmented mode
  switch, tab control styling, inline rename controls, and row menu buttons.
- Component layer now keeps composed surfaces such as state cards, fact cells,
  asset/finding/replaceable rows, dialogs, context menu, and reserved notice.

## 7. Risks
- Page/module styles still remain in `short-term-macos.css`; later WP should
  split module and page-state layers after this first CSS layer split remains
  stable.
- JS remains a large mixed file; later WP should split render modules without
  changing visible behavior.

## 8. Next steps
- WP6B candidate: split `short-term-macos.css` into module and page-state CSS.
- WP6C candidate: extract JS render helpers for rows/lists into module files
  with no product behavior changes.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
