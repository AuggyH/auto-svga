# Review: short-term-host-action-prd-trace

## 1. Summary
Changed `ShortTermHostActionResult.prdIds` from one coarse fixed set to
action-specific PRD IDs. This keeps host/session evidence aligned with the
short-term S1-S16 roadmap instead of labeling optimization, rename, replacement,
and text preview actions as only open/save/recent work.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 15510ddd fix: guard short-term preview actions source bytes
- Uncommitted changes: action-specific PRD mapping, focused host-action test, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-host-actions.ts
- src/tests/short-term-host-actions.test.ts
- docs/reviews/2026-07-02-codex-short-term-host-action-prd-trace.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Host action results identify the relevant short-term PRD IDs. | Done |
| 2 | S9/S10 optimization, S11 rename, S12 replacement, and S13 text preview are no longer mislabeled as only S1/S2/S14/S16. | Done |
| 3 | Save and recent/open actions keep their own explicit PRD trace. | Done |
| 4 | No temporary UI shell wiring or product-surface expansion. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ git diff --check
PASS

$ node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js
PASS, 32 tests

$ npm run test:all
PASS, 348 tests
```

## 6. Output inspection
- Not applicable. This is a host/action evidence contract and does not generate
  SVGA, preview media, or app packages.

## 7. Risks
- Future new host actions must be added to `prdIdsForAction()` so evidence
  remains explicit.

## 8. Next steps
- Continue tightening host/session evidence contracts and fail-closed
  diagnostics before real UI/UX integration.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
