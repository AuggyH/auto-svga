# Current Status

Date: 2026-06-07

## Main Branch

- **Runnable**: yes after Web preview layout polish
- **Latest implementation commit**: `49d6795`
- **Latest tag**: v0.1.4-web-preview-rebuild
- **Branch**: main

## Web Preview Rebuild

The current branch rebuilds the Web preview from
`v0.1.0-avatar-frame-handoff-baseline`; it does not continue the failed Round
6/7 layout patches.

Preserved:
- Git handoff/review workflow and runtime artifact ignore rules
- avatar_frame 300x300 production pipeline and real SVGA output
- local drag/drop, comparison modes, report/resource inspection, and real player validation

Discarded or rewritten:
- 15vw information/log panel widths
- hidden-overflow layouts that made wrapped content unreachable
- split mode/fit menu implementations
- latest-artifact selection that allowed a newer GIF-only group to displace a valid SVGA group
- reference success masking primary SVGA failure

Status:
- **Done**: grouped latest-artifact API, SVGA-first same-group loading, manual-selection protection, rescan feedback, readable/resizable panels, narrow-width overlay fallback, unified playback rendering, unified dropdown structure, settings regrouping, reduced-motion support
- **Partial**: keyboard menu automation and WCAG AAA target
- **Not verified**: axe zero violations, complete 1600/1440/1280/1024/900/768 screenshot matrix

## Web Preview Layout Polish

Current branch: `agent/codex/web-preview-layout-polish`

- Fixed comparison layouts to remain horizontal and page-level scrolling to remain disabled.
- Replaced independent information/log booleans with one mutually exclusive side-panel state.
- Uses overlay side panels so opening diagnostics does not collapse the preview cards.
- Removed SVGA player rebuilds from fit-mode and window-resize handlers to keep playback stable while inspecting assets.
- Made original size the first-run default, with independent per-card persistence and safe container constraints.
- Moved artifact rescan into Export Review and automatic latest-artifact loading into Playback & Acceptance settings.
- Added log action feedback, target-aware theme icons, compact asset rows, and compact asset filters.
- Browser verified at the available 499×771 narrow viewport; the requested explicit desktop-width screenshot matrix remains not fully verified in this environment.

## Last Completed

Codex implemented a batch of avatar frame improvements including:
- 300×300 default production canvas, 600→300 source scaling
- Transparent pixel trimming + image optimization
- Baked sweep mask system with safeArea exclusion + per-frame bbox cropping
- Unified easing/interpolation (PreviewRenderer + SVGAExporter share code)
- Wing flap amplitude increased to ±7.5° (15° peak-to-peak)
- Web preview: drag-drop, Chinese-first UI, compare button stability, asset panel improvements
- Full pipeline verified: plan → preview → export → package all pass, 28 tests pass

Hermes handoff (2026-06-07):
- Reviewed all Codex uncommitted changes
- Ran full build + test + pipeline verification
- Established git collaboration rules, review process, agent handoff docs
- Created baseline commit + tag

## Scope

avatar_frame MVP only. No other asset types.

## Known Issues

- `duplicateOverlayRisk: true` — base_frame_full may overlap with local part layers; needs human visual confirmation
- No automated visual playback verification — manual review required
- Sweep frame 000 shows white edge artifact on non-transparent background
- Full accessibility certification remains Partial; no axe-zero claim
- Browser automation verified the narrow 499px fallback and live artifacts, but the complete desktop viewport matrix still needs a dedicated pass

## Next Steps

- Complete axe and explicit desktop viewport matrix checks
- Human review of the polished one-screen comparison layout
- Human visual acceptance of avatar_frame_gold_green_real_002 remains required
