# P6 External Product Review 5

Date: 2026-06-23

## Result

- externalOutcome: `REPAIR_REQUIRED`
- reviewedHeadCommit: `f1ecd57320fc82b83119bd822653057904158b6a`
- currentRepairRound: `5`
- nextRepairRound: `6`
- productOutcome: `PRODUCT_SURFACE_ADVANCED_BUT_PARITY_EVIDENCE_AND_NORMAL_APP_PROOF_INVALID`

## Required Repair 6 Scope

Repair 6 is the final repair round allowed by the frozen P6 milestone budget.
Existing P6 work must be preserved. Phase 2 must remain `NOT_STARTED`.

## Blocking Findings

1. Desktop Loading screenshot still shows Empty UI.
2. Loading DOM proof contradicts the actual screenshot.
3. State comparison only checks present, nonblank, and different hash.
4. Web/Desktop comparison uses different viewport, state, side panel, and media loading state.
5. Feature parity mainly relies on item ID, artifact existence, and generic state.
6. No Desktop per-interaction action trace exists.
7. The second SVGA has no actual loaded/playback parity proof.
8. Reference media has no actual loaded/playback parity proof.
9. Latest artifact has no actual scan -> select -> load parity proof.
10. Motion evidence only checks that three frames exist, not the same trigger and state.
11. `modalIn` Web frames do not show a modal while Desktop frames do.
12. Normal App proof uses `AUTO_SVGA_P2_NORMAL_PROOF`.
13. Normal App reports `windowShown=false`.
14. Normal App reports `normalVisibleStartup=false`.
15. `reviewer-b-product-categories` has every category as `HUMAN_REQUIRED`.
16. Generic `reviewer-b.json` returns `PASS` despite category-level `HUMAN_REQUIRED`.
17. Registry final HEAD points at an intermediate commit rather than the reviewed final HEAD.
18. `terminalHandoffReady` was set too early.
19. Required state inventory omits real Web product states.

## Repair Rule

Repair 6 may run internal implement/validate/review/repair loops, but it must
not create Repair 7. If completion gates still fail, terminal state must be
`HUMAN_REQUIRED` with `gateType: TECHNICAL_REVIEW_REQUIRED`.
