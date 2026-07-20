# Review: short-term-uiux-wp3-launch-figma-alignment

## 1. Summary

Implemented the first Figma-guided WP3 launch-page visual alignment pass.
The launch page now uses tokenized Figma/R4 dimensions for the central empty
canvas area and low-emphasis recent-file area.

No product behavior was changed. Open, drag, recent-file loading, and clear
recent actions keep the existing implementation paths.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `806c6eb6`
- Uncommitted changes before work:
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- Untracked files before work: none observed

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `docs/research/figma-mcp-uiux-read-plan.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/reviews/2026-07-07-codex-short-term-uiux-wp3-launch-figma-alignment.md`

Note: `short-term-macos.modules.css` already had unrelated unstaged
optimization-result changes before this task. Only launch-related hunks should
be staged for this review commit.

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Use PRD as product authority and keep UI docs subordinate | Done |
| 2 | Apply R1/R2/R4 without another Figma MCP call | Done |
| 3 | Keep launch Open/Drag as primary actions and recent files secondary | Done |
| 4 | Keep launch styles tokenized and avoid raw visual values outside tokens | Done |
| 5 | Do not alter recent-file behavior or menu behavior | Done |
| 6 | Preserve existing parallel worktree changes | Done, with staged-hunk caution |

## 5. Verification

Commands run and results:

```bash
npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check
```

Passed. The report includes `passed: true`, style order still matches the
token -> atom -> molecule -> component -> module -> page-state -> base order,
and raw dimensions in `short-term-macos.modules.css` remain below the current
debt limit.

```bash
node --test --test-name-pattern "default Electron renderer is the short-term macOS client and keeps legacy Workbench isolated" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
```

Passed: 1 test.

```bash
node --test --test-name-pattern "short-term design system check enforces UI implementation guardrails" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
```

Passed: 1 test.

```bash
git diff --check
```

Passed with no output.

```bash
npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:acceptance-matrix
```

Generated the matrix successfully. Result remains `releaseCandidateReady:
false` with stale evidence, which is expected because this WP is a visual
alignment slice and did not regenerate full product evidence.

## 6. Output inspection

Figma inputs used:

- R1 launch screenshot:
  `docs/research/figma-mcp-read-packets/r1-target-screenshot-manifest-20260707.md`
- R2 token map:
  `docs/research/figma-mcp-read-packets/r2-token-map-20260707.md`
- R4 launch module contract:
  `docs/research/figma-mcp-read-packets/r4-launch-module-contract-20260707.md`

Local screenshot evidence:

- `/Users/huangtengxin/Documents/Auto_SVGA_References/uiux-wp3-launch-2026-07-07/launch-browser-dark-720.png`
- SHA-256:
  `c05b93ff5507c493df98f47b91e4f8219a59d624bfcdd7b1418d8a82d7f4b2b6`

Observed static layout metrics at `720 x 720`:

- `.launchPrompt`: `300 x 300`
- `.largeOpenButton`: `78 x 30`
- `.recentBlock`: `360 x 200`
- `.recentHeader`: `360 x 32`

This screenshot is a layout sanity check only. It is not foreground macOS
client acceptance evidence.

## 7. Risks

- The static localhost screenshot has no Electron host bridge, so it cannot
  show real recent-file rows.
- The screenshot followed the current browser/system dark appearance. The R1
  Figma launch screenshot is light; final UI/UX acceptance still needs real
  foreground desktop-client screenshots in light and dark modes.
- The existing recent-file implementation removes missing records after a
  failed open instead of showing the Figma example's inline invalid recent row.
  That is product/behavior scope and was not changed here.
- `short-term-macos.modules.css` contains unrelated pre-existing dirty hunks.
  Staging must remain hunk-specific.

## 8. Next steps

- If Owner wants to inspect this slice immediately, build or launch the desktop
  client and capture a foreground screenshot with macOS chrome.
- Otherwise continue the Figma-guided surface work with WP2 playback/core
  controls, because those controls appear across multiple states.

## 9. Commit

- Commit: produced by this review commit; see final handoff / git log
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: hunk isolation was needed because `short-term-macos.modules.css`
  already had unrelated dirty changes
- Avoidable costs: future UI slices should avoid mixing unrelated visual
  experiments into the same CSS file before commit boundaries are clear
- Product lessons: R4 module contracts can drive layout without changing PRD
  behavior
- Technical lessons: tokenizing Figma dimensions before module CSS keeps the
  design-system raw-value guard green
- Design / interaction lessons: launch alignment is mostly about proportion,
  vertical rhythm, and lowering recent-file hierarchy, not adding more copy
- Process lessons: a static browser screenshot is useful as a fast sanity
  check, but it must stay separate from foreground desktop acceptance evidence
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 11. Token usage

- Source: unavailable
- Input tokens: null
- Cached input tokens: null
- Output tokens: null
- Reasoning output tokens: null
- Total tokens: null
- Token lesson: completed R4-derived implementation without another Figma MCP
  call; visual sanity checks should use the cheapest evidence that answers the
  current question and leave foreground acceptance to checkpoint review.
