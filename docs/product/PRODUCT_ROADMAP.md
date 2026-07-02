# Auto SVGA Product Roadmap

Date: 2026-06-30
Owner reset: P5 product acceptance is deferred. P6 became the active product mainline.
Autonomous reset: Product Owner authorized SVGA Workbench v1 autonomous execution
beyond the prior P6-R1 human-gate/UI-polish loop.
Owner correction: On 2026-07-01, the short-term formal app scope was corrected
to the SVGA preview, inspection, replaceable-element preview, imageKey rename,
recent-file reopening, and optimization workflow below. This corrected scope
supersedes earlier Workbench v1 feature planning.

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

This file is also the active high-level PRD for short-term, mid-term, and
long-term product planning. Related implementation plans remain in their
phase-specific documents; this roadmap owns the cross-phase product intent,
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

### Required Capabilities

| ID | Requirement | Product detail |
| --- | --- | --- |
| S1 | Open SVGA locally | Open from the top-left file button, drag into the window, or macOS menu entry. |
| S2 | Play SVGA and report abnormal states | Playback failures, parse failures, loading failures, and invalid files must show clear feedback. |
| S3 | Show basic file information | File size, estimated memory usage, canvas size, FPS, and asset count. |
| S4 | Show production-spec comparison inside Overview | Basic information must show current file values next to production-spec requirements; do not create a separate production-spec module. |
| S5 | Show all asset information | Images, sequence/video-like frame assets, audio group, and replaceable elements. Display thumbnail, file/key name, image dimensions when available, audio duration when available, and file size. |
| S6 | Show image thumbnails | Images show their image thumbnail. Sequence/frame groups show the existing four-grid thumbnail from the first four frames. Audio uses a fixed music icon when audio parsing is later supported. |
| S7 | Identify replaceable elements by naming rule | In the short term, exclude automatic names such as `img_000` / `img_001`; non-automatic designer names are treated as replaceable imageKeys. Future versions may add configurable whitelist/blacklist regular expressions. |
| S8 | Detect optimization opportunities | Detect file-size and memory-usage optimization opportunities, briefly explain each item, and estimate impact. |
| S9 | Run real optimization | Produce optimized SVGA bytes, not a report-only recommendation. Allowed methods include image compression with quality controls, removing unreferenced resources, transparent-bound trimming, sequence-frame processing, FPS adjustment, and canvas adjustment when production specs remain satisfied. |
| S10 | Enter optimization comparison flow | Clicking optimization starts a comparison flow with before/after preview cards and an optimization-result card showing concrete items and effects. |
| S11 | Rename imageKey | From the asset panel, selecting an image and using the context menu Rename or `Cmd+R` enters rename mode. Enter confirms. All related references must update and the app must produce updated SVGA bytes. |
| S12 | Preview replaceable images | In Preview mode, replaceable image elements can be replaced and reset with realtime playback preview. This does not switch to Edit mode. |
| S13 | Preview replaceable text | In Preview mode, replaceable text elements can be edited through a modal and applied as runtime dynamic text preview. This simulates terminal playback behavior and does not imply direct SVGA-byte text editing. |
| S14 | Save edited output | Overwrite Save and Save As are both formal product actions. All persisted byte-edit operations, including imageKey rename, image replacement output, and optimization output, may use either action. |
| S15 | Keep audio deferred | Audio parsing and duration are not required for the short-term version. If no audio is detected or audio parsing is not implemented, the audio group shows `当前文件暂无音频资产`. |
| S16 | Show recent SVGA files | The launch page shows up to five low-emphasis recent SVGA records below Open/Drag actions, and `File > Recent` shows up to ten records plus a clear-history action. Recent records must open the same local-file flow, hide full local paths by default, and fail gracefully when a file is missing or inaccessible. |

### Short-term Acceptance Matrix

Each short-term requirement must have owner-visible behavior and current-head
evidence before the first distributable version can be called release-candidate
ready.

| ID | Accept when | Required evidence |
| --- | --- | --- |
| S1 | File chooser, drag-and-drop, and macOS menu opening all load the same local SVGA bytes without exposing arbitrary renderer filesystem access. | Open-flow proof, drag/drop proof, menu-entry proof, path-redaction check. |
| S2 | Invalid files, parse failures, loading failures, and playback failures show a visible user message and recover when a valid file is opened. | Invalid-file proof, recovery proof, player lifecycle cleanup proof. |
| S3 | Overview shows file size, estimated decoded memory, canvas, FPS, and asset count for a parsed SVGA. | Inspection report and rendered Overview proof. |
| S4 | Overview shows actual file values beside active production-spec limits and statuses; no separate production-spec module is exposed. | Spec comparison proof with actual/limit pairs and current spec profile id. |
| S5 | Asset information covers image resources, sequence/frame groups, audio group state, and replaceable elements without duplicating every image under replaceable elements. | Asset-list proof with resource counts and grouping. |
| S6 | Image thumbnails, four-frame sequence thumbnails, and audio empty/icon states render without layout shift. | Rendered thumbnail proof for image, sequence, and no-audio states. |
| S7 | Replaceable image elements are designer-named imageKeys after short-term automatic-name exclusion. | Replaceable-key classification report with included and excluded examples. |
| S8 | Optimization tab lists file-size and memory opportunities with brief reason and estimated impact; risky items are labelled as review-only. | Optimization-candidate report and UI proof. |
| S9 | Running an enabled optimization produces new SVGA bytes and a report binding before/after metrics, changed items, safety checks, and output hash. | Optimized output, optimization report, inflate/decode proof, reopen proof. |
| S10 | Optimization action enters the specialized before/after comparison flow and keeps save actions available only when optimized output exists. | Before/after comparison proof and dirty/save-state proof. |
| S11 | imageKey rename updates every related `imageKey` and `matteKey` reference, leaves no dangling reference, and produces updated SVGA bytes. | Rename report, reference-closure proof, round-trip decode proof, reopen proof. |
| S12 | Replaceable image preview can replace and reset one designer-named imageKey in Preview mode without switching to Edit mode. | Runtime replacement proof, reset proof, mode-state proof. |
| S13 | Replaceable text preview applies supported runtime dynamic text fields and reset in Preview mode without persisting text into SVGA bytes. | Runtime text proof, reset proof, byte-immutability proof. |
| S14 | Overwrite Save and Save As are separate explicit buttons; both stay disabled until a persisted output exists and both revalidate output after writing. | Dirty-state proof, overwrite proof, Save As proof, reopen validation proof. |
| S15 | Audio group does not block release; no-audio and unsupported-audio states are visible and truthful. | Audio-empty-state proof and known-limitation entry. |
| S16 | Launch recent rows and `File > Recent` use real recent-file state, preserve Open/Drag as higher-priority actions, avoid full-path exposure by default, clear history on request, and recover gracefully from missing files. | Recent-state persistence proof, launch five-row proof, menu ten-row proof, path-redaction proof, clear-history proof, missing-file recovery proof. |

### Replaceable Element Definition

SVGA runtime replacement is keyed by `imageKey`. Official SVGA player
documentation describes dynamic image and text replacement as operations on a
designer-provided `ImageKey`; the iOS/Android docs describe the imageKey as
coming from the exported PNG filename. For product language, Auto SVGA calls
only designer-intended, manually named keys "replaceable elements"; automatic
export keys such as `img_000` remain ordinary image assets so the replaceable
elements tab does not repeat every image.

Runtime replacement constraints:

- Image replacement is addressed by imageKey. Short-term replacement images
  should match the original resource dimensions unless the app can show a
  clear fit/crop warning and preserve playback layout.
- Dynamic text replacement is runtime preview only in the short term. Supported
  fields are limited to the official player-supported dynamic text fields such
  as text, family, size, color, and offset.
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
| Preview mode | Center canvas + right panel only | Default mode. Open, play, inspect, optimize, compare, and preview replaceable elements. |
| Edit mode | Left layer panel + center canvas + right operation panel | Reserved for mid-term and long-term advanced editing. Short-term right panel stays empty and must not expose inactive controls. |

Mode switching lives at the app top-left. Triggering lightweight replacement
actions in Preview mode does not switch to Edit mode.

### Launch Page

Initial app launch shows a startup page rather than the full main interface.
The startup page is primarily one preview card prompting the user to open or
drag in a file. It also prepares for future multi-format routing and gives the
main app surface time to load without appearing blocked.

Recently opened files are part of the short-term formal product scope. The
launch page shows up to five recent SVGA files below the primary Open and Drag
In actions. Recent rows must stay visually secondary, must not expose full
local paths by default, and must use the same loading, validation, error, and
recovery flow as files opened from the file chooser or drag-and-drop.

The macOS File menu includes a `Recent` submenu with up to ten recent SVGA
files and a clear-history action. Clearing recent history removes records from
the launch page and menu without touching source files.

### Main Layout

The main app uses a left / center / right structure, but each mode controls
which regions are visible.

Preview mode:

- center: playback canvas and playback controls
- right: three tabs
  - Overview: basic file information, production-spec comparison, and asset
    information
  - Optimization: file-size and memory optimization opportunities and action
    entry
  - Replaceable Elements: image and text replaceable elements, grouped and
    sorted by key

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
| Launch | Startup preview card with open/drag prompt | Open or drag file -> Loading |
| Loading | Main surface skeleton or loading feedback | Success -> Preview ready; failure -> Load failed |
| Load failed | Error feedback with open/drag recovery | Open valid file -> Loading |
| Preview ready | Preview mode canvas and right tabs | Play, inspect, optimize, compare, replace, rename, switch mode |
| Playback abnormal | Canvas remains visible when possible plus clear failure feedback | Replay or open valid file -> Preview ready |
| Replace preview dirty | Preview mode remains active; runtime replacement and Reset are available | Reset -> Preview ready; persisted image output, if exposed, enables save actions |
| Rename dirty | imageKey rename has updated bytes and top-right save actions are enabled | Overwrite or Save As -> Save validating |
| Optimization candidates | Optimization tab shows opportunities and action button | Run optimization -> Optimization comparing |
| Optimization comparing | Before/after previews, optimization-result card, save actions if output exists | Save -> Save validating; cancel/back -> Preview ready |
| General comparing | A info left, two previews center, B info right | Exit compare -> Preview ready |
| Save validating | Output is written only after explicit button click and round-trip checks | Success -> Save complete; failure -> Save failed |
| Save complete | Saved file feedback with updated clean/dirty state | Continue preview or open another file |
| Save failed | Failure reason and retry/Save As recovery | Retry save or return to dirty state |
| Edit reserved | Full left/center/right layout, layer list visible, right operation area empty | Switch back -> Preview ready |
| Recent file missing | Launch or menu recent entry reports a missing/inaccessible file without stale metadata | Open another file or clear recent history -> Launch or Loading |

No short-term state may expose export acceptance, sequence repair, advanced
layer editing, inactive feature placeholders, or a separate production-spec
module.

### Replaceable Elements Tab

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
- show initial text when available
- provide Edit and Reset actions
- Edit opens a modal for text content and supported runtime text style fields
  such as family, size, color, and offset, subject to SVGA player support

### Top Bar And macOS Chrome

- The top-left action is the file chooser.
- The File menu and launch page include recent-file reopening as secondary
  actions.
- The compare-mode entry sits next to the file chooser and also has a macOS menu
  entry.
- The top-right actions are Overwrite Save and Save As. They are disabled until
  an operation creates unsaved output.
- Settings, logs, and dark-mode controls move to the macOS menu bar.
- The app window uses a custom title-bar style: the macOS red/yellow/green
  window controls share the same horizontal row as the file and save controls.
- The old top-center mode switcher for local preview / export acceptance is
  removed or hidden in the short-term version.

### Comparison Mode

General comparison mode focuses only on file and canvas comparison:

- left: A file basic information and asset information
- center: two animation previews
- right: B file basic information and asset information

Optimization comparison is a specialized comparison flow:

- sidebars collapse for the before/after preview
- the right-side optimization card shows concrete optimization items and effects
- Overwrite Save and Save As remain available from the top-right when optimized
  output exists

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

Overview must show both current file value and requirement value for every
available field. Missing decoded values should show an unknown or unavailable
state instead of passing silently.

Memory estimation:

- Estimated decoded resource memory is `width * height * 4` for image resources
  with known dimensions.
- Total decoded memory is unknown when any required resource dimension is
  unavailable.
- Current advisory levels are low at <= 4 MiB, medium above 4 MiB, and high
  above 16 MiB.
- The product copy must call this an estimate, not measured runtime memory.

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
- Overwrite Save is allowed only after the user explicitly chooses it.
- Save As is always available for persisted optimization output.
- Both save paths require inflate/decode validation and reopen proof for the
  saved bytes.
- The optimization result card must show what changed, before/after file size
  where available, estimated memory impact where available, and risky/skipped
  candidates.

### Short-term Verification Sample Matrix

Short-term validation should include at least these sample classes. Synthetic
fixtures are acceptable when real production assets cannot be committed.

| Sample class | Required coverage |
| --- | --- |
| Valid ordinary SVGA | Open, play, inspect, save-disabled clean state. |
| Invalid or non-SVGA file | Error message, no stale metadata, recovery by opening a valid file. |
| SVGA with only automatic imageKeys | No replaceable image elements shown beyond ordinary image assets. |
| SVGA with designer-named imageKeys | Replaceable image list, runtime image replacement, reset, rename path. |
| SVGA with runtime text keys | Text edit modal, runtime preview, reset, byte-immutability. |
| SVGA with sequence/frame resources | Four-frame thumbnail, sequence grouping, optimization findings. |
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
- Timeline, transform, alpha, shape, audio, mask, or frame-structure editing
- Text persistence as direct SVGA-byte editing
- Audio parsing as a required feature
- Broad batch replacement
- Advanced recent-file privacy modes beyond path-redacted display and
  clear-history control
- Public release, App Store release, auto-update, accounts, telemetry, or cloud
  sync

## Mid-term Direction

The mid-term version turns Auto SVGA from a preview and inspection tool into a
template-based SVGA motion editing tool. It still must not become a small,
low-end After Effects clone. Users edit by selecting layers, applying bounded
motion/effect templates, adjusting recommended parameter ranges, choosing
preset easing curves, and compiling the result back into a real SVGA file.

Mid-term work starts only after the short-term scope is accepted. Every
capability below needs current-head product evidence before it can be called
accepted.

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
| M7 | Compile edited SVGA and return to Preview mode | After editing, the app can compile edits into real SVGA bytes, switch to Preview mode, play the edited result, and run short-term Overview, asset, diagnostic, optimization, save, and comparison functions. |
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
  short-term Overview, assets, diagnostics, optimization, comparison, and save
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
- Direct Figma, PSD, Sketch, After Effects, C4D, or Blender project import.
- Multi-format intake, conversion, and recommendation; those remain long-term
  unless the Product Owner explicitly changes the roadmap.
- Audio waveform editing, audio replacement, trimming, or volume automation.

## Long-term Direction

Longer term, Auto SVGA may become a multi-format motion workbench. Generative
AI, ComfyUI, or external model modules require separate explicit approval and
must stay isolated from the core deterministic pipeline.

Long-term capabilities:

- Multi-format intake and routing from the startup page
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
