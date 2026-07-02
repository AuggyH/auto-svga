# Review: short-term-prd-trace-centralization

## 1. Summary
Centralized short-term PRD trace mapping for command-menu items, host menu
dispatch results, and host action results.

This keeps the eventual native UI, macOS menu bridge, and direct session
actions aligned to one small mapping module instead of duplicating S1-S16 trace
logic in multiple files.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 9e1d7b25 fix: trace menu dispatch results to command PRD ids
- Uncommitted changes: PRD trace module, command menu/host action imports, focused tests, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-prd-trace.ts
- src/workbench/short-term-command-menu.ts
- src/workbench/short-term-host-actions.ts
- src/tests/short-term-prd-trace.test.ts
- docs/reviews/2026-07-02-codex-short-term-prd-trace-centralization.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep S1-S16 tracing tied to the PRD authority without UI shell wiring. | Done |
| 2 | Remove duplicate menu/action PRD mapping logic. | Done |
| 3 | Preserve different scopes for clear-recent menu item and host dispatch. | Done |
| 4 | Keep unknown/native-only commands from overclaiming PRD coverage. | Done |
| 5 | Avoid owner-visible UI, layout, or product-scope changes. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ node --test dist/tests/short-term-prd-trace.test.js dist/tests/short-term-command-menu.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-menu-routing.test.js
PASS, 32 tests

$ git diff --check
PASS
```

## 6. Output inspection
- Not applicable. This is a host/menu traceability refactor and does not
  generate SVGA, preview media, app packages, or review ZIPs.

## 7. Risks
- New short-term commands still need explicit PRD trace entries, but the update
  point is now one module instead of duplicated switch statements.

## 8. Next steps
- Continue tightening short-term host/session behavior and validation coverage
  around real PRD-scoped workflows.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
