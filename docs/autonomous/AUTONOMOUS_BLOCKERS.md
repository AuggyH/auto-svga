# SVGA Workbench v1 Autonomous Blockers

## Active External Blockers

| id | area | blockingLevel | requiresOwner | requiresCredential | requiresExternalAsset | summary | attemptedFixes | recommendedDecision | workaround | impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SIGNING-BLOCKED-APPLE-DEVELOPER-ID | macOS distribution | production_release_only | true | true | false | Apple Developer ID signing and notarization cannot be completed without official credentials. | Generated unsigned internal macOS App ZIP, package proof, entitlements, and dry-run signing/notarization workflow. | Provide official Apple Developer ID signing identity and notary credentials when production distribution is required. | Continue with unsigned internal package, dry-run signing plan, proof, and local validation. | Does not block local product development; blocks trusted external macOS distribution. |
| WINDOWS-SIGNING-BLOCKED | Windows distribution | production_release_only | true | true | false | Windows code signing requires an official certificate and release identity. | Existing Electron package scripts include Windows preparation path; production signing not attempted. | Provide Windows signing certificate and release identity when Windows distribution is required. | Continue macOS-first development and keep Windows scripts/config auditable. | Does not block macOS product work; blocks trusted Windows distribution. |

## Active Non-Blocking Product Constraints

| id | area | blockingLevel | requiresOwner | summary | action |
| --- | --- | --- | --- | --- | --- |
| REAL-ASSET-PRIVACY-BOUNDARY | real asset validation | nonblocking_evidence_boundary | false | Local production-like SVGA samples are available under Downloads, but raw assets must not be committed or placed in review packages without approval. | Use a redacted validation matrix with relative paths, SHA-256, sizes, parse results, and capability classifications only. |
| PHASE4-REAL-ASSET-SEQUENCE-LIMIT | sequence repair | active_product_work | false | Real-asset sequence repair no longer stops on indexed PNG decoding. It now repairs 3 duplicate real-asset rows with a terminal-tail near-empty-speck rule, while 50 sampled rows still fail closed under group-detection, no-candidate, or visible-frame-overlap limits. | Continue implementation toward broader sequence-group detection and safer candidate selection; do not claim Phase 4 real-asset completion from the narrow repaired subset. |
| SHORT-TERM-DISTRIBUTION-NOT-RC | distribution preparation | nonblocking_parallel_prep | false | Release and distribution preparation has started, but the current Workbench is not a release candidate while Phase 1-4 product work and Product Owner review remain open. | Run `npm run svga-workbench:v1:distribution-readiness` as a prep check; do not publish, tag, upload, or release until the release candidate gate is satisfied. |

## Resolved Product Technical Notes

| id | area | status | summary | residualRisk | recommendedDecision |
| --- | --- | --- | --- | --- | --- |
| PHASE4-SEQUENCE-SAFE-SAVE-AS-BLOCKED | sequence-frame anti-flicker | resolved_for_supported_subsets | Product repaired-copy Save As, saved hash binding, source immutability, full affected-frame alpha proof, reopen playback, and fail-closed unsafe cases are now validated for the fixture path and the terminal-tail real-asset subset. | Very small target removals can have limited exact-frame canvas-delta observability; alpha proof records the exact resource-level removal. Broader sequence-group cases still fail closed and remain active work. | Continue broadening safe sequence detection and repair while keeping unsupported cases fail-closed. |

## Phase 4 Current Technical Limit

Current head `6439517` has a current-head redacted real-asset matrix for 53 local
SVGA samples. The safe product repair path repairs 3 duplicate rows where there
is exactly one terminal-tail near-empty speck, no shared visible timeline frame,
source immutability, same-size transparent replacement, Save As, reopen, and
alpha proof all pass.

The remaining 50 rows fail closed for precise mechanical reasons:

- 31 rows do not expose a continuous single-reference numeric visible sequence
  group of the required size. Diagnostics record numeric resource counts,
  reference-mismatch counts, group candidate counts, longest continuous segment
  length, and sample resource keys.
- 11 rows have sequence groups, but no near-empty candidate under the current
  threshold. Diagnostics record the group id, resource count, threshold, and
  smallest non-transparent pixel samples.
- 8 rows have multiple sequence resources visible on the same timeline frame.
  Diagnostics record overlap-frame counts and redacted frame/resource samples.

Attempted implementation path: indexed PNG decode support, unique near-empty
candidate selection, terminal-tail predecessor proof, repeated-cycle
frame-owner proof, product Save As/reopen/alpha validation, and a multi-reference
candidate scan against the local matrix. The scan found no additional unique
near-empty candidate beyond the already repaired rows.

Recommended next decision: accept the current narrow anti-flicker repair as the
Workbench v1 supported automatic path and backlog broader sequence repair for a
future visual-diff/manual-confirmation workflow, or provide a known flicker
asset with an intended target when a wider automatic rule is required.

## No Current Product-Direction Blocker

The Product Owner has authorized ordinary UI, implementation, architecture,
test, refactor, naming, and workflow decisions for this autonomous run.
