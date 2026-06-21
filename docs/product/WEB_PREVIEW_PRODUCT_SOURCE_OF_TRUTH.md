# Web Preview Product Source Of Truth

Date: 2026-06-22
Applies to: P6 Web Preview Full Parity, Shared Frontend And macOS Internal App

## Rule

The frozen Web Preview baseline is the product source of truth for P6.

Electron may differ only in host behavior:

- native window
- macOS menu
- Finder file choose
- drag/drop file boundary
- File > Open
- Save As
- macOS shortcuts
- `.svga` file association
- Electron main/preload/renderer security boundary
- no browser address bar
- no manual server start

Host differences must not remove product capability, UI regions, interactions, states, motion, or report content.

## Required Baseline Inventory

A1 must freeze:

- Web entry and server entry
- visible page regions
- feature inventory
- interaction inventory
- product state inventory
- UI motion inventory
- keyboard and focus behavior
- inspection report behavior
- Motion Asset Audit behavior
- comparison and import behavior
- responsive behavior
- server APIs used by Web product

The inventory must be based on the running Web Preview at the baseline commit, not memory, old screenshots, or prior review text.

## Artifact Rules

Baseline artifacts must use approved synthetic fixtures. Do not commit real user assets.

Every artifact must record:

- baseline commit
- source
- route or URL
- fixture
- state
- viewport
- selectors
- SHA-256
- generatedAt

## Blocking Conditions

P6 cannot claim parity if:

- a required Web feature is missing on Desktop
- a required UI region is missing on Desktop
- a required interaction is missing on Desktop
- a required state is missing on Desktop
- a required motion is missing on Desktop
- an unapproved difference remains unresolved
- Electron uses an imitation product page instead of the shared product frontend
