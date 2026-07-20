# Short-Term UI/UX WP6S Feedback Banner Model Split Review

## Summary

Moved SaveFeedbackBanner tone and HTML view-state construction into the existing feedback model.

The main app entry now applies the banner view to the DOM, while `short-term-macos-feedback-model.mjs` owns status derivation and escaped banner HTML.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit: pending at review creation time

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-feedback-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-uiux-wp6s-feedback-banner-model-split.md`

## Requirement Checks

- Product authority unchanged: no edits to `docs/product/PRODUCT_ROADMAP.md` or PM-owned PRD files.
- Component trace: `SaveFeedbackBanner` view state now lives in `short-term-macos-feedback-model.mjs`.
- Existing banner tone derivation is preserved through `bannerTone`.
- Existing HTML escaping is preserved by reusing `escapeHtml`.
- No save, optimization, rename, replacement, menu, or product behavior changed.
- No new user-facing copy or product state was added.

## Verification

- `git diff --check`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-feedback-model.mjs`
- `rg -n ...` boundary scans for old out-of-scope labels and old inline banner HTML ownership
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

## Risks

- The app entry still owns when feedback is shown because those calls are coupled to real save/optimization/rename/replacement flow state.
- This slice is structural only; it does not improve visual quality of the banner.

## Next Steps

- Continue extracting UI-only view state from the main entry while preserving byte-output and host-bridge ownership.
- Defer visual styling changes until the remaining page-state ownership is clearer.
