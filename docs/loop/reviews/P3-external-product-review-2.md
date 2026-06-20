# P3 External Product Review 2

externalOutcome: REPAIR_REQUIRED

reviewedHeadCommit: 33323a17faab3662b3dc72e3dc6487dd68bb3fe9

functionalOutcome: PASS_WITH_SEALED_HANDOFF_INTEGRITY_GAPS

## Blocking Findings

1. `REVIEW_PACKET.md` metadata claimed exact diff fidelity with
   `sourceDiffSha256` and `packetDiffSha256`
   `0581bdb52ac3733021d04673ae1ebb049b3456dc955c6fb0593b59a4e2592163`,
   but the uploaded embedded diff SHA-256 was
   `53b6de96113116208e883ab74a005d6dd4519d32e4b133e369ca376f1f2b1bf6`.
   The upload bundle changed sealed packet bytes after seal.
2. `changes.patch` still contained private local path patterns, but
   `bundle-privacy-audit.json` did not scan `changes.patch`, making
   `passed=true` untrustworthy.
3. Upload bundle `reviewer-a.json` and `reviewer-b.json` were schemaVersion 1
   product checks instead of the sealed schemaVersion 2 reviewer verdicts
   bound to `reviewedHeadCommit`, `candidateDigest`, and diff hashes.
4. `REVIEW_PACKET.md` embedded schemaVersion 2 reviewer verdicts while
   `reports/sealed-packet-manifest.json` pointed to sealed reviewer files, but
   the top-level uploaded reviewer files were a different evidence identity.
5. Upload bundle `validation.json` was a schemaVersion 1 product artifact
   check instead of the sealed schemaVersion 2 loop validation summary bound to
   final HEAD and clean source workspace.
6. The frozen P3 terminal human gate requires `HUMAN_REQUIRED`, but the packet
   used `milestoneOutcome: PASS` and `Human Decision: None`.
7. `replacement-selected.png` still displayed no selected replacement:
   replacement dimensions were not selected and replacement hash was absent.
8. P3-AC-14 evidence still referenced an obsolete repair-2 upload ZIP instead
   of the current terminal upload bundle.

## Retained Functional Evidence

- Original visual is green.
- Replacement visual is orange.
- Reset restores green.
- Export and reopen preserve orange.
- Exported SVGA inflates.
- Replacement resource hash equals exported resource hash.
- Round-trip schemaVersion 2 granular invariants pass.
- Original source SHA-256 remains unchanged.

## Required Repair 3

- Preserve sealed packet evidence byte-for-byte in the upload bundle.
- Make embedded diff bytes exactly match `changes.patch` and recorded hashes.
- Remove private local path literals from tracked source and source diff.
- Scan every upload ZIP entry in the bundle privacy audit.
- Use sealed schemaVersion 2 reviewer and validation files at standard names.
- Add independent Reviewer B product-category evidence.
- Recapture replacement-selected visual state from actual selected replacement.
- Update stale evidence references to the final upload ZIP.
- End P3 engineering completion as `HUMAN_REQUIRED` pending product owner
  acceptance, not `PASS`.
