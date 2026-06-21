# P6: Web Preview Full Parity, Shared Frontend And macOS Internal App

Milestone ID: P6
Title: Web Preview Full Parity, Shared Frontend And macOS Internal App
Status: frozen
milestoneStartCommit: `b1b5395412575ed484d255777f9e258b659874bf`
Branch: `agent/codex/p6-integration`
Previous milestone: `P5`

maxRepairRounds: 6
maxConsecutiveNoProgressRounds: 2

## Objective

Build a shared Web/Electron product frontend so the macOS internal Desktop app matches the current Web Preview product surface in functionality, UI, interaction state, and UI motion.

After P6:

1. Web Preview still runs independently.
2. Electron uses the same product frontend instead of an imitation page.
3. Users can open the macOS `.app` directly from Finder.
4. Desktop performs the current daily SVGA acceptance workflow from Web.
5. Desktop does not require terminal, browser, manual Web server start, CDN, or public network.
6. P3-P5 editor incubation remains preserved but hidden by default.

## Product Boundary

Allowed:

- P5 owner reset and editor incubation documentation.
- Frozen Web baseline inventory and parity contract.
- Shared product frontend extraction.
- WebHostAdapter and ElectronHostAdapter.
- Web regression preservation.
- Electron local-only host integration.
- macOS internal unsigned/unnotarized `.app`.
- Parity tests, screenshots, motion evidence, runtime reports, and review packet.

Prohibited:

- accepting P5 as PASS
- continuing P5 Repair 3
- new editor features in default Desktop product
- format conversion
- export workbench
- automatic optimization
- new format parsers
- cloud, account, sync, telemetry
- production signing, notarization, installer, release, publish, push, or merge
- using AI, external models, multimodal services, or network analysis

## Approved Desktop Differences

- BrowserWindow native window
- macOS menu
- Finder file choose
- file drag into window
- File > Open
- local Save As
- macOS shortcuts
- `.svga` file association
- Electron main/preload/renderer security boundary
- no browser address bar
- no manual server start

All other differences are unapproved until the owner explicitly accepts them.

## Acceptance Criteria

- `P6-AC-01`: Owner Roadmap Reset - P5 is archived as editor incubation and is not marked PASS.
- `P6-AC-02`: Frozen Web Product Baseline - running Web Preview inventory and baseline artifacts are frozen.
- `P6-AC-03`: Shared Product Frontend - Web and Electron share product page source, core CSS, state machine, and motion definitions.
- `P6-AC-04`: Feature Parity - required Web features have 100% Desktop evidence.
- `P6-AC-05`: UI Region Parity - required Web UI regions have 100% Desktop evidence.
- `P6-AC-06`: Interaction Parity - required Web interactions have 100% Desktop evidence.
- `P6-AC-07`: Product State Parity - required Web states have 100% Desktop evidence.
- `P6-AC-08`: Motion Parity - required Web UI motions have 100% Desktop evidence.
- `P6-AC-09`: No Unapproved Difference - unresolved and unapproved differences are empty.
- `P6-AC-10`: Browser Regression - Web Preview, server, and local launcher do not regress.
- `P6-AC-11`: Desktop Host Integration - Electron open, drag/drop, menu, Save As, file association, and secure IPC work.
- `P6-AC-12`: Local-only Security - no CDN, no public network, no arbitrary filesystem or shell.
- `P6-AC-13`: Product Performance And Cleanup - no stale state, obvious leak, residual process, or temp/cache issue.
- `P6-AC-14`: macOS Internal App - unsigned/unnotarized internal `.app` and portable ZIP exist.
- `P6-AC-15`: Actual App Runtime - packaged App actually starts, opens fixture, plays, inspects, and exits.
- `P6-AC-16`: Responsive And Accessible - key viewport, focus, keyboard, labels, and reduced-motion behavior pass.
- `P6-AC-17`: Independent Review - validation, Reviewer A, Reviewer B, and post-seal verifier pass.
- `P6-AC-18`: Scope Discipline - no Phase 2, Phase 3, or Phase 4 product feature starts.

## Worker Dependency Plan

Integration Coordinator owns:

- `docs/loop/CURRENT_MILESTONE.md`
- `docs/loop/LOOP_STATE.md`
- `docs/loop/LOOP_HISTORY.jsonl`
- `AGENTS.md`
- root `package.json`
- final P6 review packet and upload ZIP

Worker branches:

- A1: `agent/codex/p6-a1-web-baseline`
- A2: `agent/codex/p6-a2-shared-frontend`
- A3: `agent/codex/p6-a3-electron-host`
- A4: `agent/codex/p6-a4-parity-tests`
- A5: `agent/codex/p6-a5-macos-package`

A2 may perform only read-only audit and migration planning until A1 is integrated.

Merge order:

1. A1
2. A2
3. A3
4. A4
5. A5
6. integration repair

## Terminal Gate

P6 must end as `HUMAN_REQUIRED` and ask only whether the owner accepts Web Preview full Desktop parity and the current macOS internal `.app`, allowing Phase 2 to start.

Safe default: reject and identify the highest-priority parity or App issue.
