# Standardized Review Handoff Contract v2

Date: 2026-06-19

## Purpose

Every terminal loop state must produce a fixed Review Packet before Codex returns `PASS` or `HUMAN_REQUIRED`. Chat summaries do not replace the packet.

The v2 contract separates:

- `packetStatus`: whether the packet itself is complete.
- `milestoneOutcome`: whether the milestone passed, requires a human decision, or failed.
- `evidenceCompleteness`: whether current or historical evidence is complete.
- retrospective evidence fields: whether validation and reviewer evidence existed at the original milestone time.

A single `status` field must not be reused for all meanings.

## Required Packet Root

Each handoff run writes:

```text
.artifacts/loop-handoff/<milestone-id>-<head-short-sha>/
```

and updates:

```text
.artifacts/loop-handoff/latest/
```

The packet root contains:

- `REVIEW_PACKET.md`
- `MANIFEST.json`
- `changes.patch`
- `validation.json`
- `reviewer-a.md`
- `reviewer-b.md`
- `artifact-index.json`
- `FINAL_RESPONSE.txt`
- `files/`
- `decisions/`

## Required v2 Metadata

`REVIEW_PACKET.md` and `MANIFEST.json` must include:

- `schemaVersion: 2`
- `packetStatus`
- `milestoneOutcome`
- `evidenceCompleteness`
- `historicalValidationEvidence`
- `historicalReviewerEvidence`
- `retrospectiveRevalidation`
- `retrospectiveReviewerStatus`
- `retrospective`
- `reviewedBaseCommit`
- `reviewedHeadCommit`
- `generatorCommit`
- `repositoryHeadAtGeneration`
- `workspaceCleanAtGeneration`
- `companionRequired`
- `mandatoryCompanions`

## Rules

1. `REVIEW_PACKET.md` is the required human-readable entrypoint.
2. If `changes.patch` is at most 1,000,000 bytes and at most 5,000 lines, `REVIEW_PACKET.md` must embed the full unified diff.
3. If the diff exceeds either limit, `companionRequired` must be `true`, `mandatoryCompanions` must include `changes.patch`, and `FINAL_RESPONSE.txt` must explicitly ask the user to upload `changes.patch`.
4. All changed text files must have snapshots in `files/`.
5. Binary files are indexed by size and sha256 only.
6. `node_modules`, `.git`, `.env`, Electron `.runtime`, unrelated ignored files, and real external user assets must not be packed.
7. `PASS` packets require a clean tracked/untracked source workspace.
8. `PASS` packets require a passing validation summary and reviewer A/B PASS reports unless the packet is explicitly retrospective.
9. `HUMAN_REQUIRED` packets may include uncommitted work but must include the current actual state and one bounded human decision.
10. Packet files must be stable and locally generated without network access or third-party dependencies.
11. Acceptance evidence must use milestone-specific IDs. Generic `A1`, `A2`, `A3` IDs are not allowed.
12. A future milestone contract must define explicit acceptance IDs. Missing acceptance mapping fails PASS generation.
13. Retrospective packets may derive acceptance IDs from the frozen contract, but must mark `derivedFromFrozenContract: true` and must not fabricate historical validation or reviewer evidence.
14. Loop history must be machine-filterable by `milestoneId`; cross-milestone history must not leak into a packet.
15. File purpose entries must be milestone-specific and must not use placeholders such as `changed file`, `miscellaneous`, `update`, or `change for milestone`.
16. Handoff input JSON is the source of implementation summary, acceptance evidence, validation run summary, risks, and next milestone recommendation. The generator must not invent conclusions.

## Required Review Packet Sections

`REVIEW_PACKET.md` must contain:

1. Review Request
2. Frozen Milestone Contract
3. Implementation Result
4. Git State
5. Changed Files
6. Full Diff
7. Changed File Snapshots
8. Acceptance Evidence
9. Validation Evidence
10. Independent Reviewer Reports
11. Loop History
12. Remaining Risks And Gaps
13. Artifact Index
14. Human Decision
15. Recommended Next Milestone

## Self-contained Upload Contract

The final chat response must be exactly `FINAL_RESPONSE.txt`.

For PASS:

```text
PASS

REVIEW_PACKET_READY

UPLOAD_TO_REVIEW_ASSISTANT:
1. <absolute path to current REVIEW_PACKET.md>
2. <changes.patch only when companionRequired true>
3. <visual artifacts only when humanReviewRequired true>

OPTIONAL_REFERENCE:
- <absolute path to corrected retrospective REVIEW_PACKET.md, if any>

Do not upload:
- MANIFEST.json
- validation.json
- reviewer reports
- files directory
unless explicitly listed above.
```

For HUMAN_REQUIRED, use the same upload section and add one bounded `Question` and `Recommendation`.

Do not ask the user to upload `MANIFEST.json`, `validation.json`, reviewer reports, or `files/` unless `FINAL_RESPONSE.txt` explicitly lists them.
