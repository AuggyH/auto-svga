# Review: SVGA Workbench Phase 4 Sequence Product Repair

Date: 2026-06-30
Branch: `agent/codex/svga-workbench-v1-autonomous`
Base continued from: `02b48dba5a18a66e12af2cae3c01c256f3ae59c9`

## Summary

Phase 4 now has a product repaired-copy path for the current supported
sequence anti-flicker case. The repair detects a continuous numeric PNG
sequence group, selects exactly one near-empty visible speck resource, replaces
only that resource with a same-dimension transparent PNG, saves the edited SVGA
to a new file through a dedicated IPC path, reopens it, and validates playback,
hash binding, source immutability, and full affected-frame alpha evidence.

## Changed Areas

- `src/workbench/svga/sequence-frame-repair.ts`: fail-closed repair engine.
- `tools/electron-prototype/experiments/svga-web/`: token-bound API, dedicated
  Save As bridge, main-process report/proof validation, and smoke contract
  tests.
- `tools/shared/product-frontend/product-app.mjs`: desktop smoke proof for
  sequence Save As/reopen.
- `tools/svga-workbench/complete-review-package.mjs`: Phase 4 product evidence
  inclusion and historical UI audit metadata.
- `docs/autonomous/`: status, blocker, run log, and lessons updates.

## Verification

- `npm run build`
- `node --test dist/tests/svga-sequence-frame-repair.test.js`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `node --test tools/shared/product-frontend/source-sharing.test.mjs`
- `npm run desktop:smoke`

All listed checks passed during the Phase 4 completion slice.

## Evidence Notes

- Current fixture repair target: `img_14`
- Target visible frames: `[23, 24]`
- Alpha repair: 4 non-transparent pixels before, 0 after
- Changed resource count: 1
- Product proof flags: `productSaveAsEnabled=true`,
  `repairSuccessClaimed=true`, `manualVisualConfirmationRequired=false`
- Known risk: svga-web exact-frame canvas delta is not authoritative for this tiny target:
  awaited frame sampling can record `playbackDeltaObserved=false` even though
  the alpha proof confirms the target resource is removed. The review packet
  should treat full alpha proof as the exact mechanical evidence and canvas
  delta as a nonblocking risk note for Product Owner review.

## Next Review Focus

- Confirm whether the alpha-proofed repaired-copy path is acceptable for
  Workbench v1.
- Decide whether future real-world sequence repairs need a visible canvas-delta
  threshold in addition to alpha proof.
