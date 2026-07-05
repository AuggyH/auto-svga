# Short-term UI/UX Empty Copy Minimal Review

## Summary

UI/UX lane removed long explanatory empty-state copy from the Preview right surface's `imageKey` and `运行时文本` sections. Empty replaceable/imageKey and runtime-text states are now expressed through the section heading count, such as `imageKey (0)`, instead of adding explanation paragraphs inside the lists.

This keeps the owner-confirmed boundary-light, canvas-first direction intact: the surface shows required facts and controls without turning absent data into instructional copy. The S7 replaceable-classification proof still verifies automatic image keys are excluded and designer-named keys are included.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit target: right-surface empty-copy minimal WP
- Product/design authority consulted: `docs/product/PRODUCT_ROADMAP.md`, `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`, `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`, `DESIGN.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-text-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Owner-confirmed rule: visible helper/explanatory copy must not appear unless required by the PRD or approved UI/UX docs.
- `imageKey` empty state keeps the section and count but removes explanatory list copy.
- Runtime-text empty state keeps the section and count but removes explanatory list copy.
- S15 audio empty state remains visible because the PRD explicitly requires it.
- S7 classification proof now records minimal empty-state UI separately from classification correctness.
- No product behavior, byte output, replacement logic, rename logic, or save logic changed.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `npm run desktop:smoke` passed.
- `git diff --check` passed.
- Proof artifacts inspected:
  - `.artifacts/product/short-term/short-term-empty-state-proof.json`
  - `.artifacts/product/short-term/short-term-replaceable-classification-proof.json`
- Smoke screenshot inspected:
  `.artifacts/product/short-term/short-term-preview-replaceable.png`
  confirms the `imageKey` and runtime-text empty lists no longer show long explanatory copy.

## Risks

- This does not claim final foreground visual acceptance.
- The proof field names changed from copy-visible language to minimal-state language; downstream evidence should use `noReplaceableImagesMinimal`, `textUnavailableMinimal`, and `automaticEmptyStateMinimal`.

## Next Steps

- Continue reducing unnecessary visual chrome and copy while preserving PRD-required states.
- Run real foreground desktop validation before final UI/UX acceptance.
