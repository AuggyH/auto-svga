# P3 External Product Review 1

externalOutcome: REPAIR_REQUIRED

reviewedEvidenceCommit: 31e4dbc73e578f95e245be8d00d54997206b9a4c

functionalOutcome: PASS_WITH_HANDOFF_AND_PRODUCT_EVIDENCE_GAPS

## Blocking Findings

1. P3 upload ZIP is missing final Review Packet, final response, standard
   manifest, validation evidence, reviewer JSON, Reviewer B product category
   evidence, and post-seal verification evidence.
2. `docs/P3-final-external-review.md` still records pending handoff state:
   `PASS_PENDING_PACKET_SEAL`, `PENDING_FINAL_HANDOFF`, and
   `reviewedHeadCommit: see final sealed packet`.
3. `bundle-privacy-audit.json` records real local forbidden patterns such as
   `<real-user-home>` and repository path fragments, so the audit file
   itself leaks local identity data.
4. `round-trip-report.json` uses broad boolean invariant evidence instead of
   individually checkable sprite, frame, transform, alpha, layout, shape,
   audio, image-key, and source immutability checks.
5. Replacement, dirty, export, and reopened states do not show the active
   replacement resource thumbnail.
6. `artifact-index.json` lists more product artifacts than the upload ZIP
   contains and lacks explicit bundle inclusion status.
7. The core P3 editing loop can be retained: original green visual, replacement
   orange visual, reset to green, export/reopen orange, productized invalid PNG
   error, 80x80 exported replacement resource, and matching replacement/export
   resource hashes.

## Required Repair

- Enter the next legal P3 repair round.
- Fix thumbnail evidence from actual resource bytes.
- Upgrade round-trip report to schema v2 with granular invariant checks.
- Rebuild final upload ZIP so it is self-contained and privacy-clean.
- Generate final sealed packet and reviewer evidence bound to one final HEAD.

## Repair-2 Disposition

- Replacement thumbnail evidence now records original, replacement candidate,
  replacement preview, reset, reopened export, and invalid-PNG-retained hashes
  from actual embedded PNG bytes.
- `round-trip-report.json` now uses schemaVersion 2 with granular invariant
  checks for params, sprite identity/order, frame alpha/layout/transform,
  clipPath, shapes, audio entries, image keys, untouched images, selected
  resource reference, source SHA immutability, unknown-field boundary, and
  canonicalization rules.
- `edited-output.svga` is indexed as `application/x-svga`.
- `build-p3-upload-package.mjs` creates a self-contained visible upload ZIP
  with sealed packet evidence, screenshots, reports, edited SVGA, bundle
  manifest, privacy audit, and Reviewer A/B JSON.
- Final sealed packet and final upload ZIP are generated after the repair-2
  source commit.
