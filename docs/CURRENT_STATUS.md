# Current Status

Date: 2026-06-07

## Main Branch

- **Runnable**: yes
- **Latest commit**: (see git log after merge)
- **Latest tag**: v0.1.0-avatar-frame-handoff-baseline
- **Branch**: main

## Last Completed

Hermes repo hygiene follow-up (2026-06-07):
- Tightened .gitignore examples exception rules (zip, svga, gif, webm, mp4 now ignored under examples/)
- Updated TECH_SPEC jobs/ description (local runtime workspace, gitignored)
- Updated README: `avatar_frame_test_001` → `avatar_frame_local_001`, added jobs/ gitignore note
- Added commit hash to previous review file

Hermes repo hygiene (2026-06-07):
- AGENTS.md template count fix, ADR-001, Asset Commit Rules
- .gitignore overhaul, jobs/ removed from tracking
- Verified build + 28 tests pass without tracked jobs/

## Asset Commit Rules

- `jobs/` and `input/` are local runtime workspaces — gitignored, not tracked.
- Example outputs under `examples/` are also gitignored (zip, svga, gif, webm, mp4).
- Real design assets and generated outputs must not enter Git.
- Tests use programmatically generated temp assets.

## Scope

avatar_frame MVP only. No other asset types.

## Known Issues

- `duplicateOverlayRisk: true` — base_frame_full may overlap with local part layers
- No automated visual playback verification — manual review required
- Sweep frame 000 shows white edge artifact on non-transparent background
- UI items from previous review still need verification: double-line text spacing, vertical/horizontal spacing, settings modal style consistency, global style review

## Next Steps

- Human visual acceptance of avatar_frame_gold_green_real_002
- Complete UI spacing/style verification (4 items from previous review)
- Consider phase offset between left/right wing flap
- Evaluate sweep stride vs quality balance
