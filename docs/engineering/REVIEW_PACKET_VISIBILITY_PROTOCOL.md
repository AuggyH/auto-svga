# Review Packet Visibility Protocol

Date: 2026-06-22

Every completed Auto SVGA task must expose owner-visible review material.
Hidden `.artifacts` output is never sufficient by itself.

## Handoff Types

### A. Short-Term Subagent Evidence

Short-lived subagents may produce evidence only. They do not own branches and
do not create owner review packets.

Allowed output:

- findings
- reviewer JSON
- temporary audit notes

Forbidden output:

- visible Worker folder
- terminal `REVIEW_PACKET.md`
- owner upload ZIP
- `changes.patch`
- terminal state updates

### B. Formal Worker Handoff

Formal implementation workers must be visible project Worktree threads. Each
completed Worker creates:

```text
review/workers/<milestone-id>/<worker-id>-<head-short-sha>/
```

Required files:

- `WORKER_HANDOFF.md`
- `README.md`
- `worker-result.json`

Worker folders must not contain:

- sealed terminal `REVIEW_PACKET.md`
- owner upload ZIP
- `changes.patch`
- final milestone `FINAL_RESPONSE.txt`

Workers report their fixed branch result only. A0 integrates and verifies.

### C. Terminal Milestone Owner Handoff

Terminal milestone handoff creates a visible owner folder:

```text
review/<milestone-id>-<final-head-short-sha>/
```

Required files:

- `REVIEW_PACKET.md`
- `README.md`
- `FINAL_RESPONSE.txt`
- `MANIFEST.json`
- owner review ZIP
- product artifact links or copies required by the milestone
- mandatory companions only when required

The canonical machine packet remains under `.artifacts/loop-handoff/`, but the
visible owner folder must provide the files the owner can click and upload.

## Byte-Identical Mirror Rules

Terminal handoff mirrors sealed files from `.artifacts/loop-handoff` by byte
copy. The visible folder and owner ZIP must not sanitize, normalize, redact,
format, or rewrite sealed files after seal.

The following files are byte-compared when present:

- `REVIEW_PACKET.md`
- `validation.json`
- `budget-check.json`
- `reviewer-a.json`
- `reviewer-b.json`
- `post-seal-verification.json`
- `changes.patch` only when required

Size and SHA-256 must match the canonical packet before final response output.

## `changes.patch` Rules

`changes.patch` is not a default attachment.

- If `companionRequired=false`, do not create visible or ZIP
  `changes.patch`. The Review Packet embeds the exact Full Diff when required.
- If `companionRequired=true`, visible folder and owner ZIP must include a
  byte-identical `changes.patch`, and `MANIFEST.json` records its hash.
- Do not create an empty patch.
- If there is no source diff, record that fact in `REVIEW_PACKET.md`.

## Clickable Final Response

The final chat response for terminal handoff must be exactly the generated
`FINAL_RESPONSE.txt` and must include clickable Markdown links to the owner
visible materials:

- visible review folder
- `REVIEW_PACKET.md`
- owner review ZIP
- App ZIP or other product artifact when present
- required companion file when `companionRequired=true`

Do not only print hidden `.artifacts` paths. Do not only list raw absolute
paths without Markdown links.

## Privacy Rules

Visible review material must not expose:

- real user SVGA, PNG, video, screenshot, labels, or private assets unless the
  owner explicitly approves
- local home paths or repository absolute paths inside tracked files
- unredacted user asset paths in logs, reports, manifests, or ZIP contents
- `.DS_Store` or `__MACOSX` entries in upload ZIPs

## Minimum Terminal Review Packet Contents

`REVIEW_PACKET.md` must include:

- task or milestone name
- mainline
- commit hash
- working tree status
- changed files
- validation commands and results
- protected flow checks
- risks
- next action

## Owner-Facing Convention

When the owner asks "审查包呢" or similar, answer with one visible directory
link first, then the key file links. Do not open Finder automatically.
