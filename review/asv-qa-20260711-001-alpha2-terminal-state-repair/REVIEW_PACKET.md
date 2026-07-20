# Review Packet: ASV-QA-20260711-001 Alpha2 Terminal State Repair

## Identity

- Requirement: `ASV-REQ-20260709-003`
- QA ticket: `ASV-QA-20260711-001`
- Branch: `codex/0.2-alpha2-intake-terminal-state-repair`
- Base: `7077c867bb31e3fd72823649b2c6412bb8af6de2`
- State: Fix Ready / Code Review Required

## Repair Summary

The repair addresses the permit 028 installed-app foreground finding where
Lottie returned from Loading to Launch without a typed state and VAP remained
Loading. Packaged multi-format sessions now use the packaged `.runtime` root
for accepted workspace modules, proto files, and runtime dependencies. The
main-process session and renderer controller also enforce bounded terminal open
outcomes so missing models, rejected calls, malformed results, and stalled
bridge calls become visible typed path-redacted failures.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/product/requirements/ASV-REQ-20260709-003.md`
- `docs/quality/reports/ASV-QA-20260711-001-terminal-state-repair.md`
- `docs/reviews/2026-07-11-codex-asv-qa-20260711-001-alpha2-terminal-state-repair.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`

## Validation

- `npm run build`: PASS.
- Focused Electron desktop/package/open suite: PASS 6/6.
- `npm run test:all`: PASS 524/524.
- `node tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`: PASS.
- `git diff --check`: PASS.
- Package/lockfile drift scan: PASS, none.
- Production media/archive changed-file scan: PASS, none.
- Formal 0.1 isolation scan: PASS.

## Boundaries

- No package build, package promotion, installed-app replacement, foreground
  launch, QA rerun, save/export/conversion, or production material use.
- No Lottie/VAP product support or real-material visual success claim.
- Known `.pnpm-store/` residue remains classified and unstaged.

## Next Gate

Request Code Review for the source repair. If approved, Packaging must rebuild
and install a repaired alpha2 candidate before QA reruns the foreground Lottie
and VAP matrix.
