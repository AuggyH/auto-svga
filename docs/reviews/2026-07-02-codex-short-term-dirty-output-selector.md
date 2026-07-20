# Review: short-term-dirty-output-selector

## 1. Summary
Centralized the short-term host dirty-output predicate in the lifecycle module
and reused it from host actions. This keeps open, recent-open, close,
output-producing operations, app quit, and future window lifecycle checks on
one definition of "unsaved output".

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 308d085d fix: guard short-term quit menu lifecycle
- Uncommitted changes: dirty-output selector reuse, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-host-lifecycle.ts
- src/workbench/short-term-host-actions.ts
- docs/reviews/2026-07-02-codex-short-term-dirty-output-selector.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep S14 dirty-output behavior unchanged. | Done |
| 2 | Remove duplicated dirty-output predicate logic from host actions. | Done |
| 3 | Avoid UI shell wiring, product-scope changes, and unrelated refactors. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ git diff --check
PASS

$ node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js
PASS, 24 tests

$ npm run test:all
PASS, 337 tests
```

## 6. Output inspection
- Not applicable. This is a host/session code-quality change only.

## 7. Risks
- Low. The predicate still checks the same two state sources:
  `activeOutputBytes` and `facade.model.activeOutput`.

## 8. Next steps
- Continue reducing drift-prone host/session boundaries before real native
  shell integration.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
