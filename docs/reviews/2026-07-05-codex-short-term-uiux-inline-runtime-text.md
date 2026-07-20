# Review: short-term UI/UX inline runtime text

## 1. Summary
This WP aligns S13 runtime text preview with the Owner-confirmed canvas-first
short-term client direction. The Preview right information surface now exposes
runtime text as inline inputs in the text element rows instead of opening a
dialog. Runtime text edits update the preview overlay only, support reset, and
remain byte-immutable.

No PM-owned product docs were changed.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `a7263826`
- Uncommitted changes before commit: UI/UX implementation and proof updates
  listed below.
- Untracked files: none observed before review creation.

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-text-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-runtime-text-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-event-bindings.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-command-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-command-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-file-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-nodes.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/build-short-term-acceptance-matrix.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | S13 text values are editable inline through text inputs in Preview. | Done |
| 2 | Runtime text editing applies only to dynamic preview and does not create dirty SVGA bytes. | Done |
| 3 | Runtime text reset is available and verified. | Done |
| 4 | The old visible text preview dialog is removed from the main UI path. | Done |
| 5 | Inline text input is represented as a canonical design-system component. | Done |
| 6 | Smoke proof and acceptance matrix fail closed on the new inline-input evidence shape. | Done |
| 7 | Owner-visible real foreground macOS screenshot validation. | Not done in this WP; this remains required for broader visual acceptance. |

## 5. Verification
Commands run and results:
```
$ npm run desktop:short-term:design-system-check
passed

$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
31/31 tests passed

$ npm run desktop:smoke
passed, shortTermRuntimeTextBoundaryProof=true

$ git diff --check
passed
```

Runtime text proof inspected:
```
.artifacts/product/short-term/short-term-runtime-text-boundary-proof.json
passed=true
inlineInputRendered=true
initialFocusInput=true
inputSpaceSuppressed=true
editApplied=true
resetButtonEnabledAfterApply=true
resetClearedOverlay=true
sourceBytesUnchanged=true
bytePersistenceClaimed=false
textKeys=["nickname_text"]
```

## 6. Output inspection
- Inline input appears in `ReplaceableTextRow` through
  `data-component="InlineTextReplacementInput"`.
- The previous `TextReplacementSheet` dialog markup is absent from
  `web/index.html`.
- The Resource menu command now focuses the inline input instead of implying a
  modal sheet.
- Smoke screenshots remain automated regression evidence only. They do not
  replace a real foreground client pass with macOS titlebar/menu chrome and
  real production SVGA files.

## 7. Risks
- This WP was validated with the committed smoke fixture that includes
  `nickname_text`. More real production SVGA files should still be exercised in
  foreground client validation.
- The row reset control is text-based in this WP. It is functional and bounded,
  but later visual polish may convert it to an icon button if the final visual
  language requires it.

## 8. Next steps
- Continue the short-term UI/UX visual pass on the remaining Preview/Edit/
  Settings surfaces using the same canvas-first and design-system constraints.
- Run real foreground desktop validation before claiming visual acceptance.

## 9. Commit
- Commit: this commit (`uiux: inline runtime text preview`)
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
