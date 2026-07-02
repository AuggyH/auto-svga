# Review: short-term-load-failure-proof

## Summary

Added structured S2 load-failure and recovery evidence for the short-term
macOS client. The desktop smoke run now writes
`.artifacts/product/short-term/short-term-load-failure-proof.json`, covering an
invalid SVGA drag/drop attempt, visible failure copy, stale metadata clearing,
API rejection, valid-file recovery, playback recovery, and source-byte
restoration.

The acceptance matrix now reads this proof, but S2 intentionally remains
`partial` until playback-failure-specific abnormal-state proof is added.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `66ff0eca Prove short-term open flow`
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
- `docs/reviews/2026-07-03-codex-short-term-load-failure-proof.md`

## Requirement Checks

| Item | Result |
| --- | --- |
| Invalid-file visible failure | Added |
| Stale metadata cleared after failure | Added |
| Valid-file recovery | Added |
| Source bytes restored after recovery | Added |
| Playback-failure-specific proof | Still open |
| Product scope changes | None |

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/scripts/build-short-term-acceptance-matrix.mjs`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
- `npm run desktop:short-term:acceptance-matrix`

Matrix result before final commit binding: `11 pass`, `4 partial`, `1 blocked`.

## Risks

- S2 is not complete until a real playback-abnormal proof is added or a
  precise product/technical decision says invalid/load failure coverage is
  sufficient for the first distributable.

## Next Steps

After committing, rerun smoke, normal proof, acceptance matrix, and macOS
internal packaging so evidence and package bind to the new HEAD.
