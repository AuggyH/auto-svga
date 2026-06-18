# Review: Decoded Memory Estimation Primitive

## 1. Summary

- Mainline: P2 design specification checks + P6 format recommendation
  infrastructure.
- Added a host-neutral RGBA8 decoded/texture memory estimation primitive.
- Added the estimation summary to avatar-frame inspection reports without
  changing specification pass/fail behavior.

## 2. Git state

- Branch: `agent/codex/decoded-memory-estimation-primitive`
- Commit before work: `2aa5866`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `src/workbench/contracts.ts`
- `src/workbench/memory-estimation.ts`
- `src/workbench/avatar-frame-inspection-report.ts`
- `src/tests/decoded-memory-estimation.test.ts`
- `src/tests/avatar-frame-inspection-report.test.ts`
- `docs/TECH_SPEC.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Deterministic `width x height x 4` estimates | Done |
| 2 | Per-resource decoded and texture estimates | Done |
| 3 | Total, ranking, and sequence subtotal | Done |
| 4 | Missing dimensions remain explicitly unknown | Done |
| 5 | Additive report metadata | Done |
| 6 | Existing spec gates and thresholds unchanged | Done |
| 7 | No new dependency, AI, model, or network service | Done |

## 5. Verification

```text
TypeScript build: passed
Decoded memory estimation tests: 5 passed, 0 failed
Avatar-frame report and production spec tests: 10 passed, 0 failed
git diff --check: passed
```

Full regression was not run. This Tier 2 change is isolated to a pure
inspection helper, additive report metadata, targeted tests, and documentation.

## 6. Regression

- SVGA exporter and output bytes: not touched.
- Web player implementation and layout: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- Production and legacy profile semantics: unchanged.
- Transparent-padding policy: unchanged.

## 7. Risks

- The estimate models RGBA8 resource allocation, not complete player peak
  memory or device-specific decoder/GPU overhead.
- Advisory risk bands are not calibrated production gates.
- Any resource with unknown dimensions makes complete totals and risk unknown.

## 8. Client readiness

- Pure TypeScript with no Node, DOM, Canvas, filesystem, browser, native, or
  platform-specific dependency.
- Deterministic and offline for macOS and Windows hosts.
- No privacy, license, bundle-size, or redistribution impact.

## 9. Next steps

- Add role-aware memory diagnostics that distinguish sequence-frame allocation
  models without changing the raw estimation primitive.

## 10. Commit

- Commit: recorded after finalization
- Branch: `agent/codex/decoded-memory-estimation-primitive`
- Tag: none
