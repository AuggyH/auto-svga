---
name: auto-svga-core-guard
description: Auto SVGA 每次任务必用的主线守卫。用于任务开始、实现、review、交接和完成报告，锁定多格式动效工作台目标、P0-P8 优先级、修改边界、防偏航规则与验证要求。
---

# Auto SVGA Core Guard

## Product Goal

Build a multi-format motion workbench for playback, preview, comparison,
replaceable-element editing, specification checks, format recommendations,
conversion, export, and desktop-client preparation.

The workbench is not a small After Effects and does not replace designer
judgment. Prioritize export acceptance, deterministic diagnostics, and bounded
reversible post-export refinement over full motion authoring.

The active owner-visible baseline is the short-term macOS client at
`/Users/huangtengxin/Applications/Auto SVGA.app`. Historical Workbench v1,
Web Preview, dev Electron windows, `.artifacts` packages, and Windows clients
are not current-stage standards unless the Product Owner explicitly names them.

## Priority

- P0: Keep the current tool runnable.
- P1: Mainline infrastructure.
- P2: Design specification checks.
- P3: Multi-format playback and comparison.
- P4: Replaceable-element editing.
- P5: Conversion and export.
- P6: Format recommendation engine.
- P7: Desktop-client preparation.
- P8: Non-blocking UX polish. Never let P8 displace P0-P7.

## Guardrails

1. Assign every task to P0-P7. Treat P8 as secondary.
2. Do not add pure visual polish, accounts, cloud sync, collaboration,
   unrelated file management, or low-value broad refactors unless requested.
3. Do not break current SVGA preview, export, or validation.
4. Keep scope tied to one verifiable task.
5. Preserve truthful support boundaries. Never claim unverified playback,
   conversion, export, or visual success.
6. Classify editing proposals as export acceptance, post-export refinement, or
   full motion authoring. MVP work may prioritize only the first two.
7. Treat complete timelines, complex keyframe curves, full particle editors,
   and broad source-project authoring as long-term work requiring a separate
   product decision.
8. Prefer result files from Figma, PSD, After Effects, C4D, Blender, and
   AI-assisted workflows. Do not add direct source-project ingestion without a
   separate scope decision.
9. Before foreground desktop work, follow
   `docs/engineering/DESKTOP_CLIENT_COORDINATION_PROTOCOL.md`. This covers
   Auto SVGA, Finder, Open/Save dialogs, After Effects, browsers, system UI,
   menu bar actions, screenshots, and clipboard-changing operations. Never
   assume a frontmost app or dialog belongs to the current process without
   matching app path, PID/process identity, window/dialog, display/workspace,
   and task context.
10. Before replacing the owner local stable app, check for baseline drift and
    do not drop owner-visible behavior that exists in the installed app but is
    absent from source, product docs, review notes, or promotion evidence.

## Product Authority Check

Before implementation, classify whether the task affects product scope,
feature behavior, UI, release planning, acceptance evidence, or product docs.

If it does, read `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md` and
`docs/product/PRODUCT_ROADMAP.md` before proposing or editing. Treat
`docs/product/PRODUCT_ROADMAP.md` as the single project-level PRD authority.
Stage-specific PRDs, milestone contracts, review packets, roadmap snapshots,
or status documents may refine execution, but they must not override the main
PRD.

If a request conflicts with the main PRD, is absent from the relevant horizon,
or would revive hidden/deferred scope, stop and ask the Product Owner before
implementation. Do not silently choose between conflicting sources.

Do not create a new PRD, product plan, or scope document until repository search
proves there is no suitable existing document. Prefer updating the authoritative
or closest existing document, and add cross-references instead of duplicating
requirements.

After a Product Owner feature request, optimization request, interaction change,
or production-workflow improvement has been evaluated, confirmed, and promoted
into the PRD or a subordinate product brief, do not let it stop at
documentation. Create or route an `ASV-REQ-YYYYMMDD-###` requirement ticket
under `docs/product/requirements/` to one accountable implementation owner,
then require implementation-ready handoff to QA. Use `ASV-QA` tickets for
defects, regressions, acceptance failures, or QA findings linked back to the
requirement, not as the primary product-delivery ticket.

## Inspection Primitives First

Build reusable parsing, normalized metadata, resource facts, spec profiles,
role-aware policies, decoded memory estimates, diagnostics, and report
contracts before higher-level audit, recommendation, optimization, preflight,
batch, cleanup, or comparison features.

Compose higher-level features from deterministic local metadata and rules.
Do not duplicate inspection or recommendation logic in one-off UI components.

## AI Capability Boundary

Keep the core pipeline and routine capabilities local, deterministic, and
explainable. Prefer technical algorithms, platform APIs, and approved
open-source libraries for:

1. Format recognition and parsing.
2. Playback and preview.
3. Replaceable-element editing.
4. Design specification checks.
5. File-size analysis.
6. Decode and memory performance assessment.
7. Resource-dimension and transparent-padding checks.
8. Frame-sequence consistency checks.
9. Format conversion and export.
10. Report generation.
11. Desktop packaging.
12. Logs and error diagnostics.

Do not add external AI APIs, large language models, multimodal or vision
models, or network-dependent AI services unless the user explicitly plans and
approves an isolated generative module such as text-to-image, image-to-image,
image-to-video, or another clearly generative capability.

Never:

1. Add an external AI API without approval.
2. Add a large language, multimodal, vision, or other model without approval.
3. Replace deterministic parsing, dimensions, alpha, performance, or
   specification checks with AI inference.
4. Make a core capability depend on a network AI service.
5. Upload user assets, SVGA, images, video, logs, or local files to an external
   AI service without explicit approval.
6. Add opaque AI judgment only to implement a check faster.
7. Use AI output as the only production gate.

If AI appears necessary, stop implementation and report:

1. Why a technical solution is insufficient.
2. The exact function using AI.
3. Whether network access is required.
4. Whether user files or assets are uploaded.
5. Data flow and privacy risks.
6. Cost and expected call frequency.
7. Offline-availability impact.
8. macOS and Windows client impact.
9. Local or open-source alternatives.
10. Recommended and rejected options.

Proceed only after explicit user confirmation.

## Start Report

Before implementation, state:

1. Mainline and priority.
2. Product authority check: consulted PRD section, alignment, drift risk, or
   why the task is not product-affecting.
3. Core goal served.
4. Why the task is worth doing now.
5. Effect on current SVGA preview.
6. Allowed changes.
7. Protected or prohibited changes.
8. Explicit non-goals.
9. Verification plan.
10. Rollback plan.

## Completion Report

Report:

1. Mainline.
2. Goal.
3. Change summary.
4. Changed files.
5. New capability.
6. Non-goals retained.
7. Self-check scope.
8. Validation result.
9. Regression check.
10. Product authority and drift check.
11. Dependencies and licenses.
12. Client-readiness assessment.
13. Risks and gaps.
14. One next mainline task.
