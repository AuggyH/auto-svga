# P3: Basic Image Resource Replacement And Save As

Milestone ID: P3
Title: Basic Image Resource Replacement And Save As
Status: frozen
milestoneStartCommit: `2b5bd05a79a77d3f292a73267dd910f5b1f97013`
Branch: `agent/codex/p3-basic-image-resource-editing`
Previous milestone: `docs/loop/milestones/P2-desktop-product-shell-and-web-preview-parity.md`
Previous final review: `docs/loop/reviews/P2-final-external-review.md`
Previous final PASS packet: `.artifacts/loop-handoff/P2-2b5bd05/REVIEW_PACKET.md`

maxRepairRounds: 4
maxConsecutiveNoProgressRounds: 2

## Objective

Implement the first bounded editing loop for Auto SVGA: replace one embedded
PNG image resource in a supported local SVGA, preview the edited animation,
reset edits, Save As a new SVGA, and reopen the exported file to prove the
replacement round-trip.

P3 is a controlled replaceable-image editing milestone. It is not a complete
SVGA editor.

## User-visible Outcome

In the Electron desktop client, the user can:

1. Open a supported local `.svga`.
2. View embedded image resources with stable keys, dimensions, sizes, hashes,
   and usage counts.
3. Select one resource.
4. Choose a local PNG replacement.
5. Immediately preview the replacement in the current animation.
6. See unsaved edit state.
7. Reset the selected resource or all edits.
8. Save As a new `.svga`.
9. Reopen the exported `.svga` and see the replacement.
10. Confirm the original `.svga` file is unchanged.

## Product Direction

1. The first editing ability is embedded PNG image resource replacement.
2. Original `.svga` files are read-only.
3. Export uses Save As only; same path as the original input is rejected.
4. Replacement keeps raw PNG bytes. No crop, cover, contain, stretch, or
   re-encode is performed in P3.
5. P3 may support multiple resource replacements in one session, but the
   blocking minimum is one reliable resource replacement and export.
6. The UI continues the accepted P2 product shell. Player remains the visual
   center.

## Allowed Changes

1. Host-neutral SVGA image resource edit model and round-trip helper.
2. PNG replacement validation using existing local utilities/dependencies.
3. Narrow Electron preload/IPC for controlled open/save operations.
4. Electron prototype UI for image resource list, replacement preview,
   dirty/reset, and Save As.
5. P3-specific tests, smoke scripts, visual capture, reports, review packet,
   and ignored artifacts.
6. Minimal shared helpers when they are host-neutral and directly support P3.
7. `docs/loop/**` and `docs/product/**` lifecycle, audit, plan, evidence, and
   review documents.
8. Additive package scripts only when explicitly named and non-default.

## Prohibited Scope

1. Text editing.
2. Timeline, frame, layer transform, position, scale, or rotation editing.
3. Multitrack editing, effect editing, template marketplace, cloud sync,
   account features, AI generation, auto publish, or batch replacement.
4. Format conversion, export workbench, automatic optimization, or one-click
   repair.
5. New parsers for VAP, Lottie, WebP, WebM, APNG, or Sprite.
6. Production desktop release, installer, signing, notarization, auto-update,
   publish, deploy, merge, or push.
7. Main Web preview player behavior, browser import, drag/drop, comparison, or
   launcher rollback behavior.
8. Existing project-to-SVGA exporter bytes or CLI default flow.
9. Agent Loop schema or orchestration expansion.
10. Real user SVGA, PNG, screenshots, recordings, labels, or sensitive local
    paths in Git or upload bundles.

## Safe Round-trip Boundary

P3 supports only files that pass the restricted round-trip boundary:

1. Inflate and decode with `proto/svga.proto`.
2. Existing embedded images are addressable by stable `resourceKey`.
3. Replacement modifies only existing `MovieEntity.images[resourceKey]` bytes.
4. Sprite `imageKey` / `matteKey`, params, frame counts, transforms, alpha,
   layout, shapes, audios, and untouched image hashes remain invariant.
5. Exported bytes re-inflate, re-decode, load in the local player, and render a
   nonblank canvas.
6. `round-trip-report.json` has no unexpected changes.

Unknown protobuf fields are not claimed to be preserved. Unsupported files must
fail closed with a productized error instead of being silently rewritten.

## Acceptance Criteria

- `P3-AC-01`: P2 Closure — P2 owner acceptance, final PASS, archive, and final Review are complete.
- `P3-AC-02`: Safe Round-trip Boundary — The app can identify supported SVGA round-trip files and reject unsupported files without silent damage.
- `P3-AC-03`: Image Resource Discovery — Valid SVGA image resources are listed with key, dimensions, size, hash, and usage count.
- `P3-AC-04`: Controlled PNG Import — PNG selection, cancel, security validation, and invalid-file errors work correctly.
- `P3-AC-05`: Live Replacement Preview — Replacement remounts the player with edited bytes, changes rendered pixels, preserves animation structure, and cleans old lifecycle state.
- `P3-AC-06`: Dirty And Reset — Dirty state, reset selected, reset all, and unsaved-change confirmation work correctly.
- `P3-AC-07`: Safe Save As — Save As writes a new `.svga`, rejects the original path, cleans temp files on failure, and never shows pseudo-success.
- `P3-AC-08`: Export Round-trip — Exported SVGA re-parses, replays, renders nonblank, and has no unauthorized semantic changes.
- `P3-AC-09`: Original File Immutability — The original input SHA-256 is unchanged after preview, reset, and export.
- `P3-AC-10`: Local Security Boundary — contextIsolation, sandbox, nodeIntegration=false, narrow IPC, no CDN, no public network, and no arbitrary filesystem/shell permissions remain true.
- `P3-AC-11`: Productized Error States — Empty resource list, invalid PNG, unsupported round-trip, write failure, and reopen failure show clear product errors without leaks or crashes.
- `P3-AC-12`: P1/P2 Regression — File open, drag/drop, playback controls, inspection, product states, Web rollback, and P2 shell do not regress.
- `P3-AC-13`: Visual Evidence — Original, edited, reset, export, and reopen evidence is generated from the real Electron app.
- `P3-AC-14`: Independent Review — Targeted tests, round-trip smoke, two loop validations, Reviewer A/B, and post-seal verifier pass.
- `P3-AC-15`: Scope Discipline — P3 does not implement text, timeline, transform, effect, batch, cloud, account, AI, installer, or release scope.

## Required Product Artifacts

Generate under `.artifacts/product/P3/`:

1. `original-loaded.png`
2. `resource-list.png`
3. `replacement-selected.png`
4. `replacement-preview.png`
5. `dirty-state.png`
6. `reset-to-original.png`
7. `export-success.png`
8. `reopened-export.png`
9. `invalid-png-state.png`
10. `original-edited-comparison.png`
11. `round-trip-report.json`
12. `resource-edit-report.json`
13. `artifact-index.json`

Artifacts must come from the actual Electron app, use approved synthetic
fixtures and replacement PNGs, bind to final HEAD, avoid real user assets and
absolute paths, and clearly show the replacement difference.

## Required Round-trip Report

`.artifacts/product/P3/round-trip-report.json` must include:

1. `sourceSha256`
2. `exportedSha256`
3. `replacedResourceKey`
4. `originalResourceSha256`
5. `replacementSha256`
6. `exportedResourceSha256`
7. `invariantChecks`
8. `changedFields`
9. `unexpectedChanges`
10. `decodePassed`
11. `playbackPassed`
12. `canvasNonBlank`
13. `passed`

Any nonempty `unexpectedChanges` blocks PASS.

## Required Tests

P3 validation must cover:

1. Supported fixture resource discovery.
2. Stable resource keys and usage counts.
3. PNG picker cancel, non-PNG rejection, corrupt PNG rejection, oversized PNG
   rejection, and invalid dimensions rejection.
4. Replacement preview changes rendered pixels.
5. Selected resource hash changes and untouched resource hashes remain.
6. Sprite references, canvas, FPS, frames, and duration remain.
7. Player cleanup before replacement preview.
8. Reset selected, reset all, and dirty transitions.
9. Unsaved-change confirmation.
10. Save dialog cancel and original target path rejection.
11. Temp output cleanup on failure.
12. Exported SVGA inflate/decode/playback.
13. Round-trip invariant report.
14. Original source hash unchanged.
15. Unsupported round-trip file rejection.
16. No external requests or CDN.
17. Electron security preferences unchanged.
18. Browser rollback.
19. P1/P2 product state regression.
20. No residual Electron process.
21. Temporary directories and synthetic assets only.
22. No real user assets or local absolute paths in upload bundle.

Tests must not pass by mocking the canvas, statically inserting a replacement
image, skipping protobuf encode, skipping exported-file reopen, weakening
invariants, or catching errors and marking success.

## Required Validation Before Terminal State

1. P3 editing capability audit is complete.
2. P3 implementation plan is complete.
3. P3 targeted unit tests pass.
4. Electron editing smoke passes.
5. Exported-file reopen smoke passes.
6. Browser rollback local smoke passes.
7. Preliminary `npm run loop:validate` passes.
8. Preliminary Reviewer A and Reviewer B find no blocking issues, or blockers
   are repaired within budget.
9. Final source state is committed with terminal loop state and history.
10. Two final `npm run loop:validate` runs pass on final HEAD.
11. Final edit and round-trip smoke passes on final HEAD.
12. Final P3 artifacts are generated and bound to final HEAD.
13. Candidate packet is generated from final HEAD.
14. Reviewer A structured JSON verdict is `PASS`.
15. Reviewer B structured product verdict is `PASS`.
16. Post-seal verifier passes.
17. Upload ZIP is generated and privacy-audited.
18. Source workspace is clean.
19. Final response is exactly `.artifacts/loop-handoff/latest/FINAL_RESPONSE.txt`.

## Reviewer A Scope

Reviewer A checks format integrity, security, and code:

1. Protobuf decode/encode boundary.
2. Unsupported-file fail-closed behavior.
3. Resource key stability.
4. Untouched field and resource preservation.
5. Original file immutability.
6. Temporary output and atomic Save As.
7. Path traversal and IPC allow-list.
8. Renderer filesystem boundary.
9. contextIsolation, sandbox, and nodeIntegration.
10. Player lifecycle cleanup.
11. No network or CDN.
12. Round-trip report authenticity.
13. Tests not weakened.
14. P1/P2 no regression.
15. No scope-out editing features.
16. No Agent Loop infrastructure expansion.

## Reviewer B Scope

Reviewer B reads only the candidate Review Packet and final P3 upload ZIP.

Reviewer B checks:

1. Image resource list is understandable.
2. Replacement operation is clear.
3. Unsaved state is clear.
4. Before and after visuals are actually different.
5. Reset returns to original.
6. Export success is clear.
7. Reopened export shows replacement.
8. Error states are productized.
9. P2 product shell remains.
10. Upload ZIP is sufficient for product acceptance.

## Terminal Human Gate

After all engineering gates pass, return `HUMAN_REQUIRED` with exactly one
product question:

是否接受 P3 图像资源替换、实时预览、重置和另存为 SVGA 的基础编辑闭环？

Options:

- A: 接受 P3，允许规划下一项编辑能力。
- B: 不接受，只指出一个最高优先级的编辑流程或产品问题。

Safe default: B. Do not start the next milestone automatically.
