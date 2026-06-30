# Review: Short-term UI Shell Implementation

Date: 2026-07-01
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Added a new short-term UI shell implementation path under the shared product
frontend without replacing the historical shared `product-shell.html` /
`product-app.mjs` path.

This is the first implementation slice of the corrected macOS-first UI/UX
direction. It expresses the short-term app shell, page states, modules,
component trace attributes, and fixture-only interactions for S1-S15. It does
not connect real SVGA parsing, optimization, replacement, rename, or save
logic.

## Changed Files

- `tools/shared/product-frontend/short-term-product-shell.html`
- `tools/shared/product-frontend/short-term-product-styles.css`
- `tools/shared/product-frontend/short-term-product-app.mjs`
- `tools/shared/product-frontend/short-term-product-shell.test.mjs`
- `tools/short-term-ui-preview/index.html`
- `tools/short-term-ui-preview/main.js`
- `docs/reviews/2026-07-01-codex-short-term-ui-shell-implementation.md`

## Requirement Checks

- Product authority: aligned to `docs/product/PRODUCT_ROADMAP.md` S1-S15.
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
  - Current-entry console error filter for port `4191`: no errors
  - 1060 x 760 active view check: no horizontal overflow, no tall/vertical
    controls, active inspector width 330px, preview width 682px

## Risks And Gaps

- This is not yet the default Web Preview or Desktop entry.
- It is fixture-only UI behavior and does not prove real playback, parsing,
  optimization bytes, rename reference closure, or save validation.
- A later integration slice must decide when to switch the default product
  entry to this shell and how to preserve or retire old P6 evidence contracts.

## Next Steps

Review the new shell visually, then choose the next integration step:

- wire the shell to real open/load state while keeping old behavior behind a
  fallback entry, or
- switch the default preview entry after updating the old parity/evidence
  contracts intentionally.
