# P4 Final External Product Review

milestoneId: P4
externalOutcome: PASS
ownerDecision: ACCEPT_P4_AND_CONTINUE
reviewedHeadCommit: fc5e953f6f96a4eb49776af6c5166bd2c2c4f4c4
reviewedPacket: review/P4-latest/P4-fc5e953-upload.zip
reviewedAt: 2026-06-21T04:08:23Z

## Summary

P4 is accepted as the bounded multi-resource embedded PNG editing milestone for
the isolated Electron prototype.

The accepted scope includes multi-resource replacement, undo/redo, reset
selected/all, save-point state, Save As, reopened export proof, schemaVersion 3
round-trip validation, Reviewer A/B checks, and the visible P4 review packet.

## Accepted Capabilities

- Multi-resource embedded PNG replacement for the synthetic avatar-frame SVGA
  fixture.
- Per-resource replacement integrity checks with untouched resource invariants.
- Atomic edit history for replace, reset selected, reset all, undo, and redo.
- Save-point dirty state based on replacement digest.
- Save As guarded by active validated revision and reopened output checks.
- Visible review handoff under `review/P4-latest`.

## Nonblocking Debt

- P4 portable handoff addendum was missing before this acceptance closeout.
- P4 remains a bounded embedded PNG editor, not a general SVGA editor.
- Browser workflow remains the stable rollback path.
- Later milestones must not treat P4 acceptance as approval for new format
  parsers, format conversion, production desktop release, or automatic repair.

## Decision

The product owner accepts P4 and authorizes continuing to the NQ1-R1 hardening
repair and then P5 batch PNG replacement planning if NQ1-R1 passes.
