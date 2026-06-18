# Review: Role-aware Memory Diagnostics

## 1. Summary

- Mainline: P2 design specification checks + P6 format recommendation
  infrastructure.
- Added host-neutral memory diagnostics grouped by normalized resource role.
- Added the diagnostics to avatar-frame inspection reports without changing
  raw estimates or specification pass/fail behavior.

## 2. Git state

- Branch: `agent/codex/role-aware-memory-diagnostics`
- Commit before work: `e9f753c`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `src/workbench/contracts.ts`
- `src/workbench/memory-diagnostics.ts`
- `src/workbench/avatar-frame-inspection-report.ts`
- `src/tests/role-aware-memory-diagnostics.test.ts`
- `src/tests/avatar-frame-inspection-report.test.ts`
- `docs/TECH_SPEC.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Aggregate all five normalized resource roles | Done |
| 2 | Count known and unknown memory per role | Done |
| 3 | Decoded/texture totals and per-role ranking | Done |
| 4 | Sequence-frame subtotal | Done |
| 5 | Unknown role and dimensions remain explicit | Done |
| 6 | Raw memory estimation remains unchanged | Done |
| 7 | Additive report metadata only | Done |
| 8 | No gate, dependency, AI, model, or network service | Done |

## 5. Verification

```text
TypeScript build: passed
Memory estimation and role diagnostics tests: 9 passed, 0 failed
Avatar-frame report and production spec tests: 10 passed, 0 failed
git diff --check: passed
```

Full regression was not run. This Tier 2 change is isolated to a pure
diagnostic helper, additive report metadata, targeted tests, and documentation.
The Web report was not touched, so Web rendering tests were not required.

## 6. Regression

- SVGA exporter and output bytes: not touched.
- Web player implementation and layout: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- Production and legacy profile semantics: unchanged.
- Transparent-padding policy and raw memory estimation: unchanged.

## 7. Risks

- Role diagnostics inherit the conservative classifier's role accuracy.
- A role total remains unknown when any resource in that role lacks dimensions.
- Sequence subtotal is not yet a residency or streaming model.

## 8. Client readiness

- Pure TypeScript with no Node, DOM, Canvas, filesystem, browser, native, or
  platform-specific dependency.
- Deterministic and offline for macOS and Windows hosts.
- No privacy, license, bundle-size, or redistribution impact.

## 9. Next steps

- Define an advisory sequence residency model using explicit grouping evidence,
  without changing raw resource memory facts.

## 10. Commit

- Commit: recorded after finalization
- Branch: `agent/codex/role-aware-memory-diagnostics`
- Tag: none
