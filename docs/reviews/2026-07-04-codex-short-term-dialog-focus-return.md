# Review: short-term dialog focus return

## 1. Summary
Completed a scoped UI/UX interaction improvement for the short-term macOS
client: modal dialogs now support deterministic initial focus and focus return
after close.

The runtime text preview dialog uses the text input as its initial focus and
returns focus to the triggering text-edit button after confirmation. This
improves the existing S13 modal path without adding product scope, visible
copy, new controls, or layout changes.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `8a567ed4`
- Uncommitted changes at review creation:
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dialog-model.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- Untracked files: none observed before adding this review

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dialog-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-dialog-focus-return.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Preserve PRD scope and existing S13 runtime text behavior. | Done |
| 2 | Keep modal keyboard focus visible and predictable. | Done |
| 3 | Keep dialog behavior centralized in the dialog model. | Done |
| 4 | Avoid new visible copy, controls, or layout changes. | Done |
| 5 | Add regression evidence for initial focus and focus return. | Done |
| 6 | Do not treat smoke as final visual acceptance. | Done |

## 5. Verification
Commands run and results:
```bash
$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
31/31 passed.

$ npm run desktop:smoke
passed=true. shortTermRuntimeTextBoundaryProof=true.

$ npm run desktop:short-term:design-system-check
passed=true. Token/component/page-state guardrails remain satisfied.

$ git diff --check
passed.
```

## 6. Output inspection
- Product scope: no PRD or PM-owned product document edited.
- Visual surface: no layout, typography, color, copy, or spacing changed.
- Interaction surface: the text preview modal focuses the input on open and
  returns focus to the triggering text-edit button on close.
- Smoke proof: runtime text boundary proof now requires `initialFocusInput` and
  `focusReturnedAfterClose`.
- Evidence boundary: automated smoke remains regression evidence only; real
  foreground macOS validation with production SVGA files is still required for
  broader UI/UX acceptance.

## 7. Risks
- This validates renderer modal focus behavior. It does not replace native
  foreground review with macOS menu bar/titlebar visible.
- The generic dialog focus-return behavior is shared with discard-confirm
  dialogs, but the smoke proof exercises the runtime text dialog path.

## 8. Next steps
- Continue with small UI/UX interaction and design-system slices.
- Prioritize foreground client validation with real production SVGA files
  before claiming visual or interaction acceptance.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
