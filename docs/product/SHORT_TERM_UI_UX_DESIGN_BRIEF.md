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
2. Or reopen a recent SVGA file from the launch page or File menu.
3. Confirm playback and visual appearance.
4. Read basic file information and compact production-spec status.
5. Inspect asset groups and replaceable elements.
6. Preview replaceable image or text behavior.
7. Rename imageKey when needed.
8. Review optimization opportunities.
9. Run enabled optimization and compare before/after.
10. Save by Overwrite Save or Save As.
11. Reopen or continue inspection.

Do not optimize the first screen for rare or deferred workflows.

## Required Screen Inventory

The design must cover every state below. A polished main screen without these
states is incomplete.

| Screen or state | Must show |
| --- | --- |
| Launch page | One primary central canvas/drop target, open action, drag hint, no full app chrome beyond the window shell. Up to five recent SVGA records appear below Open/Drag as secondary actions. |
| Loading | Honest loading feedback and a visible way to choose another file when loading is slow or failed. |
| Load failed | Human-readable error, no stale file data, recovery by opening or dragging another file. |
| Preview mode: default information | Center playback canvas and right state-driven information area with file facts, compact production-spec status, asset summary, and replaceable-element controls. |
| Preview mode: optimization detail/result | Metric-level optimization entry replaces the right information area with optimization detail or result comparison; enabled action buttons appear only when real output can be produced. |
| Preview mode: replaceable elements | Image and text replaceable groups, sorted keys, display numbering, image replacement/reset actions, inline text inputs, key edit actions, and reset actions. |
| No replaceable elements | Empty state that explains no designer-named imageKeys/text keys were found without showing all ordinary images again. |
| No audio | Audio group empty state: `当前文件暂无音频资产`. |
| Playback abnormal | Playback canvas area plus clear abnormal status and recovery action. |
| Rename imageKey | Context menu and `Cmd+R` flow, inline rename state, Enter confirm, Esc cancel, save buttons enabled after valid rename. |
| Runtime image replacement | Preview mode remains active; replacement and reset affect playback preview without switching to Edit mode. |
| Runtime text replacement | Inline text input for supported text fields; realtime preview and Reset; no claim of byte persistence. |
| Edit mode | Left layer list, center canvas, right operation area empty/reserved without inactive controls. |
| General compare mode | No persistent main-surface entry; entered by macOS menu or drag-decision overlay. Empty state keeps disabled playback controls. Loaded state shows two canvases and one comparison-focused right panel. |
| Optimization compare mode | Before/after previews, optimization result card, before/after metrics, Save As SVGA, Overwrite Save, and Abandon Optimization. |
| Save validating | In-progress save state with disabled duplicate save actions and no success claim before validation. |
| Save complete | Saved feedback, clean dirty state, reopened or validated output status. |
| Save failed | Failure reason, retry, Save As recovery when overwrite fails. |
| macOS menu bar | File/Edit/View/Playback/Resource/Optimize/Window/Help structure with relevant enabled/disabled states. |
| Settings/logs/dark mode entry | Available from menu bar, not direct main-surface buttons. |

## App Architecture

The short-term app has two modes.

Preview mode is the default and should feel complete. It shows:

- one immersive canvas-first playback surface and playback controls
- right state-driven information area. The default state combines file facts,
  compact production-spec status, assets, and replaceable elements without
  returning to a boxed engineering inspector. Optimization detail/result
  replaces this surface when entered from a metric-level optimization action.
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
- Keep the macOS traffic-light controls as the minimum native window chrome.
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

## Canvas-first Chrome And Window Structure

Owner-confirmed short-term direction treats the window as one immersive canvas
surface, not as a toolbar-heavy engineering shell.

Required structure:

| Zone | Required content |
| --- | --- |
| Native chrome | macOS traffic-light controls as the minimum window chrome. |
| Launch center | Drag-in prompt, Open File action, and low-emphasis recent files inside the canvas. |
| Canvas top center | Preview/Edit mode switch. Do not restore the old Local Preview / Export Acceptance switcher. |
| Preview canvas | Opened SVGA artwork, playback controls, drag overlays, runtime replacement preview, and transient toast states. |
| Right information area | Default file/asset/replaceable information; replaced by optimization detail/result or comparison information when those states are active. |
| Right save area | Preview key-rename dirty state enables Save As; optimization result exposes Save As SVGA and Overwrite Save. |

Design notes:

- Preview must not show a visible Open Another File button. Open another file
  through the macOS menu or by dragging a file onto the canvas.
- General compare must not have a persistent visible main-surface entry. It is
  entered from the macOS menu or drag-decision overlay.
- Export acceptance must not appear in the short-term surface.
- Settings, logs, and dark/light mode must not appear as direct main-surface
  buttons in the short-term app.

## Suggested Menu Bar Architecture

The UI/UX owner may refine labels, but the design must cover the action groups.

| Menu | Short-term content |
| --- | --- |
| Auto SVGA | About, Settings, Services, Hide, Quit. |
| File | Open SVGA, Close File, Recent submenu with up to ten recent SVGA records and clear-history action, Save As when contextually enabled, Overwrite Save for optimization result output. |
| Edit | Standard text operations where applicable; Rename imageKey; cancel active rename/edit state. |
| View | Preview Mode, Edit Mode, Enter/Exit Compare, Appearance/Theme entry. If no file is open, Enter Compare starts a two-file selection flow. |
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
Preview default information, Replaceable Elements, Optimization Detail/Result,
General Compare, and Save Failed states.

## Component Requirements

The UI design should specify at least:

- window toolbar
- traffic-light integration
- file open button
- launch drop canvas
- recent files list and File > Recent submenu
- compare menu and drag-decision entry states
- mode switch
- playback controls
- preview canvas/stage
- right state-driven information area
- file fact rows
- compact production-spec status rows and optimization-context detail rows
- asset rows with thumbnail/name/dimensions/size
- sequence four-grid thumbnail
- audio empty state/music icon state
- replaceable image row
- replaceable text row
- context menu
- rename inline editor
- inline text replacement input
- metric-level optimization entry and finding row
- optimization result card
- before/after preview card
- Save As disabled/enabled/validating/success/failure states
- optimization Overwrite Save state
- toast or feedback pattern
- drag decision overlay and unsupported-format overlay
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
- keyboard path for open, play/pause, mode switching, context menu actions,
  rename confirm/cancel, inline text replacement, settings sheet actions, and
  save
- reduced motion
- reduced transparency or reduced blur when materials are used
- copyable metadata and error text
- no color-only status communication
- touchpad and mouse drag/drop states
- unsupported-file drop state with canvas toast
- disabled and unavailable states with understandable reasons

## Design Deliverables

The UI/UX owner should produce:

1. Information architecture and navigation model.
2. User flows for open/play/inspect, replaceable preview, imageKey rename,
   optimization, general compare from menu/drag-decision entry, and save
   failure recovery.
3. Full screen inventory covering every state listed in this brief.
4. High-fidelity macOS-style designs for the primary surfaces.
5. Component and state specifications.
6. Menu bar and shortcut specification.
7. Empty/error/loading copy examples.
8. Responsive/window-size recommendations with screenshots.
9. Accessibility checklist.
10. Requirement trace mapping from design surfaces to S1-S16 in
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

- final section label for Replaceable Elements inside the right information
  area, such as `可替换元素` or `编辑可替换元素`
- final default window size and minimum supported window size
- exact text input styling for runtime text replacement
- exact visual style of the compare menu and drag-decision entry states
- exact Settings sheet layout for Follow System / Light / Dark

## PM Decisions From 2026-07-02 UI/UX Sync

Recent files:

- Confirmed for the short-term formal product scope.
- Launch shows up to five recent SVGA records below the primary Open/Drag
  actions.
- `File > Recent` shows up to ten recent SVGA records and a clear-history
  action.
- Recent records must use real recent-file state in the formal release, but
  must not expose full local paths by default.
- Missing or inaccessible recent files must show recoverable feedback without
  stale file metadata.

Safe optimization batch action:

- Approved only as a batch action for safe deterministic optimizations that can
  produce bytes and pass round-trip validation without human review.
- Review-only, risky, unsupported, or visually ambiguous findings must stay out
  of the batch action.
- `一键优化` is allowed when nearby text clearly says the action applies only to
  safe executable items. More explicit labels such as `执行安全优化` or
  `生成安全优化副本` remain acceptable.
- Copy should distinguish `可安全执行`, `需复核`, and `暂不支持/建议项`.

## PM Decisions From 2026-07-04 Owner-confirmed Canvas Direction

Canvas-first direction:

- The short-term client uses a canvas-first, immersive, boundary-light,
  state-driven design language.
- Old Web Preview, historical Electron prototype, and Workbench v1 surfaces
  remain lineage only and must not become the visual baseline.
- Reduce heavy borders, cards, helper copy, status badges, and engineering
  panels; use hierarchy, spacing, color, state, and surface replacement to
  organize information.

Launch:

- Launch is one full-window canvas/drop surface.
- The center contains drag-in prompt and Open File.
- Recent files remain visually secondary inside the canvas and show at most
  five records.
- The launch recent trash icon clears all recent records.

Preview and dirty/save:

- Preview has no visible Open Another File button.
- Preview/Edit mode switching sits at the top center of the canvas.
- In Preview, only imageKey key rename creates dirty bytes.
- Dirty state appends `*` to the right-side filename and enables Save As.
- Save As success immediately removes `*`; Save As remains visible but disabled
  until the next dirty state.
- Runtime image replacement and inline runtime text editing stay in Preview and
  do not create dirty SVGA bytes.

Optimization:

- The top-right area is reserved for save actions, not an optimization summary.
- Optimization entries live under relevant file-information metrics such as
  file size and estimated memory.
- Clicking an optimization entry replaces the right information area with
  optimization detail or result context.
- Default Preview shows production-spec status only; target thresholds appear
  in optimization detail/result context.
- Optimization result comparison provides Save As SVGA, Overwrite Save, and
  Abandon Optimization. Successful overwrite returns to Preview.

Compare and drag/drop:

- General compare has no persistent main-surface entry.
- Compare is entered from the macOS menu or from drag-decision overlays.
- If no file is open, the menu command enters a two-file selection flow.
- Compare empty state keeps bottom playback controls visible but disabled.
- Loaded compare shows two canvases and one right comparison panel focused on
  differences.
- Drag overlays use a semi-transparent black base. Supported focus regions are
  green; unsupported focus regions are red and show `不支持的文件格式`.
- Dropping an unsupported file clears the canvas and shows a centered canvas
  toast with `不支持的文件格式`.

Edit, window, and settings:

- Short-term Edit may show the left layer list only.
- The right operation panel remains a quiet placeholder with no inactive
  advanced controls.
- The right information area responds until the minimum no-wrap readable width;
  after that it stops compressing. It does not collapse or use horizontal
  scrolling.
- Light and dark appearances are required.
- Settings entry lives in the macOS menu and opens a Settings sheet for
  Follow System, Light, and Dark only unless the Product Owner confirms more.

Reference sketches:

- Owner provided local reference sketches on the desktop for Launch, Preview,
  dirty Preview, drag compare, unsupported drag, Edit, compare empty/loaded,
  compare drag, and optimization comparison.
- These images are reference inputs only and should not be committed unless the
  Product Owner explicitly asks for them.
