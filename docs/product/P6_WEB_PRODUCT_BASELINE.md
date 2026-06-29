# P6 Web Product Baseline

Date: 2026-06-22
Baseline commit: `dbab38fc7fc3cad09f6305775467422ded63318c`
Source: running Web Preview on local preview server, captured with hidden Electron runtime
Route: `http://127.0.0.1:4190/tools/svga-player-preview/`

## Current P6-R1 Role

This baseline is historical lineage, required inventory, and rollback reference
for P6-R1. It is not the active P6-R1 product source of truth after
owner-authorized Workbench revisions. Current evidence and owner handoff should
bind to the shared Product Workbench on the final P6-R1 head while preserving
the required inventory counts from this baseline.

## Fixture

Approved synthetic fixture:

- SVGA: `examples/avatar_frame_basic/output/avatar_frame_basic.svga`
- SVGA SHA-256: `ba61641e4faf4e749baf2c9bcecd0cba5f1c460ffdcb147460168ed3c11c012c`
- SVGA size: `107034` bytes
- Report: `examples/avatar_frame_basic/output/report.json`
- Report SHA-256: `e0de3a8f4aaa04a3074051749f6f77dcef0e0515d09f74ac3d6bbe57f1e879b6`
- Reference fallback: `examples/avatar_frame_basic/output/preview.gif`
- Reference GIF SHA-256: `40ba71d4f7cf95f8230bd3ce3a31a94c81159206c001f6a2c253e622b7bad905`

The generated example has `preview.gif` as reference fallback. No `preview.webm` or `preview.mp4` exists for this fixture at baseline.

## Captured States

Baseline artifacts live under `.artifacts/product/P6/web-baseline-r4/`.

Tracked contract files reference these generated artifacts but do not commit the binary screenshots.

Captured state screenshots:

- `screenshot-local-empty-1440x900.png`
- `screenshot-mode-menu-open-1440x900.png`
- `screenshot-loading-1440x900.png`
- `screenshot-loaded-1440x900.png`
- `screenshot-playing-1440x900.png`
- `screenshot-paused-1440x900.png`
- `screenshot-export-review-loaded-1440x900.png`
- `screenshot-latest-artifact-loaded-1440x900.png`
- `screenshot-reference-media-loaded-1440x900.png`
- `screenshot-info-overview-1440x900.png`
- `screenshot-info-assets-1440x900.png`
- `screenshot-asset-preview-modal-1440x900.png`
- `screenshot-logs-1440x900.png`
- `screenshot-settings-1440x900.png`
- `screenshot-accessibility-toggles-on-1440x900.png`
- `screenshot-settings-closed-by-escape-1440x900.png`
- `screenshot-synchronized-playback-toggled-by-space-1440x900.png`
- `screenshot-local-compare-empty-1440x900.png`
- `screenshot-local-compare-loaded-1440x900.png`
- `screenshot-export-review-loaded-900x720.png`
- `screenshot-invalid-1440x900.png`
- `screenshot-recovered-from-invalid-1440x900.png`

Machine-readable artifacts:

- `artifact-index.json`
- `dom-manifest.json`
- `computed-styles-manifest.json`
- `interaction-trace.json`
- `motion-manifest.json`

## Baseline Coverage

- DOM snapshots: 22
- UI regions per snapshot: 20
- Controls observed: capture records buttons, inputs, labels, menu items, and live status regions; counts are stored per state in `interaction-trace.json`.
- Computed style selectors: 19
- Interaction trace steps: 22
- CSS keyframes: 9
- Reduced-motion CSS present: yes
- Artifact index entries: 54
- External request audit: 2 CDN script requests for the current browser Web player baseline

## Baseline Notes

- Web baseline was captured on a fallback port to avoid disturbing any existing local preview session.
- The capture used the real Web Preview server and page, not static README content.
- The browser Web Preview still requests CDN copies of `pako@2.1.0` and `svgaplayerweb@2.3.1`; this is recorded as current Web baseline behavior, not approved Electron production behavior.
- Playback visual success is not asserted automatically by this baseline. It remains a later parity/human-acceptance concern.
- P3-P5 editor incubation is not part of the required Web parity surface.

## Blockers For Later P6 Work

- Final P6 still needs Web/Desktop matched screenshots, motion frame strips, and Reviewer B isolation.
- Final P6 still needs Desktop evidence for every required Web region, feature, state, interaction, and motion.
