# Review Packet Visibility Protocol

Date: 2026-06-22

Every completed Auto SVGA task must produce owner-visible review material.

## Required Output

Each task completion must create a visible review folder under:

```text
review/<task-or-milestone>-<head-short-sha>/
```

The visible folder must include:

- `REVIEW_PACKET.md`
- `README.md`
- `changes.patch` when there are source changes
- copied snapshots of the key changed docs or evidence files when useful
- one upload ZIP containing the review packet and supporting files

Long-running loop milestones may still generate sealed packets under
`.artifacts/loop-handoff/`, but that hidden packet is not enough for owner
handoff. A visible mirror or curated upload folder under `review/` is required.

## Final Response Requirement

The final chat response must include clickable Markdown links to:

1. the visible review folder
2. `REVIEW_PACKET.md`
3. the upload ZIP
4. any mandatory companion file, such as `changes.patch`

Do not only print hidden `.artifacts` paths. Do not only list raw absolute paths
without Markdown links.

## Folder Rules

1. Keep one task per visible review folder.
2. Use the final reviewed commit short hash in the folder name when available.
3. Never include real user SVGA, PNG, video, screenshots, labels, or private assets unless explicitly approved.
4. Generated review folders are delivery artifacts and should stay outside normal source commits unless the task explicitly asks to track them.
5. If the task is docs-only, still create the visible review folder and upload ZIP.
6. If there is no source diff, say so in `REVIEW_PACKET.md` and omit or include an empty `changes.patch` intentionally.

## Minimum Review Packet Contents

`REVIEW_PACKET.md` must include:

- task name
- mainline
- commit hash
- working tree status
- changed files
- validation commands and results
- protected flow checks
- risks
- next action

## Owner-Facing Convention

When the owner asks "审查包呢" or similar, answer with one visible directory link
first, then the key file links. Do not open Finder automatically.
