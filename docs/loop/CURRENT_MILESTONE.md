# M2: Standardized Review Handoff Contract

Status: active
Milestone start commit: `e412c3e1b5b45f992fec8acdda9c55230f831614`
Branch: `agent/codex/macos-internal-electron-trial`
M1 first commit: `8ccc0cb55801099a8320c5d2f3b3307af86f4bff`
M1 final commit: `e412c3e1b5b45f992fec8acdda9c55230f831614`
M1 base commit: `811498c0f278f1c6b8c38cf22c928df7d593bd36`

## Objective

Create a no-dependency standardized review handoff system that generates complete Review Packets for `PASS` and `HUMAN_REQUIRED` terminal loop states.

Add:

```bash
npm run loop:handoff
```

The command must generate packet files an external reviewer can use without asking the user to collect diffs, validation summaries, reviewer reports, or changed file evidence.

## Required Outputs

Each handoff run writes:

```text
.artifacts/loop-handoff/<milestone-id>-<head-short-sha>/
  REVIEW_PACKET.md
  MANIFEST.json
  changes.patch
  validation.json
  reviewer-report.md
  artifact-index.json
  FINAL_RESPONSE.txt
  files/
  decisions/
```

and updates:

```text
.artifacts/loop-handoff/latest/
```

`.artifacts/loop-handoff/` must be ignored by Git.

## Packet Contract

`REVIEW_PACKET.md` must contain:

1. Stable metadata.
2. Review Request.
3. Frozen Milestone Contract with full current milestone text.
4. Implementation Result.
5. Git State.
6. Changed Files.
7. Full Diff or mandatory `changes.patch` reference.
8. Changed File Snapshots.
9. Acceptance Evidence.
10. Validation Evidence.
11. Independent Reviewer Report with original reviewer text.
12. Loop History.
13. Remaining Risks And Gaps.
14. Artifact Index.
15. Human Decision.
16. Recommended Next Milestone.

`MANIFEST.json` must have `schemaVersion: 1` and stable sorted arrays.

`FINAL_RESPONSE.txt` must be the only final chat response content for terminal states.

## Command Interface

The command must support at least:

```bash
npm run loop:handoff -- --status PASS --milestone M2 --base <milestoneStartCommit> --head HEAD
npm run loop:handoff -- --status HUMAN_REQUIRED --milestone <id> --base <milestoneStartCommit>
```

It must also support enough options to provide milestone title, contract path, validation summary path, reviewer report path, human decision file, and retrospective mode.

## Required Tests

Tests must cover:

1. PASS packet generation.
2. HUMAN_REQUIRED packet generation.
3. PASS fails on dirty tracked workspace.
4. HUMAN_REQUIRED includes tracked and untracked work.
5. Accurate base..head diff range.
6. Required Review Packet sections.
7. `MANIFEST.json` schemaVersion 1.
8. Stable file and artifact ordering.
9. sha256 correctness.
10. `.runtime`, `node_modules`, `.git`, `.env`, and sensitive files excluded.
11. Text snapshots complete.
12. Binary files indexed as binary.
13. Reviewer original text preserved.
14. `validation.json` matches loop validation summary.
15. Stable `FINAL_RESPONSE.txt`.
16. Missing mandatory content exits non-zero.
17. No network dependency.
18. No third-party dependency.
19. Failure-path tests do not modify the real repository.

## M1 Retrospective Packet

After implementing the handoff tool, generate a retrospective M1 packet:

- milestone: `M1`
- base: `811498c0f278f1c6b8c38cf22c928df7d593bd36`
- head: `e412c3e1b5b45f992fec8acdda9c55230f831614`
- first commit: `8ccc0cb55801099a8320c5d2f3b3307af86f4bff`
- retrospective: `true`

The packet must distinguish M1 evidence that existed at the time from M2-generated packaging. Missing historical evidence must be marked `not_available`.

## Completion Gates

Before `PASS`:

1. Handoff tests pass.
2. `npm run loop:validate` passes twice consecutively.
3. Reviewer A returns PASS.
4. Reviewer B returns PASS using only the generated M1 packet.
5. M1 retrospective packet is generated.
6. M2 packet is generated for final committed HEAD.
7. Source workspace is clean except ignored artifacts.
8. Final response is exactly `.artifacts/loop-handoff/latest/FINAL_RESPONSE.txt`.

## Prohibited

Do not:

1. Modify product code.
2. Modify SVGA output behavior.
3. Modify Web or Electron product positioning.
4. Add dependencies.
5. Add lint or formatter tooling.
6. Push, merge, release, or deploy.
7. Delete or rewrite M1 historical evidence.
8. Fabricate historical logs or reviewer text.
9. Pack real user assets.
10. Ask the user to run commands.
11. Use chat summary as a substitute for Review Packet.
