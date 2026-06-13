---
name: auto-svga-core-guard
description: Auto SVGA 每次任务必用的主线守卫。用于任务开始、实现、review、交接和完成报告，锁定多格式动效工作台目标、P0-P8 优先级、修改边界、防偏航规则与验证要求。
---

# Auto SVGA Core Guard

## Product Goal

Build a multi-format motion workbench for playback, preview, comparison,
replaceable-element editing, specification checks, format recommendations,
conversion, export, and desktop-client preparation.

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
2. Core goal served.
3. Why the task is worth doing now.
4. Effect on current SVGA preview.
5. Allowed changes.
6. Protected or prohibited changes.
7. Explicit non-goals.
8. Verification plan.
9. Rollback plan.

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
10. Drift check.
11. Dependencies and licenses.
12. Client-readiness assessment.
13. Risks and gaps.
14. One next mainline task.
