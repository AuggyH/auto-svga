# Review: versioned format capability evidence boundary

## 1. Summary

Versioned the recommendation capability matrix at v1 and added per-format
evidence plus implementation maturity. Recommendation candidates now distinguish
format capability from Auto SVGA implementation and production support.

## 2. Git state

- Branch: `agent/codex/format-capability-evidence-boundary`
- Implementation commit: `31b4839d255494ffdb112119f7da9d52c6535143`
- Working tree after delivery: clean

## 3. Changed files

- `src/workbench/format-recommendation.ts`
- `src/tests/format-recommendation.test.ts`
- `docs/TECH_SPEC.md`

## 4. Requirement checks

| Requirement | Status |
|---|---|
| Capability matrix version 1 | Done |
| Evidence source, type, confidence, review marker, notes | Done |
| Per-format implementation maturity | Done |
| Capability, implementation, and production support separated | Done |
| Unimplemented candidates remain conservative | Done |
| SVGA retained as bounded current baseline | Done |
| Best-format selection or production recommendation | Not added |

## 5. Verification

- `./node_modules/.bin/tsc -p tsconfig.json`: passed.
- `node --test dist/tests/format-recommendation.test.js dist/tests/motion-asset-audit-summary.test.js`:
  13 passed, 0 failed.
- `git diff --check`: passed.
- Full regression skipped: Tier 2 additive recommendation boundary; protected
  exporter, playback, CLI, and Web paths were not touched.

## 6. Regression boundaries

- SVGA exporter and output bytes: not touched.
- Web player and preview: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- Motion Asset Audit report contract: not touched.
- Spec gates, thresholds, and padding-gate freeze: not touched.

## 7. Dependencies and client readiness

No dependency, native API, AI, external model, network service, or upload path
was added. The versioned matrix is host-neutral and offline. macOS and Windows
clients can use the same evidence and maturity markers without filesystem,
browser, packaging, license, privacy, or redistribution changes.

## 8. Risks

- Evidence review dates are static contract metadata and require an explicit
  future review task to advance.
- SVGA `supported` means the repository's bounded current baseline, not a
  universal SVGA conversion or editing guarantee.
- Non-SVGA capability entries remain architecture evidence and are not parser,
  player, exporter, converter, or production support claims.

## 9. Next step

Define a small validation policy for capability-matrix version compatibility
and stale evidence review without adding production recommendation rules.
