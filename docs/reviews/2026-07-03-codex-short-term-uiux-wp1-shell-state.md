# Review: short-term-uiux-wp1-shell-state

Date: 2026-07-03
Owner role: UI/UX
Status: WP1 implemented and verified

## Summary

Implemented the first UI/UX optimization slice for the short-term macOS client.
This slice focuses on native shell alignment and page-state cleanup, not on
product logic or PRD changes.

Key results:

- Removed the renderer-drawn fake macOS traffic lights.
- Let the Electron window use macOS `hiddenInset` titlebar behavior so native
  controls can share the toolbar row.
- Simplified Launch, Loading, and Load failed states so they do not expose stale
  workbench toolbar controls.
- Rebalanced the Launch page into one full-window canvas with a primary
  open/drop action and secondary recent-file list.
- Reduced visual noise from the preview/launch canvas checker pattern.

## Authority And Scope

Product scope remains owned by `docs/product/PRODUCT_ROADMAP.md`.

This implementation follows:

- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `docs/product/SHORT_TERM_UI_UX_LOW_FIDELITY_IA.md`
- `DESIGN.md`
- `docs/reviews/2026-07-03-codex-short-term-uiux-optimization-plan.md`

This review does not update PM-owned product docs and does not redefine S1-S16.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base HEAD during verification: `f89ed046`
- Pre-existing unrelated PM/mainline changes remain in the worktree:
  `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`,
  `docs/product/PRODUCT_ROADMAP.md`,
  `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`,
  `docs/research/figma-make-short-term-uiux-prompt.md`, and
  `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`.

## Changed Files

UI/UX implementation:

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`

UI/UX documentation:

- `docs/reviews/2026-07-03-codex-short-term-uiux-optimization-plan.md`
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp1-shell-state.md`

Related prior audit still present for context:

- `docs/reviews/2026-07-03-codex-short-term-uiux-prototype-screenshot-audit.md`

## Requirement Checks

- S1/S16 Launch and Recent:
  Launch is now a single canvas-like state. Recent records remain secondary and
  do not sit inside a high-emphasis card.
- S2 Preview:
  Preview behavior and playback controls remain available after a file opens.
- S14 Save:
  Save controls and disabled states were not functionally changed.
- macOS shell:
  Fake web traffic lights were removed. Native controls are handled by the
  Electron window configuration.
- Design-system trace:
  Changes use existing `--asv-*` token plumbing and add a canvas checker token.
  Full CSS decomposition remains assigned to WP2.

## Verification

Passed:

- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 29 tests passed.
- `AUTO_SVGA_PRODUCT_ARTIFACTS=/tmp/auto-svga-uiux-wp1-20260703/final-artifacts npm run desktop:smoke`
  - Smoke summary reported `passed: true`.
  - Short-term screenshots and proofs were generated.

Fresh screenshot evidence:

- `/tmp/auto-svga-uiux-wp1-20260703/final-artifacts/short-term-launch.png`
- `/tmp/auto-svga-uiux-wp1-20260703/final-artifacts/short-term-preview-overview.png`
- `/tmp/auto-svga-uiux-wp1-20260703/final-artifacts/short-term-load-failed.png`

Manual desktop notes:

- The real desktop window no longer shows duplicated fake traffic lights inside
  the web content.
- Launch and Load failed states no longer leak stale Preview/Edit/Save/file
  identity toolbar controls.
- The dev menu bar can still show Electron as the app name in the local
  development shell.

## Risks And Follow-up

- Dev-shell app identity remains unresolved. `app.setName("Auto SVGA")` was not
  kept because it changes the Electron development `userData` path and can make
  recent-file state appear to migrate. This should be handled in the packaging
  or app-bundle identity lane.
- Visual quality is improved only at the shell/page-state level. The preview
  canvas, inspector rows, error card, optimization panel, replace/rename flows,
  and compare surfaces still need the higher-fidelity WP3-WP5 passes.
- The stylesheet is still a single runtime entrypoint. WP2 should split or
  structure it into token, base, atom, molecule, component, module, and page
  state layers while preserving existing tests.
- The functional 16/16 smoke matrix is not a UI/UX acceptance result. Focus
  order, minimum-window behavior, reduced motion/transparency, scroll
  containment, menu discoverability, and copyable metadata still need the WP6
  design QA pass.

## Next Step

Proceed to WP2 or WP3 depending on priority:

- WP2 first if the next goal is design-system maintainability.
- WP3 first if the next goal is visible polish of the opened-file workbench.
