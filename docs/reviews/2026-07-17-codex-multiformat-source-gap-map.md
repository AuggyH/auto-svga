# Multi-format Source Gap Map

## Summary

While `8015bd668054fcbc3fd42ce36d43c47c6a7d6a3f` and `510f843e3591e50889851cf7e8599a138f08848d` remain queued review heads, this successor adds a no-launch source gap map for the remaining material-readiness rows.

The audit found that external-image Lottie, fusion-capable VAP, and Lottie/VAP cross-source replacement isolation already have source-side coverage. The missing piece was a bounded artifact that separates source-closed rows from rows that still require runtime, owner-material, or installed QA evidence.

## Source Binding

- Base / predecessor: `510f843e3591e50889851cf7e8599a138f08848d`
- Branch: `codex/0.2-multiformat-source-gap-map-20260717`
- Status: `Source Gap Map Ready / Not CR-approved / Not QA-ready`

Product diff SHA-256 over changed source/test files:

`2ab98faa2190f5465f80249fb7a76c884ad840afb54a29f9bdcad7882f5d2cfd`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-source-gap-map.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`

## Behavior

`run-multiformat-source-gap-map.cjs` writes a path-redacted JSON artifact that classifies:

- task-owned external-image Lottie source oracle: `source_closed`;
- task-owned fusion-capable VAP source oracle: `source_closed`;
- Lottie/VAP cross-source replacement isolation: `source_closed_pending_review`;
- distinct-DPR acceptance artifact: `source_closed_pending_review`;
- real external-image Lottie owner material: `runtime_or_owner_material_qa_required`;
- real fusion-capable VAP owner material: `runtime_or_owner_material_qa_required`.

The artifact records source assertion hashes and fixture-contract identity without raw owner paths, production material paths, Electron launch, foreground use, QA route, Packaging route, or product acceptance claims.

## Failure-First Coverage

New tests prove:

- the source gap map distinguishes source-closed rows from runtime/owner-material rows;
- duplicate row ids are rejected;
- malformed source/runtime status combinations are rejected;
- required source rows cannot be omitted silently;
- generated proof does not leak task fixture raw paths or owner paths.

## Validation

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-source-gap-map.cjs`
- `node --check tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`
- `node --test --test-name-pattern "source gap map" tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`: PASS 2/2
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`: PASS 5/5
- `node --test --test-name-pattern "source reopen clears stale|Apply completion cannot cross|image Apply completion" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`: PASS 3/3
- `node tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-source-gap-map.cjs`: PASS, pre-commit SHA `92c61bea16fd32c1f4b7424781342fae6b402d3c1e5dc46254ad684a59be89e3`
- `npm run build`: PASS
- `npm run test:all`: PASS 542/542
- `node tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`: PASS

## Boundaries

- No Electron, Auto SVGA, Finder, foreground, native chooser, install, Packaging, promotion, QA route, owner material access, screenshots, dependency install, or escalation.
- No UI styling, host main/preload/IPC/session/picker/placement/filesystem, runtime playback, replacement, Reset, or Save behavior changed.
- No installed QA, pixel fidelity, Product Owner acceptance, support, distribution, or release readiness claim.

## Remaining Gates

- `8015bd66` open-isolation repair and `510f843e` DPR readiness still require independent Code Review disposition before downstream Packaging/QA.
- Real external-image Lottie and real fusion-capable VAP rows still require private material binding plus runtime/installed QA evidence.
- Distinct-DPR row requires a rebuilt installed artifact and real display observation.

## Retrospective

The tempting next patch would have been yet another material oracle, but the source already had one. The useful product gap was evidence classification: downstream installed rows need a durable map that says which claims are source-closed and which are still runtime-only. Keeping that distinction machine-readable should reduce false PASS risk without touching product runtime behavior.
