# Review: short-term-uiux-prototype-screenshot-audit

Date: 2026-07-03
Owner role: UI/UX
Status: UI/UX screenshot audit, not a PRD update

## Summary

This audit reviews the current short-term desktop client as a functional
prototype. The prototype covers many S1-S16 flows, but the screenshots show
that the owner-visible UI is still an engineering shell rather than a
macOS-first product interface.

The largest issues are not only structural and not only visual. Both matter
equally. The app currently looks unfinished and visually under-designed, while
also having unresolved shell, state, and workflow problems: window chrome
strategy is unresolved, launch and workbench states share the same heavy
toolbar, Preview/Edit/Compare/Failure states leak stale context, and the
current visual system is not yet traceable from token to component to page
state.

No source code or product-scope document was changed for this audit.

## Authority And Inputs

- Main PRD authority: `docs/product/PRODUCT_ROADMAP.md`
- UI/UX brief: `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- Execution plan: `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- Design system spec: `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- Design manifest: `DESIGN.md`

Relevant authority points:

- The final short-term app must not expose missing features, inactive controls,
  or out-of-scope placeholders.
- Launch should be a primary central canvas/drop target with Open/Drag actions;
  recent rows are secondary.
- Preview mode should be center canvas plus right panel only.
- Edit mode is reserved and must not look broken or expose inactive advanced
  controls.
- Load failed must not show stale file data.
- Runtime-only previews and persisted byte-output actions must be visually
  distinct.
- Every UI slice should remain traceable through tokens, components, modules,
  page states, and evidence.

## Screenshot Corpus

Temporary local screenshot set:
`/tmp/auto-svga-desktop-flow-20260703-085831`

States captured:

- `01-launch.png`
- `02-preview-overview.png`
- `03-preview-optimization.png`
- `04-preview-replaceable-empty.png`
- `05-compare-empty-b.png`
- `06-compare-with-b.png`
- `07-edit-reserved.png`
- `08-file-menu-fullscreen.png`
- `09-replaceable-populated.png`
- `10-runtime-text-dialog.png`
- `11-runtime-text-applied.png`
- `12-resource-context-menu.png`
- `13-inline-rename-editing.png`
- `14-rename-dirty-save-enabled.png`
- `15-discard-unsaved-output-dialog.png`
- `16-replacement-failed-after-rename.png`
- `17-replacement-dirty-save-enabled.png`
- `18-replacement-reset.png`
- `19-load-failed-invalid-svga.png`

Contact sheets generated for analysis:

- `contact-flow-core.png`
- `contact-replace-edit.png`

## Findings

### Audit Area: Window Chrome And Native Shell

1. **Duplicate traffic lights break the macOS illusion.**
   The real macOS titlebar already has traffic-light controls, while the page
   renders another fake set inside the toolbar. This creates two window-control
   rows and immediately reads as Electron/web chrome.

2. **Menu bar app identity is still `Electron`.**
   The visible system menu shows `Electron`, not `Auto SVGA`. This is a core
   product-shell defect, not a cosmetic detail.

3. **Toolbar is not actually integrated into the native titlebar row.**
   The PRD/brief expects macOS controls and app actions to share one integrated
   toolbar/titlebar row. The screenshots show system titlebar first, then an
   app-drawn toolbar below it.

4. **Window shell and content shell compete for hierarchy.**
   The app title, file identity, mode switch, save controls, fake traffic
   lights, and system titlebar all occupy the top region. The top 80-90px of
   the window is visually overloaded before the user reaches the task.

### Audit Area: State Model And Stale Context

5. **Load failed shows stale file identity.**
   `19-load-failed-invalid-svga.png` shows an error for an invalid file, but
   the toolbar still displays the previous file name
   `replaceable-workflow-smoke.svga`. This conflicts with the requirement that
   failed states have no stale file data.

6. **Load failed preserves stale mode state.**
   The invalid-file screen still shows Preview/Edit controls with Edit selected.
   A user could believe the failed file is loaded in Edit mode.

7. **Launch exposes loaded-file controls before a file exists.**
   `01-launch.png` shows Compare, Preview/Edit, Overwrite Save, and Save As.
   These are disabled or irrelevant before a file is opened and weaken the
   launch flow.

8. **Compare mode and Edit mode can visually overlap.**
   After using compare, switching Edit still relies on the same top-level
   controls and does not communicate a clean mode reset. The user sees one
   continuous shell rather than explicit state transitions.

9. **Output dirty state is global but visually under-explained.**
   Rename, replacement, and optimization/save flows all use the same top-right
   Save pair and thin banner. The UI does not make clear which operation
   produced the current output, what will be saved, or whether runtime-only
   text is excluded.

10. **Runtime-only text and persisted imageKey/image replacement share one
    workspace without enough separation.**
    `11-runtime-text-applied.png` overlays text but keeps Save disabled, while
    `14` and `17` enable Save. The behavior is correct, but the distinction is
    easy to miss.

### Audit Area: Launch Experience

11. **Launch is not one focused canvas area.**
    The central drop canvas is visually a card inside a full workbench shell.
    The user asked for the launch page to be only the canvas area filling the
    window; the current shell still feels like a disabled workbench.

12. **Recent rows compete with the primary Open action.**
    The recent list sits inside the same high-contrast patterned canvas as the
    primary drop target. Its typography and horizontal rules make it feel too
    close to the primary action layer.

13. **The launch canvas pattern is too active for an empty state.**
    The triangle pattern creates unnecessary visual density behind a simple
    first-run task.

14. **Recent rows do not communicate missing/unavailable recovery in-place.**
    The PRD requires missing or inaccessible recent files to fail gracefully.
    The current visual model has no visible row-level unavailable state,
    warning, or recovery affordance in launch.

### Audit Area: Preview Canvas And Playback

15. **Canvas background competes with the asset.**
    The triangle texture is strong in every state, including bright, transparent,
    and glow-heavy assets. It makes visual inspection harder.

16. **Canvas does not expose inspection background options.**
    For SVGA asset review, users need to judge alpha edges and glow on dark,
    light, checkerboard, or transparent backgrounds. The current preview only
    shows one patterned background.

17. **Playback controls are too primitive for a production preview tool.**
    `Pause` and `Replay` are present, but there is no timeline, progress,
    frame/time readout beyond static metadata, loop state, playback failure
    state, or keyboard focus model visible in the UI.

18. **Metadata is disconnected from playback.**
    `300 x 300 / 24 / 3000 ms` is placed in the lower-right of the canvas, but
    it is not grouped with playback state, FPS warning, duration, or production
    spec comparison.

19. **The preview stage uses the same visual treatment in all workflows.**
    Overview, optimization, replaceable, text preview, replacement, and failure
    recovery all use the same stage. The stage does not communicate the current
    task mode.

### Audit Area: Overview And Inspector IA

20. **Overview facts look like raw dashboard tiles.**
    File size, memory, canvas, FPS, and resource count are technically present,
    but the visual hierarchy does not lead with acceptance meaning.

21. **Pass/warning/fail states are buried in small secondary text.**
    Production-spec status such as `通过` and `注意` is not visually scannable.
    A reviewer should be able to see acceptance risk without reading each line.

22. **Resource rows are visually heavier than their decision value.**
    Asset rows use card borders and thumbnail frames, but the key decision
    fields are small. The UI emphasizes containers more than content.

23. **Audio empty state is too similar to real asset rows.**
    `当前文件暂无音频资产` is truthful, but it appears as another asset row.
    Empty/non-applicable states should be quieter.

24. **Overview does not summarize file acceptance.**
    There is no top-level "ready / needs review / failed" summary derived from
    facts, optimization findings, and unsupported states.

### Audit Area: Optimization Flow

25. **Optimization tab is a recommendation list, not an action flow.**
    `03-preview-optimization.png` shows "0 safe, 26 review" and a disabled
    action. It does not guide the user toward what can be done now.

26. **Review-only findings lack severity and ownership.**
    Findings say `需复核`, but the UI does not distinguish designer action,
    integrator action, app-later action, or PM-deferred action.

27. **Estimated impact is missing from visible findings.**
    The PRD asks for brief reasons and estimated impact. The screenshot shows
    reasons but no visible effect estimate.

28. **Optimization comparison is not represented in the captured real flow.**
    The current fixture did not expose an enabled optimization path. The UI
    still needs a designed S10 before/after result state, separate from general
    compare.

### Audit Area: Replaceable Elements

29. **Replaceable rows hide their primary action behind context menus.**
    For designer/reviewer workflows, Replace/Edit/Reset should be discoverable
    from the row or a clearly native action affordance. The current row mainly
    shows a key and a badge.

30. **Right-click menu visually reads like a web popover.**
    `12-resource-context-menu.png` appears as a small dark custom menu inside
    the web content. It does not feel like a macOS contextual menu.

31. **Replaceable and runtime text groups lack display numbering.**
    The low-fidelity IA expects numbered/sorted groups for display. The current
    visible UI has grouped sections but no clear item numbering.

32. **Empty replaceable state over-explains without giving preparation clues.**
    `04-preview-replaceable-empty.png` says no designer-named keys were found,
    but does not give a concise next step such as "export with named imageKey".

33. **Replacement fit/crop risk is under-designed.**
    Replacing `56 x 56` with `80 x 80` succeeds and updates the row, but the UI
    does not explain scale/fit/crop behavior or visual layout risk.

34. **Replacement failure after rename suggests a workflow-state bug.**
    `16-replacement-failed-after-rename.png` says the selected image resource
    does not exist after a valid rename. Even if technically caused by source
    mapping, the user sees a broken workflow chain.

### Audit Area: Rename Flow

35. **Inline rename is cramped.**
    `13-inline-rename-editing.png` places label, input, helper text, confirm,
    and cancel inside a narrow row. The row becomes visually noisy and hard to
    scan.

36. **Rename lacks validation guidance before confirmation.**
    The UI does not show allowed characters, collision status, or reference
    update impact before confirming.

37. **Rename success banner is too dense and too low contrast.**
    `14-rename-dirty-save-enabled.png` contains useful information, but the
    banner is visually compressed into a single line.

38. **The saved-output identity is ambiguous.**
    After rename, the toolbar still shows the source file name. The user needs
    to know they are viewing an unsaved output derived from that source.

### Audit Area: Runtime Text

39. **Runtime text dialog is not a macOS sheet.**
    `10-runtime-text-dialog.png` is a centered in-content modal. The brief asks
    for modal sheets or restrained dialogs; this is functional but not native.

40. **Text dialog only exposes text, not supported style fields.**
    The PRD allows supported dynamic text fields such as family, size, color,
    and offset subject to support. If these are intentionally excluded for the
    current build, the UI should state that boundary explicitly.

41. **Applied runtime text is visually disconnected from the source text row.**
    `11-runtime-text-applied.png` overlays `Codex VIP`, while the row still
    shows `SVGA VIP`. The note says preview applied, but the current/applied
    value should be easier to compare.

42. **Text reset state lacks a clear before/after expectation.**
    The reset button appears only after apply, but the UI does not preview what
    reset will restore.

### Audit Area: Save And Dirty States

43. **Save buttons are too far from the dirty explanation.**
    Dirty banners appear under the toolbar, while Save controls sit top-right.
    The relationship is visible but weak.

44. **Overwrite Save and Save As have equal visual weight after dirty output.**
    In internal testing, Save As is often safer than overwrite. The UI should
    decide whether both are equal or whether one is recommended.

45. **Discard dialog copy is technically accurate but lacks concrete loss
    description.**
    `15-discard-unsaved-output-dialog.png` says an unsaved SVGA output will be
    discarded. It does not name which output, e.g. renamed imageKey or replaced
    image output.

46. **Save validating and save failed states were not visible in the manual
    walkthrough.**
    The UI needs owner-visible states for validating, complete, and failed
    saves, not only enabled save buttons and error reports.

### Audit Area: Compare Mode

47. **General compare lacks equal information depth for A and B in empty state.**
    In `05-compare-empty-b.png`, A info is full, B is mostly an empty card. The
    flow is understandable, but visual balance feels placeholder-like.

48. **Loaded compare lacks comparison conclusions.**
    `06-compare-with-b.png` shows A and B values, but no differences are
    highlighted. Users must manually compare file size, memory, canvas, FPS,
    and resource count.

49. **A/B previews do not show synchronized playback affordance.**
    Compare mode should make sync/playback relationship obvious. Current UI
    only displays two static preview areas.

50. **Compare mode still keeps global Preview/Edit switch visible.**
    This adds ambiguity: compare is a distinct state, but the top segmented
    control still suggests Preview/Edit is the primary axis.

### Audit Area: Edit Reserved

51. **Edit mode still looks like an unfinished editor.**
    `07-edit-reserved.png` shows a left layer list, center canvas, and a large
    empty right panel. The text says reserved, but the surrounding UI still
    invites users to expect editing operations.

52. **Layer list exposes implementation-like categories.**
    Labels such as `图层资源` and `序列组` are serviceable, but not yet refined
    for a reserved short-term surface.

53. **The right reserved panel is too visually dominant.**
    A large empty card occupies prime space. It should be quiet enough to avoid
    making the app feel incomplete.

### Audit Area: Visual System, Aesthetic Quality, And Tokenization

54. **The UI is still one-note dark gray.**
    The design manifest asks for precise, calm, native, trustworthy. The
    current palette reads as generic dark web dashboard. It lacks system
    material nuance and semantic status contrast.

55. **Borders and cards are overused.**
    Almost every region is framed. The app feels boxed-in and noisy instead of
    using native split-view hierarchy.

56. **Component variants are visually inconsistent.**
    Toolbar buttons, large open buttons, row badges, tabs, banners, context
    menu items, and dialog buttons do not yet feel like a single component
    family.

57. **Focus and hover states are too visually loud in screenshots.**
    Several screenshots show cursor/focus glow that looks like a web hover
    effect, not macOS focus behavior.

58. **Text density is not tuned by role.**
    Titles, labels, values, explanations, helper text, and warnings often share
    similar size/weight/contrast, making scanning harder than necessary.

59. **The system does not yet prove token-to-component traceability.**
    The CSS uses `--asv-*` variables, but screenshots show repeated one-off
    visual decisions rather than a mature token/component hierarchy.

60. **No light-mode evidence was captured.**
    Current screenshots are dark. Because `DESIGN.md` declares light/dark modes,
    high-fidelity redesign needs both mode surfaces before implementation can
    be considered system-complete.

## Recommended Redesign Order

This order is about dependencies and execution risk, not importance. Visual
quality, native feel, interaction structure, information architecture, and
design-system traceability are all first-class redesign goals and should move
together.

1. **App shell first**
   Resolve native titlebar/traffic-light strategy, app menu identity, toolbar
   zones, and launch-vs-workbench chrome.

2. **State model cleanup**
   Rework Launch, Loading, Load failed, Preview ready, Compare, Edit reserved,
   Dirty, Save validating, Save complete, and Save failed as explicit page
   states with no stale file or stale mode leakage.

3. **Preview canvas redesign**
   Define canvas background tokens, background modes, playback controls,
   metadata placement, abnormal playback feedback, and compare synchronization
   affordances.

4. **Inspector IA redesign**
   Redesign Overview facts, spec comparison, asset groups, audio empty, and
   replaceable groups around scan-first status and clear action ownership.

5. **Editing and save surfaces**
   Redesign context menu, inline rename, replacement flow, runtime text sheet,
   discard confirmations, and dirty/save banners as one coherent output-state
   system.

6. **Design-system hardening**
   Convert the redesign into token/component/module/page-state contracts before
   code implementation. Use the current screenshots as regression examples.

## Implementation Guardrails For The Next UI Slice

- Do not start with color polish only.
- Do not keep fake traffic lights unless the Electron window is changed to a
  matching custom-titlebar strategy.
- Do not expose Preview/Edit/save controls on launch unless the design defines
  why they are available.
- Do not allow Load failed to show stale file identity or stale selected mode.
- Do not make replacement, rename, text preview, and optimization share the
  same dirty banner copy.
- Do not treat runtime-only text preview as persisted output.
- Do not add new product scope while fixing UI.
- Do not modify the main PRD from the UI lane; send product-scope changes back
  to PM/Owner for review.

## Suggested Next Work Package

Start with a narrow UI shell/state package:

- `WindowToolbar` and native chrome strategy
- `LaunchModule`
- `ErrorRecoveryPanel`
- `SaveFeedbackBanner`
- state cleanup for file identity and mode visibility

This package would address the largest native-feel and stale-state problems
without touching parser, optimizer, save bytes, or product scope.

## Git State At Audit Time

The worktree already had unrelated product/implementation changes before this
audit. This document intentionally avoids those files.
