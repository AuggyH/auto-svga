# Short-term UI/UX Boundary-Light Polish

Date: 2026-07-05
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

This UI/UX slice continues the Owner-confirmed canvas-first direction without
changing product scope or feature logic. It reduces hard boxed boundaries in
the short-term macOS client by making the canvas mode switch token-driven and
floating, moving compare canvas metadata from a header bar into a light overlay,
and turning Edit/Compare side surfaces into boundary-light panels instead of
card-like containers.

## Product And Design Authority

- Product authority: `docs/product/PRODUCT_ROADMAP.md`
- Design authority: `DESIGN.md`
- Execution guardrails:
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`

The slice stays inside S1-S16 and does not add product copy, controls, modes,
or feature behavior.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-05-codex-short-term-uiux-boundary-light-polish.md`

## Requirement Checks

- Canvas-first hierarchy: strengthened by reducing mode-switch, compare, and
  edit-panel boxed chrome.
- Token traceability: new mode-switch styling uses semantic/component token
  aliases, not page-local raw color values.
- Component boundary: changes remain in token, molecule, and module layers.
- Product scope: no new visible copy, helper text, status, or unapproved
  controls were introduced.
- Compare behavior: no persistent main-surface compare entry was added.
- Edit behavior: short-term Edit mode remains layer-list plus quiet reserved
  right panel only.

## Verification

- `npm run desktop:short-term:design-system-check`: passed
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`: passed, 31/31
- `npm run desktop:smoke`: passed
- `git diff --check`: passed

Smoke screenshots inspected:

- `.artifacts/product/short-term/short-term-preview-overview.png`
- `.artifacts/product/short-term/short-term-general-compare.png`
- `.artifacts/product/short-term/short-term-edit-reserved.png`
- `.artifacts/product/short-term/short-term-preview-minimum.png`
- `.artifacts/product/short-term/short-term-optimization-result.png`

Automated smoke screenshots remain regression evidence only. Foreground
macOS-client screenshots with native window chrome and real Owner production
SVGA materials are still required before final UI/UX acceptance.

## Risks

- This is a visual polish slice, not final high-fidelity acceptance.
- Compare canvas still needs real foreground review with production SVGA files
  because smoke screenshots use the synthetic fixture and do not include native
  macOS chrome.

## Next Steps

Continue the visual high-fidelity track on the remaining surfaces, especially
optimization result density, right information hierarchy, light-mode parity,
and foreground macOS validation.
