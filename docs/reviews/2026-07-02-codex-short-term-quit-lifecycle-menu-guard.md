# Review: short-term-quit-lifecycle-menu-guard

## 1. Summary
Guarded the macOS `Quit` menu dispatch with the same short-term lifecycle
decision used by app quit/window close callers. Clean quit is still delegated
to the native shell; dirty quit is blocked until the caller confirms discarding
unsaved output.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 1d85e647 feat: add short-term host lifecycle guard
- Uncommitted changes: quit menu guard, host-action test, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-host-actions.ts
- src/tests/short-term-host-actions.test.ts
- docs/reviews/2026-07-02-codex-short-term-quit-lifecycle-menu-guard.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Prevent app quit from bypassing S14 dirty-output protection through menu dispatch. | Done |
| 2 | Preserve native delegation for clean or explicitly confirmed quit. | Done |
| 3 | Keep local paths out of menu-dispatch diagnostics. | Done |
| 4 | Do not connect the temporary UI shell or change unrelated native commands. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ git diff --check
PASS

$ node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-menu-routing.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-command-menu.test.js
PASS, 30 tests

$ npm run test:all
PASS, 337 tests
```

## 6. Output inspection
- Not applicable. This task is a host/menu state contract change and does not
  generate SVGA, GIF, preview, or app package output.

## 7. Risks
- The eventual native shell must treat a delegated `quit` result as the only
  permission to invoke platform quit, and must show confirmation UI when the
  host result is blocked.

## 8. Next steps
- Continue auditing native-shell entry points that can leave the active file,
  write bytes, or discard unsaved output.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
