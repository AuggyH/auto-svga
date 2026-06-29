# SVGA Workbench v1 Lessons Candidates

Use this file only for verified, reusable observations from the autonomous run.
Do not copy raw chat history or unverified guesses here.

## Host source identity must survive renderer file loading

- Context: desktop Save As flows for edited or optimized SVGA bytes need a
  host-issued `sourceId` so the main process can prove the output is saved to a
  new path instead of overwriting the original.
- Problem: the Electron menu injection path attached `autoSvgaSourceId` and
  `autoSvgaSourceHash` to the injected `File`, but the shared frontend loader
  did not preserve those fields in `players.a.sourceIdentity`.
- Rule: any future renderer file-loading path that originates from trusted
  desktop host IPC must forward host source identity into the product state
  before exposing Save As actions.
- Validation: `node --test tools/shared/product-frontend/source-sharing.test.mjs`,
  `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`,
  and `npm run desktop:smoke` passed on 2026-06-30.
