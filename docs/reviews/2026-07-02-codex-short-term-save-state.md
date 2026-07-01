# Review: short-term persisted output save state

## 1. Summary
Implemented a shared S14 persisted-output save-state contract. Optimization
and imageKey rename workflows now expose the same `persistedOutput` record when
they produce validated bytes. The shared model enables Overwrite Save and Save
As only for validated output, keeps auto-write disabled, and provides a
post-write byte-hash validation helper so host-layer saving can clear dirty
state only when the saved file matches the verified output.

This does not write files and does not wire the temporary UI/UX shell.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `fbc9053`
- Uncommitted changes: source/test/review files for this task
- Untracked files: `docs/research/figma-make-short-term-uiux-prompt.md` was
  already present and was not touched

## 3. Changed files
- `src/workbench/short-term-save-state.ts`
- `src/tests/short-term-save-state.test.ts`
- `src/workbench/short-term-optimization-workflow.ts`
- `src/tests/short-term-optimization-workflow.test.ts`
- `src/workbench/short-term-rename-workflow.ts`
- `src/tests/short-term-rename-workflow.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-save-state.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | S14: keep save disabled until a persisted output exists | Done |
| 2 | S14: support both Overwrite Save and Save As availability | Done |
| 3 | S14: do not auto-write source bytes | Done |
| 4 | S14: validate saved bytes against the verified output hash | Done |
| 5 | S9/S11: publish the same persisted-output model from optimization and rename | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
passed

$ node --test dist/tests/short-term-save-state.test.js dist/tests/short-term-optimization-workflow.test.js dist/tests/short-term-rename-workflow.test.js
9 tests passed

$ npm run test:all
257 tests passed
```

## 6. Output inspection
- Save state: dirty only when a validated output record exists.
- Save validation: exact saved bytes clear dirty state; mismatched bytes remain
  dirty and fail the save result.
- UI shell: not changed.

## 7. Risks
- This is a state/validation contract only. Actual macOS file writing,
  overwrite path policy, and Save As dialog handling remain host-layer work.

## 8. Next steps
- Wire host-layer Save/Save As commands to this record once the real UI/UX
  page exposes stable integration points.
- Add image replacement output into the same persisted-output contract.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
