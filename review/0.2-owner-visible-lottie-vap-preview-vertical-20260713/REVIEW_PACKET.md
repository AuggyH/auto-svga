# Review Packet: Owner-visible Lottie/VAP Preview Vertical

## Implementation Ready Summary

- Requirement: `ASV-REQ-20260709-003`
- Branch: `codex/0.2-owner-visible-lottie-vap-preview-vertical-20260713`
- Base: `b694fa86e7965dac87b8ad3b59da3a292c0117c0`
- Review file:
  `docs/reviews/2026-07-13-codex-owner-visible-lottie-vap-preview-vertical.md`

What changed:

- Added formal-0.2-only runtime preview preparation for local Lottie JSON and
  VAP/MP4 files.
- Served approved runtime packages from local self-hosted endpoints:
  `lottie-web/build/player/lottie_svg.js` and
  `video-animation-player/dist/vap.js`.
- Added renderer-side runtime mounting, generation/cancellation guards,
  cleanup, object-URL revocation, and replacement/reset remount behavior.
- Added bounded adjacent `vapc` sidecar support so safe local VAP/MP4 fixtures
  can reach readiness without accepting ordinary MP4 false positives.
- Preserved formal `0.1.x` SVGA-only isolation and existing typed terminal
  failure behavior.

## Evidence

- Focused Electron/source runtime suites: PASS 8/8.
- Build: PASS.
- Focused VAP inspection: PASS 14/14.
- Focused multi-format workspace/owner-preview/asset qualification: PASS 23/23.
- Full root regression: PASS 525/525.
- Design-system check: PASS.
- Diff hygiene, package/lock drift scan, media/archive scan, and incomplete
  VM-smoke leftover scan: PASS.

## Environment Boundary

The incomplete self-hosted Node VM browser smoke was removed after repeated
browser-environment gaps. The current milestone proves source/dev runtime
payload and renderer mount contracts, not real browser foreground visual
playback. Actual browser playback evidence is intentionally deferred to a
rebuilt package candidate and bounded foreground regression.

## Non-claims

No package, promotion, foreground launch, QA acceptance, Product Owner
acceptance, real-material visual success, persistent authoring, save/export,
conversion, Windows/AEB scope, Lottie/VAP production support, or release
readiness is claimed.
