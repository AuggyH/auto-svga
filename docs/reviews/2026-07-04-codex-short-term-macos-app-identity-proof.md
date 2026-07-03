# Review: short-term macOS App identity proof

## 1. Summary
Tightened the macOS internal package proof so packaged App identity drift is rejected. The short-term client menu template and package metadata already use `Auto SVGA`; the foreground `Electron` menu bar issue was confirmed to be development-host specific when running the unbundled Electron runtime.

Foreground packaged-App evidence showed the real internal package as `Auto SVGA` in the macOS menu bar and foreground process name. This review does not change product scope or visible UI copy.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `ce3d1bdf`
- Uncommitted changes: `tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs`, `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`, this review
- Untracked files: none staged; ignored generated package artifacts under `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/`

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-macos-app-identity-proof.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not alter product functionality or PM-owned docs | Done |
| 2 | Keep development Electron host identity separate from packaged App identity | Done |
| 3 | Reject packaged macOS App identity drift back to `Electron` | Done |
| 4 | Verify with real foreground packaged App evidence, not smoke screenshot only | Done |

## 5. Verification
Commands run and results:
```
$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs --test-name-pattern "macOS package proof"
31 tests passed

$ npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac
Internal macOS package generated successfully

$ /usr/libexec/PlistBuddy -c 'Print :CFBundleName' -c 'Print :CFBundleDisplayName' -c 'Print :CFBundleExecutable' -c 'Print :CFBundleIdentifier' tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/Auto\ SVGA-darwin-arm64/Auto\ SVGA.app/Contents/Info.plist
Auto SVGA / Auto SVGA / Auto SVGA / local.auto-svga.internal-prototype
```

## 6. Output inspection
- Package path: `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/Auto SVGA-darwin-arm64/Auto SVGA.app`
- ZIP path: `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/Auto SVGA-darwin-arm64.zip`
- Foreground screenshot: `.artifacts/uiux-foreground/15-packaged-app-menu-identity.png`
- Foreground process name: `Auto SVGA`
- macOS menu bar first item: `Auto SVGA`
- Package identity fields: `CFBundleName`, `CFBundleDisplayName`, and `CFBundleExecutable` are all `Auto SVGA`

## 7. Risks
- Development-mode launches still use the bundled Electron host and can show `Electron` in the system menu bar. Treat that as development evidence only.
- The internal package remains unsigned and unnotarized, consistent with current short-term distribution boundaries.

## 8. Next steps
- Continue UI/UX polishing against the real foreground packaged client where host chrome matters.
- Keep smoke screenshots for regression coverage only; use foreground App screenshots for owner-visible macOS judgment.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
