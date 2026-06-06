# Current Status

Date: 2026-06-07

## Main Branch

- **Runnable**: yes
- **Latest commit**: (see git log after merge)
- **Latest tag**: v0.1.0-avatar-frame-handoff-baseline
- **Branch**: main

## Last Completed

Hermes UI and output validation (2026-06-07):
- Real browser validation of Web preview page (Safari/Chromium)
- Verified Chinese-first UI, asset panel labels, settings modal, compare button stability
- Verified 002 job outputs: canvas 300×300, baked sweep trimmed, wing 7.5° amplitude
- No code fixes needed — all verified items passed

## Web UI Status

| Item | Status |
|------|--------|
| Chinese-first UI | Done |
| No raw English "sprite" labels (uses 精灵) | Done |
| Asset filter buttons (全部/精灵/图片/序列帧/异常) | Done |
| Compare button position stable | Done |
| Settings modal organized + Chinese | Done |
| SVGA left / Reference video right layout | Done |
| Job auto-load in export review mode | Done |
| Double-line text spacing | Not verified (visual) |
| Vertical/horizontal spacing | Not verified (visual) |
| Settings modal element style consistency | Partial (DOM structure looks consistent) |
| Drag-drop file preview | Not tested (requires file system interaction) |

## Visual Output Status

| Item | Status |
|------|--------|
| Preview canvas 300×300 | Done |
| Assets within 300×300 | Done (max 297×277) |
| Transparent pixel trimming | Done |
| Baked sweep trimmed (88×231, 131×258) | Done |
| Wing amplitude 7.5° / 15° pk-pk | Done |
| Wing anchor at root_joint | Done |
| Memory: 2.23MB / 8MB budget | Done |
| Sweep light quality / white edge | Not verified (visual) |
| Duplicate overlay risk | Known (needs human review) |
| SVGA vs GIF visual consistency | Not verified (visual) |

## Asset Commit Rules

- `jobs/` and `input/` are local runtime workspaces — gitignored, not tracked.
- Example outputs under `examples/` are also gitignored (zip, svga, gif, webm, mp4).
- Real design assets and generated outputs must not enter Git.

## Scope

avatar_frame MVP only. No other asset types.

## Known Issues

- `duplicateOverlayRisk: true` — needs human visual confirmation
- No automated visual playback verification — manual review required
- Sweep visual quality, frame 000 white edge — needs human visual check
- UI visual spacing items — needs human visual check (can't verify from accessibility tree)
- Drag-drop file preview — needs manual browser testing
- 002 job input/ directory missing locally — can't run full pipeline on real assets

## Next Steps

- Human visual acceptance of 002 job in real SVGA player
- Manual drag-drop testing in browser
- Visual spacing/style review (requires human eyes)
- Restore or re-create 002 job input for full pipeline test
