# M2-R1: Review Handoff Integrity Repair

Status: archived
Milestone start commit: `e412c3e1b5b45f992fec8acdda9c55230f831614`
Final implementation commit: `df49afb8e19097d1228f1a40091835984da1022a`
Branch: `agent/codex/macos-internal-electron-trial`
M1 base commit: `811498c0f278f1c6b8c38cf22c928df7d593bd36`
M1 first commit: `8ccc0cb55801099a8320c5d2f3b3307af86f4bff`
M1 final commit / M2 start commit: `e412c3e1b5b45f992fec8acdda9c55230f831614`
M2 pre-repair tip: `312bbe463e24df03c1c32e50d0b0add6695c51dc`

## Objective

Repair the standardized review handoff system so a future reviewer can use the generated Review Packet as the primary artifact without asking for missing diffs, mixed milestone history, hidden reviewer files, or ambiguous status interpretation.

This milestone does not start a new product feature. It repairs M2 handoff integrity.

## Required Outputs

Generate both packets before terminal PASS:

```text
.artifacts/loop-handoff/M1-<m1-final-short-sha>/REVIEW_PACKET.md
.artifacts/loop-handoff/M2-R1-<current-head-short-sha>/REVIEW_PACKET.md
```

The M1 packet is a retrospective reference packet. The M2-R1 packet is the current implementation packet.

## Acceptance Criteria

- `M2-R1-AC-01`: schema v2 separates packet status, milestone outcome, evidence completeness, retrospective validation/reviewer evidence, generation commits, and clean workspace state.
- `M2-R1-AC-02`: small diffs are fully embedded in `REVIEW_PACKET.md`; large diffs set `companionRequired: true` and list `changes.patch` as mandatory companion.
- `M2-R1-AC-03`: acceptance evidence uses milestone-specific IDs and rejects generic A1/A2/A3 evidence.
- `M2-R1-AC-04`: M1 retrospective acceptance evidence uses M1-AC-01 through M1-AC-08, marks derived retrospective evidence, and does not claim original unavailable evidence.
- `M2-R1-AC-05`: implementation summary comes from milestone-specific handoff input, not generic generator prose.
- `M2-R1-AC-06`: loop history is machine-filtered by `milestoneId`; M1 packet excludes M2 and M2-R1 history.
- `M2-R1-AC-07`: changed file purposes are specific and placeholder purposes fail generation.
- `M2-R1-AC-08`: PASS generation requires passing validation and reviewer A/B PASS reports for current milestones.
- `M2-R1-AC-09`: final response upload list includes only `REVIEW_PACKET.md`, `changes.patch` when required, and visual artifacts when required; it does not ask for manifest, validation, reviewer files, or files directory.
- `M2-R1-AC-10`: corrected M1 retrospective reference packet and M2-R1 current packet are generated after commit and validation.

## Required Tests

`tools/loop-handoff.test.mjs` must cover at least:

1. PASS packet generation.
2. v2 metadata fields.
3. Inline small diff behavior.
4. Large diff companion behavior.
5. Milestone-specific acceptance IDs.
6. M1 retrospective explicit M1 acceptance IDs.
7. M1 retrospective rejection of M2 evidence contamination.
8. Input-driven implementation summary.
9. Milestone-filtered loop history.
10. Placeholder file purpose rejection.
11. Reviewer A/B requirement.
12. Validation summary requirement.
13. base/head input mismatch rejection.
14. Self-contained final upload list.
15. Stable artifact ordering and hashes.
16. Sensitive path exclusion.
17. Binary file indexing.
18. Reviewer and validation preservation.
19. HUMAN_REQUIRED bounded decision file.
20. PASS dirty workspace rejection.
21. HUMAN_REQUIRED tracked/untracked inclusion.
22. Contract mismatch rejection.
23. Failure-path isolation.

## Completion Gates

Before `PASS`:

1. Handoff targeted tests pass.
2. `npm run loop:validate` passes twice consecutively.
3. Corrected M1 retrospective packet is generated.
4. M2-R1 current packet is generated.
5. Reviewer A performs read-only code/packet review and returns PASS.
6. Reviewer B simulates an external consumer using only the files listed in `FINAL_RESPONSE.txt` and returns PASS.
7. Source workspace is clean except ignored artifacts.
8. Final response is exactly `.artifacts/loop-handoff/latest/FINAL_RESPONSE.txt`.

## Prohibited

Do not:

1. Start a new product feature milestone.
2. Modify product runtime code.
3. Modify SVGA output behavior.
4. Modify Web or Electron product behavior.
5. Add dependencies.
6. Push, merge, release, or deploy.
7. Fabricate historical validation logs or reviewer text.
8. Pack real user assets.
9. Ask the user to collect unlisted companion files.
