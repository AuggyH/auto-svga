# Review: short-term Space key focus target

## 1. Summary
Scoped the global Space play/pause shortcut so it no longer intercepts focused interactive controls such as toolbar buttons, tabs, menu items, options, or text inputs. This preserves native keyboard expectations: focused controls keep their own Space behavior, while the preview canvas/page area can still use Space for playback.

No product scope, visible copy, or component inventory changed.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `2b0facc5`
- Uncommitted changes: `tools/electron-prototype/experiments/svga-web/web/short-term-macos-interaction-model.mjs`, `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`, `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`, `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`, this review
- Untracked files: none staged

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-interaction-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-space-key-focus-target.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep Space playback available outside controls | Done |
| 2 | Do not let global Space steal focused control behavior | Done |
| 3 | Keep shortcut logic in interaction model instead of one-off app code | Done |
| 4 | Add proof beyond a broad smoke pass | Done |

## 5. Verification
Commands run and results:
```
$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs --test-name-pattern "default Electron renderer is the short-term macOS client"
31 tests passed

$ npm run desktop:smoke
passed: true, including shortTermDesignInteractionProof

$ npm run desktop:short-term:design-system-check
passed: true
```

## 6. Output inspection
- `isTextEditingTarget` and `shouldHandleGlobalPlaybackShortcut` now own shortcut target rules.
- The global keydown handler no longer treats focused buttons, tabs, menu items, or options as playback shortcut targets.
- Smoke records `focusedControlSpaceNotGlobalPlayback` inside the design-interaction proof.

## 7. Risks
- Foreground keyboard traversal is still not claimed as fully accepted; this slice adds automated regression proof for a specific shortcut conflict.

## 8. Next steps
- Continue expanding keyboard-path proof for Tab traversal and context menu behavior when foreground validation is available.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
