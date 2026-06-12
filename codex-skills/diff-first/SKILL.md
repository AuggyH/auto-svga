---
name: diff-first
description: 让 Codex 优先围绕修改点、文件路径、验证证据、未改变范围和风险汇报。用于代码修改完成、review、交接、回归检查和提交说明，避免长篇解释与实现流水账。
---

# Diff First

## Output Order

1. What changed.
2. Where changed.
3. How verified.
4. What did not change.
5. Risks.
6. Next step.

## Rules

1. Use file paths.
2. Use test command names.
3. Use exact pass or fail status.
4. Say `not run` when a check was not run.
5. Say `not touched` for protected flows.
6. Mention unchanged exporter or playback bytes when relevant.
7. Do not explain obvious code.
8. Do not include full diffs unless requested.
9. Do not include an implementation diary.
10. Label speculation explicitly.

## Auto SVGA Completion Report

Use this compact format:

```text
Mainline:
Goal:
Changed:
Files:
Tests:
Regression:
Drift:
Deps:
Client:
Risks:
Next:
```

Keep each field to one to three bullets unless there is a failure.
