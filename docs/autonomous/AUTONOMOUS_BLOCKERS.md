# SVGA Workbench v1 Autonomous Blockers

## Active External Blockers

| id | area | blockingLevel | requiresOwner | requiresCredential | requiresExternalAsset | summary | attemptedFixes | recommendedDecision | workaround | impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SIGNING-BLOCKED-APPLE-DEVELOPER-ID | macOS distribution | production_release_only | true | true | false | Apple Developer ID signing and notarization cannot be completed without official credentials. | Generated unsigned internal macOS App ZIP, package proof, entitlements, and dry-run signing/notarization workflow. | Provide official Apple Developer ID signing identity and notary credentials when production distribution is required. | Continue with unsigned internal package, dry-run signing plan, proof, and local validation. | Does not block local product development; blocks trusted external macOS distribution. |
| WINDOWS-SIGNING-BLOCKED | Windows distribution | production_release_only | true | true | false | Windows code signing requires an official certificate and release identity. | Existing Electron package scripts include Windows preparation path; production signing not attempted. | Provide Windows signing certificate and release identity when Windows distribution is required. | Continue macOS-first development and keep Windows scripts/config auditable. | Does not block macOS product work; blocks trusted Windows distribution. |

## Resolved Product Technical Notes

| id | area | status | summary | residualRisk | recommendedDecision |
| --- | --- | --- | --- | --- | --- |
| PHASE4-SEQUENCE-SAFE-SAVE-AS-BLOCKED | sequence-frame anti-flicker | resolved_for_current_supported_fixture | Product repaired-copy Save As, saved hash binding, source immutability, full affected-frame alpha proof, reopen playback, and fail-closed unsafe cases are now validated. | The svga-web product proof records `playbackDeltaObserved=true`: target frame 23 changed at canvas level and target frame 24 remained stable because the repaired target is a four-pixel near-empty speck; the exact alpha proof records `img_14` changing from 4 non-transparent pixels to 0. | Product Owner should decide whether the alpha-proofed repaired-copy path is acceptable for Workbench v1, and whether a future visual-delta threshold is required for larger real-world repairs. |

## No Current Product-Direction Blocker

The Product Owner has authorized ordinary UI, implementation, architecture,
test, refactor, naming, and workflow decisions for this autonomous run.
