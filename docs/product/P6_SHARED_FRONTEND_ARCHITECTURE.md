# P6 Shared Frontend Architecture

Date: 2026-06-22

## Goal

Web and Electron must render the same Auto SVGA product surface from shared source.

Desktop parity must come from reuse, not screenshot imitation.

## Required Shape

```text
Shared Product Frontend
├── page regions
├── UI components
├── CSS / design tokens
├── interaction state machine
├── UI motion definitions
├── player controls
├── inspection presentation
├── Motion Asset Audit presentation
└── host-neutral product actions

Host Adapter
├── WebHostAdapter
└── ElectronHostAdapter
```

## WebHostAdapter

Responsible for:

- browser file input and drag/drop
- Web Preview server API calls
- browser download behavior
- browser environment metadata

## ElectronHostAdapter

Responsible for:

- controlled local file open
- controlled drag/drop path boundary
- Save As
- native menu
- file association
- secure IPC
- local-only runtime lifecycle

## Sharing Rules

- Share product page source.
- Share core CSS and design tokens.
- Share interaction state machine.
- Share motion definitions.
- Share player control behavior.
- Share inspection report presentation.
- Share Motion Asset Audit presentation.
- Keep host differences behind adapters.
- Do not duplicate inspection business logic in UI.
- Do not duplicate report logic in Electron.
- Do not keep an imitation Electron product page as the default surface.

## P6 Dependency

A2 may implement shared frontend only after A1 Web baseline and parity contract are integrated into `agent/codex/p6-integration`.
