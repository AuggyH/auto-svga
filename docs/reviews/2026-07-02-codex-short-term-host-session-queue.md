# Review: short-term-host-session-queue

## 1. Summary
Added a serial mutation queue to `ShortTermHostSessionController`. Overlapping
host actions now run in call order instead of allowing a slower earlier action
to overwrite a newer session state after it resolves.

`persistRecentFiles()` is queued through the same path so manual persistence
does not interleave with an in-flight action.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 2a21b84b fix: fail closed malformed menu open payloads
- Uncommitted changes: session action queue, race test, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-host-session.ts
- src/tests/short-term-host-session.test.ts
- docs/reviews/2026-07-02-codex-short-term-host-session-queue.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Overlapping mutating host session actions cannot overwrite newer state out of order. | Done |
| 2 | Recent-file persistence stays ordered with session actions. | Done |
| 3 | Existing host action/session behavior remains unchanged under sequential use. | Done |
| 4 | No temporary UI shell wiring or owner-visible layout changes. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build && node --test dist/tests/short-term-host-session.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-node-host-session.test.js
PASS, 37 tests
```

## 6. Risks
- The queue serializes actions in call order. It prevents state overwrite races
  but does not implement cancellation or "latest request wins" UX behavior.
  That can be added later when the real UI shell defines loading/cancel affordances.

## 7. Next steps
- Continue tightening host/session contracts while leaving UI shell integration
  deferred until the real shell contract exists.

## 8. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
