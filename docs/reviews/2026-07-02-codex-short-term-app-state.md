# Review: short-term app state model

## 1. Summary
Added a host-neutral short-term app state model for S1/S2/S16. It unifies file
button open, drag-and-drop open, menu open, recent-file open, loading,
parse/load failure, playback abnormal, recovery, and recent-file missing states
without wiring real behavior into the temporary UI/UX shell.

The model also exposes grouped macOS menu command availability so UI can render
enabled/disabled actions from product state instead of hardcoded Workbench/P6
legacy flow.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `9417845`
- Uncommitted changes: source/test/review files for this task
- Untracked files: `docs/research/figma-make-short-term-uiux-prompt.md` was
  already present and was not touched

## 3. Changed files
- `src/workbench/short-term-app-state.ts`
- `src/tests/short-term-app-state.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-app-state.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | S1: file button, drag, menu, and recent open enter the same loading flow | Done |
| 2 | S2: parse/load failures clear stale file data and expose recovery actions | Done |
| 3 | S2: playback failure keeps current canvas/file context and supports recovery | Done |
| 4 | S16: recent file labels are path-redacted and missing recent files fail gracefully | Done |
| 5 | App-wide commands are grouped by menu type with enabled/disabled state | Done |
| 6 | S14: save menu availability derives from validated persisted output state | Done |
| 7 | Temporary UI/UX shell remains untouched | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
passed

$ node --test dist/tests/short-term-app-state.test.js dist/tests/short-term-product-model.test.js dist/tests/short-term-image-replacement-preview-session.test.js dist/tests/short-term-save-state.test.js
17 tests passed

$ node --test dist/tests/short-term-app-state.test.js dist/tests/short-term-save-state.test.js
11 tests passed

$ npm run test:all
272 tests passed
```

## 6. Output inspection
- Loading state records source type but redacts full paths from renderer-facing
  state.
- Load failure removes current file data and keeps open/drag/menu recovery.
- Stale request failures are ignored after a newer preview is already ready.
- Playback abnormal keeps the current file and enables replay/open recovery.
- Recent-file missing state does not expose stale metadata.
- Save and Save As menu states now follow the same `persistedOutput.saveState`
  contract used by optimization, rename, and image replacement outputs.

## 7. Risks
- This is a state contract only. Actual native menu, file chooser, drag/drop,
  and player lifecycle wiring still belongs to the final UI implementation
  once the shell is stable.

## 8. Next steps
- Wire native host actions to this model when the UI/UX shell exposes stable
  integration points.
- Extend save command enablement from persisted output state when the host owns
  a current output record.

## 9. Commit
- Commit: this task commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
