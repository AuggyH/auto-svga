# Standardized Review Handoff Contract

Date: 2026-06-19

## Purpose

Every terminal loop state must produce a fixed Review Packet before Codex returns `PASS` or `HUMAN_REQUIRED`. Chat summaries do not replace the packet.

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
- `reviewer-report.md`
- `artifact-index.json`
- `FINAL_RESPONSE.txt`
- `files/`
- `decisions/`

## Rules

1. `REVIEW_PACKET.md` is the required human-readable entrypoint.
2. `changes.patch` is mandatory when the full diff is not embedded in `REVIEW_PACKET.md`.
3. All changed text files must have snapshots in `files/`.
4. Binary files are indexed by size and sha256 only.
5. `node_modules`, `.git`, `.env`, Electron `.runtime`, unrelated ignored files, and real external user assets must not be packed.
6. `PASS` packets require a clean tracked/untracked source workspace.
7. `HUMAN_REQUIRED` packets may include uncommitted work but must include the current actual state and one bounded human decision.
8. Packet files must be stable and locally generated without network access or third-party dependencies.

## Terminal Response

Before returning `PASS` or `HUMAN_REQUIRED`, Codex must run the repository handoff command successfully and return `FINAL_RESPONSE.txt` verbatim.
