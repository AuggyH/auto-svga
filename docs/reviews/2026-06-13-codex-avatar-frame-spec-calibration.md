# Review: Avatar-frame specification calibration

## 1. Summary

Calibrated provisional avatar-frame file-size and resource-count limits from
the unique SVGA outputs currently available in the repository.

## 2. Git state

- Branch: `agent/codex/avatar-frame-spec-calibration`
- Commit before work: `277971e`
- Implementation commit: `3f7ea64`
- Uncommitted changes before work: none
- Real assets staged: none

## 3. Changed files

- `src/workbench/specs/avatar-frame-production.ts`
- `src/workbench/avatar-frame-inspection-report.ts`
- `src/tests/avatar-frame-production-spec.test.ts`
- `src/tests/avatar-frame-inspection-report.test.ts`
- `tools/svga-player-preview/inspection-report-view.mjs`
- `tools/svga-player-preview/inspection-report-view.test.mjs`
- `tools/svga-player-preview/README.md`
- `docs/TECH_SPEC.md`
- `docs/avatar-frame-spec-calibration.md`

## 4. Requirement checks

| Requirement | Status |
|---|---|
| Measure available SVGA size/resources/dimensions/FPS/duration | Done |
| Document threshold source | Done |
| Update file-size threshold | Done: 512 KiB |
| Update resource-count threshold | Done: 32 |
| Preserve 300x300, 24 FPS, 3000 ms | Done |
| Preserve limited-sample calibration warning | Done |
| Update preset/report/Web display tests | Done |
| No new dependency or UI capability | Done |

## 5. Calibration evidence

- Production baseline: 107,034 bytes, 28 resources, 300x300, 24 FPS, 3000 ms.
- Complex 300x300 sample: 346,987 bytes, 25 resources, 30 FPS, 2400 ms.
  Used only for size/resource calibration because it exceeds the FPS spec.
- Historical 600x600 delivery: 931,514 bytes, 14 resources, 30 FPS. Excluded.
- Observable generated/output PNGs: 56 files, 465,972 bytes total.
- Valid-canvas sample count: two; thresholds remain provisional.

## 6. Verification

Validation tier: Tier 2.

```text
npm run build
PASS

node --test dist/tests/avatar-frame-production-spec.test.js dist/tests/avatar-frame-inspection-report.test.js
8 passed

node --test tools/svga-player-preview/inspection-report-view.test.mjs tools/svga-player-preview/server-inspection-report.test.mjs
5 passed
```

Actual-file inspection:

- 300x300 baseline: passed.
- 300x300 / 30 FPS sample: only `fps_exceeds_limit`.
- historical 600x600 sample: `file_size_exceeds_limit`,
  `dimensions_exceed_limit`, and `fps_exceeds_limit`.

Full regression was skipped because this task changed only the preset,
calibration-note plumbing, tests, and documentation. Exporter, playback,
dependencies, build configuration, and CLI routing were not touched.

## 7. Regression and drift

- SVGA exporter: not touched; output bytes unchanged.
- Web player implementation and layout: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- Scope remains avatar-frame production specification checks.

## 8. Dependencies and client readiness

- Dependencies added: none.
- License impact: none.
- Preset and report-service metadata remain host-neutral.
- No Node, DOM, Canvas, filesystem, browser, or platform path dependency was added.
- The same limits and calibration notes can be reused by macOS and Windows clients offline.

## 9. Risks

- Two valid-canvas samples are insufficient for a final product standard.
- The complex sample exceeds the current 24 FPS rule, so it is only evidence
  for file size and resource count.

## 10. Next steps

- Recalibrate after at least 10 representative production deliveries.
