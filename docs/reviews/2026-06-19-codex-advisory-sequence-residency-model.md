# Review: Advisory Sequence Residency Model

## 1. Summary

- Mainline: P2 design specification checks + P6 format recommendation
  infrastructure.
- Added host-neutral advisory sequence grouping and residency diagnostics.
- Added the diagnostics to avatar-frame inspection reports without changing
  raw memory facts or specification pass/fail behavior.

## 2. Git state

- Branch: `agent/codex/advisory-sequence-residency-model`
- Base commit: `f8757ae8e956b900deb6f38298016c0f5d043103`
- Implementation commit: `7c2813c25782006cbe4eda6fced8c6fc5f2f405b`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `src/workbench/contracts.ts`
- `src/workbench/sequence-residency-diagnostics.ts`
- `src/workbench/avatar-frame-inspection-report.ts`
- `src/tests/sequence-residency-diagnostics.test.ts`
- `src/tests/avatar-frame-inspection-report.test.ts`
- `docs/TECH_SPEC.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Analyze sequence and baked-sweep roles only | Done |
| 2 | Explicit or conservative continuous-number grouping | Done |
| 3 | Group count, frame counts, totals, and ranking | Done |
| 4 | Five possible residency model values | Done |
| 5 | Evidence and uncertainty are explicit | Done |
| 6 | Unknown grouping or dimensions are not guessed | Done |
| 7 | Additive report metadata only | Done |
| 8 | No gate, dependency, AI, model, or network service | Done |

## 5. Verification

```text
TypeScript build: passed
Sequence, role, and raw memory tests: 16 passed, 0 failed
Avatar-frame report and production spec tests: 10 passed, 0 failed
git diff --check: passed
```

Full regression was not run. This Tier 2 change is isolated to a host-neutral
diagnostic helper, additive report metadata, targeted tests, and documentation.
The Web report was not touched, so Web rendering tests were not required.

## 6. Regression

- SVGA exporter and output bytes: not touched.
- Web player implementation and layout: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- Production and legacy profile semantics: unchanged.
- Transparent-padding policy and raw memory facts: unchanged.

## 7. Risks

- Possible residency models are review candidates, not observed player behavior.
- Inferred groups depend on role, repeated dimensions, and continuous numeric
  suffixes; incomplete evidence remains ungrouped with high uncertainty.
- Advisory risk does not include decoder, frame-buffer, GPU duplication, or
  platform overhead.

## 8. Client readiness

- Pure TypeScript with no Node, DOM, Canvas, filesystem, browser, native, or
  platform-specific dependency.
- Deterministic and offline for macOS and Windows hosts.
- No privacy, license, bundle-size, or redistribution impact.

## 9. Next steps

- Add deterministic duplicate and empty-frame evidence as separate inspection
  primitives before producing optimization suggestions.

## 10. Commit

- Implementation commit: `7c2813c25782006cbe4eda6fced8c6fc5f2f405b`
- Branch: `agent/codex/advisory-sequence-residency-model`
- Tag: none
