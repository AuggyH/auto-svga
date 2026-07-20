# Review: image replacement preview session

## 1. Summary
Added a host-neutral S12 image replacement preview session model. The session
starts from source bytes, applies a validated image replacement to preview bytes
without leaving Preview mode, exposes reset back to source bytes, and keeps
failed replacement attempts from changing the current preview.

This stays on the main-engineering side only. It does not wire the temporary
UI/UX shell to real controls.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `3df339d`
- Uncommitted changes: source/test/review files for this task
- Untracked files: `docs/research/figma-make-short-term-uiux-prompt.md` was
  already present and was not touched

## 3. Changed files
- `src/workbench/short-term-image-replacement-preview-session.ts`
- `src/tests/short-term-image-replacement-preview-session.test.ts`
- `tools/svga-player-preview/server.mjs`
- `tools/svga-player-preview/server-inspection-report.test.mjs`
- `docs/reviews/2026-07-02-codex-image-replacement-preview-session.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | S12: apply image replacement in Preview mode | Done |
| 2 | S12: reset replacement preview to source bytes | Done |
| 3 | S12: failed replacement keeps current preview bytes unchanged | Done |
| 4 | S14: valid replacement preview carries the existing save-state contract | Done |
| 5 | Preserve temporary UI/UX shell as a skeleton only | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
passed

$ node --test dist/tests/short-term-image-replacement-preview-session.test.js dist/tests/short-term-image-replacement-workflow.test.js dist/tests/short-term-save-state.test.js dist/tests/svga-image-resource-editor.test.js tools/svga-player-preview/server-inspection-report.test.mjs
34 tests passed

$ npm run test:all
264 tests passed
```

## 6. Output inspection
- Initial session: source bytes equal preview bytes, save disabled.
- Apply replacement: preview bytes change, Preview mode remains active, reset
  is enabled, Save As follows the validated replacement output.
- Reset: preview bytes return to the source hash and save is disabled.
- Rejected apply: current preview bytes and previous valid output remain
  unchanged; the last action carries the failure diagnostic.

## 7. Risks
- This is a host-neutral state/service contract. Real player remounting still
  needs to be wired by the future UI implementation once the shell is ready.

## 8. Next steps
- Continue short-term product state coverage for open/drag/menu/error/recovery
  once the UI shell exposes stable integration points.

## 9. Commit
- Commit: this task commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
