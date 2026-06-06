# Changelog

## 2026-06-07 — Web preview layout and interaction polish

**Branch**: `agent/codex/web-preview-layout-polish`
**Implementation commit**: `49d6795`
**Merge commit**: `3928e4a`

- Locked the preview shell to one viewport and retained horizontal comparison cards on narrow widths
- Made SVGA information and runtime logs mutually exclusive overlay panels
- Stabilized the main preview by removing resize/filter-related player reconstruction
- Added compact asset rows and segmented filters
- Removed duplicate mode-menu indicators and added log copy/clear feedback
- Moved artifact rescan to Export Review and auto-load settings to Playback & Acceptance
- Added target-aware theme toggle icons and independent original-size fit defaults
- Added the standard `npm test` alias for the existing MVP test suite

## 2026-06-07 — Web preview rebuild from baseline

**Baseline**: `v0.1.0-avatar-frame-handoff-baseline` (`ea4e34d`)
**Branch**: `agent/codex/web-preview-rebuild-from-baseline`
**Implementation commits**: `23ec4d1`, `4e1a6bc`, `6c38fad`, `429cfa3`
**Tag**: `v0.1.4-web-preview-rebuild`

- Rebuilt latest-artifact discovery around complete artifact groups and real SVGA priority
- Kept reference media and report data in the same artifact group
- Prevented reference success from masking a missing or failed SVGA
- Replaced 15vw panel sizing with readable, resizable information and log panels
- Restored vertical reachability and narrow-width overlay fallbacks
- Unified mode and card display dropdown behavior
- Added shared playback-button state rendering and grouped settings
- Removed the real `jobs/avatar_frame_gold_green_real_002` workspace from Git tracking while preserving local files
- Kept WCAG AAA status at Partial pending axe and full viewport verification

## 2026-06-07 — v0.1.0-avatar-frame-handoff-baseline

**Commit**: (see git log)
**Tag**: v0.1.0-avatar-frame-handoff-baseline

Hermes handoff baseline. Preserved Codex uncommitted avatar frame improvements:
- 300×300 default production canvas, 600→300 source scaling
- Transparent pixel trimming, image optimization
- Baked sweep mask system (safeArea exclusion, per-frame bbox cropping)
- Unified easing/interpolation (Preview + Exporter share code)
- Wing flap amplitude ±7.5° (15° peak-to-peak)
- Web preview drag-drop, Chinese-first UI, stable compare button
- Added git collaboration rules, review process, agent handoff docs

## 2026-06-06 — e3786b3

**Commit**: e3786b3
feat: add MVP planning and preview workflow

## 2026-06-06 — de3ce02

**Commit**: de3ce02
Stabilize SVGA export playback validation and sweep optimization

## 2026-06-06 — 5a31605

**Commit**: 5a31605
Initialize SVGA avatar frame MVP
