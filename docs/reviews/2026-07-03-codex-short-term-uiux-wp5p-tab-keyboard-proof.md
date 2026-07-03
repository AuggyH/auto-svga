# Short-term UI/UX WP5P Tab Keyboard Proof Review

Date: 2026-07-03
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`
Base before change: `966e93aa uiux: polish short-term tab keyboard navigation`

## Summary

This slice adds a persisted hidden-smoke proof for the short-term inspector tab
keyboard interaction introduced in WP5O.

The proof keeps UI/UX evidence aligned with the design-system requirement that
`RightTabPanel` / `TabItem` have keyboard proof:

- Renderer smoke now simulates `ArrowRight`, `End`, and `Home` on the tablist.
- It verifies selected tab, focused tab, visible panel, roving `tabIndex`,
  `aria-selected`, and panel visibility synchronization.
- Main-process smoke validation whitelists the new proof and rejects malformed
  evidence.
- Product smoke writes `short-term-tab-keyboard-proof.json` and includes
  `shortTermTabKeyboard` in the smoke summary.

## Git State

Expected changed files for this review:

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5p-tab-keyboard-proof.md`

Generated but not committed:

- `.artifacts/product/short-term/short-term-tab-keyboard-proof.json`

## Requirement Checks

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`.
- This change stays inside short-term S1-S16 UI evidence surfaces.
- It supports the design-system `RightTabPanel` / `TabItem` keyboard-proof
  expectation without adding new product scope.
- PM's 2026-07-03 AE bridge / mid-term PRD additions were intentionally not
  implemented or interpreted in this UI/UX slice.
- No PM-owned product documents were modified.
- No parsing, optimization, replacement, save, menu, recent-file, or packaging
  product behavior was changed.
- Foreground desktop client review was still not required for this evidence
  slice, though the Owner has now allowed foreground use for upcoming work.

## Verification

Passed:

- `git diff --check -- tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs tools/electron-prototype/experiments/svga-web/main.cjs tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`

Evidence checked:

- `.artifacts/product/short-term/short-term-tab-keyboard-proof.json`
  reported `passed: true`.
- `git check-ignore -v .artifacts/product/short-term/short-term-tab-keyboard-proof.json`
  confirmed `.artifacts/` remains excluded from commits.

## Risks

- This is hidden-smoke interaction evidence; it does not replace foreground
  macOS titlebar/menu-bar usability review.
- The internal package proof remains unsigned, unnotarized, and internal-only.
- The package proof manifest records the pre-commit HEAD because packaging was
  run before this commit exists; final packaged-app acceptance remains owned by
  the integration coordinator.

## Next Steps

- Use the Owner-approved foreground window for the next visual/interaction
  inspection slice, especially where macOS titlebar and menu-bar context matter.
- Continue keeping UI/UX polish separate from PM-owned PRD updates.
