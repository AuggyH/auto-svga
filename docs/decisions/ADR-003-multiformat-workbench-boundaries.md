# ADR-003: Multi-format Workbench Boundaries

Date: 2026-06-13

## Status

Accepted as an architecture boundary. Runtime migration has not started.

## Context

The repository has a stable avatar-frame SVGA pipeline and a Web validation
tool. Future work may inspect, play, compare, validate, recommend, or convert
additional motion formats. Extending the current SVGA-specific command and UI
branches directly would couple product workflows to individual libraries and
make a future desktop host harder to build.

## Decision

1. Keep the current avatar-frame `project.json` and SVGA runtime unchanged.
2. Add host-neutral contracts under `src/workbench/`.
3. Separate parsing (`FormatAdapter`) from playback (`PlaybackAdapter`).
4. Represent common inspection data with `MotionAssetInfo`; never fabricate
   semantic layers for flattened formats.
5. Use `FrameSequenceIntermediate` only for rasterized conversion.
6. Keep specification checks and runtime performance checks distinct.
7. Require structured issues, progress, cancellation, and explicit resource disposal.
8. Keep Node, DOM, Canvas, filesystem, process, and desktop framework APIs in
   host adapters.
9. Add dependencies only through a format-specific task with license,
   maintenance, bundle-size, and redistribution review.
10. Preserve `avatar_frame` as the only current production asset type.

## Consequences

- New format work can be added without changing existing SVGA output bytes.
- Some adapters will expose fewer common fields; the UI must handle honest
  absence instead of format-shaped placeholders.
- Raster conversion cannot preserve vector or replaceable semantics.
- The first runtime migration should wrap SVGA inspection before adding a new format.
- This adds a small amount of type surface now to avoid larger UI and host coupling later.

## Rejected alternatives

### Expand the existing `Exporter` interface

Rejected because it accepts `AvatarFrameProject` and only models file export.
It does not cover inspection, playback, checks, recommendations, cancellation,
or host-neutral byte sources.

### Make the Web preview page the format integration layer

Rejected because it would keep parsing, playback, UI state, and browser globals
in one large module and would not transfer cleanly to a desktop client.

### Adopt a universal editable motion document now

Rejected because SVGA, Lottie, VAP, and flattened raster/video formats do not
share lossless semantics. A universal editor is outside the avatar-frame MVP.
