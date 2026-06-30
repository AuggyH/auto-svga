# SVGA Workbench v1 Status

Date: 2026-06-30
Branch: `agent/codex/svga-workbench-v1-autonomous`
Baseline commit: `545252838311233cc03ce2e5f917e53d43207589`
Current repair state: `UI_UX_REPAIR_VALIDATED_PENDING_FINAL_PACKAGE_REGEN`

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
| Production-client delivery | Internal unsigned macOS ZIP generation is clean and review-ready; signing/notarization dry-run workflow and entitlements are present; trusted distribution completion is blocked by credentials | internal trial manifest; macOS signing workflow dry-run; package proof privacy audit; App ZIP entry-list hygiene proof |
| UI audit and HIG application | 2026-06-30 single-file preview audit is included as repair input; diagnostics visibility, loading escape path, settings modal context, toolbar hit areas, resource row focus, sequence proof-state distinction, and long-title containment have targeted repairs | `review/SVGA-Workbench-v1-21849d1-ui-audit/UI_AUDIT_REPORT.md`; `docs/product/SVGA_WORKBENCH_HIG_AUDIT_GUIDE.md`; `desktop-loading.png`; `desktop-settings-open.png`; `desktop-info-assets-open.png`; `desktop-state-render-proof.json`; `desktop-interaction-trace.source.json` |

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

The previous `21849d1` review upload was not accepted as a complete Workbench v1
handoff. That handoff integrity repair produced the prior complete review
baseline package `SVGA-Workbench-v1-60bda97-complete-review-directory.zip`,
with top-level `UPLOAD_INDEX.json`, `MANIFEST.json`,
`bundle-privacy-audit.json`, App ZIP entry list, hashes, validation outputs,
and self-contained Phase 2/3/4 evidence. New UI/UX repairs after that package
must regenerate the complete review directory before external review.

The default desktop Workbench can preview local SVGA files, inspect assets,
surface safe optimization candidates, generate an optimized copy through Save As
when the source was opened through the desktop file picker, replace supported PNG
resources with undo/redo and Save As, review sequence-frame risk, and run the
current smoke-only sequence byte candidate without exposing sequence Save As.

The UI audit is now part of the active repair scope. Diagnostics counts are
paired with visible issue cards; loading keeps a header `更换文件` path; Settings
opens without an active diagnostics/log side panel and starts at scroll top;
toolbar targets, resource row focus, resource action targets, sequence proof
states, and long preview-card titles now have targeted repairs and desktop
smoke proof. The current UI/UX repair baseline passed
`npm run svga-workbench:v1:validate` 14/14 at `2026-06-30T03:40:17.207Z`;
the NQ1 accessibility source audit was updated to match the current Space-key
fallback contract without weakening playback or text-input checks. Remaining UI
debt includes dense diagnostics issue presentation, full settings
scroll/keyboard review, screen-reader review, and a refreshed full screenshot
audit bundle before Product Owner UI acceptance.

Keep text editing, key rename, URL import, structural/timeline edits, and
sequence repair Save As unsupported until they have separate mechanical
round-trip proof and owner-visible acceptance. Phase 4 is partial: the byte
candidate is smoke-only, manual visual confirmation is required, and repair
success is not claimed. Signing/notarization scripts now exist in
dry-run/explicit-execute form, but completion and Windows trusted distribution
remain credential-bound external blockers.

## Prior Complete Review Artifact

The most recent complete review directory before the current UI/UX repair is:

- Primary artifact:
  `review/SVGA-Workbench-v1-60bda97-complete-review-directory.zip`
- SHA-256:
  `7c610df858d3b4807413ad1f5a6b6210818bd1702285b9efddc9b8d3d51af307`
- Size: `127673621` bytes
- Final HEAD: `60bda975682abdad968da818a6e291455b3d9d36`
- Final tree: `c4df13f25e421a2ee7718b7f29528691ff8c9b28`
- Validation: `npm run svga-workbench:v1:validate` passed 14/14 commands.
- Product Owner acceptance and production release are not claimed.

Do not present this prior package as including later UI/UX repair commits.
Regenerate the complete review directory after the next final UI/UX repair
baseline commit.
