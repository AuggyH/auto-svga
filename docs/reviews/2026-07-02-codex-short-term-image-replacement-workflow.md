# Review: short-term image replacement workflow

## 1. Summary
Implemented a page-independent S12/S14 image replacement workflow contract.
The workflow accepts one short-term replaceable `imageKey` and PNG bytes,
reuses the existing SVGA image resource editor for PNG validation and
round-trip checks, produces replaced SVGA bytes when safe, and publishes the
same S14 `persistedOutput` record used by optimization and imageKey rename.

This does not wire the temporary UI/UX shell to real replacement controls.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `91cda76`
- Uncommitted changes: source/test/review files for this task
- Untracked files: `docs/research/figma-make-short-term-uiux-prompt.md` was
  already present and was not touched

## 3. Changed files
- `src/workbench/short-term-image-replacement-workflow.ts`
- `src/tests/short-term-image-replacement-workflow.test.ts`
- `tools/svga-player-preview/server.mjs`
- `tools/svga-player-preview/server-inspection-report.test.mjs`
- `docs/reviews/2026-07-02-codex-short-term-image-replacement-workflow.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | S12: replace one designer-named imageKey with PNG bytes | Done |
| 2 | S12: reject automatic image keys from the short-term replaceable surface | Done |
| 3 | S12: fail closed for invalid PNG inputs | Done |
| 4 | S14: publish validated replacement output through `persistedOutput` | Done |
| 5 | S14: keep save disabled unless round-trip and reopen validation pass | Done |
| 6 | Avoid binding real behavior into the temporary UI/UX shell | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
passed

$ node --test dist/tests/short-term-image-replacement-workflow.test.js dist/tests/short-term-save-state.test.js dist/tests/svga-image-resource-editor.test.js tools/svga-player-preview/server-inspection-report.test.mjs
28 tests passed

$ npm run test:all
260 tests passed
```

## 6. Output inspection
- Replaced SVGA bytes: produced for a designer-named imageKey fixture.
- Source bytes: hash remains unchanged after workflow execution.
- Reopen validation: replaced bytes inflate/decode and reopen through
  `NodeProtobufSvgaInspector`.
- Service boundary: JSON API accepts SVGA base64 and replacement PNG base64.
- UI shell: not changed.

## 7. Risks
- This is a persisted replacement-output contract, not the final runtime
  preview/remount interaction.
- Actual desktop file writing remains host-layer work.

## 8. Next steps
- Add S12 runtime replacement preview/reset session state for real preview
  integration.
- Later connect the real UI/UX page shell once it exposes stable integration
  points.

## 9. Commit
- Commit: this task commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
