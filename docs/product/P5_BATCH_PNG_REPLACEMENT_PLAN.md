# P5 Batch PNG Replacement Plan

## Goal

Add a bounded batch PNG replacement workflow to the existing SVGA image editor.
The workflow remains local, deterministic, reviewable, and reversible.

## Implementation Layers

1. Core mapping model
   - Validate selected PNG files.
   - Compute filename labels, dimensions, size, and SHA-256.
   - Produce deterministic mapping statuses and reasons.
   - Keep absolute paths out of UI, reports, packets, and ZIPs.

2. Edit history
   - Add `batch_replace_resources` as one transaction.
   - Preserve before/after replacement state and replacement set digest.
   - Keep undo/redo and save-point dirty semantics.

3. SVGA round-trip report
   - Add schemaVersion 4 for P5.
   - Record every applied mapping separately.
   - Verify replacement hashes, untouched resources, invariants, source
     immutability, exported reopen, decode, playback, and nonblank smoke.

4. Desktop prototype UI
   - Add a batch replacement entry.
   - Show mapping review with status badges, dimensions, warnings, include
     checkbox, manual target selector, Apply batch, and Cancel.
   - Do not expose raw protobuf JSON or absolute paths.

5. Product evidence
   - Generate synthetic fixture, screenshots, JSON reports, edited SVGA, review
     packet, and privacy-clean upload ZIP.

## Explicit Non-goals

- No automatic crop, resize, cover, contain, or resampling.
- No fuzzy matching, semantic matching, or visual similarity matching.
- No text, timeline, transform, or effect editing.
- No cloud, account, telemetry, AI, or network analysis.
- No new format parser, conversion, export workbench, or production release.

## Verification

- Targeted TypeScript tests for mapping, validation, batch history, and
  round-trip report.
- Electron prototype static and smoke checks for batch UI and Save As flow.
- Root `npm test`.
- Two final `npm run loop:validate` runs on final source state.
- P5 final packet and upload ZIP privacy audit.
