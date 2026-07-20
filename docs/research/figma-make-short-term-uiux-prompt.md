# Figma Make Prompt Package For Short-term UI/UX Redesign

Date: 2026-07-02
Owner role: UI/UX
Status: draft prompt package for Figma Make
Authority: non-PRD supporting artifact

## Purpose

This document packages the current Auto SVGA short-term product scope and
UI/UX design-system rules into prompts that can be pasted into Figma Make.

It does not redefine product scope. The only project-level PRD authority is
`docs/product/PRODUCT_ROADMAP.md`. This prompt package must stay subordinate to:

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `docs/product/SHORT_TERM_UI_UX_LOW_FIDELITY_IA.md`
- `DESIGN.md`

## Figma Make Operating Boundary

Use Figma Make for a first interactive design draft, not as the final design
system authority.

Figma Make is suitable for:

- generating a functional prototype, web app, or interactive UI from prompts
- using Plan mode to review and refine a structured plan before code is written
- attaching Figma designs or style context when available
- iterating through chat, point-and-edit, and direct code edits
- copying a Make preview into Figma Design as editable layers for manual design
  refinement

Figma Make is not sufficient by itself for:

- final PRD scope decisions
- guaranteed token-bound Figma variables
- a complete production-grade component library
- bidirectional sync from copied design layers back into the Make file
- exact native macOS behavior
- exact preservation of a formal design system unless manually refined later

Operational rules:

- Use Plan mode first. Do not let Figma Make build before the plan is reviewed.
- Paste the context block below into the prompt or into `guidelines.md`.
- Attach only approved design context. Do not attach real production SVGA
  assets or private local files.
- Do not publish the Make output publicly.
- Avoid web search or third-party content unless explicitly required.
- After Make generates the interactive prototype, copy key states as design
  layers into Figma Design and manually refine variables, components, Auto
  Layout, variants, and naming.

Reference:

- https://help.figma.com/hc/en-us/articles/31304412302231-Explore-Figma-Make
- https://help.figma.com/hc/en-us/articles/31304485164695-Create-and-edit-a-Figma-Make-file
- https://help.figma.com/hc/en-us/articles/31722591905559-Figma-Make-FAQs
- https://www.figma.com/blog/bringing-figma-make-to-the-canvas/

## Recommended Make Workflow

1. Create a new Figma Make file.
2. Paste Prompt 1 using `/plan`.
3. Review the plan against the QA checklist in this document.
4. If the plan is acceptable, paste Prompt 2 to build.
5. Use Prompt 3 to force a state gallery if any required state is missing.
6. Use Prompt 4 to correct common visual drift.
7. Copy the key Make preview states into Figma Design as editable layers.
8. Convert the copied screens into a formal Figma design system manually:
   variables, styles, components, variants, Auto Layout, and trace labels.

## Context Block For Figma Make

Paste this context before or together with the prompts.

```text
Auto SVGA is a local-first macOS desktop utility for SVGA motion assets.

Product authority:
- PRODUCT_ROADMAP is the only PRD authority.
- This design must cover the corrected short-term scope only.
- Do not add export acceptance, sequence-frame repair, advanced layer editing,
  timeline editing, batch replacement, AI generation, accounts, cloud sync, or
  telemetry.

Short-term product capabilities S1-S16:
S1 Open local SVGA from toolbar, drag/drop, or macOS File menu.
S2 Play SVGA and report loading, parsing, invalid-file, and playback abnormal states.
S3 Show basic file information: file size, estimated decoded memory, canvas size, FPS, asset count.
S4 Show production-spec comparison inside Overview, not as a separate module.
S5 Show all asset information: images, sequence/frame groups, audio group, replaceable elements.
S6 Show image thumbnails, four-frame sequence thumbnails, and truthful audio icon/empty states.
S7 Identify replaceable elements by designer-named imageKey, excluding automatic img_000/img_001 style names.
S8 Detect optimization opportunities with brief reason and estimated impact.
S9 Run real safe optimization only when optimized SVGA bytes can be produced and validated.
S10 Enter optimization comparison flow with before/after previews and result card.
S11 Rename imageKey from context menu or Cmd+R with inline editing.
S12 Preview replaceable images in Preview mode without switching to Edit mode.
S13 Preview replaceable text through a sheet/modal; runtime preview only, no byte persistence claim.
S14 Save edited output through explicit Overwrite Save or Save As.
S15 Keep audio parsing deferred; show "当前文件暂无音频资产" when no audio is available.
S16 Show recent SVGA files: launch shows 5 low-emphasis rows, File > Recent submenu shows 10 rows and clear-history.

Primary short-term states:
- Launch
- Loading
- Load failed
- Preview Overview
- Preview Optimization
- Preview Replaceable Elements
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
- Recent file missing

Design direction:
- Design as a native-feeling macOS app, not a website, dashboard, or Electron prototype.
- Use a titlebar-integrated toolbar with macOS traffic lights.
- Keep Open SVGA and Compare on the left side.
- Keep Preview/Edit mode switch near the left side.
- Keep Overwrite Save and Save As on the right side.
- Preview mode is the complete default mode: center playback canvas plus right inspector tabs.
- Edit mode is reserved: left layer list, center canvas, quiet right reserved panel, no inactive advanced controls.
- Settings, logs, appearance, and help belong in the macOS menu bar, not direct toolbar buttons.
- Chinese is primary UI language. English is allowed only for SVGA, imageKey, file names, shortcuts, and trace labels.
- Make metadata dense, readable, selectable-looking, and easy to scan.
- Keep the opened SVGA visually dominant. Interface decoration must not compete with playback.

Launch page:
- Only one full-window central canvas/drop surface.
- Show "拖入文件" and a primary "打开文件" button.
- Recent files appear inside the canvas under the primary Open/Drag area.
- Recent list is a single vertical column, up to 5 rows, low emphasis.
- Recent rows must not look more important than the Open button and drag prompt.
- Do not expose full local paths; show file name and redacted parent/context only.

Menu model:
- Auto SVGA: About, Settings, Services, Hide, Quit.
- File: Open SVGA, Close File, Recent submenu, Overwrite Save, Save As.
- File > Recent: up to 10 recent SVGA records, separator, Clear Recent.
- Edit: standard text operations where applicable, Rename imageKey, Cancel active edit.
- View: Preview Mode, Edit Mode, Enter/Exit Compare, appearance entry if represented.
- Playback: Play/Pause, Replay, Loop.
- Resource: Rename imageKey, Replace Preview Image, Reset Preview Replacement.
- Optimize: Check Optimization, Run Safe Optimization, Show Optimization Comparison.
- Window: standard macOS window actions.
- Help: Help, Known Limitations, Show Logs.
- Do not add menu items for export acceptance, sequence repair, batch replacement, advanced layer editing, or AI generation.

Design-system rule:
- Every visible element must trace:
  primitive token -> semantic token -> component token -> atom -> molecule -> component -> module -> page state.
- Use token names in the design and code comments where possible.
- If Figma Make cannot bind real variables, still name sections, components, and CSS variables according to the token model.

Token namespaces:
- primitive.color, primitive.type, primitive.space, primitive.size, primitive.radius, primitive.shadow, primitive.motion
- semantic.color.text, semantic.color.surface, semantic.color.border, semantic.color.action, semantic.color.status, semantic.color.focus
- component.toolbar, component.button, component.tab, component.row, component.previewStage, component.inspector, component.modal, component.menu, component.saveState

Canonical components:
- Atoms: Icon, Text, Label, Badge, StatusDot, Divider, Spinner, ThumbnailFrame, Tooltip.
- Molecules: ToolbarButton, IconButton, SegmentedModeSwitch, TabItem, FactCell, SpecStatusCell, InlineStatus, FileDropTarget, PlaybackButtonGroup, ContextMenuItem, RenameInput, SaveButtonPair.
- Components: WindowToolbar, LaunchDropCanvas, LaunchRecentFilesList, FileRecentSubmenu, PreviewStage, PlaybackControls, RightTabPanel, OverviewFactRow, ProductionSpecInlineRow, AssetRow, SequenceThumbnail, AudioAssetRow, ReplaceableImageRow, ReplaceableTextRow, OptimizationFindingRow, OptimizationResultCard, ComparePreviewCard, TextReplacementSheet, SaveFeedbackBanner, ErrorRecoveryPanel, LayerRow, ReservedOperationPanel.
- Modules: LaunchModule, PreviewCanvasModule, OverviewTabModule, OptimizationTabModule, ReplaceableElementsTabModule, GeneralCompareModule, OptimizationCompareModule, EditReservedModule, MenuBarCommandModel, SaveStateModule.

Visual rules:
- Native, precise, calm, technical, trustworthy.
- Use restrained macOS-like materials, panels, split views, sheets, context menus, segmented controls, and toolbar controls.
- Avoid marketing hero sections, browser navigation, nested decorative cards, gradient/orb backgrounds, oversized typography, one-note purple/beige/dark-slate themes, and decorative fake dashboards.
- Use color for state and orientation, not decoration.
- Status must not rely on color alone.
- Primary actions: open, run safe optimization, confirm rename, save.
- Warning: review-only optimization, provisional spec limits, unsupported audio.
- Danger: invalid file, parse failure, save failure, unsafe optimization.
- Secondary compare color may distinguish B-side or after-side only.

Accessibility:
- Visible focus for every keyboard-reachable control.
- Keyboard path for open, play/pause, tab switching, context menu, rename, modal confirm/cancel, and save.
- Reduced motion and reduced transparency should be represented.
- Disabled controls must explain why unavailable through tooltip, disabled text, or nearby state copy.
- Text must not overlap or collapse at 1180 x 760.

Use realistic placeholder data:
- avatar_frame_basic.svga
- File size: 812 KB, target <= 512 KiB
- Estimated decoded memory: 18.4 MiB, advisory high
- Canvas: 300 x 300, target <= 300 x 300
- FPS: 24, target <= 24
- Duration: 3000 ms, target <= 3000 ms
- Assets: 42, target <= 32
- Replaceable imageKeys: avatar_frame_bg, badge_icon, profile_photo
- Replaceable text keys: nickname_text, level_label
- Recent files: avatar_frame_basic.svga, profile_border_loop.svga, vip_entry_ring.svga, festival_badge.svga, missing_recent.svga
- Missing recent state: "文件已移动或不可访问，源文件未被修改。"
```

## Prompt 1: Plan Mode

Use this first. Do not build yet.

```text
/plan

Design an interactive Figma Make prototype for Auto SVGA using the attached or pasted context.

Do not generate UI yet. First produce a structured implementation and design plan that I can review.

The plan must include:
1. Prototype architecture: routes or state views for all required states.
2. Design-system foundations: token namespaces, component hierarchy, naming rules, and state variants.
3. macOS app shell model: titlebar-integrated toolbar, traffic lights, menu bar representation, and keyboard shortcuts.
4. Primary layouts:
   - Launch
   - Preview Overview
   - Preview Optimization
   - Preview Replaceable Elements
   - Optimization Compare
   - General Compare
   - Edit Reserved
   - Save and error states
5. Interaction model:
   - open local SVGA placeholder flow
   - drag/drop state
   - recent file open and missing-file recovery
   - tab switching
   - play/pause and playback abnormal
   - context menu rename imageKey
   - runtime image replacement preview
   - runtime text replacement sheet
   - safe optimization and before/after comparison
   - Overwrite Save and Save As states
6. Visual fidelity plan:
   - how the UI will feel native to macOS
   - how dense metadata remains readable
   - how the SVGA preview remains visually dominant
   - how status hierarchy avoids color-only communication
7. Explicit non-goals that must not appear anywhere.
8. QA checklist mapping each planned view to PRD S1-S16.

Important:
- Chinese labels are primary.
- Do not include export acceptance, sequence repair, advanced timeline/layer editing, AI generation, cloud/accounts, telemetry, or inactive future controls.
- Do not use old Web Preview, Electron prototype, or P6 Workbench visuals as the baseline.
- If any requirement conflicts with the context, follow PRODUCT_ROADMAP.
```

## Prompt 2: Build The Interactive Prototype

Use after reviewing the Plan mode output.

```text
Proceed with the approved plan and build the interactive Auto SVGA short-term macOS app prototype.

Build a polished, high-fidelity desktop app draft, not a rough wireframe and not a marketing page.

Required output structure:
1. A macOS-style app shell at 1440 x 900, also robust at 1180 x 760.
2. A left-to-right titlebar-integrated toolbar:
   - traffic lights
   - 打开 SVGA
   - 对比
   - Preview / Edit segmented mode switch
   - concise center file/state identity only when useful
   - 覆盖保存 and 另存为 on the right, disabled until output exists
3. A macOS menu bar model with:
   - Auto SVGA
   - File with Recent submenu
   - Edit
   - View
   - Playback
   - Resource
   - Optimize
   - Window
   - Help
4. State navigation inside the prototype so reviewers can switch between:
   - Launch
   - Loading
   - Load failed
   - Preview Overview
   - Preview Optimization
   - Preview Replaceable Elements
   - No replaceable elements
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
   - Recent file missing

Launch page requirements:
- The first screen is one full-window canvas/drop surface only.
- Center text: 拖入文件.
- Primary button: 打开文件.
- Recent files are inside the canvas, below the primary action, as a single vertical list of 5 low-emphasis rows.
- Recent rows must not be cards and must not compete with the Open button.
- Include one missing recent file example with recoverable feedback.

Preview Overview:
- No left panel.
- Center PreviewStage is dominant.
- RightTabPanel has tabs: 概览, 优化, 可替换元素.
- Overview includes file facts and production-spec comparison inline:
  current value + requirement + status for file size, memory estimate, canvas, FPS, duration, asset count.
- Show asset groups with thumbnail rows:
  images, sequence/frame group with four-grid thumbnail, audio empty state, replaceable summary.
- Audio empty copy: 当前文件暂无音频资产.

Preview Optimization:
- Show optimization finding rows.
- Classify findings as 可安全执行, 需复核, 暂不支持/建议项.
- Show a primary action named 执行安全优化 or 一键优化, with nearby copy that it only executes safe deterministic items.
- Review-only and unsupported rows must not look executable.

Preview Replaceable Elements:
- Separate image and text groups.
- Show designer-named imageKeys only, not every image asset.
- Each image row has Replace, Reset, context menu affordance, and Rename imageKey via Cmd+R.
- Text rows open a sheet/modal for runtime preview only.

Rename imageKey:
- Show a context menu with Rename imageKey / Cmd+R.
- Show inline rename input with Enter confirm and Esc cancel.
- After valid rename, enable save actions and show dirty state.

Runtime text replacement:
- Use a macOS-like sheet or restrained modal.
- Fields: text, family, size, color, offset.
- Copy must state it is runtime preview only and does not persist text into SVGA bytes.

Optimization compare:
- Show before and after preview cards with equal visual weight.
- Show an OptimizationResultCard with changed items, before/after size, memory estimate impact, skipped/risky items.
- Enable top-right save actions only when optimized output exists.

General compare:
- Show A info/assets left, two previews center, B info/assets right.
- Do not show optimization result card in general compare.

Save states:
- Save validating: disable duplicate save actions and show validation in progress.
- Save complete: show validated/reopened output and clean dirty state.
- Save failed: show what happened, what to do next, and that the source file was not modified; include Retry and Save As recovery.

Edit reserved:
- Show left layer list, center preview canvas, and quiet right reserved operation panel.
- Do not show advanced editing controls, timeline, transform controls, mask controls, audio editing, or inactive future controls.

Design-system expectations:
- Create or expose a "Design System" view/section in the prototype with token swatches and component examples.
- Use stable names for tokens, components, modules, and page states.
- If real Figma variables cannot be bound, represent token names in style metadata, CSS variables, or component labels.
- Use Auto Layout-like spacing and consistent component states.
- Avoid raw one-off visual decisions.

Visual fidelity expectations:
- It should look like a serious native macOS creator utility.
- Use restrained translucency/material only where useful.
- Avoid marketing hero typography, decorative gradients, nested cards, browser nav bars, and flashy illustration.
- Keep information dense but calm and scannable.
- Ensure focus states, disabled states, hover states, selected states, loading states, warning states, danger states, and success states are all visible in the component examples.

Use placeholder SVGA artwork only. Do not fetch external images, fonts, or third-party assets. Use CSS/vector placeholders for thumbnails and canvas content.
```

## Prompt 3: Force Complete State Gallery

Use this if Make builds only the primary screen or hides states behind flows
that are hard to review.

```text
Add a reviewer-facing State Gallery without changing product scope.

The State Gallery must show one static, high-fidelity frame for each required state:
- Launch
- Loading
- Load failed
- Preview Overview
- Preview Optimization
- Preview Replaceable Elements
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
- Recent file missing

Each frame must include a small trace label outside the app window:
PRD IDs, page state, module, key components, token namespaces.

Do not add new product features. Do not include export acceptance, sequence repair, timeline editing, advanced layer controls, batch replacement, AI, accounts, cloud, or telemetry.
```

## Prompt 4: Correct Common Visual Drift

Use this if the output still feels like a generic web dashboard or draft.

```text
Refine the visual design toward a native macOS professional utility.

Do not change product scope or add features.

Correct these issues:
- Replace browser-like header/navigation with titlebar-integrated macOS toolbar.
- Remove marketing-card hierarchy, oversized headings, decorative gradients, and dashboard-style hero layout.
- Reduce visual noise and keep the SVGA preview canvas dominant.
- Make the inspector feel like a dense native utility panel, not a stack of decorative cards.
- Make all rows, tabs, buttons, sheets, menus, badges, and save states use consistent component styling.
- Add visible focus, hover, selected, disabled, loading, success, warning, danger, and dirty states.
- Ensure recent files on launch remain lower emphasis than "拖入文件" and "打开文件".
- Ensure optimization copy distinguishes "可安全执行", "需复核", and "暂不支持/建议项".
- Ensure Save buttons look disabled until byte-output exists.
- Ensure Edit mode is quiet and reserved, with no inactive advanced controls.

Keep Chinese primary labels. Keep token/component names visible in the design-system section.
```

## Prompt 5: Prepare For Copying To Figma Design

Use before copying Make previews as design layers.

```text
Prepare the prototype for copying into Figma Design as editable design layers.

Create a clean screen index with one route or page section per required state.
For each state, keep the complete app window visible in the viewport and avoid scroll-dependent hidden content.

Add a Design System board with:
- token swatches
- typography samples
- toolbar controls
- buttons
- tabs
- badges
- status rows
- asset rows
- thumbnails
- context menu
- modal/sheet
- save feedback banners
- compare cards
- empty/loading/error panels

Use stable layer/component-like names:
WindowToolbar, LaunchDropCanvas, PreviewStage, RightTabPanel, OverviewFactRow,
ProductionSpecInlineRow, AssetRow, ReplaceableImageRow, ReplaceableTextRow,
OptimizationFindingRow, OptimizationResultCard, ComparePreviewCard,
TextReplacementSheet, SaveFeedbackBanner, ErrorRecoveryPanel,
ReservedOperationPanel.

Do not publish. Do not use external images or fonts.
```

## QA Checklist

Use this checklist before accepting Make output as a useful design draft.

Product scope:

- S1-S16 are all represented.
- No export acceptance surface appears.
- No sequence-frame repair surface appears.
- No timeline, transform, mask, audio editing, or advanced layer-editing
  controls appear.
- No AI, accounts, cloud, telemetry, collaboration, or public-release surfaces
  appear.

macOS-first experience:

- Toolbar feels titlebar-integrated.
- Traffic lights share the toolbar row.
- File, Edit, View, Playback, Resource, Optimize, Window, and Help menu model
  is represented.
- Context menu exists for Rename imageKey.
- Text replacement uses a sheet or restrained modal.
- Save flows are explicit and validation-gated.

Launch:

- First screen is only the canvas/drop surface.
- "拖入文件" and "打开文件" are visually dominant.
- Recent files are inside the canvas, single vertical column, up to 5 rows.
- Recent files do not expose full local paths.
- Missing recent file has recoverable feedback.

Preview:

- Preview mode has no left panel.
- Center canvas dominates.
- Right panel uses Overview, Optimization, Replaceable Elements tabs.
- Production-spec comparison appears inside Overview.
- Audio empty state says `当前文件暂无音频资产`.

Replaceable and rename:

- Replaceable image list includes designer-named imageKeys only.
- Text replacement says runtime preview only.
- Rename imageKey shows context menu, inline input, Enter confirm, Esc cancel.
- Save actions enable only after persisted byte-output exists.

Optimization:

- Safe executable, review-only, and unsupported findings are visually distinct.
- Batch optimization copy makes clear it executes only safe deterministic items.
- Optimization compare shows before/after preview and result card.
- Risky/skipped items are visible.

Design system:

- Token namespaces are visible or represented.
- Components use canonical names.
- State variants are visible.
- Design System board exists.
- Copied Design layers will still need manual variable/component binding.

Accessibility:

- Focus state is visible.
- Status is not color-only.
- Disabled state explains why unavailable.
- Error copy says what happened, what to do, and whether source file changed.
- At 1180 x 760, text does not overlap or collapse into unreadable columns.

## Expected Manual Follow-up In Figma Design

After copying Make previews into Figma Design, manually create or repair:

- Primitive variable collection
- Semantic variable collection with light/dark/reduced-transparency modes
- Typography styles
- Component variants
- Auto Layout constraints
- Interaction annotations
- S1-S16 trace labels
- Window-size frames for 1440 x 900 and 1180 x 760
- Accessibility notes

Make output is a draft input. The formal high-fidelity design is accepted only
after the copied Figma Design file has real variables, components, variants,
Auto Layout, state coverage, and trace mapping.
