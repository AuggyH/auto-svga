# ASV-REQ-20260709-003 Combined Shell, Placement, And Reset Source Handoff

## Scope

Integrated the approved Reset authority, placement host boundary, and OwnerRightPanelSnapshotV1 shell/right-panel boundary into one combined source successor.

## Exact Inputs

- Reset source: `6a4640875a8bddf5ae2ecbe04334b5cd167a21b3`
- Placement source: `093fcdc7329e11095832fa5ccd2ebbc900bae3b2`
- UI/UX OwnerRightPanelSnapshotV1 source: `ea8ebb7a7b64394198e6c84e5f695a45fa4e3e2a`
- UI/UX review SHA-256: `6da7f85755a85a7b79c55edb20b685906f2d903f57e51d6ef335c378f5718985`
- Product diff SHA-256 for `src/` + `tools/`: `9cbadbb0b9cf60aea3ba0747a2c4d7423d8cb3a2e3b397c88f8bf30e91d12537`

Final commit identity is bound by the Implementation Ready callback after this folder is committed.

## Integrated Behavior

- Target-scoped Reset continues to require public target, canonical runtime key, binding token, kind, source, and generation agreement.
- OwnerRightPanelSnapshotV1 now drives right-panel facts, issues, unsupported features, image rows, text rows, and replacement affordances through the branded snapshot envelope.
- Placement normal restore/fallback and internal execution-bound display-id override remain pre-BrowserWindow source behavior.
- Cancel/Open/replacement/Reset state authority remains separated: Open failure revokes prior preview state, while replacement/reset failures preserve the active document and sibling replacements.
- SVGA 0.1 delegation is preserved and is not activated or destroyed by Lottie/VAP replacement/reset failure paths.

## Integration Fixes

- Resolved controller merge conflicts by preserving Reset action authority while switching text-target rendering to the OwnerRightPanelSnapshotV1 projection.
- Preserved append-only retrospective ledger entries from both approved source lines.
- Excluded VAP fusion image/text resource IDs from generic asset image targets to prevent public image/text collisions.
- Added renderer-private accepted public-to-canonical replacement binding tracking so owner-visible display snapshots do not expose internal runtime keys.
- Updated source-level proof fixtures to include owner snapshot image targets.

## Validation

```text
npm run build
PASS

node --check main/preload/session/controller/product-conformance/test files
PASS

node --test dist/tests/multiformat-owner-preview-candidate.test.js
PASS 19/19

node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs
PASS 27/27

node --test tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement-store.test.mjs
PASS 17/17

node --test --test-name-pattern "macOS package proof|renderer mounts prepared Lottie and VAP runtime payloads" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 6/6

node --test --test-name-pattern "0\\.2|multi-format|replacement|reset|formal 0\\.1|picker|cancel|recent|placement" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 30/30

node --test tools/electron-prototype/experiments/svga-web/tests/*.test.mjs
PASS 132/132

npm run test:all
PASS 538/538

npm run desktop:short-term:design-system-check
PASS

git diff --check
PASS

TASK_RETRO_LEDGER JSONL parse
PASS strict line-by-line parse, 172 rows
```

## Dependency Overlay

The all-Electron source test group used the established temporary ignored overlay from a hash-matched dependency tree. The overlay was removed after validation.

## Hygiene

- No package or lockfile drift.
- No production or owner media added.
- No installed app mutation.
- No foreground action.
- Classified `.pnpm-store/` residue preserved.
- Blank-line JSONL handoff artifact repaired and packet resealed.

## Boundaries

This is not installed QA, Packaging completion, foreground proof, pixel-fidelity acceptance, Product Owner acceptance, product support, distribution readiness, or release readiness.

## Next Gate

PM/A0 independent review, then PM-owned Code Review routing if accepted.
