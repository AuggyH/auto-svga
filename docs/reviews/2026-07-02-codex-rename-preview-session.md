# Review: rename preview session

## 1. Summary
Added a host-neutral S11 rename preview session model. It wraps the existing
imageKey rename workflow, remounts preview bytes only when rename output is
validated, keeps preview unchanged on failed rename attempts, carries the S14
save state from the renamed output, and supports cancel back to source preview.

This is main-engineering contract work only. It does not wire real behavior
into the temporary UI/UX shell.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `7e13f79`
- Uncommitted changes: source/test/review files for this task
- Untracked files: `docs/research/figma-make-short-term-uiux-prompt.md` was
  already present and was not touched

## 3. Changed files
- `src/workbench/short-term-rename-preview-session.ts`
- `src/tests/short-term-rename-preview-session.test.ts`
- `docs/reviews/2026-07-02-codex-rename-preview-session.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | S11: confirmed rename produces preview bytes in Preview mode | Done |
| 2 | S11: failed rename keeps current preview bytes unchanged | Done |
| 3 | S11/S14: validated rename output carries save state | Done |
| 4 | S11: cancel rename preview returns to source preview | Done |
| 5 | Temporary UI/UX shell remains untouched | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
passed

$ node --test dist/tests/short-term-rename-preview-session.test.js dist/tests/short-term-rename-workflow.test.js dist/tests/short-term-save-state.test.js
9 tests passed

$ npm run test:all
290 tests passed
```

## 6. Output inspection
- Successful rename produces `renameDirty`, changed preview hash, and enabled
  `renamed_svga` save state.
- Rename target collision produces `failed`, keeps source preview hash, and
  leaves save disabled.
- Cancelled session returns to source preview and drops the persisted output.

## 7. Risks
- This does not implement the final inline rename editor or native menu action.
  It is the host-neutral state contract those integrations should consume.

## 8. Next steps
- Continue S13 runtime text preview capability probing, or wire host actions
  when real UI integration points are stable.

## 9. Commit
- Commit: this task commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
