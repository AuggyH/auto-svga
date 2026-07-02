# Review: short-term-preview-actions-source-guard

## 1. Summary
Tightened preview-action preconditions so preview-only actions require both an
opened current file and opened source bytes:

- reset image replacement preview
- prepare runtime text preview
- apply runtime text preview
- reset runtime text preview

This prevents crafted or stale host/session state from reaching facade methods
that require `sourceBytes` and throwing an internal error.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: ed2e18b8 fix: fail closed short-term output actions
- Uncommitted changes: preview source-byte guard, host-action test, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-host-actions.ts
- src/tests/short-term-host-actions.test.ts
- docs/reviews/2026-07-02-codex-short-term-preview-actions-source-guard.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Preview actions do not throw when `currentFile` exists but `sourceBytes` is missing. | Done |
| 2 | Preview actions return a redacted blocked result with a diagnostic. | Done |
| 3 | Existing valid preview flows remain unchanged. | Done |
| 4 | No temporary UI shell wiring or product-surface expansion. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ git diff --check
PASS

$ node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-workbench-facade.test.js
PASS, 39 tests

$ npm run test:all
PASS, 347 tests
```

## 6. Output inspection
- Not applicable. This is a host/session precondition guard and does not
  generate SVGA, preview media, or app packages.

## 7. Risks
- The eventual UI should still avoid constructing inconsistent initial session
  state. This guard exists as the main-process safety net.

## 8. Next steps
- Continue auditing direct session and host entry points for state-machine
  preconditions and redacted diagnostics.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
