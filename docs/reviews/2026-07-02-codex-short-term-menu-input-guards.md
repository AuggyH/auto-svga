# Review: short-term-menu-input-guards

## 1. Summary
Hardened short-term host menu dispatch as an untrusted boundary. `openSvga`
menu dispatch now fails closed when the native/open-panel payload is missing a
request id or local path, instead of pushing invalid values into the open-file
state machine.

The dispatcher also normalizes invalid open-source values to safe menu defaults
and accepts partial contextual menu payloads so missing renderer context can be
tested without TypeScript casts.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: ed3f45b0 test: cover short-term menu routing drift
- Uncommitted changes: host menu input guard, host action tests, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-host-actions.ts
- src/tests/short-term-host-actions.test.ts
- docs/reviews/2026-07-02-codex-short-term-menu-input-guards.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Missing `openSvga` menu context fails closed before file loading. | Done |
| 2 | Invalid open-source values cannot leak into the product app state. | Done |
| 3 | Partial renderer-context menu payloads remain blocked without mutating state. | Done |
| 4 | No temporary UI shell wiring or owner-visible layout changes. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build && node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-menu-routing.test.js dist/tests/short-term-host-session.test.js
PASS, 36 tests
```

## 6. Risks
- The dispatcher still relies on the native/UI layer to provide real open-panel
  file paths for successful open actions. This change only prevents malformed
  payloads from entering the state machine.

## 7. Next steps
- Continue reviewing host/session action boundaries and keep UI shell
  integration deferred until the real shell contract exists.

## 8. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
