---
name: auto-svga-client-ready
description: Auto SVGA 桌面客户端准备规则。涉及模块、依赖、播放器、转换器、导出器、规范检测器、文件系统、缓存、日志、跨平台路径或离线分发时使用；同时加载 auto-svga-core-guard。
---

# Auto SVGA Client Ready

Target a distributable macOS and Windows desktop client evolved from the local
service and Web preview page.

## Evaluate Every Relevant Change

- macOS and Windows compatibility
- cross-platform paths and file permissions
- offline operation
- system and native dependencies
- installer and bundle size
- cache and temporary-file cleanup
- logs and diagnostics
- configuration migration
- licenses and redistribution

## Design Rules

1. Keep core logic out of UI components.
2. Do not hardcode one operating system's paths.
3. Do not require user-installed tools unless clearly experimental.
4. Keep format parsing, specification checks, recommendations, and export flows independent.
5. Avoid tight coupling between players, converters, and checkers.
6. Isolate host-specific filesystem, process, network, and rendering APIs.

## Completion Assessment

State:

- effect on macOS and Windows packaging
- new system dependencies
- path or permission risks
- offline readiness
- bundle-size effect
- license or redistribution risk
- ease of migration into a desktop host
