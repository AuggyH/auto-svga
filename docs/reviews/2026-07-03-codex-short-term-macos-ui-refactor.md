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
- Localized short-term image replacement PNG validation failures into designer-facing Chinese guidance while keeping replacement output fail-closed.
- Split operation failures from file-open failures: optimization, imageKey rename, and image replacement failures now stay on the current file surface and show a recoverable "source file unchanged" prompt instead of switching to the Load Failed page.
- Expanded the macOS Help menu state-copy action so copied text includes current app state, file name, save prompt, and visible error text instead of only the file name.
- Removed the unused hidden compare file input; the short-term macOS compare flow now has one real B-file entry through the host file picker.
- Replaced the old imageKey rename dialog with an inline resource-row rename state, including Enter confirm and Esc cancel behavior required by the short-term IA.
- Made runtime text preview modal keyboard behavior explicit: Enter applies and Esc cancels without relying on button order.

## Verification

- `node --check` for Electron main/preload/host contract/server/short-term renderer: pass.
- `npm run build`: pass.
- `node --test dist/tests/short-term-product-model.test.js dist/tests/short-term-image-replacement-workflow.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-save-execution.test.js dist/tests/short-term-prd-trace.test.js`: 74/74 pass.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`: 28/28 pass.
- `node --test tools/shared/product-frontend/source-sharing.test.mjs`: 7/7 pass.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`: pass.
- Short-term macOS menu guard: pass; the legacy Workbench menu remains isolated, while the default short-term menu has no reload or DevTools item.
- Short-term image replacement failure-copy guard: pass; invalid/corrupt PNG diagnostics stay Chinese and do not expose the old English decoder copy.
- Short-term operation-failure guard: pass; optimization, rename, and replacement catches use recoverable operation prompts rather than the open-file failure page.
- Short-term state-copy guard: pass; Help menu state summary copies visible error/save context.
- Short-term inline rename guard: pass; default page has no rename dialog, and the renderer exposes inline confirm/cancel plus Enter/Esc handling.
- Short-term text modal keyboard guard: pass; runtime text input closes the modal with explicit confirm/cancel on Enter/Esc.
- Real-material scan: 84/84 SVGA files opened through the short-term inspection model; pure numeric replaceable noise count is 0 after filtering.
- System Chrome UI probe: launch, preview, optimization tab, replaceable tab, edit mode, context menu, and 980x680 minimum viewport have no document overflow.
- Package command checkpoint: `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac` passes with clean App ZIP entries and Info.plist security proof. Treat `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/internal-trial-manifest.json` as the authoritative package SHA/build-commit record after the command is rerun on the final source commit.

## Artifacts

- Internal App ZIP path: `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/Auto SVGA-darwin-arm64.zip`
- Package manifest: `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/internal-trial-manifest.json`
- UI probe screenshots: `tools/electron-prototype/experiments/svga-web/.artifacts/short-term-ui-probe/`

## Risks

- App ZIP is unsigned and not notarized; this remains an external credential/signing decision.
- Runtime text preview is preview-only and does not persist into SVGA bytes, matching current short-term boundary.
- Follow-up guard: runtime text controls are disabled when the current model exposes no text elements, so the UI does not imply editable text targets that the parser did not find.
- The package manifest records current Git HEAD, while the package content was built from the working tree before this review commit.

## Git Notes

Unrelated product-documentation files were already dirty and are intentionally not part of this review.
