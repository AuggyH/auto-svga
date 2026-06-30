# SVGA Workbench v1 Autonomous Blockers

## Active External Blockers

| id | area | blockingLevel | requiresOwner | requiresCredential | requiresExternalAsset | summary | attemptedFixes | recommendedDecision | workaround | impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SIGNING-BLOCKED-APPLE-DEVELOPER-ID | macOS distribution | production_release_only | true | true | false | Apple Developer ID signing and notarization cannot be completed without official credentials. | Generated unsigned internal macOS App ZIP, package proof, entitlements, and dry-run signing/notarization workflow. | Provide official Apple Developer ID signing identity and notary credentials when production distribution is required. | Continue with unsigned internal package, dry-run signing plan, proof, and local validation. | Does not block local product development; blocks trusted external macOS distribution. |
| WINDOWS-SIGNING-BLOCKED | Windows distribution | production_release_only | true | true | false | Windows code signing requires an official certificate and release identity. | Existing Electron package scripts include Windows preparation path; production signing not attempted. | Provide Windows signing certificate and release identity when Windows distribution is required. | Continue macOS-first development and keep Windows scripts/config auditable. | Does not block macOS product work; blocks trusted Windows distribution. |

## Active Product Technical Partial

| id | area | blockingLevel | requiresOwner | requiresCredential | requiresExternalAsset | summary | attemptedFixes | recommendedDecision | workaround | impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PHASE4-SEQUENCE-SAFE-SAVE-AS-BLOCKED | sequence-frame anti-flicker | product_phase_partial | false | false | false | The smoke candidate can produce edited bytes and reopen them, but the Workbench cannot yet prove exact anti-flicker correctness or visual acceptance safely enough to expose product Save As. | Sequence group detection, repair-preview contract, no-write simulation, bounded prototype, rendered before/after boundary proof, no-op round-trip rehearsal, byte-candidate proof, and fail-closed validation. | Continue implementation in an autonomous follow-up slice unless Product Owner accepts Phase 4 partial status for review. | Keep sequence repair read-only/product Save As disabled; include the precise status report in the review directory. | Does not block Phase 1-3 reviewability; blocks claiming Phase 4 completion. |

## No Current Product-Direction Blocker

The Product Owner has authorized ordinary UI, implementation, architecture,
test, refactor, naming, and workflow decisions for this autonomous run.
