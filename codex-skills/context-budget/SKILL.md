---
name: context-budget
description: 控制 Codex 读取、复述和携带的上下文。用于代码库探索、接手项目、排查问题或实现任务时减少无关文件扫描、长摘要、重复背景和生成文件读取。
---

# Context Budget

Use minimal context.

## Before Reading Many Files

1. Identify the target module.
2. Read the index or config first.
3. Search precise symbols.
4. Open only directly relevant files.
5. Stop once enough evidence exists.

## Never

1. Dump repository-wide summaries.
2. Repeat full project goals.
3. Copy long unchanged code.
4. Summarize unrelated modules.
5. Read generated files unless needed.
6. Read `dist`, build, or cache output unless debugging build output.
7. Include unrelated TODOs.

## Reporting

1. Mention only files actually used.
2. State why each file mattered.
3. Separate files read from files changed.
4. Put unrelated findings under `Deferred`, with at most three items.
5. Do not expand deferred items unless asked.

## Auto SVGA

1. Load only project-specific skills needed for the current task.
2. Always load the core guard.
3. Load a format skill only for format work.
4. Load a spec skill only for validation or specification work.
5. Load a UI skill only for preview or UI work.
6. Load a client skill only for module, dependency, filesystem, export, or cross-platform work.
