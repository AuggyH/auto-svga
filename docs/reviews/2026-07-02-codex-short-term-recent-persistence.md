# Codex Review: Short-Term Recent Persistence

## Summary

Added the host-side recent-file persistence boundary for the short-term Workbench. The workbench layer now has a small store interface and bridge helpers for creating Host Action state from persisted recent records and saving updated recent state. The Node host layer now has a JSON-backed recent-files store.

This supports S16 without wiring the temporary UI shell. Local paths remain host-private; renderer-facing facade models continue to expose only redacted recent-file views.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `cb9268c2 test: share short-term svga fixtures`
- Unrelated untracked file left untouched: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-recent-persistence.ts`
  - Added `ShortTermRecentFilesStore`.
  - Added helpers to create Host Action state from a store and persist the current facade recent state.
- `src/hosts/short-term-node-recent-files-store.ts`
  - Added JSON-backed Node recent store with fail-soft load, temp-file write then rename, and clear.
- `src/tests/short-term-node-recent-files-store.test.ts`
  - Covers cross-session recent restoration, renderer path redaction after restore, invalid JSON fallback, and clear removing persisted local paths.

## Requirement Checks

- Mainline priority: P7 desktop-client preparation plus P1 infrastructure.
- PRD alignment: S16 recent-file persistence, path-redacted view, clear-history action, and recoverable host state.
- No UI shell wiring, UI polish, telemetry, network dependency, or external AI.
- No parser, optimization, save, sequence repair, or product-scope behavior change.

## Verification

- `npm run build` passed.
- Targeted tests passed: `node --test dist/tests/short-term-node-recent-files-store.test.js dist/tests/short-term-recent-files.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-node-host-environment.test.js`
  - Result: 17 tests passed.
- Full validation passed: `npm run test:all`
  - Result: 313 tests passed.

## Risks

- The store is not wired to a native shell yet. Electron main-process integration remains a later host wiring task.
- The JSON store intentionally contains local paths as host-private data; renderer models must continue to use redacted facade views.

## Next Steps

- Wire the Node host environment and recent store into an Electron main-process adapter once the UI/UX shell exposes stable integration points.
