# Changelog

## 2026-06-07 — UI and output validation

**Commit**: (see git log after merge)

Hermes real browser and visual output validation:
- Browser-tested Web preview page: Chinese UI, asset panel, compare button, settings modal, job auto-load
- Verified 002 job outputs: canvas 300×300, assets trimmed, baked sweep bbox, wing amplitude 7.5°
- No code fixes needed — all tested items passed
- Identified items requiring human visual review (spacing, sweep quality, drag-drop)

## 2026-06-07 — repo hygiene follow-up fixes

**Commit**: 90a8165 (merge), c1c36e5 (baseline)

Hermes follow-up:
- Tightened .gitignore examples exception rules (zip, svga, gif, webm, mp4)
- Updated TECH_SPEC jobs/ description (local runtime workspace, gitignored)
- Updated README: `avatar_frame_test_001` → `avatar_frame_local_001`, added gitignore note
- Added commit hash to previous repo hygiene review

## 2026-06-07 — repo hygiene and doc fixes

**Commit**: 6079e90 (merge), 4efad20 (baseline)

Hermes repo hygiene pass:
- Fixed AGENTS.md template count (3 → 5)
- Added ADR-001 (avatar frame MVP scope) to docs/decisions/
- Added Asset Commit Rules to AGENTS.md
- Updated .gitignore: jobs/, input/, generated/, output/, *.svga, *.gif, etc.
- Removed jobs/ from Git tracking (local files preserved)
- Updated CURRENT_STATUS with known issues and asset rules
- Verified build + 28 tests pass without tracked jobs/

## 2026-06-07 — v0.1.0-avatar-frame-handoff-baseline

**Commit**: ea4e34d (merge), 59275ff (baseline)
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
