# Web Preview Historical Product Baseline

Date: 2026-06-22
Applies to: P6 Web Preview Full Parity, Shared Frontend And macOS Internal App

## Rule

The frozen Web Preview baseline was the product source of truth for the original
P6 parity attempt. For P6-R1 it is historical lineage, required inventory, and
rollback reference only. It is not the active product ceiling after
owner-authorized shared Workbench revisions.

The current P6-R1 shared Product Workbench on the final head is the
owner-visible source of truth for evidence, review, and handoff.

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

Host differences must not remove required product capability, UI regions,
interactions, states, motion, or report content. Owner-authorized Workbench
improvements may advance the current product surface beyond this historical
Web Preview baseline.

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

P6-R1 cannot claim owner-ready Workbench evidence if:

- a required feature is missing on Web or Desktop
- a required UI region is missing on Web or Desktop
- a required interaction is missing on Web or Desktop
- a required state is missing on Web or Desktop
- a required motion is missing on Web or Desktop
- an unapproved difference remains unresolved
- Electron uses an imitation product page instead of the shared product frontend
