# SVGA Workbench Sequence Byte Candidate

## Summary

Added a smoke-only byte-producing sequence repair candidate behind the
failure-first `validateSequenceByteRepairProof` contract.

The candidate proves the mechanical edit path can produce changed SVGA bytes,
reopen them, and bind a resource-level before/after diff. It does not expose
product Save As, does not write through a user-facing sequence repair path, and
does not claim visual repair success.

## Changed Files

- `tools/shared/product-frontend/product-app.mjs`
- `tools/shared/product-frontend/source-sharing.test.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/sequence-repair-proof-contract.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/autonomous/SVGA_WORKBENCH_V1_STATUS.md`
- `docs/autonomous/AUTONOMOUS_RUN_LOG.md`

## Requirement Checks

- Byte-producing sequence proof is accepted only through `validateSequenceByteRepairProof`.
- No-op/source-reopen evidence is rejected by test.
- Source hash remains immutable: `ba61641e4faf4e749baf2c9bcecd0cba5f1c460ffdcb147460168ed3c11c012c`.
- Edited hash differs from source: `2b90f75c38fddc3d81eea01e071e74210b9f65e09f55661057abfb9f18a3e76e`.
- Resource diff is bounded to one candidate key: `img_1`.
- Before resource hash: `ec4dc12646e2847781bbaff67af2b27a9034edd77067fef44ce5afd6dd71067b`.
- After resource hash: `9a46069864408a65010780a0fa08a7350029c060818f3560f5cf3381485d74a6`.
- Reopened playback, nonblank canvas, inspection, and rendered proof passed.
- `writeAttempted=false`, `productSaveAsEnabled=false`, `writeActionExposed=false`.
- `repairSuccessClaimed=false` and `manualVisualConfirmationRequired=true`.

## Verification

- `node --check tools/shared/product-frontend/product-app.mjs` PASS
- `node --check tools/electron-prototype/experiments/svga-web/main.cjs` PASS
- `node --check tools/electron-prototype/experiments/svga-web/sequence-repair-proof-contract.cjs` PASS
- `git diff --check` PASS
- `node --test tools/shared/product-frontend/source-sharing.test.mjs` PASS, 7/7
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test` PASS, 23/23
- `npm run desktop:smoke` PASS

## Regression Boundary

- No default product Save As path was added for sequence repair.
- No text editing, key rename, URL import, structural edit, or timeline edit was added.
- No external AI or network service was added.
- No generated runtime output or real design asset is committed.

## Risks

- The byte candidate uses image replacement mechanics as the first bounded
  repair primitive. It still needs owner-visible before/after review and manual
  visual confirmation before any user-facing acceptance path.
- The internal macOS package should be refreshed again after final autonomous
  review artifacts are complete so the ZIP build commit matches the final head.
