# Mid-term Implementation Preparation

Date: 2026-07-03
Status: implementation preparation; not a separate PRD
Authority: `docs/product/PRODUCT_ROADMAP.md`

## Purpose

Prepare the mid-term engineering lane while the short-term UI/UX refactor
continues in parallel.

This document translates the roadmap's mid-term M1-M26 requirements into an
engineering start plan, technical inventory, work packages, validation gates,
and coordination rules. It does not redefine product scope. If this document
conflicts with `PRODUCT_ROADMAP.md`, the roadmap wins.

Version naming follows `docs/product/VERSIONING_AND_RELEASE_POLICY.md`. The
mid-term template-editing lane is currently planned as Auto SVGA `0.4.x` /
SVGA Edit MVP. The `M1`, `M2`, and later labels in this document are internal
engineering sub-versions or work-stage names, not owner-visible product version
numbers, release stages, or distribution channels.

## Working Assumptions

1. Short-term product scope is frozen, but not yet accepted as a final release
   candidate. Mid-term work may start only in isolated, host-neutral
   implementation and evidence lanes until the short-term acceptance boundary is
   closed or the Product Owner explicitly relaxes that gate.
2. The active short-term UI/UX refactor owns the visible app shell. Mid-term
   work must not redesign, beautify, or wire formal visible Edit-mode UI while
   that lane is active.
3. Early prototype UI is allowed only when it proves behavior that cannot be
   verified through tests or CLI-style fixtures. Prototype UI must stay clearly
   non-product and must not expose inactive future features.
4. M1 is the first implementation target. M2-M5 planning can proceed, but code
   should not jump ahead of M1 transform/edit-session/compile foundations.
5. Existing P3/P4/P5/P6 Workbench modules are useful lineage and candidate
   foundations. They must still be revalidated on the current head before being
   treated as accepted mid-term infrastructure.
6. After the 2026-07-03 Owner correction, the AE to Auto SVGA production bridge
   has higher near-term product priority than the template-editing line because
   it directly serves current human designers and team production. Mid-term work
   may continue only where it does not block AE bridge delivery or where it
   provides reusable parsing, transform, compile, preview, history, budget, or
   validation foundations for the bridge.

## Product Readout

The mid-term product direction is template-based SVGA motion editing:

- Start from a complete, named, already-composed SVGA.
- Let users adjust bounded parameters, preset curves, transforms, mirrors,
  templates, and repairs.
- Compile the result back into real SVGA bytes.
- Return compiled bytes to the short-term Preview surfaces for playback,
  inspection, optimization, comparison, and save.

The mid-term line must not become a free keyframe editor, a low-end After
Effects clone, a source-project importer, an unordered asset-folder assembler,
or an AI/cloud semantic-recognition system.

The Owner-approved AE production bridge is a separate committed production
pipeline, not a general mid-term source-project editor. It should be planned
from `docs/product/PRODUCT_ROADMAP.md` and
`docs/product/AE_BRIDGE_PRODUCT_BRIEF.md`, while this document remains focused
on the mid-term template-editing line.

## Sub-version Execution Order

| Sub-version | Engineering focus | Start condition | Stop condition |
| --- | --- | --- | --- |
| M1 | Edit session, layer transforms, preset curves, undo/redo, copy/paste, mirror transforms, compile-back | Short-term open/play/save behavior is stable enough to use as a regression target | A transformed SVGA compiles, reopens in Preview, validates allowed-vs-preserved fields, and keeps Save/Save As semantics intact |
| M2 | Production profiles, audio parse/display, optional audio exclusion, sequence-frame repair | M1 compile report can distinguish intentional edits from forbidden drift | Built-in/custom spec profiles, audio toggle, and supported sequence repair each fail closed with reports |
| M3 | Transform templates, wing flap, blend-mode subset, basic light and seeded particles | M1 transform/template schema and M2 budget reporting exist | Templates produce deterministic output with size/memory risk reports |
| M4 | Deterministic semantic analysis and recommendation | M3 template application is stable | Recommendations carry evidence/confidence and require user review before mutation |
| M5 | Selected baked effects and distribution hardening | M1-M4 evidence is current-head and performance risks are visible | Baked effects and distribution claims are tied to actual package/runtime evidence |

## Current Technical Inventory

| Area | Existing asset | Mid-term use |
| --- | --- | --- |
| Workbench contracts | `src/workbench/contracts.ts` | Base read model for assets, layers, resources, progress, cancellation, playback sessions |
| SVGA parsing | `src/workbench/svga/format-adapter.ts`, `node-protobuf-inspector.ts` | Normalize SVGA metadata before edit-session creation |
| Resource classification | `src/workbench/svga/resource-classifier.ts` | Existing deterministic role classification; extend later for M22 semantics |
| Byte-safe image editing | `src/workbench/svga/image-resource-editor.ts` | Reuse decode/encode, round-trip reports, known-field invariant style, source immutability checks |
| Edit history | `src/workbench/svga/image-edit-history.ts` | Generalize the transaction/digest model beyond image replacement for M1 undo/redo/copy/paste |
| Batch mapping | `src/workbench/svga/batch-png-mapping.ts` | Reuse deterministic mapping/status/report/privacy patterns for future naming-rule config and batch decisions |
| Sequence repair | `src/workbench/svga/sequence-frame-repair.ts`, `sequence-frame-evidence.ts` | Candidate M2 repair primitive; keep deferred from short-term UI and fail closed |
| Short-term state/save surfaces | `src/workbench/short-term-*`, `tools/shared/product-frontend/*`, Electron prototype host files | Regression target for compiled Preview, save-state, redaction, and host security |
| Validation scripts | `npm run build`, targeted `node --test dist/tests/*.test.js`, `npm test`, `npm run desktop:smoke`, `npm run svga-workbench:v1:validate` | Risk-proportional gates; use full desktop smoke only after UI/host integration is touched |

## Key Technical Gaps

1. The existing image editor intentionally rejects transform, alpha, timing,
   audio, shape, and sprite-structure changes. M1 needs a new compile path that
   allows explicitly accepted transform/opacity edits while preserving
   everything else.
2. There is no normalized editable-layer session model for anchor, position,
   scale, rotation, opacity, curve presets, mirror links, or template settings.
3. Existing history is resource-replacement specific. It should be generalized
   carefully rather than copied into a parallel one-off implementation.
4. M1 needs deterministic transform math and preset easing tests before any UI
   wiring.
5. Mid-term compile reports need their own schema so accepted edits are not
   mistaken for invariant violations.
6. Semantic roles are currently narrow. M22 vocabulary and confidence evidence
   should be added later, after M1/M3 templates can consume them.
7. A durable sidecar/project-session format is explicitly outside committed
   mid-term scope unless the Product Owner promotes it.

## M1 Technical Plan

### M1-WP0: Readiness Baseline

Goal: prove the current head and fixture set are a safe starting point.

Outputs:

- current-head branch/status snapshot
- list of protected short-term UI files
- fixture inventory for ordinary SVGA, multi-sprite, matte, audio, sequence,
  and unsupported structures
- baseline command results

Validation:

- `npm run build`
- targeted tests for `svga-image-resource-editor`, `svga-image-edit-history`,
  `svga-sequence-frame-repair`, and short-term save/state modules

### M1-WP1: Editable Layer Model

Goal: derive an edit session from decoded SVGA sprites without mutating bytes.

Implement host-neutral types for:

- source identity and source hash
- editable layer id, sprite index, resource ids, display name, role evidence
- per-frame transform facts
- editable base properties: anchor, position, scale, rotation, opacity
- unsupported structures and blocking reasons

Validation:

- fixtures cover static sprite, matteKey, multi-frame sprite, missing imageKey,
  and unsupported fields
- unsupported cases fail closed with structured issues

### M1-WP2: Curves And Transform Math

Goal: implement the allowed preset curve vocabulary and transform interpolation
before any product wiring.

Scope:

- only roadmap-listed curves
- no arbitrary keyframes
- frame-first timing
- deterministic numeric tolerance

Validation:

- curve snapshot tests
- transform decomposition/composition tests
- no unlisted curve id accepted

### M1-WP3: General Edit History

Goal: extend the existing digest/history pattern to cover mid-term edit-session
mutations.

Transactions:

- layer transform change
- anchor change
- template add/remove and parameter change
- mirror-link create/remove and mirror reference change
- copy/paste transform or template settings
- reset selected/all supported edits

Validation:

- undo/redo restores exact session state and dirty state
- redo branch truncates after new edits
- incompatible paste fails without partial state
- save point remains independent from source bytes

### M1-WP4: Compile Edited SVGA

Goal: produce real SVGA bytes from M1 edits and prove allowed changes only.

Rules:

- original source bytes remain unchanged
- transform/alpha changes are allowed only when tied to accepted edit records
- image/audio/matte/clipPath/shape/resource key closure remains preserved
- output inflates, decodes, and reopens
- report lists allowed changes, preserved structures, blocked structures, and
  unexpected changes

Validation:

- compile report schema tests
- transformed output hash differs from source when edits exist
- no-op compile either returns source-equivalent bytes or explains canonical
  serialization changes
- malformed/unsupported files fail closed

### M1-WP5: Minimal Proof Harness

Goal: verify M1 without product UI design.

Preferred first harness:

- fixture-driven command or test helper that opens an SVGA fixture, applies a
  deterministic transform edit, compiles, validates, and writes a redacted
  report to a temporary/artifact path

Prototype UI is optional and should be used only if playback proof cannot be
captured otherwise.

### M1-WP6: Preview Handoff Integration

Goal: after M1 core is stable and short-term shell integration is safe, hand
compiled bytes to the existing Preview mode and Save/Save As flow.

This is the first point where visible app behavior may be touched. It should
wait for an explicit branch/worktree boundary with the short-term UI/UX owner.

## M2-M5 Preparation Notes

- M2 sequence repair should reuse the current fail-closed near-empty-speck
  primitive, but expose it as mid-term repair evidence only after the M1 compile
  report can bind accepted mutations.
- M2 audio work should start as parser/report support and export exclusion,
  not waveform editing.
- M3 templates must define schemas before implementation: target roles,
  parameters, units, defaults, min/max, supported curves, preview strategy,
  compile strategy, unsupported behavior, and size/memory risk fields.
- M4 semantic recommendation should extend deterministic evidence vocabulary:
  wing/翅膀, gem/宝石, crown/皇冠, ribbon/飘带, ring/圆环, frame/主体,
  metal/金属, glow/光效, left/right/L/R/左/右, top/bottom/上/下.
- M5 distribution hardening must remain separate from product acceptance,
  signing credentials, notarization, Windows packaging, and public release.

## Coordination Rules

1. Keep the mid-term lane out of short-term UI/UX files unless a shared
   integration checkpoint is explicitly opened.
2. Prefer a separate branch or worktree for M1 implementation, for example
   `agent/codex/mid-term-m1-edit-foundation`, started from the chosen
   integration base after current dirty short-term files are understood.
3. Treat code under `src/workbench/svga/` and `src/workbench/` as the primary
   M1 surface. Avoid changing Electron UI files during M1-WP1 through M1-WP5.
4. Every work package should have a failure-first test or fixture before the
   implementation is called done.
5. Do not mark M1 accepted from unit tests alone. Acceptance needs compile
   proof, reopen proof, Preview handoff proof, and save-state proof.
6. Do not commit generated SVGA, PNG, GIF, video, local job output, real design
   assets, or raw production samples.
7. If AE bridge work and mid-term work compete for the same host integration,
   preview, save, package, compatibility, or product-design surface, prioritize
   AE bridge unless Product Owner explicitly chooses otherwise.

## Project Management Board

| Work package | Status | Owner role | Evidence owner | Integration gate |
| --- | --- | --- | --- | --- |
| M1-WP0 readiness baseline | Planned | Mid-term lead | Mid-term lead | Clean branch/worktree and baseline commands |
| M1-WP1 editable layer model | Planned | Implementation | Evidence reviewer | Targeted model tests |
| M1-WP2 curves and transform math | Planned | Implementation | Evidence reviewer | Curve and transform tests |
| M1-WP3 general edit history | Planned | Implementation | Evidence reviewer | Model/history tests |
| M1-WP4 compile edited SVGA | Planned | Implementation | Independent verifier | Round-trip compile report |
| M1-WP5 minimal proof harness | Planned | Implementation | Evidence reviewer | Redacted proof artifact |
| M1-WP6 Preview handoff | Blocked on integration checkpoint | Implementation + short-term UI owner | Independent verifier | Preview/save proof |
| M2 spec/audio/repair planning | Candidate | Mid-term lead | Evidence reviewer | M1 compile report exists |
| M3 template schema drafting | Candidate | Mid-term lead | Evidence reviewer | M1 transform and M2 budget contracts exist |

## Validation Budget

Current document-only preparation is Tier 0:

- required: `git diff --stat`
- required: `git diff --check`
- not required: build or runtime tests because runtime code is not touched

Future M1 runtime work is at least Tier 2, and M1-WP4/WP6 become Tier 3 because
they touch SVGA compile, playback, and save behavior.

## Open Product Questions

1. The roadmap says mid-term work starts only after short-term acceptance. The
   current instruction appears to authorize parallel preparation and functional
   development. Confirm whether that authorization covers M1-WP1 through M1-WP5
   host-neutral code before short-term acceptance, while keeping M1-WP6 visible
   integration blocked.
2. Should M1 implementation start from the current autonomous branch head, from
   `main`, or from a new worktree after the short-term UI/UX branch is staged?
3. Is a durable edit-session sidecar still out of scope for M1, even if it would
   make reopen-and-continue editing easier?
4. Which sample class should be the first owner-visible M1 proof: simple
   transform edit, mirror transform, or compile-to-preview handoff?

## Recommended Next Action

Create a dedicated M1 implementation branch or worktree, run M1-WP0 baseline,
then implement M1-WP1 and M1-WP2 as host-neutral tests first. Keep M1-WP6
blocked until the short-term UI/UX owner provides an integration window.
