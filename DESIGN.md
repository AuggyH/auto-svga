---
version: 0.2.0
name: auto-svga short-term app design manifest
description: Agent-readable design system summary for the corrected macOS-first short-term Auto SVGA app.
status: active_manifest
authority:
  product_prd: docs/product/PRODUCT_ROADMAP.md
  design_input: docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md
  execution_plan: docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md
  design_system_spec: docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md
language:
  primary: zh-CN
  secondary: en
product_type: local_macos_creator_tool
visual_tone:
  - precise
  - calm
  - native
  - immersive
  - boundary_light
  - technical
  - trustworthy
scope:
  includes:
    - local_svga_open
    - playback_preview
    - file_and_asset_inspection
    - production_spec_comparison
    - replaceable_element_preview
    - imagekey_rename
    - optimization_review_and_output
    - overwrite_save
    - save_as
  excludes:
    - export_acceptance
    - sequence_frame_repair
    - advanced_layer_editing
    - timeline_editing
    - batch_replacement
    - ai_generation
    - cloud_or_accounts
    - telemetry
token_namespaces:
  primitive:
    - color
    - type
    - space
    - size
    - radius
    - shadow
    - motion
  semantic:
    - color.text
    - color.surface
    - color.border
    - color.action
    - color.status
    - color.focus
    - surface.material
    - text.role
    - state.feedback
  component:
    - button
    - segment
    - row
    - previewStage
    - rightInformation
    - modal
    - menu
    - saveState
modes:
  color:
    - light
    - dark
  accessibility:
    - reducedMotion
    - reducedTransparency
  density:
    - default
    - compact_if_approved
components:
  atoms:
    - Icon
    - Text
    - Label
    - Badge
    - StatusDot
    - Divider
    - Spinner
    - ThumbnailFrame
    - Tooltip
  molecules:
    - ToolbarButton
    - IconButton
    - CanvasModeSwitch
    - SegmentItem
    - FactCell
    - SpecStatusCell
    - InlineStatus
    - FileDropTarget
    - DragDecisionZone
    - PlaybackButtonGroup
    - ContextMenuItem
    - RenameInput
    - InlineTextReplacementInput
    - SaveButtonPair
  components:
    - WindowChrome
    - LaunchDropCanvas
    - LaunchRecentFilesList
    - FileRecentSubmenu
    - PreviewStage
    - PlaybackControls
    - RightInformationSurface
    - FileFactRow
    - ProductionSpecStatusRow
    - OptimizationSpecDetailRow
    - MetricOptimizationEntry
    - DragDecisionOverlay
    - CompareFileSlot
    - SettingsSheet
    - ThemeSegmentedControl
    - AssetRow
    - SequenceThumbnail
    - AudioAssetRow
    - ReplaceableImageRow
    - ReplaceableTextRow
    - OptimizationFindingRow
    - OptimizationResultCard
    - OptimizationResultSurface
    - CompareCanvasSurface
    - ComparePreviewCard
    - TextReplacementSheet
    - SaveFeedbackBanner
    - ErrorRecoveryPanel
    - LayerRow
    - LayerListSurface
    - ReservedOperationPanel
layout:
  primary_mode: preview
  preview_mode: canvas_plus_state_driven_right_information
  edit_mode: reserved_left_canvas_right_layout
  chrome: canvas_first_menu_driven
implementation_rules:
  use_tokens_only: true
  no_page_local_visual_values: true
  immersive_boundary_light_hierarchy: true
  prefer_icons_for_self_evident_actions: true
  no_unapproved_visible_copy: true
  require_prd_trace: true
  require_component_trace: true
  require_evidence_trace: true
---

# Auto SVGA DESIGN.md

`DESIGN.md` is the design-system manifest for coding agents and design tools.
It gives stable visual identity, token namespaces, component inventory, and
implementation rules for the corrected short-term Auto SVGA app.

It is not a PRD, roadmap, interaction spec, or historical Web Preview design
document. Product scope belongs to `docs/product/PRODUCT_ROADMAP.md`. Detailed
short-term UI/UX inputs belong to
`docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`. The design-system execution
rules belong to `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`.
Concrete token, component, module, and page-state inventory belongs to
`docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`.

If this file conflicts with the main PRD, the main PRD wins. If this file
conflicts with the short-term UI/UX design brief or execution plan, correct
this file before design or implementation continues.

## Role

Use this file to answer:

- What should Auto SVGA feel like?
- Which token namespaces should UI code and design files use?
- Which component names are canonical?
- Where should concrete token and component inventory live?
- Which UI implementation behaviors are forbidden?

Do not use this file to answer:

- What features are in scope?
- Whether a feature is accepted or release-ready?
- What evidence proves release-candidate readiness?
- How a specific algorithm, parser, optimizer, or exporter works?

## Product Feel

Auto SVGA should feel like a local professional macOS utility for motion asset
inspection and light post-export refinement.

The tone is precise, calm, native, technical, and trustworthy. The interface
should make the opened SVGA, its metadata, replaceable elements, optimization
opportunities, and save states easy to inspect without decorative noise.

## App Icon

The current app icon is a temporary Owner-provided asset for packaging and
local desktop identity. Packaging must use
`tools/electron-prototype/experiments/svga-web/packaging/macos/app-icon.icns`.
The source PNG is stored beside it as `app-icon-source.png` for traceable
future replacement.

Owner-confirmed visual direction rules:

- Immersion and boundary-light hierarchy are core UI/UX principles. Prefer
  typography, color, background tone, shape, spacing, and material depth to
  express hierarchy. Avoid using dense outlines, boxed cards, or hard dividers
  as the default way to separate information.
- Use icons for actions that are self-evident as icons, such as playback,
  replay, reset, clear, and compact toolbar controls. Use visible text only
  when the action needs disambiguation or when the product requirement calls
  for explicit wording.
- Every visible in-app text string, status label, annotation, specification,
  and helper phrase must trace to the main PRD or an approved UI/UX design
  document. Do not add explanatory copy, status badges, comments, or technical
  details just to make the layout feel complete.

Owner-confirmed canvas direction, aligned with the PM-synced main PRD:

- Treat the checkerboard canvas as the primary app surface. Launch, preview,
  compare, drag, and optimization states should feel like variations of the
  same continuous canvas, not separate dashboard pages.
- Launch shows the central drag affordance, Open File action, and a
  low-emphasis recent-file list only. The recent-file clear icon clears all
  recent records.
- Launch may use a subtle, slow checkerboard idle motion on the canvas
  background. It must remain background-only, stop under reduced motion, and
  give way to drag-hover, invalid-format, loading, and error states.
- Preview mode does not show a visible Open Another File control. Opening a
  different file happens through the macOS menu or by dragging a file onto the
  canvas.
- Preview/Edit switching sits at the top center of the canvas.
- In Preview mode, dirty state is created only by imageKey key rename. Dirty
  state is shown by appending `*` to the file name and enabling the right-side
  Save As button. After Save As succeeds, the `*` disappears and Save As stays
  visible but disabled until dirty again.
- File-size and memory optimization entries remain in the basic information
  area. Clicking an optimization entry replaces the current right information
  surface with optimization detail or result comparison. Production-spec target
  thresholds are not shown in the default preview surface; they appear only in
  the optimization detail/result context.
- General compare has no persistent visible entry on the main surface. It is
  entered from the macOS menu or from drag-and-drop decision overlays. If no
  file is open, the menu command enters a two-file compare selection state.
- Dragging a supported file over an open preview shows a two-zone overlay:
  Open File and Add As Compare File. The focused half turns green. Unsupported
  files turn the focused region red with `不支持的文件格式`; dropping an
  unsupported file clears the canvas and shows the same text as a canvas toast.
- Compare empty state keeps playback controls visible but disabled.
- Optimization result comparison exits back to Preview after successful
  Overwrite Save. Save As SVGA, Overwrite Save, and Abandon Optimization are
  the visible result actions.
- Short-term Edit mode may show the left layer list only. The right operation
  panel remains a quiet placeholder and must not expose inactive controls.
- Light and dark appearance must both be designed. Owner sketches establish the
  light-mode visual language, but implementation must provide a dark-mode
  counterpart with the same immersive canvas model, hierarchy, spacing, and
  component structure.
- Theme selection belongs in the macOS menu and Settings sheet, not on the main
  canvas. The Settings sheet should use the new boundary-light visual language
  and expose only the approved appearance choices: Follow System, Light, and
  Dark. Do not import the old Workbench v1 settings surface wholesale.

This update records the Owner-approved UI/UX direction for design execution.
It does not override `docs/product/PRODUCT_ROADMAP.md`; if this manifest drifts
from the PRD, the PRD wins and this manifest must be corrected.

Do not make it feel like:

- a marketing landing page
- a browser dashboard
- a full animation editor
- a miniature After Effects
- a raw engineering report viewer

## Current Design Scope

The current manifest targets the corrected short-term app only:

- Open local SVGA files from Launch, drag/drop, or macOS menu.
- Preview playback and show abnormal states.
- Show file facts, compact production-spec status, and asset information.
- Identify designer-named replaceable elements.
- Preview runtime image and text replacement.
- Rename imageKeys with reference updates.
- Review and run enabled optimization.
- Compare before/after optimization output.
- Save with explicit Overwrite Save or Save As.

Short-term UI must not expose export acceptance, sequence-frame repair,
advanced layer editing, timeline editing, batch replacement, AI generation,
cloud/account surfaces, telemetry, or inactive future placeholders.

## Design System Principle

Every visible element must trace to the smallest useful design unit:

```text
primitive token -> semantic token -> component token -> atom -> molecule -> component -> module -> page state
```

Implementation must be traceable in the other direction:

```text
PRD requirement -> design surface -> component/module -> source file -> evidence
```

If a UI element cannot be traced both ways, do not implement it until the
design system or PRD trace is updated.

## Token Model

Use three token levels.

### Primitive Tokens

Primitive tokens are raw values with no product meaning:

- `primitive.color.neutral.*`
- `primitive.color.blue.*`
- `primitive.color.green.*`
- `primitive.color.orange.*`
- `primitive.color.red.*`
- `primitive.type.family.system`
- `primitive.type.family.mono`
- `primitive.space.*`
- `primitive.radius.*`
- `primitive.motion.duration.*`

Primitive tokens may contain raw values. Product surfaces should not reference
primitive tokens directly.

### Semantic Tokens

Semantic tokens describe product meaning:

- `semantic.color.text.primary`
- `semantic.color.text.secondary`
- `semantic.color.surface.window`
- `semantic.color.surface.panel`
- `semantic.color.surface.canvas`
- `semantic.color.border.default`
- `semantic.color.action.primary`
- `semantic.color.status.success`
- `semantic.color.status.warning`
- `semantic.color.status.danger`
- `semantic.color.focus.ring`
- `semantic.motion.standard`
- `semantic.motion.reduced`

Owner-visible UI must use semantic tokens unless a component token is more
specific.

### Component Tokens

Component tokens describe reusable component decisions:

- `component.button.height`
- `component.button.radius`
- `component.segment.height`
- `component.row.height`
- `component.assetRow.thumbnailSize`
- `component.previewStage.minWidth`
- `component.previewStage.checkerboardSize`
- `component.rightInformation.width`
- `component.modal.width`
- `component.saveState.bannerHeight`

Component tokens must alias primitive or semantic tokens. Do not hardcode
component sizes inside page styles.

## Code Token Naming

CSS custom properties should mirror the token hierarchy:

```css
--asv-color-text-primary
--asv-color-surface-panel
--asv-color-action-primary
--asv-space-panel-padding
--asv-radius-control
--asv-toolbar-height
--asv-asset-row-thumbnail-size
--asv-preview-stage-min-width
--asv-motion-standard-duration
```

Allowed raw values in UI code are limited to token definitions, reset rules,
fixed media math, or documented browser/platform workarounds. Any other raw
color, spacing, radius, shadow, z-index, typography, or motion value is design
system debt.

## Modes

Required modes:

- light
- dark
- reduced motion
- reduced transparency

Optional mode:

- compact density, only after the UI/UX owner and Product Owner agree on the
  final minimum supported window size

Dark mode, appearance controls, logs, and settings are menu-bar entries in the
short-term app, not main-surface toolbar buttons.

## Component Hierarchy

Use the canonical component hierarchy below.

### Atoms

Atoms are indivisible display or interaction units:

- `Icon`
- `Text`
- `Label`
- `Badge`
- `StatusDot`
- `Divider`
- `Spinner`
- `ThumbnailFrame`
- `Tooltip`

Atoms do not know product workflows. If an atom needs workflow state, promote
the behavior to a molecule or component.

### Molecules

Molecules combine atoms into reusable controls:

- `ToolbarButton`
- `IconButton`
- `CanvasModeSwitch`
- `SegmentItem`
- `FactCell`
- `SpecStatusCell`
- `InlineStatus`
- `FileDropTarget`
- `DragDecisionZone`
- `PlaybackButtonGroup`
- `ContextMenuItem`
- `RenameInput`
- `InlineTextReplacementInput`
- `SaveButtonPair`

Molecules own interaction states such as hover, focus, pressed, disabled,
selected, loading, dirty, and error.

### Components

Components combine molecules into product units:

- `WindowChrome`
- `LaunchDropCanvas`
- `LaunchRecentFilesList`
- `FileRecentSubmenu`
- `PreviewStage`
- `PlaybackControls`
- `RightInformationSurface`
- `FileFactRow`
- `ProductionSpecStatusRow`
- `MetricOptimizationEntry`
- `OptimizationSpecDetailRow`
- `AssetRow`
- `SequenceThumbnail`
- `AudioAssetRow`
- `ReplaceableImageRow`
- `ReplaceableTextRow`
- `OptimizationFindingRow`
- `OptimizationResultCard`
- `OptimizationResultSurface`
- `CompareCanvasSurface`
- `ComparePreviewCard`
- `DragDecisionOverlay`
- `CompareFileSlot`
- `SettingsSheet`
- `ThemeSegmentedControl`
- `TextReplacementSheet`
- `SaveFeedbackBanner`
- `ErrorRecoveryPanel`
- `LayerRow`
- `ReservedOperationPanel`

Every component must document its supported PRD IDs, tokens, variants, states,
auto layout behavior, accessibility behavior, expected source module, and
evidence.

### Modules

Modules compose components into screen regions:

- `LaunchModule`
- `PreviewCanvasModule`
- `RightInformationSurface`
- `OptimizationDetailSurface`
- `ReplaceableElementsSurface`
- `GeneralCompareModule`
- `OptimizationCompareModule`
- `EditReservedModule`
- `MenuBarCommandModel`
- `SaveStateModule`

Modules must not create one-off visual systems.

## Page States

The design must cover these states before implementation:

- Launch
- Loading
- Load failed
- Preview Overview
- Preview optimization detail/result
- Preview replaceable elements surface
- No replaceable elements
- No audio
- Playback abnormal
- Rename imageKey
- Runtime image replacement
- Runtime text replacement
- General compare
- Optimization compare
- Save validating
- Save complete
- Save failed
- Edit reserved

Any high-fidelity design that omits one of these states is incomplete.

## Layout Model

Launch uses a full-window canvas/drop surface with central Open and Drag
affordances and secondary recent-file rows.

Preview mode is the default complete product mode:

```text
canvas-first preview surface + state-driven right information surface
```

Edit mode is reserved for later advanced editing:

```text
left layer panel + center preview canvas + right reserved operation panel
```

The reserved operation panel must not contain inactive advanced controls.

General compare uses canvas-first A/B comparison:

```text
two preview canvases + one right comparison surface
```

Optimization compare uses before/after preview plus an optimization result
surface. Save actions are enabled only when optimized output exists.

## macOS Interaction Rules

The app should feel native even if implemented with web technology:

- Treat the window as a canvas-first surface.
- Keep macOS traffic-light controls visually present without turning the first
  row into a toolbar-heavy engineering shell.
- Launch has the central Open action; Preview opens another file from the
  macOS menu or canvas drag-and-drop.
- General Compare is entered from the macOS menu or drag-decision overlay, not
  from a persistent main-surface button.
- Put context-specific save affordances in the right-side action area only
  when output exists or dirty state requires it.
- Use the macOS menu bar for settings, logs, appearance, help, and app-wide
  commands.
- Use context menus for row-level resource actions such as Rename imageKey.
- Use modal sheets or restrained dialogs for runtime text replacement.
- Keep keyboard focus visible and predictable.
- Make dense metadata selectable and copyable when it is not a control.
- Disabled controls must explain why they are unavailable.

Required shortcuts:

- `Cmd+O`: Open SVGA.
- `Cmd+S`: Overwrite Save when unsaved output exists.
- `Cmd+Shift+S`: Save As.
- `Cmd+R`: Rename imageKey when an image resource is selected.
- `Space`: Play/Pause when focus is not inside a text field or menu.
- `Esc`: Cancel rename, close top modal/sheet, or exit transient state.
- `Enter`: Confirm active rename or primary modal action when safe.

Do not expose asset-edit Undo/Redo shortcuts unless the current phase actually
supports those operations.

## Visual Rules

Use color as state and orientation, not decoration.

- Primary action: open, run optimization, confirm rename, save.
- Success: validated parse, save complete, reopened output.
- Warning: review-only optimization, provisional spec limits, unsupported audio.
- Danger: invalid file, parse failure, save failure, unsafe optimization.
- Secondary compare color: B-side or after-side only.

Avoid:

- one-note purple, beige, dark slate, or gradient-heavy themes
- decorative gradient backgrounds
- hero-scale type inside app surfaces
- marketing cards
- nested decorative cards
- browser-style navigation bars
- color-only status communication

Keep the opened SVGA visually dominant. Interface motion should not compete
with playback. The Launch checkerboard idle motion is allowed only before a
file is opened and only as a low-emphasis background state.

## Typography And Copy

Chinese is primary. English may appear only for file format terms, keys,
shortcuts, report fields, or developer-facing traceability.

Use compact, readable type. Metadata, keys, dimensions, hashes, and filenames
may use monospace. Labels should be short and operational.

Error copy must say:

1. what happened
2. what the user can do
3. whether the source file was modified

Optimization copy must distinguish:

- can optimize now
- needs review
- unsupported
- skipped for safety

## Accessibility Rules

The design and code must support:

- visible focus for every keyboard-reachable control
- keyboard path for open, playback, mode switching, context menus, rename,
  modal confirm/cancel, and save
- reduced motion
- reduced transparency
- copyable metadata and error text
- no color-only status
- disabled states with understandable reasons
- text that does not overlap or collapse into one-character columns

Do not claim WCAG completion until accessibility checks, keyboard order,
contrast, focus visibility, reduced motion, reduced transparency, and resize
behavior are verified.

## Foreground Desktop Evidence

Automated smoke screenshots and smoke reports are regression evidence. They do
not prove that the macOS window layout, system chrome integration, menu bar
presence, visual hierarchy, spacing, focus path, or real production-material
behavior is acceptable.

Do not claim owner-visible UI/UX acceptance for a visual or interaction slice
until the review includes foreground screenshots from the actual desktop
client. The captures should include the macOS menu bar, native titlebar/window
chrome, and the active app state the owner would actually see.

When available, use multiple real SVGA files from
`/Users/huangtengxin/Downloads/auto-svga测试物料` for this foreground pass. Cover
varied file size, resource count, memory estimate, replaceable elements, text
elements, and optimization conditions when those factors affect the touched
surface.

If foreground screenshots cannot be collected during a slice, mark the visual
or interaction acceptance as unproven. The review may still report automated
smoke as regression evidence, but it must not equate smoke success with UI
design acceptance.

## Design-To-Code Rule

Before implementing any UI slice, the task must name:

- PRD requirement IDs
- design surface or page state
- component/module names
- token dependencies
- expected source files
- evidence or screenshot required
- explicit non-goals

Do not implement UI from visual intuition alone.

## Do

- Use the main PRD for scope.
- Use the UI/UX design brief for short-term screen and interaction inputs.
- Use the redesign execution plan for token/component/implementation gates.
- Build UI from tokens and documented components.
- Keep Preview mode complete and primary.
- Keep Edit mode reserved and quiet.
- Keep save states honest and validation-gated.
- Make failure and unsupported states visible.

## Do Not

- Do not revive the old Web Preview visual baseline.
- Do not expose export acceptance in the short-term app.
- Do not expose sequence-frame repair in the short-term app.
- Do not show inactive future controls.
- Do not make all image assets look like replaceable elements.
- Do not persist runtime text preview into SVGA bytes.
- Do not imply optimization output exists before real bytes are produced.
- Do not hardcode owner-visible visual values outside token definitions.

## Maintenance

Update this file when the design system token namespaces, component inventory,
or agent-readable visual identity changes.

Update `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md` when the short-term
design input changes.

Update `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md` when the
execution workflow, traceability rules, or implementation gates change.

Update `docs/product/PRODUCT_ROADMAP.md` only when product scope,
requirements, acceptance boundaries, or roadmap direction change.
