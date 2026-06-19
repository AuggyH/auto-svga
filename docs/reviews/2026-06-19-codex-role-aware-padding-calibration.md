# Review: Role-aware transparent-padding calibration

## 1. Summary

- Extended the existing offline alpha-bound calibration script with role-aware
  policy and sequence-group summaries.
- Scanned 21 external user-provided avatar-frame SVGAs without adding assets to Git.
- Recorded label confidence, role distributions, policy severity/uncertainty,
  sequence-group evidence, and coverage gaps.
- Kept the 50% threshold provisional and left the production gate unchanged.

## 2. Git state

- Branch: `agent/codex/role-aware-padding-calibration`
- Commit before work: `a26d4a403702348c75d35d06dbcf79a9d831f824`
- Implementation commit: `c15496b13d34faeeba56a311557a4e29dde3bbb7`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `docs/TECH_SPEC.md`
- `docs/role-aware-transparent-padding-calibration.md`
- `scripts/calibrate-avatar-frame-alpha-bounds.mjs`
- `scripts/calibrate-avatar-frame-alpha-bounds.test.mjs`

## 4. Evidence summary

- Samples: 21 unique user-provided avatar-frame SVGAs.
- Resources: 1,611.
- Static images: 827; 2 above 50% padding.
- Sequence frames: 784; 170 above 50% padding.
- Detected sequence groups: 31.
- Group policy output: 5 warnings, 9 advisories, 17 groups without padding diagnostics.
- Baked sweep, mask/matte, unknown, and fully transparent sample coverage: none.
- Policy severity totals: 2 errors, 5 warnings, 9 advisories.
- Policy uncertainty: 2 low, 14 medium, 0 high.

`avatar_frame` is user-confirmed with high confidence. Production approval,
effect intent, and resource-level defect labels were not supplied. Classifier
roles are deterministic evidence, not human visual labels.

## 5. Requirement checks

| Requirement | Status |
|---|---|
| Scan available labeled avatar-frame samples | Done |
| Run existing inspection report composition | Done |
| Per-role alpha and padding statistics | Done |
| Per-role policy severity and uncertainty | Done |
| Sequence-group frame and padding distributions | Done |
| Static-image exceptions reviewed separately | Done |
| Baked/mask/unknown false-positive risk recorded | Done; sample coverage unavailable |
| Label confidence explicit | Done |
| Production threshold unchanged | Confirmed |
| Production gate migration | Not done |
| Real SVGA/PNG files committed | None |

## 6. Verification

```text
./node_modules/.bin/tsc -p tsconfig.json
Passed.

Calibration script, role-aware policy, alpha-bound, classifier, sequence,
inspection-report, and production-spec targeted tests
40 passed, 0 failed.

21-sample external calibration scan
21 samples / 1,611 resources completed successfully.

git diff --check
Passed.
```

Full regression was skipped under Tier 1/2 because only the calibration host
script, its tests, and documentation changed. Runtime inspection policy,
exporter, playback, CLI defaults, and Web behavior were not modified.

## 7. Regression boundaries

- SVGA exporter and output bytes: not touched.
- Web player implementation and layout: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- Resource classifier and role policy: not changed.
- Production spec, 50% threshold, pass/fail, and report contract: unchanged.
- No new format, optimization action, crop, repair, or conversion.

## 8. Dependencies and client readiness

- No dependency or license change.
- No AI, external model, multimodal capability, network service, or upload.
- Calibration is deterministic, offline, and repeatable from local bytes.
- The Node script owns filesystem access; policy and report composition remain
  host-neutral for future macOS and Windows clients.
- No installer-size, native-runtime, privacy, or redistribution risk added.

## 9. Risks

- No human resource/group defect labels are available, so false-positive and
  false-negative rates cannot be measured.
- No baked sweep, mask/matte, unknown-role, or fully transparent sample evidence
  is available; those policies remain test-backed but uncalibrated.
- Numeric image-key grouping is explainable but does not prove visual alignment intent.

## 10. Next steps

- Collect a smaller manually reviewed set with resource/group defect labels and
  explicit baked-sweep and mask/matte coverage before any gate migration.

## 11. Commit

- Commit: `c15496b13d34faeeba56a311557a4e29dde3bbb7`
- Branch: `agent/codex/role-aware-padding-calibration`
- Working tree after delivery: clean
