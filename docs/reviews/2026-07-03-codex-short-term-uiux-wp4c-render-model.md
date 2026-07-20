# Codex Review: Short-term UI/UX WP4C Render Model Split

## Summary

Extracted the first behavior-neutral renderer helper module for the short-term
macOS client. The new module owns pure display-model helpers and HTML snippets
for reusable visible units such as fact cells, optimization finding rows,
compare fact cells, metric cells, message rows, status copy, safe image-data
URL checks, suffix naming, and optimization grouping.

This is not a feature change and not a visual redesign. It is the next
componentization step after WP4A tokens and WP4B component CSS.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this slice: `7ba2c503 uiux: split short-term macos component styles`
- PM/product files remain intentionally unstaged and outside this UI slice:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/PRODUCT_ROADMAP.md`
  - `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
  - `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-render-model.mjs`
  - New pure render-model helper module.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Imports the helper module and removes duplicated local pure helper
    functions.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates structural assertions so render helper ownership is checked in the
    new module.

## Requirement Checks

- Product authority: no product-scope change; still aligned to
  `PRODUCT_ROADMAP.md` S1-S16.
- Design authority: supports `DESIGN.md` and short-term design-system
  traceability by separating renderer helper ownership from page state logic.
- Behavior boundary preserved:
  - File open/recent/open-failure logic unchanged.
  - Save/Save As logic unchanged.
  - Optimization execution logic unchanged.
  - Playback mounting logic unchanged.
  - DOM event routing unchanged.
- Componentization boundary improved but not complete:
  - `short-term-macos-render-model.mjs` now owns pure render helpers.
  - `short-term-macos-app.mjs` still owns state, DOM mounting, IPC, playback,
    dialogs, and smoke flow.

## Verification

- `git diff --check` passed for touched files.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  passed: 29/29.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  passed with `passed=true`.

## Validation Notes

- The first regression run failed because an old static assertion still
  expected the visible fact ID list and optimization count template inside the
  main renderer file. The assertion was updated to check
  `short-term-macos-render-model.mjs`, matching the new boundary.
- No foreground screenshot was repeated for this slice because the change is
  behavior-neutral module extraction and WP4B already captured foreground
  visual states after the CSS component split.

## Risks

- JS componentization is still partial. Large stateful sections remain in
  `short-term-macos-app.mjs`.
- Future splits should avoid mixing behavior changes into module extraction;
  state transitions, IPC, save, open, and playback should move only with
  failure-first regression coverage.

## Next Steps

1. Continue with a small page-state/action-controller split, or pause
   structure work and start the higher-fidelity visual pass.
2. For the visual pass, use foreground screenshots as the review surface for
   toolbar hierarchy, inspector density, canvas framing, list rows, empty
   states, and focus/keyboard behavior.
