---
name: auto-svga-ui-stability
description: Auto SVGA 短期 macOS 客户端 UI 稳定性规则。涉及预览页、响应式布局、双预览、按钮降级、汉化、文件信息、空加载错误状态或交互修复时使用；同时加载 auto-svga-core-guard。
---

# Auto SVGA UI Stability

Treat the short-term macOS client UI as the current production-facing tool:
stable, clear, restrained, readable, and maintainable. Use Chinese for primary
UI; keep English only as debug help. Historical Web Preview and Workbench v1
surfaces are not the current UI standard unless the Product Owner explicitly
names them.

## Known Risks

- file details disappear or overflow in narrow dual-preview layouts
- button text becomes vertical at extreme widths
- icon-and-text actions fail to collapse to icon-only
- settings components are visually inconsistent
- two-line copy has cramped leading
- untranslated labels leak into Assets
- Compare control position moves between states
- loading local SVGA leaves an unrelated GIF visible

## Rules

1. Never allow vertical single-character labels.
2. Never push file information outside or behind its card.
3. Hide button labels at narrow widths without removing the action or accessible name.
4. Check single card, dual card, empty, loading, playing, and error states.
5. Keep Compare placement stable.
6. Clear unrelated reference media when loading a local SVGA.
7. Avoid broad refactors for local styling issues.
8. Do not change the core preview flow without explicit scope.
9. Do not let visual polish displace mainline capability work.
10. Before foreground desktop UI validation, check for a second display and use
    it when available. If unavailable, prefer silent or low-disturbance
    operation and record the fallback.
11. Before controlling any foreground app or shared macOS UI resource, follow
    `docs/engineering/DESKTOP_CLIENT_COORDINATION_PROTOCOL.md`. This includes
    Auto SVGA, Finder, Open/Save dialogs, browsers, system prompts, menu bar
    actions, screenshots, and clipboard-changing operations. Verify the app
    path, PID/process identity, window/dialog, display/workspace, and task
    context. Do not assume another worker's foreground app or dialog belongs to
    this task.

Verify normal, narrow, and extreme-narrow widths for every UI change.
