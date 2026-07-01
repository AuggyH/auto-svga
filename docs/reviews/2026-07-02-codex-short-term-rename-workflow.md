# Review: short-term imageKey rename workflow

## 1. Summary
Implemented a page-independent S11 imageKey rename workflow contract. The
workflow renames an existing SVGA image resource key, updates all matching
`imageKey` and `matteKey` sprite references, validates that the renamed output
reopens, keeps references closed, proves source bytes remain unchanged, and
exposes S14 save availability only when the renamed bytes pass validation.

This does not wire the temporary UI/UX shell to real rename controls.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `ecb1490`
- Uncommitted changes: source/test/review files for this task
- Untracked files: `docs/research/figma-make-short-term-uiux-prompt.md` was
  already present and was not touched

## 3. Changed files
- `src/workbench/short-term-rename-workflow.ts`
- `src/tests/short-term-rename-workflow.test.ts`
- `tools/svga-player-preview/server.mjs`
- `tools/svga-player-preview/server-inspection-report.test.mjs`
- `docs/reviews/2026-07-02-codex-short-term-rename-workflow.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | S11: rename an existing imageKey in SVGA bytes | Done |
| 2 | S11: update related `imageKey` and `matteKey` references | Done |
| 3 | S11: reject missing source keys, duplicate targets, and unsafe target keys | Done |
| 4 | S11: reopen renamed output and prove no dangling references | Done |
| 5 | S14: save actions disabled unless verified renamed output exists | Done |
| 6 | Avoid binding real behavior into the temporary UI/UX shell | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
passed

$ node --test dist/tests/short-term-rename-workflow.test.js dist/tests/short-term-optimization-workflow.test.js dist/tests/svga-image-optimizer.test.js dist/tests/svga-image-resource-editor.test.js
19 tests passed

$ node --test dist/tests/short-term-rename-workflow.test.js tools/svga-player-preview/server-inspection-report.test.mjs
12 tests passed

$ npm run test:all
254 tests passed
```

## 6. Output inspection
- Renamed SVGA bytes: produced for a fixture with both `imageKey` and
  `matteKey` references.
- Source bytes: hash remains unchanged after workflow execution.
- Reopen validation: renamed bytes inflate/decode and reopen through
  `NodeProtobufSvgaInspector`.
- UI shell: not changed.

## 7. Risks
- Rename target validation is intentionally conservative: empty, unchanged,
  duplicate, slash/backslash, control-character, and overlong keys fail closed.
- Actual desktop Save/Overwrite writing remains a separate host-layer task.

## 8. Next steps
- Introduce a unified persisted-output/save registry that can hold optimization
  and rename outputs under one S14 contract.
- Later connect the real UI/UX page shell once it exposes stable integration
  points.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
