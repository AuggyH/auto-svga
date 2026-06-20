# P3 Implementation Plan

Date: 2026-06-20
Milestone: P3 — Basic Image Resource Replacement And Save As
Contract commit: `650dd12`

## Goal

Build one safe vertical editing loop:

open supported SVGA -> list image resources -> replace one PNG resource ->
live preview -> dirty/reset -> Save As -> reopen exported SVGA -> prove the
original file is unchanged and round-trip invariants pass.

## Guarded Scope

Allowed:

- Host-neutral image-resource edit model.
- Restricted SVGA image-byte round-trip helper.
- PNG validation using existing local capabilities.
- Electron prototype editing panel and narrow Save As IPC.
- P3 tests, smoke scripts, screenshots, reports, and packet artifacts.

Protected:

- Main Web preview player behavior.
- Existing SVGA exporters and CLI default flow.
- Browser import, drag/drop, comparison, and `local:preview` rollback.
- P2 product shell hierarchy.
- No real user assets, local absolute paths, AI, telemetry, network analysis,
  installer, signing, or release.

## Architecture

### 1. Host-neutral edit core

Add a small module under `src/workbench/` or `src/workbench/svga/`:

- Decode compressed SVGA bytes with `proto/svga.proto`.
- Build an edit session model from known `MovieEntity` fields.
- List image resources by stable `resourceKey`.
- Compute resource hashes and usage counts.
- Validate PNG replacement.
- Apply replacement bytes to existing image keys.
- Encode and deflate edited movie bytes.
- Re-decode edited bytes and compare invariants.

The core must not depend on DOM, Canvas, Electron, shell, browser APIs, or
filesystem paths.

### 2. P3 supported subset

Support files that:

- inflate and decode with the repository proto
- contain image resources in `MovieEntity.images`
- reference image keys from sprites or matte keys
- preserve all known-field invariants after replacement and re-encode

Reject files that:

- fail inflate/decode
- have no image resources
- request replacement for a missing resource key
- fail PNG validation
- fail post-export invariant comparison
- require arbitrary unknown-field preservation to claim safety

### 3. Electron host boundary

Extend the isolated `svga-web` Electron prototype with minimal IPC:

- Choose PNG replacement through controlled dialog or renderer file input.
- Save edited SVGA through controlled Save As IPC.
- Reject same path as original when a host path is known.
- Write to a temporary file and rename into place.
- Redact paths from UI, logs, reports, and artifacts.
- Keep `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true`.

The renderer must not receive broad filesystem access.

### 4. Renderer editing flow

Extend `tools/electron-prototype/experiments/svga-web/web/prototype.js`:

- Keep player-first layout.
- Add a compact `检查 / 编辑` area.
- Render resource list with key, dimensions, size, hash prefix, usage count,
  role, replacement status.
- Select a resource.
- Replace PNG.
- Rebuild edited SVGA bytes and remount player.
- Mark dirty state.
- Reset selected resource.
- Reset all resources.
- Save As through host boundary.
- Reopen exported bytes and show export success.

No raw protobuf JSON should become primary UI.

### 5. Live preview evidence

Machine proof must show:

- original canvas nonblank
- edited canvas nonblank
- original screenshot hash differs from edited screenshot hash
- replacement hash appears in edit model
- selected resource reference is unchanged
- untouched image hashes are unchanged
- old player/parser lifecycle is cleaned before remount

### 6. Save As and round-trip validation

Save As must:

- default to `<original-name>-edited.svga`
- allow only `.svga`
- reject original target path
- use temp file and safe rename
- clean temp output on failure
- decode exported bytes
- load exported bytes in the local player
- generate `.artifacts/product/P3/round-trip-report.json`

Round-trip report must block success when `unexpectedChanges` is not empty.

## Test Plan

### Targeted source tests

Add tests for:

- resource discovery and stable keys
- usage count from `imageKey` / `matteKey`
- PNG validation and rejection cases
- replacement hash update
- untouched image hash preservation
- sprite reference preservation
- params/frame/layout/transform/alpha invariants
- unsupported round-trip rejection
- original bytes unchanged

### Electron/prototype tests

Extend existing isolated tests to cover:

- editing UI exists and is productized
- replacement status and dirty state
- reset selected/reset all controls
- Save As IPC is narrow and validated
- security settings remain unchanged
- renderer still lacks `fs`, shell, and broad IPC
- no CDN or external request

### Smoke checks

Run:

- original load
- replacement preview
- reset
- Save As
- exported reopen
- invalid PNG state
- browser rollback smoke

## Visual Artifacts

Generate `.artifacts/product/P3/`:

- `original-loaded.png`
- `resource-list.png`
- `replacement-selected.png`
- `replacement-preview.png`
- `dirty-state.png`
- `reset-to-original.png`
- `export-success.png`
- `reopened-export.png`
- `invalid-png-state.png`
- `original-edited-comparison.png`
- `round-trip-report.json`
- `resource-edit-report.json`
- `artifact-index.json`

Use approved synthetic fixture and approved synthetic replacement PNG only.

## Risks

1. `protobufjs` does not preserve unknown fields.
   - Mitigation: restricted subset and invariant comparison.
2. `svga-web` parser/player API may not support direct in-memory resource
   mutation.
   - Mitigation: rebuild edited SVGA bytes and remount player.
3. Save As can accidentally leak absolute paths.
   - Mitigation: path redaction and artifact privacy audit.
4. P3 visual proof can be misleading if the selected resource is not visible.
   - Mitigation: use an approved fixture/replacement pair with visible pixel
     difference and screenshot hash comparison.

## Validation Order

1. Implement edit core and targeted unit tests.
2. Implement Electron host boundary and static security tests.
3. Implement renderer UI and lifecycle tests.
4. Run source unit tests.
5. Run Electron editing smoke.
6. Run exported-file reopen smoke.
7. Run browser rollback smoke.
8. Generate preliminary P3 artifacts.
9. Run preliminary `npm run loop:validate`.
10. Run preliminary Reviewer A/B.
11. Repair blockers within budget.
12. Commit terminal source state.
13. Run final `npm run loop:validate` twice.
14. Regenerate final artifacts and review packet.
15. Run Reviewer A/B and post-seal verifier.
16. Generate final upload ZIP and privacy audit.

## Rollback

If P3 implementation cannot prove safe round-trip:

- keep P3 branch and artifacts
- set terminal state to `HUMAN_REQUIRED`
- use gate type `TECHNICAL_REVIEW_REQUIRED`
- recommend either restricted fixture-only support or a separate round-trip
  compatibility milestone

No P3 change should require rollback of P2 browser or desktop preview.
