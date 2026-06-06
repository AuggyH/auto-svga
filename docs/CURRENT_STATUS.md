# Current Status

Date: 2026-06-07

## Main Branch

- **Runnable**: yes at the handoff baseline
- **Latest implementation commit**: `429cfa3`
- **Latest tag**: v0.1.0-avatar-frame-handoff-baseline
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
- Review and merge the Web preview rebuild branch after human UI approval
- Human visual acceptance of avatar_frame_gold_green_real_002 remains required
