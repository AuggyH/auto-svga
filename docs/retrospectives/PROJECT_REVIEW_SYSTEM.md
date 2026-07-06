# Project Retrospective System

Date: 2026-07-06
Status: active project-execution governance

## Purpose

This document defines how Auto SVGA records task-level retrospectives, weekly
project reviews, and distilled project experience.

The goal is not only token saving. Token usage is one cost metric inside a
broader project learning loop. The project should learn which product,
technical, design, validation, coordination, and agent-execution paths create
high value, which paths repeatedly waste effort, and which practices should
become standing guidance.

## Authority

This document governs project execution learning. It is not a PRD and does not
define product scope.

When product requirements conflict, use
`docs/product/PRODUCT_ROADMAP.md`. When product documentation ownership
conflicts, use `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`.

## Review Cadence

| Cadence | Output | Purpose |
| --- | --- | --- |
| Every completed task | `docs/retrospectives/TASK_RETRO_LEDGER.jsonl` entry and review-file retrospective section | Capture outcome, value, cost, and lessons while context is fresh. |
| Weekly | `docs/retrospectives/weekly/YYYY-WW.md` | Aggregate task records, review docs, commits, blockers, and token cost into a rough project review. |
| Monthly or every 4 weekly reviews | `docs/retrospectives/monthly/YYYY-MM.md` and updates to `PROJECT_EXPERIENCE_GUIDE.md` | Distill repeated lessons into durable project guidance. |
| Major failure or repeated finding | Dedicated retrospective under `docs/retrospectives/` | Explain root cause and prevention before another repair loop. |

## Inputs

Weekly and monthly retrospectives should use:

- `docs/reviews/*.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/weekly/*.md`
- `docs/loop/LOOP_HISTORY.jsonl` and `docs/loop/reviews/*.md` when loop work is involved
- `docs/autonomous/LESSONS_CANDIDATES.md` when autonomous Workbench lessons are relevant
- recent Git commits and changed-file summaries
- Codex session `token_count` events when available

Do not copy raw chat history, raw production assets, long logs, or full diffs
into retrospective documents.

## Task-level Retrospective

Every meaningful task should record a compact retrospective. For code,
product-doc, UI/UX, release, research, or coordination tasks, add the review
section from `docs/REVIEW_TEMPLATE.md` and append one JSON object to
`TASK_RETRO_LEDGER.jsonl`.

Small conversational answers do not need a ledger entry unless they change
project direction, schedule work, or create follow-up obligations.

## Ledger Schema

`TASK_RETRO_LEDGER.jsonl` is append-only. Each line should be valid JSON.

```json
{
  "date": "2026-07-06",
  "task": "short-term-uiux-preview-polish",
  "lane": "PM | UIUX | short-term | mid-term | AEB | research | release | coordination",
  "taskType": "product-doc | implementation | design | review | research | release | coordination",
  "threadId": "",
  "branch": "",
  "commit": "",
  "reviewFile": "",
  "changedFiles": [],
  "outcome": "completed | partial | blocked",
  "valueAssessment": "high | medium | low",
  "tokenUsage": {
    "source": "codex-session-token-count | manual-estimate | unavailable",
    "inputTokens": null,
    "cachedInputTokens": null,
    "outputTokens": null,
    "reasoningOutputTokens": null,
    "totalTokens": null
  },
  "costDrivers": [],
  "avoidableCosts": [],
  "productLessons": [],
  "technicalLessons": [],
  "designLessons": [],
  "processLessons": [],
  "tokenLessons": [],
  "avoidNextTime": [],
  "promoteToGuide": false
}
```

Use `null` for unknown token numbers. Do not invent exact token counts. If a
Codex session `token_count` event is unavailable, record the source as
`unavailable` or `manual-estimate`.

## Value And Cost

Token usage should be interpreted with value and outcome:

- High-value high-cost work can be acceptable when it reduces project risk,
  clarifies product authority, unlocks implementation, or prevents repeated
  failure.
- Low-value high-cost work should produce an explicit avoidance rule.
- High-value low-cost work should produce a reusable practice.
- Blocked or partial work should record whether the cost came from ambiguity,
  missing evidence, poor boundaries, repeated context loading, or external
  dependency.

## Lesson Promotion

Lessons start as candidates. Promote a lesson into
`PROJECT_EXPERIENCE_GUIDE.md` only when at least one is true:

- the same problem repeated across multiple tasks;
- the lesson prevented a real regression, scope drift, or failed handoff;
- the lesson materially reduced review, validation, UI, implementation, or
  token cost;
- the Product Owner explicitly confirmed the lesson as standing guidance.

Candidate lessons should remain in
`PROJECT_LESSONS_CANDIDATES.md` until they are promoted, rejected, or marked
as historical.

## Standing Rules

- Start tasks by reading relevant sections of
  `PROJECT_EXPERIENCE_GUIDE.md`, not every retrospective ever written.
- Prefer precise searches and authority docs over broad repository summaries.
- Prefer vertical user-flow proof over technical-layer proof for product
  acceptance.
- Keep product scope, UI/UX direction, implementation evidence, release
  readiness, and token cost as separate review dimensions.
- Never claim acceptance from a retrospective. Retrospectives produce guidance,
  not product approval.
