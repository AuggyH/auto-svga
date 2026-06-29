# SVGA Workbench v1 Status

Date: 2026-06-30
Branch: `agent/codex/svga-workbench-v1-autonomous`
Baseline commit: `545252838311233cc03ce2e5f917e53d43207589`

## Authorization

Product Owner authorized autonomous SVGA Workbench v1 execution beyond the prior
P6-R1 human-gate/UI-polish loop. The old P6-R1 loop state remains archived as a
terminal human-gate record; it is not used as a blocker for Phase 2-4 product
work in this dedicated autonomous branch.

## Phase Matrix

| Phase | Status | Evidence |
| --- | --- | --- |
| Phase 1 stabilization baseline | Baseline pass, continue hardening only when gaps are found | `npm run desktop:smoke`; `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`; package proof privacy audit |
| Phase 2 asset detection and optimization | Read-only Asset Intelligence, host-neutral safe-image optimizer, token-bound local optimizer API, report-bound optimized Save As IPC, and optimized-output reopen proof implemented; product UI execution not exposed | `asset-intelligence` unit tests; avatar-frame report contract tests; SVGA optimizer/editor tests; svga-web server tests; shared frontend source guard; `npm test`; desktop smoke |
| Phase 3 imageKey / replacement editing | Single-resource replacement preview, bounded undo-redo, multi-resource replacement, and edited Save As are smoke-validated; batch/folder mapping remains prototype-only | `docs/product/SUPPORTED_EDITABLE_SVGA_BOUNDARY.md`; `replacementReadinessProof`; `replacementPreviewProof`; `replacementUndoRedoProof`; `replacementSaveAsProof`; `replacementMultiResourceProof`; desktop smoke |
| Phase 4 sequence-frame anti-flicker | Read-only Workbench sequence review, repair-preview contract, no-write simulation, bounded repair prototype, rendered boundary proof, no-op round-trip rehearsal, failure-first byte-repair proof validation, smoke-only byte-producing sequence candidate, and owner-visible candidate review are validated; product Save As and owner acceptance remain closed | `sequenceReviewProof`; `sequenceRepairPreviewProof`; `sequenceNoWriteSimulationProof`; `sequenceBoundedRepairPrototypeProof`; `sequencePrototypeRenderedBoundaryProof`; `sequenceNoopRoundTripProof`; `validateSequenceByteRepairProof`; `sequenceByteRepairProof`; `docs/reviews/2026-06-30-codex-svga-workbench-sequence-byte-candidate.md`; existing sequence tests in root suite; desktop smoke |
| Production-client delivery | Internal unsigned macOS ZIP generated; signing/notarization blocked by credentials | internal trial manifest |

## Current Baseline Evidence

- Desktop smoke passed on the autonomous branch with playback, nonblank canvas,
  inspection report, audit panel, file input, drag/drop, invalid-file path,
  player lifecycle, owner usability, and workbench region map all accepted.
- Internal macOS trial packaging passes with
  `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`.
- macOS package proof and privacy audit pass with
  `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:proof:mac`.
- Exact App ZIP SHA-256, package size, and package build commit are recorded in
  the current owner-visible review folder under `review/` because that folder is
  generated after the final tracked commit and is not committed to git.

## Immediate Next Slice

Continue with the next narrow Phase 4 sequence-frame product slice:

1. commit this status correction so the final head can stabilize before
   packaging;
2. regenerate internal macOS package evidence and the owner-visible autonomous
   review folder on that final head;
3. keep text editing, key rename, URL import, and structural/timeline edits
   unsupported until they have separate mechanical round-trip proof.
