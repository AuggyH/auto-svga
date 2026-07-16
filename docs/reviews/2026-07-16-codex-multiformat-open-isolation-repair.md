# Multi-format Open Isolation Repair

## Summary

Repaired `MF-COMBINED-OPEN-ISOLATION-CR-001` from the combined runtime/UIUX Code Review against `2fc1eda2043754c7bc62e4ed767aa4bdca4c820b`.

Root cause: Lottie/VAP renderer replacement state was keyed by kind and target id, while visible text preview state was retained across successful new-source Open. A successful Open of source B could therefore prepare its first runtime preview with image/text runtime values from source A when target ids overlapped, especially if a delayed Apply from source A completed after source B became active.

The repair keeps the authority local to the renderer/controller state boundary:

- accepted Lottie/VAP Open increments a replacement-authority generation, invalidates pending runtime text mutations, clears runtime replacement values, and clears visible `textPreviewValues` before source B can render or prepare runtime values;
- host picker and renderer file Apply capture source id plus authority generation, then recheck after asynchronous boundaries before publishing replacement state;
- delayed source-A text or image Apply completions fail closed after source-B Open.

No main/preload/IPC/session/picker/placement/filesystem/package code changed.

## Authority

- Requirement: `ASV-REQ-20260709-003`
- Rejected combined head: `2fc1eda2043754c7bc62e4ed767aa4bdca4c820b`
- CR finding: `MF-COMBINED-OPEN-ISOLATION-CR-001`
- CR governance: `253172d82a5cc72e4aa66854b6c4fc6a7554d462`
- Formal review: `/Users/huangtengxin/.codex/worktrees/2b43/auto-svga/docs/reviews/2026-07-16-codex-code-review-multiformat-runtime-uiux-combined.md`
- Formal review SHA-256: `b019d8dad977f89b6a288ea9528183af8dad650e1a4c3c1682d016aae517ca4a`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

Product diff SHA-256 over the changed product/test files:

`7c7ffda4094ac025d9cf9478390d4e30a9f42b8c1e5ff97a7f0cf2fabccb2a48`

## Failure-First Evidence

Added regression coverage for the exact stale-authority class:

- overlapping Lottie/VAP target ids across source A then source B must yield a clean first source-B runtime prepare: no active replacements, no inherited runtime values, and empty visible text preview state;
- delayed text Apply completion from source A after source B opens must not remount source B or restore source-A visible text;
- delayed image Apply completion from source A after source B opens must not remount source B, mark source B dirty, or publish stale active replacements.

The existing host-picker contract test now also requires source/generation rechecks after asynchronous replacement picker/file boundaries.

## Validation

Passed after the product repair:

- `node --check tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- Focused open-isolation and related replacement slice: PASS 6/6
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs`: PASS 28/28
- `npm run build`: PASS
- `npm run test:all`: PASS 542/542
- `node tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`: PASS
- `git diff --check`: PASS

Environment-limited check retained from the combined source handoff:

- direct full `svga-web` Node suite was not claimed as full PASS because package-proof fixtures still require missing local `@electron/asar`. The previously observed product/source slice was 147/149 with those two environment failures.

## Preserved Boundaries

- Reset/source-value behavior: preserved.
- Daily-use right-surface polish: preserved.
- SVGA replacement identity and VAP fusion authority: preserved.
- Host/session/picker/placement/package boundaries: not touched.
- Electron/Auto SVGA/Finder/foreground/runtime: not launched.
- QA/Packaging/install/promotion/Product Owner acceptance/support/distribution/release: not routed or claimed.

## Retrospective

The happy-path combined source tests did not model a successful new source opening while old renderer replacement authority was still live. The reusable guard is to bind renderer-side replacement publication to both active source id and a local authority generation, then invalidate pending text/image mutation paths before the new-source render/prepare boundary.
