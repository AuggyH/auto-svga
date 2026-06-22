# P6 Repair 6 A5 Final Package Handoff Review

## Summary

- Updated the P6 owner handoff builder to generate `.artifacts/product/P6/worker-registry-final.json` at package time.
- The generated registry artifact binds the actual Git `HEAD` and the SHA-256 of tracked `docs/product/p6/P6_WORKER_REGISTRY.json`.
- Adjusted the final package gate to verify sealed packet and parity-report head binding without judging product parity.
- Extended package privacy and integrity checks to reject stale P6 review-root
  references and unindexed Review ZIP entries.

## Git State

- Branch: `agent/codex/p6-r6-a5-final-package-handoff`
- Base commit: `85c1ae0dea9ea8e6349a6616eed3b1e9714cdc61`
- Head commit: see final A5 handoff response.

## Changed Files

- `tools/p6/build-p6-owner-handoff.mjs`
- `tools/p6-owner-handoff-package.test.mjs`
- `docs/reviews/2026-06-23-codex-p6-r6-a5-final-package-handoff.md`

## Requirement Checks

- Protected lifecycle docs, `AGENTS.md`, root `package.json`, Web preview implementation, SVGA exporter, CLI default flow, final handoff inputs, and real user assets were not edited.
- The builder remains internal-only: no signing, notarization, installer, release, publish, or foreground App launch.
- A5 does not produce the final P6 packet or decide parity pass/fail. A0 remains responsible for final product acceptance and final packaging request.

## Verification

- `node --check tools/p6/build-p6-owner-handoff.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/scripts/package-internal-trial.mjs`
- `node --test tools/p6-owner-handoff-package.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `git diff --check`

## Risks And Next Steps

- A0 must run the owner handoff builder only after the final source commit, sealed packet, parity report, and package proof artifacts exist for the same Git `HEAD`.
- The generated `worker-registry-final.json` is ignored runtime output by design and should not be committed.
