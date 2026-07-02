# 2026-07-02 Codex Short-Term Recent Store Load Guard

## Summary

Hardened the short-term recent-file persistence boundary so malformed
`recentStore.load()` results recover to an empty recent list instead of
throwing during session creation.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base head before commit: `9e51194e7264fac6080736bb23ed8a4d47c2b480`
- Untracked file intentionally left unstaged: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-recent-persistence.ts`
- `src/tests/short-term-node-recent-files-store.test.ts`

## Requirement Checks

- PRD alignment: supports S16 recent-file recovery and S1 launch stability.
- Runtime safety: malformed store values such as `null` or non-array `records`
  now resolve to a launch state with no recent rows.
- Scope control: no UI shell wiring, product-scope expansion, sequence repair,
  or persistence format change.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-node-recent-files-store.test.js dist/tests/short-term-host-session.test.js`

## Risks

- Malformed recent-store data is silently ignored, matching the existing
  invalid-json soft-failure behavior.

## Next Steps

- Continue auditing host/session boundaries for malformed runtime payloads,
  mutation-safe snapshots, and path-redacted persistence diagnostics.
