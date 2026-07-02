# 2026-07-03 Codex Short-term S2/S11 Evidence Closeout

## Summary

Closed two short-term macOS evidence gaps without adding product scope:

- S2 now proves invalid-file failure, injected playback failure, visible error copy, recovery to normal playback, and source-byte immutability.
- S11 now exposes current-head runtime proof for imageKey rename decode/reopen, imageKey/matteKey reference closure checks, no dangling references, new key presence, and image byte preservation.
- The acceptance matrix now promotes S2 and S11 only when those current-head proof fields and screenshots are present.

## Git State

Branch: `agent/codex/svga-workbench-v1-autonomous`

Unrelated PM/UIUX documentation changes were present before this work and were not staged.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/build-short-term-acceptance-matrix.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- S2: playback failure is now a real smoke-path state, not only an invalid-file proxy.
- S2: recovery confirms the original source bytes are restored after both invalid-file and playback-failure paths.
- S11: rename proof includes decode/reopen validation, reference closure, and byte preservation.
- S13: remains blocked. Current SVGA proto, parser output, and short-term product model do not expose a real textKey list; the implementation must not invent text elements to claim completion.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`
- `node --check tools/electron-prototype/experiments/svga-web/scripts/build-short-term-acceptance-matrix.mjs`
- `git diff --check -- tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs tools/electron-prototype/experiments/svga-web/main.cjs tools/electron-prototype/experiments/svga-web/scripts/build-short-term-acceptance-matrix.mjs tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm run build`
- `node --test dist/tests/short-term-rename-workflow.test.js`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p2:normal-proof`
- `npm run desktop:short-term:acceptance-matrix` — `15 pass / 1 blocked`, release candidate remains false

## Risks

- S13 is a real product-model/parser boundary. The short-term app has runtime text preview session code for supplied text elements, but no reliable way to discover product-safe textKey entries from current SVGA bytes.
- The matrix should remain not release-candidate-ready until S13 is either implemented from a real text source or Product Owner changes the short-term requirement.
