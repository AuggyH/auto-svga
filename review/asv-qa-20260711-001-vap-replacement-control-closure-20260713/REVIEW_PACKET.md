# VAP Replacement Control Closure Review Packet

## Binding

- Requirement: `ASV-REQ-20260709-003`
- QA ticket: `ASV-QA-20260711-001`
- Branch: `codex/0.2-vap-replacement-control-20260713`
- Base: `2795dcb786a8579125fc8fdfe92cebeb014d0766`
- Source review: `docs/reviews/2026-07-13-codex-vap-replacement-control-closure.md`
- Code Review findings repaired: `MF-VAP-REPLACE-CR-001`,
  `MF-VAP-REPLACE-CR-002`

## Owner-Visible Fix

Both owner-visible replacement controls now use one reliable semantic path:

- Native/menu replacement command calls a 0.2-gated host picker.
- Candidate-row image action calls the same controller replacement command.
- The selected image target identity is preserved by `targetId`.
- The active source identity is mandatory and guarded by `sourceId` before and
  after picker selection.
- Cancelled, invalid, missing, oversized, stale, and unsupported paths fail
  closed with redacted feedback.
- Picked image bytes are read with fd + `fstat` + bounded `MAX+1` reads, not
  stat-then-unbounded `readFileSync`.

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

## CR Repair Evidence

- Missing/blank `sourceId` fails before host dialog.
- Stale `sourceId` fails before host dialog and after picker selection.
- Deleted/unreadable selected files return a typed redacted failure.
- File growth beyond the 10 MiB cap is rejected by bounded `MAX+1` read logic.
- Row/native parity remains routed through the same host picker path.
- Behavioral VM coverage executes the extracted main-process picker/read helpers
  and asserts dialog call count / typed failure / no opened oversize payload.

## Validation Summary

- Focused Electron replacement/control/runtime suites: PASS 6/6
- Related multi-format runtime suites: PASS 42/42
- `npm run build`: PASS
- `npm run test:all`: PASS 528/528
- `npm run desktop:short-term:design-system-check`: PASS
- Diff hygiene: PASS
- TASK_RETRO_LEDGER JSONL parse: PASS

## Nonclaims

This packet does not claim QA acceptance, Packaging readiness, installed-app
promotion, Product Owner acceptance, product support, save/export/conversion,
production readiness, distribution readiness, or release readiness.
