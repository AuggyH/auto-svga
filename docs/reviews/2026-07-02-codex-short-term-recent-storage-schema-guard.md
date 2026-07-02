# Short-Term Recent Storage Schema Guard

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous

## Summary

Hardened the short-term Recent Files storage parser so it only accepts the
current v1 schema. Unsupported or stale schema versions now fall back through
the existing safe fallback path instead of silently importing records from an
unknown storage shape.

## Git State

- Base head before task: f17629ae
- Unrelated untracked file intentionally untouched:
  `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-recent-files.ts`
- `src/tests/short-term-recent-files.test.ts`

## Requirement Checks

- S16 recent-file persistence stays versioned and fail-closed.
- Renderer-facing recent-file views remain path-redacted.
- No UI shell, product scope, or layout behavior was changed.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-recent-files.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-workbench-facade.test.js`

## Risks / Next Steps

- Low risk; unsupported stored schemas now require fallback data or an empty
  recent list.
- Next useful mainline task: continue reviewing host/session persistence
  boundaries for stale state and renderer-safe payload drift.
