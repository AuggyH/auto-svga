# Multi-format Workbench Architecture Review

Date: 2026-06-13
Branch: `agent/codex/multiformat-workbench-architecture`
Base commit: `ebbcbd2`

## 1. Summary

Prepared a P1 architecture boundary for future multi-format motion inspection
without connecting it to the current avatar-frame SVGA runtime. Added
host-neutral contracts, a seven-format capability matrix, dependency/license
research, desktop-host boundaries, an ADR, and a staged rollout.

## 2. Git state

- Branch: `agent/codex/multiformat-workbench-architecture`
- Commit before work: `ebbcbd2`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `README.md`
- `package.json`
- `src/workbench/contracts.ts`
- `src/workbench/capabilities.ts`
- `src/tests/workbench-contracts.test.ts`
- `docs/multiformat-workbench-architecture.md`
- `docs/decisions/ADR-003-multiformat-workbench-boundaries.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/TECH_SPEC.md`
- `docs/CURRENT_STATUS.md`
- `docs/CHANGELOG.md`
- `docs/reviews/2026-06-13-codex-multiformat-workbench-architecture.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Audit existing SVGA-focused architecture | Done |
| 2 | Define reusable format/playback/check/export contracts | Done |
| 3 | Cover SVGA, VAP, Lottie, WebP, WebM, APNG, sprite sequence | Done |
| 4 | Document playback, parse, replacement, conversion, export, spec, performance | Done |
| 5 | Provide staged migration plan | Done |
| 6 | Review open-source dependency and license risks | Done |
| 7 | Evaluate future desktop-client boundary | Done |
| 8 | Preserve current avatar-frame runtime behavior | Done |
| 9 | Avoid new players, encoders, dependencies, and real assets | Done |

## 5. Verification

```text
npm test
31 passed, 0 failed

node --check tools/svga-player-preview/main.js
passed

node --check tools/svga-player-preview/server.mjs
passed

git diff --check
passed

production import scan for src/workbench
no runtime imports found
```

`pnpm` was not available in the current shell. The repository-local TypeScript
compiler and all tests were exercised through `npm test`.

## 6. Output inspection

- Runtime output: unchanged
- SVGA exporter: unchanged
- Web preview: unchanged
- Dependencies: unchanged
- Real assets/generated outputs staged: none
- New code is limited to isolated contracts, capability data, and tests

## 7. Risks

- Capability entries marked `planned` or `research` are not implementation promises.
- SVGA Web and Tencent VAP upstream repositories are unmaintained.
- Current CDN player loading is not offline-client ready.
- Current FFmpeg preview path uses a system binary; `libx264` creates a GPL
  distribution concern if a comparable build is bundled.
- No desktop framework has been selected.

## 8. Next steps

- Wrap current SVGA inspection behind `FormatAdapter` with metadata parity
  tests and no exporter/player behavior change.

## 9. Commit

- Commit: `39b21e2`
- Branch: `agent/codex/multiformat-workbench-architecture`
- Tag: none
