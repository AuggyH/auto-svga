# UI/UX Review: Settings Sheet Figma Alignment

Date: 2026-07-07
Owner lane: UI/UX
Branch: `agent/codex/svga-workbench-v1-autonomous`

## 1. Summary

Aligned the short-term Settings sheet closer to the archived Figma R1 settings
target without changing theme behavior. The appearance choices now render as
three icon-led tiles inside a restrained sheet, with settings-specific tokens
for padding, dividers, tile size, icon size, border, and selected state.

No new Figma MCP read was performed in this task.

## 2. Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `969e0ca2`
- Uncommitted changes before this slice: pre-existing optimization-result
  changes in `short-term-macos.modules.css` and matching test assertions.
- Untracked files: none relevant to this slice.

## 3. Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## 4. Requirement Checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep Settings limited to Follow System, Light, and Dark. | Done |
| 2 | Preserve menu/settings behavior and theme persistence logic. | Done |
| 3 | Avoid new visible helper copy, status labels, or product scope. | Done |
| 4 | Use design tokens for the new Settings sheet visual primitives. | Done |
| 5 | Do not use unapproved Figma component children as new app features. | Done |

## 5. Verification

```text
npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check
passed

node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
31/31 passed

npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
passed

git diff --check
passed
```

## 6. Output Inspection

- Settings sheet structure: icon-led title, three icon-led appearance choices,
  bottom primary `完成` action.
- Behavior: unchanged radio inputs; the existing settings surface still owns
  state sync and persistence.
- Figma evidence used: archived R1 settings target screenshot only.
- Smoke evidence: `short-term-settings-dialog` is now captured as regression
  evidence during the desktop smoke run, and the proof summary requires that
  open-state screenshot before `appearanceScreenshotsCaptured` can pass.
- Foreground evidence: not captured in this slice. A temporary browser data URL
  preview was blocked by browser security policy, and no workaround was used.
  Real desktop foreground Settings open-state capture remains required before
  Owner acceptance.

## 7. Risks

- This is not pixel-perfect Settings acceptance. The next authorized Figma read
  for `Module/设置面板` may reveal tighter dimensions or component bindings.
- The Figma component hierarchy shows playback controls include loop/fullscreen
  children, but those were not implemented because that would add visible
  capability/entry points beyond the confirmed styling scope.

## 8. Next Steps

- When Owner authorizes the next Figma MCP call, read one module only:
  `Module/设置面板` or the next active WP module.
- Include Settings open-state in the next real foreground desktop screenshot
  bundle with macOS chrome.

## 9. Commit

- Commit: included in `uiux: align settings sheet with figma target`; final
  hash is reported in handoff.
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project Retrospective

- Value assessment: Medium
- Cost drivers: needed to preserve Figma MCP authorization boundaries and avoid
  turning playback component children into unapproved features.
- Avoidable costs: browser data URL preview attempt was unnecessary; next time,
  use foreground desktop or existing smoke hooks instead of a data-page preview.
- Product lessons: Figma component structure can expose desired affordances, but
  it does not override PRD/Owner-confirmed feature scope.
- Technical lessons: Settings-specific tokens prevent this sheet from sharing
  canvas mode-switch styling by accident.
- Design / interaction lessons: icon-led appearance tiles better match the
  native-tool settings direction without adding explanatory copy.
- Process lessons: no-Figma implementation slices should explicitly state which
  Figma questions remain unresolved.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes

## 11. Token Usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: consume archived Figma evidence first, but do not spend browser
  setup tokens on blocked preview paths.
