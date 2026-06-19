# Review: freeze role-aware padding gate migration

## 1. Summary

Recorded the decision to keep role-aware transparent-padding diagnostics
advisory until independent manual labels provide enough coverage to measure
false positives and false negatives.

## 2. Git state

- Branch: `agent/codex/freeze-padding-gate-migration`
- Decision commit: `0e26c752aac4fd4f69d85d5f81f38f78ea872bf4`
- Branch base includes the completed label-review helper commits.
- Working tree after delivery: clean

## 3. Changed files

- `docs/decisions/ADR-004-freeze-role-aware-padding-gate-migration.md`

## 4. Requirement checks

| Requirement | Status |
|---|---|
| Record gate-migration pause | Done |
| State missing evidence and unmeasurable FP/FN risk | Done |
| Define external labels, two reviewers, and required coverage | Done |
| Require coverage/agreement helper output before resume | Done |
| Name policy-vs-human comparison as the next resumed task | Done |
| Keep advisory policy, production thresholds, and gate unchanged | Done |

## 5. Verification

- `git diff --check`: passed.
- `git diff --cached --stat`: one decision document, 87 insertions.
- Build and full regression: skipped under Tier 0 because runtime code was not
  touched.

## 6. Regression boundaries

- Runtime code and tests: not touched.
- Role-aware padding policy and production gate: not touched.
- Report contract and Web UI: not touched.
- SVGA exporter and playback: not touched.
- CLI default flow, import, drag-drop, and comparison: not touched.

## 7. Dependencies and client readiness

No dependencies, AI, external models, multimodal capabilities, or network
services were added. The decision preserves deterministic offline calibration
and does not affect macOS or Windows packaging.

## 8. Risks

- Gate migration remains blocked until external manual labels satisfy every
  resume condition.
- The current advisory must not be presented as a calibrated production gate.

## 9. Next step

Collect external v1 labels from at least two reviewers. After coverage passes,
implement the deterministic policy-vs-human comparison helper.
