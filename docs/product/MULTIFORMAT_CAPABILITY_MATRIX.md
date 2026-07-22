# Auto SVGA 0.2 Multi-format Capability Matrix

## Authority And Use

- Product scope authority: `docs/product/PRODUCT_ROADMAP.md`, `0.2.x`
  Multi-format Preview MVP. The current `0.2.0` candidate is
  SVGA/Lottie/VAP; PAG is a separately gated `0.2.x` follow-up.
- Requirement authority: `docs/product/requirements/ASV-REQ-20260709-003.md`.
- UI behavior constraints: `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`, `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`, and `DESIGN.md`.
- Current recovery baseline: main source after PR #4, plus bounded Round 1 repair
  pull requests. Exact candidate identity comes from the merged PR and must be
  rebound before every installed or foreground matrix.
- This file inventories implementation and evidence. It does not expand product scope or replace QA tickets.

Status vocabulary:

- `implemented`: the current source contains the behavior.
- `validated`: current source behavior has direct source/dev test or runtime evidence.
- `installed-QA accepted`: QA accepted the behavior on the exact installed source named in the evidence column.
- `incomplete`: a required behavior or its direct evidence is missing.
- `unsupported`: intentionally outside the current requirement; the UI must hide it or provide truthful typed feedback.

An older installed acceptance may be retained as regression evidence, but it is
not automatically acceptance of the current source. Generic model state,
placeholder rendering, state-only remounts, and hidden fixture-only results do
not satisfy real playback or replacement evidence.

## Capability Matrix

| User flow | SVGA | Lottie JSON | VAP / MP4 | Current evidence boundary |
| --- | --- | --- | --- | --- |
| Picker, drag, menu, and macOS file-open intake | implemented; validated | implemented; validated | implemented; validated | Host-owned normalized intake and native picker repair are present at `7cba862e`; rebuilt installed QA is pending. The rejected `3231f2be` picker result is not acceptance. |
| Format detection and path redaction | implemented; validated | implemented; validated | implemented; validated | Shared registry and host path helpers have source regressions; unsupported inputs remain typed. |
| Ancillary resources | not applicable | implemented; validated for embedded and deterministic adjacent local images | implemented; validated for embedded `vapc`, adjacent sidecar fallback, and sidecar absence | Network resources remain blocked. Current installed same-file parity is pending behind intake QA. |
| Real renderer mount and play/pause | implemented; validated; prior installed-QA accepted | implemented; validated; prior installed-QA accepted | implemented; validated; prior installed-QA accepted | Prior installed owner-material rows were accepted on `32990e90`; current source still requires rebuilt installed regression. Placeholder/model-only states are not accepted evidence. |
| Stage containment and square/wide/tall geometry | implemented; validated | implemented; validated | implemented; validated | Source/dev geometry gates cover renderer bounds and VAP aspect; current installed matrix remains pending. |
| Basic facts, timing, dimensions, and warnings | implemented; validated | implemented; validated | implemented; validated | Capability-specific projection is source-tested. VAP dimensions over `1504` remain playable with one truthful Canvas warning. |
| Asset and element inventory | imageKey/resources implemented; validated | image and text candidates implemented; validated | fusion image/text candidates implemented; validated | Missing and nonreplaceable categories stay explicit instead of manufacturing targets. |
| Image runtime replacement | implemented; validated | implemented; validated | implemented; validated; direct real-runtime pixel evidence retained | Runtime-only. Lottie/VAP source bytes are never saved or exported. |
| Text runtime replacement | not applicable | implemented; validated in focused package foreground regression | implemented; validated in focused package foreground regression and direct real-runtime pixels | Full installed matrix acceptance remains incomplete for both formats. |
| Target-scoped Reset with sibling isolation | implemented through existing SVGA controller | implemented in this successor; validated | implemented in this successor; validated with direct real-runtime pixels | Resetting one image/text target preserves sibling replacements and dirty state; last-target reset restores source. Installed QA remains pending. |
| Replacement authority and stale protection | implemented; validated | implemented; validated | implemented; validated | Active sourceId, public selection identity, canonical runtime key, generation, and returned binding must agree before renderer state changes. |
| Typed malformed, missing-resource, unsupported, and recovery states | implemented; validated | implemented; validated | implemented; validated | Invalid Lottie resources/expressions and malformed VAP config fail without a false playback state. Current installed recovery matrix remains pending. |
| Recent files and reopen | implemented; validated | implemented; validated | implemented; validated | Launch up to five and File > Recent up to ten share host-owned records; clear, redaction, and missing-record recovery are source-tested. Current installed QA is pending. |
| Compare | implemented; validated | unsupported | unsupported | Preserved SVGA `0.1.x` workflow only. |
| Optimization | implemented; validated | unsupported | unsupported | Preserved SVGA safe-output workflow only. |
| Save As / overwrite save | implemented; validated | unsupported | unsupported | Persistent Lottie/VAP editing or save is an explicit non-goal. |
| Export / conversion | SVGA export behavior preserved by the `0.1.x` workflow | unsupported | unsupported | No Lottie/VAP authoring, export, generation, or conversion claim. |
| Formal `0.1.x` isolation | implemented; validated | hidden from formal `0.1.x` | hidden from formal `0.1.x` | The separately versioned formal `0.2` mode owns multi-format surfaces. |
| Offline/local-only runtime | implemented; validated | implemented; validated | implemented; validated | Self-hosted exact dependencies only; external requests are rejected by proof gates. |

## Planned PAG Follow-up

PAG is intentionally not shown as implemented in the current matrix. Before a
PAG candidate can enter QA, it must separately prove:

| User flow | Planned boundary |
| --- | --- |
| Intake and recovery | Local `.pag` open/drag/Recent with path redaction and typed invalid/unsupported feedback. |
| Playback | Pinned local runtime, real pixels, time advance, play/pause/seek/loop, and balanced dispose. |
| Parameter analysis | Dimensions, duration/timebase, file size, resources/layers, editable text/images, runtime/version and unsupported-feature facts. |
| Runtime replacement | Text/image changes appear on the rendered stage immediately; target Reset and sibling isolation are proven. |
| Persistence | Unsupported in the preview milestone; source bytes remain immutable and no rewritten PAG is claimed. |
| Lifecycle | Repeated WASM/WebGL open/replace/reset/close, memory settle, offline runtime, and zero-residue cleanup. |

The later AEB-to-PAG exporter is not inherited from these rows. It requires its
own source/exporter, structural, visual, timing, editability, and rollback
evidence.

## Current Highest-value Gap

Target-scoped replacement isolation and focused runtime text entry are closed
at source/package-regression level. The remaining product gate is integration
and a complete Round 2 matrix on one exact successor candidate. It must start
with native Open, then cover Recent, real playback, replacement/Reset, Compare,
failure recovery, UI/UX, AEB handoff, FBP client rows, source immutability,
network silence, and cleanup without transferring Round 1 acceptance.
GitHub Issue #6 is the sole active execution record for that matrix.

## Protected Boundaries

- No persistent Lottie/VAP/PAG authoring or save in the current preview
  milestone. Planned VAP generation and later PAG export remain separate
  versioned gates.
- No `.lottie`, Windows, AEB intake, CDN, cloud, telemetry, or external AI.
- No production or owner material is committed; durable evidence uses aliases and hashes only.
- No source/dev proof is Product Owner acceptance, support, distribution, or release readiness.
