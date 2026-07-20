# Review: Format Recommendation Engine MVP boundary

## 1. Summary

Added a host-neutral recommendation input/output contract, a minimal capability
matrix, and a conservative placeholder engine. The engine evaluates explicit
capability constraints but does not score or select a best format.

## 2. Git state

- Branch: `agent/codex/format-recommendation-mvp-boundary`
- Implementation commit: `3ce8f445c55c716e60f143338108727be98f7074`
- Working tree after delivery: clean

## 3. Changed files

- `src/workbench/format-recommendation.ts`
- `src/tests/format-recommendation.test.ts`
- `docs/TECH_SPEC.md`

## 4. Requirement checks

| Requirement | Status |
|---|---|
| Host-neutral recommendation input and output contracts | Done |
| Target usage contexts and listed candidate formats | Done |
| Minimal format capability matrix | Done |
| Replaceable image/text capability constraints | Done |
| Sequence-heavy advisory rationale | Done |
| Unknown and insufficient evidence conservative fallback | Done |
| New parsers, conversion, export, UI, or production policy | Not added |

## 5. Verification

- `./node_modules/.bin/tsc -p tsconfig.json`: passed.
- `node --test dist/tests/format-recommendation.test.js dist/tests/motion-asset-audit-summary.test.js`:
  10 passed, 0 failed.
- `git diff --check`: passed.
- Full regression skipped: isolated Tier 2 workbench boundary; exporter,
  playback, CLI, and Web implementation were not touched.

## 6. Regression boundaries

- SVGA exporter and output bytes: not touched.
- Web player and preview layout: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- Motion Asset Audit report contract and version: not touched.
- Spec pass/fail, production thresholds, and padding gate freeze: not touched.

## 7. Dependencies and client readiness

No dependency, system API, AI, external model, network service, or user-file
upload was added. The contract is deterministic and offline, with no Node, DOM,
Canvas, browser, filesystem, or platform path dependency. It can be shared by
future macOS and Windows hosts without packaging or redistribution changes.

## 8. Risks

- Capability matrix entries describe format characteristics, not implemented
  parser/player/exporter support.
- Only `avatar_frame` has an MVP recommendation path; other usage contexts
  return `needs_more_data`.
- Candidate status is advisory and must not be presented as a production-grade
  best-format decision.

## 9. Next step

Define a versioned capability-matrix evidence source and maturity handoff before
adding any production recommendation policy.
