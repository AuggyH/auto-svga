# Changelog

## 2026-06-13 — Motion inspection application service

**Branch**: `agent/codex/svga-inspection-service`
**Implementation commit**: `25c9a8c`

- Added a host-neutral application service over injected `FormatAdapter`
- Verified `SvgaFormatAdapter` parity through the service
- Verified memory and host-provided local file sources
- Kept CLI, exporter, Web preview, playback, and dependencies unchanged

## 2026-06-13 — Verification budget skill

**Branch**: `agent/codex/verification-budget-skill`
**Implementation commit**: `a71232b`

- Added `verification-budget` with Tier 0-4 validation guidance
- Added concise passing/failing test evidence rules
- Documented protected Auto SVGA flows
- Kept runtime code, dependencies, and tests unchanged

## 2026-06-13 — Project-specific Codex skills

**Branch**: `agent/codex/project-specific-skills`
**Implementation commit**: `2535bc3`

- Added the required Auto SVGA core guard
- Added focused format, specification, UI, and client-readiness skills
- Added task-to-skill routing guidance
- Added a compact main prompt to replace repeated project instructions

## 2026-06-13 — Token-saving Codex skills

**Branch**: `agent/codex/token-saving-skills`
**Implementation commit**: `6cb0e6f`

- Added `caveman-report` for compact evidence-first reports
- Added `context-budget` for minimal repository context loading
- Added `diff-first` for change, verification, regression, and risk reporting
- Added standard Codex UI metadata and validated all three skills

## 2026-06-13 — SVGA FormatAdapter

**Branch**: `agent/codex/svga-format-adapter`
**Implementation commit**: `1866efc`

- Added a host-neutral SVGA `FormatAdapter` and inspection data boundary
- Added a Node zlib/protobuf inspector as a separate host implementation
- Mapped canvas, timing, images, image keys, Sprites, matte keys, and counts to `MotionAssetInfo`
- Added metadata parity and malformed-input tests
- Kept CLI, exporter, Web player, dependencies, and SVGA output paths unchanged

## 2026-06-13 — Multi-format workbench architecture preparation

**Branch**: `agent/codex/multiformat-workbench-architecture`
**Implementation commit**: `39b21e2`

- Audited current SVGA parser, playback, exporter, Web host, and FFmpeg coupling
- Added isolated workbench contracts for adapters, playback sessions, checks, recommendations, exports, progress, and cancellation
- Added capability maturity baselines for seven target motion formats
- Added ADR-003 and a staged architecture, dependency, licensing, and desktop-client plan
- Kept all current avatar-frame runtime paths unchanged and added no dependencies
- Expanded the standard test command to include all compiled test files

## 2026-06-07 — Web preview component consistency

**Branch**: `agent/codex/web-preview-component-consistency`
**Implementation commit**: `691f7df`

- Portaled all mode and fit menus to a shared fixed floating root with viewport-safe positioning
- Unified menu blur, Reduce Blur fallback, selection, focus, and exit behavior
- Rebalanced the synchronized footer so both file summaries remain visible at narrow widths
- Standardized media centering for SVGA and reference preview card variants
- Refined Overview spacing, filename wrapping, compact status badges, and bilingual hierarchy
- Kept Assets filters fixed while making only the 48px-thumbnail list scroll
- Split asset metadata into two readable lines and compacted runtime log presentation
- Preserved side panels during toolbar actions while retaining modal backdrop click protection
- Added icon-only responsive fallbacks and visible rescan toast feedback

## 2026-06-07 — Web preview overlay and responsive polish

**Branch**: `agent/codex/web-preview-overlay-polish`
**Implementation commit**: `0c1644b`

- Added a documented floating-layer z-index scale for dropdowns, diagnostics, settings, asset lightbox, and toast
- Improved information/log panel readability with stronger surfaces, borders, blur, and shadow
- Added a persisted Reduce Blur accessibility setting with solid floating-surface fallback
- Added outside-click and Escape dismissal with highest-layer priority and focus restoration
- Added matching exit motion for modals, lightbox, dropdowns, panels, and setting feedback
- Removed the settings Done action and added reusable real-time setting toasts
- Stabilized resource filter scrolling and dimensions to prevent Sequence/Warning layout shifts
- Kept the toolbar mode selector and preview media centered at the verified narrow viewport
- Preserved information/log mutual exclusion and real-player rendering behavior

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
