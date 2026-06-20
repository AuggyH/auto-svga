# P4: Multi-Resource Editing, Undo/Redo And Export Integrity

Milestone ID: P4
Title: Multi-Resource Editing, Undo/Redo And Export Integrity
Status: frozen
milestoneStartCommit: `1fc3bd3e2e046cca18a0ae15fce0afd5c60c6eca`
Branch: `agent/codex/p4-multi-resource-edit-history`
Previous milestone: `docs/loop/milestones/P3-basic-image-resource-replacement-and-save-as.md`
Previous final review: `docs/loop/reviews/P3-final-external-review.md`
Previous final PASS packet: `.artifacts/loop-handoff/P3-1fc3bd3/REVIEW_PACKET.md`

maxRepairRounds: 4
maxConsecutiveNoProgressRounds: 2

## Objective

Implement a bounded multi-resource editing loop for Auto SVGA: replace at least
two existing embedded PNG image resources in the same session, preview both
replacements, undo and redo edits, manage a save-point based dirty state, Save
As a new SVGA, and reopen the exported file to prove every replacement and all
protected invariants.

P4 extends the accepted P3 image-resource editor. It is not a complete SVGA
editor.

## User-visible Outcome

In the Electron desktop client, the user can:

1. Open a supported SVGA containing multiple PNG resources.
2. View at least three image resources with thumbnail, key, dimensions, size,
   hash, and usage count.
3. Replace the first resource.
4. Replace a second different resource in the same session.
5. See each resource's independent modified state.
6. See the animation preview with both replacements applied.
7. Undo the second replacement.
8. Redo the second replacement.
9. Reset the selected resource.
10. Undo the selected-resource reset.
11. Reset all resources.
12. Undo the reset-all operation.
13. Save As a new SVGA.
14. See a clean save-point after successful Save As.
15. Continue editing after Save As and become dirty again.
16. Reopen the exported SVGA and see all saved replacements preserved.
17. Confirm the original source SVGA hash is unchanged.

## Product Direction

1. Edit only existing embedded PNG image resources.
2. Use stable resource keys, never list indices, as the edit identity.
3. Keep original `.svga` inputs read-only.
4. Save As writes a new file and records a new save point only after export,
   decode, playback smoke, and per-resource integrity checks pass.
5. Dirty state is based on current revision digest versus saved revision digest,
   not on replacement count alone.
6. Unsupported round trips fail closed.
7. Browser workflow and `npm run local:preview` remain rollback paths.

## Allowed Changes

1. Host-neutral multi-resource edit session and history model.
2. Multi-resource replacement and schemaVersion 3 round-trip report.
3. Undo/redo, reset selected, reset all, save-point dirty state, and async
   operation ordering guards.
4. Electron prototype UI wiring for resource-level modified badges and edit
   controls.
5. P4 synthetic multi-resource fixture, replacements, smoke scripts,
   screenshots, reports, review packet, visible upload directory, and ignored
   artifacts.
6. Targeted TypeScript and Electron tests for P4.
7. `docs/loop/**` and `docs/product/**` P4 lifecycle, audit, plan, evidence,
   and review documents.
8. Additive package scripts only when explicitly named and non-default.

## Prohibited Scope

1. Text, nickname, timeline, frame, layer transform, crop, resample, effect,
   template marketplace, cloud, account, or AI features.
2. Format conversion, export workbench, automatic optimization, one-click
   repair, installer, signing, notarization, release, publish, deploy, merge,
   or push.
3. New parsers for VAP, Lottie, WebP, WebM, APNG, or Sprite.
4. Main Web preview player behavior, browser import, drag/drop, comparison, or
   launcher rollback behavior.
5. Existing project-to-SVGA exporter bytes or CLI default flow.
6. Agent Loop infrastructure expansion.
7. Real user SVGA, PNG, screenshots, recordings, labels, or sensitive local
   paths in Git or upload bundles.

## Multi-Resource Round-trip Boundary

P4 supports only files that pass the restricted multi-resource round-trip
boundary:

1. Inflate and decode with `proto/svga.proto`.
2. Existing embedded images are addressable by stable `resourceKey`.
3. Replacement modifies only existing `MovieEntity.images[resourceKey]` bytes.
4. At least two replacements are validated independently.
5. Sprite `imageKey` / `matteKey`, params, frame counts, transforms, alpha,
   layout, shapes, audios, resource key set, and untouched image hashes remain
   invariant.
6. Exported bytes re-inflate, re-decode, load in the local player, and render a
   nonblank canvas.
7. `multi-resource-round-trip-report.json` has no unexpected changes.

Unknown protobuf fields are not claimed to be preserved. Unsupported files must
fail closed with a productized error instead of being silently rewritten.

## Acceptance Criteria

- `P4-AC-01`: P3 Closure — P3 owner acceptance, terminal PASS state, archived contract, final external review, and final PASS packet are complete.
- `P4-AC-02`: Canonical Multi-Resource Fixture — Synthetic fixture has at least three PNG resources, at least two visible resources used by different sprites, one unmodified resource, stable metadata, and no real assets.
- `P4-AC-03`: Stable Multi-Resource Discovery — At least three resources render with thumbnail, key, dimensions, size, hash, usage count, and stable order.
- `P4-AC-04`: Two Independent Replacements — Two different resources can be replaced in one session and both show independent modified state.
- `P4-AC-05`: Per-Resource Integrity — Every replacement is verified by resource key, original hash, replacement hash, exported hash, dimensions, and sprite references.
- `P4-AC-06`: Undo — Undo reverses the most recent replacement or reset without affecting unrelated resources.
- `P4-AC-07`: Redo — Redo restores the undone action and new edits truncate the redo branch.
- `P4-AC-08`: Save-Point Dirty State — Dirty state reflects current revision digest versus saved revision digest across edit, undo, redo, Save As, reopen, and post-save edit.
- `P4-AC-09`: Async Ordering — Stale preview, replacement, reset, save, or file-switch responses cannot overwrite the latest valid operation.
- `P4-AC-10`: Safe Multi-Resource Save As — Save As writes a new SVGA only after current bytes and validation match the active revision; errors do not advance the save point.
- `P4-AC-11`: Multi-Resource Round-trip — Exported SVGA re-parses, replays, renders nonblank, has schemaVersion 3 report, validates all replacements, and has no unauthorized semantic changes.
- `P4-AC-12`: Original Immutability — Original source SHA-256 is unchanged after preview, reset, export, reopen, and post-save edits.
- `P4-AC-13`: Local Security Boundary — contextIsolation, sandbox, nodeIntegration=false, narrow IPC, no CDN, no public network, no arbitrary filesystem access, and no telemetry remain true.
- `P4-AC-14`: P1/P2/P3 Regression — Desktop shell, browser rollback, inspection report, Motion Asset Audit panel, file open, drag/drop, playback controls, and P3 single-resource editing do not regress.
- `P4-AC-15`: Visual Evidence — Required P4 screenshots and reports are generated from the actual Electron app on final HEAD.
- `P4-AC-16`: Independent Review — Reviewer A and a true independent read-only Reviewer B subagent pass final candidate evidence; scripts may validate Reviewer B JSON but may not generate visual verdicts.
- `P4-AC-17`: Scope Discipline — P4 does not implement text, timeline, transform, crop, resample, effect, conversion, workbench, auto-fix, cloud, account, AI, installer, release, or new format scope.

## Required Product Artifacts

Generate under `.artifacts/product/P4/`:

Screenshots:

1. `multi-resource-original.png`
2. `multi-resource-list.png`
3. `first-replacement.png`
4. `two-replacements.png`
5. `undo-second-replacement.png`
6. `redo-second-replacement.png`
7. `reset-selected.png`
8. `undo-reset-selected.png`
9. `reset-all.png`
10. `undo-reset-all.png`
11. `dirty-two-edits.png`
12. `save-point-clean.png`
13. `post-save-new-edit.png`
14. `reopened-multi-resource-export.png`
15. `invalid-second-png.png`
16. `multi-resource-comparison.png`

Reports:

1. `canonical-multi-resource-fixture.json`
2. `multi-resource-round-trip-report.json`
3. `edit-history-report.json`
4. `multi-resource-edit-report.json`
5. `thumbnail-evidence.json`
6. `artifact-index.json`
7. `reviewer-b-product-categories.json`
8. `bundle-privacy-audit.json`

Artifact:

1. `multi-resource-edited-output.svga`

Artifacts must come from the actual Electron app, use approved synthetic
fixtures and replacement PNGs, bind to final HEAD, avoid real user assets and
absolute paths, and clearly show two replacements plus undo/redo differences.

## Required Multi-Resource Round-trip Report

`.artifacts/product/P4/multi-resource-round-trip-report.json` must include:

1. `schemaVersion: 3`
2. `milestoneId: "P4"`
3. `headCommit`
4. `sourceSha256`
5. `sourceSha256AfterEditing`
6. `exportedSha256`
7. `replacements[]`
8. `untouchedResources[]`
9. `changedFields[]`
10. `unexpectedChanges[]`
11. `invariantChecks[]`
12. `decodePassed`
13. `playbackPassed`
14. `canvasNonBlank`
15. `passed`

Each `replacements[]` entry must include `resourceKey`, `usageCount`,
`originalSha256`, `replacementSha256`, `exportedSha256`, original and
replacement dimensions, `keyStillPresent`, `referencedBySameSprites`, and
`passed`.

PASS requires at least two replacements, every exported replacement hash matching
its replacement input, all untouched resource hashes preserved, sprite references
preserved, invariant checks passing, and `unexpectedChanges=[]`.

## Required Tests

P4 validation must cover:

1. canonical fixture metadata and at least three resources
2. two independent replacements
3. per-resource exported hash equality
4. untouched resource preservation
5. sprite reference preservation
6. undo, redo, redo branch truncation
7. reset selected, undo reset selected
8. reset all, undo reset all
9. dirty/save-point transitions
10. async stale-response guard
11. Save As current revision validation
12. exported-file reopen validation
13. original source immutability
14. invalid second PNG error handling
15. P3 single-resource regression
16. browser rollback and Electron security regression
17. final visual/report artifact generation

Tests must not pass by mocking the canvas, statically inserting a replacement,
skipping protobuf encode, skipping exported-file reopen, validating only the
first replacement, weakening invariants, or catching errors and marking success.

## Required Validation Before Terminal State

1. P4 multi-resource audit is complete.
2. P4 implementation plan is complete.
3. P4 targeted unit tests pass.
4. Electron multi-resource editing smoke passes.
5. Exported-file reopen smoke passes.
6. Browser rollback local smoke passes.
7. Preliminary `npm run loop:validate` passes.
8. Preliminary Reviewer A and true independent Reviewer B find no blocking
   issues, or blockers are repaired within budget.
9. Final source state is committed with terminal loop state and history.
10. Two final `npm run loop:validate` runs pass on final HEAD.
11. Final multi-resource edit and round-trip smoke passes on final HEAD.
12. Final P4 artifacts are generated and bound to final HEAD.
13. Candidate packet is generated from final HEAD.
14. Reviewer A structured JSON verdict is `PASS`.
15. Reviewer B structured product verdict is `PASS` and not script-generated.
16. Post-seal verifier passes.
17. Upload ZIP is generated and privacy-audited.
18. Source workspace is clean.
19. Final response is exactly `.artifacts/loop-handoff/latest/FINAL_RESPONSE.txt`.

## Reviewer A Scope

Reviewer A checks format integrity, security, and code:

1. multi-resource protobuf decode/encode boundary
2. unsupported-file fail-closed behavior
3. resource key stability
4. every replacement hash and untouched hash
5. sprite reference preservation
6. edit history and revision digest semantics
7. async operation ordering guard
8. original file immutability
9. temporary output and atomic Save As
10. path traversal and IPC allow-list
11. renderer filesystem boundary
12. contextIsolation, sandbox, nodeIntegration=false
13. no network or CDN
14. tests not weakened
15. P1/P2/P3 no regression
16. no scope-out editing features

## Reviewer B Scope

Reviewer B must be a true independent read-only subagent. Reviewer B reads only
the candidate Review Packet and final P4 upload ZIP.

Reviewer B checks:

1. multiple resource list is understandable
2. two replacements are recognizable
3. two replacements appear together in the animation
4. undo only reverts the latest operation
5. redo restores it
6. reset selected affects only the selected resource
7. reset all and undo reset-all are clear
8. dirty and save point are clear
9. post-save edit becomes dirty again
10. reopened export preserves all replacements
11. P2 shell remains intact
12. ZIP is sufficient for product acceptance

Each category must include verdict, visual observations, screenshot SHA-256,
evidence, and finding. Any category BLOCKING blocks seal.

## Terminal Human Gate

After all engineering and reviewer gates pass, return `HUMAN_REQUIRED` with one
product question:

是否接受 P4 多图像资源替换、撤销/重做、保存点状态以及多资源导出完整性，并允许规划下一项编辑能力？

Options:

A: 接受 P4，允许规划下一项编辑能力。

B: 不接受，只指出一个最高优先级的多资源编辑或撤销/重做问题。

Safe default: B，不开始下一里程碑。
