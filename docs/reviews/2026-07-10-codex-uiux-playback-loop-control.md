# Review: UI/UX Playback Loop Control

## 1. Summary

Implemented the Preview playback loop control that already exists in the 0.1.x UI/UX brief as `Loop if supported`.

This WP adds a tokenized loop icon button to the playback control group, a matching `Playback > 循环播放` checkbox menu item, command-state synchronization, and direct tests for the loop state model. It intentionally does not add fullscreen, extra visible descriptions, new playback modes, or product scope beyond the documented playback action group.

## 2. Git state

- Branch: `codex/uiux-redesign-20260710`
- Commit before work: `dd33687a style(uiux): align preview right surface rhythm`
- Uncommitted changes before commit: playback loop UI/action/menu/model/test files only
- Untracked files: `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-loop-model.mjs`

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-action-bridge.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-command-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-command-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-event-bindings.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-loop-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `docs/reviews/2026-07-10-codex-uiux-playback-loop-control.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep `PRODUCT_ROADMAP.md` as product authority and do not redefine scope | Done |
| 2 | Implement documented `Loop if supported` in the playback action group | Done |
| 3 | Do not add undocumented fullscreen control from design references | Done |
| 4 | Keep control visual values tokenized and component-traceable | Done |
| 5 | Keep menu discoverability aligned with the visible control | Done |
| 6 | Preserve reduced scope: no packaging, no foreground app control, no local-stable promotion | Done |

## 5. Verification

```bash
$ node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-loop-model.mjs
passed

$ node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-model.mjs
passed

$ npm run desktop:short-term:design-system-check
passed

$ git diff --check
passed

$ node --test --test-name-pattern "short-term playback loop|default Electron renderer is the short-term macOS client|short-term command" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
passed: 2/2

$ npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
first sandboxed attempt: 42/45 passed, 3 local-server tests blocked by `listen EPERM: operation not permitted 127.0.0.1`

$ npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
passed: 45/45 when rerun outside the sandbox for local 127.0.0.1 test-server binding
```

Temporary ignored dependency symlinks were used only because the isolated worktree does not keep `node_modules`. They were removed before commit. No lockfile, dependency declaration, or committed dependency file changed.

## 6. Output inspection

- Preview playback controls now include a selected loop icon button with `aria-pressed`.
- Compare empty playback controls keep the same visual affordance disabled, matching the disabled-control direction.
- `primaryPlaybackLooping` defaults to `true`, matching existing player behavior.
- Toggling updates both the command state and the mounted player's `loop` option.
- The application menu exposes `Playback > 循环播放` as a checkbox.
- Design-system checks guard the loop control contract and assert no `data-action="fullscreen"` is introduced.

## 7. Risks

- This touches playback/menu behavior, so it should go through Code Review before QA acceptance or any local-stable promotion.
- Owner-visible foreground screenshot evidence was not collected in this WP because the change is still in source-level UI/UX implementation and not a packaged visual acceptance batch.

## 8. Next steps

- Route this playback/menu behavior change through Code Review before QA/local-stable promotion.
- Continue the next bundled UI/UX page-state task from token/component/page-state alignment rather than small isolated visual tweaks.

## 9. Commit

- Commit: this commit; final hash is reported in handoff.
- Branch: `codex/uiux-redesign-20260710`
- Tag: none

## 10. Project retrospective

- Value assessment: Medium
- Cost drivers: playback/menu behavior required direct model tests plus the full spike suite; the isolated worktree required temporary ignored dependency symlinks.
- Avoidable costs: the initial canvas playback contract captured play/replay but left the documented loop control unimplemented, causing a later behavior pass.
- Product lessons: design references can contain more controls than the short-term PRD allows; only documented playback actions should ship.
- Technical lessons: extracting the pure loop state helper avoided importing the browser-only `/vendor/svga-web-2.4.4.js` module in direct Node tests.
- Design / interaction lessons: icon-only controls still need command/menu discoverability and accessible pressed state.
- Process lessons: when a WP touches playback/menu behavior, bundle focused tests and full spike once; do not package or foreground-capture every small control addition.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: use existing Figma packets and PRD text to decide whether a reference icon is in scope before implementing it.
