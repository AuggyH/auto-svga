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
