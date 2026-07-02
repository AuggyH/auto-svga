# 2026-07-03 Codex Short-Term macOS UI Refactor

## Summary

Implemented the first macOS-only short-term client surface for Auto SVGA. The default Electron product page now uses a short-term macOS UI instead of the legacy Workbench shell, while the old Workbench page remains isolated at `web/workbench.html` for lineage/testing only.

## Scope

- Replaced default Electron renderer with a short-term macOS client focused on open, preview, compare, optimize, replaceable elements, imageKey rename, runtime text preview, save, recent files, and macOS menu routing.
- Kept Web Preview and Windows packaging untouched.
- Added short-term server endpoints for inspection model, optimization workflow, imageKey rename, and image replacement workflow.
- Added host bridge methods for recent files, clipboard text write, and validated overwrite/save-as output.
- Moved replaceable row operations to selection plus context menu/macOS menu; ordinary resource rows remain browse-only.
- Added dirty-output confirmation for new open, recent open, drag-drop, close, optimization, rename, and replacement operations.
- Tightened automatic imageKey filtering so pure numeric keys do not appear as replaceable elements.
- Removed development-only reload/DevTools items from the short-term macOS menu and added a guard so they do not reappear on the designer-facing client surface.

## Verification

- `node --check` for Electron main/preload/host contract/server/short-term renderer: pass.
- `npm run build`: pass.
- `node --test dist/tests/short-term-product-model.test.js dist/tests/short-term-image-replacement-workflow.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-save-execution.test.js dist/tests/short-term-prd-trace.test.js`: 74/74 pass.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`: 28/28 pass.
- `node --test tools/shared/product-frontend/source-sharing.test.mjs`: 7/7 pass.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`: pass.
- Short-term macOS menu guard: pass; the legacy Workbench menu remains isolated, while the default short-term menu has no reload or DevTools item.
- Real-material scan: 84/84 SVGA files opened through the short-term inspection model; pure numeric replaceable noise count is 0 after filtering.
- System Chrome UI probe: launch, preview, optimization tab, replaceable tab, edit mode, context menu, and 980x680 minimum viewport have no document overflow.
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`: pass; unsigned internal App ZIP generated with clean App ZIP entries and Info.plist security proof.

## Artifacts

- Internal App ZIP: `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/Auto SVGA-darwin-arm64.zip`
- App ZIP SHA-256: `b4a98a397b7d0b53d333e65f55964d0b922d4e26d5b5f9e9429df8c131f5e37c`
- App ZIP size: `118494400` bytes
- UI probe screenshots: `tools/electron-prototype/experiments/svga-web/.artifacts/short-term-ui-probe/`

## Risks

- App ZIP is unsigned and not notarized; this remains an external credential/signing decision.
- Runtime text preview is preview-only and does not persist into SVGA bytes, matching current short-term boundary.
- Follow-up guard: runtime text controls are disabled when the current model exposes no text elements, so the UI does not imply editable text targets that the parser did not find.
- The package manifest records current Git HEAD, while the package content was built from the working tree before this review commit.

## Git Notes

Unrelated product-documentation files were already dirty and are intentionally not part of this review.
