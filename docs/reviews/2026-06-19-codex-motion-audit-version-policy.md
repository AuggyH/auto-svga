# Review: Motion Asset Audit report version policy

## 1. Summary

- Mainline: P2 design inspection, P6 recommendation infrastructure, P7 client readiness.
- Defined strict v1 report contract negotiation: current version `1`, supported versions `[1]`.
- Added host-neutral helpers for version parsing, support checks, and rejection of unknown versions.
- Documented additive v1 rules and explicit future v1-to-v2 migration requirements.

## 2. Git state

- Branch: `agent/codex/motion-audit-version-policy`
- Commit before work: `b0a78658a0a14713c03607b76556fade33880644`
- Implementation commit: `5fe678c33ab935926973764a1926906c85dc6b4e`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `src/workbench/motion-asset-audit-report-contract.ts`
- `src/tests/motion-asset-audit-report-version-policy.test.ts`
- `src/tests/motion-asset-audit-report-contract.test.ts`
- `docs/TECH_SPEC.md`

## 4. Requirement checks

| Requirement | Status |
|---|---|
| Current and supported versions exposed | Done: `1` and `[1]` |
| Supported-version helper API | Done |
| Unknown or missing version handling | Done: rejected, no v1 fallback |
| Additive optional v1 fields | Done and tested |
| Breaking-change and migration policy | Done and documented |
| Existing v1 fixture semantics preserved | Done |
| New v2 fields or migration implementation | Not done by scope |

## 5. Verification

```text
./node_modules/.bin/tsc -p tsconfig.json
PASS

node --test dist/tests/motion-asset-audit-report-version-policy.test.js dist/tests/motion-asset-audit-report-contract.test.js dist/tests/motion-asset-audit-localization-keys.test.js dist/tests/motion-asset-audit-presentation.test.js dist/tests/motion-asset-audit-summary.test.js dist/tests/avatar-frame-inspection-report.test.js dist/tests/avatar-frame-production-spec.test.js
29 pass, 0 fail

git diff --check
PASS
```

- Validation tier: Tier 2.
- Full regression skipped because exporter, playback, dependencies, build config, CLI, and Web preview were not changed.

## 6. Regression and drift

- SVGA exporter and output bytes: not touched.
- Web player, preview layout, import, drag-drop, and comparison: not touched.
- CLI default flow: not touched.
- Existing audit summary, presentation, localization, diagnostics, gates, and thresholds: unchanged.
- Drift check: no new format, UI, optimization action, dependency, AI, or network capability.

## 7. Dependencies and client readiness

- Dependencies: none added; no license change.
- Host-neutral: pure TypeScript; no Node, DOM, Canvas, filesystem, browser, or network API dependency.
- macOS and Windows clients can share the same negotiation helpers offline.
- Privacy, bundle-size, and distribution impact: none.

## 8. Risks

- Only v1 is supported. Future v2 requires a separate parser and explicit migration helper with targeted tests.
- The helper rejects unknown major versions by design; clients still need their own read-only unsupported-version presentation.

## 9. Next step

- Add an explicit migration registry boundary only when a real v2 contract is defined; do not add speculative migrations now.

## 10. Delivery

- Commit: `5fe678c33ab935926973764a1926906c85dc6b4e`
- Working tree: clean after review delivery commit.
