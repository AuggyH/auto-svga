# Standardized Review Handoff Contract v4

Date: 2026-06-20

## Purpose

Every terminal loop state must produce a fixed Review Packet before Codex
returns `PASS` or `HUMAN_REQUIRED`. Chat summaries do not replace the packet.

The v4 contract hardens trust boundaries:

- terminal state, loop history, and packet outcome must agree
- validation evidence is bound to the exact reviewed HEAD
- reviewer verdicts are structured JSON and bound to a candidate digest
- PASS packet diffs are byte-exact copies of the source Git diff
- patch, snapshot, and Git diff commands use literal pathspecs with `--`
- packet diff hashes are bound separately from source diff hashes
- loop budget evidence is bound into the candidate digest
- loop budget counts are derived from history, not trusted from state alone
- HUMAN_REQUIRED file snapshots are content-classified before packet output
- packet output paths are containment-checked under `.artifacts/loop-handoff`
- `HUMAN_REQUIRED` contains a concrete single question and recommendation

## Packet Root

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
- `changes.patch` only when `companionRequired=true`
- `validation.json`
- `budget-check.json`
- `reviewer-a.json` when sealed
- `reviewer-b.json` when sealed
- `artifact-index.json`
- `FINAL_RESPONSE.txt`
- `files/`
- `decisions/`

## Visible Owner Handoff

The sealed `.artifacts/loop-handoff` packet is the canonical machine packet, but
it is not sufficient as the owner-facing handoff. Each terminal loop handoff
must also expose a visible folder under:

```text
review/<milestone-id>-<head-short-sha>/
```

The visible folder must include at minimum:

- `REVIEW_PACKET.md`
- `README.md`
- `FINAL_RESPONSE.txt`
- `MANIFEST.json`
- `changes.patch` only when `companionRequired=true`
- the owner upload ZIP
- curated product evidence when the milestone requires visual or runtime proof

The final response must include clickable Markdown links to the visible folder,
`REVIEW_PACKET.md`, owner upload ZIP, App ZIP or equivalent product artifact
when present, and required companions. Do not rely only on hidden `.artifacts`
paths.

Visible files copied from `.artifacts/loop-handoff` must be byte-identical to
the sealed canonical files. Do not sanitize, normalize, redact, format, or
rewrite sealed files after seal.

## Required v4 Metadata

`REVIEW_PACKET.md` and `MANIFEST.json` must include:

- `schemaVersion: 4`
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
- `candidateDigest`
- `sourceDiffSha256`
- `packetDiffSha256`
- `diffFidelity`
- `budgetStatus`
- `repairRound`
- `maxRepairRounds`
- `consecutiveNoProgressRounds`
- `maxConsecutiveNoProgressRounds`
- `companionRequired`
- `mandatoryCompanions` as an array

## Candidate, Review, Seal

1. Candidate generation computes `candidateDigest` from reviewed head,
   contract hash, source diff hash, validation hash, acceptance evidence hash,
   loop state hash, milestone history hash, budget check hash, and changed file
   index hash.
2. Reviewer A and Reviewer B output JSON verdicts only.
3. Reviewer A must bind `sourceDiffSha256`; Reviewer B must bind
   `packetDiffSha256`.
4. Seal validates both reviewer JSON files against reviewed head, candidate
   digest, and diff hashes, then writes the final packet and
   `FINAL_RESPONSE.txt`.
5. Post-seal verification checks latest pointer, upload file existence,
   companion consistency, reviewer digest binding, clean source state, source
   diff hash, packet diff hash, and PASS exact diff fidelity.

Reviewer JSON schema:

```json
{
  "schemaVersion": 2,
  "reviewerId": "A",
  "verdict": "PASS",
  "reviewedHeadCommit": "<full sha>",
  "candidateDigest": "<sha256>",
  "sourceDiffSha256": "<sha256>",
  "packetDiffSha256": "<sha256 for reviewer B>",
  "generatedAt": "<ISO-8601>",
  "conditions": [],
  "findings": []
}
```

Markdown reviewer prose may be kept for humans but must not determine verdict.

## Terminal Consistency

For current non-retrospective packets:

1. `docs/loop/LOOP_STATE.md` must mark the milestone as terminal pass or
   terminal human required.
2. `docs/loop/LOOP_STATE.md` must contain exactly one machine `milestoneId`,
   `State`, and `Next Action` field.
3. `docs/loop/LOOP_STATE.md` terminal `Next Action` must be
   `external_review`.
4. The human-readable `## Next Action` section must not ask for candidate
   generation, validation, repair, review collection, or packet sealing.
5. The last `docs/loop/LOOP_HISTORY.jsonl` entry for the milestone must have
   `iteration: terminal`, `result` equal to the requested terminal outcome,
   `progress: true`, and `nextAction: external_review`.
6. Packet `milestoneOutcome` must match CLI status and loop terminal state.

## Validation Binding

Current `PASS` packets require validation `schemaVersion: 2` with:

- `repositoryHeadCommitAtStart`
- `repositoryHeadCommitAtFinish`
- `sourceWorkspaceCleanAtStart`
- `sourceWorkspaceCleanAtFinish`
- `status`
- `steps`
- `knownGaps`

Start and finish HEAD must equal `reviewedHeadCommit`; both source clean fields
must be true; every required step must pass.

Current `PASS` packets also require `budget-check.json` with:

- `schemaVersion: 1`
- `status: pass`
- `milestoneId`
- `budgetStatus: within_budget`
- `repairRound`
- `maxRepairRounds`
- `consecutiveNoProgressRounds`
- `maxConsecutiveNoProgressRounds`

`loop-budget-check` is a required sequential validation step after
`handoff-tests` and `reviewer-config-check`.

The budget checker derives `repairRound` and `consecutiveNoProgressRounds`
from `docs/loop/LOOP_HISTORY.jsonl`. State values must match the derived
values. New repair history entries require `progress: true | false`; only
legacy `repair-1` PASS entries with non-empty evidence may be treated as
progress for migration. `nextRepairAllowed` is true only when repair rounds and
no-progress rounds are strictly below the frozen limits and validation has no
errors.

## Safe Path Rules

Before generating patch, snapshots, manifest, artifact index, reviewer
candidate, logs, errors, or packet content, the generator must derive the full
changed path set using NUL-delimited Git output and classify all changed
content.

`PASS` fails if any changed path is sensitive or protected. `HUMAN_REQUIRED`
may mention sensitive paths only as redacted metadata and must not read or copy
their contents.

Protected paths include:

- `.env`, `.env.*`
- `.npmrc`, `.pypirc`, `.netrc`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- `id_rsa`, `id_ed25519`
- `credentials*`, `secrets*`
- `.git/**`, `node_modules/**`, `**/.runtime/**`
- unapproved real user assets

All repo input paths must resolve inside the repository. All Git path inputs
must use literal pathspecs and `--`; pathspec magic must not be interpreted.
Snapshot logic uses `lstat`; symlinks are recorded as link metadata and are not
followed.

For safe paths, content classification covers committed HEAD content, staged
content, tracked worktree content, untracked file content, rename/copy old and
new path strings, and symlink target strings. High-confidence secret content
causes `PASS` to fail closed without writing a terminal packet. In
`HUMAN_REQUIRED`, matching files are metadata-only: repository path, change
type, size, SHA-256, rule id, line range, and `redacted: true`; `files/` must
not contain their content. Binary files are metadata-only in
`HUMAN_REQUIRED` unless a frozen milestone explicitly approves that binary.

`git status --porcelain=v1 -z` rename/copy records must treat the path in the
status token as the new path and the following NUL token as the old path.

## Diff Checks

`PASS` records and requires:

```bash
git --literal-pathspecs diff --check <baseCommit>..<headCommit>
```

`HUMAN_REQUIRED` records:

```bash
git --literal-pathspecs diff --check <baseCommit>..<headCommit>
git --literal-pathspecs diff --check
git --literal-pathspecs diff --cached --check
```

When `companionRequired=true`, terminal handoff writes `changes.patch` from:

```bash
git --literal-pathspecs diff --binary --no-ext-diff --no-textconv <baseCommit>..<headCommit> -- <safe literal paths>
```

When `companionRequired=false`, terminal handoff must not create visible or ZIP
`changes.patch`. The Review Packet embeds the exact Full Diff when required.
Do not create an empty patch. If there is no source diff, record that fact in
`REVIEW_PACKET.md`.

No generic redaction, rewriting, normalization, or source substitution is
allowed in a sealed packet. High-confidence secret content fails closed before
packet generation. `HUMAN_REQUIRED` may use `diffFidelity:
PARTIAL_REDACTED` only when sensitive paths or high-confidence sensitive
content must be kept out of the packet.

Packet directory names are built only after validating `milestoneId` as a safe
single-segment identifier. `packetRoot`, `candidateRoot`, `latestRoot`,
snapshots, and decision files must resolve inside `.artifacts/loop-handoff`;
containment validation happens before any recursive remove, directory creation,
copy, or symlink operation.

## Acceptance Evidence

The frozen milestone contract is parsed for exact:

- milestone ID
- acceptance criterion IDs
- criterion requirement text

For current packets, acceptance evidence must have exactly the same criterion
ID set as the frozen contract. Each item records the requirement hash, commands,
exit codes, evidence refs, and limitations.

## Human Decision

`HUMAN_REQUIRED` requires one structured JSON decision with:

- `schemaVersion`
- `gateType`
- one `question`
- at least two options with `id`, `label`, and `impact`
- `recommendation`
- `evidence`
- `safeDefaultWhileWaiting`

`FINAL_RESPONSE.txt` prints the actual question and recommendation.

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

For `HUMAN_REQUIRED`, use the same upload section and include the concrete
question, recommendation, and safe default.
