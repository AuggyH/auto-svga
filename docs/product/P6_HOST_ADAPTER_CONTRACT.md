# P6 Host Adapter Contract

Date: 2026-06-22

## Purpose

Host adapters isolate Web and Electron environment differences while preserving the same product frontend.

## Shared Product Actions

The shared frontend may request:

- open primary SVGA
- open secondary SVGA
- open reference media
- inspect avatar-frame SVGA bytes
- load latest artifact metadata
- save or download generated output
- read environment capabilities
- emit local diagnostics

## WebHostAdapter

Allowed capabilities:

- read files selected by browser input
- read files dropped into the page
- call Web Preview HTTP endpoints
- create object URLs
- trigger browser downloads

Prohibited:

- arbitrary local filesystem paths
- shell access
- hidden network upload
- telemetry

## ElectronHostAdapter

Allowed capabilities:

- main-process file dialog
- validated drag/drop paths
- validated IPC
- Save As through host boundary
- local-only static assets
- App lifecycle cleanup

Prohibited:

- renderer arbitrary filesystem access
- renderer shell or command execution
- remote scripts
- remote navigation
- public-network server exposure
- persisted absolute paths in reports or logs
- telemetry

## Adapter Parity Rule

Adapters may differ in how files are obtained. They must not differ in product outcome:

- same visible report semantics
- same player controls
- same inspection presentation
- same Motion Asset Audit presentation
- same error semantics
- same required UI states and motion
