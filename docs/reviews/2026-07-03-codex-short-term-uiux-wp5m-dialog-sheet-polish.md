# Short-term UI/UX WP5M Dialog Sheet Polish Review

Date: 2026-07-03
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`
Base before change: `49481c80 uiux: polish short-term toolbar grouping`

## Summary

This slice polishes the short-term client dialog/sheet presentation without
changing product behavior or save/preview logic.

It gives runtime text preview and unsaved-output discard confirmation the same
design-system trace pattern used by the rest of the short-term shell:

- `TextReplacementSheet` now has explicit component/status attributes,
  grouped header/body/action structure, and tokenized spacing.
- `ErrorRecoveryPanel` now has explicit warning status, structured header, and
  tokenized action alignment.
- Dialog styling now uses a reusable status strip, header, field, and action
  block instead of ad hoc dialog markup.

## Git State

Expected changed files for this review:

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5m-dialog-sheet-polish.md`

## Requirement Checks

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`.
- This change stays within short-term S1-S16 UI surfaces.
- PM's 2026-07-03 AE bridge / mid-term PRD additions were intentionally not
  implemented or interpreted in this UI/UX slice.
- `DESIGN.md` remains the design-system manifest, not product-scope authority.
- No PM-owned product documents were modified.
- No foreground desktop client review was run because the Owner currently has
  one monitor and asked to avoid interrupting foreground work.

## Verification

Passed:

- `git diff --check -- tools/electron-prototype/experiments/svga-web/web/index.html tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`

Note: an initial parallel attempt to run `desktop:smoke` and
`internal:trial:package:mac` collided while both rebuilt the generated
`.runtime` directory. The checks passed after rerunning serially.

## Risks

- This is still a code-level polish pass, not final high-fidelity visual design.
- Hidden smoke evidence verifies behavior and state coverage, but it does not
  replace future foreground macOS titlebar/menu-bar usability review.
- Dialog copy and information hierarchy may still need refinement after the
  next full-window visual pass.

## Next Steps

- Continue one bounded short-term UI/UX slice at a time.
- Prefer surfaces still carrying engineering-shell density or weak macOS
  hierarchy.
- Keep validation serial for Electron smoke and packaging checks.
