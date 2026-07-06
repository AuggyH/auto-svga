# Short-term UI/UX Playback Transport Polish Review

## Summary

UI/UX lane refined the Preview playback controls to better match the
Owner-confirmed canvas-first direction. The bottom playback surface is now a
lightweight canvas overlay instead of a full-width bottom band. Replay appears
before Play/Pause, and the transport shows a read-only progress bar plus
frame-derived time text.

The slice does not add timeline editing, scrubbing, loop controls, or new
playback product behavior. Compare mode keeps the same visual transport shape
but leaves controls disabled when playback is unavailable.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base HEAD before this slice: `eb418be7 uiux: soften preview right surface empty states`
- Scope: UI/UX lane, playback transport visual polish
- Product authority checked: `docs/product/PRODUCT_ROADMAP.md`
- Design authority checked: `DESIGN.md`, `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`, `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
  - Reorders Replay before Play/Pause in playback controls.
  - Adds read-only playback progress and time display.
  - Mirrors the same disabled transport structure in compare mode.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-nodes.mjs`
  - Collects playback progress and time nodes.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-model.mjs`
  - Adds frame/FPS-derived progress and time view data.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-surface.mjs`
  - Renders read-only progress and time into the playback controls.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-controller.mjs`
  - Runs a primary-playback animation-frame render loop and stops it on playback cleanup.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
  - Converts the playback bar into a canvas overlay.
  - Styles progress, time, and disabled compare transport states.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
  - Adds playback progress/time component tokens and aliases.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Guards the new playback DOM, tokens, CSS, model, surface, and controller hooks.

## Requirement Checks

- S2 is the only playback-facing requirement touched by this slice.
- General compare empty/partial state keeps playback controls visible but disabled, matching the Owner-confirmed interaction direction.
- No PRD or PM-owned product document was changed.
- No new visible helper copy, status badge, technical annotation, or unapproved product label was added.
- No timeline editing, scrubbing, advanced playback controls, or loop control was introduced.
- Playback progress is read-only display derived from existing player frame/FPS state.
- Styling uses design tokens and stays within the existing atoms/molecules/components/modules/page-state CSS layering.

## Verification

- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke` passed.
- `git diff --check` passed.

## Foreground Evidence

Foreground desktop-client screenshots were captured on the second display with
real production SVGA files under:

- `review/uiux-high-fidelity-packages/foreground-hf18-playback-transport-20260706/01-warwolf-dark-second-display.png`
- `review/uiux-high-fidelity-packages/foreground-hf18-playback-transport-20260706/02-warwolf-light-second-display.png`
- `review/uiux-high-fidelity-packages/foreground-hf18-playback-transport-20260706/03-bluecar-light-second-display.png`
- `review/uiux-high-fidelity-packages/foreground-hf18-playback-transport-20260706/04-compare-disabled-playback-second-display.png`

Real materials used:

- `/Users/huangtengxin/Downloads/auto-svga测试物料/头像框/战狼头像框/战狼头像框.svga`
- `/Users/huangtengxin/Downloads/auto-svga测试物料/头像框/蓝色豪车头像框/蓝色豪车头像框.svga`

## Risks

- This is one high-fidelity slice, not final UI/UX completion.
- The progress display is frame-derived and read-only. Any future scrubber,
  timeline interaction, loop setting, or playback speed control needs a product
  decision before implementation.
- Smoke remains regression evidence only; visual judgment for this slice is
  based on the foreground screenshots above.

## Next Steps

- Continue high-fidelity polish on the next owner-visible state, while keeping
  canvas immersion and minimal approved copy as hard constraints.
- Keep real foreground screenshots and smoke/design-system checks paired for
  each meaningful visual slice.
