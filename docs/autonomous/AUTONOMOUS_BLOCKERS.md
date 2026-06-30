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

## No Current Product-Direction Blocker

The Product Owner has authorized ordinary UI, implementation, architecture,
test, refactor, naming, and workflow decisions for this autonomous run.
