# Review: capability-matrix validation and stale-evidence policy

## 1. Summary

Added host-neutral capability-matrix version and structure validation, a static
evidence review-epoch policy, and warning handoff into conservative format
recommendation rationale.

## 2. Git state

- Branch: `agent/codex/capability-matrix-validation-policy`
- Implementation commit: `580c33ba3f2baeb02c2a5d44d71fdc7f33202051`
- Working tree after delivery: clean

## 3. Changed files

- `src/workbench/format-capability-matrix.ts`
- `src/workbench/format-recommendation.ts`
- `src/tests/format-capability-matrix.test.ts`
- `src/tests/format-recommendation.test.ts`
- `src/tests/helpers/format-recommendation-fixture.ts`
- `docs/TECH_SPEC.md`

## 4. Requirement checks

| Requirement | Status |
|---|---|
| Current and supported matrix version = 1 | Done |
| Unknown version rejected | Done |
| Capability, evidence, maturity, production marker validation | Done |
| Known capability with unavailable implementation warns | Done |
| Static stale-evidence review epoch warns without blocking | Done |
| Recommendation rationale carries relevant warnings | Done |
| Stale evidence cannot create production recommendation | Done |

## 5. Verification

- `./node_modules/.bin/tsc -p tsconfig.json`: passed.
- `node --test dist/tests/format-capability-matrix.test.js dist/tests/format-recommendation.test.js dist/tests/motion-asset-audit-summary.test.js`:
  19 passed, 0 failed.
- `git diff --check`: passed.
- Full regression skipped: Tier 2 recommendation boundary only; protected
  exporter, playback, CLI, and Web paths were not touched.

## 6. Regression boundaries

- SVGA exporter and output bytes: not touched.
- Web player and preview: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- Motion Asset Audit report contract: not touched.
- Spec pass/fail, production thresholds, and padding-gate freeze: not touched.

## 7. Dependencies and client readiness

No dependency, native API, filesystem, network service, AI, external model, or
upload path was added. Validation is deterministic and uses a static review
epoch rather than wall-clock time. macOS and Windows clients can reuse identical
offline validation behavior without packaging, privacy, license, or
redistribution changes.

## 8. Risks

- Review epoch advancement is manual and requires an explicit evidence-review
  task.
- Validation checks structural consistency, not the external truth of format
  capability claims.
- Warnings remain advisory and must not be promoted to production gates without
  a separate reviewed policy.

## 9. Next step

Define a small explicit evidence-review workflow for advancing review epochs and
recording maturity changes, without adding production recommendation rules.
