# Review: explicit format capability evidence-review workflow

## 1. Summary

Defined the explicit workflow and public-safe template for updating capability
evidence, review epochs, implementation maturity, and production support.

## 2. Git state

- Branch: `agent/codex/format-capability-evidence-review-workflow`
- Documentation commit: `8030d87f4ede9d2109f9452d58a1d63937954624`
- Working tree after delivery: clean

## 3. Changed files

- `docs/format-capability-evidence-review-workflow.md`
- `docs/templates/format-capability-evidence-review.template.md`
- `docs/TECH_SPEC.md`

## 4. Requirement checks

| Requirement | Status |
|---|---|
| Evidence-review triggers documented | Done |
| Required review record fields documented | Done |
| Review epoch advances only through explicit review | Done |
| Parser/player/exporter/converter evidence requirements | Done |
| Production support requires separate review | Done |
| Stale warnings remain advisory | Done |
| Synthetic public-safe template | Done |
| Runtime behavior or matrix content changed | No |

## 5. Verification

- `git diff --check`: passed.
- `git diff --cached --stat`: three documentation/template files, 199 insertions.
- Build and full regression: skipped under Tier 0/1 because runtime code and
  contracts were not touched.

## 6. Regression boundaries

- Capability matrix content and recommendation engine: not touched.
- Motion Asset Audit report contract: not touched.
- Spec gates, thresholds, and padding-gate freeze: not touched.
- SVGA exporter, playback, and Web preview: not touched.
- CLI default flow, import, drag-drop, and comparison: not touched.

## 7. Dependencies and client readiness

No dependency, native API, AI, external model, network service, or upload path
was added. The workflow is repeatable offline and applies equally to Web,
macOS, and Windows hosts. The template requires public-safe evidence references
and explicitly covers packaging, privacy, licensing, redistribution, and
rollback when production support changes.

## 8. Risks

- The workflow depends on reviewers consistently recording evidence and not
  advancing epochs mechanically.
- Production support remains unavailable for non-SVGA formats until separate
  implementation and production reviews provide evidence.

## 9. Next step

Use this workflow only when a concrete capability assumption or implementation
maturity change has new deterministic evidence; do not advance epochs solely to
clear warnings.
