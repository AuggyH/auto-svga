# Review: optimization compare session

## 1. Summary
Added a host-neutral S10 optimization compare session model. It wraps the
existing optimization workflow, enters before/after comparison only when a
validated optimized output exists, keeps preview unchanged for no-op or failed
optimization, carries the S14 save state from the optimized output, and supports
cancel back to source preview.

This is main-engineering contract work only. It does not wire real behavior
into the temporary UI/UX shell.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `e665ca9`
- Uncommitted changes: source/test/review files for this task
- Untracked files: `docs/research/figma-make-short-term-uiux-prompt.md` was
  already present and was not touched

## 3. Changed files
- `src/workbench/short-term-optimization-compare-session.ts`
- `src/tests/short-term-optimization-compare-session.test.ts`
- `docs/reviews/2026-07-02-codex-optimization-compare-session.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | S10: enter before/after optimization comparison only after real output | Done |
| 2 | S10: keep current preview when optimization is not applicable or fails | Done |
| 3 | S10/S14: comparison carries save state only for validated optimized output | Done |
| 4 | S10: cancel comparison returns to source preview | Done |
| 5 | Temporary UI/UX shell remains untouched | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
passed

$ node --test dist/tests/short-term-optimization-compare-session.test.js dist/tests/short-term-optimization-workflow.test.js dist/tests/short-term-save-state.test.js
9 tests passed

$ npm run test:all
287 tests passed
```

## 6. Output inspection
- Optimizable fixture enters `optimizationComparison` with before and after
  hashes and enabled save state.
- No-op fixture stays in `preview`, has no after side, and keeps save disabled.
- Cancelled session returns to `preview`, disables save, and drops optimized
  bytes from the session result.

## 7. Risks
- This does not perform visual playback comparison. The host/player layer still
  needs to render the before/after bytes once real UI integration is stable.

## 8. Next steps
- Add imageKey rename preview/dirty session or connect optimization comparison
  to the native host once UI integration points are stable.

## 9. Commit
- Commit: this task commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
