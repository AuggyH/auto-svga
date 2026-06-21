# P6 Web Product Baseline

Date: 2026-06-22
Baseline commit: `d16fb380c0ff82b9aca3af58b0335708e0b0ef73`
Source: running Web Preview on local preview server, captured with Chrome CDP
Route: `http://127.0.0.1:4187/tools/svga-player-preview/`

## Fixture

Approved synthetic fixture:

- SVGA: `examples/avatar_frame_basic/output/avatar_frame_basic.svga`
- SVGA SHA-256: `ba61641e4faf4e749baf2c9bcecd0cba5f1c460ffdcb147460168ed3c11c012c`
- SVGA size: `107034` bytes
- Report: `examples/avatar_frame_basic/output/report.json`
- Report SHA-256: `06bf6338b6e3952c646854fc5ec8d7ce0d637f0155840b2415606769f06619d8`
- Reference fallback: `examples/avatar_frame_basic/output/preview.gif`
- Reference GIF SHA-256: `40ba71d4f7cf95f8230bd3ce3a31a94c81159206c001f6a2c253e622b7bad905`

The generated example has `preview.gif` as reference fallback. No `preview.webm` or `preview.mp4` exists for this fixture at baseline.

## Captured States

Baseline artifacts live under `.artifacts/product/P6/web-baseline/`.

Tracked contract files reference these generated artifacts but do not commit the binary screenshots.

Captured state screenshots:

- `screenshot-local-empty-1440x900.png`
- `screenshot-export-review-loaded-1440x900.png`
- `screenshot-info-overview-1440x900.png`
- `screenshot-info-assets-1440x900.png`
- `screenshot-logs-1440x900.png`
- `screenshot-settings-1440x900.png`
- `screenshot-local-compare-empty-1440x900.png`
- `screenshot-export-review-loaded-900x720.png`
- `screenshot-export-review-loaded-1440x900.png`

Machine-readable artifacts:

- `artifact-index.json`
- `dom-manifest.json`
- `computed-styles-manifest.json`
- `interaction-trace.json`
- `motion-manifest.json`

## Baseline Coverage

- DOM snapshots: 13
- UI regions per snapshot: 24
- Controls observed: 77 empty/local controls, 81 loaded/export-review controls
- Computed style selectors: 28
- Interaction trace steps: 10
- CSS keyframes: 9
- Reduced-motion CSS present: yes

## Baseline Notes

- Web baseline was captured on a fallback port because the default preview port was occupied.
- The capture used the real Web Preview server and page, not static README content.
- Playback visual success is not asserted automatically by this baseline. It remains a later parity/human-acceptance concern.
- P3-P5 editor incubation is not part of the required Web parity surface.

## Blockers For Later P6 Work

- Final P6 still needs Web/Desktop matched screenshots, motion frame strips, and Reviewer B isolation.
- Final P6 still needs Desktop evidence for every required Web region, feature, state, interaction, and motion.
