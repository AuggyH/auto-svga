# Review: Short-term UI Shell Implementation

Date: 2026-07-01
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Added and iterated a new short-term UI shell implementation path under the
shared product frontend without replacing the historical shared
`product-shell.html` / `product-app.mjs` path.

This is the first implementation slice of the corrected macOS-first UI/UX
direction. It expresses the short-term app shell, page states, modules,
component trace attributes, and fixture-only interactions for S1-S16. It does
not connect real SVGA parsing, optimization, replacement, rename, or save
logic.

After owner review, the skeleton was tightened to prioritize layout and
interaction structure over final visual styling:

- Launch is now a single full-window canvas with `拖入文件` and `打开文件` as the
  highest-priority actions.
- Launch recent files are a low-emphasis, single-column static proposal with
  five visible rows.
- File menu recent files are nested under a `Recent` submenu with ten static
  rows, not exposed directly in the File menu.
- Overview production-spec information is inline with file facts rather than a
  separate module.
- Toolbar identity/playback badges and temporary preview copy were removed.
- Compare moved next to the Preview/Edit mode switch.
- Optimization exposes a prototype `一键优化` action that batches safe enabled
  items only.

## Changed Files

- `tools/shared/product-frontend/short-term-product-shell.html`
- `tools/shared/product-frontend/short-term-product-styles.css`
- `tools/shared/product-frontend/short-term-product-app.mjs`
- `tools/shared/product-frontend/short-term-product-shell.test.mjs`
- `tools/short-term-ui-preview/index.html`
- `tools/short-term-ui-preview/main.js`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `docs/reviews/2026-07-01-codex-short-term-ui-shell-implementation.md`
- `docs/reviews/2026-07-02-codex-uiux-product-sync.md`

## Requirement Checks

- Product authority: aligned to `docs/product/PRODUCT_ROADMAP.md` S1-S16.
- Main PRD boundary: `docs/product/PRODUCT_ROADMAP.md` is product-manager owned
  and was not changed by this corrected UI/UX commit.
- PM sync: launch-page recent files and one-click optimization are documented
  in `docs/reviews/2026-07-02-codex-uiux-product-sync.md` and promoted into
  the main PRD as short-term formal scope.
- UI inputs: follows `DESIGN.md`,
  `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`,
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`, and
  `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`.
- Protected old runtime: existing shared product shell/app files were not
  replaced in this slice.
- Non-goals retained: no export acceptance UI, sequence repair, batch
  replacement, AI/cloud/accounts, advanced layer editing, or real byte writes.

## Verification

- `node --check tools/shared/product-frontend/short-term-product-app.mjs`
- `node --check tools/short-term-ui-preview/main.js`
- `node --test tools/shared/product-frontend/short-term-product-shell.test.mjs`
- `git diff --check` on the changed short-term UI files
- Browser verification at
  `http://127.0.0.1:4191/tools/short-term-ui-preview/index.html`:
  - Launch -> Overview
  - Optimization tab -> Optimization Compare
  - Save validating -> Save complete
  - Replaceable Elements -> rename, runtime image preview, runtime text modal
  - General Compare
  - Edit Reserved
  - Launch canvas with five low-emphasis recent rows
  - File > Recent submenu with ten static recent rows
  - Current-entry console error filter for port `4191`: no errors
  - 1060 x 760 active view check: no horizontal overflow, no tall/vertical
    controls, active inspector width 330px, preview width 682px
- Additional Chrome probes after owner review:
  - launch recent rows: 5, single column, no wrapping, no card border/background
  - File menu direct recent rows: 0
  - File > Recent submenu rows: 10
  - File menu layer stays above toolbar for submenu hover
  - Launch canvas at 1180 x 760 and 1060 x 760: no horizontal or vertical
    overflow

## Product Manager Sync

The following prototype decisions were reviewed by the Product Manager in
`docs/reviews/2026-07-02-codex-uiux-product-sync.md`:

- Recent files: launch page shows five low-emphasis recent records inside the
  canvas; File menu stores ten records under a `Recent` submenu. PM decision:
  approved for the short-term formal product scope. Formal release behavior
  must use real recent-file state, path-redacted labels, clear-history behavior,
  and missing-file recovery.
- One-click optimization: Optimization tab shows `一键优化` that batches safe
  enabled optimizations. Review-only/risky items, such as sequence processing
  in the fixture, remain excluded. PM decision: approved as a short-term
  one-click optimization action constrained to safe executable optimization
  items. The label `一键优化` is acceptable when nearby copy makes the safe-only
  scope explicit.

The main PRD was updated for both PM-confirmed recent-file behavior and the
safe one-click optimization boundary.

## Risks And Gaps

- This is not yet the default Web Preview or Desktop entry.
- It is fixture-only UI behavior and does not prove real playback, parsing,
  optimization bytes, rename reference closure, or save validation.
- Recent files are currently static shell behavior only; a later integration
  slice must connect real recent-file state, path-redacted labels,
  clear-history behavior, and missing-file recovery before release.
- The current `一键优化` prototype label needs nearby safe-only copy before it is
  treated as final release wording.
- A later integration slice must decide when to switch the default product
  entry to this shell and how to preserve or retire old P6 evidence contracts.

## Next Steps

Review the new shell visually, then choose the next integration step:

- wire the shell to real open/load state while keeping old behavior behind a
  fallback entry, or
- switch the default preview entry after updating the old parity/evidence
  contracts intentionally.
