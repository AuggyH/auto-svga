# Inspection Service Specification Integration Review

Date: 2026-06-13
Branch: `agent/codex/inspection-spec-integration`
Base: `bc60ac5`
Implementation commit: `62ddcc6`

## Mainline

- P2 design specification checks.
- Connects the existing checker to the non-UI inspection application service.

## Changed

- Kept `inspect(source, context?)` unchanged.
- Added `inspectWithSpec(source, spec, checker, context?)`.
- Added `MotionAssetInspectionWithSpec` for `{ asset, specReport }`.
- Preserved parse issues outside the checker report.
- Specification failure does not remove or mutate a parsed asset.

## Files

- `src/workbench/inspection-service.ts`
- `src/tests/motion-inspection-service.test.ts`
- `docs/TECH_SPEC.md`

## Validation

- Tier: 2, specification checker/application service.
- `npm run build`: passed.
- `node --test dist/tests/motion-inspection-service.test.js`: 7 passed.
- `node --test dist/tests/svga-motion-spec-checker.test.js`: 5 passed.
- `git diff --check`: passed.
- Full regression: skipped because exporter, playback, CLI, Web preview, build
  config, dependencies, and cross-cutting runtime flows were not touched.

## Regression

- Existing `inspect()` behavior and result: preserved.
- SVGA adapter and checker implementation: not touched.
- SVGA exporter path and output bytes: not touched.
- Existing CLI flow: not touched.
- Web preview, playback, import, drag-drop, and comparison: not touched.

## Drift

- No new format, conversion, export workbench, UI, or checker rule.
- No format registry or speculative orchestration.

## Dependencies and Client

- No dependency or license change.
- Service imports no Node, DOM, Canvas, filesystem, process, or browser API.
- Integration works entirely with injected adapter, checker, source, and spec.
- Suitable for macOS and Windows clients and offline use.
- Bundle-size impact is limited to a small application-service method and type.

## Risks

- `inspectWithSpec()` intentionally requires both a checker and a spec.
- Checker exceptions or cancellation propagate; structured validation failures
  remain inside `specReport`.

## Next

- Add an application-level delivery specification provider only when a real
  product specification source is approved.
