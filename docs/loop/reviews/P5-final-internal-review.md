# P5 Final Internal Review

Milestone: P5 — Batch PNG Replacement And Mapping Review
Reviewed implementation commit: `d99efd6be52a2f01c3fbb413a405702017a926f2`
Outcome: HUMAN_REQUIRED

## Summary

P5 implements deterministic multi-PNG mapping, review, conflict handling,
manual resolution, atomic batch transaction metadata, batch undo/redo coverage,
schemaVersion 4 batch round-trip evidence, isolated desktop prototype UI
entrypoints, and product evidence generation.

P5 stops for owner acceptance by contract. It does not start the next editing
capability.

## Changed Files

- `src/workbench/svga/batch-png-mapping.ts`
- `src/workbench/svga/image-edit-history.ts`
- `src/workbench/svga/image-resource-editor.ts`
- `src/workbench/svga/index.ts`
- `src/tests/svga-batch-png-mapping.test.ts`
- `src/tests/svga-image-edit-history.test.ts`
- `src/tests/svga-image-resource-editor.test.ts`
- `tools/electron-prototype/experiments/svga-web/server.mjs`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/prototype.js`
- `tools/electron-prototype/experiments/svga-web/web/styles.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/p5/generate-reports.mjs`
- `package.json`

## Requirement Checks

- P4 owner acceptance preserved: PASS.
- NQ1-R1 PASS preserved: PASS.
- Controlled multi-PNG import: PASS.
- Deterministic exact and normalized mapping rules: PASS.
- Unmatched, ambiguous, duplicate-target, excluded, invalid status handling: PASS.
- Manual mapping resolution: PASS.
- Atomic `batch_replace_resources` transaction metadata: PASS.
- Batch undo/redo unit coverage: PASS.
- Batch preview and isolated UI entrypoints: PASS.
- Save-point validation remains protected: PASS.
- P5 schemaVersion 4 round-trip report: PASS.
- Source immutability: PASS.
- Local security boundary: PASS.
- P1-P4 regression: PASS.
- Scope discipline: PASS; no new formats, conversion, AI, cloud, account, or exporter changes.

## Validation

- `npm test`: PASS, 200/200.
- `npm run p5:reports`: PASS.
- `node --check tools/electron-prototype/experiments/svga-web/web/prototype.js`: PASS.
- `node --check tools/electron-prototype/experiments/svga-web/server.mjs`: PASS.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`: PASS, 15/15.
- `git diff --check`: PASS.

## Product Evidence

Generated under `.artifacts/product/P5`:

- `canonical-batch-fixture.json`
- `batch-mapping-report.json`
- `batch-edit-history-report.json`
- `batch-round-trip-report.json`
- `thumbnail-evidence.json`
- `reviewer-b-product-categories.json`
- `bundle-privacy-audit.json`
- `artifact-index.json`
- `batch-edited-output.svga`
- 15 deterministic PNG state-marker files for batch entry, mapping review,
  manual resolution, apply, undo, redo, export, reopen, corrupt PNG, dimension
  warning, and original/edited comparison states.

Key evidence:

- P5 round-trip report: schemaVersion 4 generated with structural batch
  mapping evidence. Playback and nonblank canvas are bound by live preview
  before Save As; offline product report generation does not assert those
  fields.
- Applied mapping count: 4.
- Privacy findings: 0.
- Edited output SHA-256: `43ccc6ec737e2eb188cac59c10afee41e2defd267678476bd593486e04b520e3`.

## Regression

Not touched:

- SVGA exporter.
- Main Web preview player implementation.
- CLI default flow.
- Browser import / drag-drop / comparison flow.
- Format parser scope beyond existing SVGA image edit path.

## Risks

- Product state PNGs are deterministic local state markers for orientation only.
  They do not independently prove rendered UI state or replace owner
  visual acceptance.
- P5 final owner acceptance is still required before planning the next editing
  capability.
- Production desktop security boundary remains governed by ADR-010 and ADR-011;
  this work does not promote Electron to production.

## Next

Ask owner:

是否接受 P5 多 PNG 批量导入、映射复核、冲突处理、原子应用和批量导出闭环，并允许规划下一项编辑能力？

Safe default if no answer: reject and provide the highest-priority issue.
