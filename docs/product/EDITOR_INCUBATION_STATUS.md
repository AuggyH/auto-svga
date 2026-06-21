# Editor Incubation Status

Date: 2026-06-22

## Status

P3, P4, and P5 are preserved as editor incubation work.

They are not deleted, abandoned, or marked as failed. P5 is also not accepted as product PASS.

## Current Classification

- P3: basic image resource editing, preserved for later replaceable-element editing.
- P4: multi-resource edit history, preserved for later editor state and Undo/Redo.
- P5: batch PNG replacement and mapping, deferred as editor incubation.

## P5 Owner Reset

P5 product acceptance is deferred because the active product mainline is now Web Preview full desktopization.

P5 Repair 3 is canceled. P5 work remains useful for Phase 3, but it must not expand the default P6 Desktop product surface.

## P6 Product Boundary

Default P6 Desktop product:

- shows the Web Preview parity surface
- does not expose P3-P5 editor UI by default
- may keep P3-P5 code and tests
- may expose editor incubation only behind an explicit developer feature flag
- keeps that flag off by default

## Future Reconnection

Phase 3 may reconnect:

- resource discovery
- replacement engine
- Undo/Redo
- Save As
- round-trip validation
- multi-resource mapping

Reconnection requires a new accepted milestone contract.
