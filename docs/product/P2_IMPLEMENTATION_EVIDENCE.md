# P2 Implementation Evidence

Date: 2026-06-20

## Scope

P2 turns the accepted P1 Electron internal functional baseline into a desktop
product shell that visibly belongs to the same Auto SVGA product system as the
existing Web preview.

This milestone does not add editing, exporting, conversion, installers, signing,
auto-update, new formats, or production desktop release approval.

## Implemented

1. Desktop product identity now uses `Auto SVGA` as the primary title.
2. Internal prototype status is kept as supporting context: internal prototype,
   non-production, internal testing only.
3. Electron desktop shell now has:
   - app header
   - player workspace
   - play / pause / replay controls
   - compact file metadata
   - read-only inspection report pane
4. Inspection and Motion Asset Audit rendering still reuse the existing shared
   inspection report renderer.
5. Invalid file state uses product copy first and keeps technical details in a
   collapsible area.
6. Keyboard shortcuts were added without expanding preload or filesystem
   permissions:
   - Cmd/Ctrl+O: choose file
   - Space: play/pause
   - R: replay
7. P2 artifact capture now records source, mode, viewport, hashes, and HEAD
   binding in `.artifacts/product/P2/artifact-index.json`.
8. P2 can generate:
   - desktop smoke screenshots
   - actual normal runtime proof
   - Web reference screenshots from the real Web preview
   - Web/Desktop comparison images
   - Web/Desktop parity report

## Preserved

1. Browser Web preview remains the rollback workflow.
2. Existing SVGA exporter bytes are not touched.
3. CLI default flow is not touched.
4. Browser import, drag/drop, and comparison behavior are not touched.
5. Electron security baseline remains:
   - `contextIsolation: true`
   - `nodeIntegration: false`
   - `sandbox: true`
   - no CDN
   - local vendored player assets
   - no renderer filesystem bridge

## Evidence Commands

1. `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
2. `npm run desktop:smoke`
3. `npm run desktop:p2:normal-proof`
4. `npm run desktop:p2:web-reference`
5. `npm run desktop:p2:parity-report`

Final artifact regeneration must happen after the implementation commit so the
artifact index is bound to the final P2 HEAD.
