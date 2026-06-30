# Auto SVGA Product Roadmap

Date: 2026-06-30
Owner reset: P5 product acceptance is deferred. P6 became the active product mainline.
Autonomous reset: Product Owner authorized SVGA Workbench v1 autonomous execution
beyond the prior P6-R1 human-gate/UI-polish loop.
Owner correction: On 2026-07-01, the short-term formal app scope was corrected
to the SVGA preview, inspection, replaceable-element preview, imageKey rename,
and optimization workflow below. This corrected scope supersedes earlier
Workbench v1 feature planning.

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
SVGA output through explicit Overwrite Save or Save As actions.

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

### Short-term Non-goals

- Export acceptance UI or export-review mode
- Sequence-frame repair
- Advanced layer editing
- Timeline, transform, alpha, shape, audio, mask, or frame-structure editing
- Text persistence as direct SVGA-byte editing
- Audio parsing as a required feature
- Broad batch replacement
- Public release, App Store release, auto-update, accounts, telemetry, or cloud
  sync

## Mid-term Direction

The mid-term version extends the short-term product after the short-term scope
is accepted. It may add advanced editing and deeper repair flows, but only after
each capability has explicit product acceptance criteria.

Mid-term capabilities:

- Sequence-frame repair and anti-flicker optimization
- Edit-mode layer operations
- Advanced layer/property editing where SVGA semantics can be preserved
- Batch or folder replacement with mapping review
- Configurable production-spec versions and user-defined spec profiles
- Replaceable-element naming rules with whitelist/blacklist regular
  expressions
- Audio asset parsing and duration display
- Trusted macOS signing and notarization when credentials are available
- Windows packaging plan after runtime and signing validation

Mid-term interaction expectations:

- use Edit mode for advanced layer/property workflows
- compare before/after repair output with clear affected-frame evidence
- review batch findings before applying output changes
- manage production-spec versions without editing repository code
- keep every persisted edit reversible or explicitly Save/Save As gated

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
