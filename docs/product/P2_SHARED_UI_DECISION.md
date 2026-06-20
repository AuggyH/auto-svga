# P2 Shared UI Decision

Date: 2026-06-20
Milestone: P2 — Desktop Product Shell And Web Preview Parity

## Decision

Share data contracts, inspection presentation, localization labels, and visual
tokens. Keep Web preview and Electron shell as separate hosts.

This avoids a framework migration while preventing the desktop client from
inventing a second product language.

## Shared Now

1. `renderAvatarFrameInspectionReport` from
   `tools/svga-player-preview/inspection-report-view.mjs`.
2. Motion Asset Audit presentation and localization bundle through the existing
   workbench report contract.
3. Web-derived design tokens translated into Electron CSS custom properties.
4. Artifact metadata schema for product evidence.
5. Report-driven metadata extraction.

## Kept Separate

1. Electron main/preload/IPC and local file boundaries.
2. Electron player host using local vendored `svga-web@2.4.4`.
3. Web preview comparison mode, reference media mode, and browser drag/drop
   behavior.
4. Desktop-only shortcuts: Cmd/Ctrl+O, Space, R.
5. P2 screenshot/proof harness.

## Why

1. The inspection report renderer is already host-neutral enough to reuse.
2. Moving all Web UI into Electron would risk browser rollback.
3. A new component framework would be disproportionate for P2.
4. P2 needs visual convergence, not a new shared UI platform.

## Drift Prevention

1. P2 parity report records product identity, color tokens, typography,
   spacing, panel hierarchy, player workspace, controls, metadata, inspection,
   empty state, and invalid state.
2. P2 screenshots include Web reference and desktop states in the same artifact
   bundle.
3. Tests assert the desktop title no longer uses `Internal Baseline` as the
   primary product title.
4. Tests assert calibration is collapsed and invalid errors are productized.
5. Browser rollback tests remain part of validation.

## Rollback

Browser workflow remains available through `npm run local:preview`. P2 must not
change the Web player or CLI default flow.
