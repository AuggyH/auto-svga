# Root-Cause Contract: Promotion Recovery CLI Boundary

## Context
Independent Code Review returned Changes Requested for exact handoff
`d9034fd0102396b065c7482ebf6ce27928698c15`.

- `PKG-STAGING-ROOT-CR-001`: closed.
- `PKG-STAGING-ROOT-CR-002`: open, second consecutive recovery-authority family recurrence.
- Formal review:
  `/Users/huangtengxin/.codex/worktrees/2b43/auto-svga/docs/reviews/2026-07-16-codex-code-re-review-packaging-local-stable-staging-root-repair-cr.md`

## Root Cause
Recovery logic was implemented as an importable/tested helper
`recoverPromotionTransaction()` without a reachable repository-owned production
command boundary. A real interrupted promotion could leave
`promotion-journal.json` or exchange-manifest residue, but operators had no
reviewed CLI mode to converge that durable state.

## Why The Previous Fix Did Not Close It
The previous fix tested source-level fixture recovery by importing
`recoverPromotionTransaction()`, but it did not exercise the actual
`promote-local-stable-app.mjs` CLI dispatch after interruption. Direct parser
probe showed `--recover-promotion` was rejected as an unknown option.

## Repair Contract
Implement one exact repository-owned promotion recovery entrypoint:

- Add strict `--recover-promotion` parsing as a mutually exclusive mode.
- Reject packaging-only flags and rollback-only authority for promotion
  recovery.
- Bind recovery to the durable promotion journal and exchange manifest hash
  authority already written by the promotion transaction.
- Perform deterministic idempotent recovery only for exact byte-role states
  recognized by the journal.
- Fail closed and retain residue when journal, manifest, or role bytes are
  missing, stale, tampered, or ambiguous.
- Verify installed/previous byte roles through existing bundle inspection; do
  not start a new promotion, rebuild, install, rollback, LaunchServices
  registration, or target-parent pre-staging write.

## Failure-First Probes
Focused temp-fixture tests must cover:

- CLI dispatch accepts `--recover-promotion` and rejects mode conflicts.
- Interrupted exchange phases are recoverable through the CLI path, not only by
  importing the helper.
- Journal/manifest hash mismatch keeps the journal and fails closed.
- Replay/idempotence: after successful recovery and cleanup, a second recovery
  invocation fails as no journal exists rather than starting new work.
- Missing target parent still fails before source inspection/staging, proving
  the CLI repair does not reopen pre-staging writes.

## Stops
Success stop:
- focused source tests pass through the CLI recovery path;
- syntax, diff check, JSONL parse, package-lock/media scans pass;
- review packet is stable;
- tracked worktree is clean after commit.

Failure stop:
- recovery cannot be made reachable without broadening into install/promotion,
  rollback, owner app inspection, LaunchServices, foreground, or external
  approval;
- any test requires real `/Users/huangtengxin/Applications` mutation;
- recovery accepts untrusted journal/manifest/role state or deletes residue on
  ambiguity.

## Evidence Boundary
This root-cause contract authorizes source/test repair only. It is not an
install, promotion, rollback, QA route, Product Owner acceptance, support,
distribution, signing/notarization, or release-readiness claim.
