# P1 Implementation Plan

Milestone: P1 - Electron Desktop Mainline Baseline: Local SVGA Open, Playback And Inspection

## Goal

Turn the existing isolated Electron `svga-web` prototype into a bounded internal desktop baseline that supports ordinary local SVGA open, playback, inspection, and Motion Asset Audit review.

## Scope

Allowed:

- Add explicit desktop entry scripts.
- Keep all player assets local and vendored.
- Add product-like empty, loaded, inspection, and invalid-file states.
- Add play, pause, and replay controls.
- Add compact file information.
- Add product smoke screenshots under ignored `.artifacts/product/P1`.
- Keep browser workflow as rollback.

Not allowed:

- No production desktop approval.
- No installer, signing, notarization, auto-update, telemetry, cloud sync, or account system.
- No format conversion, export workbench, automatic repair, or new format parser.
- No replacement of the main Web preview player.
- No SVGA exporter or CLI default-flow changes.

## Implementation Steps

1. Preserve the isolated Electron shell security boundary.
   - Validate with static tests and smoke.

2. Add root and experiment-level desktop commands.
   - `npm run desktop:dev`
   - `npm run desktop:smoke`

3. Split normal mode from smoke mode.
   - Normal mode starts at empty state.
   - Smoke mode loads synthetic fixture and captures P1 review artifacts.

4. Add user-facing local file states.
   - File picker import.
   - Drag-and-drop import.
   - Invalid extension and corrupt SVGA errors.
   - Second-file cleanup before reload.

5. Add playback controls and file summary.
   - Play.
   - Pause.
   - Replay.
   - Filename, size, canvas, fps, frames.

6. Generate visual review artifacts.
   - `empty-state.png`
   - `valid-svga-loaded.png`
   - `inspection-panel.png`
   - `invalid-file-state.png`
   - `artifact-index.json`

## Validation Plan

- Electron prototype static tests.
- Electron source product smoke.
- P1 visual artifact existence and index checks.
- Web preview syntax check.
- `npm run loop:validate`.
- `git diff --check`.

## Human Review

Machine checks can prove local loading, nonblank canvas, report rendering, and screenshot generation. Human review is still required for visual acceptability of the captured app states and playback appearance.
