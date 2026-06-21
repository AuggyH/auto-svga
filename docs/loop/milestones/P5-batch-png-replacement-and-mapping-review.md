# P5: Batch PNG Replacement And Mapping Review

Milestone ID: P5
Title: Batch PNG Replacement And Mapping Review
Status: frozen
milestoneStartCommit: `84eb825784580a467fb8d103a0dd9eefef93b34a`
Branch: `agent/codex/p5-batch-png-mapping`
Previous milestone: `NQ1-R1`

maxRepairRounds: 4
maxConsecutiveNoProgressRounds: 2

## Objective

Extend the existing SVGA image resource editor so a user can import multiple
PNG files, review deterministic resource mappings, resolve conflicts manually,
apply the selected mappings as one atomic edit-history transaction, preview the
result, Save As, reopen the export, and verify per-resource hashes.

## Product Boundary

P5 extends current image replacement only. It must not implement text editing,
timeline editing, transform editing, effects, crop/resize/resample, cloud,
accounts, AI, format conversion, export workbench, or new format parsers.

## Mapping Policy

Automatic mapping order is fixed:

1. PNG basename exactly equals `resourceKey`.
2. PNG basename exactly equals a unique display name.
3. Unicode NFC plus case-fold basename equals a unique `resourceKey`.
4. Unicode NFC plus case-fold basename equals a unique display name.

No fuzzy, substring, edit-distance, AI semantic, visual-similarity, or hidden
heuristic matching is allowed.

## Acceptance Criteria

- `P5-AC-01`: P4 Closure — P4 owner acceptance and portable addendum are preserved and referenced.
- `P5-AC-02`: NQ1-R1 Closure — NQ1-R1 PASS evidence and privacy-clean upload bundle are preserved and referenced.
- `P5-AC-03`: Controlled Multi-PNG Import — multi-file picker and drag/drop accept only selected PNG files, reject corrupt or oversized files, enforce file-count and total-size limits, and cancel without error.
- `P5-AC-04`: Deterministic Mapping — exact and normalized mapping rules produce stable rule IDs, candidate resource keys, selected resource key, confidence class, and reason.
- `P5-AC-05`: Conflict And Unmatched Handling — unmatched, ambiguous, duplicate-target, excluded, and invalid inputs are surfaced and never silently applied.
- `P5-AC-06`: Manual Mapping Resolution — unresolved mappings can be manually assigned to a resource and become `manually_resolved` with explicit evidence.
- `P5-AC-07`: Atomic Batch Apply — selected valid mappings apply as one `batch_replace_resources` transaction or not at all.
- `P5-AC-08`: Batch Undo/Redo — one undo reverts the whole batch and one redo restores it; later single edits remain independent and truncate redo.
- `P5-AC-09`: Batch Preview Integrity — at least three replacements preview together and stale preview responses cannot commit partial state.
- `P5-AC-10`: Save-point Dirty State — dirty state remains save-point relative after batch apply, Save As, later edits, undo, and redo.
- `P5-AC-11`: Safe Save As — Save As remains bound to the validated active revision and does not overwrite the original source.
- `P5-AC-12`: Batch Round-trip Integrity — schemaVersion 4 report verifies at least three replacements, exported hashes, untouched hashes, structure invariants, source immutability, exported reopen, decode, playback, and nonblank evidence.
- `P5-AC-13`: Original File Immutability — source SVGA bytes and selected input PNG bytes are never modified in place.
- `P5-AC-14`: Local Security Boundary — no public network, no arbitrary directory scan, no absolute path persistence, narrow IPC/preload boundary, and synthetic/temp assets only.
- `P5-AC-15`: P1-P4 Regression — desktop baseline, browser rollback, P2 shell, P3 single replacement, and P4 multi-resource editing remain intact.
- `P5-AC-16`: Independent Review — Reviewer A and read-only Reviewer B produce schemaVersion 2 verdicts bound to the final candidate digest and hashes.
- `P5-AC-17`: Scope Discipline — P5 stops at HUMAN_REQUIRED and does not start P6 or any new asset/editor scope.

## Required Product Evidence

Ignored artifacts under `.artifacts/product/P5/`:

- `batch-entry.png`
- `batch-files-selected.png`
- `mapping-exact-matches.png`
- `mapping-unmatched-conflict.png`
- `mapping-manual-resolution.png`
- `mapping-ready-to-apply.png`
- `batch-preview.png`
- `batch-dirty-state.png`
- `batch-undo.png`
- `batch-redo.png`
- `batch-export-success.png`
- `batch-reopened-export.png`
- `corrupt-png-state.png`
- `dimension-warning.png`
- `batch-original-edited-comparison.png`
- `canonical-batch-fixture.json`
- `batch-mapping-report.json`
- `batch-edit-history-report.json`
- `batch-round-trip-report.json`
- `p5-product-evidence-summary.json`
- `thumbnail-evidence.json`
- `reviewer-b-product-categories.json`
- `bundle-privacy-audit.json`
- `artifact-index.json`
- `batch-edited-output.svga`

PNG artifacts are deterministic state markers, not screenshots. Playback and
nonblank canvas evidence must be bound by live preview or Save As validation,
not by offline product report generation.

## Terminal Gate

P5 must end as `HUMAN_REQUIRED` with one owner question:

是否接受 P5 多 PNG 批量导入、映射复核、冲突处理、原子应用和批量导出闭环，并允许规划下一项编辑能力？

Safe default: `B` — do not accept; point out the highest-priority batch
replacement or mapping experience issue.
