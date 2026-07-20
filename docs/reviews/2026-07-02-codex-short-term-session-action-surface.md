# Review: short-term-session-action-surface

## 1. Summary
Added first-class `ShortTermHostSession` methods for formal short-term actions
that should be callable by the eventual native UI without assembling menu
payloads:

- clear recent files
- close file
- run optimization
- rename imageKey
- replace image preview
- save output

The generic menu dispatcher remains available for macOS menu integration. This
change only adds typed session entry points over existing host actions.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 85efd229 feat: add short-term image reset session boundary
- Uncommitted changes: session action-surface methods, focused session test, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-host-session.ts
- src/tests/short-term-host-session.test.ts
- docs/reviews/2026-07-02-codex-short-term-session-action-surface.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Real UI can call S9/S11/S12/S14/S16 actions through typed session methods. | Done |
| 2 | Menu dispatch remains available for macOS menu plumbing. | Done |
| 3 | New methods reuse existing dirty-output guards and save validation. | Done |
| 4 | No temporary UI shell wiring or product-surface expansion. | Done |
| 5 | Local paths remain redacted from session models/results. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ git diff --check
PASS

$ node --test dist/tests/short-term-host-session.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-workbench-facade.test.js dist/tests/short-term-command-menu.test.js
PASS, 40 tests

$ npm run test:all
PASS, 345 tests
```

## 6. Output inspection
- Not applicable. This is a host/session action-surface contract and does not
  generate SVGA, preview media, or app packages.

## 7. Risks
- Native UI integration still needs to decide which controls call direct session
  methods and which macOS menu entries continue through `dispatchMenuAction()`.

## 8. Next steps
- Continue hardening the short-term session contract around evidence and
  fail-closed output behavior before real UI/UX shell integration.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
