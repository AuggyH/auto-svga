---
name: verification-budget
description: 控制验证范围、git 检查和测试输出。用于减少无关回归测试、长日志和完整 diff 带来的 token 消耗。
---

# Verification Budget

Validation must be proportional to risk.

## Rules

1. Do not run full regression for documentation-only changes unless explicitly requested.
2. Do not paste full test logs when tests pass.
3. Do not paste full git diff unless requested.
4. Prefer `git diff --stat` over full diff in reports.
5. Prefer targeted tests for small code changes.
6. Run full tests only for parser, exporter, playback, dependency, build config, or cross-cutting architecture changes.
7. If tests fail, include only the failing command, failing test name, key error lines, and suspected cause.
8. If tests are skipped, say why.
9. If a protected path is not touched, say "not touched" instead of running unrelated tests.
10. Always preserve safety for high-risk paths.

## Validation Tiers

### Tier 0 Documentation or Skill-Only Changes

- Required: `git diff --stat`.
- Optional: Markdown lint if available.
- Not required: full build or full regression.
- Report: "runtime code not touched".

### Tier 1 Types or Isolated Contracts

- Required: typecheck if available and targeted tests if available.
- Optional: build.
- Not required: full end-to-end tests.

### Tier 2 Adapter, Parser, Spec Checker, or Recommendation Engine

- Required: targeted unit tests.
- Required: typecheck or build.
- Optional: related integration tests.
- Not required: unrelated UI tests.

### Tier 3 Exporter, Playback, Conversion, Dependency, or Build Config

- Required: targeted tests.
- Required: build.
- Required: relevant regression tests.
- Required: explain protected flows.

### Tier 4 Release-Level or Cross-Cutting Refactor

- Required: full test suite if available.
- Required: full build.
- Required: regression summary.
- Required: rollback notes.

## Report Format

```text
Validation:
- Tier:
- Commands:
- Result:
- Skipped:
- Reason:
- Logs: pass summary only, failure excerpt only
```

## Auto-SVGA Protected Flows

1. Existing SVGA preview.
2. Existing SVGA exporter output bytes.
3. Existing CLI main flow.
4. Existing Web preview page.
5. Existing file import and drag-drop.
6. Existing comparison mode.

Never claim full regression unless it was actually run.
Never include long passing logs.
Never run expensive unrelated tests just to look thorough.
