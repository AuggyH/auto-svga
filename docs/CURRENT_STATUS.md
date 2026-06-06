# Current Status

Date: 2026-06-07

## Main Branch

- **Runnable**: yes
- **Latest commit**: (to be recorded after merge)
- **Latest tag**: v0.1.0-avatar-frame-handoff-baseline
- **Branch**: main

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

## Next Steps

- Human visual acceptance of avatar_frame_gold_green_real_002
- Consider phase offset between left/right wing flap
- Consider gem glint/breath glow visual tuning
- Evaluate sweep stride vs quality balance
