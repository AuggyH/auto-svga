# Multi-format Runtime + UI/UX Combined Source

Status: `Combined Source Ready / Pending Code Review`

Branch: `codex/0.2-multiformat-runtime-uiux-combined-20260716`

Input heads:

- Runtime/product: `8090bf6d1694a30e589c8fb6bbe364d93b449975`
- Source base: `77b8991424752c86a4efee3a0d590960a1b8a55b`
- UI/UX Reset/source-value product: `266e32e0648f41613bc57461b99bdf1a0eb1fada`
- UI/UX daily-use right-surface product: `ca50ae9d3736df51ef9ac0772fef650f77dc6d3a`
- UI/UX approved handoff: `64a8b87c0578d1c28e30e2f6a80401578f9808b5`

Product diff SHA-256 over `src/` + `tools/` from `77b8991424752c86a4efee3a0d590960a1b8a55b`:

`2cf76b99f36a8d356a900fdaf7b5e47df99eae7481d3dc755202e183c2808796`

Changed product/test files:

- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-text-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

Validation:

- Syntax: PASS for touched JS/MJS files.
- Focused combined tests: PASS 5/5.
- Root source suite: `npm run test:all` PASS 542/542.
- Design-system check: PASS.
- Direct `svga-web` Node suite: 147/149; remaining two failures are missing local `@electron/asar` package-proof dependency.
- `spike:svga-web:test`: not claimed; stopped before tests because runtime dependency `long` is missing.
- Diff/JSONL/package-lock/media hygiene: PASS.

Nonclaims:

- No Electron/Auto SVGA launch.
- No foreground, Finder, install, package, promotion, QA, or owner material mutation.
- No installed QA, visual fidelity acceptance, Product Owner acceptance, support, distribution, or release readiness.
