# Review: short-term-local-path-redaction

## 1. Summary
Centralized short-term local-path redaction and applied it to host open,
inspection, save, and recent-file persistence failures.

This fixes a concrete leak risk where local paths containing spaces could
bypass the older per-file regex and leave directory fragments in diagnostics.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 9956b7cb feat: expose redacted short-term session model
- Uncommitted changes: shared path redaction helper, host action/session wiring, focused redaction tests, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-local-path-redaction.ts
- src/workbench/short-term-host-actions.ts
- src/workbench/short-term-host-session.ts
- src/tests/short-term-host-actions.test.ts
- src/tests/short-term-host-session.test.ts
- docs/reviews/2026-07-02-codex-short-term-local-path-redaction.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep local paths out of host diagnostics and session persistence errors. | Done |
| 2 | Cover paths with spaces, not only simple slash-delimited examples. | Done |
| 3 | Preserve dirty-output recovery when save writing fails. | Done |
| 4 | Avoid UI shell wiring, feature expansion, or generated artifact churn. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-save-execution.test.js dist/tests/short-term-node-host-session.test.js
PASS, 44 tests

$ git diff --check
PASS
```

## 6. Output inspection
- Not applicable. This is a diagnostics privacy hardening change and does not
  generate SVGA, preview media, app packages, or review ZIPs.

## 7. Risks
- The generic fallback redactor may remove more detail than necessary for
  unusual absolute-path messages. Exact known paths are redacted first to keep
  common save/open diagnostics readable.

## 8. Next steps
- Continue consolidating short-term host safety helpers where duplicated
  privacy or action-boundary logic remains.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
