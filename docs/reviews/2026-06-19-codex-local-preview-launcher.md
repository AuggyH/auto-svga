# Review: Add one-click local launcher for Auto SVGA browser workflow

## 1. Summary
- Added a one-command local preview launcher for the existing browser workflow.
- Launcher detects an existing Auto SVGA preview service, starts one only when offline, opens the browser, and fails safely on unknown port occupants.
- Kept Electron, exporter, Web preview layout, player implementation, CLI default flow, import, drag-drop, and comparison untouched.

## 2. Git state
- Branch: `agent/codex/local-preview-launcher`
- Implementation commit: `52c00cc80f3561d3f9bd55606785106dc6dc1f49`
- Commit before work: `351c0eb`
- Uncommitted changes before review commit: this review file only
- Untracked files: none expected

## 3. Changed files
- `tools/launch-local-preview.mjs`
- `tools/launch-local-preview.test.mjs`
- `docs/local-launcher.md`
- `package.json`
- `README.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | One-click entry for current Web preview/local server | Done |
| 2 | Check whether service is already running | Done |
| 3 | Start service when offline | Done |
| 4 | Open default browser | Done |
| 5 | Avoid duplicate service instances | Done |
| 6 | Clear error for unknown port occupant | Done |
| 7 | macOS support | Done |
| 8 | Basic Windows browser-open path | Done, runtime not verified on Windows |
| 9 | Do not change existing server behavior | Done |
| 10 | Do not change Web preview layout/player/import/drag-drop/compare | Done |
| 11 | Do not change npm default test/build/preview semantics | Done |
| 12 | No telemetry, external service, AI, or new dependency | Done |

## 5. Verification
Commands run and results:

```text
node --check tools/launch-local-preview.mjs
node --check tools/launch-local-preview.test.mjs
node --check tools/svga-player-preview/server.mjs
```

Result: passed.

```text
node --test tools/launch-local-preview.test.mjs
```

Result: passed, 3 tests / 0 failures.

```text
node tools/launch-local-preview.mjs --port 4199 --no-open
```

Result: local smoke passed. Preview page returned 200, `/api/latest-artifact` returned 200, and the temporary child server was terminated.

```text
npm test
```

Result: passed, 155 tests / 0 failures.

```text
git diff --check
```

Result: passed.

## 6. Output inspection
- New npm script: `local:preview`.
- Manual rollback still available: `preview:player`.
- Launcher default URL: `http://127.0.0.1:4173/tools/svga-player-preview/`.
- Unknown port occupants are not killed.
- No reports or user absolute paths are written.

## 7. Risks
- Windows path uses `cmd /c start` but was not runtime-tested on Windows.
- The launcher keeps a newly started server attached to the terminal; background/menu-bar behavior is out of scope.
- Auto SVGA service detection depends on the existing `/api/latest-artifact` shape and preview page marker.

## 8. Next steps
- Add a small macOS app/Automator wrapper only after this CLI launcher is used successfully in daily workflow.

## 9. Commit
- Implementation commit: `52c00cc80f3561d3f9bd55606785106dc6dc1f49`
- Branch: `agent/codex/local-preview-launcher`
- Tag: none
