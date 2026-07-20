# Review: ASV-REQ-20260709-002 runtime structure implementation

## 1. Summary

Implemented short-term runtime structure diagnostics and the safe S18 structure
optimization subset for SVGA Preview.

- Added parser-backed runtime structure diagnostics: runtime object count,
  animation frame-record count, alpha-positive / invisible ratios, active
  visible peak/average, sequence-frame fanout, estimated structure memory, and
  all-zero runtime-object candidates.
- Added right-information product model facts with friendly labels:
  `运行时结构`, `运行对象数`, `动画帧记录数`, `活跃绘制峰值/平均`,
  `不可见记录占比`, and `序列帧展开风险`.
- Added safe all-zero runtime object pruning in the SVGA optimizer, with newly
  unreferenced image cleanup, before/after structure metrics, reopen/decode
  validation, reference-closure checks, and source immutability.
- Kept target-player low-alpha pruning, FPS resampling, sequence-fanout
  reduction, and rebake/collapse review-only / not executable.

`ASV-REQ-20260709-001` remains queued for QA optimization-matrix evidence; this
implementation only touched the shared net-effect gate while doing S18 work.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `5e5ad8fa4c5789f9c2f0ad87e34ec87a4316c388`
- Implementation commit: `7ff1bf4a30930b6fb158a28c8727be03e07659e3`
- Uncommitted changes not owned by this review remain in:
  `docs/product/SHORT_TERM_DISTRIBUTION_PREP.md`,
  `docs/quality/PROJECT_TEST_ENGINEER_WORKFLOW.md`,
  `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`,
  `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`,
  `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`,
  `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`,
  plus untracked QA/release artifacts already present in the worktree.

## 3. Changed files

- `src/workbench/runtime-structure-diagnostics.ts`
- `src/workbench/asset-intelligence.ts`
- `src/workbench/avatar-frame-inspection-report.ts`
- `src/workbench/short-term-product-model.ts`
- `src/workbench/short-term-optimization-workflow.ts`
- `src/workbench/svga/asset-optimizer.ts`
- `src/workbench/svga/format-adapter.ts`
- `src/workbench/svga/node-protobuf-inspector.ts`
- `src/workbench/svga/types.ts`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-render-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- Targeted tests under `src/tests/`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | S17 separates runtime structure risk from decoded image memory | Done |
| 2 | Friendly right-side labels, no default `SpriteEntity` / `FrameEntity` / `图层数` wording | Done |
| 3 | Risk / warning / optimization-candidate fields visible in default summary | Done for model and render filter |
| 4 | Safe all-zero runtime-object pruning + newly unreferenced cleanup | Done |
| 5 | Before/after structure metrics and save gating | Done |
| 6 | Risky low-alpha/FPS/fanout/rebake items remain non-executable | Done |
| 7 | Real-material QA acceptance | Pending QA after owner-baseline package refresh |

## 5. Verification

```text
npm run build
PASS

node --test dist/tests/runtime-structure-diagnostics.test.js dist/tests/svga-image-optimizer.test.js dist/tests/short-term-optimization-workflow.test.js dist/tests/short-term-product-model.test.js dist/tests/asset-intelligence.test.js
PASS: 19/19

npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
PASS: 37/37
```

The web test suite needed local `127.0.0.1` listener permission; the first
sandboxed attempt failed with `listen EPERM`, then passed after running with
the approved local listener.

## 6. Output inspection

- Runtime structure diagnostics are derived from parsed SVGA runtime sprites:
  `MovieEntity.sprites.length`, `sum(sprite.frames.length)`, and per-frame
  `alpha > 0` visibility.
- Optimization report now records original/optimized image count, runtime object
  count, and animation frame-record count.
- Optimizer safety checks preserve movie params, audio entries, kept image
  hashes, reference closure, and source SHA-256 immutability.
- Product model exposes friendly fields and keeps raw protocol terms in
  evidence/calculation notes only.

## 7. Risks

- Runtime structure memory is still an estimate, not measured mobile memory.
- No target-player threshold profile is active, so low-alpha pruning remains
  disabled.
- Owner local stable app was not refreshed because this checkout still has
  unrelated dirty files. Package/promotion should run from a clean current-head
  baseline before QA owner-client regression.

## 8. Next steps

- Release/Packaging: refresh `/Users/huangtengxin/Applications/Auto SVGA.app`
  from a clean package that includes `7ff1bf4a`.
- QA: regress `ASV-REQ-20260709-002` using high-fanout synthetic or local-only
  lucky-notice aliases, plus one low-risk contrast file.
- QA: continue `ASV-REQ-20260709-001` optimization matrix; route a defect only
  if reverse/no-benefit optimization remains saveable or PRD-listed hidden work
  appears as executable.

## 9. Commit

- Commit: `7ff1bf4a30930b6fb158a28c8727be03e07659e3`
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: PM terminology/disclosure updates arrived during
  implementation; the optimizer needed report, workflow, UI model, and package
  proof binding updates together.
- Avoidable costs: structure diagnostics should have had first-class model
  fields before UI work started, rather than being inferred from resource
  counts.
- Product lessons: user-facing diagnostics need friendly labels while technical
  reports preserve exact protocol calculation sources.
- Technical lessons: optimization success must be tied to explicit target
  metric improvement; valid SVGA bytes alone are not enough.
- Design / interaction lessons: active warnings and optimization candidates
  should be visible by default; low-risk technical detail can stay secondary.
- Process lessons: keep implementation commits separate from handoff docs when
  a final commit hash must be recorded.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes, after QA validates the owner-baseline package.

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: focused PRD/ticket reads plus targeted tests were enough; no
  full historical Workbench rescan was needed.
