# Review: short-term-command-menu-prd-trace

## 1. Summary
Added PRD trace metadata to product-related macOS command-menu entries. Menu
items for open, recent, clear recent, close, save, compare, playback, rename,
replace, and optimization now expose the short-term S-requirements they serve.

System-native items such as copy, paste, window zoom, and app hiding keep their
native roles and do not receive forced product labels.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 543dccb6 fix: trace short-term host actions to PRD ids
- Uncommitted changes: command-menu PRD trace metadata, menu tests, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-command-menu.ts
- src/tests/short-term-command-menu.test.ts
- docs/reviews/2026-07-02-codex-short-term-command-menu-prd-trace.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Product menu commands expose concrete short-term PRD IDs. | Done |
| 2 | Recent submenu entries inherit S1/S2/S16 trace. | Done |
| 3 | Optimization, rename, replacement, compare, playback, and save entries map to their own product requirements. | Done |
| 4 | Native OS commands remain native role items without product overclaiming. | Done |
| 5 | No temporary UI shell wiring or product-surface expansion. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ git diff --check
PASS

$ node --test dist/tests/short-term-command-menu.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js
PASS, 36 tests

$ npm run test:all
PASS, 349 tests
```

## 6. Output inspection
- Not applicable. This is a command-menu metadata contract and does not
  generate SVGA, preview media, or app packages.

## 7. Risks
- Future menu commands should update `prdIdsForCommand()` so menu evidence
  remains traceable.

## 8. Next steps
- Continue tightening short-term host/menu/session contracts before real UI/UX
  shell integration.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
