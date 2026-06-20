# P2: Desktop Product Shell And Web Preview Parity

Milestone ID: P2
Title: Desktop Product Shell And Web Preview Parity
Status: frozen
milestoneStartCommit: `116449560e9842a88597e1a70bb37417ea7223c4`
Branch: `agent/codex/p2-desktop-web-preview-parity`
Previous milestone: `docs/loop/milestones/P1-electron-desktop-mainline-baseline.md`
Previous final review: `docs/loop/reviews/P1-final-external-review.md`
Previous final PASS packet: `.artifacts/loop-handoff/P1-1164495/REVIEW_PACKET.md`

maxRepairRounds: 4
maxConsecutiveNoProgressRounds: 2

## Objective

Converge the accepted P1 Electron internal functional baseline with the mature
visual language, information architecture, and core interaction model of the
existing Web preview page.

After P2, the Electron desktop client should clearly feel like the same Auto
SVGA product system as the Web preview while keeping desktop-specific file,
window, shortcut, and local-runtime affordances.

P2 is a product-shell and parity milestone. It is not an editing, export,
format-conversion, installer, or public-release milestone.

## Product Direction

1. Electron is the long-term desktop product mainline.
2. The existing Web preview is the current visual and information architecture
   reference.
3. Electron must stop looking like an isolated engineering prototype.
4. Electron and Web must visibly belong to the same Auto SVGA product system.
5. Pixel-perfect copying is not required.
6. Desktop may adapt for windows, menus, keyboard shortcuts, and local files.
7. Core UI modes, visual hierarchy, component language, and inspection report
   structure should share data models, tokens, and presentation helpers where
   safe.
8. Browser workflow remains the stable rollback path.
9. P2 does not implement basic editing.
10. P3 may start basic editing only after P2 product visual acceptance.

## User-visible Outcome

The user can start the desktop app, open or drag a local `.svga`, see the
animation as the main workspace, control play/pause/replay, scan compact file
metadata, read structured inspection and Motion Asset Audit information, and
recover from invalid or repeated file loads without stale UI.

The page title and product identity use `Auto SVGA` as the primary name.
Internal/prototype status is low-priority supporting context, not the visual
headline.

## Allowed Changes

1. `tools/electron-prototype/experiments/svga-web/**`.
2. Minimal shared UI/token/presentation helpers that are host-neutral.
3. Existing Web preview capture and smoke harness code when needed for P2
   reference artifacts, without changing the Web product behavior.
4. P2-specific tests, visual capture scripts, proof JSON, docs, and ignored
   artifacts.
5. `docs/loop/**` lifecycle files for P2 state, history, review, and packet
   generation.
6. `docs/product/**` audit, design-system map, shared UI decision, and terminal
   evidence documents.
7. Root package scripts only when explicitly named and additive.

## Prohibited Scope

1. Basic editing, timeline editing, frame editing, layer editing, asset
   replacement, text replacement, or seek editor.
2. SVGA save, modified export, export workbench, format conversion, or
   automatic optimization.
3. New parsers or players for VAP, Lottie, WebP, WebM, APNG, or Sprite.
4. Public release, installer, signing, notarization, auto-update, publish,
   deploy, merge, or push.
5. Accounts, cloud sync, collaboration, telemetry, external AI, external
   models, multimodal services, or network analysis.
6. SVGA exporter bytes or format semantics.
7. Main Web preview player behavior, browser import, drag/drop, comparison, or
   launcher rollback behavior.
8. CLI default flow.
9. Agent Loop schema or orchestration expansion.
10. Real user SVGA, PNG, screenshots, recordings, labels, or sensitive local
    paths in Git.

## Acceptance Criteria

- `P2-AC-01`: P1 Closure — P1 owner acceptance is recorded, P1 final state is PASS, and P1 contract plus review are archived.
- `P2-AC-02`: Web Reference Baseline — The existing Web preview is actually run, and Web reference screenshots plus a reference manifest are generated and bound to the final P2 HEAD.
- `P2-AC-03`: Shared Product Identity — Electron and Web use consistent product naming, title hierarchy, status language, and visual system; Electron must not use `Internal Baseline` as the primary title.
- `P2-AC-04`: Desktop Product Shell — Electron has clear app bar, player workspace, controls, metadata, and inspector hierarchy.
- `P2-AC-05`: Visual Token Parity — Background levels, text hierarchy, borders, spacing, radius, buttons, status, and panel tokens have a clear Web-to-Electron mapping and machine-readable parity report.
- `P2-AC-06`: Player Workspace — The player is the visual center at common desktop sizes; animation is visible, controls and metadata sit near the player, and first viewport avoids large purposeless empty areas.
- `P2-AC-07`: Structured Inspection — Inspection, Spec Check, and Motion Asset Audit are grouped or tabbed; calibration is collapsed by default; raw long engineering text does not dominate the page.
- `P2-AC-08`: Product States — Empty, loading, valid, invalid, and reopen states are visually and behaviorally consistent, with no stale data.
- `P2-AC-09`: Actual Normal Runtime — Independent normal and smoke Electron processes are launched and verified; normal evidence is not fabricated from the smoke process.
- `P2-AC-10`: P1 Functionality Preserved — P1 file picker, drag/drop, play/pause/replay, inspection, invalid cleanup, and second-file cleanup continue to pass.
- `P2-AC-11`: Secure Local Runtime — Electron keeps contextIsolation true, nodeIntegration false, sandbox true, minimal preload API, no CDN, no public network, local player assets, and controlled file access.
- `P2-AC-12`: Browser Rollback — Existing Web preview, launcher, inspection tests, and smoke remain passing; shared code must not regress Web behavior.
- `P2-AC-13`: Responsive And Accessible — 1280 x 800 and 1440 x 900 CSS viewports have no horizontal overflow, key controls visible, clear focus states, accessible button labels, and status not conveyed by color alone.
- `P2-AC-14`: Visual Comparison Artifacts — Complete Web/Electron comparison artifacts are generated and bound to final P2 HEAD.
- `P2-AC-15`: Regression And Independent Review — P2 targeted tests, desktop smoke, actual normal-mode run, browser rollback, two final loop validations, Reviewer A, Reviewer B, and post-seal all pass.
- `P2-AC-16`: Scope Discipline — P2 does not implement editing, saving, exporting, accounts, cloud, release, installer, signing, updater, new formats, or AI.

## Required Product Artifacts

Generate under `.artifacts/product/P2/`:

1. `web-reference-loaded.png`
2. `web-reference-inspection.png`
3. `desktop-empty.png`
4. `desktop-loading.png`
5. `desktop-loaded.png`
6. `desktop-inspection.png`
7. `desktop-invalid.png`
8. `actual-normal-loaded.png`
9. `smoke-loaded.png`
10. `desktop-1280x800.png`
11. `desktop-1440x900.png`
12. `web-desktop-loaded-comparison.png`
13. `web-desktop-inspection-comparison.png`
14. `normal-runtime-proof.json`
15. `web-desktop-parity-report.json`
16. `artifact-index.json`

Every artifact record must include path, scenario, source, mode, viewport,
headCommit, mime, sizeBytes, sha256, fixture, generatedAt, and
humanReviewRequired.

## Web/Desktop Parity Report

`web-desktop-parity-report.json` must include:

1. `schemaVersion: 1`.
2. `milestoneId: "P2"`.
3. `headCommit`.
4. Web reference entry, renderer hashes, and artifacts.
5. Desktop entry, renderer hashes, and artifacts.
6. Category results for productIdentity, colorTokens, typography, spacing,
   panelHierarchy, playerWorkspace, controls, metadata, inspection, emptyState,
   and invalidState.
7. Intentional differences.
8. Unresolved differences.

Before P2 terminal handoff, no category may be `fail`. Product identity, player
workspace, controls, metadata, and inspection must be `pass`.

## Required Validation

Before terminal state:

1. P1 final PASS packet exists and is complete.
2. Web and Electron current-state audit is complete.
3. Web reference screenshots are captured from the real Web preview.
4. P2 design-system map is complete.
5. P2 shared UI decision is complete.
6. P2 implementation plan is complete.
7. P2 targeted tests pass.
8. Web preview targeted tests pass.
9. Browser rollback local smoke passes.
10. Electron targeted tests pass.
11. Actual normal-mode Electron run passes and generates proof JSON.
12. Independent smoke run passes.
13. Desktop 1280 x 800 and 1440 x 900 screenshots pass artifact checks.
14. Parity report validates.
15. Product artifact index validates.
16. Preliminary `npm run loop:validate` passes.
17. Preliminary Reviewer A and Reviewer B find no blocking issues, or blockers
    are repaired within budget.
18. Final source state is committed with terminal loop state and history.
19. Two final `npm run loop:validate` runs pass on final HEAD.
20. Final actual normal run, smoke run, screenshots, proof, parity report, and
    artifact index are regenerated or confirmed bound to final HEAD.
21. Candidate packet is generated from final HEAD.
22. Reviewer A schema v2 JSON verdict is `PASS`, bound to final source HEAD,
    candidate digest, and `sourceDiffSha256`.
23. Reviewer B schema v2 JSON verdict is `PASS`, bound to candidate artifacts
    and `packetDiffSha256`, without reading repository source or Git history.
24. Post-seal verifier passes.
25. Source workspace is clean.
26. Final response is exactly `.artifacts/loop-handoff/latest/FINAL_RESPONSE.txt`.

## Required Tests

P2 tests must cover:

1. P1 final acceptance state.
2. Root `desktop:dev` still points to the canonical product.
3. Web reference capture uses the real Web preview.
4. Normal process has no smoke flag.
5. Smoke process has an explicit smoke flag.
6. Normal and smoke are not the same PID or runtime instance.
7. Normal and smoke use the same main, preload, renderer, CSS, player, and
   loading assets.
8. `actual-normal-loaded.png` comes from normal process.
9. `smoke-loaded.png` comes from smoke process.
10. Normal import uses the normal loading pipeline.
11. Tests do not statically draw or mock the canvas.
12. Product title is not `Internal Baseline`.
13. Internal badge is low-weight.
14. Layout contains app bar, player workspace, controls, metadata, and
    inspector.
15. Calibration is collapsed by default.
16. Invalid primary text does not expose a raw technical exception.
17. Technical details are collapsible.
18. 1280 x 800 has no horizontal overflow.
19. 1440 x 900 has no horizontal overflow.
20. Keyboard shortcuts do not expand security permissions.
21. contextIsolation, sandbox, and nodeIntegration settings remain secure.
22. No CDN or public network.
23. P1 file picker regression.
24. P1 drag/drop regression.
25. P1 play/pause/replay regression.
26. P1 second-file cleanup regression.
27. P1 invalid-after-valid cleanup regression.
28. Web preview tests and smoke regression.
29. Parity report schema and required categories.
30. Artifact index hash, viewport, source, and head binding.
31. Electron process cleanup.
32. Failure tests use temporary directories or approved fixtures.
33. No real user directory pollution.
34. Electron and Web heavy smoke execute sequentially without shared runtime
    collisions.

## Reviewer A Scope

Reviewer A checks architecture, security, and shared UI:

1. P1 closure.
2. P2 scope.
3. Web/Electron shared strategy.
4. No conflicting duplicated inspection logic.
5. Electron main/preload/renderer boundary.
6. Actual normal-mode evidence.
7. Normal/smoke separation.
8. Security settings.
9. No CDN or network.
10. File permission boundary.
11. Player lifecycle and cleanup.
12. Responsive layout implementation.
13. Browser rollback.
14. No editing scope drift.
15. No Agent Loop expansion.
16. Tests not weakened.

## Reviewer B Scope

Reviewer B checks isolated product and visual parity from only the candidate
packet and mandatory P2 artifacts. Reviewer B must not read repository source,
Git history, hidden snapshots, or unlisted internal files.

Reviewer B checks:

1. Web reference is real and recognizable.
2. Desktop visibly belongs to the same product system.
3. Product identity is unified.
4. Player region is the visual core.
5. Controls are understandable.
6. Metadata is compact and readable.
7. Inspection is structured.
8. Calibration no longer dominates.
9. Invalid state is productized.
10. Actual normal screenshot comes from an independent normal process.
11. Normal and smoke are visually consistent but independently evidenced.
12. Materials are sufficient for product-owner visual acceptance.
13. No request for ordinary engineering material remains.

Reviewer B does not make the final product-owner visual decision.

## Human Gate

If engineering, validation, and Reviewer A/B pass, use `HUMAN_REQUIRED` with one
question:

是否接受 P2 Electron 桌面客户端与现有 Web 预览页面的视觉、信息架构和核心交互收敛，并允许进入 P3 基础编辑？

Options:

- A: 接受 P2，进入 P3 基础编辑。
- B: 不接受，只指出一个最高优先级的剩余视觉或交互方向。

Recommendation: choose A only if Electron and Web clearly belong to the same
product system, the UI no longer feels like an engineering prototype, the
player is the visual core, inspection is scannable, invalid and empty states
are productized, actual normal mode and smoke are visually consistent, and P1
functionality has no regression.

Safe default: B, do not enter P3.

## Completion Gates

1. P1 final PASS packet complete.
2. P2 contract frozen.
3. Web/Electron audit complete.
4. Web reference artifacts complete.
5. Design-system map complete.
6. Shared UI decision complete.
7. Desktop product shell implemented.
8. Structured inspection implemented.
9. Product states implemented.
10. Actual normal-mode evidence complete.
11. Independent smoke evidence complete.
12. Web/browser rollback validation complete.
13. P2 visual artifacts complete.
14. Parity report has no failing category.
15. Targeted tests pass.
16. Two final loop validations pass.
17. Reviewer A PASS.
18. Reviewer B PASS.
19. Post-seal verifier PASS.
20. Source workspace clean.
21. Final response copied exactly from latest `FINAL_RESPONSE.txt`.
