# P6 Machine vs Human Gates

This is a retrospective-only gate split for future P6-R1 planning.

## Machine Must Prove

| Gate | Required proof |
| --- | --- |
| Shared source hashes | Web and Desktop use expected shared source hashes. |
| Host reachability | Host adapter methods are reachable through validated IPC/bridge. |
| File load | File bytes are actually loaded, not just selected. |
| State before/after | Every state transition has before and after snapshots. |
| Loading hides Empty CTA | Loading state hides Empty action and shows loading phases. |
| Invalid clears old state | Canvas, metadata, file badge, report, and ready status are cleared. |
| Interaction trigger | User action is actually fired; state changes after the event. |
| Motion target exists | Motion target selector exists in matching Web/Desktop state. |
| Motion parameters exist | Duration, easing, reduced-motion behavior, and sampled frames are recorded. |
| App startup/exit | Packaged app launches without smoke/proof flags and exits cleanly. |
| Security/cleanup/privacy | No CDN, no telemetry, no arbitrary file serving, temp cleanup, log/path redaction. |
| DOM/geometry/style | DOM presence, visible region geometry, computed styles, and control states are captured. |
| Final head binding | Git HEAD, loop ledger, evidence index, manifest, review packet, and parity report agree. |

## Human Must Judge

- Overall Web/Desktop visual match.
- Font rendering differences.
- Motion feel and timing.
- Visual hierarchy.
- Whether the app feels ready for daily internal use.
- Actual double-click Finder experience.

## Machine Must Not Claim

- Pixel-perfect visual quality PASS.
- Motion quality PASS.
- Owner acceptance.
- Production desktop readiness.

These require an owner-approved method or human judgment.

## Human Must Not Replace

- Whether a file actually loaded.
- Whether stale state was cleared.
- Whether a button was clicked.
- Whether a local request used CDN.
- Whether a packaged App launched.
- Whether registry/packet/evidence heads match.

## Current P6 Machine Gate Risks

R2 found current R6 evidence still has open machine-gate risks:

- Motion parity can pass when normal Web start/mid/end frames are identical if
  reduced-motion evidence exists.
- State parity can pass with overly broad aliases and pixel-difference
  tolerance of `1`.
- Interaction parity can report same mode/panel/modal controls while Web and
  Desktop context values differ.
- Reviewer B can still overweight packet consistency over product observation.
- Final loop ledger does not record the final current head `1977cbc`.

These do not automatically invalidate all P6 progress, but they block treating
machine PASS as owner acceptance.

## Required Future Gate Types

Use separate fields instead of a single overloaded `PASS`:

- `machineEvidenceStatus`
- `productParityStatus`
- `reviewerPacketStatus`
- `reviewerProductStatus`
- `ownerGateStatus`
- `phase2Status`

If any required machine gate fails or is untrusted, terminal state must be
`TECHNICAL_REVIEW_REQUIRED`, not owner-acceptance-only.
