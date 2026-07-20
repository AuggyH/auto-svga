# Review: short-term save execution

## 1. Summary
Added a host-neutral S14 save execution model. It creates redacted save plans
from validated `persistedOutput` records, keeps host file writing outside the
core model, validates read-back bytes after the host write, clears dirty only
when hashes match, and keeps dirty when writes fail or bytes mismatch.

This is main-engineering contract work only. It does not wire real behavior
into the temporary UI/UX shell.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `f935701`
- Uncommitted changes: source/test/review files for this task
- Untracked files: `docs/research/figma-make-short-term-uiux-prompt.md` was
  already present and was not touched

## 3. Changed files
- `src/workbench/short-term-save-execution.ts`
- `src/tests/short-term-save-execution.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-save-execution.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | S14: Save and Save As require a validated persisted output | Done |
| 2 | S14: save plan redacts target path from product-facing state | Done |
| 3 | S14: read-back bytes are validated against expected output hash | Done |
| 4 | S14: successful validation clears dirty | Done |
| 5 | S14: mismatch or write failure keeps dirty | Done |
| 6 | Temporary UI/UX shell remains untouched | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
passed

$ node --test dist/tests/short-term-save-execution.test.js dist/tests/short-term-save-state.test.js dist/tests/short-term-app-state.test.js
16 tests passed

$ npm run test:all
284 tests passed
```

## 6. Output inspection
- `readyToWrite` plan is produced only when the selected command is enabled by
  `persistedOutput.saveState`.
- Target paths are reduced to display names before product-facing state.
- Exact read-back bytes produce `saveComplete` and `dirty=false`.
- Mismatched bytes and host write exceptions produce `saveFailed` and
  `dirty=true`.

## 7. Risks
- This model does not write files itself. Native host integration still needs to
  perform the controlled write and pass read-back bytes into this validator.

## 8. Next steps
- Connect this model to native Save/Save As host actions when the real UI/host
  integration points are stable.

## 9. Commit
- Commit: this task commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
