# Review: Multi-format Owner Envelope Oracle CR Repair

Date: 2026-07-16
Lane: Multi-format
Requirement: ASV-REQ-20260709-003
Branch: `codex/0.2-owner-envelope-oracle-cr-repair-20260716`
Base: `e41fed4d3993191f2506a1eb39e811fd5576f834`
Successor head: `commit-containing-this-review`
Actual model profile: requested `gpt-5.6-sol/xhigh`; active route fallback recorded as `gpt-5.5/xhigh`.

## Disposition

Fix Ready for PM/A0 independent review and same-thread Code Review re-review.

This is a bounded repair for `MF-OWNER-ENVELOPE-CR-001`. It does not route QA,
Packaging, install, foreground, Figma, FBP, bridge, owner material, Product
Owner acceptance, support, distribution, or release.

## Root Cause

The previous task fixture source oracle treated the owner snapshot envelope as
mostly trustworthy after checking only source id, `pathRedacted`, byte length,
SHA-256, and format. It parsed arbitrary digest-self-consistent JSON and then
asserted replacement targets with a subset check. A forged but self-consistent
envelope could add owner fields, path-bearing fields, or extra replaceable
targets and still pass.

## Repair

- `run-multiformat-task-fixture-source-oracle.cjs` now validates owner snapshot
  envelopes through the canonical `OwnerRightPanelSnapshotV1` conformance
  verifier before consuming them.
- The oracle now rejects noncanonical JSON, extra envelope/snapshot/nested
  keys, wrong schema version, byte/hash drift, source mismatch,
  `pathRedacted` drift, path-bearing fields, and invalid snapshot fields.
- Lottie and VAP fixture owner projections now require exact image target,
  text target, and replaceable inventory target set equality.
- Inventory summary counts are recomputed from groups and rejected on drift.
- The task fixture contract now records the actual Lottie text public/runtime
  target as `text:2`, matching the owner model and runtime path.

## Failure-First Evidence

Before the repair, the new adversarial source-oracle test failed with
`Missing expected exception` when a digest-self-consistent owner envelope
included an extra path field. That reproduced the Code Review finding shape
without launching Electron or using foreground resources.

The committed test now covers:

- extra path-bearing owner field;
- extra replaceable target;
- missing target;
- duplicate target;
- recomputed-hash fake envelope;
- noncanonical JSON ordering.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-task-fixture-source-oracle.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/multiformat-task-runtime-fixtures.cjs`

Product diff SHA-256 over the changed source/test files from `e41fed4d`:

`8e48e5f3c9a656765b72d5710924aac8037c326b08a64f27ecb4ff282473302c`

## Validation

- Failure-first focused oracle test before repair: FAIL as expected.
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`: PASS 3/3.
- `node --check tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-task-fixture-source-oracle.cjs`: PASS.
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs`: PASS 28/28.
- `node --test dist/tests/multiformat-owner-preview-candidate.test.js`: PASS 19/19.
- `npm run build`: PASS.
- `npm run test:all`: PASS 538/538.
- `npm run desktop:short-term:design-system-check`: PASS.
- `git diff --check`: PASS.

## Privacy And Boundary

No raw owner paths, production material, Electron launch, installed app
mutation, foreground control, Finder, native chooser, Figma/FBP, bridge,
dependency install, QA, Packaging, or Product Owner acceptance action was
performed. The repair is source-only and evidence-bound.

## Retrospective

Evidence oracles that consume branded owner-visible payloads must validate the
same canonical envelope that the renderer consumes. Checking only digest and a
subset of expected records proves payload self-consistency, not owner-envelope
authority.
