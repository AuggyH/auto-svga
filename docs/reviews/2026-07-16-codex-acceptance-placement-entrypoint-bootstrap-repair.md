# Acceptance Placement Entrypoint Bootstrap Repair

Date: 2026-07-16

## Summary

Repaired the remaining ASV-QA-20260714-001 Permit093 startup proof/no-process boundary at source level.
The rejected installed build `5019ec4725f7af077b82b5108d60543bafd1717a` could still exit before writing
`acceptance-startup-placement-proof.json` because the bootstrap writer was installed only after local
module loading and multiple top-level initializers. If any packaged main-process require or early initializer
failed, QA would see exactly the Permit093 shape: empty `launch.log`, no placement proof, and no target process.

This successor installs a minimal acceptance-startup fatal guard immediately after Electron is available and
before the first local `require("./...")`. It writes a bounded, path-redacted rejected placement proof for
acceptance-display launches on uncaught entrypoint exceptions or unhandled entrypoint rejections. The guard is
released after the existing `app.whenReady().then(createExperimentWindow).catch(...)` path is installed, so it
does not become a broad runtime exception policy.

## Authority And Evidence

- Route: ASV-REQ-20260709-003 / ASV-QA-20260714-001 Permit093 source investigation.
- QA fact-source: `4edffa2022a230c2995e8ee337e653ed70818366`.
- QA report: `docs/quality/reports/ASV-QA-20260714-001-permit-093-placement-proof-missing.md`.
- QA evidence SHA-256: `657894b665bba1c37e2832bf835416b8d4cda85f4c2e194f023827ae0022fd1f`.
- Starting head: `5019ec4725f7af077b82b5108d60543bafd1717a`.
- Successor branch: `codex/0.2-acceptance-placement-entrypoint-bootstrap-20260716`.
- Product diff SHA-256: `de19b7d47f12d55cf587a51be238bfd5936e0ee65e30dbe7eb8f67ac441be202`.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs`
- `docs/reviews/2026-07-16-codex-acceptance-placement-entrypoint-bootstrap-repair.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/asv-qa-20260714-001-acceptance-placement-entrypoint-bootstrap-repair-20260716/*`

## Implementation Notes

- Moved strict acceptance display argument parsing, acceptance-launch detection, bootstrap failure artifact writing,
  and fatal entrypoint handlers above all local source-module imports.
- The early proof writer uses only built-in modules, Electron `app`, environment variables, process argv, and an early
  runtime instance id. It does not depend on `productArtifactIndex`, packaged build-info reads, or redaction helpers
  that may not have initialized yet.
- The writer uses exclusive `openSync(..., "wx", 0o600)` and fsyncs the proof file. It never overwrites an existing
  proof for the same artifact root.
- The proof remains bounded: no raw file paths, no screenshots, no AX tree, no material names, and no owner placement
  preference mutation.
- Normal owner launch placement persistence and the existing owner-bound picker repair are unchanged.

## Validation

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: PASS.
- `node --check tools/electron-prototype/experiments/svga-web/acceptance-startup-placement-proof.cjs`: PASS.
- Focused placement/picker/source group: PASS `13/13`.
- `npm run build`: PASS.
- `npm run test:all`: PASS `538/538`.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`: PASS.
- `node --test tools/electron-prototype/experiments/svga-web/tests/*.test.mjs`: initial local run FAIL `133/135`
  only because this worktree lacks `@electron/asar`.
- Hash-matched read-only dependency rerun using d657 `NODE_PATH`: PASS `135/135`.
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:proof:mac`: FAIL because local
  `.artifacts/internal-trial` contains stale package bytes with buildCommit `9e99f750...`, not this source head.
  No rebuild or package mutation was authorized, so this is recorded as a stale local artifact limit, not a source PASS.

## Boundaries

No Electron, Auto SVGA, Finder, native chooser, foreground, screenshot, install, package, promotion, QA, or Code Review
route was run by this implementation worker. This is source-only Implementation Ready evidence, not installed QA,
Product Owner acceptance, support, distribution, or release readiness.

## Retrospective

The previous repair added durable proof for rejected placement and `whenReady()` failures, but left the writer after
local module imports. The failing installed shape showed the bootstrap evidence boundary must be placed at the
entrypoint, before any project-local require can fail. Future first-frame or acceptance startup work should explicitly
test the first local require boundary, not only the `whenReady()` boundary.
