# Auto SVGA AEB Panel Development Package

This directory contains the source layout for the local development AE panel.

Scope:

- Hidden/local AEB development package only.
- One dev/pilot-only `Prepare Pilot Scratch` action that establishes an empty
  unsaved scratch comp through the CEP `evalScript` bridge, avoiding the native
  `Run Script File` dialog.
- One bounded `Export to Auto SVGA` action for the active composition.
- One dev/pilot-only fixed semantic inbox at
  `/private/tmp/auto-svga-aeb-dev/semantic-inbox/request.json`. A valid,
  expiring, one-time request must name the target AE host before it can invoke
  the existing scratch and metadata export entrypoints, even when AE does not
  render the floating panel surface.
- Metadata-only package/report writing through the existing AEB package shape.
- No source project save, render, bake, relink, collect, network, installer, or
  support claim.

For concurrent local debugging, the AE 26.3 isolated extension overlay uses
bundle `local.auto-svga.aeb.panel.ae26.dev`, extension
`local.auto-svga.aeb.panel.ae26.dev.export`, and the separate inbox
`/private/tmp/auto-svga-aeb-dev/semantic-inbox-ae26/request.json`. The legacy
development extension keeps its existing identity and inbox. This prevents an
already-running AE 25.5 panel from observing or consuming the AE 26.3 request.

The semantic inbox accepts only `prepare-scratch-and-export-metadata` requests
bound to the development panel identity, an explicit AEFT 26.3 target host, and
a fresh task-owned output root. The host check is first: the panel normalizes
`app.version` by reading only the leading major/minor numbers, so a value such
as `25.5x4` is treated as AEFT 25.5 and leaves an AEFT 26.3 request pending
byte-for-byte with the normal idle result. Malformed or ambiguous target-host
fields fail before project or filesystem mutation. Target-host matches then
continue through the stale, future, replayed, malformed, aliased, install-like,
user-path, and unsafe-project checks before project or filesystem mutation.
Successful requests are renamed atomically to a `consumed-<requestId>.json`
sibling and produce a redacted receipt beside the scratch marker.

Install is not performed by this repository gate. A later PM permit must name
the exact AE app, copied sample folder, foreground lease, install path, rollback
scope, and cleanup rule before any system or user AE directory is modified.
