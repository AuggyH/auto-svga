# Review: short-term recent files state

## 1. Summary
Added a host-neutral S16 recent-files state contract. The new model keeps
host-private local paths for reopening, exposes renderer-safe view records with
full paths redacted, caps launch records at five and menu records at ten,
supports de-duplication/promotion, clear-history, missing-file marking, and
recent-file open resolution into the shared loading flow.

This is main-engineering state and service contract work only. It does not wire
real behavior into the temporary UI/UX shell.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `f2343b9`
- Uncommitted changes: source/test/review files for this task
- Untracked files: `docs/research/figma-make-short-term-uiux-prompt.md` was
  already present and was not touched

## 3. Changed files
- `src/workbench/short-term-recent-files.ts`
- `src/tests/short-term-recent-files.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-recent-files.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | S16: launch recent list caps at five records | Done |
| 2 | S16: File > Recent caps at ten records | Done |
| 3 | S16: renderer-facing recent records hide full local paths | Done |
| 4 | S16: reopening a recent file enters the same local loading request shape | Done |
| 5 | S16: missing/inaccessible recent files fail gracefully | Done |
| 6 | S16: clear history removes records without touching source files | Done |
| 7 | Temporary UI/UX shell remains untouched | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
passed

$ node --test dist/tests/short-term-recent-files.test.js dist/tests/short-term-app-state.test.js tools/shared/product-frontend/short-term-product-state.test.mjs
21 tests passed

$ npm run test:all
279 tests passed
```

## 6. Output inspection
- Host state keeps `localPath` so native host code can reopen recent files.
- View model omits full paths and marks `rendererHasFullPath=false`.
- Opening a recent record resolves to a `recentLaunch` or `recentMenu` loading
  request compatible with the existing short-term app state model.
- Missing recent records produce recoverable feedback without current-file data.
- Clear-history returns an empty recent state and a copy string confirming
  source files are not deleted.

## 7. Risks
- This does not implement native filesystem existence checks. The host layer
  should call `markShortTermRecentFileMissing()` after a failed access attempt.
- This does not replace the temporary shell's demo localStorage logic yet.

## 8. Next steps
- Add a host save validation execution model for S14, or wire native recent-file
  persistence once the real UI/host integration points are stable.

## 9. Commit
- Commit: this task commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
