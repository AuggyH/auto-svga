# Avatar-frame Inspection Report Review

Date: 2026-06-13
Branch: `agent/codex/avatar-frame-inspection-report`
Base: `7dd1af2`
Implementation commit: `21cdb36`

## Mainline

- P2 design specification checks.
- Exposes the current avatar-frame production check through a non-UI report entry.

## Changed

- Added host-neutral `AvatarFrameInspectionReportService`.
- Reused inspection service, SVGA adapter, checker, and production preset.
- Added JSON command `inspect-avatar-frame <file.svga>`.
- Reports asset summary, spec ID, pass/fail, issues, and calibration notes.
- Failed checks still output the full report and use exit code `1`.

## Files

- `src/workbench/avatar-frame-inspection-report.ts`
- `src/commands/inspect-avatar-frame.ts`
- `src/cli.ts`
- `src/tests/avatar-frame-inspection-report.test.ts`
- `README.md`
- `docs/TECH_SPEC.md`

## Validation

- Tier: 2, specification report/CLI-adjacent.
- `npm run build`: passed.
- `node --test dist/tests/avatar-frame-inspection-report.test.js`: 3 passed.
- `node --test dist/tests/avatar-frame-production-spec.test.js`: 3 passed.
- `node --test dist/tests/svga-motion-spec-checker.test.js`: 5 passed.
- `node --test dist/tests/motion-inspection-service.test.js`: 7 passed.
- Default CLI help smoke: passed; existing commands remain listed.
- Passing CLI fixture: JSON report, exit code `0`.
- Failing `301 x 300` CLI fixture: dimensions issue, exit code `1`.
- `git diff --check`: passed.
- Full regression: skipped because exporter, playback, Web preview, build config,
  dependencies, and cross-cutting runtime flows were not touched.

## Regression

- SVGA adapter, checker, preset, and inspection service: not touched.
- SVGA exporter path and output bytes: not touched.
- Existing CLI branches and argument behavior: unchanged.
- Web preview, playback, import, drag-drop, and comparison: not touched.

## Drift

- No new format, checker rule, pixel analysis, conversion, export workbench, or UI.
- Command is an additive inspection entry only.

## Dependencies and Client

- No dependency or license change.
- Report service imports no Node, DOM, Canvas, filesystem, process, or browser API.
- Node filesystem access is isolated in the command host adapter.
- Future macOS and Windows clients can reuse the report service with their own
  `MotionAssetSource`.
- Offline operation is supported; bundle-size impact is small.

## Risks

- File-size and resource-count thresholds remain placeholders.
- CLI JSON is a new output contract and should be versioned if fields later change.
- The command currently inspects one file per invocation.

## Next

- Obtain approved file-size and resource-count limits before treating the report
  as a final production gate.
