# SVGA Workbench v1 Status

Date: 2026-06-30
Branch: `agent/codex/svga-workbench-v1-autonomous`
Baseline commit: `545252838311233cc03ce2e5f917e53d43207589`
Current repair state: `PHASE4_SEQUENCE_REPAIR_PRODUCT_SAVE_AS_VALIDATED_PENDING_FINAL_PACKAGE_REGEN`

## Authorization

Product Owner authorized autonomous SVGA Workbench v1 execution beyond the prior
P6-R1 human-gate/UI-polish loop. The old P6-R1 loop state remains archived as a
terminal human-gate record; it is not used as a blocker for Phase 2-4 product
work in this dedicated autonomous branch.

## Phase Matrix

| Phase | Status | Evidence |
| --- | --- | --- |
| Phase 1 stabilization baseline | Baseline pass, continue hardening only when gaps are found | `npm run desktop:smoke`; `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`; package proof privacy audit |
| Phase 2 asset detection and optimization | Asset Intelligence, host-neutral safe-image optimizer, token-bound local optimizer API, report-bound optimized Save As IPC, optimized-output reopen proof, and a bounded desktop `生成优化副本` Save As entry are implemented; current review package must regenerate final-head self-contained reports | `asset-intelligence` unit tests; avatar-frame report contract tests; SVGA optimizer/editor tests; svga-web server tests; shared frontend source guard; `npm test`; desktop smoke; `asset-intelligence-report.json`; `optimization-report.json` |
| Phase 3 imageKey / replacement editing | Single-resource replacement preview, bounded undo-redo, reset, multi-resource replacement, and edited Save As are smoke-validated; batch/folder mapping remains prototype-only | `docs/product/SUPPORTED_EDITABLE_SVGA_BOUNDARY.md`; `replacementReadinessProof`; `replacementPreviewProof`; `replacementUndoRedoProof`; `replacementResetProof`; `replacementSaveAsProof`; `replacementMultiResourceProof`; desktop smoke |
| Phase 4 sequence-frame anti-flicker | Product repaired-copy Save As/reopen path is validated for the current supported near-empty sequence speck repair; source immutability, full affected-frame alpha proof, saved hash binding, reopen playback, and failure-closed unsafe cases are covered. Product proof records `playbackDeltaObserved=true`: frame 23 changes at canvas level while frame 24 remains stable; alpha proof remains the exact repair authority | `repairSvgaSequenceFrameFlicker`; `sequenceProductRepairProof`; `sequence-full-affected-frame-alpha-proof.json`; `sequence-repair-status-report.json`; `sequence-repaired-output.svga`; `desktop-sequence-product-repair-proof.png`; desktop smoke |
| Production-client delivery | Internal unsigned macOS ZIP generation is clean and review-ready; packaged App normal visible startup proof is now part of the validation chain; signing/notarization dry-run workflow and entitlements are present; trusted distribution completion is blocked by credentials | internal trial manifest; packaged normal runtime proof; macOS signing workflow dry-run; package proof privacy audit; App ZIP entry-list hygiene proof |
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
  the generated owner-visible review folder under `review/` because that folder
  is generated after the final tracked commit and is not committed to git.

## Current Repair State

The previous `21849d1` review upload was not accepted as a complete Workbench v1
handoff. The `60bda97` package is treated as a mechanically valid package
hygiene and structure baseline, but it is not the current active handoff because
later UI/UX and evidence repairs must be regenerated at the final head.

The default desktop Workbench can preview local SVGA files, inspect assets,
surface safe optimization candidates, generate an optimized copy through Save As
when the source was opened through the desktop file picker, replace supported PNG
resources with undo/redo and Save As, review sequence-frame risk, and generate a
repaired-copy sequence anti-flicker Save As for the current supported near-empty
speck case.

The current repair adds final-head self-contained Phase 2 and Phase 3 reports,
keeps historical P3/P4 incubation artifacts out of the current evidence path,
adds replacement reset proof, adds a packaged App normal visible startup proof
after macOS packaging, and completes the Phase 4 product sequence-repair path
for the current supported fixture. The repaired output is saved as a new SVGA,
reopened through the product player, and bound to a full affected-frame alpha
proof. The player-level proof records `playbackDeltaObserved=true`: frame 23
changed at canvas level while frame 24 remained stable for the same four-pixel
speck target. This partial visual-delta behavior is recorded for Product Owner
review and does not re-enable manual visual confirmation as a blocker because
the alpha proof confirms the target resource removal.

The UI audit is now part of the active repair scope. Diagnostics counts are
paired with visible issue cards; loading keeps a header `更换文件` path; Settings
opens without an active diagnostics/log side panel and starts at scroll top;
toolbar targets, resource row focus, resource action targets, sequence proof
states, and long preview-card titles now have targeted repairs and desktop
smoke proof. The current UI/UX repair baseline passed
  `npm run svga-workbench:v1:validate` 14/14 at `2026-06-30T03:40:17.207Z`;
the NQ1 accessibility source audit was updated to match the current Space-key
fallback contract without weakening playback or text-input checks. The next
validation run will include the added packaged normal runtime proof, making the
expected suite 15 command records. Remaining UI debt includes dense diagnostics
issue presentation, full settings scroll/keyboard review, screen-reader review,
and a refreshed full screenshot audit bundle before Product Owner UI acceptance.

The post-`6720d3a` review-readiness repair keeps this UI work narrowly scoped to
proof integrity: local compare now captures normal, 900x720, and minimum-size
states at the current head; narrow double-preview cards stack vertically to keep
status chips readable; and the top-level state proof fails if any recorded state
fails. Historical Phase 2 artifact index and Phase 4 prototype/byte-candidate
files are labelled as lineage/prototype history rather than current authority.

Keep text editing, key rename, URL import, and structural/timeline edits
unsupported until they have separate mechanical round-trip proof and
owner-visible acceptance. Sequence repair remains deliberately narrow: only the
current fail-closed near-empty speck-to-transparent path is product Save As
validated. Signing/notarization scripts now exist in dry-run/explicit-execute
form, but completion and Windows trusted distribution remain credential-bound
external blockers.

## Superseded Mechanical Baseline

The package below remains useful only as the mechanically valid baseline that
the current repair continues from. It must not be presented as the active
current handoff after this self-contained evidence repair:

- Primary artifact:
  `review/SVGA-Workbench-v1-60bda97-complete-review-directory.zip`
- SHA-256:
  `7c610df858d3b4807413ad1f5a6b6210818bd1702285b9efddc9b8d3d51af307`
- Size: `127673621` bytes
- Final HEAD: `60bda975682abdad968da818a6e291455b3d9d36`
- Final tree: `c4df13f25e421a2ee7718b7f29528691ff8c9b28`
- Validation: `npm run svga-workbench:v1:validate` passed 14/14 commands at that
  prior head.
- Product Owner acceptance and production release are not claimed.

Do not present this superseded package as including later UI/UX, replacement
reset, packaged normal-runtime, or final-head self-contained evidence repairs.
Regenerate the complete review directory after the next final baseline commit.
