# P4 Multi-Resource Editing Audit

## Purpose

Audit the accepted P3 image-resource editor before P4 implementation. P4 must
prove multi-resource replacement, undo/redo, save-point dirty state, async
ordering, and exported-file integrity without expanding into a general SVGA
editor.

## Current Capability

- `src/workbench/svga/image-resource-editor.ts` can discover embedded image
  resources with stable keys, dimensions, hashes, and usage count.
- `replaceImages()` already accepts an array of replacements and internally
  builds a `Map<resourceKey, replacement>`.
- Electron renderer state currently keeps `replacementInputs` as a `Map`, so the
  UI data model can hold multiple replacements.
- The server endpoint `/api/svga-image-replace` accepts `replacements[]` and
  passes them through to the editor.
- P3 Save As uses the latest edited bytes and can reopen the exported file.
- P3 thumbnails are rebuilt from resource bytes and can prove original,
  replacement, reset, and reopened states for one selected resource.

## Current P3 Boundary

- P3 was accepted only as a single-resource vertical editing loop.
- P3 `round-trip-report.json` is schemaVersion 2 and exposes singular fields:
  `replacedResourceKey`, `originalResourceSha256`, `replacementSha256`, and
  `exportedResourceSha256`.
- P3 `buildRoundTripReport()` records `changedFields` for all replacements but
  validates selected-resource equality through the first replacement only.
- Remaining replacement keys are excluded from untouched-resource checks but do
  not receive per-item exported equality checks.
- P3 visual smoke proves one selected resource, not two simultaneous
  replacements.
- P3 dirty state is `replacementInputs.size > 0 && editExportState !== "saved"`;
  this is not a save-point revision model.
- P3 reset operations mutate the replacement map directly and are not undoable.
- P3 preview requests are not guarded by a durable operation sequence, so stale
  async responses can still be a P4 risk.

## Multi-Resource Risk

1. `replaceImages()` accepts multiple replacements.
2. Renderer uses a replacement `Map`.
3. Current round-trip report only checks the first replacement via singular
   fields.
4. Remaining replacements are excluded from untouched-resource checks but have no
   per-item replacement equality.
5. P4 must fix this and cannot rely on "code seems to apply all".

## Undo/Redo Impact

- Current renderer edit state is mutation-based, not transaction-based.
- P4 needs a host-neutral session model with transaction records, history cursor,
  revision digest, save-point digest, and capped history.
- Invalid replacement or failed preview must not move the history cursor.
- New edits after undo must discard the redo branch.

## Save-Point Impact

- Dirty must compare current revision digest with saved revision digest.
- Successful Save As records the exported revision as the save point only after
  decode, playback smoke, per-resource integrity, and original immutability pass.
- Reopened export starts a new clean session.
- After Save As, another edit must make the session dirty again.

## Export Impact

- P4 needs schemaVersion 3 `multi-resource-round-trip-report.json`.
- Every replacement needs per-key original hash, replacement hash, exported hash,
  usage count, dimensions, key-presence, sprite-reference, and pass status.
- Untouched resources need per-key original/exported hash equality.
- Movie params, sprite imageKey/matteKey refs, frame count, transform, alpha,
  layout, clipPath, shapes, audios, and resource key set remain protected.

## P4 Action

1. Add a host-neutral multi-resource edit session/history model.
2. Upgrade round-trip reporting to schemaVersion 3 while preserving P3
   single-resource regression coverage.
3. Add canonical synthetic multi-resource fixture and replacement PNGs.
4. Wire undo/redo, reset selected, reset all, save-point dirty, and async guards
   into Electron.
5. Generate final Electron visual evidence and require true independent
   Reviewer B judgment.
