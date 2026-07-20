# Review: short-term-menu-dispatch-prd-trace

## 1. Summary
Refined PRD trace metadata for `menuDispatch` results. Blocked or delegated
menu commands now report the concrete short-term requirement ids for the
command they came from instead of always using the generic menu-dispatch trace.

Unknown menu commands keep an empty PRD trace so unsupported entries are not
overclaimed as product scope.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 318c77d7 fix: serialize short-term host session actions
- Uncommitted changes: menu-dispatch PRD trace mapping, host action tests, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-host-actions.ts
- src/tests/short-term-host-actions.test.ts
- docs/reviews/2026-07-02-codex-short-term-menu-dispatch-prd-trace.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Blocked known menu commands retain command-specific PRD ids. | Done |
| 2 | Native and renderer-delegated commands expose only relevant PRD ids. | Done |
| 3 | Unknown menu commands do not inherit unrelated product PRD ids. | Done |
| 4 | No temporary UI shell wiring or owner-visible layout changes. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build && node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-command-menu.test.js dist/tests/short-term-host-menu-routing.test.js dist/tests/short-term-host-session.test.js
PASS, 41 tests
```

## 6. Risks
- The mapping is explicit. Future menu command additions should update the
  command-menu trace, host route classification, and menu-dispatch trace
  together.

## 7. Next steps
- Continue tightening short-term host/session contracts and run broader
  validation after the next batch.

## 8. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
