# Review: Short-term Preview QA Fixes

## Summary

Fixed the implementation-owner side of ASV-QA-20260708-001, ASV-QA-20260708-002, and ASV-QA-20260708-003. The branch returns `Fix Ready` only; QA still owns independent regression and ticket closure.

## Git State

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Base head before fix: `c2a6a85039e43c27d091e7d69d4dc9faf98a56e4`
- Final fix commit: see final handoff.

## Changed Files

- Playback aspect fit:
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-fit-model.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-model.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
  - `tools/electron-prototype/experiments/svga-web/tests/short-term-playback-fit.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- Replacement slot normalization:
  - `src/workbench/short-term-image-replacement-workflow.ts`
  - `src/tests/short-term-image-replacement-workflow.test.ts`
  - `src/tests/short-term-image-replacement-preview-session.test.ts`
- Text-semantic classification:
  - `src/workbench/short-term-product-model.ts`
  - `src/tests/short-term-product-model.test.ts`
- QA evidence and review:
  - `docs/quality/reports/ASV-QA-20260708-001-fix.md`
  - `docs/quality/reports/ASV-QA-20260708-002-fix.md`
  - `docs/quality/reports/ASV-QA-20260708-003-fix.md`
  - `docs/quality/evidence/ASV-QA-20260708-001/callback-evidence.json`
  - `docs/quality/evidence/ASV-QA-20260708-002/callback-evidence.json`
  - `docs/quality/evidence/ASV-QA-20260708-003/callback-evidence.json`

## Requirement Checks

- ASV-QA-20260708-001: Preview canvas now uses movie aspect-ratio based fit and a resize observer, covering wide `981 x 360` style content on load and resize.
- ASV-QA-20260708-002: Short-term replacement preview now normalizes mismatched PNG replacements to the original embedded imageKey dimensions before preview/output bytes are produced.
- ASV-QA-20260708-003: `text1`, `text2`, `from`, `to`, and related deterministic text-semantic keys now enter runtime text classification instead of image replacement classification.

## Verification

- `npm run build` - PASS
- `node --test dist/tests/short-term-product-model.test.js dist/tests/short-term-image-replacement-workflow.test.js dist/tests/short-term-image-replacement-preview-session.test.js dist/tests/svga-image-resource-editor.test.js dist/tests/nq1-r1-hardening.test.js` - PASS
- `node --test tools/electron-prototype/experiments/svga-web/tests/short-term-playback-fit.test.mjs` - PASS
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` - PASS
- `npm run desktop:short-term:design-system-check` - PASS
- `npm run desktop:smoke` - PASS
- `npm run test:all` - PASS

## Risks And Follow-up

- QA still needs the exact owner production SVGA, replacement PNG, and owner-used build identity for independent regression.
- ASV-QA-20260708-002 intentionally implements the short-term policy as resize-to-original-resource-dimensions, not a configurable contain/crop selector.
- Runtime text display for ASV-QA-20260708-003 still depends on the player bridge. If unavailable for a file, the correct behavior is the explicit unsupported text-preview fallback.

## Project Retrospective

- Product: PM clarification in `c2a6a850` was treated as the source of truth for S13 text semantics.
- Implementation: The replacement-size fix belongs in the short-term workflow, not the generic SVGA resource editor. The full test run caught the first over-broad implementation.
- Validation: Synthetic regression tests cover the reported dimensions and grouping behavior without committing owner production assets.
- Token usage: unavailable.

## Next Step

Return `Fix Ready` to QA with the fix commit and callback evidence paths. QA should rerun the owner reproduction and close only after regression passes.
