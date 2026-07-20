# Review: short-term-uiux-launch-square-window

## 1. Summary

This slice implements the Owner-confirmed startup window behavior: the Launch page now opens as a compact 1:1 desktop window focused on the central open-file action. Loading, Preview, Edit, Compare, and other workbench states switch to the wide workbench window size.

No visible copy, product controls, or file-processing behavior were added. PM-owned PRD files were not modified.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Baseline before UI/UX implementation bundle: `75558b74 docs: record pm task retrospectives`
- Implementation commit: `70410578 uiux: refine short-term launch and right surfaces`
- Pre-existing UI/UX dirty work was present before this slice, including the WP4 right-surface Figma alignment files and its review. Those changes were preserved and are not claimed as this slice's core change.

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/host-adapter-contract.cjs`
- `tools/electron-prototype/experiments/svga-web/preload.cjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-host-client.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-state.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-07-codex-short-term-uiux-launch-square-window.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Launch page should be a 1:1 small window, not the wide preview/workbench window | Done |
| 2 | Main Preview/Edit/Compare pages should keep the wide workbench window | Done |
| 3 | Keep Launch as a full-window canvas inside its own compact window | Done |
| 4 | Do not add new visible copy, controls, or product behavior | Done |
| 5 | Preserve existing short-term file open/playback flows | Done |
| 6 | Verify with real foreground packaged App screenshots, not smoke alone | Done |

## 5. Implementation notes

- Added a narrow `setShortTermWindowMode` host bridge for the short-term renderer.
- The renderer sends only two semantic modes: `launch` and `workbench`.
- The desktop host owns actual window dimensions:
  - Launch: `720 x 720`
  - Launch minimum: `640 x 640`
  - Workbench default: `1440 x 900`
  - Workbench minimum: `1180 x 760`
- Smoke/proof modes ignore runtime window movement so hidden automation windows are not pulled into the visible desktop.

## 6. Verification

```
$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
passed; 31/31 tests
```

```
$ npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check
passed
```

```
$ git diff --check
passed
```

```
$ npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
passed
```

```
$ npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac
passed
```

Foreground packaged App verification on the second display:

- Launch window after opening `Auto SVGA.app`: `720 x 720`
- Opened real owner-provided production material:
  `/Users/huangtengxin/Downloads/auto-svga测试物料/头像框/战狼头像框/战狼头像框.svga`
- Preview window after file open: `1440 x 900`
- Close file from `文件 > 关闭文件`: returned to `720 x 720`

Retained evidence:

- `review/short-term-uiux-launch-square-window-72156f7/foreground-launch-square-window.png`
- `review/short-term-uiux-launch-square-window-72156f7/foreground-launch-square-window-display2.png`
- `review/short-term-uiux-launch-square-window-72156f7/foreground-preview-workbench-window.png`
- `review/short-term-uiux-launch-square-window-72156f7/foreground-preview-workbench-window-display2.png`
- `review/short-term-uiux-launch-square-window-72156f7/foreground-return-launch-square-window.png`

Generated package:

- `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/Auto SVGA-darwin-arm64.zip`

## 7. Risks

- The Launch screenshot reflects the currently stored dark appearance; this slice changed window sizing, not theme styling.
- Window resizing is currently semantic-state driven. If future product scope allows Launch-side settings or multi-file management, that state should be reviewed before reusing the compact launch window.
- WP4 and WP5 UI/UX refinements are committed in the same implementation bundle because the CSS/token/test hunks overlap; their review records remain separate.

## 8. Next steps

- Continue the main UI/UX high-fidelity line after Owner reviews the latest package.
- Keep foreground packaged-App evidence as the primary visual verification path for window-size and native-chrome behavior.

## 9. Project retrospective

- Value assessment: High
- Cost drivers:
  - Foreground file-open validation required careful macOS dialog automation because non-ASCII path typing was affected by the active input method.
  - The window behavior touched both renderer state and host sizing, so tests needed to cover the bridge contract.
- Avoidable costs:
  - Use clipboard paste for real-material paths in macOS file dialogs instead of simulated typing.
- Product lessons:
  - “Full-window Launch canvas” does not imply the Launch window should share the main workbench size.
- Technical lessons:
  - Keep physical desktop window sizing in the host process and expose only semantic renderer modes.
- Design lessons:
  - Startup and workbench are different spatial tasks: Launch should focus attention, while Preview/Edit/Compare need workspace width.
- Process lessons:
  - For UI/UX window behavior, smoke is regression evidence; foreground packaged screenshots are acceptance-quality evidence.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 10. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: record known foreground-validation paths and use clipboard-based dialog input for real-material files to avoid repeated failed screenshot attempts.
