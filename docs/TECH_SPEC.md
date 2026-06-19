# Tech Spec

## Architecture

Pipeline: `input/ → plan → preview → report → export → package`

```
src/
  cli.ts                    Entry point, command routing, dynamic imports
  commands/                 CLI command modules
    plan.ts                 MVP 0.1 planning
    preview.ts              Preview rendering (PNG/WebM/MP4/GIF)
    report.ts               Report + svga-map generation
    export.ts               SVGA protobuf export
    export-mvp.ts           MVP export pipeline
    package.ts              Delivery.zip packaging
    acceptance.ts           Accept/reject workflow
    init.ts / validate.ts   Project init/validation
    build.ts                Legacy build (pre-MVP)
  mvp/                      MVP 0.1 core modules
    types.ts                All shared types
    job-loader.ts           Read/validate input config + structure
    motion-planner.ts       Rule-based effect assignment
    template-library.ts     5 semantic templates + expanders
    template-expander.ts    Template → project.json layers
    anchor.ts               Canvas ↔ local coordinate conversion
    generated-assets.ts     Procedural PNG generation
    production-assets.ts    Source optimization pipeline
    image-optimization.ts   Trim transparent pixels, resize
    sweep-mask.ts           Baked sweep compositing
    preview-renderer.ts     Frame-by-frame canvas renderer
    svga-exporter.ts        Real protobuf+zlib SVGA export
    easing.ts               Easing functions
    interpolation.ts        Keyframe interpolation
    report-builder.ts       Report assembly
  core/                     Legacy modules (partially superseded by mvp/)
  exporters/                Exporter interfaces + implementations
  preview/                  Legacy preview modules
  types/                    Type definitions
  utils/                    PNG I/O, hash, fs, zip
  tests/                    Test suite
  workbench/                Isolated future multi-format contracts
    contracts.ts            Host-neutral adapter and workflow interfaces
    capabilities.ts         Audited format capability maturity baselines
    svga/
      format-adapter.ts      SVGA inspection → MotionAssetInfo mapping
      types.ts               Host-neutral SVGA inspection boundary
      node-protobuf-inspector.ts  Node zlib/protobuf inspector implementation

tools/
  svga-player-preview/      Web playback validation tool
    index.html / main.js / styles.css / server.mjs

jobs/                       Local runtime job workspace, gitignored
  <job-dir>/                Local input/output workspace, not committed

fixtures/                   Mock assets for tests (small, public-safe, no real designs)
examples/                   Example configs and mock fixtures (outputs gitignored)

proto/
  svga.proto                SVGA 2.x MovieEntity protobuf schema

schemas/
  asset.config.schema.json  Input config validation
  project.schema.json       Intermediate project protocol

docs/                       Documentation
```

## Key Data Flow

1. `input/config.json` + `input/structure.json` → `job-loader` validates
2. `motion-planner` assigns effects to parts → `motion-plan.json`
3. `template-expander` expands effects → `project.json` (26 layers for 002)
4. `production-assets` scales 600×600 → 300×300, trims transparent pixels
5. `generated-assets` creates glow/sweep PNGs
6. `sweep-mask` bakes per-frame masked sweep → `sweep_baked/*.png`
7. `preview-renderer` renders 72 PNG frames + WebM + MP4 + GIF
8. `svga-exporter` encodes protobuf + zlib → `.svga`
9. `package` → `delivery.zip`

## Web Artifact Discovery

`GET /api/latest-artifact` returns:

- `latestWithSvga`: newest artifact group containing a real `.svga`
- `latestAny`: newest group regardless of completeness
- `artifacts`: all discovered groups sorted by key-file modification time
- `warnings`: scan-level fallback information

Groups are built from `jobs/*/output`, `examples/*/output`, `exports`, and
`preview`; optional generated directories contribute reference files without
changing group identity. The UI loads SVGA, reference media, and report from
one group. Manual selections remain authoritative until an explicit rescan.

## Production Canvas

Default: 300×300. Source scaling handled by `production-assets.ts`:
- `sourceCanvas` in config/structure defines original dimensions
- Scale factor = production / source
- bbox, anchor, safeArea all scaled proportionally
- All PNG assets trimmed of transparent borders after scaling

## Memory Budget

- Hard limit: 8MB decoded image memory
- Recommended: ≤6.5MB
- Current 002 job: 2.23MB — well within budget

## UI Design System

The Web preview page follows the design system defined in `DESIGN.md` and `docs/decisions/ADR-002-apple-design-translation.md`.

Key references:
- `DESIGN.md` — color tokens, typography, spacing, motion, accessibility, Do/Don't
- `ADR-002` — DESIGN-apple.md → Auto SVGA translation map (28 adopted, 14 adapted, 20 excluded)
- `tools/svga-player-preview/styles.css` — CSS custom properties, motion presets, unified dropdown menu, responsive breakpoints
- `tools/svga-player-preview/server.mjs` — `/api/latest-artifact` endpoint for auto-loading latest export outputs

### Preview layout state

- The application shell is fixed to `100dvh`; only information, asset, and log content areas may scroll.
- Local Compare and Export Review always use two equal `minmax(0, 1fr)` columns, including narrow widths.
- Diagnostics use one mutually exclusive side-panel state: `null`, `info`, or `logs`.
- Side panels are overlays and must not re-parent or rebuild SVGA player canvases.
- Floating layers use one explicit order: toolbar, side panels, dropdowns, settings, asset lightbox, toast.
- Dropdowns are moved to `#floatingRoot` and positioned with viewport coordinates. Preview cards never own dropdown stacking or clipping.
- Settings and asset lightbox are modal layers above diagnostics. Escape closes only the highest visible layer.
- Side panels, modals, lightboxes, and dropdowns support outside-click dismissal without treating internal scrolling, filters, or resize handles as outside interaction.
- Temporary side panels ignore persistent toolbar actions and rescan actions; modal/lightbox backdrops intercept the click and do not activate controls underneath.
- Floating surfaces default to a nearly solid background with blur, hairline border, and shadow. The persisted Reduce Blur setting switches them to solid fills and disables backdrop blur.
- Fit modes are stored independently for `a`, `b`, and `reference`; first-run default is `original`.
- Fit changes and viewport resizes only recalculate the media frame. They do not rebuild or replay the SVGA player.
- The toolbar remains a three-column grid through the 900px breakpoint so the mode selector keeps its centered column.
- Preview stages and media frames use centered grid alignment at narrow widths.
- The synchronized footer keeps equal left/right file summaries. At narrow widths optional metadata and button labels hide before either summary disappears.
- Buttons that combine an icon and label expose a title/accessible name and collapse to icon-only below the compact breakpoint.

UI changes must follow the 10 rules in `AGENTS.md` → UI Design Rules section.

## Future workbench boundary

The proposed multi-format workbench is documented in
`docs/multiformat-workbench-architecture.md`. Its contracts do not currently
participate in the production pipeline.

### Inspection primitives before product features

Inspection is a layered foundation, not a collection of page-specific checks:

1. adapters parse source bytes into normalized `MotionAssetInfo`;
2. resource metadata adds dimensions, alpha bounds, roles, and future decoded
   memory estimates;
3. spec profiles and role-aware policies turn facts into deterministic issues;
4. stable report contracts expose those facts and issues to any host.

Motion Asset Audit, performance diagnosis, format recommendation, optimization
suggestions, export preflight, batch inspection, legacy cleanup, and
multi-format comparison must compose these layers. UI components may present
or filter reports but must not duplicate parsing, measurement, policy, or
recommendation logic.

Inspection and recommendation evidence must remain local, deterministic, and
explainable. Approved sources include parsed metadata, dimensions, alpha
statistics, decoded memory estimates, frame/FPS/duration data, resource counts,
file size, resource roles, spec thresholds, and the format capability matrix.
AI or external model inference is not an inspection primitive.

Key boundaries:

- format parsing does not own playback
- playback sessions do not own product synchronization
- exporters return bytes; hosts choose filesystem destinations
- Node process/filesystem and browser DOM/canvas APIs stay outside core contracts
- frame sequences are a raster conversion bridge, not a universal semantic model
- new dependencies require license, maintenance, bundle-size, and redistribution review

### SVGA inspection adapter

`SvgaFormatAdapter` accepts a `MotionAssetSource` and injected
`SvgaBinaryInspector`. It does not accept filesystem paths and does not import
Node or browser APIs. `NodeProtobufSvgaInspector` is the current host
implementation and owns:

- zlib inflation
- `proto/svga.proto` loading
- protobuf decoding

The adapter maps:

- Movie params → dimensions and timing
- image map → resources keyed by `imageKey`
- SpriteEntity list → layers with resource references
- version, image/sprite/audio counts, matte keys → metadata

The shared workbench `EmbeddedImageAlphaAnalyzer` boundary may enrich image
resources with `alphaBounds`. This is an explicit host boundary: the adapter
passes image bytes, detected format, and dimensions to the injected analyzer,
while the core contract remains independent of Node, DOM, Canvas, browser, and
filesystem APIs. Analyzer failures become `unknown` metadata and do not abort
SVGA parsing.

The avatar-frame host composition injects `FastPngAlphaAnalyzer`. It reads
dimensions directly from PNG IHDR before decode, enforces compressed input,
width, height, pixel-count, and decoded-memory limits, then maps RGBA,
grayscale-alpha, indexed transparency, opaque, and fully transparent resources
into the shared contract. The checker and Web UI do not decode PNG bytes.

The host composition is used by the additive avatar-frame inspection command
and the Web report service. It is not used by the exporter or player.

### Inspection application service

`MotionAssetInspectionService` is a host-neutral application boundary that
delegates inspection to one injected `FormatAdapter`. It accepts the existing
`MotionAssetSource`, so memory, filesystem, browser, or desktop hosts own byte
access through `source.read()` without adding those APIs to the service.

The first integration uses `SvgaFormatAdapter`. The service does not select
formats, play media, write files, or participate in the CLI, exporter, or Web
preview.

The existing `inspect()` method remains unchanged. Callers that also provide a
`MotionSpec` and `MotionSpecChecker` may use `inspectWithSpec()` to receive the
parsed asset and `MotionSpecCheckReport` together. Specification failures do
not remove or mutate a successfully parsed asset.

### Minimal SVGA specification checker

`SvgaMotionSpecChecker` consumes `MotionAssetInfo` and `MotionSpec` without
reading or decoding source bytes. The current deterministic checks are:

- file size
- canvas dimensions
- embedded image resource dimensions
- embedded image transparent padding when `alphaBounds.status` is `known`
- duration
- FPS
- resource count

Each exceeded or unavailable required value produces a structured issue with a
stable code, field path, and actual/maximum details. Exact limit values pass.
The SVGA adapter reads PNG `IHDR` dimensions from embedded image bytes without
DOM, Canvas, or filesystem access. Avatar-frame resources should remain within
`300 x 300`. Unknown image dimensions produce a warning and do not make the
report fail by themselves. Effective-pixel analysis beyond supplied alpha
bounds, sequence consistency, texture memory, and device performance remain
outside this slice.
Unknown or unsupported alpha bounds produce a non-blocking warning. Fully
transparent resources are errors. The checker never decodes image bytes.

### Avatar-frame production specification preset

`avatarFrameProductionSpec` is a host-neutral `MotionSpec` shared from
`src/workbench/specs/`. It is attached to the `production_target` profile,
which is the default and only profile approved for new deliveries. Its current
confirmed baseline is:

- maximum canvas: `300 x 300`
- maximum FPS: `24`
- maximum duration: `3000 ms`

File size (`512 KiB`) and resource count (`32`) are provisional recommendations
from two unique 300x300 repository outputs. Both remain listed in
`metadata.needsProductCalibration`; callers must not treat them as final
product policy until a larger delivery sample confirms the limits. See
`docs/avatar-frame-spec-calibration.md`.

The transparent-padding limit is provisionally `50%` and is also marked for
product calibration. It only applies when a host supplies known alpha-bound
metadata; unavailable analysis remains a warning rather than a failed report.

`legacy_compatibility` is a separate non-production profile descriptor for
future historical-catalog analysis. It has no thresholds and is not selected
by the default inspection flow. The 21-sample historical distribution does not
relax `production_target`. See `docs/avatar-frame-spec-profiles.md`.

SVGA embedded image resources may also expose a conservative
`MotionResourceInfo.role`: `static_image`, `sequence_frame`,
`baked_sweep_frame`, `mask_or_matte`, or `unknown`. The adapter derives this
from embedded image keys, dimensions, sprite references, and `matteKey`.
`metadata.roleEvidence` records the reason. Resource roles are metadata only;
the current transparent-padding threshold and pass/fail behavior remain
unchanged.

### Role-aware transparent-padding policy

`evaluateRoleAwareTransparentPadding()` is a host-neutral advisory layer over
existing resource roles and alpha-bound metadata. It does not decode images,
change raw `alphaBounds`, or participate in the production specification gate.

Static images retain the provisional `50%` threshold as an explicit diagnostic.
Sequence frames are evaluated at group level when deterministic grouping is
available; an individual padded sequence frame never becomes a policy failure.
Baked sweep frames remain advisory. Mask or matte padding is informational
unless the resource is fully transparent. Unknown roles remain `unknown` and
require classification review.

The additive report summary records role, resource or group identity, padding
ratio, severity, policy code, evidence references, uncertainty, and the
recommended review. Existing specification issues and `passed` remain
unchanged while this role-aware policy is calibrated.
The current 21-sample evidence and coverage limits are recorded in
`docs/role-aware-transparent-padding-calibration.md`.

### Decoded memory estimation

`estimateDecodedMemory()` is a host-neutral inspection primitive. It consumes
normalized resource dimensions and estimates RGBA8 decoded and texture memory
with `width x height x 4 bytes`.

Its additive summary includes per-resource decoded/texture bytes, the complete
resource total, resources sorted by decoded bytes, the sequence-frame subtotal,
unknown resource IDs, and an advisory memory risk level. Missing, invalid, or
unsafe dimensions produce `null` totals and `unknown` risk rather than a guessed
value. Known resources remain available for largest-resource ranking.

Advisory risk bands are low through `4 MiB`, medium above `4 MiB` through
`16 MiB`, and high above `16 MiB`. These bands are not a production gate and do
not change any `MotionSpec` threshold or pass/fail result. The estimate covers
resource pixel allocation only; it does not claim player peak memory, duplicate
GPU uploads, frame buffers, decoder workspaces, or platform overhead.

### Role-aware memory diagnostics

`diagnoseMemoryByRole()` consumes the raw `MotionAssetMemoryEstimation` result
and groups it by `static_image`, `sequence_frame`, `baked_sweep_frame`,
`mask_or_matte`, and `unknown`. Each role reports resource count, known and
unknown memory counts, decoded/texture totals, and known resources ranked by
decoded bytes. A missing role is conservatively grouped as `unknown`.

If any resource in a role lacks a usable memory estimate, that role's complete
decoded and texture totals are `null`; known resources remain ranked for
diagnostic use. The sequence-frame role also exposes a direct subtotal for
future group-level residency analysis. These diagnostics are advisory metadata
only and do not change specification thresholds, profiles, transparent-padding
policy, or pass/fail behavior.

### Advisory sequence residency model

`diagnoseSequenceResidency()` consumes normalized resources and the raw memory
estimate. It only considers `sequence_frame` and `baked_sweep_frame` roles.
Groups require explicit `metadata.sequenceGroupId`, or at least three resources
with the same role and dimensions plus a continuous numeric name suffix.
Resources without enough grouping evidence remain ungrouped.

The diagnostic reports group counts and frame counts, total sequence decoded
bytes, largest groups, possible residency models, advisory risk, evidence,
uncertainty, and ungrouped resource IDs. Possible models are
`all_frames_resident`, `group_resident`, `windowed_or_streaming`,
`sprite_sheet_candidate`, and `unknown`. They describe plausible review paths,
not observed player behavior or measured peak memory. Repeated dimensions make
sprite-sheet packing a candidate; groups with at least eight frames make a
windowed or streaming review worth considering.

Missing dimensions make sequence totals and risk `unknown`. Explicit group
metadata can lower grouping uncertainty; inferred numeric groups remain medium
uncertainty, while missing groups or incomplete memory remain high uncertainty.
The advisory does not change raw memory facts, specification profiles,
production gates, transparent-padding policy, or pass/fail behavior.
Advisory risk is high above `16 MiB`, or above `4 MiB` when sequence resources
also represent at least half of known decoded resource memory. A smaller
sequence-dominant asset is medium risk rather than high risk.

### Deterministic sequence-frame evidence

`collectSequenceFrameEvidence()` inspects only `sequence_frame` and
`baked_sweep_frame` resources. It reports exact duplicate hash groups, fully
transparent frames, provisional near-empty frames, repeated alpha bounds,
repeated dimensions, evidence availability, confidence, and uncertainty.

Duplicate evidence requires a stable `ResourceContentHash`. The current Node
inspection host provides SHA-256 over embedded encoded image bytes through the
`EmbeddedResourceHasher` boundary. Equal hashes therefore prove byte-identical
embedded resources; they do not detect visually identical images encoded with
different compression. Missing hashes produce `insufficient_evidence` or
`partial`, never a guessed duplicate.

Fully transparent evidence comes directly from `alphaBounds.status`.
Near-empty is advisory and provisional at a transparent-padding ratio of
`0.99`; unknown or unsupported alpha bounds are never classified as empty.
Repeated alpha bounds use exact status and rectangle fields. Repeated dimensions
only prove equal dimensions and do not imply equal content. These evidence
fields do not change any production gate, profile, transparent-padding policy,
or specification pass/fail result.

### Preliminary Motion Asset Audit summary

`createMotionAssetAuditSummary()` is a host-neutral composition helper. It
consumes existing specification issues, decoded-memory estimates, sequence
residency diagnostics, and deterministic sequence-frame evidence. It does not
parse files or recompute those primitives.

The additive summary reports an audit status, primary findings, optimization
opportunities, risk signals, evidence references, and explicit uncertainty.
Every finding and opportunity must reference an existing issue, metric,
resource, hash group, or sequence group. Duplicate-frame and empty-frame
opportunities require deterministic evidence. FPS and duration review is only
suggested when the active specification already reports those violations.

`pass`, `advisory`, `needs_review`, and `unknown` are report-level summaries,
not production gates. Insufficient hashes, unknown dimensions, or uncertain
sequence grouping remain explicit rather than being guessed. The summary does
not change specification pass/fail, profile thresholds, transparent-padding
policy, raw memory facts, or sequence residency diagnostics.

### Motion Asset Audit presentation contract

`createMotionAssetAuditPresentation()` derives a stable, host-neutral,
read-only presentation model from `MotionAssetAuditSummary`. It does not parse
assets, inspect resources, recompute metrics, or change audit decisions.

The contract exposes stable status, title, description, and uncertainty keys;
categorized finding and opportunity cards; and the original evidence
references. Finding descriptions preserve the audit message. Every opportunity
uses `actionType: review_only`; the contract cannot request conversion,
optimization, repair, or any other mutation.

This layer is additive to the avatar-frame inspection report and leaves the raw
audit summary intact. Web and desktop clients may localize the stable keys, but
must not recreate audit rules in presentation components.

### Motion Asset Audit localization-key catalog

`motion-asset-audit-localization-keys.ts` is the host-neutral key registry for
the presentation contract. It owns status, severity, summary, finding,
opportunity, uncertainty, category, and `review_only` action keys. Dynamic
finding and opportunity builders keep new issue codes deterministic without
moving audit decisions into a client.

The catalog includes neutral English fallback labels for current keys. Clients
may replace those labels with local translations while preserving the keys and
the original report description. Unknown future codes fall back to the report
message supplied by the caller. The catalog does not parse assets, calculate
metrics, change severity, or introduce executable actions.

`motion-asset-audit-localization-bundle.ts` is the shared handoff for Web and
desktop clients. It provides version-independent locale bundles for `en` and
`zh-CN`, identifies English as the default locale, and resolves labels in this
order: requested locale, default English label, caller-provided report message,
then the stable key. The resolver is host-neutral and never derives audit
status, severity, findings, opportunities, or evidence.

### Motion Asset Audit report serialization v1

Avatar-frame inspection reports include `contractVersion: 1`. The versioned
contract covers profile and specification results, decoded and role-aware
memory summaries, sequence residency, deterministic frame evidence, audit
summary, read-only presentation data, and localization-key references.

`validateMotionAssetAuditReportV1()`, `parseMotionAssetAuditReportV1()`, and
`serializeMotionAssetAuditReportV1()` provide a host-neutral compatibility
boundary. The checked-in representative fixture freezes stable field presence
and types without snapshotting dynamic metrics, environment paths, timestamps,
or ordering. Opportunity actions are validated as `review_only`.

Version negotiation is strict: the current version is `1`, and the supported
version set is `[1]`. Missing, malformed, or unknown major versions are rejected
before v1 parsing; clients must not silently reinterpret them as v1. Clients may
show an unsupported-version state without attempting normal report rendering.

V1 may gain optional additive fields only when existing required fields, field
types, and stable enum meanings remain unchanged. Required fields cannot be
removed or retyped, and v1 semantics cannot be silently redefined. A future
breaking change must increment the contract version. V1-to-v2 migration must be
an explicit, separately tested operation and must never rewrite a user report
implicitly.

### Avatar-frame inspection report

`AvatarFrameInspectionReportService` combines the existing inspection service,
SVGA checker, and production preset into a host-neutral structured report:

- asset summary
- specification ID, profile ID, profile label, profile purpose, and pass/fail
  status
- structured specification issues
- calibration notes derived from the preset metadata
- additive decoded-memory estimation summary
- additive role-aware memory diagnostics
- additive advisory sequence residency diagnostics
- additive deterministic sequence-frame evidence
- additive preliminary Motion Asset Audit summary
- additive read-only Motion Asset Audit presentation contract

The Node command `inspect-avatar-frame <file.svga>` owns local file access and
prints the report as JSON. Existing CLI commands and Web preview behavior are
unchanged.
