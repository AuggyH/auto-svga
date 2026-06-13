# Avatar-frame Production Specification Preset Review

Date: 2026-06-13
Branch: `agent/codex/avatar-frame-production-spec`
Base: `8aba594`
Implementation commit: `5df8831`

## Mainline

- P2 design specification checks.
- Adds a reusable production specification for the current avatar-frame MVP.

## Changed

- Added `avatarFrameProductionSpec` under the shared workbench layer.
- Confirmed limits: `300 x 300`, `24 FPS`, and `3000 ms`.
- Placeholder limits: `500,000 bytes` and `64 resources`.
- Marked both placeholders in `metadata.needsProductCalibration`.
- Added passing and over-300-width integration tests through `inspectWithSpec()`.

## Files

- `src/workbench/specs/avatar-frame-production.ts`
- `src/workbench/specs/index.ts`
- `src/tests/avatar-frame-production-spec.test.ts`
- `docs/TECH_SPEC.md`

## Validation

- Tier: 2, specification preset.
- `npm run build`: passed.
- `node --test dist/tests/avatar-frame-production-spec.test.js`: 3 passed.
- `node --test dist/tests/svga-motion-spec-checker.test.js`: 5 passed.
- `node --test dist/tests/motion-inspection-service.test.js`: 7 passed.
- `git diff --check`: passed.
- Full regression: skipped because exporter, playback, CLI, Web preview, build
  config, dependencies, and cross-cutting runtime flows were not touched.

## Regression

- Adapter, inspection service, and checker implementation: not touched.
- SVGA exporter path and output bytes: not touched.
- Existing CLI flow: not touched.
- Web preview, playback, import, drag-drop, and comparison: not touched.

## Drift

- No new format, checker rule, pixel analysis, conversion, export workbench, or UI.
- Preset is not connected to any existing production flow.

## Dependencies and Client

- No dependency or license change.
- Preset imports only the host-neutral `MotionSpec` type.
- No Node, DOM, Canvas, filesystem, process, or browser API.
- Reusable by CLI, Web, macOS, and Windows hosts without platform adaptation.
- Offline behavior and bundle size are effectively unchanged.

## Risks

- File-size and resource-count limits are placeholders, not approved product policy.
- FPS and duration reflect the current default production configuration; future
  product variants may require versioned presets.

## Next

- Obtain product-approved file-size and resource-count limits, then calibrate
  the existing preset without changing its consumers.
