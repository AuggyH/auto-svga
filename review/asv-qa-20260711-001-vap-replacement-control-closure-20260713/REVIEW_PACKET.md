# VAP Replacement Control Closure Review Packet

## Binding

- Requirement: `ASV-REQ-20260709-003`
- QA ticket: `ASV-QA-20260711-001`
- Branch: `codex/0.2-vap-replacement-control-20260713`
- Base: `2795dcb786a8579125fc8fdfe92cebeb014d0766`
- Source review: `docs/reviews/2026-07-13-codex-vap-replacement-control-closure.md`

## Owner-Visible Fix

Both owner-visible replacement controls now use one reliable semantic path:

- Native/menu replacement command calls a 0.2-gated host picker.
- Candidate-row image action calls the same controller replacement command.
- The selected image target identity is preserved by `targetId`.
- The active source identity is guarded by `sourceId` before and after picker
  selection.
- Cancelled, invalid, missing, oversized, stale, and unsupported paths fail
  closed with redacted feedback.

## Runtime Evidence

Pre-commit hidden Electron proof passed with:

- real `video-animation-player@1.0.5`
- WebGL canvas `120x80`
- video readyState `4`
- play and pause state transitions
- native/action replacement remount
- row replacement remount
- reset source remount
- no external requests

The final CR callback includes the post-commit head-bound proof path and SHA.

## Validation Summary

- Focused Electron replacement/control/runtime suites: PASS 5/5
- Related multi-format runtime suites: PASS 42/42
- `npm run build`: PASS
- `npm run test:all`: PASS 528/528
- `npm run desktop:short-term:design-system-check`: PASS
- Diff hygiene: PASS

## Nonclaims

This packet does not claim QA acceptance, Packaging readiness, installed-app
promotion, Product Owner acceptance, product support, save/export/conversion,
production readiness, distribution readiness, or release readiness.
