# Review: short-term compatibility guardrail audit

Date: 2026-07-09
Lane: Short-term Main Engineer
Branch: `agent/codex/short-term-preview-qa-20260708`

## Summary

Audited the short-term macOS client against the PM future-compatibility
guardrails from `803a8a02`. The current product remains SVGA-only and no
visible VAP, Lottie, Windows, AEB, import-package, or format-selection scope was
added.

One low-risk, behavior-preserving static guardrail test was added so future
changes cannot accidentally expose future-format entry points, bypass host
commands, load CDN/unreviewed dependencies, or scatter direct SVGA player
bindings across UI modules.

## Authority Docs Read

- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `docs/multiformat-workbench-architecture.md`
- `docs/reviews/2026-07-09-codex-future-compatibility-guardrails.md`
- `codex-skills/auto-svga-core-guard/SKILL.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-short-term-compatibility-guardrail-audit.md`

`docs/retrospectives/TASK_RETRO_LEDGER.jsonl` already had unrelated
uncommitted changes before this task, so I did not append or stage a ledger
line in this commit.

## Already Compliant

- Open, recent, clear recent, save, overwrite, menu actions, and clipboard copy
  go through the Electron host bridge / IPC boundary.
- Renderer short-term modules do not use Electron privileged APIs, Node
  filesystem APIs, shell access, or absolute local paths.
- The default short-term HTML route is `web/index.html` plus
  `short-term-macos-app.mjs`; legacy Workbench/product-shell entry points remain
  isolated from the current owner-visible surface.
- Playback UI calls `short-term-macos-playback-surface.mjs`; direct
  `svga-web` parser/player binding is contained in
  `short-term-macos-playback-model.mjs`.
- File facts, asset rows, replaceable rows, optimization rows, and thumbnails
  render from inspection / workflow models rather than parsing raw protobuf in
  page components.
- The short-term file contract remains fail-closed to `.svga`; unsupported
  future formats are not silently accepted.
- Recent-file display and save-target feedback are redacted through host-owned
  path handling.
- `svga-web` is vendored and pinned; no short-term renderer CDN, unpkg,
  Lottie, VAP, FFmpeg, AI, or external service dependency is present.

## Low-risk Fix

Added `short-term future compatibility guardrails keep current behavior
bounded` to the desktop experiment test suite. It checks:

- no visible future-format keywords or import/format-selection controls in the
  short-term renderer;
- no CDN/public network player load in short-term renderer sources;
- no renderer-side Electron / Node filesystem / shell bypass;
- current `.svga` support remains explicit and bounded;
- open/recent/save/menu/clipboard routes stay host-command backed;
- direct `svga-web` parser/player binding remains isolated to the playback
  model;
- path redaction and shared short-term failure surfaces remain present.

## Technical Debt Not Fixed

- Feedback is centralized enough for current UI, but not yet a full typed
  taxonomy for unsupported, parse, playback, dependency, file, and capability
  errors. That should be a future behavior-neutral infrastructure WP, not a
  drive-by refactor.
- The renderer still contains product-correct SVGA terms such as `imageKey`,
  `matteKey`, `sequence`, and `audio`. These are short-term requirements, but
  future approved formats should enter through normalized capability data before
  reaching generic rows.
- The renderer currently checks dropped file support with a local `.svga` name
  rule. That is correct while SVGA is the only accepted document type. If PM
  approves additional input formats, replace this with a host/format-registry
  capability check instead of expanding the regex in place.
- `desktop-product-entry.mjs` still contains legacy Workbench/player adapter
  compatibility code. It is not the default short-term route, so I left it
  unchanged.
- Suggested proof filenames have local renderer sanitization while real save
  paths are host-owned and validated. If Windows support is promoted, filename
  suggestion helpers should move behind a shared host/path utility.

## PM Decision Points

None block the short-term client. Future multi-format or AEB intake needs a
separate PM-approved WP for format registry, typed feedback contracts, playback
adapter contracts, and normalized capability data. This audit intentionally did
not add those features.

## Verification

Initial sandbox run proved the new guardrail subtest passed but the existing
server tests could not bind `127.0.0.1` in the sandbox (`EPERM`). Authorized
rerun passed:

```text
npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
Result: PASS, 36/36 tests.
```

No foreground desktop regression was required because the code change is a
static test and does not alter owner-visible runtime behavior.

## Risks

- The audit is source-level and test-level; it does not claim multi-format,
  Windows, VAP, Lottie, or AEB readiness.
- The technical debt above should remain queued as future infrastructure work,
  not hidden inside short-term feature fixes.

## Project Retrospective

Useful lesson: future-compatibility guardrails are safest when expressed as
negative tests around current behavior, not as premature adapters. The audit
found enough good boundaries to avoid a broad refactor; the main durable value
is preventing accidental regression while preserving the frozen short-term
scope.

## Token Usage

- Exact Codex token usage: unavailable in local tooling.
- Token lesson: start with authority docs and targeted static scans; do not
  re-open UI/UX polish or future-format implementation when the task is a
  guardrail audit.
