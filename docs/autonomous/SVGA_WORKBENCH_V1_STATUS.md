# SVGA Workbench v1 Status

Date: 2026-06-30
Branch: `agent/codex/svga-workbench-v1-autonomous`
Baseline commit: `545252838311233cc03ce2e5f917e53d43207589`
Current repair state: `AUTONOMOUS_RUN_REPAIR_REQUIRED_AND_CONTINUE`

## Authorization

Product Owner authorized autonomous SVGA Workbench v1 execution beyond the prior
P6-R1 human-gate/UI-polish loop. The old P6-R1 loop state remains archived as a
terminal human-gate record; it is not used as a blocker for Phase 2-4 product
work in this dedicated autonomous branch.

## Phase Matrix

| Phase | Status | Evidence |
| --- | --- | --- |
| Phase 1 stabilization baseline | Baseline pass, continue hardening only when gaps are found | `npm run desktop:smoke`; `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`; package proof privacy audit |
| Phase 2 asset detection and optimization | Asset Intelligence, host-neutral safe-image optimizer, token-bound local optimizer API, report-bound optimized Save As IPC, optimized-output reopen proof, and a bounded desktop `生成优化副本` Save As entry are implemented | `asset-intelligence` unit tests; avatar-frame report contract tests; SVGA optimizer/editor tests; svga-web server tests; shared frontend source guard; `npm test`; desktop smoke |
| Phase 3 imageKey / replacement editing | Single-resource replacement preview, bounded undo-redo, multi-resource replacement, and edited Save As are smoke-validated; batch/folder mapping remains prototype-only | `docs/product/SUPPORTED_EDITABLE_SVGA_BOUNDARY.md`; `replacementReadinessProof`; `replacementPreviewProof`; `replacementUndoRedoProof`; `replacementSaveAsProof`; `replacementMultiResourceProof`; desktop smoke |
| Phase 4 sequence-frame anti-flicker | Read-only Workbench sequence review, repair-preview contract, no-write simulation, bounded repair prototype, rendered boundary proof, no-op round-trip rehearsal, failure-first byte-repair proof validation, smoke-only byte-producing sequence candidate, and owner-visible candidate review are validated; product Save As and owner acceptance remain closed | `sequenceReviewProof`; `sequenceRepairPreviewProof`; `sequenceNoWriteSimulationProof`; `sequenceBoundedRepairPrototypeProof`; `sequencePrototypeRenderedBoundaryProof`; `sequenceNoopRoundTripProof`; `validateSequenceByteRepairProof`; `sequenceByteRepairProof`; `docs/reviews/2026-06-30-codex-svga-workbench-sequence-byte-candidate.md`; existing sequence tests in root suite; desktop smoke |
| Production-client delivery | Internal unsigned macOS ZIP generation is being repaired so the App ZIP itself is clean; signing/notarization dry-run workflow and entitlements are present; completion blocked by credentials | internal trial manifest; macOS signing workflow dry-run; package proof privacy audit; App ZIP entry-list hygiene proof |
| UI audit and HIG application | 2026-06-30 single-file preview audit is included as repair input; the P1 diagnostics-empty-body finding is repaired; HIG-derived Workbench rules are now tracked in product docs | `review/SVGA-Workbench-v1-21849d1-ui-audit/UI_AUDIT_REPORT.md`; `docs/product/SVGA_WORKBENCH_HIG_AUDIT_GUIDE.md`; `desktop-info-diagnostics-open.png`; `desktop-state-render-proof.json` |

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

## Current Repair State

The previous `21849d1` review upload is not accepted as a complete Workbench v1
handoff. Autonomous work is continuing to repair package integrity, App ZIP
hygiene, privacy/manifest validation, and self-contained Phase 2/3/4 evidence.

The default desktop Workbench can preview local SVGA files, inspect assets,
surface safe optimization candidates, generate an optimized copy through Save As
when the source was opened through the desktop file picker, replace supported PNG
resources with undo/redo and Save As, review sequence-frame risk, and run the
current smoke-only sequence byte candidate without exposing sequence Save As.

The UI audit is now part of the active repair scope. The P1 diagnostics finding
is fixed: diagnostics counts are paired with visible issue cards, the inspector
no longer reserves a missing tab row, and desktop smoke records first-issue
visibility in state proof. Remaining toolbar target, modal stacking, settings
scroll, loading escape, sequence proof distinction, and dense row-focus items
stay as nonblocking UI backlog unless they hide a required workflow.

Keep text editing, key rename, URL import, structural/timeline edits, and
sequence repair Save As unsupported until they have separate mechanical
round-trip proof and owner-visible acceptance. Phase 4 is partial: the byte
candidate is smoke-only, manual visual confirmation is required, and repair
success is not claimed. Signing/notarization scripts now exist in
dry-run/explicit-execute form, but completion and Windows trusted distribution
remain credential-bound external blockers.
