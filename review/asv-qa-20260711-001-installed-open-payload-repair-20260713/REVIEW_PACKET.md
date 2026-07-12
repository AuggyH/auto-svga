# Review Packet: Installed Multi-format Open Payload Repair

## Fix Ready

- Requirement: `ASV-REQ-20260709-003`
- Defect: `ASV-QA-20260711-001`
- QA fact-source: `b31c76fdffd3c5864b7308fa3c2ff6598457749b`
- Branch: `codex/0.2-installed-open-payload-repair-20260713`
- Base: `c3150ead6edc046f70811209ed48c8a99c88243b`

## Delta

- Propagates exact installed `fileOpenEvent` through owner/workspace/Lottie/VAP validators.
- Preserves active hashed source identity through play/pause/replacement/reset.
- Keeps stale requests from replacing the active source identity.
- Adds same-shape positive Lottie, bounded sidecar VAP, fusion replacement/reset,
  over-limit VAP, path-redaction, and formal 0.1 evidence.

## Evidence

- Failure-first reproduced `failed` versus expected `previewReady` before repair.
- Focused installed open/runtime/0.1: PASS 6/6.
- Related format/workspace/owner/asset: PASS 43/43.
- Build: PASS.
- Full regression: PASS 525/525.
- Design-system and syntax/diff checks: PASS.

## Non-claims

No package rebuild, installed promotion, foreground playback, QA acceptance,
Product Owner acceptance, Lottie/VAP support, visual success, save/export,
conversion, production readiness, or release readiness is claimed.
