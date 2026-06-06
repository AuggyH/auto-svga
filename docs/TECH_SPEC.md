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
- Fit modes are stored independently for `a`, `b`, and `reference`; first-run default is `original`.
- Fit changes and viewport resizes only recalculate the media frame. They do not rebuild or replay the SVGA player.

UI changes must follow the 10 rules in `AGENTS.md` → UI Design Rules section.
