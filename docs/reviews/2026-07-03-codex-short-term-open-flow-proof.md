# Review: short-term-open-flow-proof

## Summary

Added structured S1 open-flow evidence for the short-term macOS client. The
desktop smoke run now reports and writes
`.artifacts/product/short-term/short-term-open-flow-proof.json`, covering
drag/drop load, preview reachability, local-only resource loading, path
redaction, and renderer filesystem boundary.

The acceptance matrix now requires this drag/drop proof together with
`normal-runtime-proof.json` for macOS menu/host-dialog opening before S1 can be
marked `pass`.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `127e7ea1 Add short-term acceptance matrix`
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
- `docs/reviews/2026-07-03-codex-short-term-open-flow-proof.md`

## Requirement Checks

| Item | Result |
| --- | --- |
| S1 drag/drop structured proof | Added |
| S1 paired menu/host proof requirement | Added in matrix |
| Renderer filesystem access claim | Explicitly false |
| Product scope changes | None |
| User-visible UI changes | None |

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/scripts/build-short-term-acceptance-matrix.mjs`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
- `npm run desktop:short-term:acceptance-matrix`

Matrix result before final commit binding: `11 pass`, `4 partial`, `1 blocked`.

## Risks

- This closes the evidence gap for S1 only. S2, S4, S7, S11, and S13 still need
  separate follow-up work or a documented blocker.

## Next Steps

After committing, rerun smoke, normal proof, acceptance matrix, and internal
macOS packaging so evidence and the App ZIP bind to the new HEAD.
