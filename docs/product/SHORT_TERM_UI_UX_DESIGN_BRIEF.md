# Short-term UI/UX Design Brief

Date: 2026-07-01
Status: active design input for the corrected short-term SVGA app
Authority: subordinate to `docs/product/PRODUCT_ROADMAP.md`

## Purpose

This brief gives the UI/UX owner enough product input to redesign the
short-term Auto SVGA app as a macOS-first desktop tool.

It does not redefine product scope. The main PRD remains
`docs/product/PRODUCT_ROADMAP.md`. If this brief conflicts with the main PRD,
the main PRD wins and this brief must be corrected.

Execution companion:
`docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md` defines the
design-system-first execution plan for this brief, including token hierarchy,
atomic component composition, design-to-code traceability, and implementation
gates. It is also subordinate to the main PRD and must not redefine scope.

The redesign is a clean-slate UI/UX design. Do not use Web Preview, historical
P6 Workbench screens, or the Electron prototype as the visual baseline. They
may be used only as engineering lineage or evidence of previously implemented
capabilities.

## Design Goal

Design Auto SVGA as a local, professional macOS app for opening, previewing,
inspecting, lightly validating, previewing replaceable elements, renaming
imageKeys, optimizing, comparing, and saving SVGA files.

Although the implementation may use web technology inside Electron, the
experience should feel native to macOS: window chrome, toolbar behavior,
menus, shortcuts, contextual menus, modal sheets, focus behavior, drag and drop,
disabled states, and save flows should follow macOS desktop expectations as
closely as the implementation allows.

## Primary Users

| User | Job | Design implication |
| --- | --- | --- |
| Motion or visual designer | Quickly check whether an exported SVGA looks right and contains intended replaceable elements. | Make opening, playback, replaceable preview, and visual comparison immediate. Avoid debug-first UI. |
| Front-end or client integrator | Inspect imageKeys, file attributes, production-spec fit, and runtime replacement behavior. | Make keys, dimensions, file size, memory estimate, and replacement controls easy to scan and copy. |
| Asset reviewer or producer | Decide whether a file can be accepted, optimized, or sent back for design revision. | Make pass/fail/review states honest, comparative, and evidence-oriented. |
| Internal release tester | Validate first-distributable behavior and known limitations. | Keep states, menus, save actions, and errors consistent enough to test repeatedly. |

## Task Priority

Design around the most common short-term flow first:

1. Open or drag a local SVGA file.
2. Confirm playback and visual appearance.
3. Read basic file information and production-spec comparison.
4. Inspect asset groups and replaceable elements.
5. Preview replaceable image or text behavior.
6. Rename imageKey when needed.
7. Review optimization opportunities.
8. Run enabled optimization and compare before/after.
9. Save by Overwrite Save or Save As.
10. Reopen or continue inspection.

Do not optimize the first screen for rare or deferred workflows.

## Required Screen Inventory

The design must cover every state below. A polished main screen without these
states is incomplete.

| Screen or state | Must show |
| --- | --- |
| Launch page | One primary preview/drop card, open action, drag hint, no full app chrome beyond the window shell. |
| Loading | Honest loading feedback and a visible way to choose another file when loading is slow or failed. |
| Load failed | Human-readable error, no stale file data, recovery by opening or dragging another file. |
| Preview mode: Overview | Center playback canvas and right Overview tab with file facts, production-spec comparison, and asset summary. |
| Preview mode: Optimization | Optimization findings, estimated file/memory impact, enabled action buttons only when real output can be produced. |
| Preview mode: Replaceable Elements | Image and text replaceable groups, sorted keys, display numbering, Replace/Edit/Reset actions. |
| No replaceable elements | Empty state that explains no designer-named imageKeys/text keys were found without showing all ordinary images again. |
| No audio | Audio group empty state: `当前文件暂无音频资产`. |
| Playback abnormal | Playback canvas area plus clear abnormal status and recovery action. |
| Rename imageKey | Context menu and `Cmd+R` flow, inline rename state, Enter confirm, Esc cancel, save buttons enabled after valid rename. |
| Runtime image replacement | Preview mode remains active; replacement and reset affect playback preview without switching to Edit mode. |
| Runtime text replacement | Modal or sheet for supported text fields; Apply/Cancel/Reset; no claim of byte persistence. |
| Edit mode | Left layer list, center canvas, right operation area empty/reserved without inactive controls. |
| General compare mode | Left A info/assets, center two animation previews, right B info/assets; no optimization panel. |
| Optimization compare mode | Before/after previews, optimization result card, before/after metrics, save buttons. |
| Save validating | In-progress save state with disabled duplicate save actions and no success claim before validation. |
| Save complete | Saved feedback, clean dirty state, reopened or validated output status. |
| Save failed | Failure reason, retry, Save As recovery when overwrite fails. |
| macOS menu bar | File/Edit/View/Playback/Resource/Optimize/Window/Help structure with relevant enabled/disabled states. |
| Settings/logs/dark mode entry | Available from menu bar, not direct main-surface buttons. |

## App Architecture

The short-term app has two modes.

Preview mode is the default and should feel complete. It shows:

- center playback canvas and playback controls
- right panel with Overview, Optimization, and Replaceable Elements tabs
- no left panel

Edit mode is reserved. It shows:

- left layer panel with layer thumbnail and layer name
- center playback canvas and playback controls
- right operation panel empty in the short-term version

Edit mode must not contain inactive advanced controls. If the right panel is
visually present, it should communicate reserved space quietly without looking
like a broken or unfinished feature.

## macOS Experience Principles

Use native macOS patterns as the design reference, not web-page patterns.

Required principles:

- Prefer a single window workbench with a toolbar integrated into the titlebar
  area.
- Keep the macOS traffic-light controls in the same horizontal row as the file,
  compare, and save controls.
- Use the menu bar for app-wide actions, settings, logs, appearance, window
  commands, and help.
- Use context menus for resource-row actions such as Rename imageKey.
- Use modal sheets or restrained dialogs for text editing and confirmations.
- Keep keyboard focus visible and predictable.
- Make all dense metadata text selectable and copyable when it is not inside a
  control.
- Let disabled controls explain their unavailable reason through tooltip,
  menu disabled label, or nearby state copy.
- Use system-like sizing, spacing, typography, materials, and motion; avoid
  landing-page hero composition, decorative gradients, marketing cards, and
  browser-style navigation bars.

Apple reference pages consulted for this brief:

- Human Interface Guidelines:
  https://developer.apple.com/design/human-interface-guidelines
- Toolbars:
  https://developer.apple.com/design/human-interface-guidelines/toolbars
- The menu bar:
  https://developer.apple.com/design/Human-Interface-Guidelines/the-menu-bar
- Windows:
  https://developer.apple.com/design/human-interface-guidelines/windows
- Split views:
  https://developer.apple.com/design/human-interface-guidelines/split-views
- Sidebars:
  https://developer.apple.com/design/human-interface-guidelines/sidebars
- Context menus:
  https://developer.apple.com/design/human-interface-guidelines/context-menus
- Segmented controls:
  https://developer.apple.com/design/human-interface-guidelines/segmented-controls

## Toolbar And Window Chrome

Top toolbar structure:

| Zone | Required content |
| --- | --- |
| Left window area | macOS traffic-light controls, visually integrated with the toolbar row. |
| Left app controls | Open File, Compare entry. |
| Mode control | Preview/Edit mode switch near the left side, not the old Local Preview / Export Acceptance switcher. |
| Center | File identity or concise state only when it helps; avoid large titles or status badges. |
| Right app controls | Overwrite Save and Save As, disabled until there is unsaved output. |

Design notes:

- The toolbar should feel like a macOS app toolbar, not a website header.
- The Compare entry sits next to file open and also appears in the menu bar.
- Export acceptance must not appear in the short-term toolbar.
- Settings, logs, and dark/light mode must not appear as direct toolbar
  buttons in the short-term app.

## Suggested Menu Bar Architecture

The UI/UX owner may refine labels, but the design must cover the action groups.

| Menu | Short-term content |
| --- | --- |
| Auto SVGA | About, Settings, Services, Hide, Quit. |
| File | Open SVGA, Open Recent if supported, Close File, Overwrite Save, Save As. |
| Edit | Standard text operations where applicable; Rename imageKey; cancel active rename/edit state. |
| View | Preview Mode, Edit Mode, Enter/Exit Compare, appearance or theme entry if supported. |
| Playback | Play/Pause, Replay, Loop if supported. |
| Resource | Rename imageKey, Replace Preview Image, Reset Preview Replacement. |
| Optimize | Check Optimization, Run Optimization, Show Optimization Comparison when output exists. |
| Window | Minimize, Zoom, Bring All to Front, standard macOS window actions. |
| Help | Auto SVGA Help, Known Limitations, Show Logs. |

Do not add menu items for export acceptance, sequence repair, batch
replacement, advanced layer editing, AI generation, or other out-of-scope
features in the short-term design.

## Keyboard Shortcuts

Product-required shortcut:

- `Cmd+R`: Rename imageKey when an image resource is selected.

Expected macOS shortcuts to design unless implementation constraints require a
Product Owner decision:

| Shortcut | Action |
| --- | --- |
| `Cmd+O` | Open SVGA. |
| `Cmd+S` | Overwrite Save when unsaved output exists. |
| `Cmd+Shift+S` | Save As. |
| `Space` | Play/Pause when focus is not inside a text field or menu. |
| `Esc` | Cancel rename, close top modal/sheet, or exit transient compare/edit state as appropriate. |
| `Enter` | Confirm active rename or primary modal action when safe. |

Do not expose asset-edit Undo/Redo shortcuts unless the implementation actually
supports those operations for the current phase. Native text-field Undo/Redo is
allowed inside text inputs.

## Layout Guidance

The design should propose concrete window metrics, but the following are
current input constraints rather than final UI decisions:

- Existing macOS workbench evidence used 1440 x 900 as a balanced launch size,
  1280 x 800 as a comfortable review size, and 1180 x 760 as a previous
  minimum supported workbench size.
- Because the corrected Preview mode hides the left panel, the UI/UX owner may
  propose a smaller minimum if all required states remain readable.
- The center canvas must remain visually dominant in Preview mode.
- Right panel density should support repeated scanning without becoming a
  marketing-style card stack.
- Compare modes should prioritize equal preview visibility and factual A/B
  information over decorative comparison framing.
- Text must not overlap, wrap to one-character columns, or hide primary
  actions at the proposed minimum window size.

Any final minimum size or breakpoint must include screenshots for Launch,
Preview Overview, Replaceable Elements, Optimization, General Compare, and Save
Failed states.

## Component Requirements

The UI design should specify at least:

- window toolbar
- traffic-light integration
- file open button
- compare entry
- mode switch
- playback controls
- preview canvas/stage
- right tab panel
- overview fact rows
- production-spec comparison rows
- asset rows with thumbnail/name/dimensions/size
- sequence four-grid thumbnail
- audio empty state/music icon state
- replaceable image row
- replaceable text row
- context menu
- rename inline editor
- text edit modal or sheet
- optimization finding row
- optimization result card
- before/after preview card
- save disabled/enabled/validating/success/failure states
- toast or feedback pattern
- menu bar structure
- keyboard focus state
- empty/error/loading states

## Copy And Language

- Chinese is primary for user-facing labels.
- English may appear only when it improves traceability for file format terms,
  keys, report fields, shortcuts, or developer-facing diagnostics.
- Keep labels short and operational.
- Do not use product marketing copy.
- Error copy should say what happened, what the user can do, and whether the
  source file was modified.
- Optimization copy should distinguish "can optimize now" from "needs review"
  and "unsupported".

## Accessibility And Interaction

The design must account for:

- visible focus for every keyboard-reachable control
- keyboard path for open, play/pause, tab switching, context menu actions,
  rename confirm/cancel, modal confirm/cancel, and save
- reduced motion
- reduced transparency or reduced blur when materials are used
- copyable metadata and error text
- no color-only status communication
- touchpad and mouse drag/drop states
- disabled and unavailable states with understandable reasons

## Design Deliverables

The UI/UX owner should produce:

1. Information architecture and navigation model.
2. User flows for open/play/inspect, replaceable preview, imageKey rename,
   optimization, general compare, and save failure recovery.
3. Full screen inventory covering every state listed in this brief.
4. High-fidelity macOS-style designs for the primary surfaces.
5. Component and state specifications.
6. Menu bar and shortcut specification.
7. Empty/error/loading copy examples.
8. Responsive/window-size recommendations with screenshots.
9. Accessibility checklist.
10. Requirement trace mapping from design surfaces to S1-S15 in
    `docs/product/PRODUCT_ROADMAP.md`.

## Explicit Design Non-goals

The short-term design must not include:

- export acceptance or export-review mode
- sequence-frame repair
- advanced layer editing
- timeline, transform, alpha, shape, mask, audio, or frame-structure editing
- batch replacement
- AI image generation, recommendation, or conversion workflows
- account, cloud, telemetry, collaboration, or public release surfaces
- inactive controls for future phases
- debug logs, raw report JSON, or settings as main-surface toolbar buttons
- web landing-page hero layout
- browser-style top navigation
- decorative gradient/orb backgrounds

## Open Design Decisions

These are intentionally left for the UI/UX owner or Product Owner review:

- final short-term tab label for Replaceable Elements, such as
  `可替换元素` or `编辑可替换元素`
- final default window size and minimum supported window size
- whether text editing appears as a macOS sheet, modal dialog, or popover
- whether Compare uses a toolbar button, segmented control, or split-view
  command style
- whether runtime image replacement should ever enable persisted save in the
  short-term build, beyond imageKey rename and optimization output
- exact appearance/theme menu behavior while dark mode is menu-only
