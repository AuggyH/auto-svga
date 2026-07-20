# Review: Deterministic Sequence-frame Evidence Primitives

## 1. Summary

- Mainline: P2 design specification checks + P6 format recommendation
  infrastructure.
- Added deterministic duplicate, transparent/near-empty, repeated alpha-bound,
  and repeated-dimension evidence for sequence and baked-sweep resources.
- Added host-provided SHA-256 encoded-resource hashes and additive report data.

## 2. Git state

- Branch: `agent/codex/sequence-frame-evidence-primitives`
- Base commit: `244015adddda8975a34f1a13fa71750629ebf4f9`
- Implementation commit: `8cdc647f01a761a514958330ab49267aeb2c5284`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `src/workbench/contracts.ts`
- `src/workbench/resource-hasher.ts`
- `src/workbench/sequence-frame-evidence.ts`
- `src/workbench/svga/format-adapter.ts`
- `src/workbench/avatar-frame-inspection-report.ts`
- `src/hosts/sha256-resource-hasher.ts`
- `src/hosts/avatar-frame-inspection.ts`
- `src/tests/sequence-frame-evidence.test.ts`
- `src/tests/svga-format-adapter.test.ts`
- `src/tests/avatar-frame-inspection-report.test.ts`
- `docs/TECH_SPEC.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Sequence and baked-sweep resources only | Done |
| 2 | Exact duplicate groups require stable hashes | Done |
| 3 | Missing hashes report insufficient evidence | Done |
| 4 | Fully transparent and provisional near-empty evidence | Done |
| 5 | Exact repeated alpha bounds and dimensions | Done |
| 6 | Confidence and uncertainty are explicit | Done |
| 7 | Additive report metadata only | Done |
| 8 | No gate, external dependency, AI, model, or network service | Done |

## 5. Verification

```text
TypeScript build: passed
Sequence evidence, residency, role, and raw memory tests: 21 passed, 0 failed
Report, production spec, and SVGA adapter tests: 15 passed, 0 failed
Combined targeted result: 36 passed, 0 failed
git diff --check: passed
```

Full regression was not run. This Tier 2 change affects inspection metadata and
host composition only. Exporter, playback, CLI default flow, and Web UI were not
changed, so unrelated end-to-end and Web rendering tests were skipped.

## 6. Regression

- SVGA exporter and output bytes: not touched.
- Web player implementation and layout: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- Production and legacy profile semantics: unchanged.
- Transparent-padding policy, raw memory facts, and pass/fail: unchanged.

## 7. Risks

- SHA-256 currently covers encoded embedded bytes. Different encodings of the
  same decoded pixels are not classified as duplicates.
- The `0.99` near-empty threshold is provisional advisory evidence, not a gate.
- Repeated dimensions and alpha bounds do not imply duplicate content.

## 8. Client readiness

- Evidence collection is pure TypeScript and host-neutral.
- SHA-256 is isolated behind `EmbeddedResourceHasher`; the current Node host
  uses built-in `node:crypto`, available offline on macOS and Windows.
- No uploaded data, new package, license, installer-size, or redistribution
  impact. A future desktop host can replace the hasher without changing core
  evidence logic.

## 9. Next steps

- Evaluate whether a decoded-content hash host adapter is worth adding for
  compression-independent duplicate evidence.

## 10. Commit

- Implementation commit: `8cdc647f01a761a514958330ab49267aeb2c5284`
- Branch: `agent/codex/sequence-frame-evidence-primitives`
- Tag: none
