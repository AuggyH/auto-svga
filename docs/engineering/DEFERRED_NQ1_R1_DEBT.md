# Deferred NQ1-R1 Engineering Debt

Date: 2026-06-22

## Status

NQ1 and NQ1-R1 work is preserved. It no longer blocks the P6 Web Preview parity mainline.

Do not fake NQ1-R1 PASS in P6. Revisit this debt in a later stability milestone.

## Known Heads

- `agent/codex/nq1-r1-external-repair-2`: `ce0e2a49b3467e1bec1f3c4446bbea3495f4b18d`
- `agent/codex/nq1-r1-external-repair-3`: `2297214afd31fef414984b8500960944e84c952e`

## Deferred Items

- preserve existing NQ code, tests, reports, and review artifacts
- avoid using unfinished NQ1-R1 external handoff issues as a P6 blocker
- do not delete or weaken NQ tests
- revisit deferred debt after P6 parity and desktop internal app are accepted

## P6 Rule

If NQ files are touched by a P6 worker, the worker must explain why. Otherwise, NQ debt remains deferred and untouched.
