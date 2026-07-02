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
- Bound the short-term macOS menu to the renderer's current product state, so Close, Compare, Save, Resource, Playback, mode, tab, and Optimization entries enable/disable or check themselves from the same state as the visible controls.
- Added a menu-state smoke proof for the loaded short-term app; the proof fails if the menu remains in an empty/default state after a file is loaded or if key menu items drift from renderer state.
- Added repeatable short-term smoke screenshots for Launch, Preview Overview, Optimization, Replaceable Elements, General Compare, Edit Reserved, and minimum-size Preview states.
- Fixed disabled primary-button styling so unavailable Save As and Run Optimization actions no longer look like active blue primary actions.
- Made Edit Reserved mount a visible playback preview instead of a blank canvas while still keeping the right operation panel empty.
- Rebound the normal App proof driver from legacy Workbench selectors to the short-term macOS client: it now opens the fixture through the macOS `File > Open SVGA...` menu item, waits for the Preview canvas, Overview facts, and asset list, verifies redacted recent-file state, and captures the normal loaded screenshot from the new UI.
- Added normal-path recent-file recovery proof: the proof injects a missing recent SVGA record, opens it through the renderer recent-file action, requires visible missing/inaccessible feedback, verifies stale-record removal, then reopens a valid SVGA and returns to Preview.
- Expanded S16 recent-file proof: normal proof now records menu ten-row limit, Launch five-row limit, renderer path redaction, missing-file recovery, clear-history behavior, and reopening after clear-history.
- Added S14 normal-path save proof: the normal App proof now requires initial Save disabled state, generated output Save As, verified write/hash/reopen, generated second output Overwrite Save, verified write/hash/reopen, output cleanup after each save, and unchanged canonical source bytes. The proof uses a hidden automation output generator only when the canonical fixture has no designer-named replaceable row; no new visible product action is added.
- Hardened Save failed behavior: saved output bytes are now re-inspected before becoming the current source bytes, so a post-write reopen failure keeps the prior file state and dirty output instead of switching the app to invalid bytes.
- Added short-term failure-state smoke captures for `short-term-save-failed.png` and `short-term-load-failed.png`; smoke now reports `shortTermSaveFailed=true` and `shortTermLoadFailed=true` before recovering to Preview for menu-state validation.
- Added short-term empty-state proof for `No audio`, `No replaceable images`, and unavailable runtime text. The smoke proof records visible copy, row counts, and verifies ordinary image assets are not duplicated into the Replaceable Elements list.
- Added an S13 runtime-text boundary proof. The current SVGA parser/product model exposes no product-safe `textKey` discovery path, so smoke now proves the text edit attempt fails closed, leaves source bytes unchanged, opens no fake modal, and does not claim S13 product completion.
- Added an S5/S6/S15 thumbnail proof. Smoke now opens the sequence fixture, captures the sequence-thumbnail state, and records ordinary image thumbnails, sequence four-grid thumbnails, and the no-audio state in one fail-closed artifact.

## Verification

- `node --check` for Electron main/preload/host contract/server/short-term renderer: pass.
- `npm run build`: pass.
- `node --test dist/tests/short-term-product-model.test.js dist/tests/short-term-image-replacement-workflow.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-save-execution.test.js dist/tests/short-term-prd-trace.test.js`: 74/74 pass.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`: 28/28 pass.
- `node --test tools/shared/product-frontend/source-sharing.test.mjs`: 7/7 pass.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`: pass; includes `shortTermScreenshots=true`, `shortTermSaveFailed=true`, `shortTermLoadFailed=true`, `shortTermNoAudio=true`, `shortTermNoReplaceable=true`, and `shortTermTextUnavailable=true`.
- Short-term menu-state proof: pass; `shortTermMenuState=true` in desktop smoke and `.artifacts/product/short-term/short-term-menu-state-proof.json` records loaded Preview state plus matching menu enabled/checked states.
- Short-term screenshot proof: pass; `shortTermScreenshots=true` in desktop smoke and `.artifacts/product/short-term/artifact-index.json` lists ten current-head short-term UI screenshots, including sequence thumbnails, Save failed, and Load failed states.
- Short-term empty-state proof: pass; `.artifacts/product/short-term/short-term-empty-state-proof.json` records `noAudioVisible=true`, `noReplaceableImagesVisible=true`, `textUnavailableVisible=true`, and `ordinaryImagesNotDuplicatedInReplaceables=true`.
- Short-term runtime-text boundary proof: pass; `.artifacts/product/short-term/short-term-runtime-text-boundary-proof.json` records `productCompleteClaimed=false`, source SHA unchanged, no modal opened, and no runtime overlay shown when no parser-discovered text keys exist.
- Short-term thumbnail proof: pass; `.artifacts/product/short-term/short-term-thumbnail-proof.json` records ordinary image thumbnail visibility, sequence four-grid visibility, and no-audio visibility, with `short-term-sequence-thumbnails.png` captured in the artifact index.
- Normal App proof: pass; `AUTO_SVGA_DESKTOP_NORMAL_PROOF` reports `hostOpen=true`, `menuOpen=true`, `playback=true`, `canvasNonBlank=true`, `inspectionReport=true`, `auditPanel=true`, `recentFiles=true`, `recentMissingRecovery=true`, `shortTermSave=true`, `localOnly=true`, and `noCspViolation=true` against the short-term macOS client.
- Short-term recent proof: pass; `.artifacts/product/short-term/short-term-recent-proof.json` records menu count 10, Launch count 5, path redaction, missing-file recovery, clear-history completion, and reopen after clear.
- Short-term save proof: pass; `.artifacts/product/short-term/short-term-save-proof.json` records disabled initial Save, Save As write/hash/reopen, Overwrite write/hash/reopen, output cleanup after both saves, changed output hashes, and canonical source immutability.
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
- S13 is not product-complete until a product-safe textKey discovery source is implemented. The current guard proves failure-closed behavior for real files with no exposed text elements.
- The package manifest records current Git HEAD, while the package content was built from the working tree before this review commit.

## Git Notes

Unrelated product-documentation files were already dirty and are intentionally not part of this review.
