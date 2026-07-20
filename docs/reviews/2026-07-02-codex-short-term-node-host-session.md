# Codex Review: Short-Term Node Host Session

## Summary

Added a Node composition entry point for the short-term host session. It
combines the Node file/inspection host environment, optional JSON recent-file
store, and the host-neutral session controller behind one creation function.

This is main-engineering contract work only. It does not wire real behavior
into the temporary UI/UX shell.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `54889f35 feat: add short-term host session controller`
- Unrelated untracked file left untouched: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/hosts/short-term-node-host-session.ts`
  - Added `createShortTermNodeHostSession`.
  - Uses an explicit `recentStorePath` instead of choosing OS-specific storage
    locations inside the core module.
- `src/tests/short-term-node-host-session.test.ts`
  - Covers real temporary SVGA open, recent JSON persistence, restored session
    recent rows, recent reopen, path redaction, and no-store fallback.

## Requirement Checks

- Mainline priority: P7 desktop-client preparation plus P1 infrastructure.
- PRD alignment: S1 local open and S16 recent file persistence/reopening.
- No UI shell wiring, UI polish, telemetry, network dependency, external AI, or
  platform-specific default storage path.
- No parser, preview, optimization algorithm, replacement workflow, sequence
  repair, or product-scope behavior change.

## Verification

- `npm run build` passed.
- Targeted tests passed: `node --test dist/tests/short-term-node-host-session.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-node-host-environment.test.js dist/tests/short-term-node-recent-files-store.test.js`
  - Result: 9 tests passed.
- Full validation passed: `npm run test:all`
  - Result: 319 tests passed.

## Risks

- The module intentionally requires the eventual native host to provide the
  recent-store path. A later Electron/macOS wrapper should own app-support
  directory selection and migration policy.

## Next Steps

- When the real UI/UX shell exposes stable integration points, connect native
  file dialogs and menu events to this Node session instead of calling lower
  layers directly.
