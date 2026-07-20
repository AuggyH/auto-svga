# Review: short-term-spec-comparison-proof

## Summary

Added structured S4 Overview production-spec comparison evidence for the
short-term macOS client. The desktop smoke run now writes
`.artifacts/product/short-term/short-term-spec-comparison-proof.json`, covering
the active profile id, rendered fact row count, actual values, requirement
values, row statuses, and the absence of a separate production-spec module.

The acceptance matrix now marks S4 `pass` only when this structured proof and
the Overview screenshot are current-head bound.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `01ee3638 Prove short-term load failure recovery`
- Known unrelated working tree items left untouched:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/PRODUCT_ROADMAP.md`
  - `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
  - `docs/research/figma-make-short-term-uiux-prompt.md`
  - `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/build-short-term-acceptance-matrix.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-03-codex-short-term-spec-comparison-proof.md`

## Requirement Checks

| Item | Result |
| --- | --- |
| S4 actual value rows | Added |
| S4 requirement rows | Added |
| Active profile id | `production_target` |
| Separate production-spec module | Confirmed absent |
| Product scope changes | None |
| User-visible UI changes | None |

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/scripts/build-short-term-acceptance-matrix.mjs`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
- `npm run desktop:short-term:acceptance-matrix`

Matrix result before final commit binding: `12 pass`, `3 partial`, `1 blocked`.

## Risks

- S4 proof is bound to the current built-in `production_target` profile. Future
  configurable profiles will need their own proof once promoted in scope.

## Next Steps

After committing, rerun smoke, normal proof, acceptance matrix, and macOS
internal packaging so evidence and package bind to the new HEAD.
