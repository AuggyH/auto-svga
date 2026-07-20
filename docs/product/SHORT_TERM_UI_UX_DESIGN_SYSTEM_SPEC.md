# Short-term UI/UX Design System Spec

Date: 2026-07-01
Status: draft design-system inventory for short-term UI/UX redesign
Authority: subordinate to `docs/product/PRODUCT_ROADMAP.md`

## Purpose

This document makes the short-term Auto SVGA design system concrete enough for
low-fidelity frames, high-fidelity Figma work, and later UI implementation.

It is not a PRD and does not define product scope. The only project-level PRD
authority remains `docs/product/PRODUCT_ROADMAP.md`. The design brief remains
`docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`. The execution and enforcement
model remains `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`.

## Token Namespaces

| Namespace | Examples | Notes |
| --- | --- | --- |
| `primitive.color` | neutral, blue, green, amber, red | raw palette only |
| `primitive.type` | family, size, weight, line height | system-first macOS feel |
| `primitive.space` | 4, 8, 12, 16, 20, 24, 32 | layout rhythm |
| `primitive.radius` | 6, 8, 12 | keep tool UI restrained |
| `primitive.shadow` | menu, panel, floating | only where hierarchy needs it |
| `primitive.motion` | fast, normal, idle, reduced | must support reduced motion |
| `semantic.color.text` | primary, secondary, muted, inverse | mode-aware |
| `semantic.color.surface` | window, toolbar, panel, canvas | mode-aware |
| `semantic.color.status` | success, warning, danger, info | never color-only |
| `component.button` | height, padding, radius, state color | toolbar/action controls |
| `component.row` | height, gap, thumbnail size | asset and fact rows |
| `layout.window` | canvas, right information area, compare, edit reserved | macOS app shell |

## CSS Variable Mapping

Implementation should map tokens to CSS variables using a stable prefix:

- `--asv-color-window`
- `--asv-color-toolbar`
- `--asv-color-panel`
- `--asv-color-canvas`
- `--asv-color-text`
- `--asv-color-text-muted`
- `--asv-color-border`
- `--asv-color-action`
- `--asv-color-success`
- `--asv-color-warning`
- `--asv-color-danger`
- `--asv-space-*`
- `--asv-radius-*`
- `--asv-shadow-*`
- `--asv-motion-*`

Page components should not introduce new visual values when an existing token
can express the intent.

## Component Inventory

### Atoms

| Component | PRD IDs | Token dependencies |
| --- | --- | --- |
| `Icon` | S1-S16 | semantic color, icon size |
| `Text` | S1-S16 | type and text color |
| `Label` | S3-S8, S11-S16 | text role |
| `Badge` | S2, S4, S7-S16 | status color and radius |
| `StatusDot` | S2, S4, S8-S14 | status color |
| `Divider` | S3-S8 | border color |
| `Spinner` | S1-S2, S9-S10, S14 | action color, motion |
| `ThumbnailFrame` | S5-S7, S12-S13 | canvas surface, border |
| `Tooltip` | S1, S8-S14 | panel surface, text |

### Molecules

| Component | PRD IDs | Required states |
| --- | --- | --- |
| `CanvasButton` | S1, S10, S14 | default, hover, focus, disabled, loading |
| `IconButton` | S2, S11-S13 | default, hover, focus, disabled |
| `CanvasModeSwitch` | S1-S14 | Preview selected, Edit selected, canvas top-center placement |
| `ModeSwitchItem` | S1-S14 | selected, hover, focus, disabled |
| `FactCell` | S3-S5 | known, unknown, warning |
| `SpecStatusCell` | S4 | pass, warning, fail, unknown |
| `InlineStatus` | S2, S8-S16 | info, success, warning, danger, loading |
| `FileDropTarget` | S1-S2 | empty, hover, invalid, loading |
| `PlaybackButtonGroup` | S2 | playing, paused, failed, disabled |
| `ContextMenuItem` | S11-S13 | enabled, disabled, shortcut |
| `RenameInput` | S11 | editing, invalid, saving, cancelled |
| `InlineTextPreviewInput` | S13 | empty, focused, applied, reset |
| `ContextualSaveAction` | S10-S14 | hidden where not applicable, disabled, dirty, validating, failed |
| `DragDecisionZone` | S1, S10 | supported focused, unsupported focused, inactive half |

### Components

| Component | Module owner | Evidence |
| --- | --- | --- |
| `WindowChrome` | app shell | native chrome/menu state proof |
| `LaunchDropCanvas` | LaunchModule | launch/open/drop proof, subtle checkerboard idle-motion proof, reduced-motion static proof |
| `LaunchRecentFilesList` | LaunchModule | S16 recent-file launch proof |
| `FileRecentSubmenu` | MenuBarCommandModel | S16 recent-file menu proof |
| `PreviewStage` | PreviewCanvasModule | playback and abnormal-state proof |
| `PlaybackControls` | PreviewCanvasModule | playback control proof |
| `RightInformationSurface` | Preview mode | default/detail/replaced-surface proof |
| `FileFactRow` | RightInformationSurface | rendered file-information proof |
| `ProductionSpecStatusRow` | RightInformationSurface | default status-only proof |
| `OptimizationSpecDetailRow` | OptimizationDetailSurface | actual/limit proof inside optimization context |
| `AssetRow` | Right information and Replaceable modules | asset grouping proof |
| `SequenceThumbnail` | RightInformationSurface | four-grid thumbnail proof |
| `AudioAssetRow` | RightInformationSurface | no-audio proof |
| `ReplaceableImageRow` | ReplaceableElementsSurface | runtime replacement proof |
| `ReplaceableTextRow` | ReplaceableElementsSurface | runtime text proof |
| `MetricOptimizationEntry` | RightInformationSurface | metric-level entry proof |
| `OptimizationFindingRow` | OptimizationDetailSurface | candidate proof |
| `OptimizationResultCard` | OptimizationCompareModule | before/after output proof |
| `ComparePreviewCard` | Compare modules | compare proof |
| `CompareInfoPanel` | GeneralCompareModule | A/B difference proof |
| `DragDecisionOverlay` | PreviewCanvasModule | open-vs-compare decision proof |
| `UnsupportedDropToast` | PreviewCanvasModule | unsupported file recovery proof |
| `InlineTextReplacementInput` | ReplaceableElementsSurface | runtime text input proof |
| `SaveFeedbackBanner` | SaveStateModule | save state proof |
| `ErrorRecoveryPanel` | Load failed, Save failed | recovery proof |
| `LayerRow` | EditReservedModule | reserved mode proof |
| `ReservedOperationPanel` | EditReservedModule | no inactive controls proof |

## Module Inventory

| Module | Required page states |
| --- | --- |
| `LaunchModule` | Launch, Loading, Load failed, recent clear |
| `PreviewCanvasModule` | Preview ready, Playback abnormal, Drag decision, Unsupported drop |
| `RightInformationSurface` | Default Preview information, No audio, compact spec status |
| `OptimizationDetailSurface` | Metric-level optimization detail |
| `ReplaceableElementsSurface` | Replaceable, No replaceable, Rename, Runtime replacement, inline text preview |
| `GeneralCompareModule` | Compare empty, Compare loaded, drag-add compare |
| `OptimizationCompareModule` | Optimization compare, Save As SVGA, Overwrite Save, Abandon Optimization |
| `EditReservedModule` | Edit reserved |
| `MenuBarCommandModel` | Menu bar |
| `SaveStateModule` | Save validating, Save complete, Save failed |

## Figma Collections

Future Figma work should use these collections:

- `Primitive`
- `Semantic` with light/dark/reduced-transparency modes
- `Typography`
- `Layout`
- `Component`
- `Motion`

Any unbound manual value should be recorded as design-system debt.

## Trace Requirement

Each component or page frame should be traceable to:

- PRD IDs
- page state
- module
- component
- token namespace
- implementation file
- verification evidence

## Open Decisions

- final minimum window size
- compact breakpoint behavior
- exact inline text replacement input styling
- exact Settings sheet visual layout for Follow System / Light / Dark
- which optimization methods are active in the first distributable build
- exact compare menu and drag-decision visual treatment
