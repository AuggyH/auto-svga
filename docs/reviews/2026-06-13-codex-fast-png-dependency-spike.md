# Review: bounded fast-png dependency and bundle-size spike

## Summary

Added an isolated `fast-png` alpha analyzer prototype and measured its actual
browser ESM bundle cost. Recommendation: approve for a future host analyzer,
but do not connect it to production inspection yet.

## Git state

- Branch: `agent/codex/fast-png-dependency-spike`
- Base: `57e0f19`
- Production wiring: unchanged

## Changed files

- `package.json`
- `pnpm-lock.yaml`
- `src/spikes/fast-png-alpha-analyzer.ts`
- `src/tests/fast-png-alpha-analyzer-spike.test.ts`
- `docs/fast-png-dependency-spike.md`
- `docs/reviews/2026-06-13-codex-fast-png-dependency-spike.md`

## Requirement checks

- Isolated prototype: done
- RGBA, transparent, opaque, RGB, grayscale-alpha, indexed fixtures: done
- Malformed and allocation-limit fixtures: done
- License verification: MIT for all three packages
- Actual bundle delta: measured
- Production report, checker, CLI, exporter, Web preview: unchanged

## Verification

- TypeScript build: required before commit.
- Prototype + existing alpha-bound targeted tests: required before commit.
- Full regression skipped because production composition and protected flows are not changed.

## Risks

- The dependency is approved only for a future host adapter, not production wiring.
- Installer impact is not identical to the measured browser bundle.
- Production memory and adversarial-input limits require further tests.

## Next step

- Implement the approved host adapter in a separate task and wire it behind the existing analyzer boundary.

## Commit

- Commit: this delivery commit (see repository history)
- Branch: `agent/codex/fast-png-dependency-spike`
- Tag: none
