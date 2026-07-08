---
name: auto-svga-client-ready
description: Auto SVGA 桌面客户端准备规则。涉及模块、依赖、播放器、转换器、导出器、规范检测器、文件系统、缓存、日志、跨平台路径或离线分发时使用；同时加载 auto-svga-core-guard。
---

# Auto SVGA Client Ready

Target Auto SVGA `0.1.x` / SVGA Preview MVP on macOS first. The current
owner-used baseline is Auto SVGA `0.1.0-alpha` in the `local` channel at
`/Users/huangtengxin/Applications/Auto SVGA.app`.

Windows clients and standalone Web Preview are not current-stage readiness
targets unless the Product Owner explicitly requests them. Historical Web
Preview and Workbench v1 surfaces are lineage or supplemental evidence only.

## Evaluate Every Relevant Change

- macOS client compatibility
- Windows compatibility only when the task explicitly targets Windows
- cross-platform paths and file permissions
- offline operation
- system and native dependencies
- installer and bundle size
- cache and temporary-file cleanup
- logs and diagnostics
- configuration migration
- licenses and redistribution
- external AI network, privacy, usage-cost, and data-retention risks

## Design Rules

1. Keep core logic out of UI components.
2. Do not hardcode one operating system's paths.
3. Do not require user-installed tools unless clearly experimental.
4. Keep format parsing, specification checks, recommendations, and export flows independent.
5. Avoid tight coupling between players, converters, and checkers.
6. Isolate host-specific filesystem, process, network, and rendering APIs.

## Foreground Desktop Debugging

1. Prefer non-foreground validation when it is enough: tests, passive logs,
   package metadata, smoke artifacts, or headless/browser automation.
2. Before any foreground app launch, automation, screenshot, file dialog,
   Finder operation, After Effects operation, browser operation, system prompt,
   or clipboard-changing step, check whether another worker appears to hold
   foreground input.
3. Follow `docs/engineering/DESKTOP_CLIENT_COORDINATION_PROTOCOL.md` for
   global foreground input leases, shared macOS UI resources, instance
   identity, and owner local stable replacement.
4. Do not assume the frontmost client, Finder window, AE window, browser,
   system dialog, or Open/Save panel belongs to this task unless the app path,
   PID/process identity, window/dialog, display/workspace, and task context
   match.
5. Before any foreground desktop-client launch, automation, or screenshot,
   check whether a second or non-primary display is available.
6. If a second display is available, put the app there before foreground
   interaction so the Product Owner's main display is not interrupted. Active
   keyboard/mouse/menu/dialog/clipboard control still remains serialized.
7. If no second display is available, prefer silent or low-disturbance startup:
   background/headless, minimized, hidden, non-activating, or the shortest
   possible foreground session.
8. Multiple visible apps or clients may coexist only when each instance is
   clearly identified. Only one process may actively drive foreground input at
   a time.
9. Record the foreground strategy and shared-resource scopes in the review or
   handoff when foreground evidence is used.

## Owner Local Stable Baseline

Before promoting or replacing `/Users/huangtengxin/Applications/Auto SVGA.app`,
verify the candidate package is current-head bound and does not drop behavior
already present in the installed owner-used app. If installed behavior is not
represented in source, product docs, review notes, package manifest, or
promotion evidence, stop and route baseline drift to Product Manager / Release.

## AI and External Model Constraints

1. Keep normal desktop workflows fully usable offline without AI accounts,
   API keys, usage billing, or external inference services.
2. Do not upload local assets, animations, video, logs, or diagnostics to an AI
   provider without explicit user approval and a documented data flow.
3. Treat AI SDKs, model runtimes, native inference libraries, and model weights
   as distribution dependencies requiring license, installer-size, update,
   signing, sandbox, and macOS/Windows compatibility review.
4. Keep any approved generative AI module isolated behind a host boundary so
   parsing, validation, playback, conversion, export, and reporting remain
   deterministic and available without it.
5. Before proposing AI, document recurring cost, request frequency, retention
   policy, offline degradation, local alternatives, and removal strategy.

## Completion Assessment

State:

- effect on macOS and Windows packaging
- whether the task used owner local stable, candidate, or supplemental
  narrowing evidence
- foreground lease / shared-resource scope / instance identity strategy when
  foreground work occurred
- Finder, Open/Save dialog, After Effects, browser, system UI, display, or
  clipboard effects when relevant
- baseline-drift result when replacing owner local stable
- new system dependencies
- path or permission risks
- offline readiness
- bundle-size effect
- license or redistribution risk
- ease of migration into a desktop host
- AI data flow, privacy, cost, offline impact, and fallback when applicable
