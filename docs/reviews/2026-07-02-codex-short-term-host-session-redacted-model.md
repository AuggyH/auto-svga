# Review: short-term-host-session-redacted-model

## 1. Summary
Added a redacted `getModel()` API to `ShortTermHostSession` and included the
same facade model snapshot in every session action result.

This gives the future real UI a safe read boundary for product state without
requiring renderer-facing code to consume host internals such as local paths or
opened SVGA bytes.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: d8e32477 fix: isolate short-term host session snapshots
- Uncommitted changes: session model API, action-result model snapshot, focused regression test, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-host-session.ts
- src/tests/short-term-host-session.test.ts
- docs/reviews/2026-07-02-codex-short-term-host-session-redacted-model.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Provide a UI-readable short-term product model without exposing host state. | Done |
| 2 | Keep returned models path-redacted and detached from internal session state. | Done |
| 3 | Preserve existing direct state access for host-side implementation/tests. | Done |
| 4 | Avoid temporary UI shell wiring, layout work, or product-surface expansion. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ node --test dist/tests/short-term-host-session.test.js dist/tests/short-term-node-host-session.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-workbench-facade.test.js
PASS, 46 tests

$ git diff --check
PASS
```

## 6. Output inspection
- Not applicable. This is a host/session API boundary change and does not
  generate SVGA, preview media, app packages, or review ZIPs.

## 7. Risks
- Existing host-side callers may still use `getState()` when they need bytes or
  local-path context. Future renderer-facing code should prefer `getModel()`.

## 8. Next steps
- Continue hardening the host boundary so real UI integration can consume
  stable product models and typed actions without reviving old Workbench flows.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
