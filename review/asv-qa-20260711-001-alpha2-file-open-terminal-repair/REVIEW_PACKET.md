# Review Packet: ASV-QA-20260711-001 Alpha2 File-open Terminal Repair

## Fix Ready Summary

- Ticket: `ASV-QA-20260711-001`
- Requirement: `ASV-REQ-20260709-003`
- Branch: `codex/0.2-alpha2-file-open-terminal-repair`
- Base: `046cf503f4f65d603c44923bc2a5ba60d718fd3a`
- Source fix commit: `2a33790f8ab48530bf29d2785a6afd5565b37457`

Root cause: installed macOS `open-file` events were not handled by the Electron
main process, so LaunchServices-opened Lottie/VAP aliases did not reach the 0.2
multi-format session or renderer terminal-state bridge.

Repair:

- Added formal-0.2-only `app.on("open-file")` handling before `app.whenReady()`.
- Queued early file-open paths and flushed them after renderer readiness.
- Routed installed file-open through
  `openMultiFormatFilePath(item.filePath, "fileOpenEvent")`.
- Added hidden renderer actions for begin/complete/fail terminalization.
- Bound completion to eventId plus active request generation.
- Kept short-term 0.1 from receiving hidden file-open actions unless the
  multi-format controller supplies handlers.

## Validation

- Failure-first source contract failed before implementation with:
  `installed macOS file-open events must be handled`.
- Focused installed file-open contract: PASS 1/1.
- Related 0.1 guard/session/renderer contracts: PASS 5/5.
- `node --check` main/preload: PASS.
- `npm run build`: PASS.
- `npm run test:all`: PASS 524/524.
- `npm run desktop:short-term:design-system-check`: PASS.
- `git diff --check`: PASS.
- Package/lock diff: none.
- Production media/archive changed-file scan: none.

## Next Gate

Please route this exact Fix Ready head to Code Review. If approved, this still
requires Packaging to rebuild/promote an alpha2 repair candidate before QA
reruns the installed foreground LOTTIE-A/VAP-A regression.

## Non-claims

This packet does not claim QA acceptance, Product Owner acceptance, installed
package readiness, package promotion, Lottie/VAP product support, foreground
visual success, save/export/conversion support, production support, or release
readiness.
