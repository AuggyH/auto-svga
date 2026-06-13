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

The shared workbench `EmbeddedImageAlphaAnalyzer` boundary may enrich image resources with
`alphaBounds`. This is an explicit host boundary: the adapter passes image
bytes, detected format, and dimensions to the injected analyzer, while the
core contract remains independent of Node, DOM, Canvas, browser, and filesystem
APIs. Analyzer failures become `unknown` metadata and do not abort SVGA parsing.
No concrete PNG alpha decoder is bundled in the current slice.

It is not imported by the CLI, exporter, or Web preview.

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
`src/workbench/specs/`. Its current confirmed baseline is:

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

### Avatar-frame inspection report

`AvatarFrameInspectionReportService` combines the existing inspection service,
SVGA checker, and production preset into a host-neutral structured report:

- asset summary
- specification ID and pass/fail status
- structured specification issues
- calibration notes derived from the preset metadata

The Node command `inspect-avatar-frame <file.svga>` owns local file access and
prints the report as JSON. Existing CLI commands and Web preview behavior are
unchanged.
