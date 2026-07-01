# Review: short-term optimization workflow

## 1. Summary
Implemented a page-independent short-term optimization workflow contract for
S9/S10/S14. The workflow runs the existing safe SVGA image optimizer, produces
optimized bytes when safe, exposes a product-facing comparison/result model,
reports exactly which optimization actions ran, marks unsupported/review-only
methods honestly, and keeps save actions disabled when no verified output
exists.

This does not wire the temporary UI/UX shell to real file-open or playback
behavior.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `4652b99`
- Uncommitted changes: source/test/review files for this task
- Untracked files: `docs/research/figma-make-short-term-uiux-prompt.md` was
  already present and was not touched

## 3. Changed files
- `src/workbench/short-term-optimization-workflow.ts`
- `src/tests/short-term-optimization-workflow.test.ts`
- `tools/svga-player-preview/server.mjs`
- `tools/svga-player-preview/server-inspection-report.test.mjs`
- `docs/reviews/2026-07-02-codex-short-term-optimization-workflow.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | S9: real optimization produces optimized SVGA bytes when safe actions exist | Done |
| 2 | S9: report binds before/after metrics, actions, source immutability, output hash, and validation state | Done |
| 3 | S10: comparison/result model explains concrete changed items and effects | Done |
| 4 | S14: save actions remain disabled unless verified optimized output exists | Done |
| 5 | Fail closed for no-op or invalid SVGA inputs | Done |
| 6 | Avoid binding real behavior into the temporary UI/UX shell | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
passed

$ node --test dist/tests/short-term-optimization-workflow.test.js dist/tests/svga-image-optimizer.test.js dist/tests/short-term-product-model.test.js tools/svga-player-preview/server-inspection-report.test.mjs
15 tests passed

$ npm run test:all
251 tests passed
```

## 6. Output inspection
- Optimized SVGA bytes: produced for duplicate/unreferenced image fixtures.
- Source bytes: hash remains unchanged after workflow execution.
- Reopen validation: optimized bytes inflate/decode and reopen through
  `NodeProtobufSvgaInspector`.
- UI shell: not changed.

## 7. Risks
- Current executable optimization methods are limited to byte-identical image
  deduplication and unreferenced image removal.
- Image compression, transparent-bound trimming, sequence-frame processing,
  FPS adjustment, and canvas adjustment are explicitly marked not implemented
  or review-only in the model.
- Actual desktop Save/Overwrite writing remains a separate host-layer task.

## 8. Next steps
- Implement the S11 imageKey rename byte-edit workflow contract.
- Add a unified persisted-output/save registry after optimization and rename
  both produce stable output models.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
