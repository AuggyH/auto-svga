# Multi-format Open Isolation Repair

## Status

`Fix Ready / Pending Code Re-review`

## Scope

Repair `MF-COMBINED-OPEN-ISOLATION-CR-001` only: stale Lottie/VAP image/text replacement state from source A must not leak into source B after successful Open.

## Source Binding

- Branch: `codex/0.2-multiformat-open-isolation-repair-20260716`
- Base rejected source: `2fc1eda2043754c7bc62e4ed767aa4bdca4c820b`
- CR governance: `253172d82a5cc72e4aa66854b6c4fc6a7554d462`
- Review SHA-256: `b019d8dad977f89b6a288ea9528183af8dad650e1a4c3c1682d016aae517ca4a`
- Product diff SHA-256: `7c7ffda4094ac025d9cf9478390d4e30a9f42b8c1e5ff97a7f0cf2fabccb2a48`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Behavior

- Accepted Lottie/VAP Open increments renderer replacement authority generation.
- Accepted Lottie/VAP Open clears runtime replacement maps and visible text preview values before new-source render/prepare.
- Pending runtime text mutations are invalidated on accepted new-source Open.
- Host picker and renderer file Apply capture source id plus generation and recheck after asynchronous boundaries.
- Delayed source-A Apply completions return without remounting or dirtying source B.

## Validation

See `VALIDATION_SUMMARY.md`.

## Protected Areas

Not touched:

- Electron main/preload/IPC/session/picker/placement/package code;
- SVGA source identity and VAP fusion authority;
- UI styling and right-surface polish;
- Packaging, QA, install, foreground, owner materials.
