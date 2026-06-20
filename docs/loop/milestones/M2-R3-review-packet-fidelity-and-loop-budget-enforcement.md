# M2-R3: Review Packet Fidelity And Loop Budget Enforcement

Milestone ID: M2-R3
Title: Review Packet Fidelity And Loop Budget Enforcement
Status: frozen
Milestone start commit: `676fee3051a8e9cc80defa550a8db7b6bb796240`
Branch: `agent/codex/m2-r2-terminal-handoff-hardening`
External review reference: `docs/loop/reviews/M2-R2-external-review.md`

maxRepairRounds: 2
maxConsecutiveNoProgressRounds: 1

## Objective

Ensure future `PASS` and `HUMAN_REQUIRED` Review Packets preserve exact safe
source diffs, bind reviewer evidence to the true source diff, handle literal
Git paths and rename/copy records correctly, keep terminal state consistent,
and stop automatically when the frozen loop repair budget is exhausted.

This milestone repairs Agent Loop infrastructure only. It does not start a
product feature milestone.

## Allowed Changes

1. `docs/loop/**` loop protocol, milestone, state, history, review, and
   contract documentation.
2. `.codex/agents/reviewer.toml` reviewer configuration.
3. `tools/loop-handoff.mjs` and `tools/loop-handoff.test.mjs`.
4. `tools/loop-validate.mjs` and `tools/loop-validate.test.mjs`.
5. `tools/loop-budget-check.mjs` and `tools/loop-budget-check.test.mjs`.
6. New loop-only helper scripts under `tools/`.
7. `package.json` only for loop validation script wiring if required.
8. `AGENTS.md` only for short persistent loop-budget and final-packet rules.
9. `.gitignore` only for loop-generated artifacts.

## Prohibited Changes

1. Product runtime code.
2. SVGA export semantics or bytes.
3. Web preview player behavior.
4. Electron product boundary.
5. Examples, schemas, templates, proto files, or generated design assets.
6. Runtime dependencies.
7. New product features.
8. Push, merge, release, publish, or deploy.

## Acceptance Criteria

- `M2-R3-AC-01`: `PASS` packets preserve byte-exact safe source diffs: `changes.patch` equals `git --literal-pathspecs diff --binary --no-ext-diff --no-textconv <base>..<head> -- <safe-literal-paths>`, embedded Full Diff equals `changes.patch` when inline thresholds allow, `diffFidelity=EXACT`, and `sourceDiffSha256 == packetDiffSha256`.
- `M2-R3-AC-02`: sensitive path detection and high-confidence content secret detection are separate; `PASS` fails closed before writing packet content for sensitive/protected paths or detected secrets, and no `PASS` diff text is redacted or rewritten.
- `M2-R3-AC-03`: every Git operation that consumes repository paths uses literal path semantics and a `--` separator, preserving paths such as `:(exclude)*`, `:(glob)**`, `file[1].txt`, `--leading-dash.txt`, and `space name.txt`.
- `M2-R3-AC-04`: committed and uncommitted rename/copy parsing preserves true `path` and `oldPath`, covers copy detection and special paths, blocks any sensitive/protected endpoint for `PASS`, and does not leak content in `HUMAN_REQUIRED`.
- `M2-R3-AC-05`: repo input paths and packet output paths remain inside the repository or allowed `.artifacts` root, path traversal is rejected, snapshots use `lstat`, and symlink snapshots record link metadata without following targets.
- `M2-R3-AC-06`: terminal state fidelity is enforced: `LOOP_STATE.md`, the last matching `LOOP_HISTORY.jsonl` entry, CLI status, packet outcome, and terminal next action all agree; `terminal_pass` requires `Next Action: external_review`.
- `M2-R3-AC-07`: loop budget checking is machine-enforced from `CURRENT_MILESTONE.md`, `LOOP_STATE.md`, and `LOOP_HISTORY.jsonl`, rejects exceeded or falsified repair/no-progress counts, and is required in `npm run loop:validate`.
- `M2-R3-AC-08`: candidate digest covers reviewed head, contract hash, exact `sourceDiffSha256`, validation hash, acceptance evidence hash, loop state hash, milestone history hash, budget check hash, and changed file index hash.
- `M2-R3-AC-09`: reviewer JSON schema v2 binds Reviewer A to `sourceDiffSha256` and Reviewer B to `packetDiffSha256`; sealing rejects head, digest, diff-hash, condition, blocking-finding, or role mismatches.
- `M2-R3-AC-10`: current non-retrospective `PASS` validation schema v2 or higher is bound to final HEAD at start and finish, starts and finishes with a clean source workspace, passes all required steps, and includes `loop-budget-check`, `handoff-tests`, and `reviewer-config-check`.
- `M2-R3-AC-11`: `PASS` records and passes `git diff --check <baseCommit>..<headCommit>`; `HUMAN_REQUIRED` separately records committed-range, worktree, and cached diff checks with command, status, exit code, and range.
- `M2-R3-AC-12`: Review Packet schema v4 includes computed packet status, evidence completeness, budget fields, exact diff hashes, `diffFidelity`, real array `mandatoryCompanions`, and valid field combinations for `PASS` and `HUMAN_REQUIRED`.
- `M2-R3-AC-13`: `HUMAN_REQUIRED` emits one structured technical-review question with bounded options, impacts, recommendation, non-empty evidence, safe default, and direct `FINAL_RESPONSE.txt` question/recommendation text.
- `M2-R3-AC-14`: `npm run loop:validate` includes required sequential `loop-budget-check` after `handoff-tests` and `reviewer-config-check`, and docs plus AGENTS.md record the budget/final-packet rules without duplicating the full protocol.
- `M2-R3-AC-15`: targeted tests cover diff fidelity, safe secret fail-closed behavior, literal Git paths, rename/copy semantics, symlink/path traversal, terminal state consistency, loop budget enforcement, reviewer/seal bindings, post-seal verifier failures, sensitive output exclusion, and failure isolation.
- `M2-R3-AC-16`: final M2-R3 packet is generated from the final committed source HEAD after two successful `npm run loop:validate` runs and Reviewer A/B schema v2 JSON verdicts bound to the candidate digest and exact diff hashes.

## Required Validation

Before terminal `PASS`:

1. `node --test tools/loop-budget-check.test.mjs` passes.
2. `node --test tools/loop-handoff.test.mjs` passes.
3. `node --test tools/loop-validate.test.mjs` passes.
4. `node tools/loop-reviewer-config-check.mjs` passes.
5. `node tools/loop-budget-check.mjs` passes.
6. Preliminary `npm run loop:validate` passes.
7. Preliminary Reviewer A and Reviewer B find no blocking issues, or blocking
   issues are repaired within budget.
8. Final source state is committed with `terminal_pass` and `Next Action:
   external_review`.
9. Two final `npm run loop:validate` runs pass on the final source HEAD.
10. Candidate packet is generated from the final source HEAD.
11. Reviewer A schema v2 JSON verdict is `PASS`, bound to final source HEAD,
    candidate digest, and `sourceDiffSha256`.
12. Reviewer B schema v2 JSON verdict is `PASS`, bound to final source HEAD,
    candidate digest, and `packetDiffSha256`.
13. Post-seal verifier passes.
14. `git status --short` has no tracked or untracked source changes.
15. Final response is exactly `.artifacts/loop-handoff/latest/FINAL_RESPONSE.txt`.

## Required Tests

`tools/loop-handoff.test.mjs` and `tools/loop-budget-check.test.mjs` must cover:

1. ordinary `token` and `passwordPolicy` source lines are preserved in packet
   diffs.
2. `changes.patch` equals direct literal Git diff bytes.
3. embedded Full Diff equals `changes.patch` when below thresholds.
4. source and packet diff SHA-256 values match for `PASS`.
5. candidate digest changes when source diff bytes change.
6. redaction cannot be silently applied while claiming `EXACT`.
7. high-confidence secrets make `PASS` fail closed.
8. `HUMAN_REQUIRED` sensitive output is `PARTIAL_REDACTED`.
9. porcelain rename and name-status rename/copy parsing preserve true old/new
   semantics.
10. safe-to-sensitive and sensitive-to-safe renames are blocked for `PASS`.
11. literal special paths, leading-dash paths, space paths, and bracket paths
   appear in index, diff, and snapshots without pathspec interpretation.
12. symlinks and traversal do not read outside repository contents.
13. terminal state and next action mismatches fail.
14. repair and no-progress budget violations fail.
15. state repair counts cannot be lower than actual repair history.
16. `loop:validate` includes ordered `loop-budget-check`.
17. reviewer diff-hash/head/digest/condition/blocking mismatches fail seal.
18. post-seal verifier detects latest pointer, upload file, companion,
   tracked-source, and stale validation failures.
19. sensitive paths and secret sentinels never enter packet files.
20. failure-path tests use temporary Git repositories only.

## Completion Gates

1. M2-R2 contract archived unchanged.
2. M2-R2 external Review recorded.
3. M2-R3 frozen contract committed before implementation changes.
4. Exact diff fidelity implemented and tested.
5. Literal Git path handling implemented and tested.
6. Rename/copy semantics implemented and tested.
7. Terminal state and next action enforcement implemented and tested.
8. Loop budget checker implemented, wired into validation, and tested.
9. Reviewer schema v2 and seal bindings implemented and tested.
10. Targeted validation passes.
11. Preliminary `npm run loop:validate` passes.
12. Preliminary independent review passes or findings are repaired within
    budget.
13. Terminal source state committed.
14. Two final `npm run loop:validate` runs pass on the final source HEAD.
15. Final candidate, reviewer JSON, sealed packet, and post-seal verifier pass.
16. Final `FINAL_RESPONSE.txt` is returned verbatim.
