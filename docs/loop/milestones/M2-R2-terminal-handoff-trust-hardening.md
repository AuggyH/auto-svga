# M2-R2: Terminal Handoff Trust Hardening

Milestone ID: M2-R2
Status: frozen
Milestone start commit: `df49afb8e19097d1228f1a40091835984da1022a`
Branch: `agent/codex/m2-r2-terminal-handoff-hardening`
External review reference: `docs/loop/reviews/M2-R1-external-review.md`

## Objective

Harden terminal Review Packet generation so `PASS` and `HUMAN_REQUIRED`
handoffs are internally consistent, bound to the reviewed HEAD, safe from
sensitive-content leakage, and independently verifiable by an external reviewer.

This milestone repairs Agent Loop infrastructure only. It does not start a
product feature milestone.

## Allowed Changes

1. `docs/loop/**` loop protocol, milestone, state, history, review, and contract documentation.
2. `.codex/agents/reviewer.toml` reviewer configuration.
3. `tools/loop-handoff.mjs` and `tools/loop-handoff.test.mjs`.
4. `tools/loop-validate.mjs` and `tools/loop-validate.test.mjs`.
5. New loop-only helper scripts under `tools/`.
6. `package.json` only for loop validation script wiring if required.

## Prohibited Changes

1. Product runtime code.
2. SVGA export semantics or bytes.
3. Web preview player behavior.
4. Electron product boundary.
5. Examples, schemas, templates, or generated design assets.
6. Runtime dependencies.
7. New product features.
8. Push, merge, release, publish, or deploy.

## Acceptance Criteria

- `M2-R2-AC-01`: `.codex/agents/reviewer.toml` is syntactically valid by the project-supported checker, keeps read-only permissions, and includes `scope drift` plus `review handoff completeness` in `must_check`.
- `M2-R2-AC-02`: `PASS` and `HUMAN_REQUIRED` packet generation fails unless `docs/loop/LOOP_STATE.md`, the last `LOOP_HISTORY.jsonl` record for the milestone, and packet milestone outcome agree.
- `M2-R2-AC-03`: reviewer verdicts are read from structured JSON only; free-text Markdown cannot change `PASS` or `BLOCKING`.
- `M2-R2-AC-04`: reviewer JSON must bind `reviewedHeadCommit` and `candidateDigest`, reject conditions, reject blocking findings, and match reviewer file role.
- `M2-R2-AC-05`: packet generation uses candidate, review, and seal phases; final seal verifies latest pointer, digest binding, upload files, companion policy, recomputable hashes, and clean tracked source state.
- `M2-R2-AC-06`: current non-retrospective `PASS` requires validation schema v2 with start/finish HEAD equal to `reviewedHeadCommit`, clean source workspace at start/finish, `status=pass`, and all required steps passing.
- `M2-R2-AC-07`: `PASS` records and passes `git diff --check <baseCommit>..<headCommit>`; `HUMAN_REQUIRED` records base-range, worktree, and cached diff checks separately.
- `M2-R2-AC-08`: patch, snapshot, packet, manifest, artifact index, and files output are generated only from a safe path set; sensitive/protected paths fail `PASS` and are redacted for `HUMAN_REQUIRED`.
- `M2-R2-AC-09`: repo input paths resolve inside the repository, reject traversal, use `lstat`, and never follow symlinks outside the repository for snapshots.
- `M2-R2-AC-10`: `HUMAN_REQUIRED` uses a structured single-question decision with at least two bounded options, impacts, recommendation, evidence, and safe default; `FINAL_RESPONSE.txt` prints the actual question and recommendation.
- `M2-R2-AC-11`: packet schema v3 enforces status enums and field combinations; current packets use `retrospective=false` plus `NOT_APPLICABLE` retrospective fields.
- `M2-R2-AC-12`: frozen contract parsing extracts exact milestone ID, acceptance criterion IDs, and criterion requirement text; acceptance evidence IDs and requirement hashes must match exactly.
- `M2-R2-AC-13`: `npm run loop:validate` includes required `handoff-tests` and `reviewer-config-check` steps in stable sequential order.
- `M2-R2-AC-14`: targeted handoff tests cover terminal consistency, structured reviewer verdicts, validation HEAD binding, diff-check range, sensitive redaction, symlink/path traversal, human decision output, schema semantics, contract mapping, candidate digest, seal verifier, and failure isolation.
- `M2-R2-AC-15`: final M2-R2 packet is generated from the final committed source HEAD after two successful `npm run loop:validate` runs and reviewer A/B JSON verdicts bound to that candidate digest.

## Required Validation

Before terminal `PASS`:

1. `node --test tools/loop-handoff.test.mjs` passes.
2. Reviewer config check passes.
3. `npm run loop:validate` passes twice consecutively on the final committed source HEAD.
4. Reviewer A JSON verdict is `PASS`, bound to final source HEAD and candidate digest.
5. Reviewer B JSON verdict is `PASS`, bound to final source HEAD and candidate digest.
6. Post-seal verifier passes.
7. `git status --short` has no tracked or untracked source changes.
8. Final response is exactly `.artifacts/loop-handoff/latest/FINAL_RESPONSE.txt`.

## Required Tests

`tools/loop-handoff.test.mjs` must cover at least:

1. reviewer config validation.
2. terminal state/history consistency.
3. terminal history final result enforcement.
4. reviewer JSON head mismatch rejection.
5. reviewer JSON candidate digest mismatch rejection.
6. reviewer JSON conditions rejection for `PASS`.
7. free-text `PASS`, `FAIL`, or `BLOCKING` not affecting verdict.
8. stale validation HEAD rejection.
9. validation start/finish HEAD mismatch rejection.
10. committed diff whitespace error detection.
11. nested secret exclusion from all packet files.
12. raw patch generation only from safe paths.
13. symlink snapshot safety.
14. repo path traversal rejection.
15. paths with spaces, rename, and copy handling.
16. concrete `HUMAN_REQUIRED` final response question.
17. CLI status and milestone outcome consistency.
18. current packet retrospective fields.
19. exact contract ID parsing.
20. acceptance evidence missing, extra, or hash mismatch rejection.
21. candidate digest changes when critical evidence changes.
22. final seal only adds allowed seal content.
23. latest pointer verifier failure.
24. `loop:validate` includes handoff and reviewer config checks.
25. failure tests use temporary repositories only.

## Completion Gates

1. Archive M2-R1 contract and record M2-R1 external review.
2. Freeze this M2-R2 contract before implementation changes.
3. Repair loop handoff and validation code.
4. Run targeted tests.
5. Run preliminary `npm run loop:validate`.
6. Update loop state/history to terminal `PASS` for M2-R2.
7. Commit final tracked source.
8. Run two final `npm run loop:validate` runs on the final source HEAD.
9. Generate candidate packet.
10. Obtain reviewer A/B structured JSON verdicts.
11. Seal final packet.
12. Run post-seal verifier.
13. Confirm clean workspace.
14. Return final response verbatim from generated `FINAL_RESPONSE.txt`.
