# Review: short-term-image-reset-session-boundary

## 1. Summary
Added host/session entry points for resetting image replacement preview. Future
native/player integration can now reset S12 image replacement preview through
the main session surface instead of calling the facade directly.

The reset clears only image-replacement preview output. It blocks when another
dirty output kind, such as optimization output, is active so Reset cannot
silently discard unrelated work.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 3a63c199 feat: add short-term text preview session boundary
- Uncommitted changes: image replacement reset host/session boundary, tests, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-host-actions.ts
- src/workbench/short-term-host-session.ts
- src/tests/short-term-host-actions.test.ts
- src/tests/short-term-host-session.test.ts
- src/tests/short-term-workbench-facade.test.ts
- docs/reviews/2026-07-02-codex-short-term-image-reset-session-boundary.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | S12 image replacement preview can be reset through host/session. | Done |
| 2 | Reset clears image replacement dirty output and disables Save/Save As. | Done |
| 3 | Reset does not clear other dirty output kinds. | Done |
| 4 | Missing open file and no-op reset fail closed with diagnostics. | Done |
| 5 | No temporary UI shell wiring or menu exposure. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ git diff --check
PASS

$ node --test dist/tests/short-term-image-replacement-preview-session.test.js dist/tests/short-term-workbench-facade.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js
PASS, 40 tests

$ npm run test:all
PASS, 344 tests
```

## 6. Output inspection
- Not applicable. This is a host/session preview-state contract and does not
  generate SVGA, preview media, or app packages.

## 7. Risks
- The eventual UI/player bridge must call `resetImageReplacementPreview()` only
  for image replacement reset, while separate dirty-output confirmation remains
  responsible for abandoning optimization or rename output.

## 8. Next steps
- Continue tightening host/session boundaries for remaining short-term
  acceptance evidence before final native shell integration.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
