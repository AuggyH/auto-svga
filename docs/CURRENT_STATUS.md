# Current Status

Date: 2026-06-07

## Main Branch

- **Runnable**: yes
- **Latest commit**: (see git log after merge)
- **Latest tag**: v0.1.0-avatar-frame-handoff-baseline
- **Branch**: main

## Last Completed

Hermes repo hygiene (2026-06-07):
- Fixed AGENTS.md template count (3 → 5)
- Added ADR-001 (avatar frame MVP scope)
- Added Asset Commit Rules to AGENTS.md
- Updated .gitignore: jobs/, input/, generated/, output/, *.svga, *.gif, etc.
- Removed jobs/ from Git tracking (local files preserved)
- Verified build + 28 tests pass without tracked jobs/

Previous (Hermes handoff, 2026-06-07):
- Codex uncommitted changes reviewed and committed
- Git collaboration rules, review process, agent handoff docs established
- Baseline commit + tag v0.1.0-avatar-frame-handoff-baseline

## Asset Commit Rules

- `jobs/` and `input/` are local runtime workspaces — gitignored, not tracked.
- Real design assets (PNG, PSD, Figma) and generated outputs (SVGA, GIF, WebM, MP4, frame sequences) must not enter Git.
- Tests use programmatically generated temp assets (see `src/tests/mvp-planner.test.ts`).
- Mock fixtures go under `fixtures/` if needed.

## Scope

avatar_frame MVP only. No other asset types.

## Known Issues

- `duplicateOverlayRisk: true` — base_frame_full may overlap with local part layers; needs human visual confirmation
- No automated visual playback verification — manual review required
- Sweep frame 000 shows white edge artifact on non-transparent background
- UI items from previous review still need verification: double-line text spacing, vertical/horizontal spacing, settings modal style consistency, global style review

## Next Steps

- Human visual acceptance of avatar_frame_gold_green_real_002
- Complete UI spacing/style verification (4 items from previous review)
- Consider phase offset between left/right wing flap
- Evaluate sweep stride vs quality balance
