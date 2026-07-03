# Review: short-term tab state visual proof

## 1. Summary

This round tightened the short-term macOS client's right-panel tab state
evidence and clarified the selected tab visual state.

The implementation does not change product scope, tab labels, panel content, or
short-term feature behavior. It adds screenshot-bound tab/panel proof for the
automated smoke path, removes smoke-only focus-ring pollution before screenshot
capture, and moves the selected tab indicator styling through tab component
tokens.

Automated smoke screenshots remain regression evidence only. They do not
replace foreground macOS validation with the native menu bar, window chrome, and
real production SVGA files.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `80643742`
- Uncommitted changes before this review: six short-term UI/smoke files
- Untracked files before this review: none observed

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-tab-state-visual-proof.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Stay within short-term PRD/UI scope; do not add visible product copy or controls. | Done |
| 2 | Keep tab styling tokenized and component-owned. | Done |
| 3 | Prove optimization and replaceable screenshots are captured with synced selected tab and visible panel state. | Done |
| 4 | Keep keyboard/focus proof separate from clean screenshot visuals. | Done |
| 5 | Do not claim final UI/UX acceptance from smoke screenshots alone. | Done |

## 5. Verification

```text
node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs
passed

node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs
passed

node --check tools/electron-prototype/experiments/svga-web/main.cjs
passed

npm run desktop:short-term:design-system-check
passed

node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs --test-name-pattern "default Electron renderer is the short-term macOS client"
passed: 30/30

npm run desktop:smoke
passed
```

## 6. Output inspection

- Smoke proof: `.artifacts/product/short-term/short-term-design-interaction-proof.json`
- Optimization screenshot: `.artifacts/product/short-term/short-term-preview-optimization.png`
- Replaceable screenshot: `.artifacts/product/short-term/short-term-preview-replaceable.png`
- Screenshot-bound tab states now record expected tab, actual state tab,
  selected tab id, aria-selected tab id, visible panel id, and active element id
  before focus is cleared for visual capture.
- Foreground macOS validation: not performed in this slice.

## 7. Risks

- The automated screenshots still use fixture SVGA files and do not include the
  real macOS menu bar/titlebar context required for final UI/UX judgment.
- This slice improves tab selected-state clarity only; broader visual density,
  spacing, real-material behavior, and foreground interaction review remain open.

## 8. Next steps

- Continue UI/UX polish in small traceable slices, prioritizing real foreground
  client review with production SVGA files when user availability allows.
- Keep using design-system checks to prevent raw visual values from returning to
  component CSS.

## 9. Commit

- Commit: pending in this task commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
