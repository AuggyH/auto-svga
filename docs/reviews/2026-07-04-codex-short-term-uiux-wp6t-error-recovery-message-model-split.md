# Short-Term UI/UX WP6T Error Recovery Message Model Split Review

## Summary

Moved the shared "source file was not modified" recovery message construction into the feedback model.

The main app entry still decides when to show load/playback/operation failures, but the reusable `ErrorRecoveryPanel`/feedback copy construction now lives beside the existing save banner and state summary view helpers.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit: pending at review creation time

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-feedback-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-uiux-wp6t-error-recovery-message-model-split.md`

## Requirement Checks

- Product authority unchanged: no edits to `docs/product/PRODUCT_ROADMAP.md` or PM-owned PRD files.
- PRD trace: S2 load/playback abnormal feedback and S14 failed save/operation recovery copy are preserved.
- Component trace: shared recovery copy now lives in `short-term-macos-feedback-model.mjs`.
- Existing Chinese copy is unchanged.
- No feature, state, menu item, save behavior, optimization behavior, or byte mutation path changed.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-feedback-model.mjs`
- Boundary grep for old out-of-scope labels and old inline recovery-message ownership.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

## Risks

- Failure timing and transitions remain in the main app entry because they are coupled to loading, playback, save, optimization, rename, and replacement control flow.
- This is structural UI/UX cleanup only; it does not change visual styling.

## Next Steps

- Continue moving UI-only feedback/page-state construction out of the main app entry.
- Keep functional byte-output paths and Electron bridge calls in explicit app flow code until a broader runtime boundary is designed.
