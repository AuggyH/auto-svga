# Multi-format Runtime + UI/UX Combined Source

## Summary

Integrated the approved Multi-format runtime/product line with the approved UI/UX right-surface product changes for the next daily-use candidate.

Exact input authorities:

- Runtime/product line: `8090bf6d1694a30e589c8fb6bbe364d93b449975`
- Current source base: `77b8991424752c86a4efee3a0d590960a1b8a55b`
- UI/UX Reset/source-value product commit: `266e32e0648f41613bc57461b99bdf1a0eb1fada`
- UI/UX daily-use right-surface product commit: `ca50ae9d3736df51ef9ac0772fef650f77dc6d3a`
- Approved UI/UX handoff: `64a8b87c0578d1c28e30e2f6a80401578f9808b5`

The integration was applied as a semantic patch, not a wholesale UI/UX branch merge. Host/main/preload/IPC/session/picker/placement/filesystem/package surfaces were left untouched.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-text-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

Product diff SHA-256 over `src/` + `tools/` from `77b8991424752c86a4efee3a0d590960a1b8a55b`:

`2cf76b99f36a8d356a900fdaf7b5e47df99eae7481d3dc755202e183c2808796`

## Behavior

- Preserves approved target-scoped reset authority and production input replaceability.
- Integrates UI/UX source-value Reset behavior for Lottie/VAP runtime text rows.
- Integrates right-surface daily-use polish for asset rows, badges, issue disposition, and quiet normal asset states.
- Keeps runtime text Apply/Reset generation-bound so delayed Apply cannot publish after source Reset.
- Keeps source-authority tests aligned with the current active-source contract instead of preparing runtime payloads from stale source ids.

## Validation

Passed:

- `node --check` for touched JS/MJS files.
- Focused combined tests: PASS 5/5.
- `npm run test:all`: PASS 542/542.
- `npm run desktop:short-term:design-system-check`: PASS.
- `git diff --check`: PASS.
- Strict `docs/retrospectives/TASK_RETRO_LEDGER.jsonl` parse: PASS 192 rows.
- Package/lock/media changed-path scans: PASS, no drift.

Additional nonblocking environment result:

- `node --test tools/electron-prototype/experiments/svga-web/tests/*.test.mjs`: PASS 147/149 product/source tests, with 2 package-proof fixture failures caused by missing local dependency `@electron/asar`.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`: stopped before test execution because `scripts/prepare-runtime.mjs` reported missing runtime dependency `long`.

## Boundaries

No Electron or Auto SVGA app was launched. No Finder, foreground, install, promotion, Packaging, QA route, owner material mutation, or Product Owner acceptance was performed or claimed. This is source-only and pending independent Code Review.

## Retrospective

The UI/UX cherry-picks conflicted in renderer/test files because the runtime line had advanced target-scoped reset/source authority. Resolving semantically rather than accepting either side wholesale kept the new UI affordances while preserving stale-generation and active-source protections.
