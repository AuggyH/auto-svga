# Short-Term Replaceable Classification Proof

## Summary

Added current-head evidence for short-term requirement S7: designer-named image keys are considered replaceable, while automatic image keys such as `img_000` remain excluded.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `fedddff3`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/build-short-term-acceptance-matrix.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- S7 now writes `short-term-replaceable-classification-proof.json`.
- The proof records excluded automatic image-key examples and included designer image keys.
- The short-term acceptance matrix now treats S7 as pass only when the explicit include/exclude proof passes.

## Verification

- Pending in this branch before commit:
  - syntax checks
  - targeted unit tests
  - desktop smoke
  - short-term acceptance matrix

## Risks

- This is proof/reporting work only. It does not expand short-term product scope or add new UI features.
