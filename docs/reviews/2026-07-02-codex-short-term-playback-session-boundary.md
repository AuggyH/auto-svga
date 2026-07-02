# Review: short-term-playback-session-boundary

## 1. Summary
Added a short-term host/session boundary for playback abnormal reporting and
recovery. Future native/player integration can now report a playback failure
through the same session surface used for open/save/menu actions, and recover
back to preview-ready state without clearing unsaved output.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 59a874fe test: cover node invalid open recovery
- Uncommitted changes: playback facade/session boundary, tests, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-workbench-facade.ts
- src/workbench/short-term-host-actions.ts
- src/workbench/short-term-host-session.ts
- src/tests/short-term-workbench-facade.test.ts
- src/tests/short-term-host-session.test.ts
- docs/reviews/2026-07-02-codex-short-term-playback-session-boundary.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | S2 playback failures can be recorded through the main host/session boundary. | Done |
| 2 | Playback recovery returns to preview-ready without reopening the file. | Done |
| 3 | S14 dirty output remains available across abnormal/recovery states. | Done |
| 4 | Path-redacted owner-facing model remains intact. | Done |
| 5 | No temporary UI shell wiring or playback-success claim. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ git diff --check
PASS

$ node --test dist/tests/short-term-workbench-facade.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-app-state.test.js dist/tests/short-term-host-actions.test.js
PASS, 41 tests

$ npm run test:all
PASS, 341 tests
```

## 6. Output inspection
- Not applicable. This is a host/session state contract; it does not generate
  SVGA, preview media, or app packages.

## 7. Risks
- The actual player bridge still needs to call `reportPlaybackFailure()` when
  renderer playback fails and `recoverPlayback()` after user/runtime replay.

## 8. Next steps
- Continue tightening host/session coverage for real S1/S2/S14/S16 integration
  paths before connecting the final native UI.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
