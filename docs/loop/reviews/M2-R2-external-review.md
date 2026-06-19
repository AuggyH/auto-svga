# M2-R2 External Review

externalOutcome: REPAIR_REQUIRED

reviewedHeadCommit: `676fee3051a8e9cc80defa550a8db7b6bb796240`

reviewedBaseCommit: `df49afb8e19097d1228f1a40091835984da1022a`

branch: `agent/codex/m2-r2-terminal-handoff-hardening`

## Blocking Findings

1. PASS packet Full Diff was rewritten by a generic content regex.
   Ordinary source lines such as `const token = argv[index];` and
   `const token = tokens[index++];` were replaced with redacted content, so the
   packet no longer contained the true source diff.
2. `candidateDigest` was bound to the redacted packet diff instead of the exact
   Git source diff for safe paths.
3. `parsePorcelainZ` may reverse `oldPath` and `newPath` for
   `git status --porcelain=v1 -z` rename/copy output.
4. Repository paths passed to Git operations did not uniformly force literal
   pathspec semantics, so special filenames could be interpreted as pathspec
   magic.
5. `LOOP_STATE.md` marked `terminal_pass` while its next action still requested
   final validation, candidate generation, reviewer collection, and sealing.
6. M2-R2 recorded repair round 6, exceeding the intended budget before the
   loop had machine-enforced budget checking.
7. The high-risk findings above do not require a product decision and should be
   repaired by Codex.

## Protocol Exception

M2-R2 exceeded the intended repair budget before machine-enforced loop budget
checking existed. Historical records must not be rewritten or falsified.
