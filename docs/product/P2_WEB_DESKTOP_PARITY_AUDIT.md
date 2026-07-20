# P2 Web/Desktop Parity Audit

Date: 2026-06-20
Milestone: P2 — Desktop Product Shell And Web Preview Parity
Baseline commit: `2e9c9bb`

## Summary

The Web preview already has the stronger product system: compact app bar,
brand mark, mode control, card-based player workspace, player-adjacent
controls, quick metadata, structured info panel, and Chinese-first labels.

The P1 Electron shell has the right functional path but still reads as an
engineering prototype: single-column cards, warning text as the first visual
signal, `Internal Baseline` as headline, raw-ish status copy, and inspection
content below the player rather than a desktop inspector.

P2 will adapt the Web visual language and information hierarchy to the desktop
runtime without replacing the Web player or changing browser rollback behavior.

## Region Map

| Web component / region | Web source path | Electron current equivalent | Visual difference | Interaction difference | Data-source difference | Decision | P2 action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Toolbar / brand | `tools/svga-player-preview/index.html`, `.toolbar`, `.brand` | `web/index.html` header | Web has compact brand mark and low-height toolbar; Electron has a large card header and warning eyebrow | Web toolbar keeps actions discoverable; Electron actions are below player | Both static UI | Adapt | Add desktop app bar with `Auto SVGA` primary and low-weight Desktop/Internal badge |
| Mode / status | Web mode dropdown and status pills | Runtime status paragraph | Web uses compact status controls; Electron uses prose status | Web status does not dominate layout | Electron status local runtime only | Adapt | Add compact status pill and keep internal status secondary |
| Primary player card | `.previewCard`, `.stage`, `.mediaFrame` | `section` plus `.dropZone` | Web player sits inside framed workspace; Electron player is inside a generic dashed drop zone | Web supports clear drop state and player controls nearby | Both player-driven | Share visual pattern | Create player workspace panel with drop overlay and centered 300x300 canvas |
| Playback controls | `.playerBar`, icon buttons, progress controls | `.actions` buttons | Web controls are compact and player-adjacent; Electron controls are generic text buttons | Electron lacks keyboard hints and low-weight disabled states | Same player state | Adapt | Add toolbar-like playback control row with Play/Pause/Replay near canvas |
| File metadata | `.quickInfo` | `#fileInfo` | Web metadata is compact and card-like; Electron metadata works but sits too low | Electron shows `--` placeholders in empty state | Electron report-driven | Adapt | Convert to compact metadata strip, hide unknowns behind empty labels |
| Info panel | `.infoPanel`, `.tabs` | `#reportRoot` below player | Web has structured side panel; Electron has long report block | Electron inspection competes with player | Both use `renderAvatarFrameInspectionReport` | Adapt, do not duplicate logic | Place report in right inspector and add local summary groups around existing renderer |
| Spec check | `inspection-report-view.mjs` | same renderer | Shared renderer already exists | Same contract | Shared report contract | Share | Keep shared renderer; add desktop shell around it |
| Motion Asset Audit | `inspection-report-view.mjs` | same renderer | Shared renderer already exists | Same contract | Shared report contract | Share | Keep shared renderer and make it scannable in inspector |
| Calibration | `.calibrationGroup` | shared renderer output | Currently visible in report flow | Same | Same | Adapt | Collapse calibration by default through CSS/details wrapper when in Electron shell |
| Empty state | Center upload state | Drop-zone prose | Web empty state has icon and action; Electron has plain text | Both file input and drag/drop | Local file only | Adapt | Use Web-like empty state copy and icon; support click/drag |
| Invalid state | Web status/error areas | Runtime error paragraph | Electron main text can include raw technical error | Electron clears old player | Local parse/report/player errors | Productize | Main copy: `无法打开此 SVGA 文件`; technical detail collapsed |
| Loading state | Web status pills and empty text | `正在加载本地 SVGA...` | Electron lacks distinct loading panel | Same loading pipeline | Local bytes/report/player | Adapt | Add loading class, busy status, and file name |
| Browser rollback | `tools/launch-local-preview.mjs`, Web server | unchanged | Must remain untouched | Manual/browser workflow | Web host | Preserve | Run Web tests/smoke; do not change Web runtime behavior |

## Web Reference Limits

The Web preview is a validation tool, not a desktop shell. P2 should keep its
visual language and information architecture, but desktop-specific file opening,
keyboard shortcuts, side inspector width, and local-only runtime status may
differ.

## P2 Implementation Constraints

1. Reuse `renderAvatarFrameInspectionReport`.
2. Do not move parsing, audit, or spec logic into the renderer UI.
3. Keep Electron filesystem access in the host boundary.
4. Keep local vendored player assets.
5. Keep browser preview unchanged except for capture-only harness code if
   necessary.
