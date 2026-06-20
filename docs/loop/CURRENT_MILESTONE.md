# P1: Electron Desktop Mainline Baseline:
# Local SVGA Open, Playback And Inspection

Milestone ID: P1
Title: Electron Desktop Mainline Baseline:
Local SVGA Open, Playback And Inspection
Status: frozen
milestoneStartCommit: `4c4d9a950930ae126c04c07609d0e4ad1023e85b`
Branch: `agent/codex/p1-electron-desktop-baseline`
Previous milestone: `docs/loop/milestones/M2-R3-review-packet-fidelity-and-loop-budget-enforcement.md`
Previous final review: `docs/loop/reviews/M2-R3-final-external-review.md`

maxRepairRounds: 4
maxConsecutiveNoProgressRounds: 2

## Objective

Advance the existing isolated Electron prototype into a stable internal desktop
product baseline for local SVGA open, playback, inspection, and clear error
feedback.

This is a product milestone. Agent Loop infrastructure is frozen and must not
be extended or refactored except for a blocking evidence, leak, or packet
generation defect.

## User-visible Outcome

From the repository root, a documented command starts the Electron desktop app.
The user can open or drag a local `.svga` file, play it locally, control
play/pause/replay, view basic file and inspection information, receive clear
errors for invalid files, and open a second file without restarting the app.

P1 is an internal product baseline, not a public release.

## Product Boundaries

1. The product mainline is a cross-platform Electron desktop client.
2. Browser workflow remains a stable rollback path and must not be removed.
3. Electron is advanced from isolated prototype toward product baseline.
4. P1 covers only the first desktop vertical loop:
   local file -> open -> playback -> inspection -> error feedback.
5. P1 does not include cloud sync, accounts, collaboration, advanced timeline,
   advanced effects, format conversion, export workbench, or public release.

## Allowed Changes

1. `tools/electron-prototype/**`.
2. Root `package.json` scripts directly needed for a stable desktop entrypoint.
3. Minimal shared inspection or preview interfaces needed by Electron and
   browser.
4. P1-specific tests, smoke scripts, docs, and generated ignored artifacts.
5. `docs/loop/**` lifecycle files for milestone state, history, and review.
6. `docs/product/**`.
7. `.artifacts/product/P1/**` generated visual review artifacts.
8. Small approved synthetic fixtures when needed for tests.

## Prohibited Changes

1. SVGA exporter output bytes or format semantics.
2. Main Web preview player behavior.
3. Browser import, drag/drop, comparison, or launcher rollback behavior.
4. CLI default flow.
5. Agent Loop schema or orchestration expansion.
6. Root production dependencies unless a documented product blocker proves it
   unavoidable.
7. Public release, installer, signing, notarization, auto-update, push, merge,
   publish, deploy, or release.
8. CDN or public-network runtime loading.
9. Telemetry, cloud service, accounts, sync, collaboration, or external AI.
10. Real user SVGA, PNG, screenshots, recordings, or sensitive local paths in
    Git.

## Acceptance Criteria

- `P1-AC-01`: Root Desktop Entrypoint — From repository root, a documented command can start the Electron desktop app. Evidence must include exact command, exit code, and startup smoke result.
- `P1-AC-02`: Local-only Runtime — Electron runtime does not access the public internet or CDN. Player assets are locally vendored, CSP or equivalent constraints are explicit, and tests or smoke prove no external resource request without disabling security.
- `P1-AC-03`: Secure Electron Boundary — contextIsolation is true, nodeIntegration is false, preload API is minimal, renderer has no arbitrary filesystem or shell/command execution access, and file reading uses a controlled interface without lowering existing security settings.
- `P1-AC-04`: File Picker Import — Desktop UI file picker supports local `.svga` selection, cancel is harmless, valid files enter loading, invalid or non-SVGA files show clear feedback, and no real user files are committed.
- `P1-AC-05`: Drag And Drop Import — Drag/drop uses the same loading path as file picker, handles multiple or unsupported files deterministically, and does not allow arbitrary unauthorized renderer filesystem reads.
- `P1-AC-06`: Deterministic Local Playback — A valid fixture parses and plays locally with machine evidence for structure parsing, nonblank canvas, ready or playing state, and no unhandled exception. This is not full visual quality acceptance.
- `P1-AC-07`: Playback Controls — play, pause, and replay exist and their UI state matches player state. Seek may remain if already stable but is not blocking.
- `P1-AC-08`: Inspection Information — A valid file displays filename, byte size, canvas width/height, FPS, frame count or duration, parser status, inspection summary, and Motion Asset Audit summary when available, without duplicating conflicting inspection logic in renderer.
- `P1-AC-09`: Invalid File Safety — Empty file, non-SVGA file, corrupt zlib data, protobuf decode failure, and missing required fields do not crash, do not white-screen, do not leave loading stuck, and show understandable errors without exposing sensitive local paths.
- `P1-AC-10`: Reopen And Cleanup — Opening two different fixtures in sequence cleans the first player instance, object URL, listeners, timers, and resources; UI shows the second file and no duplicate playback or events appear.
- `P1-AC-11`: Browser Rollback Preserved — Existing browser preview and launcher still build, test, and smoke without product behavior regression.
- `P1-AC-12`: Desktop Product Smoke — A repeatable Electron product smoke proves app startup, empty state, fixture open, nonblank canvas, inspection content, playback controls, invalid fixture error, second fixture replacement, normal app close, and no leftover Electron process.
- `P1-AC-13`: Visual Review Artifacts — `.artifacts/product/P1/` contains actual Electron screenshots `empty-state.png`, `valid-svga-loaded.png`, `inspection-panel.png`, `invalid-file-state.png`, and `artifact-index.json`, each indexed with path, mime, sizeBytes, sha256, fixture, scenario, generatedAt, and humanReviewRequired, without user privacy paths or real user assets in Git.
- `P1-AC-14`: Regression Validation — P1 targeted tests, Electron prototype/product tests, Electron smoke, two final `npm run loop:validate` runs, Reviewer A, Reviewer B, and post-seal verifier pass.
- `P1-AC-15`: Scope Discipline — P1 does not implement frame editing, timeline editing, asset replacement, SVGA re-export, cloud sync, collaboration, login, telemetry, updater, installer, code signing, notarization, or public release.

## Required Validation

Before terminal state:

1. Baseline `npm run loop:validate` passes before product changes.
2. `docs/product/P1_EXISTING_CAPABILITY_AUDIT.md` is complete.
3. `docs/product/P1_IMPLEMENTATION_PLAN.md` is complete.
4. P1 targeted tests pass.
5. Electron prototype/product tests pass.
6. Electron product smoke passes.
7. Visual artifacts are generated from the actual Electron app and indexed.
8. Browser rollback smoke and tests pass.
9. Preliminary `npm run loop:validate` passes.
10. Preliminary Reviewer A and Reviewer B find no blocking issues, or blockers
    are repaired within budget.
11. Final source state is committed with terminal loop state and history.
12. Two final `npm run loop:validate` runs pass on final HEAD.
13. Final Electron smoke and visual artifacts are regenerated or confirmed
    bound to final HEAD.
14. Candidate packet is generated from final HEAD.
15. Reviewer A schema v2 JSON verdict is `PASS`, bound to final source HEAD,
    candidate digest, and `sourceDiffSha256`.
16. Reviewer B schema v2 JSON verdict is `PASS`, bound to final source HEAD,
    candidate digest, and `packetDiffSha256`.
17. Post-seal verifier passes.
18. `git status --short` has no tracked or untracked source changes.
19. Final response is exactly `.artifacts/loop-handoff/latest/FINAL_RESPONSE.txt`.

## Required Tests

P1 tests must cover:

1. root desktop entrypoint.
2. Electron security preferences.
3. preload API allow-list.
4. file picker cancel.
5. valid file import.
6. drag/drop import.
7. unsupported file.
8. corrupt zlib data.
9. protobuf decode failure.
10. playback ready.
11. play/pause/replay state.
12. inspection metadata.
13. second-file cleanup.
14. listener, timer, or object URL cleanup.
15. no external URL or CDN runtime request.
16. CSP or equivalent local-only policy.
17. browser rollback regression.
18. Electron smoke cleanup.
19. screenshot artifact index.
20. failure-path tests isolated to temporary directories or approved fixtures.

## Human Gate

If machine validation passes but product visual acceptance is still needed, use
`HUMAN_REQUIRED` with one question:

是否接受 P1 Electron 桌面基线的交互和视觉结果？

Options:

- Option A: Accept and proceed to P2 basic editing.
- Option B: Do not accept; specify the one main direction to change.

Recommended and safe default: Option B if the screenshots do not satisfy the
expected internal baseline.

## Completion Gates

1. M2-R3 external PASS archived.
2. Agent Loop infrastructure not expanded.
3. P1 contract frozen.
4. Root desktop entrypoint exists.
5. Electron security boundary passes.
6. File picker open passes.
7. Drag/drop open passes.
8. Valid SVGA playback passes.
9. Play/pause/replay passes.
10. Inspection information passes.
11. Invalid file safety passes.
12. Second-file cleanup passes.
13. Browser rollback has no regression.
14. Runtime has no public internet or CDN requests.
15. Electron product smoke passes.
16. Visual artifacts are complete.
17. Targeted tests pass.
18. `npm run loop:validate` passes twice on final HEAD.
19. Reviewer A has no blocking finding.
20. Reviewer B has no blocking finding.
21. Post-seal verifier passes.
22. Source workspace clean.
23. All implementation is committed.
24. P1 Review Packet generated.
