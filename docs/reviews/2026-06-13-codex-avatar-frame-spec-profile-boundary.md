# Review: Avatar-frame Spec Profile Boundary

## 1. Summary

- Mainline: P2 design specification checks.
- Marked the existing avatar-frame preset as the `production_target` profile.
- Added a non-production `legacy_compatibility` descriptor without thresholds
  or default-flow integration.
- Added profile ID, label, and purpose to inspection reports and their read-only
  Web rendering.

## 2. Git state

- Branch: `agent/codex/avatar-frame-spec-profile-boundary`
- Commit before work: `9c0d206`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `src/workbench/contracts.ts`
- `src/workbench/specs/avatar-frame-production.ts`
- `src/workbench/specs/avatar-frame-legacy-compatibility.ts`
- `src/workbench/specs/index.ts`
- `src/workbench/avatar-frame-inspection-report.ts`
- `src/tests/avatar-frame-production-spec.test.ts`
- `src/tests/avatar-frame-inspection-report.test.ts`
- `tools/svga-player-preview/inspection-report-view.mjs`
- `tools/svga-player-preview/inspection-report-view.test.mjs`
- `tools/svga-player-preview/server-inspection-report.test.mjs`
- `docs/avatar-frame-spec-profiles.md`
- `docs/avatar-frame-21-sample-calibration.md`
- `docs/TECH_SPEC.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Production preset identified as `production_target` | Done |
| 2 | Legacy compatibility boundary is non-production | Done |
| 3 | Production thresholds remain unchanged | Done |
| 4 | Default inspection still uses production target | Done |
| 5 | Report includes profile ID, label, and purpose | Done |
| 6 | Web report only renders existing profile metadata | Done |
| 7 | Historical distribution does not relax production gate | Done |
| 8 | No real SVGA or PNG sample committed | Done |

## 5. Verification

```text
TypeScript build: passed
Workbench spec/report/service tests: 22 passed, 0 failed
Web report and host tests: 8 passed, 0 failed
git diff --check: passed
```

Full regression was not run. This Tier 2 change is limited to an additive
contract, profile descriptors, report metadata, read-only presentation, and
targeted tests.

## 6. Regression

- SVGA exporter and output bytes: not touched.
- Web player implementation and layout: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- New dependencies: none.

## 7. Risks

- `legacy_compatibility` has no thresholds by design; product policy is still
  required before it can become an executable compatibility check.
- File-size, resource-count, and transparent-padding production limits retain
  their existing provisional calibration status.

## 8. Client readiness

- Profile contracts and report metadata are host-neutral.
- No Node, DOM, Canvas, filesystem, browser, network, or platform-specific API
  was added to the workbench layer.
- The same report contract can be reused by macOS and Windows clients offline.

## 9. Next steps

- Define compatibility acceptance semantics before adding any
  `legacy_compatibility` thresholds or profile selection flow.

## 10. Commit

- Commit: recorded after finalization
- Branch: `agent/codex/avatar-frame-spec-profile-boundary`
- Tag: none
