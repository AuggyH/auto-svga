# Auto SVGA / Windows Client / Asset Pipeline Alignment Handoff

Date: 2026-07-23

Status: cross-repository alignment checkpoint; Windows client not started

Audience: Auto SVGA PM/integration, future Windows client owner, Windows asset-pipeline owner

Product authority: `docs/product/PRODUCT_ROADMAP.md`

## Purpose And Authority Boundary

This handoff aligns three related but separately governed workstreams:

1. the current Auto SVGA macOS client and portable motion-format core;
2. the future Auto SVGA Windows client parity workstream;
3. the Windows-local social-dressing asset production pipeline.

It is a review and handoff record, not a second PRD. Product scope and version
order remain governed by `docs/product/PRODUCT_ROADMAP.md` and
`docs/product/VERSIONING_AND_RELEASE_POLICY.md`. Current task, candidate, CI,
review, QA, and release state remains governed by live GitHub records.

## Exact Readback Snapshot

### Auto SVGA

| Field | Readback |
| --- | --- |
| Repository | `AuggyH/auto-svga` |
| `origin/main` at audit start | `6806e1370cd411fce8362c317e7f30543da889b1` |
| Current exact product candidate | `0.2.0-alpha.2` internal, build commit `6806e1370cd411fce8362c317e7f30543da889b1` |
| Exact-candidate QA | `18 PASS / 1 PARTIAL / 0 FAIL / 2 BLOCKED`; Approved For Owner Review and Packaging Preparation |
| Accepted QA boundaries | Reduced Motion / independent loading-frame evidence `PARTIAL`; one valid combined Lottie replacement case and valid AEB/FBP cases `BLOCKED` |
| Release tracking | GitHub Issue #6 `OPEN/HOLD` |
| Packaging gate | PR #19 remains open; exact reviewed successor `452efe1ad2b4c9356fbd264b529c2d36c7ad3537` received Changes Requested and a focused successor repair is active |
| Roadmap/alignment delivery | PR #20, branch `codex/product-roadmap-pag-vap-agent-first`; parent head before this handoff `a22b380eea74fa500f92c95f94d6990ce559e0c9` |

The QA result is not Product Owner acceptance, package acceptance, installed
local stable, promotion, or release. The current installed macOS baseline must
not be treated as the Windows port source until the controlled promotion gate
closes and its exact installed identity is recorded.

### Windows Asset Pipeline

| Field | Readback |
| --- | --- |
| Repository | private `AuggyH/social-dressing-asset-pipeline` |
| Default branch / exact commit | `main@2a5f55432780cfb6971c64d232ff5b1527d98af1` |
| Latest Windows handoff | `docs/handoffs/2026-07-23-windows-avatar-frame-current-state.md` |
| Current state | `active_acquisition_only` |
| Training gate | `training_authorized=false`, `training_bytes=0` |
| Non-additive acquisition snapshot | Huaban about 14,965 files; multisource about 19,211 files including about 14,858 originals; MENA seed about 10,021 files; current vendor registry 7,779 retained / 7,755 unique SHA-256; first Xiaohongshu seed 14 notes / 14 source covers |
| Git boundary | control plane only; models, raw media, datasets, outputs, previews, bulk JSONL, and secrets remain on the Windows data plane |
| Existing integration schemas | `schemas/avatar-frame-job-manifest.schema.json`; `schemas/avatar-frame-layer-package-v0.3.schema.json` |
| Network/client implementation | no `worker/` gateway and no `clients/` implementation exists at this commit |

The latest explicit Windows instruction is to continue broad source
acquisition. It does not authorize manual review/family merging, training-view
deduplication, LoRA training, remote ComfyUI access, or Auto SVGA integration.

## Product Owner Sequencing Decision

The Windows client starts only after the macOS `0.2.x` client is stable. For
this handoff, "stable" means all of the following are true for one exact
identity:

1. required source implementation and independent Code Review are merged;
2. an exact persistent App/ZIP package is frozen and independently read back;
3. exact-candidate QA passes with explicit accepted support boundaries;
4. the Product Owner completes the focused daily-use review and explicitly
   accepts the candidate;
5. the repository promotion command installs the existing exact candidate;
6. installed build identity, runtime closure, signing state, installed smoke,
   one-target launch behavior, rollback bundle, process/listener cleanup, and
   residue checks pass;
7. Issue #6 closes and the `0.2.x` local-stable identity is recorded.

Only then should integration create a dedicated Windows client task. The
Windows client task must not reuse the Windows acquisition task or make the
asset-pipeline writer responsible for client implementation by implication.

## Target Architecture

```text
Auto SVGA product core
  format registry + normalized facts + playback + replacement + reset
  SVGA / Lottie / VAP adapters; PAG follows its own gate
            |
            +-- macOS host
            |     dialogs, Finder/open/drag, menus, LaunchServices,
            |     macOS packaging, promotion, rollback
            |
            +-- Windows host
                  Windows dialogs/open/drag, paths/encoding, GPU/codecs,
                  installer, launch identity, update/rollback

Windows asset production service
  local ComfyUI + deterministic tools + future allowlisted worker API
            |
            +-- versioned Asset Pack
            +-- versioned Motion Plan
            +-- job/status/artifact receipts
                        |
                        v
             Auto SVGA headless engine
                        |
                        v
              preview + human acceptance
```

### A. Portable Auto SVGA Core

Keep platform-neutral behavior in reusable modules:

- format detection and normalized motion facts;
- SVGA, Lottie, and VAP parsing and playback adapters;
- replaceable-target classification based on format structure, not filename
  guesses alone;
- runtime text/image replacement, reset, sibling isolation, and source
  immutability;
- lifecycle, performance, unsupported-feature, and validation reporting;
- later, the transactional headless operations `load`, `inspect`, `replace`,
  `transform`, `timeline`, `effect`, `render`, `validate`, and `export`.

### B. Platform Hosts

The macOS and Windows clients are callers of the same product core. Windows
must replace, not emulate, macOS-only concerns such as LaunchServices, Finder,
native macOS dialogs, bundle codesign, `.app` identity, and the local-stable
promotion transaction. Windows gets its own exact process, window, installer,
package signing, update/rollback, codec/GPU, and installed-client evidence.

### C. Windows Asset Production Service

The asset pipeline remains a separate product subsystem. It owns local
ComfyUI/model execution, deterministic asset construction, source acquisition,
layer/package validation, and later an allowlisted worker API. It does not own
Auto SVGA desktop UI, playback semantics, client packaging, or release claims.

### D. Shared Contracts

Cross-repository integration should exchange versioned, hashed contracts, not
absolute `D:\\...` paths or arbitrary ComfyUI workflows:

- `AssetPack`: immutable assets, semantic roles, layer graph, provenance,
  licenses, hashes, dimensions, color/alpha facts, and validation receipts;
- `MotionPlan`: asset roles, layer relationships, template ID, time structure,
  enter/loop/exit phases, easing, effects, `imageKey` mapping, export
  constraints, and quality/performance targets;
- job contract: request ID, pipeline/version, state, timestamps, cancellation,
  retry/error information, input authority, and output receipt;
- artifact receipt: relative logical path, SHA-256, byte size, MIME/type,
  producer/version, and package identity.

## Windows Client Delivery Plan

The initial port must reproduce the accepted macOS `0.2.x` SVGA/Lottie/VAP
daily-use boundary before it adds new formats or generation features.

| Phase | Scope | Exit evidence |
| --- | --- | --- |
| W0 — source and platform audit | Bind the exact stable source; identify portable core versus macOS host; inventory dependencies, native modules, codecs, GPU/WebGL, paths, encoding, menus, dialogs, process identity, and packaging gaps. | Exact portability matrix, explicit non-goals, dependency/license audit, test plan, rollback plan. |
| W1 — headless/core proof | Run parsing, facts, replacement/reset, source-safety, lifecycle, and validation tests on Windows without owner-visible UI expansion. | Same core fixtures and behavioral contracts pass on Windows; path separator, Unicode, long-path, case, and temp-file cases covered. |
| W2 — Windows host shell | Implement one client shell with native open/save, drag/drop, Recent, keyboard/focus, playback surface, error/recovery, and isolated profile/process identity. | Windows host tests plus exact foreground smoke; GPU/codec support and unsupported states are truthful. |
| W3 — `0.2.x` parity | Prove SVGA, Lottie, and VAP open/play/pause/inspect/replace/reset behavior against frozen valid materials. | Independent Windows QA on one exact package; no macOS predecessor PASS is transferred. |
| W4 — package and rollback | Add `windows-internal` package, installer/update boundary, signing disposition, one-target launch behavior, installed identity, and recoverable rollback. | Clean-machine install/readback/smoke/uninstall or rollback evidence; no process, listener, profile, or temp residue. |
| W5 — daily-use acceptance | Product Owner reviews the exact installed Windows package and accepted boundaries. | Explicit Owner disposition; only then may the package be called a Windows stable baseline. |

PAG, VAP generation, LTR/RTL conversion, AE Bridge, Agent automation, ComfyUI
gateway access, and broader export remain outside W0-W5 unless the Product
Owner opens their separate roadmap gates.

## Asset Pipeline Integration Plan

| Phase | Scope | Exit evidence |
| --- | --- | --- |
| AIP0 — schema reconciliation | Treat the two current Windows schemas as inputs, not final integration contracts. Resolve package identity, state machine, hashes, provenance, coordinate semantics, and Motion Plan mapping. | Versioned schema proposal plus golden valid/invalid fixtures and deterministic validators in both repos. |
| AIP1 — offline package | Export one immutable avatar-frame Asset Pack locally and import it into Auto SVGA without a network service. | Exact ZIP/package hash, hygiene checks, zero-diff recomposition, source immutability, and preview evidence. |
| AIP2 — allowlisted worker API | Only after offline package reliability, implement health/pipeline/job/cancel/artifact endpoints. Keep ComfyUI on localhost and forbid arbitrary workflows, paths, and commands. | Authentication, allowlist, size/concurrency limits, cancellation, retry, audit, and artifact-digest tests. |
| AIP3 — first Agent vertical | Requirement -> Design Rules/avatar-frame Skill -> local ComfyUI assets -> Asset Pack -> Motion Plan -> headless engine -> SVGA -> validate/optimize -> preview -> human acceptance. | One frozen avatar-frame golden path with reproducible inputs, exact outputs, quality/performance evidence, and explicit human acceptance. |

Network integration is deliberately later than the offline file contract. This
keeps schema and artifact correctness independently testable and avoids making
LAN availability part of the first integration proof.

## Current Schema Gaps To Close In AIP0

### Job Manifest `1.0`

The current manifest is useful for a completed local MVP, but it is
success-only and 1024-specific. Integration needs:

- `queued`, `running`, `cancelling`, `cancelled`, `failed`, and `success`
  states with error/retry/cancellation receipts;
- request/job authority, idempotency, source immutability, and producer
  identity;
- artifact SHA-256, byte size, MIME/type, and logical package path;
- input/output package identity and validation receipt binding;
- size constraints expressed by pipeline version instead of an implicit
  cross-product constant.

### Layer Package `0.3`

The current schema already preserves semantic roles, z-order, occlusion,
complete sources, full-canvas layers, transforms, and recomposition state. The
shared Asset Pack still needs:

- package ID/version, producer/tool/platform identity, creation authority, and
  immutable root digest;
- per-file SHA-256, byte size, MIME, color-space, alpha, dimensions, and path
  hygiene;
- source, license, provenance, model/workflow, and derivative relationships;
- an explicit coordinate/anchor contract cross-bound to Auto SVGA semantics;
- Motion Plan or motion-hint references, template compatibility, `imageKey`
  intent, and export constraints;
- archive containment, duplicate/traversal/symlink policy, validation receipt
  hashes, and forward/backward compatibility rules.

## Roadmap Alignment

| Product track | Cross-repository meaning |
| --- | --- |
| `0.2.x` | Close macOS SVGA/Lottie/VAP local stable first; then start Windows parity on the same accepted behavior. PAG is a separate follow-up. |
| `0.3.x` | AE Bridge remains the human designer production bridge. FBP is an existing partial controlled Figma-import path, not proof of arbitrary Figma ingestion. |
| `0.4.x` | SVGA template/edit/compile-back capabilities mature the reusable engine but do not implicitly authorize ComfyUI integration. |
| `0.5.x` | VAP generation from video or frame sequences and bounded LTR/RTL conversion discovery keep independent requirements and QA. |
| `0.6.x+` | Agent-first Design Rules + asset Skill + local/LAN ComfyUI + Asset Pack + Motion Plan + headless engine; avatar frame is the first vertical. |

## Drift And Open Alignment Items

1. The actual private repository is
   `AuggyH/social-dressing-asset-pipeline`; older notes and informal requests
   may use underscores or the superseded planned name
   `auto-svga-comfy-pipeline`.
2. `analysis/avatar-frame-process-state-r1.json` predates the latest Windows
   handoff and still points toward rights materialization/training readiness.
   The later explicit `active_acquisition_only` handoff wins; Windows should
   reconcile the process-state file before it is used for routing.
3. The dual-device research planned `worker/` and `clients/swift/`, but neither
   exists in the current repository. The document is architecture research,
   not implementation evidence.
4. The Windows Git repository intentionally excludes the data plane. A clone
   cannot prove raw media, model, dataset, or output availability and cannot
   run an end-to-end asset test without a separate immutable transfer.
5. `avatar-frame-static-mvp-r001` is packaged for local evaluation. Its Design
   Rules are a regression-validated candidate, not user-accepted formal
   knowledge; Windows/ComfyUI/Auto SVGA runtime integration is not validated.
6. The current schemas are valuable prototypes but are not sufficient as a
   security, transaction, artifact-integrity, or cross-platform API contract.
7. Historical USR16-044 instance-LoRA evidence must not be presented as a
   reusable avatar-frame Skill or authorization for universal topology, PBR,
   or MENA LoRA training.

## Mutual Handoff And Continuity Protocol

After this PR merges, the Windows side should read this exact document before
starting client work. When the macOS stable trigger closes, Auto SVGA
integration should send the Windows owner one compact kickoff containing:

- exact Auto SVGA stable commit, product version, channel, package hash, and
  installed identity;
- accepted support boundaries and the W0 portability matrix request;
- exact shared schema versions and fixtures;
- one owner, one next gate, response expectation, and required callback.

The Windows owner must callback on completion or blocker with exact branch,
commit, changed files, tests, risk, non-claims, and next recommended gate.
Integration then decides and dispatches the next review, QA, packaging, or
repair task. A completed task is archived only after its durable handoff is
received and the successor task has read the handoff and is actively working.

The same rule applies when PM/integration itself rotates: create the successor,
confirm authoritative readback and active ownership, then archive the old task.
Only a product-level blocker or a decision that changes scope, support, release
authority, training authorization, or safety should stop for Product Owner
input. Ordinary implementation, review, QA, and packaging gates continue
through their assigned owners.

## Current Next Actions

1. Auto SVGA continues PR #19's focused packaging-inspector repair and
   independent exact-head re-review. No package promotion is authorized yet.
2. After PR #19 merges, freeze and independently validate the exact successor,
   complete Owner review, and execute the controlled local-stable promotion
   gate before closing Issue #6.
3. PR #20 carries the roadmap and this alignment checkpoint. It must not be
   treated as Windows implementation or merge ahead of an incompatible active
   exact-base gate.
4. Windows continues `active_acquisition_only`; no training, client port,
   worker API, remote ComfyUI, or Auto SVGA integration starts now.
5. Once macOS `0.2.x` is stable, create the dedicated Windows W0 task and keep
   the asset pipeline in its separately authorized phase.

## Non-Claims

This checkpoint does not claim macOS Owner acceptance, local-stable promotion,
Issue closure, Windows client implementation, Windows package readiness,
ComfyUI gateway readiness, training authorization, production-approved Design
Rules, production-approved avatar-frame art, or Agent pipeline completion.
