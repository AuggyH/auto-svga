# Review: short-term-host-lifecycle-guard

## 1. Summary
Added a pure short-term host lifecycle decision for future native window close
and app quit handling. The session can now report whether close/quit is allowed
or blocked by unsaved output without mutating the loaded file, recent files, or
active output bytes.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 0480bf20 fix: guard dirty short-term output operations
- Uncommitted changes: lifecycle guard, session surface, session tests, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-host-lifecycle.ts
- src/workbench/short-term-host-session.ts
- src/tests/short-term-host-session.test.ts
- docs/reviews/2026-07-02-codex-short-term-host-lifecycle-guard.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Preserve S14 dirty/save protection for app quit and window close callers. | Done |
| 2 | Keep lifecycle evaluation read-only until the caller explicitly performs close or quit. | Done |
| 3 | Keep local paths redacted from lifecycle decision payloads. | Done |
| 4 | Do not connect the temporary UI shell or add broad UI polish. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ git diff --check
PASS

$ node --test dist/tests/short-term-host-session.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-menu-routing.test.js
PASS, 26 tests

$ npm run test:all
PASS, 336 tests
```

## 6. Output inspection
- Not applicable. This task is a host/session state contract change and does
  not generate SVGA, GIF, preview, or app package output.

## 7. Risks
- Future native shell code must call `evaluateLifecycleRequest` before allowing
  window close or app quit, then only proceed after explicit discard
  confirmation when the decision is blocked.

## 8. Next steps
- Continue tightening mainline host/session contracts that future native UI can
  call without inheriting old Workbench/P6 shadow flows.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
