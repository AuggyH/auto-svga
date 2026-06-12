# SVGA Inspection Service Review

Date: 2026-06-13
Branch: `agent/codex/svga-inspection-service`
Base: `71a7821`
Implementation commit: `25c9a8c`

## Mainline

- P1 mainline infrastructure.
- Connects the existing SVGA adapter to a non-UI application boundary.

## Changed

- Added `MotionAssetInspectionService`.
- Reused `FormatAdapter`, `MotionAssetSource`, and `MotionAssetInfo` unchanged.
- Added memory, host-provided file source, context forwarding, and parity tests.
- Documented the host boundary in the technical specification.

## Files

- `src/workbench/inspection-service.ts`
- `src/tests/motion-inspection-service.test.ts`
- `docs/TECH_SPEC.md`

## Validation

- Tier: 2, adapter/application service.
- `npm run build`: passed.
- `node --test dist/tests/motion-inspection-service.test.js`: 3 passed.
- `node --test dist/tests/svga-format-adapter.test.js`: 4 passed.
- `git diff --check`: passed.
- Full regression: skipped because exporter, playback, CLI, build config, and
  cross-cutting runtime flows were not touched.

## Regression

- SVGA exporter path and output bytes: not touched.
- Existing CLI flow: not touched.
- Web preview, playback, import, drag-drop, and comparison: not touched.

## Drift

- No new format, player, encoder, converter, export workbench, UI, or dependency.
- No format registry or speculative multi-format orchestration added.

## Dependencies and Client

- No dependency or license change.
- Service imports no Node, DOM, Canvas, filesystem, or browser API.
- Hosts provide bytes through `MotionAssetSource.read()`.
- Suitable for macOS and Windows desktop hosts; file permissions and paths stay
  outside the service.
- Offline behavior and bundle size are unchanged.

## Risks

- The service currently wraps one adapter per instance; format selection remains
  a separate future application concern.
- File-backed source construction remains the host's responsibility.

## Next

- Add one bounded application-level format selection boundary only when a second
  inspected format is approved.
