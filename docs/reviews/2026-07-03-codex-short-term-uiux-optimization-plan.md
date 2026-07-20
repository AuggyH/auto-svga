# Review: short-term-uiux-optimization-plan

Date: 2026-07-03
Owner role: UI/UX
Status: UI/UX implementation plan, not a PRD update

## Authority

Product scope remains owned by `docs/product/PRODUCT_ROADMAP.md`.

This UI/UX plan follows:

- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `docs/product/SHORT_TERM_UI_UX_LOW_FIDELITY_IA.md`
- `DESIGN.md`
- `docs/reviews/2026-07-03-codex-short-term-uiux-prototype-screenshot-audit.md`

This plan does not redefine S1-S16, add product scope, or update PM-owned
documents.

## Current Implementation Map

Current short-term client files:

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`

Current state:

- HTML has partial `data-component`, `data-module`, and `data-page-state`
  markers, but component boundaries are not yet systematic.
- CSS uses `--asv-*` variables, but most atoms, molecules, components,
  modules, and page states still live in one large stylesheet.
- Renderer JS mixes state transitions, view rendering, generated markup,
  command syncing, keyboard handling, smoke proof helpers, and component
  rendering in one file.
- Native shell is not resolved: the page draws fake traffic lights while the
  real macOS titlebar remains visible.

## Non-goals

- No product-scope changes.
- No PM document edits.
- No parser, optimizer, save-byte, recent-file persistence, or host IPC logic
  changes unless needed only to preserve existing UI behavior after a
  presentation-layer refactor.
- No new hidden feature entry points.
- No export acceptance, sequence repair, advanced editing, AI, cloud, account,
  telemetry, or batch replacement UI.

## Optimization Work Packages

### WP1: macOS Shell And State Cleanup

Touched PRD IDs: S1, S2, S14, S16.

Page states:

- Launch
- Loading
- Load failed
- Preview ready
- Save validating/complete/failed banner shell

Modules/components:

- `WindowToolbar`
- `LaunchModule`
- `LaunchDropCanvas`
- `LaunchRecentFilesList`
- `ErrorRecoveryPanel`
- `SaveFeedbackBanner`

Token namespaces:

- `semantic.color.surface.*`
- `semantic.color.text.*`
- `component.toolbar.*`
- `component.previewStage.*`
- `component.saveState.*`

Implementation goals:

- Remove fake traffic-light controls and use an Electron/macOS titlebar style
  that lets real window controls share the toolbar row.
- Hide workbench-only toolbar controls from Launch, Loading, and Load failed
  states so those states do not leak stale file or mode context.
- Refine launch hierarchy so Open/Drag remains primary and recent files remain
  secondary.
- Reduce the heavy canvas pattern and card borders that make the prototype
  look like a dark web dashboard.
- Keep disabled save/compare behavior unchanged.

Evidence:

- Static test for short-term entry.
- Desktop screenshot of Launch, Preview Overview, and Load failed.
- Keyboard spot check for Open, toolbar controls, and failed-state recovery.

### WP2: Design System File Structure

Touched PRD IDs: S1-S16 as trace infrastructure.

Modules/components:

- all canonical atoms, molecules, components, modules, and page states from
  `DESIGN.md`.

Implementation goals:

- Convert the stylesheet from one large file into a layered structure:
  `tokens -> base -> atoms -> molecules -> components -> modules -> page states`.
- Keep `short-term-macos.css` as the stable entrypoint for tests and runtime,
  but make it a design-system manifest rather than a one-off stylesheet.
- Add or preserve component markers so each rendered row/surface can be traced
  to the design-system inventory.
- Only split renderer JS after UI behavior is stable; JS extraction is higher
  risk because it can affect smoke proof helpers.

Evidence:

- Token/reference grep check.
- Static test updated only if required by the new CSS entry structure.

### WP3: Preview Canvas And Inspector Quality

Touched PRD IDs: S2-S8, S15.

Modules/components:

- `PreviewStage`
- `PlaybackControls`
- `RightTabPanel`
- `OverviewFactRow`
- `ProductionSpecRow`
- `AssetRow`
- `SequenceThumbnail`
- `AudioAssetRow`

Implementation goals:

- Make the opened SVGA visually dominant without decorative noise.
- Tune Overview to lead with scan-first status, actual/limit comparisons, and
  copyable metadata.
- Quiet down ordinary asset rows and empty audio/no-replaceable states.
- Ensure scroll behavior and minimum window behavior stay usable.

Evidence:

- Screenshot set for Overview, Optimization, Replaceable empty, and No audio.
- Keyboard tab path through tabs and playback controls.

### WP4: Replace, Rename, Text, And Save Surfaces

Touched PRD IDs: S11-S14.

Modules/components:

- `ReplaceableImageRow`
- `ReplaceableTextRow`
- `ContextMenuItem`
- `RenameInput`
- `TextReplacementSheet`
- `SaveButtonPair`
- `SaveFeedbackBanner`

Implementation goals:

- Make row-level actions more discoverable while keeping existing actions.
- Make inline rename less cramped and clarify current/target key state.
- Make runtime-only text preview visually distinct from persisted byte output.
- Improve dirty/save messages so they name the active output source.

Evidence:

- Screenshot set for context menu, inline rename, runtime text dialog/applied,
  dirty output, discard dialog, save failed.
- Keyboard path for `Cmd+R`, Enter, Esc, modal confirm/cancel, and Save As.

### WP5: Compare And Edit Reserved Refinement

Touched PRD IDs: S10 and short-term Edit reserved mode.

Modules/components:

- `GeneralCompareModule`
- `OptimizationCompareModule`
- `ComparePreviewCard`
- `EditReservedModule`
- `ReservedOperationPanel`

Implementation goals:

- Separate general compare from optimization compare visually.
- Add factual A/B difference hierarchy without inventing new analysis scope.
- Make reserved Edit mode quiet enough that it does not feel broken or
  unfinished.

Evidence:

- Screenshot set for empty-B compare, loaded compare, optimization compare,
  and edit reserved.

### WP6: Design-Oriented QA

Touched PRD IDs: S1-S16 verification support.

Implementation goals:

- Add a repeatable design QA checklist for:
  focus order, tab path, scroll containment, minimum window, reduced motion,
  reduced transparency, light/dark screenshots, copyable metadata, menu
  discoverability, and no stale metadata.
- Keep the existing 16/16 functional matrix separate from UI/UX acceptance.

Evidence:

- Design QA review note with screenshot paths and command results.

## First Slice Decision

Start with WP1. It addresses the most visible native-shell and page-state
problems while minimizing risk to implemented S1-S16 behavior.

WP1 is not considered complete until the app still passes the short-term static
test and has fresh desktop screenshots for Launch, Preview Overview, and Load
failed.
