# Review: short-term modal escape containment

## 1. Summary
Refined modal keyboard containment so app-wide shortcuts still do not pass through an open app dialog, while `Esc` continues to cancel the top modal. This keeps the runtime text sheet and discard confirmation closer to native modal behavior.

No product scope, visible copy, or component inventory changed.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `7229cbaa`
- Uncommitted changes: `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`, `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`, this review
- Untracked files: none staged

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-modal-escape-containment.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep modal dialogs from leaking global shortcuts to the preview | Done |
| 2 | Preserve `Esc` as a modal cancel/close action | Done |
| 3 | Avoid new UI copy, controls, or product behavior | Done |
| 4 | Keep regression proof current | Done |

## 5. Verification
Commands run and results:
```
$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs --test-name-pattern "default Electron renderer is the short-term macOS client"
31 tests passed

$ npm run desktop:smoke
passed: true, including shortTermRuntimeTextBoundaryProof
```

## 6. Output inspection
- The global keydown handler now checks `dialog[open]` first.
- Non-Escape app-wide shortcuts return while a modal is open.
- Escape closes the top modal through `closeOpenDialog(document, "cancel")`.

## 7. Risks
- Foreground visual acceptance is not claimed by this review; this is interaction containment with automated regression evidence.

## 8. Next steps
- Continue UI/UX polish on foreground-safe surfaces.
- Resume foreground loaded-state screenshots after Owner-approved handling of the macOS Downloads permission prompt.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
