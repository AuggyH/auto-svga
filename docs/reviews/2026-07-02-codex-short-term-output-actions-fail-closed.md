# Review: short-term-output-actions-fail-closed

## 1. Summary
Added a direct host-action guard so output-producing short-term actions fail
closed when called without an opened SVGA source:

- run optimization
- rename imageKey
- replace image preview

This matters because these actions now have first-class session methods. They
can no longer rely only on disabled menu items to avoid invalid calls.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: a9affb0c feat: add short-term session action surface
- Uncommitted changes: fail-closed guard, action/session tests, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-host-actions.ts
- src/tests/short-term-host-actions.test.ts
- src/tests/short-term-host-session.test.ts
- docs/reviews/2026-07-02-codex-short-term-output-actions-fail-closed.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Output-producing direct actions do not throw in launch state. | Done |
| 2 | Host actions return a redacted blocked result with a diagnostic. | Done |
| 3 | Session first-class methods preserve the same fail-closed behavior. | Done |
| 4 | Existing menu dispatch behavior is unchanged. | Done |
| 5 | No temporary UI shell wiring or product-surface expansion. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ git diff --check
PASS

$ node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js
PASS, 30 tests

$ npm run test:all
PASS, 346 tests
```

## 6. Output inspection
- Not applicable. This is a fail-closed host/session contract and does not
  generate SVGA, preview media, or app packages.

## 7. Risks
- The eventual UI still needs to preserve command enabled/disabled states for
  user clarity. This guard is a safety boundary, not a replacement for good UI
  affordances.

## 8. Next steps
- Continue auditing direct session methods for state-machine preconditions and
  source/output immutability.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
