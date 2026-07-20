# Review: short-term modal keyboard containment

## 1. Summary
Prevented global keyboard shortcuts from passing through app modal dialogs. When `dialog[open]` is present, document-level shortcuts now stand down so Space, Command+O/R/S, and other global handlers do not affect the underlying preview while a modal is active.

This is an interaction polish change only. It does not add product scope, visible copy, or new UI components.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `d29cb279`
- Uncommitted changes: `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`, `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`, `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`, this review
- Untracked files: none staged; ignored foreground screenshot artifacts under `.artifacts/uiux-foreground/`

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-modal-keyboard-containment.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not modify product scope or PM-owned docs | Done |
| 2 | Keep visible UI copy unchanged | Done |
| 3 | Improve keyboard behavior toward native modal containment | Done |
| 4 | Add verification beyond a generic smoke pass | Done |

## 5. Verification
Commands run and results:
```
$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs --test-name-pattern "default Electron renderer is the short-term macOS client"
31 tests passed

$ npm run desktop:short-term:design-system-check
passed: true

$ npm run desktop:smoke
passed: true, including shortTermRuntimeTextBoundaryProof
```

## 6. Output inspection
- App modal shortcut containment is covered in the runtime text modal smoke path.
- The smoke proof now records `modalSpaceSuppressed`.
- Foreground packaged-App validation uncovered a separate macOS permission prompt when opening a recent file stored under Downloads: `.artifacts/uiux-foreground/16-packaged-real-file-overview.png`.
- No permission button was clicked; the test instance was terminated to avoid changing local macOS permission state.

## 7. Risks
- Real foreground loaded-state screenshots from `/Users/huangtengxin/Downloads/auto-svga测试物料` still require Owner-approved macOS Downloads folder access, or a test flow that avoids the Downloads TCC prompt.
- Smoke remains regression evidence only. Foreground evidence is still required for visual acceptance.

## 8. Next steps
- Continue UI/UX polishing on foreground-safe surfaces.
- Coordinate with PM/main implementation owner before changing recent-file permission or bookmark behavior.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
