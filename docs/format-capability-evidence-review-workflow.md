# Format capability evidence review workflow

This workflow governs changes to the versioned format capability matrix. It
keeps format capability, Auto SVGA implementation maturity, and production
support as separate review decisions.

Use the synthetic template at
`docs/templates/format-capability-evidence-review.template.md` for every review.

## Review triggers

Start an evidence review when any of these conditions applies:

- a format specification or authoritative behavior changes;
- Auto SVGA adds or changes a parser, player, exporter, or converter;
- implementation maturity needs to change;
- production support needs to change;
- a stale-evidence warning needs resolution;
- a project assumption needs verification or replacement.

Do not advance a review marker only because time passed. A stale warning asks
for review; it does not authorize a data change.

## Required record

Every review must record:

- `reviewedFormat`;
- `reviewedCapability`;
- `previousEvidence`;
- `newEvidence`;
- `evidenceType`;
- `confidence`;
- `reviewEpoch`;
- `reviewer`;
- `rationale`;
- `affectedRecommendationBehavior`;
- `clientImpact`.

Evidence references must be reproducible and must not contain private assets,
credentials, local absolute paths, or uncommitted output files.

## Review procedure

1. **Open one bounded review.** Select one format and the capability or maturity
   change under review.
2. **Capture the previous state.** Record the current evidence, review epoch,
   implementation maturity, and production-support marker.
3. **Collect new evidence.** Prefer format specifications, repository tests,
   deterministic fixtures, and verified implementation results.
4. **Classify the evidence.** Use `format_spec`, `implementation_verified`,
   `project_assumption`, or `needs_verification`; set confidence independently.
5. **Assess implementation maturity.** Apply only maturity changes supported by
   parser, player, exporter, converter, or production evidence.
6. **Review production support separately.** Do not infer production support
   from known format capability or from one implemented component.
7. **Advance `reviewEpoch` explicitly.** Advance it only after the review record,
   evidence, targeted validation, and reviewer decision are complete.
8. **Validate the matrix.** Run capability-matrix validation and relevant
   recommendation tests.
9. **Record recommendation and client impact.** Explain what rationale or
   uncertainty may change and whether macOS or Windows packaging is affected.
10. **Commit the review.** Include the evidence-review record or its public-safe
    summary and a concrete implementation commit hash in the task review.

## Implementation evidence requirements

Implementation maturity must not change without matching evidence:

| Maturity area | Minimum evidence |
|---|---|
| Parser | Targeted parse tests with supported and malformed fixtures |
| Player | Real playback smoke plus documented platform boundary |
| Exporter | Standards-compliant output validation and real-player review boundary |
| Converter | Deterministic conversion tests and documented semantic losses |
| Production support | Separate delivery review covering compatibility, stability, licensing, and rollback |

Implementing one area does not imply another. A parser does not imply playback,
export, conversion, or production support.

## Production-support review

Changing `productionSupport` requires a separate, explicit review. It must state:

- supported scope and excluded scope;
- parser, player, exporter, and converter maturity;
- target platforms and verified versions;
- dependency licenses and redistribution status;
- failure behavior and rollback path;
- offline, privacy, packaging, and client impact;
- concrete production validation evidence.

Capability knowledge alone must never upgrade production support. Non-SVGA
format evidence remains distinct from Auto SVGA implementation availability.

## Stale evidence policy

- Stale evidence produces a warning only.
- A warning does not automatically raise or lower recommendation rank, maturity,
  confidence, or production support.
- The recommendation engine remains conservative while evidence is stale or
  insufficient.
- Resolving stale evidence requires an explicit review, even when the reviewed
  values remain unchanged.
- `reviewEpoch` is a manual evidence revision, not a date counter.

## Client and privacy boundary

The workflow is host-neutral and offline. Web, macOS, and Windows hosts may
consume the same matrix and validation result. Reviews must not require network
services, upload user assets, or introduce AI/model judgment. Any new library or
native component follows the normal license, bundle-size, signing, permission,
and redistribution review before maturity can advance.
