# Review: fast-png host alpha analyzer

## Summary

Promoted the approved `fast-png` prototype to a bounded host adapter and
injected it into avatar-frame inspection composition. Real embedded PNG
resources now provide alpha-bound metadata to the existing checker.

## Git state

- Branch: `agent/codex/fast-png-host-alpha-analyzer`
- Base: `e0c3649`
- Exporter and playback implementation: unchanged

## Changed files

- `src/hosts/fast-png-alpha-analyzer.ts`
- `src/hosts/avatar-frame-inspection.ts`
- `src/commands/inspect-avatar-frame.ts`
- `src/tests/fast-png-alpha-analyzer.test.ts`
- `src/tests/avatar-frame-inspection-report.test.ts`
- `tools/svga-player-preview/server.mjs`
- `tools/svga-player-preview/server-inspection-report.test.mjs`
- `package.json`
- `pnpm-lock.yaml`
- `docs/TECH_SPEC.md`
- `docs/fast-png-dependency-spike.md`

## Requirement checks

- Formal `EmbeddedImageAlphaAnalyzer`: done
- Input and decoded-memory limits: done
- Required PNG fixture cases: done
- Host composition for CLI inspection and Web report service: done
- Checker and UI image decoding: not added
- Existing exporter, player, import, drag-drop, comparison: unchanged

## Verification

- TypeScript full test suite: 77 passed, 0 failed.
- Web inspection report tests: 8 passed, 0 failed.
- Host analyzer, alpha-boundary, production spec, and report paths passed.
- `git diff --check`: required before commit.

## Dependencies

- `fast-png@8.0.0`: MIT
- `fflate@0.8.3`: MIT
- `iobuffer@6.0.1`: MIT
- Measured spike bundle delta: 25,489 bytes minified / 8,224 bytes gzip

## Risks

- Any non-zero alpha currently counts as visible.
- The 50% transparent-padding threshold remains provisional.
- Broader adversarial PNG fixtures remain future hardening work.

## Next step

- Calibrate alpha visibility and padding thresholds using representative avatar-frame deliveries.

## Commit

- Commit: this delivery commit (see repository history)
- Branch: `agent/codex/fast-png-host-alpha-analyzer`
- Tag: none
