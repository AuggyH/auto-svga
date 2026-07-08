# Auto SVGA Product Roadmap

Date: 2026-06-30
Current mainline: short-term macOS client at
`/Users/huangtengxin/Applications/Auto SVGA.app` is the owner-visible
development, QA, and version-progression baseline.
Historical reset: P5/P6/P6-R1 Workbench evidence remains lineage and rollback
context, but it is not the current product surface or QA target unless the
Product Owner explicitly requests it.
Owner correction: On 2026-07-01, the short-term formal app scope was corrected
to the SVGA preview, inspection, replaceable-element preview, imageKey rename,
recent-file reopening, and optimization workflow below. This corrected scope
supersedes earlier Workbench v1 feature planning.

Owner correction: On 2026-07-03, the AE to Auto SVGA production bridge was
promoted from long-term candidate to committed product mainline. This bridge
serves human designers and the current team production workflow. It has higher
delivery priority than ComfyUI, external AI, multimodal generation, or
agent-driven automatic design. It may schedule ahead of parts of the mid-term
template-editing line, but it does not cancel or roll back already-started
mid-term foundation work.

Owner correction: On 2026-07-04, the short-term client UI/UX direction was
reset to the Owner-confirmed canvas-first design language. This correction does
not add new short-term feature categories, but it changes the required
interaction model: the window is treated as an immersive canvas, Preview/Edit
switching sits at the top center of the canvas, comparison is entered from the
macOS menu or drag-decision flow rather than a persistent main-surface button,
default Preview shows production-spec status without target thresholds, and
dirty/save behavior is context-specific as described below.

PM clarification: On 2026-07-08, QA ticket `ASV-QA-20260708-003` clarified the
short-term text replacement boundary. Designer-named raster/imageKey
placeholders with text semantics, such as `text1`, `text2`, `from`, and `to`,
are in scope for S13 runtime text preview. They must be classified as text
replacement targets by deterministic name rules, not by OCR or visual AI, and
must not be duplicated as ordinary image replacement rows.

Owner correction: On 2026-07-08, the short-term drag-decision overlay was
changed from left/right split to unequal top/bottom split. Dragging from the
macOS Dock/Desktop folder commonly enters from the bottom and lands near the
lower-center of the window, so left/right split makes the user more likely to
miss the decision affordance and accidentally enter comparison. The primary
Open File target must occupy about 70%-80% of the canvas, and Add As Compare
File must remain a smaller secondary target. The exact hit-test contract is:
Add As Compare File is the top secondary strip, defaulting to 25% of canvas
height and allowed to vary between 20%-30%; Open File is the lower primary
zone, defaulting to 75% of canvas height and allowed to vary between 70%-80%.
The split line defaults to 25% from the top. The canvas center, lower-center,
and bottom-entry casual drop path must resolve to Open File. Compare is an
opt-in target that requires deliberately moving into the top secondary strip.

Owner correction: On 2026-07-08, the active owner-visible development and QA
baseline was clarified as the short-term macOS client installed at
`/Users/huangtengxin/Applications/Auto SVGA.app` (`~/Applications/Auto SVGA.app`).
Historical Workbench v1 screens, Web Preview pages, frozen parity artifacts,
development Electron windows, and generated `.artifacts` packages are lineage
or supplemental narrowing evidence only; they are not current-stage product
standards, QA baselines, or requirement targets unless the Product Owner
explicitly names them. Current short-term development is macOS-client first.
Windows and standalone Web Preview are not short-term acceptance or QA targets
unless explicitly requested. If the installed owner-used app contains behavior
that is not represented in source, product docs, review notes, or promotion
metadata, treat it as baseline drift and reconcile it before replacing the app.

Product documentation system:
`docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md` defines the PM responsibility
model, source hierarchy, status vocabulary, product brief checklist, and
maintenance cadence for keeping this roadmap aligned with active development.

UI/UX design input:
`docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md` provides the subordinate
macOS-first design brief for the corrected short-term version. It must not
redefine product scope from this roadmap.

UI/UX execution plan:
`docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md` provides the
subordinate design-system and implementation-trace plan for executing the
short-term UI/UX redesign. It must not redefine product scope from this
roadmap.

AE production bridge planning input:
`docs/product/AE_BRIDGE_PRODUCT_BRIEF.md` provides the subordinate product brief
for the Owner-confirmed AE to Auto SVGA production bridge. It must not redefine
scope from this roadmap, but it may add workflow detail, compatibility matrix
requirements, technical lanes, and validation gates.

This file is also the active high-level PRD for short-term, AE production
bridge, mid-term, and long-term product planning. Related implementation plans
remain in their phase-specific documents; this roadmap owns the cross-phase
product intent,
required capabilities, interaction expectations, acceptance boundaries, and
non-goals.

## Owner Correction: Short-term Scope

Date: 2026-07-01

The short-term version below fully supersedes the earlier Workbench v1 feature
planning. Historical P6/P6-R1 evidence and implementation work remain useful
engineering lineage, but the formal short-term product surface must match this
section. The final app must not expose missing features, inactive controls, or
out-of-scope placeholders.

Motion Asset Audit is treated as the file-size and memory-usage optimization
diagnostic surface. Sequence-frame repair is deferred to the mid-term version.
Export acceptance is hidden for the short-term version. Settings, logs, and
dark-mode controls are not product-surface buttons; their entry points move to
the macOS menu bar.

## Short-term Version: SVGA Preview, Inspection, Replacement, And Optimization

Goal: ship a macOS-first SVGA app that opens local SVGA files, previews
playback, exposes file and asset information, supports designer-intended
replaceable-element preview, supports imageKey rename, and produces optimized
SVGA output through explicit Overwrite Save or Save As actions. The short-term
app also remembers recent SVGA files as a formal convenience workflow, with
path-redacted display and user-controlled clearing.

Current QA and owner-visible version progression for this short-term scope
starts from the owner-used local stable app at
`/Users/huangtengxin/Applications/Auto SVGA.app`. Development builds, Web
Preview, and historical Workbench v1 may help isolate a problem, but they do
not replace this baseline for Product Owner daily-use reports or promotion
decisions.

### Required Capabilities

| ID | Requirement | Product detail |
| --- | --- | --- |
| S1 | Open SVGA locally | Launch opens from the central Open action, drag into the canvas, or macOS menu entry. In Preview, there is no visible `Open Another File` button; opening another file uses the macOS menu or drag-and-drop onto the canvas. |
| S2 | Play SVGA and report abnormal states | Playback failures, parse failures, loading failures, and invalid files must show clear feedback. |
| S3 | Show basic file information | File size, estimated decoded image memory, runtime structure risk, canvas size, FPS, and asset count. Decoded image memory and runtime structure risk must be separate so a file with small images but thousands of timeline objects is not presented as low-risk. |
| S4 | Show production-spec status inside file information | Default Preview shows compact production-spec status inside file information without exposing target thresholds. Detailed current-vs-requirement values appear only in optimization detail/result context or another explicit detail state; do not create a separate production-spec module. |
| S5 | Show all asset information | Images, sequence/video-like frame assets, audio group, and replaceable elements. Display thumbnail, file/key name, image dimensions when available, audio duration when available, and file size. |
| S6 | Show image thumbnails | Images show their image thumbnail. Sequence/frame groups show the existing four-grid thumbnail from the first four frames. Audio uses a fixed music icon when audio parsing is later supported. |
| S7 | Identify replaceable elements by naming rule | In the short term, exclude automatic names such as `img_000` / `img_001`; non-automatic designer names are treated as replaceable imageKeys, then split into image or text replacement groups by deterministic key semantics. Text-like keys such as `text1`, `text2`, `from`, and `to` are text replacement targets, not image replacement rows. Future versions may add configurable whitelist/blacklist regular expressions. |
| S8 | Detect optimization opportunities | Detect file-size, decoded-memory, and runtime-structure optimization opportunities, briefly explain each item, and estimate impact. Optimization entry points live inside the relevant file-information metrics, such as file size, memory estimate, and runtime structure risk, not as a persistent top-right summary button. |
| S9 | Run real optimization | Produce optimized SVGA bytes, not a report-only recommendation. Allowed methods include image compression with quality controls, removing unreferenced resources, transparent-bound trimming, sequence-frame processing, FPS adjustment, canvas adjustment when production specs remain satisfied, all-zero sprite/frame pruning, target-player low-alpha pruning when validated, and sequence-fanout reduction when before/after playback comparison passes. |
| S10 | Enter optimization comparison flow | Clicking a metric-level optimization entry replaces the current right information surface with optimization detail or result comparison. Optimization result comparison shows before/after previews plus concrete optimization items and exposes `另存为 SVGA`, `覆盖保存`, and `放弃优化`; successful overwrite returns to Preview. |
| S11 | Rename imageKey | From the asset panel, selecting an image and using the context menu Rename or `Cmd+R` enters key rename mode. Enter confirms. All related references must update and the app must produce updated SVGA bytes. In Preview, changing the key value is the only replaceable-element operation that creates dirty state. |
| S12 | Preview replaceable images | In Preview mode, replaceable image elements can be replaced and reset with realtime playback preview. This does not switch to Edit mode. |
| S13 | Preview replaceable text | In Preview mode, replaceable text values are editable inline through text inputs and apply as runtime dynamic text preview against the target imageKey. Text targets include official runtime dynamic text metadata when available and designer-named raster/imageKey placeholders with text semantics, such as `text1`, `text2`, `from`, and `to`. Editing text content simulates terminal playback behavior and does not create dirty SVGA bytes. The key value itself is changed through the key edit action and follows S11 dirty behavior. |
| S14 | Save edited output | Save behavior is context-specific. Preview imageKey key rename dirty state appends `*` to the filename and enables Save As; after Save As succeeds, `*` disappears and Save As remains visible but disabled. Optimization result output exposes both Save As SVGA and Overwrite Save, plus Abandon Optimization. All save paths require output validation. |
| S15 | Keep audio deferred | Audio parsing and duration are not required for the short-term version. If no audio is detected or audio parsing is not implemented, the audio group shows `当前文件暂无音频资产`. |
| S16 | Show recent SVGA files | The launch page shows up to five low-emphasis recent SVGA records inside the canvas below Open/Drag actions, with a trash icon that clears all recent records. `File > Recent` shows up to ten records plus a clear-history action. Recent records must open the same local-file flow, hide full local paths by default, and fail gracefully when a file is missing or inaccessible. |
| S17 | Detect runtime structure complexity | Inspect sprite count, FrameEntity count, alpha-positive frame count, target-player-visible frame count when a threshold profile exists, invisible/low-alpha ratios, sequence-frame fanout, per-frame visible sprite peak/average, and estimated runtime structure memory. This is a required production performance diagnostic because real production SVGA files can have small image memory but high mobile runtime memory. |
| S18 | Optimize runtime structure complexity | Provide output-producing optimization for supported runtime-structure problems. Safe items include all-zero sprite removal and newly unreferenced image cleanup. Review-required items include target-player alpha-threshold pruning, FPS resampling, sequence-fanout pruning, and sequence-fanout rebake/collapse. The app must show before/after structure metrics, file size, decoded memory, runtime risk, and playback comparison before Save As or Overwrite Save. |

### Short-term Acceptance Matrix

Each short-term requirement must have owner-visible behavior and current-head
evidence before the first distributable version can be called release-candidate
ready.

| ID | Accept when | Required evidence |
| --- | --- | --- |
| S1 | Launch Open, canvas drag-and-drop, and macOS menu opening all load the same local SVGA bytes without exposing arbitrary renderer filesystem access. Preview has no visible Open Another File button. Launch may show a subtle checkerboard idle background motion, but it must remain background-only and stop under reduced motion. | Open-flow proof, drag/drop proof, menu-entry proof, preview-surface no-open-button proof, drag-decision top/bottom primary Open zone proof, secondary Add Compare zone proof, launch idle-motion proof, reduced-motion fallback proof, path-redaction check. |
| S2 | Invalid files, parse failures, loading failures, and playback failures show a visible user message and recover when a valid file is opened. | Invalid-file proof, recovery proof, player lifecycle cleanup proof. |
| S3 | Preview information shows file size, estimated decoded image memory, runtime structure risk, canvas, FPS, and asset count for a parsed SVGA. | Inspection report and rendered right-information proof with decoded-memory and runtime-structure fields separated. |
| S4 | Default Preview shows production-spec status inline without target thresholds; detailed actual/limit pairs appear only in optimization detail/result context or another explicit detail state. | Default status-only proof, optimization-detail actual/limit proof, current spec profile id. |
| S5 | Asset information covers image resources, sequence/frame groups, audio group state, and replaceable elements without duplicating every image under replaceable elements. | Asset-list proof with resource counts and grouping. |
| S6 | Image thumbnails, four-frame sequence thumbnails, and audio empty/icon states render without layout shift. | Rendered thumbnail proof for image, sequence, and no-audio states. |
| S7 | Replaceable elements are designer-named imageKeys after short-term automatic-name exclusion, and text-semantic keys are split into the text group instead of the image group. | Replaceable-key classification report with included image, included text, and excluded automatic-name examples. |
| S8 | File-size and memory rows expose metric-level optimization entries with brief reason and estimated impact; risky items are labelled as review-only. No top-right `2 项可优化` style summary button is shown. | Optimization-candidate report, metric-entry UI proof, no-summary-button proof. |
| S9 | Running an enabled optimization produces new SVGA bytes and a report binding before/after metrics, changed items, safety checks, and output hash. | Optimized output, optimization report, inflate/decode proof, reopen proof. |
| S10 | Optimization action replaces the right information surface with detail/result context; result comparison exposes Save As SVGA, Overwrite Save, and Abandon Optimization. Successful overwrite returns to Preview. | Before/after comparison proof, result-action proof, overwrite-return proof, dirty/save-state proof. |
| S11 | imageKey rename updates every related `imageKey` and `matteKey` reference, leaves no dangling reference, and produces updated SVGA bytes. | Rename report, reference-closure proof, round-trip decode proof, reopen proof. |
| S12 | Replaceable image preview can replace and reset one designer-named imageKey in Preview mode without switching to Edit mode. | Runtime replacement proof, reset proof, mode-state proof. |
| S13 | Replaceable text preview applies supported runtime dynamic text fields through inline inputs and reset in Preview mode without persisting text into SVGA bytes. Text-semantic raster imageKeys such as `text1` / `text2` are supported text targets when detected by name rule. | Runtime text input proof, text-like imageKey classification proof, reset proof, byte-immutability proof, unsupported-fallback proof. |
| S14 | Preview imageKey key rename dirty state shows filename `*` and enables Save As only; Save As success clears `*` and leaves Save As visible but disabled. Optimization result output separately supports Save As SVGA and Overwrite Save. | Preview dirty-star proof, Save As clean-state proof, optimization overwrite proof, reopen validation proof. |
| S15 | Audio group does not block release; no-audio and unsupported-audio states are visible and truthful. | Audio-empty-state proof and known-limitation entry. |
| S16 | Launch recent rows and `File > Recent` use real recent-file state, preserve Open/Drag as higher-priority actions, avoid full-path exposure by default, clear all history from the launch trash icon or menu action, and recover gracefully from missing files. | Recent-state persistence proof, launch five-row proof, menu ten-row proof, path-redaction proof, launch-trash clear proof, menu clear-history proof, missing-file recovery proof. |
| S17 | SVGA files with small decoded image memory but high sprite/FrameEntity counts are flagged as runtime-structure risk and explain why mobile memory may be high. | Real or synthetic high-fanout SVGA report, sprite/FrameEntity counts, visible-frame density, estimated runtime-structure memory, and UI proof. |
| S18 | Supported runtime-structure optimizations produce validated SVGA bytes and show before/after structure metrics and playback comparison. Risky or target-player-specific items stay review-only until validated. | Optimized output, before/after structure report, inflate/decode proof, reopen proof, playback comparison proof, target-player threshold note when applicable. |

### Replaceable Element Definition

SVGA runtime replacement is keyed by `imageKey`. Official SVGA player
documentation describes dynamic image and text replacement as operations on a
designer-provided `ImageKey`; the iOS/Android docs describe the imageKey as
coming from the exported PNG filename. For product language, Auto SVGA calls
only designer-intended, manually named keys "replaceable elements"; automatic
export keys such as `img_000` remain ordinary image assets so the replaceable
elements section does not repeat every image.

Runtime replacement constraints:

- Image replacement is addressed by imageKey. Short-term replacement images
  should match the original resource dimensions unless the app can show a
  clear fit/crop warning and preserve playback layout.
- Dynamic text replacement is also addressed by imageKey. It does not require a
  separate text-metadata table when the designer intentionally named a raster
  placeholder with text semantics. Short-term text-target detection accepts:
  explicit runtime dynamic text metadata when present, or a non-automatic
  designer key whose normalized name matches text semantics such as `text`,
  `txt`, `title`, `name`, `nickname`, `from`, `to`, `sender`, `receiver`,
  `content`, `copy`, `label`, `desc`, `message`, and simple numeric suffixes
  such as `text1` / `text2`.
- Text-target detection must be deterministic. Do not use OCR, visual
  recognition, external AI, or guess from artwork content. Ambiguous
  non-automatic keys remain image replacement targets until a future
  configurable whitelist/blacklist rule promotes them.
- Dynamic text replacement is runtime preview only in the short term. Supported
  fields are limited to the official player-supported dynamic text fields such
  as text, family, size, color, and offset.
- Editing runtime text fields must not create dirty SVGA bytes. Reset clears
  the runtime dynamic object and restores the original raster placeholder. If
  the current player cannot apply dynamic text to a detected text target, the
  app must show an explicit unsupported text-preview fallback instead of
  showing image replacement actions for that row.
- If the SVGA runtime requires dynamic objects before playback starts, the app
  may remount or restart the preview after applying the replacement.
- Reset must clear runtime dynamic objects or remount original bytes; it must
  not leave stale replacement state in the next playback.
- Persisting text replacement into SVGA bytes is out of scope for the
  short-term version.
- Reference sources: official SVGA GitHub organization
  (`https://github.com/svga`), SVGAPlayer-Web documentation
  (`https://github.com/svga/SVGAPlayer-Web`), and the SVGAPlayer-Web Chinese
  README (`https://github.com/svga/SVGAPlayer-Web/blob/master/README.zh.md`).

### App Modes

The app has two user-visible modes:

| Mode | Layout | Purpose |
| --- | --- | --- |
| Preview mode | Canvas-first preview surface + state-driven right information area | Default mode. Open from Launch/menu/drag, play, inspect, optimize, compare through menu/drag-decision flow, and preview replaceable elements. |
| Edit mode | Left layer panel + center canvas + right operation panel | Reserved for mid-term and long-term advanced editing. Short-term right panel stays empty and must not expose inactive controls. |

Mode switching lives at the top center of the canvas. Triggering lightweight
replacement actions in Preview mode does not switch to Edit mode.

### Launch Page

Initial app launch shows a startup page rather than the full main interface.
The startup page is one full-window canvas/drop surface with central drag-in
prompt and Open action. It also prepares for future multi-format routing and
gives the main app surface time to load without appearing blocked.

The launch canvas may include a subtle, slow checkerboard background idle
motion. This motion is part of the canvas atmosphere only: it must not add
visible controls or copy, must not compete with the drag-in prompt, Open action,
or recent-file list, and must be disabled when the user or system requests
reduced motion. Drag-hover, invalid-format, loading, and error states take
visual priority over the idle background.

Recently opened files are part of the short-term formal product scope. The
launch page shows up to five recent SVGA files below the primary Open and Drag
In actions. Recent rows must stay visually secondary, must not expose full
local paths by default, and must use the same loading, validation, error, and
recovery flow as files opened from the file chooser or drag-and-drop.

The launch recent-file trash icon clears all recent records. The macOS File
menu includes a `Recent` submenu with up to ten recent SVGA files and a
clear-history action. Clearing recent history removes records from the launch
page and menu without touching source files.

### Main Layout

The main app uses a left / center / right structure, but each mode controls
which regions are visible.

Preview mode:

- center: playback canvas and playback controls
- right: a state-driven information surface, not a heavy inspector panel
  - default Preview information: basic file information, compact
    production-spec status, asset information, and replaceable elements
  - optimization detail/result: replaces the default information surface after
    the user clicks a metric-level optimization entry
  - compare information: appears only in comparison state and emphasizes A/B
    differences rather than two independent file reports

Edit mode:

- left: layer panel with layer thumbnail and layer name; audio never appears in
  the layer panel
- center: playback canvas and playback controls
- right: reserved operation area, empty in the short-term version

### Short-term State Model

The short-term app should be implemented as explicit user-visible states rather
than as hidden feature modules.

| State | Visible surface | Primary transitions |
| --- | --- | --- |
| Launch | Full-window canvas/drop surface with open/drag prompt | Open or drag file -> Loading |
| Loading | Main surface skeleton or loading feedback | Success -> Preview ready; failure -> Load failed |
| Load failed | Error feedback with open/drag recovery | Open valid file -> Loading |
| Preview ready | Preview mode canvas and right information surface | Play, inspect, optimize through metric entries, replace, rename, switch mode; compare enters from menu or drag-decision overlay |
| Playback abnormal | Canvas remains visible when possible plus clear failure feedback | Replay or open valid file -> Preview ready |
| Runtime replacement preview | Preview mode remains active; runtime image/text replacement and Reset are available without dirty bytes | Reset -> Preview ready |
| Rename dirty | imageKey key rename has updated bytes, filename shows `*`, and Save As is enabled | Save As -> Save validating |
| Optimization candidates | File information metrics expose optimization entries | Click metric entry -> Optimization detail/result |
| Optimization comparing | Before/after previews, optimization-result card, Save As SVGA, Overwrite Save, and Abandon Optimization | Save -> Save validating; abandon -> Preview ready |
| General compare empty | Compare surface without files; playback controls remain visible but disabled | Select two files -> General comparing |
| General comparing | Two preview canvases and one right comparison panel emphasizing deltas | Exit compare -> Preview ready |
| Save validating | Output is written only after explicit button click and round-trip checks | Success -> Save complete; failure -> Save failed |
| Save complete | Saved file feedback with updated clean/dirty state; Save As remains visible but disabled after Preview dirty save | Continue preview or open another file |
| Save failed | Failure reason and retry/Save As recovery | Retry save or return to dirty state |
| Edit reserved | Full left/center/right layout, layer list visible, right operation area empty | Switch back -> Preview ready |
| Recent file missing | Launch or menu recent entry reports a missing/inaccessible file without stale metadata | Open another file or clear recent history -> Launch or Loading |
| Drag decision overlay | Supported file drag over an open canvas shows unequal top/bottom zones: Add As Compare File as the top secondary strip, Open File as the lower primary zone | Drop -> open or compare flow |
| Unsupported drag | Focused drag zone turns red with `不支持的文件格式`; dropping clears the canvas and shows a canvas toast | Open valid file -> Loading |

No short-term state may expose export acceptance, sequence repair, advanced
layer editing, inactive feature placeholders, or a separate production-spec
module.

### Replaceable Elements Surface

Image elements:

- grouped separately from text elements
- sorted by key
- auto-numbered from 1 for display only
- show initial image
- provide Replace and Reset actions

Text elements:

- grouped separately from image elements
- sorted by key
- auto-numbered from 1 for display only
- include runtime text metadata and text-semantic imageKeys such as `text1`,
  `text2`, `from`, and `to`
- show initial text when metadata provides it; otherwise show the original
  placeholder preview/key context and an empty text input for runtime preview
- the text value is an input; focusing it allows direct editing and realtime
  runtime preview
- provide Reset for runtime text value
- the key value itself is changed through the key edit action after the key
  label; only changing the key value creates dirty bytes
- text rows must not expose image-only actions such as Replace Preview Image or
  Reset Preview Image unless the user explicitly changes the key classification
  through a future configuration feature

### Canvas-first Chrome And macOS Menu

- The app window is treated as an immersive canvas-first surface.
- Launch uses a central Open action; Preview does not show a visible Open
  Another File button.
- Opening another file in Preview uses the macOS File menu or drag-and-drop
  onto the canvas.
- Preview/Edit mode switching sits at the top center of the canvas.
- General compare has no persistent visible main-surface entry. It is entered
  from the macOS menu or from drag-and-drop decision overlays.
- Save controls occupy the right-side action area only when contextually
  relevant. Preview imageKey dirty state enables Save As; optimization result
  exposes Save As SVGA and Overwrite Save.
- Settings, logs, and appearance controls move to the macOS menu bar and must
  not appear as direct main-surface buttons.
- The old top-center Local Preview / Export Acceptance switcher is removed or
  hidden in the short-term version.

### Comparison Mode

General comparison mode focuses only on file and canvas comparison:

- empty compare keeps bottom playback controls visible but disabled
- if no file is open, the macOS compare command enters a two-file selection
  flow
- dragging a supported file over an open canvas offers Open File or Add As
  Compare File through an unequal top/bottom decision overlay; Add As Compare
  File is the top secondary strip, defaulting to 25% of canvas height and
  allowed to vary between 20%-30%; Open File is the lower primary zone,
  defaulting to 75% of canvas height and allowed to vary between 70%-80%
- loaded compare shows two canvases on the left and one right comparison panel
  that emphasizes A/B differences rather than two standalone file summaries

Optimization comparison is a specialized comparison flow:

- sidebars collapse for the before/after preview
- the right-side optimization card shows concrete optimization items and effects
- Save As SVGA, Overwrite Save, and Abandon Optimization are available when
  optimized output exists; successful Overwrite Save returns to Preview

### Production Spec And Optimization Contract

Short-term production-spec comparison uses the repository-defined avatar-frame
production spec until user-configurable spec profiles are promoted in the
mid-term version.

Current short-term spec profile:

| Field | Requirement | Notes |
| --- | --- | --- |
| Profile id | `avatar-frame-production` / `production_target` | Current repository production target. |
| File size | <= 512 KiB | Provisional and needs calibration with more delivery samples. |
| Canvas size | <= 300 x 300 | Based on current avatar-frame production canvas. |
| Duration | <= 3000 ms | Current 72-frame / 24-FPS loop target. |
| FPS | <= 24 | Current default avatar-frame export configuration. |
| Resource count | <= 32 | Provisional, based on existing repository outputs. |
| Resource dimensions | <= 300 x 300 | Embedded image resources should stay inside the production canvas. |
| Transparent padding ratio | <= 0.5 | Provisional texture-waste boundary. |

Default Preview information shows compact production-spec status without target
thresholds. Optimization detail or result context must show the relevant
current value and requirement value for fields involved in the optimization
decision. Missing decoded values should show an unknown or unavailable state
instead of passing silently.

Memory estimation:

- Estimated decoded resource memory is `width * height * 4` for image resources
  with known dimensions.
- Total decoded memory is unknown when any required resource dimension is
  unavailable.
- Current advisory levels are low at <= 4 MiB, medium above 4 MiB, and high
  above 16 MiB.
- The product copy must call this an estimate, not measured runtime memory.

Runtime structure estimation:

- Decoded image memory is not the same as target-player runtime memory.
- The app must estimate and display runtime structure risk separately from
  decoded image memory.
- Runtime structure metrics include sprite count, total FrameEntity count,
  alpha-positive frame count, invisible-frame ratio, low-alpha frame ratio,
  sequence-frame fanout, per-frame visible sprite peak/average, and estimated
  runtime structure memory.
- The first calibrated production case is the lucky notice SVGA module: one
  file with only 27 images and about 1.10 MiB decoded image memory expanded to
  2883 sprites and 345,960 FrameEntity records, and was reported by client
  engineers to approach 20 MiB runtime memory on phones.
- Until target-player-specific measurements are available, runtime structure
  thresholds are advisory and must fail closed: high sprite/FrameEntity counts
  must warn even when file size and decoded image memory pass.
- When a target player has a documented alpha draw threshold or object
  allocation profile, Auto SVGA may show target-player-specific risk and
  optimization estimates, but generic SVGA output must not silently assume that
  all players skip the same low-alpha content.

Optimization actions are enabled only when the app can produce optimized bytes
and prove round-trip safety. Otherwise they remain findings or suggestions,
not active buttons.

| Optimization method | Short-term disposition | Required safety proof |
| --- | --- | --- |
| Remove unreferenced image resources | May be enabled | Usage count is zero, resource is removed, references remain closed, output inflates/decodes/reopens. |
| Deduplicate byte-identical image resources | May be enabled | Duplicate hashes match, references redirect to canonical key, kept image bytes remain unchanged, output reopens. |
| Image compression | Allowed when implemented | User can understand or adjust quality, before/after size is shown, visual comparison and reopen validation pass. |
| Transparent-bound trimming | Allowed when implemented | Offset or transform compensation is proven, visual comparison passes, unsupported cases remain suggestion-only. |
| Sequence-frame processing | Allowed only for optimization | May remove or collapse mechanically safe duplicate/unreferenced frame resources; anti-flicker sequence repair is mid-term. |
| FPS or canvas adjustment | Allowed only with explicit confirmation | Production spec remains satisfied, timing/canvas impact is shown, before/after playback comparison passes. |
| All-zero sprite/frame pruning | May be enabled | Sprite maximum alpha is zero across its timeline, removed resources become unreferenced only after the sprite removal, references remain closed, output inflates/decodes/reopens. |
| Target-player low-alpha pruning | Review-only unless a target-player threshold profile is selected and validated | The optimization states the threshold, proves before/after playback equivalence for that target, and remains suggestion-only for generic SVGA compatibility. |
| Sequence-fanout reduction or rebake | Review-only until validated | Detects repeated sequence instances that create excessive sprite/FrameEntity counts; output must show before/after sprite count, FrameEntity count, decoded memory, file size, and playback comparison. |

Safe optimization batch action:

- The short-term product may expose one primary batch action for safe
  deterministic optimization items only.
- The action must include only items that can produce optimized bytes and pass
  round-trip safety proof without human review.
- Review-only, risky, unsupported, or visually ambiguous findings must stay out
  of the batch action and require separate per-item review, explicit
  confirmation, or remain suggestion-only.
- `一键优化` is allowed as short-term product copy only when the UI makes clear
  that it applies to safe executable items, not every optimization finding. More
  explicit labels such as `执行安全优化` or `生成安全优化副本` are also acceptable.
- Optimization copy should classify findings as `可安全执行`, `需复核`, or
  `暂不支持/建议项`.

Optimization output rules:

- The source file is not overwritten automatically.
- Optimization result output exposes Save As SVGA and Overwrite Save. Overwrite
  Save is allowed only after the user explicitly chooses it.
- Preview imageKey key rename dirty state exposes Save As; after successful
  Save As, the filename `*` disappears and Save As remains visible but disabled
  until the next dirty state.
- Both save paths require inflate/decode validation and reopen proof for the
  saved bytes.
- The optimization result card must show what changed, before/after file size
  where available, estimated memory impact where available, and risky/skipped
  candidates.

### Drag And Unsupported Format Behavior

- Dragging a file over the canvas shows a semi-transparent black overlay.
- When a file is dragged over an already-open preview, the overlay uses
  top/bottom decision zones instead of left/right halves.
- Add As Compare File is the top secondary strip. It defaults to 25% of the
  canvas height and may vary only within 20%-30% if responsive constraints
  require it.
- Open File is the lower primary zone. It defaults to 75% of the canvas height
  and may vary only within 70%-80% if responsive constraints require it.
- The split line defaults to 25% from the top of the canvas. Above the split is
  Add As Compare File; on and below the split is Open File.
- The layout should account for the Product Owner's common drag path from the
  macOS Dock/Desktop folder upward into the app; lower-center drops should not
  accidentally favor comparison, and the canvas center, lower-center, and
  bottom-entry casual drop path must belong to the Open File primary zone.
- Compare is opt-in: users must deliberately drag into the top secondary strip
  to add the file as the comparison file.
- The pointer-focused zone is the focus region.
- For supported files, the focus region turns semi-transparent green.
- For unsupported files, the focus region turns semi-transparent red and shows
  `不支持的文件格式`.
- Dropping an unsupported file clears the canvas and shows a centered canvas
  toast with `不支持的文件格式`.

### Appearance And Settings

- The short-term client must support both light and dark appearance.
- Owner-confirmed designs establish the light canvas-first direction; dark mode
  must preserve the same immersive, boundary-light, canvas-first hierarchy.
- Appearance switching is available from the macOS menu and a Settings sheet,
  not from a main-surface toolbar button.
- The Settings sheet exposes only appearance options unless the Product Owner
  explicitly confirms more settings: Follow System, Light, and Dark.

### Small-window Rule

- The right information area responds to window width until reaching the
  minimum width where all required information can display without wrapping in
  an incoherent way.
- After that minimum, the surface must stop compressing.
- The short-term app does not collapse the information area and does not use
  horizontal scrolling as the small-window solution.

### Short-term Verification Sample Matrix

Short-term validation should include at least these sample classes. Synthetic
fixtures are acceptable when real production assets cannot be committed.

| Sample class | Required coverage |
| --- | --- |
| Valid ordinary SVGA | Open, play, inspect, save-disabled clean state. |
| Invalid or non-SVGA file | Error message, no stale metadata, recovery by opening a valid file. |
| SVGA with only automatic imageKeys | No replaceable image elements shown beyond ordinary image assets. |
| SVGA with designer-named imageKeys | Replaceable image list, runtime image replacement, reset, rename path. |
| SVGA with runtime text metadata or text-semantic imageKeys | Inline text input, runtime preview, reset, byte-immutability, and no duplicate image replacement row for keys such as `text1`, `text2`, `from`, or `to`. |
| SVGA with sequence/frame resources | Four-frame thumbnail, sequence grouping, optimization findings. |
| SVGA with runtime structure fanout | Sprite count, FrameEntity count, sequence-fanout warning, runtime memory risk, and runtime-structure optimization candidates. |
| SVGA with no audio | Audio group shows `当前文件暂无音频资产`. |
| SVGA with unreferenced or duplicate image resources | Safe optimization candidate, optimized output, reopen proof. |
| SVGA with transparent padding | Production-spec comparison and review-only or enabled trim state. |
| SVGA exceeding file size, canvas, FPS, resource, or memory limits | Actual-vs-requirement comparison and clear severity. |
| Supported imageKey rename fixture | Reference update, no dangling imageKey/matteKey, saved output reopens. |
| Recent-file history | Launch five-row display, `File > Recent` ten-row display, path-redacted labels, clear-history behavior, and missing-file recovery. |

### Short-term Non-goals

- Export acceptance UI or export-review mode
- Sequence-frame repair
- Advanced layer editing
- Timeline, transform, alpha, shape, audio, mask, or general frame-structure
  editing, except the bounded runtime-structure optimization required by S17
  and S18
- Text persistence as direct SVGA-byte editing
- Audio parsing as a required feature
- Broad batch replacement
- Advanced recent-file privacy modes beyond path-redacted display and
  clear-history control
- Public release, App Store release, auto-update, accounts, telemetry, or cloud
  sync

## AE Production Bridge: AE To Auto SVGA Pipeline

Goal: let designers finish motion work in After Effects and send the current
composition to Auto SVGA for compatibility analysis, preview, optimization,
SVGA encoding, and production handoff without relying on the official
SVGAConverter as the required export path.

This is an Owner-confirmed must-do production-efficiency mainline. It is not an
AI or generative-design feature. It serves human designers and the current team
workflow first, and it should be scheduled before ComfyUI, external AI,
multimodal generation, or agent-driven automatic design. It may run ahead of
parts of the mid-term template-editing line when implementation capacity is
limited. Already-started mid-term foundation work may continue in isolated lanes
when it provides reusable SVGA parsing, encoding, validation, edit-history,
budget, or preview infrastructure and does not block AE bridge delivery.

Subordinate planning lives in `docs/product/AE_BRIDGE_PRODUCT_BRIEF.md`.

### AE Bridge Product Principle

- Keep AE as the creative authoring environment. Auto SVGA does not try to
  become a smaller After Effects for human designers.
- Keep the AE extension thin. The extension scans the active composition,
  exports a local package, executes requested bake jobs, and hands results to
  Auto SVGA. Auto SVGA owns compatibility decisions, optimization, SVGA
  encoding, preview, and reports.
- Prefer a robust local folder/package bridge first. Localhost, socket, or deep
  link handoff can be added after the file-based path is reliable.
- Support native conversion only for a bounded AE-safe subset. Unsupported AE
  features are detected and handled through bake, degrade, block, or
  suggestion-only states.
- Never silently claim that arbitrary AE effects can be losslessly converted to
  SVGA. Visual parity must be proven or described as approximate.
- Protect replaceable elements. Designer-named imageKey/textKey candidates
  must not be accidentally baked into opaque frame sequences when runtime
  replacement is required.
- Keep all analysis local by default. Do not upload AE projects, assets, bake
  frames, logs, or reports to AI or cloud services.

### AE Bridge Delivery Order

| Stage | Theme | Product goal | Depends on |
| --- | --- | --- | --- |
| AEB0 | Compatibility research and package contract | Prove supported AE/OS versions, extension approach, package schema, and local handoff path. | Short-term app can open/import local packages or fixture files in an isolated lane. |
| AEB1 | AE scan-to-Auto-SVGA bridge MVP | From AE, export a composition package and show a compatibility report in Auto SVGA. Final SVGA output is not required yet. | AEB0 package contract and local import proof. |
| AEB2 | Native SVGA subset export | Convert supported image layers and transform animation into real SVGA bytes and enter Auto SVGA Preview. | Existing SVGA exporter, preview, validation, and save flows. |
| AEB3 | Bake fallback MVP | Detect unsupported layers, request AE-side transparent sequence baking, import baked assets, and show size/memory risk. | AEB1 scanner and AEB2 package import/preview. |
| AEB4 | Bake planner and production optimization | Recommend native-vs-bake decisions, group safe bake candidates, protect replaceable layers, and produce production-ready SVGA reports. | AEB3 bake evidence and short-term optimization primitives. |
| AEB5 | Converter replacement and future output | Make the bridge the default internal AE-to-SVGA production route and prepare the same package/IR for approved future formats. | AEB1-AEB4 evidence and target-runtime validation. |

### AE Bridge Required Capabilities

| ID | Requirement | Product detail |
| --- | --- | --- |
| AEB1 | AE extension entry | Designers can open an Auto SVGA extension, script, or panel from AE and run `Export to Auto SVGA` on the active composition. |
| AEB2 | Local export package | The bridge writes an `ae-export-package` containing manifest, composition metadata, layer facts, assets, optional bake outputs, and scanner report. |
| AEB3 | Local handoff to Auto SVGA | Auto SVGA can open or watch the package locally. File/folder handoff is the primary baseline; localhost/socket/deep link is optional after the baseline is stable. |
| AEB4 | AE compatibility scanner | The bridge detects supported native-conversion layers, unsupported features, bake-required features, replaceability risks, and environment details before export. |
| AEB5 | Native conversion subset | The first native subset covers comp size, FPS, duration, transparent background, image/footage layers, z-order, anchor point, position, scale, rotation, opacity, and frame-based sampled transforms. |
| AEB6 | Unsupported feature handling | Effects, expressions, 3D layers, cameras, lights, complex shape/path animation, text animators, track mattes, adjustment layers, complex masks, particles, blur, glow, and distortion are not silently converted. They become bake, degrade, block, or suggestion-only findings. |
| AEB7 | Bake request plan | Auto SVGA can return bake instructions for selected layers, precomps, or safe layer groups, including time range, FPS, alpha output, bbox, and expected risk. |
| AEB8 | AE-side bake execution | The AE bridge can create temporary bake comps, preserve timing/canvas/alpha, render transparent sequences through AE's render workflow, and return a bake manifest. |
| AEB9 | Bake grouping decision | Auto SVGA can recommend merged or separate bake groups based on z-order safety, overlap, time range, replaceability, bbox size, empty-frame ratio, duplicate-frame ratio, and memory/file-size risk. |
| AEB10 | Replaceable-element protection | The scanner and bake planner must identify designer-named replaceable candidates and avoid baking them into non-replaceable sequences unless the user explicitly accepts that loss. |
| AEB11 | Auto SVGA preview handoff | Successful native or baked output opens directly in Auto SVGA Preview mode with short-term preview information, assets, diagnostics, optimization, comparison, and save behavior available. |
| AEB12 | Production diagnostics | Every bridge run reports compatibility, native-converted layers, baked layers, blocked layers, expected visual risk, file size, decoded memory, runtime structure risk, production-spec status, and target-player risk. |
| AEB13 | Real SVGA output | When export is enabled, Auto SVGA must produce standards-compliant SVGA bytes, validate inflate/decode/reopen/playback load, and allow Overwrite Save or Save As only after validation. |
| AEB14 | Version and OS compatibility matrix | The product must maintain a real compatibility matrix for macOS and Windows across supported AE versions. Formal support, compatibility support, and best-effort legacy support must be separate. |
| AEB15 | Failure-safe source handling | The bridge must not mutate the original AE project, must isolate temporary comps and rendered frames, and must provide cleanup/recovery instructions on failure. |
| AEB16 | Future-format readiness | The package and internal animation IR should avoid SVGA-only assumptions where practical, so VAP, WebM, APNG, Lottie, or other approved future outputs can reuse the bridge. Future formats remain later scope until approved. |

### AE Bridge Compatibility Policy

Formal support starts narrow and evidence-based:

- Formal support target: current production AE versions on macOS and Windows,
  initially AE 2024, AE 2025, and AE 2026 unless real team inventory requires a
  different first matrix.
- Compatibility support target: AE 2020 through AE 2023 with possible UI or
  automation degradation.
- Legacy best-effort target: earlier CC versions may receive the thin script
  export path only. Automatic bake, modern panel UI, or full workflow support is
  not guaranteed.
- Unsupported environments include modified AE installs, missing render-output
  templates, blocked file permissions, unavailable local disk space, or
  environments where the bridge cannot prove source safety.

Every supported OS/version cell must prove:

- extension or script launch
- active composition detection
- manifest export
- asset export
- compatibility scanning
- temporary bake comp creation when bake is supported
- transparent sequence output when bake is supported
- package import into Auto SVGA
- Auto SVGA preview or clear failure state
- source project remains unchanged

### AE Bridge Interaction Model

Default AE bridge flow:

1. Designer completes motion in AE.
2. Designer runs `Export to Auto SVGA`.
3. AE bridge scans the active composition and writes a local export package.
4. Auto SVGA opens the package and shows a compatibility report.
5. Auto SVGA proposes native conversion, bake, degrade, block, or manual-fix
   actions.
6. If baking is needed, Auto SVGA sends a bake plan back to the AE bridge or
   instructs the designer to run the next bridge step.
7. AE bridge renders temporary transparent bake outputs and updates the package.
8. Auto SVGA imports native and baked assets into its internal animation IR.
9. Auto SVGA generates a preview and diagnostics.
10. When output is enabled, Auto SVGA writes validated SVGA bytes and exposes
    Overwrite Save / Save As.

### AE Bridge Acceptance Matrix

| ID | Accept when | Required evidence |
| --- | --- | --- |
| AEB1-AEB3 | A designer can export a local package from AE and Auto SVGA can open it without source mutation. | AE launch proof, package manifest proof, local import proof, source-unchanged proof. |
| AEB4-AEB6 | The scanner separates native, bake-required, blocked, and suggestion-only features without silent conversion. | Feature fixture matrix, unsupported-feature report, no-false-success proof. |
| AEB7-AEB9 | Unsupported but bakeable content can be rendered through temporary comps and returned with cost/risk evidence. | Bake manifest, transparent-sequence proof, generated asset count, file/memory estimate, cleanup proof. |
| AEB10 | Replaceable candidates remain protected from accidental bake loss. | Replaceable fixture, bake-plan exclusion proof, explicit-loss-confirmation proof. |
| AEB11-AEB13 | Converted output opens in Auto SVGA Preview, validates as real SVGA, and can be saved through existing save flows. | Preview proof, inflate/decode/reopen proof, playback-load proof, Save/Save As proof. |
| AEB14 | Compatibility claims are backed by real OS/AE version cells. | macOS/Windows matrix, AE version report, known limitations. |
| AEB15 | Failure leaves the AE project and original assets safe. | Failure-injection proof, source hash/project-state proof, temp cleanup proof. |
| AEB16 | The bridge package does not block future approved output formats. | Package schema review and IR boundary review. |

### AE Bridge Non-goals

- Full lossless conversion of arbitrary AE projects into SVGA.
- Replacing After Effects as the creative motion-authoring tool.
- Requiring designers to use Auto SVGA to create human-authored motion.
- External AI, ComfyUI, multimodal, cloud, or hosted model analysis.
- Uploading AE projects, assets, bake frames, or reports to external services.
- Full keyframe/timeline editor inside Auto SVGA for human designers.
- Direct PSD, Figma, Sketch, C4D, Blender, or unordered asset-folder assembly
  as part of the AE bridge MVP.
- Public plugin marketplace distribution before internal compatibility evidence
  and signing/installation strategy are settled.

## Mid-term Direction

The mid-term version turns Auto SVGA from a preview and inspection tool into a
template-based SVGA motion editing tool. It still must not become a small,
low-end After Effects clone. Users edit by selecting layers, applying bounded
motion/effect templates, adjusting recommended parameter ranges, choosing
preset easing curves, and compiling the result back into a real SVGA file.

Mid-term remains planned and may continue in isolated implementation lanes.
However, after the 2026-07-03 Owner correction, the AE production bridge has
higher product priority for near-term team value than the template-editing
line. Mid-term work should therefore avoid consuming the integration capacity
needed by the AE bridge, while still preserving reusable foundations such as
SVGA parsing, transform math, compile validation, history, budget reporting,
and preview handoff. Every capability below needs current-head product evidence
before it can be called accepted.

### Mid-term Product Principle

- Import starts from a complete, already-composed, and clearly named SVGA file.
  Designers are expected to place and name layer elements in AE before export.
- The app may use deterministic rules based on file names, imageKeys, layer
  names, dimensions, position, alpha bounds, overlap area, and left/right/top/
  bottom relationships.
- The app must not use external AI, multimodal analysis, cloud services, or
  broad visual recognition in the mid-term version.
- The app must not assemble an unordered asset folder into a finished avatar
  frame in the mid-term version.
- Edit mode owns mid-term editing. Preview mode remains the short-term
  inspection/playback/optimization surface and must work on the compiled edited
  SVGA.
- No free keyframe editor, advanced timeline, expression/script editor, or
  general composition authoring is exposed. Template parameters such as speed,
  period, intensity, amplitude, direction, phase, and easing replace manual
  timeline editing.
- All persisted edits are either reversible in the edit session or gated by
  explicit Overwrite Save / Save As after validation.

### Mid-term Sub-version Plan

Implementation preparation for this section lives in
`docs/product/MID_TERM_IMPLEMENTATION_PREP.md`. That document is subordinate to
this roadmap and may sequence work, record technical risks, and define
validation gates, but it must not redefine mid-term product scope.

| Sub-version | Theme | Product goal | Depends on |
| --- | --- | --- | --- |
| M1 | Edit foundation and transform output | Make Edit mode useful for layer transforms, preset curves, copy/paste, undo/redo, mirror transforms, and real SVGA compile-back. | Accepted short-term open/play/save flow and MVP transform/export primitives. |
| M2 | Production rules, audio, and repair | Add configurable spec profiles, audio parsing/display/export toggle, and sequence-frame anti-flicker repair. | M1 output validation and short-term diagnostics. |
| M3 | Template library MVP | Add transform templates, one advanced wing-flap template, common blend modes, basic light templates, and seeded basic particles. | M1 transform/curve system and M2 spec risk reporting. |
| M4 | Semantic template recommendation | Analyze a normalized SVGA, recommend templates by deterministic layer semantics, and enter Edit mode with proposed plans. | M3 template library and layer classification. |
| M5 | Advanced baked effects and distribution hardening | Add selected baked displacement/light extensions, later-stage particle controls, trusted macOS signing, and Windows packaging planning. | M1-M4 validation and performance evidence. |

### Mid-term Required Capabilities

| ID | Requirement | Product detail |
| --- | --- | --- |
| M1 | Edit-mode layer transform editing | Edit selected image layers using the five base properties: anchor, position, scale, rotation, and opacity. Existing short-term reserved Edit mode becomes active. |
| M2 | Preset easing curves | All transform and template animations use preset curves only: `linear`, `easeIn`, `easeOut`, `easeInOut`, `sineIn`, `sineOut`, `sineInOut`, `quadIn`, `quadOut`, `quadInOut`, `cubicIn`, `cubicOut`, `cubicInOut`, `quartIn`, `quartOut`, `quartInOut`, `quintIn`, `quintOut`, `quintInOut`, `circIn`, `circOut`, `circInOut`, `backIn`, `backOut`, and `backInOut`. |
| M3 | Template-parameter editing instead of timeline editing | Users adjust bounded template parameters such as speed, period, phase, amplitude, intensity, density, direction, width, and seed. They cannot create or drag arbitrary keyframes. |
| M4 | Copy, paste, undo, and redo | Layer transform parameters and template effect settings support copy/paste. Every edit operation supports undo and redo with a save-point dirty state. |
| M5 | Mirror layer mode for transforms | Selecting a layer can create a mirror-linked layer using axis symmetry or center symmetry. Transform edits on the source are applied to the mirror with direction, position, and rotation adjusted by mirror type. Light and particle effects do not apply to mirror links. |
| M6 | Mirror output as real layers | Mirror-linked layers remain associated in Edit mode, but compile into real independent SVGA sprite/layer output. |
| M7 | Compile edited SVGA and return to Preview mode | After editing, the app can compile edits into real SVGA bytes, switch to Preview mode, play the edited result, and run short-term preview information, asset, diagnostic, optimization, save, and comparison functions. |
| M8 | Sequence-frame repair | Detect supported sequence-frame flicker cases, repair them fail-closed, show before/after affected-frame evidence, and produce validated edited SVGA bytes. |
| M9 | Configurable production spec profiles | Users can choose repository-provided production spec versions without editing code. Active profile id and actual-vs-required values remain visible. |
| M10 | User-defined production specs | Users can create or import a local custom production spec profile with validation, version label, and rollback to built-in profiles. |
| M11 | Audio asset parsing and duration display | Parse SVGA audio assets when present, show audio asset rows and duration, and keep the short-term no-audio empty state truthful. |
| M12 | Optional audio exclusion on export | When compiling edited SVGA output, users can choose not to export audio. No waveform editing, audio replacement, trimming, or volume editing is included in the mid-term version. |
| M13 | Common blend-mode subset | Support the layer blend-mode subset `Normal`, `Add`, `Screen`, `Lighten`, `Multiply`, and `Overlay`. Unsupported blend modes must preserve, warn, bake, degrade, or block with explicit explanation. |
| M14 | Basic transform templates | Provide reusable templates based on anchor, position, scale, rotation, and opacity changes, such as breathing, pulse, float, swing, rotate, pop, settle, and shimmer-like transform cycles. |
| M15 | Advanced motion template MVP | Provide wing flap as the first advanced motion template. It combines anchor placement, rotation, scale, easing, phase, and optional baked bend/displacement to simulate wing motion. |
| M16 | Deterministic wing joint estimation | For likely wing layers, estimate joint position using deterministic rules: name/layer semantics, layer side, bounding box, alpha bounds, and overlap area with frame/body layers. No AI or broad visual recognition is allowed. Low-confidence joint estimates require user review or manual anchor adjustment. |
| M17 | Advanced transform/displacement boundary | Support a limited baked displacement path for effects such as bend and wave when needed by wing flap or similar templates. Output must be real SVGA through baked frames or generated assets and must show file-size and memory risk. |
| M18 | Basic light templates | Provide sweep light, sparkle/star flash, and glow templates. Sweep supports direction/angle, linear or radial behavior, forward/reverse motion, density, width, opacity/intensity, easing, and supported blend modes. |
| M19 | Advanced light template MVPs | Provide bounded edge-flow and energy-flow light templates when deterministic input evidence exists. Edge-flow applies sweep/glow/star accents to high-light or edge regions. Energy-flow may use generated fractal/noise-like assets, masks, and blend modes. |
| M20 | Basic particle templates | Provide seeded particle templates only: upward floating particles, downward/falling particles including vertical and diagonal directions, and star sparkle particles. Parameters remain limited and recommended. |
| M21 | Advanced particle system later-stage | Advanced particles are mid-term later-stage only. They may expose key parameters such as emitter binding, speed, and curve presets, but must not become a complete particle editor. |
| M22 | Semantic SVGA analysis | Analyze imported static SVGA layer/resource names and geometry to identify likely wings, gems, crown, ribbon, ring, metal, glow, and left/right pairs. |
| M23 | Template recommendation and add flow | After analysis, suggest suitable transform/light/particle templates and enter Edit mode with auto-loop playback. Users review and apply recommendations before bytes are changed. |
| M24 | Edit operation tabs | In Edit mode, the right panel shows exactly three editing tabs for mid-term MVP: Transform, Light, and Particle. Each tab lists supported templates and limited parameters with recommended min/max ranges. |
| M25 | Replaceable-element naming rule configuration | Add configurable whitelist/blacklist regular expressions for identifying designer-intended replaceable elements. |
| M26 | Distribution hardening | Trusted macOS signing/notarization and Windows packaging planning may proceed when credentials, runtime validation, and package evidence are available. |

### Mid-term Detailed Product Contracts

#### Edit Session And Compile Contract

- Edit mode works against an edit session derived from the opened SVGA. The
  original SVGA bytes remain unchanged until explicit Overwrite Save.
- Compile to Preview creates real edited SVGA bytes and hands those bytes to
  the short-term Preview surfaces. The compiled Preview state is the save
  candidate.
- Returning from compiled Preview to Edit may continue from the current edit
  session while the file remains open. Reopening a saved SVGA without a future
  sidecar/project format treats it as an ordinary SVGA input, not as a fully
  restorable authoring project.
- A durable sidecar or project-session format is not part of the committed
  mid-term scope unless Product Owner explicitly promotes it.

#### Template Parameter Contract

Every template promoted into a mid-term sub-version must define a small schema
before implementation starts:

- supported target layer roles
- editable parameters, units, default value, recommended min/max, and hard
  validation min/max
- supported preset easing curves
- deterministic seed behavior when randomness is used
- whether the template affects transform, generated image assets, blend mode,
  mask/matte, audio export, or compile-only baked output
- preview strategy, compile strategy, unsupported-case behavior, and expected
  size/memory risk fields

Templates without this schema remain candidates and must not appear as inactive
placeholders in the formal mid-term UI.

#### Mirror Layer Contract

- Mirror mode supports axis symmetry and center symmetry.
- For axis symmetry, users can choose the mirror reference from canvas center
  line, selected-layer center line, or a custom user-specified axis. The default
  is canvas center line.
- For center symmetry, users can choose the symmetry center from canvas center,
  selected-layer center, or a custom user-specified point. The default is
  canvas center.
- Mirror links apply only to transform edits and transform-based templates.
  Light and particle templates are not applied through mirror links.
- Source-layer transform changes must map to mirror-layer position, direction,
  rotation, and scale consistently with the selected mirror reference. For
  example, a clockwise wing swing on the left side may become a counter-clockwise
  swing on the mirrored right side with matched amplitude.
- Compile output must write mirror results as real independent SVGA sprites or
  layers. Edit mode may retain mirror-link metadata only inside the active edit
  session.

#### Blend Mode And Baked Output Contract

- Mid-term blend mode support is limited to `Normal`, `Add`, `Screen`,
  `Lighten`, `Multiply`, and `Overlay`.
- SVGA has no committed native blend-mode field in the standard proto path, so
  each supported blend mode must declare whether it is preview-only, baked into
  generated image assets, approximated with fallback opacity, preserved as
  metadata, or blocked for the current output path.
- Unsupported blend modes must never silently become `Normal`. They must be
  preserved, warned, baked, degraded, or blocked with an explicit report entry.
- Preview and compiled output must use the same declared strategy or show a
  visible warning when preview is only an approximation.

#### Baked Effect Budget Contract

Baked displacement, light, particle, and sequence-repair output must report:

- generated asset count
- generated frame count
- random seed, when applicable
- affected layer ids and resource ids
- before/after file size
- before/after estimated decoded memory
- active production-spec profile and whether the result remains within limits
- skipped, degraded, or blocked optimizations with reasons

When an effect would exceed the active production-spec profile or the selected
quality budget, the app must offer a lower-risk setting, keep the item
suggestion-only, or block compile. It must not produce an oversized file without
an explicit user-visible risk state.

#### Semantic Analysis Contract

- Mid-term semantic analysis is deterministic and local-only. It may use file
  names, imageKeys, layer names, dimensions, alpha bounds, position, z-order,
  overlap area, and left/right/top/bottom relationships.
- The first committed naming vocabulary should cover common avatar-frame roles
  such as wing/翅膀, gem/宝石, crown/皇冠, ribbon/飘带, ring/圆环, frame/主体,
  metal/金属, glow/光效, left/right/L/R/左/右, top/bottom/上/下.
- Every inferred role or pair must carry evidence and confidence. Ambiguous,
  conflicting, missing, or low-confidence results remain suggestions and require
  user review before applying templates.
- Semantic analysis must not use external AI, broad visual recognition, network
  services, or unordered asset-folder assembly.

#### Wing Joint Estimation Contract

- For likely wing layers, the app may estimate the joint by combining naming
  evidence, side detection, bounding box, alpha bounds, and overlap area with
  likely frame/body layers.
- High-confidence estimates may prefill the anchor. Low-confidence estimates
  must expose a review state and allow manual anchor adjustment before the wing
  flap template is applied.
- The report must include the chosen joint position, evidence used, confidence,
  and whether the user confirmed or changed it.

#### Audio Export Contract

- Audio parsing in the mid-term version covers asset presence and duration
  display only.
- The export-audio toggle applies during compile. When disabled, compiled SVGA
  output must remove `AudioEntity` entries and any audio bytes that are no
  longer referenced by the output, while preserving unrelated image resources.
- Reports must compare audio count and audio byte size before and after compile.
- Audio replacement, waveform display, trimming, volume automation, and timing
  editing remain out of mid-term scope.

#### Undo, Redo, Copy, And Paste Contract

Undo and redo must cover all edit-session mutations that can affect compiled
output:

- layer transform changes
- anchor changes
- template add/remove and parameter changes
- mirror-link create/remove and mirror reference changes
- semantic recommendation apply/reject actions
- audio export toggle
- replaceable-element naming-rule changes when they affect the open file

Copy and paste must cover layer transform parameters and template settings.
Pasting incompatible settings must fail with a clear reason instead of creating
hidden partial state.

#### Compile Invariant Contract

Every mid-term compile must validate that output remains a standards-compliant
SVGA and that preserved structures remain intentional:

- no dangling `imageKey` or `matteKey`
- sprite frame counts match movie frame count
- resource key closure is complete
- image, audio, matte, clipPath, and shape fields are preserved or explicitly
  transformed by an accepted edit
- unsupported or unknown structures are preserved, blocked, or reported; they
  must not be silently dropped
- compiled output can be reopened by the app and reaches Preview mode with
  short-term preview information, assets, diagnostics, optimization, comparison, and save
  behavior available

#### Mid-term Verification Sample Matrix

Mid-term validation should include at least these sample classes:

| Sample class | Required coverage |
| --- | --- |
| Named wing pair | Semantic wing detection, joint estimate, mirror transform, wing flap compile. |
| Ambiguous or low-confidence wing | Review state, manual anchor adjustment, no automatic template apply. |
| No wing or unmatched side | No false positive auto-apply, recommendation remains absent or low confidence. |
| Blend-mode fixtures | `Normal`, `Add`, `Screen`, `Lighten`, `Multiply`, `Overlay`, plus unsupported blend warning/block path. |
| Audio fixture | Duration display, export with audio, export without audio, reopen proof. |
| Mirror references | Canvas-center axis, layer-center axis, custom axis, canvas-center point, layer-center point, custom point. |
| Baked displacement fixture | File-size and memory delta, compile proof, over-budget handling. |
| Basic particles fixture | Seed reproducibility, generated asset report, output risk report. |
| Sequence-flicker fixture | Supported repair success, unsupported fail-closed path, before/after evidence. |
| Custom production spec | Built-in profile selection, custom import/validation, rollback to built-in profile. |

#### Privacy And Temporary Asset Contract

- All semantic analysis, preview, baking, and compile work remains local.
- Temporary frames and generated assets may contain user artwork and must follow
  the same local-file redaction, cleanup, and no-asset-commit rules as
  short-term optimization output.
- Reports may include filenames, resource ids, sizes, dimensions, hashes, and
  redacted paths, but must not expose unnecessary absolute local paths.

### Mid-term Interaction Model

Default mid-term editing flow:

1. Open or drag a complete static SVGA.
2. Preview mode loads and verifies the file using short-term behavior.
3. User enters Edit mode manually, or accepts a template recommendation flow
   that enters Edit mode after semantic analysis.
4. Left panel shows layers with thumbnail, layer name, semantic role, mirror
   marker when present, and confidence markers for inferred semantics.
5. Center canvas auto-loops playback and reflects current edit-session state.
6. Right panel shows Transform, Light, and Particle tabs.
7. User applies templates or edits bounded parameters.
8. Copy/paste, undo/redo, reset, and dirty state remain visible and reliable.
9. User compiles to Preview mode.
10. The app generates real SVGA bytes, validates inflate/decode/reopen/playback,
    and hands the compiled file to the short-term Preview mode surfaces.
11. User chooses Overwrite Save or Save As.

### Mid-term Output And Evidence Rules

- Compiled output must be real SVGA bytes, not a project-only sidecar.
- Original input bytes remain unchanged until explicit Overwrite Save.
- Baked displacement, light, particle, and sequence repair outputs must show
  before/after file size and estimated decoded memory.
- Baked effects must record generated asset count, frame count, seed when
  applicable, and affected layers.
- Every compile must validate inflate, decode, resource reference closure,
  sprite frame count, image/matte references, playback load, and save-state
  consistency.
- If a template or repair cannot preserve SVGA semantics, it must fail closed
  or remain suggestion-only.
- Reference sources: SVGA official proto defines `FrameEntity.alpha`,
  `FrameEntity.transform`, `SpriteEntity.imageKey`, and audio fields
  (`https://github.com/svga/SVGA-Format/blob/master/proto/svga.proto`);
  Adobe After Effects blend modes are used as conceptual reference for the
  common blend-mode subset
  (`https://helpx.adobe.com/after-effects/using/blending-modes-layer-styles.html`).

### Mid-term Acceptance Matrix

| ID | Accept when | Required evidence |
| --- | --- | --- |
| M1-M3 | A selected layer can be transformed by bounded parameters and preset curves without exposing keyframe editing. | Edit-mode interaction proof, transform math proof, curve interpolation tests, no-free-keyframe UI proof. |
| M4 | Copy/paste and undo/redo restore exact edit-session state and dirty state. | History model tests, UI proof, save-point proof. |
| M5-M6 | Mirror layer mode creates correct mirrored motion and compiles to independent SVGA sprites. | Mirror transform proof, exported sprite proof, source/mirror direction proof. |
| M7 | Edited output compiles, returns to Preview mode, plays, inspects, optimizes, and saves through short-term flows. | Compile report, reopen proof, Preview-mode proof, Save/Save As proof. |
| M8 | Supported sequence flicker cases repair fail-closed and show affected-frame evidence. | Sequence repair report, before/after proof, alpha/visibility proof, unsupported-case proof. |
| M9-M10 | Built-in and custom spec profiles can be selected, validated, compared, and restored. | Profile selection proof, custom profile validation, actual-vs-required UI proof. |
| M11-M12 | Audio assets parse with duration, and export can include or exclude audio. | Audio parse fixture, duration proof, export-with-audio proof, export-without-audio proof. |
| M13 | Supported blend modes preview and compile consistently, while unsupported modes are handled truthfully. | Blend-mode preview matrix, export/fallback report, unsupported-mode proof. |
| M14-M17 | Transform and wing-flap templates produce controlled motion and, when baked displacement is used, report size/memory risk. | Template application proof, wing joint estimate proof, baked output report, file/memory delta proof. |
| M18-M21 | Light and particle templates render deterministic seeded output with bounded parameters and risk reporting. | Template fixture proof, seed reproducibility proof, generated asset report, memory/file-size proof. |
| M22-M23 | Semantic analysis recommends templates from deterministic naming/geometry evidence and requires user review before applying. | Classification report, recommendation proof, low-confidence review proof. |
| M24 | Edit mode exposes Transform, Light, and Particle tabs only, without future inactive controls. | Screen-state proof and no-placeholder audit. |
| M25 | Replaceable-element naming rules can be configured without showing every automatic image key as replaceable. | Regex config proof, include/exclude examples, fallback proof. |
| M26 | Distribution hardening claims are tied to actual signing, notarization, Windows runtime, and package evidence. | Package evidence, signing/notarization result, Windows validation plan. |

### Mid-term Non-goals

- Free keyframe editing, dope sheet, graph editor, or advanced timeline.
- AE expression scripting, user scripts, or plugin execution.
- Full mesh deformation, rigging, bone/skin weights, or arbitrary shape editing.
- Complete particle editor comparable to Particular.
- Automatic assembly of unordered asset folders into a complete avatar frame.
- External AI, multimodal, cloud, or ComfyUI-based semantic recognition.
- Direct Figma, PSD, Sketch, C4D, Blender, or unbounded source-project import.
  The Owner-approved AE production bridge is a separate committed production
  pipeline with a bounded export package, compatibility scanner, and bake
  strategy; it is not a general mid-term source-project editor.
- Multi-format intake, conversion, and recommendation; those remain long-term
  unless the Product Owner explicitly changes the roadmap.
- Audio waveform editing, audio replacement, trimming, or volume automation.

## Long-term Direction

Longer term, Auto SVGA may become a multi-format motion workbench. The AE
production bridge has been promoted into its own committed production mainline
and should inform the future multi-format package/IR design. Generative AI,
ComfyUI, or external model modules remain lower priority and require separate
explicit approval; they must stay isolated from the core deterministic
pipeline.

Long-term capabilities:

- Multi-format intake and routing from the startup page
- AE export package intake as the first approved source-authoring bridge,
  bounded by compatibility scanning and bake planning
- Format adapters for SVGA, VAP, Lottie, animated WebP, WebM, APNG, sprite
  sequences, and prepared layered-result packages
- Decode, preview, inspect, validate, optimize, replace, convert, and export
  capability matrix for every supported format
- Format recommendation based on deterministic metadata, platform constraints,
  compatibility, size, and performance
- Conversion only between approved result formats with explicit visual and
  semantic limitations
- Isolated generation assistance only after privacy, cost, offline, and package
  impact approval

Long-term interaction expectations:

- choose a motion format or source type before entering the main app surface
- show supported actions before exposing format-specific operations
- preview conversion loss or degradation before export
- batch-process only with dry-run, output review, rollback, and explicit
  destination selection
