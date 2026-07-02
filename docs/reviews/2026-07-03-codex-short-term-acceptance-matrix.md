# Review: short-term-acceptance-matrix

## Summary

Added a short-term S1-S16 acceptance matrix generator for the macOS client
evidence lane. The generator reads current product proof artifacts, binds them
to the current Git HEAD, and writes
`.artifacts/product/short-term/short-term-acceptance-matrix.json`.

This is a verification and handoff improvement only. It does not add product
scope, UI controls, sequence repair, export acceptance, or advanced editing.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `509e8225 Expand short-term menu proof`
- Known unrelated working tree items left untouched:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/PRODUCT_ROADMAP.md`
  - `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
  - `docs/research/figma-make-short-term-uiux-prompt.md`
  - `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/scripts/build-short-term-acceptance-matrix.mjs`
- `tools/electron-prototype/experiments/svga-web/package.json`
- `package.json`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-03-codex-short-term-acceptance-matrix.md`

## Requirement Checks

| Item | Result |
| --- | --- |
| S1-S16 current-head evidence summary | Added |
| Stale artifact detection | Added |
| S13 text preview gap remains truthful | Added as `blocked`, not a pass |
| Release-candidate readiness auto-claim | Not allowed unless every S1-S16 item is `pass` |
| Product scope changes | None |

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/scripts/build-short-term-acceptance-matrix.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:acceptance-matrix`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `git diff --check`

Initial matrix output correctly reported stale proof when existing artifacts
were bound to older heads. Current-head smoke, normal proof, matrix refresh, and
package refresh should run after this commit so generated evidence binds to the
new commit.

## Risks

- The matrix is intentionally strict. It will keep `releaseCandidateReady`
  false while S1/S2/S4/S7/S11/S13 evidence remains partial, missing, or blocked.
- It summarizes evidence quality; it does not replace Product Owner acceptance.

## Next Steps

After committing, rerun desktop smoke, normal proof, the acceptance matrix, and
the internal macOS package command so the proof set and App ZIP bind to the new
HEAD.
