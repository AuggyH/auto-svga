# Review: Multi-format Conformance Milestone

## 1. Summary

This milestone repairs the shared Launch-to-Preview product architecture for
`ASV-QA-20260714-001` and child findings `002` through `008`. The formal 0.2
shell now composes the accepted short-term SVGA workflow instead of replacing
it with a separate candidate-only controller. SVGA, Lottie, and VAP share one
host-owned intake path, one stage layout, one recent-file model, and one
capability projection while retaining format-specific runtime behavior.

Status: Fix Ready for independent Code Review and rebuilt installed QA. The QA
tickets remain open and are not closed by this source milestone.

## 2. Git State

- Branch: `codex/0.2-multiformat-conformance-milestone-20260714`
- Base: `59f4001230a7f2834f3374034fa1e0cf5da83e14`
- Accepted shell authority selectively preserved: `c012dad6c3e84648e76c9d95c3d6193d65fe945c`
- Final exact head: bound by the Fix Ready callback and post-commit proof files
- Classified residue: untracked `.pnpm-store/`, preserved and unstaged
- Temporary dependency overlay: removed before commit

## 3. Root Cause And Repair Contract

### Root cause

The 0.2 multi-format surface layered a generic candidate controller, intake
path, menu, and panel over the short-term desktop shell. That split discarded
SVGA workflow authority, let drag intake lose host path and ancillary-resource
context, entered Loading before chooser acceptance, exposed generic/internal
facts, and sized runtime media without reserving shell controls.

### Why prior work was insufficient

The prior source proved real format runtimes and VAP fusion behavior, but it did
not integrate those runtimes with the accepted owner shell and the formal 0.1
SVGA command model. State and runtime success therefore coexisted with product
conformance regressions.

### Failure-first evidence

The bundled conformance suite first encoded the seven QA findings as behavioral
contracts: region reservation, host intake parity and ancillary context,
recent-file limits and recovery, owner copy, cancel geometry, capability panel
projection, and formal 0.1 SVGA commands. The host tests additionally cover
embedded VAP config, adjacent sidecar, sidecar-only, sidecar-absent, and
external-resource Lottie intake.

### Success stop

One source head must pass the focused conformance suite, full Electron suite,
build, full project suite, design-system check, source/material matrix proof,
and hidden real-rendering regression while keeping paths redacted and formal
0.1 isolated.

### Failure stop

Any loss of accepted SVGA/Lottie/VAP rendering, stale or path-leaking intake,
unbalanced runtime cleanup, external request, or inability to bind the routed
materials stops Fix Ready. Missing task-owned fusion evidence is reported as an
open evidence row rather than fabricated.

## 4. Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/preload.cjs`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-product-conformance.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-*.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-conformance-source-proof.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-real-rendering-matrix-proof.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`

## 5. Document-To-Behavior Trace

| Authority / ticket | Implemented behavior | Source evidence | Status |
|---|---|---|---|
| `PRODUCT_ROADMAP.md` shared owner workflow | Formal 0.2 delegates SVGA work to the accepted short-term controller and uses shared host/runtime contracts for Lottie and VAP | app/controller composition and full regression | Implemented; QA pending |
| `SHORT_TERM_UI_UX_DESIGN_BRIEF.md` Launch and Preview hierarchy | Launch retains open/recent affordances; Preview reserves mode, transport, and facts regions | DOM/CSS conformance tests | Implemented; QA pending |
| `SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md` state and recovery | Cancel stays on Launch; accepted intake alone begins Loading; missing recent entries recover without stale state | controller and host tests | Implemented; QA pending |
| `DESIGN.md` tokenized desktop tool layout | Runtime stage uses shared tokens and contain fitting for square, wide, and tall media | design-system check and layout assertions | Implemented; QA pending |
| `ASV-QA-20260714-002` | Reserved stage geometry and contained media | focused layout matrix | Repaired in source |
| `ASV-QA-20260714-003` | Host-owned picker/drag/menu/file-open intake preserves source bytes and deterministic ancillary context | embedded/adjacent/sidecar-only/absent/external-resource tests | Repaired in source |
| `ASV-QA-20260714-004` | Launch 5, menu 10, clear, redaction, missing-record recovery | recent-file behavioral tests | Repaired in source |
| `ASV-QA-20260714-005` | Owner copy uses `打开文件`; candidate/proof/internal language removed | copy scan and DOM tests | Repaired in source |
| `ASV-QA-20260714-006` | Picker cancel is a Launch and geometry no-op | cancellation state test | Repaired in source |
| `ASV-QA-20260714-007` | Right panel is format/capability specific and suppresses internal phases while retaining warnings | capability projection tests | Repaired in source |
| `ASV-QA-20260714-008` | Formal 0.1 SVGA rename, optimization, compare, Save As, overwrite, and menu actions remain available | controller/menu/0.1 guard regressions | Repaired in source |

## 6. Validation

- Focused and related Electron tests: PASS `99/99`.
- `npm run build`: PASS.
- `npm run test:all`: PASS `532/532`.
- `npm run desktop:short-term:design-system-check`: PASS.
- `git diff --check`: PASS.
- Source proof before commit: PASS; exact-head proof regenerated after commit.
- Hidden real-rendering proof before commit: PASS for real SVGA, Lottie, and VAP; exact-head proof regenerated after commit.
- Source proof uses the private mode-0600 binding, publishes aliases and hashes only, and does not mutate materials.
- Real-rendering proof records direct SVGA backing-store pixels, live Lottie SVG pixels, real VAP WebGL/video, time/frame advancement, pause stability, balanced lifecycle, and `externalRequests=[]`.

## 7. Finding Ledger

| Finding | Implementation state | Independent gate |
|---|---|---|
| `ASV-QA-20260714-002` | Repaired | CR and rebuilt installed QA required |
| `ASV-QA-20260714-003` | Repaired | CR and rebuilt installed QA required |
| `ASV-QA-20260714-004` | Repaired | CR and rebuilt installed QA required |
| `ASV-QA-20260714-005` | Repaired | CR and rebuilt installed QA required |
| `ASV-QA-20260714-006` | Repaired | CR and rebuilt installed QA required |
| `ASV-QA-20260714-007` | Repaired | CR and rebuilt installed QA required |
| `ASV-QA-20260714-008` | Repaired | CR and rebuilt installed QA required |

## 8. Risks And Unsupported Rows

- The task-owned fusion fixture used by the historical VAP replacement proof
  was unavailable in the current private evidence root. VAP fusion
  replacement/reset source behavior and regressions are preserved, but this
  milestone does not claim a new real-runtime fusion replay.
- The source/dev proofs are not installed-app, foreground, Product Owner, or
  release acceptance.
- Full installed Launch/relaunch/Open/drag/cancel/recent and light/dark visual
  conformance remains the next QA gate after independent Code Review and a
  rebuilt candidate.

## 9. Project Retrospective

- Value assessment: High.
- Product lesson: adding formats must extend the owner workflow, not replace the
  current format's workflow with a generic candidate shell.
- Technical lesson: host-owned intake is the only reliable place to preserve
  primary bytes, source identity, and adjacent resource context across picker,
  drag, menu, and file-open routes.
- Evidence lesson: real runtime proof and shell conformance are separate claims;
  both are required before installed QA.
- Avoid next time: do not infer product conformance from renderer playback alone.

## 10. Token Usage

- Source: unavailable.
- Exact token counts: unavailable.
