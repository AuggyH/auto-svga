# P1 Existing Capability Audit

Milestone: P1 - Electron Desktop Mainline Baseline: Local SVGA Open, Playback And Inspection

Audit date: 2026-06-20

## Summary

The repository already has an isolated Electron prototype based on `svga-web@2.4.4`, local vendored player assets, a loopback inspection host, and smoke tests. Before P1, it was still shaped as a spike page: it auto-loaded a synthetic fixture and did not expose a product-like empty state, playback controls, root desktop entrypoint, or P1 visual review artifacts.

## Capability Matrix

| Capability | Current Status Before P1 Implementation | Existing Path | Gap | P1 Action |
| --- | --- | --- | --- | --- |
| Electron shell | Exists as isolated prototype, not root product entry | `tools/electron-prototype/experiments/svga-web/` | No root `desktop:dev` command | Add explicit root desktop script without changing default scripts |
| Local-only runtime | Exists | `server.mjs`, vendored `svga-web-2.4.4.js` | Needs P1 confirmation | Keep local server and no CDN policy |
| Secure Electron boundary | Exists | `main.cjs`, `preload.cjs` | Needs P1 static coverage | Preserve `contextIsolation`, `nodeIntegration=false`, `sandbox=true`, blocked navigation/new windows |
| File picker import | Partial | `web/index.html`, `web/prototype.js` | Browser file input exists; ordinary launch still auto-smoked fixture | Keep local file input and make normal launch empty-state first |
| Drag-and-drop import | Partial | `web/prototype.js` | Exists but needs product state and error handling | Preserve drop flow and add user-facing state updates |
| SVGA playback | Exists | `svga-web@2.4.4` vendor | Synthetic smoke only | Reuse playback path for normal user-loaded files |
| Playback controls | Missing | N/A | No play / pause / replay controls | Add minimal controls |
| File information | Partial | inspection report | No compact loaded-file summary | Add filename, size, canvas, fps, frames summary |
| Inspection report | Exists | `/api/avatar-frame-inspection-report`, `inspection-report-view.mjs` | Needs product empty/error handling | Keep same report service and renderer |
| Motion Asset Audit panel | Exists | report presentation renderer | Needs product baseline confirmation | Keep read-only panel |
| Invalid-file state | Partial | extension check in drop smoke | Corrupt `.svga` not clearly surfaced | Add safe parse/report error state |
| Reopen and cleanup | Partial | `cleanupPlayer()` | Not explicitly validated for product use | Keep destroy path and extend smoke checks |
| P1 visual artifacts | Missing | N/A | No screenshot packet | Add `.artifacts/product/P1` screenshot index in product smoke |
| Browser rollback | Exists | `npm run local:preview` | Must remain unchanged | Do not alter browser workflow |

## Protected Flows

- SVGA exporter: not touched for P1.
- Main Web preview player: not touched for P1.
- CLI default flow: not touched for P1.
- Browser import, drag-drop, comparison: not touched for P1.
- Agent Loop infrastructure: frozen after M2-R3; P1 only updates milestone state and handoff output.

## P1 Implementation Boundary

P1 should make the isolated Electron candidate usable as a local internal baseline without turning it into a production desktop client. It may add explicit desktop scripts, product-state UI, smoke artifacts, and documentation. It must not ship an installer, add auto-update, replace the browser preview player, or claim production desktop approval.
