# Current Status

Date: 2026-06-13

## Main Branch

- **Runnable**: yes after Web preview component consistency polish
- **Latest implementation commit**: `1866efc`
- **Latest tag**: v0.1.4-web-preview-rebuild
- **Branch**: main

## Multi-format Workbench Architecture Preparation

Branch: `agent/codex/multiformat-workbench-architecture`
Merged to main: `4498e64`

- Added isolated host-neutral contracts for format parsing, playback sessions,
  specification checks, recommendations, exports, cancellation, and progress.
- Added an audited capability baseline for SVGA, VAP, Lottie, animated WebP,
  WebM, APNG, and sprite sequences.
- Documented the current SVGA coupling, raster conversion boundary, desktop
  host ports, dependency/license risks, and staged rollout.
- Recorded ADR-003. Current `avatar_frame` runtime, project protocol, exporter,
  and Web preview behavior remain unchanged.
- No new runtime dependency was added.
- Standard test now runs all compiled test files; latest result is 31 passed.

## SVGA FormatAdapter

Branch: `agent/codex/svga-format-adapter`
Merged to main: `1790483`

- Added a host-neutral `SvgaFormatAdapter` that maps standard MovieEntity
  metadata to `MotionAssetInfo`.
- Added an injected `SvgaBinaryInspector` boundary.
- Added a Node host inspector for zlib and protobuf decoding.
- Added metadata parity tests for dimensions, FPS, duration, image keys,
  Sprite references, resource counts, and existing validator counts.
- Current CLI, exporters, Web preview, and generated SVGA bytes are untouched.
- Full test result: 35 passed, 0 failed.

## Motion Inspection Application Service

Branch: `agent/codex/svga-inspection-service`
Implementation commit: `25c9a8c`

- Added host-neutral `MotionAssetInspectionService`.
- The service delegates to one injected `FormatAdapter` and returns its
  `WorkbenchResult<MotionAssetInfo>` unchanged.
- Verified memory sources and host-provided local file sources with
  `SvgaFormatAdapter`.
- Service tests: 3 passed; existing SVGA adapter tests: 4 passed.
- Build passed. Exporter, CLI, Web preview, playback, and dependencies are untouched.

## Minimal SVGA MotionSpecChecker

Branch: `agent/codex/minimal-svga-spec-checker`
Implementation commit: `870ea1f`

- Added host-neutral `SvgaMotionSpecChecker`.
- Checks file size, canvas dimensions, duration, FPS, and resource count from
  existing `MotionAssetInfo`.
- Emits structured issues for exceeded limits and required metadata that is unavailable.
- Checker tests: 5 passed; inspection service tests: 3 passed; build passed.
- Adapter, inspection service, exporter, CLI, Web preview, playback, and dependencies are untouched.

## Token-saving Skills

Branch: `agent/codex/token-saving-skills`
Merged to main: `708063c`

- Added repository-local `caveman-report`, `context-budget`, and `diff-first`.
- Each skill contains concise task rules plus standard Codex UI metadata.
- All three skills pass the official `quick_validate.py` validator.
- No runtime code, dependency, output protocol, or global Codex installation changed.

## Verification Budget Skill

Branch: `agent/codex/verification-budget-skill`
Implementation commit: `a71232b`

- Added repository-local `verification-budget` for risk-proportional validation.
- Defines Tier 0-4 requirements, concise evidence rules, and protected Auto SVGA flows.
- Official skill validation and Git whitespace checks pass.
- Runtime code, tests, dependencies, exporter, playback, CLI, and Web preview are unchanged.

## Project-specific Codex Skills

Branch: `agent/codex/project-specific-skills`
Merged to main: `e2ad3cd`

- Added required `auto-svga-core-guard`.
- Added focused skills for motion formats, specification checks, UI stability,
  and desktop-client preparation.
- Added skill routing guidance and a compact replacement main prompt.
- All five project skills pass the official validator.
- Full project test result: 35 passed, 0 failed.
- Runtime code, tests, dependencies, SVGA output, and Web preview are unchanged.

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

Merged to `main`: `3928e4a`

- Fixed comparison layouts to remain horizontal and page-level scrolling to remain disabled.
- Replaced independent information/log booleans with one mutually exclusive side-panel state.
- Uses overlay side panels so opening diagnostics does not collapse the preview cards.
- Removed SVGA player rebuilds from fit-mode and window-resize handlers to keep playback stable while inspecting assets.
- Made original size the first-run default, with independent per-card persistence and safe container constraints.
- Moved artifact rescan into Export Review and automatic latest-artifact loading into Playback & Acceptance settings.
- Added log action feedback, target-aware theme icons, compact asset rows, and compact asset filters.
- Browser verified at the available 499×771 narrow viewport; the requested explicit desktop-width screenshot matrix remains not fully verified in this environment.

## Web Preview Overlay Polish

Implementation commit: `0c1644b`

- Added explicit toolbar, dropdown, side-panel, settings, lightbox, and toast z-index tokens.
- Strengthened information/log panel backgrounds, borders, blur, and shadows in both themes.
- Added a persisted Reduce Blur setting that replaces blurred floating surfaces with solid fills.
- Kept information and runtime logs mutually exclusive, with outside-click and Escape dismissal.
- Raised settings and asset lightbox layers above diagnostics; asset lightbox close controls remain accessible.
- Added exit transitions for panels, modals, lightboxes, dropdowns, and settings feedback.
- Removed the settings Done button and added reusable real-time setting toasts.
- Stabilized asset filter dimensions and scrollbars so Sequence and Warning views do not resize the panel or preview.
- Preserved centered playback media and a centered mode control at the available 499px narrow viewport.
- Browser verified both themes and Reduce Motion / Reduce Blur behavior at the available viewport.

## Web Preview Component Consistency

Implementation commit: `691f7df`

- Moved every mode/fit dropdown into one fixed `floatingRoot`, eliminating preview-card clipping.
- Unified menu blur, solid Reduce Blur fallback, selection, focus, animation, and viewport clamping.
- Rebalanced synchronized playback into visible left summary, compact center controls/status, and visible right summary.
- Unified stage/media centering across SVGA A, SVGA B, and reference variants.
- Kept temporary diagnostics open during toolbar actions; modal/lightbox backdrops still close without click-through.
- Improved Overview filename wrapping, row spacing, status badge sizing, and bilingual hierarchy.
- Made Assets filters non-scrolling vertically; only the 48px-thumbnail resource list scrolls.
- Split resource metadata into dimensions/size and imageKey/reference lines.
- Added narrow-width icon-only fallbacks and no-vertical-text constraints.
- Added visible rescan toast feedback and retained log action feedback.

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
- Explicit 900px and 768px viewport emulation is still not available in the current browser session; responsive rules are implemented but those exact widths remain not verified
- Two-file Local Compare with both SVGA A and SVGA B loaded remains a manual verification item in this browser environment

## Next Steps

- Integrate SVGA inspection into one non-UI application service without
  changing CLI output or Web playback behavior.
- Complete axe and explicit 1600/1440/1280/1024/900/768 viewport matrix checks
- Human review of the synchronized footer at 900px/768px and a real two-SVGA Local Compare session
- Human visual acceptance of avatar_frame_gold_green_real_002 remains required
