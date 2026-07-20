# Figma MCP Standing Budget Authorization

Date: 2026-07-08
Agent: Codex
Branch: `agent/codex/short-term-preview-qa-20260708`
Status: ready

## Summary

Updated the UI/UX Figma MCP operating protocol to record the Owner's standing
authorization rule for quota-safe reads.

The UI/UX lane may now call Figma MCP without separate per-batch permission
while the current local-day conservative usage count remains below the
160-read practical safety budget. The lane must still plan each batch, set a
hard cap, record actual usage, and stop when the budget or hard cap is reached.

## Changed Files

- `docs/research/figma-mcp-uiux-call-protocol.md`

## Requirement Checks

- Product scope changed: no.
- Figma file changed: no.
- Figma MCP calls made: no.
- Figma Make / AI credits used: no.
- Owner rule recorded: yes.

## Verification

- `git diff --check -- docs/research/figma-mcp-uiux-call-protocol.md` passed.

## Notes

Existing parallel PM/QA dirty files were not staged or committed.

## Project Retrospective

This update reduces repeated authorization friction without removing quota
control. The important constraint is that "safe budget" is reconstructed from
the local call log before each batch; if the log is ambiguous, the lane must ask
the Owner before reading.

Token usage source: unavailable in local tooling.
