# Project Lessons Candidates

Status: active candidate pool

Use this file for reusable project lessons that are promising but not yet
stable enough for `PROJECT_EXPERIENCE_GUIDE.md`.

Do not copy chat history here. Summarize the smallest reusable lesson, cite the
review or task ledger entry that produced it, and mark whether it should be
promoted, watched, rejected, or kept historical.

## Candidate Format

```text
## <short lesson title>

- Source:
- Area: product | implementation | UI/UX | validation | coordination | token-cost | release
- Context:
- Problem:
- Candidate rule:
- Evidence:
- Status: candidate | promote | watch | rejected | historical
```

## Project retrospectives must not collapse into token accounting

- Source: `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- Area: coordination, token-cost
- Context: The Product Owner requested token statistics, but clarified that
  weekly and monthly reviews must cover all project work: product planning,
  implementation, technical architecture, design interaction, validation,
  multi-process coordination, and execution cost.
- Problem: A token-only system would optimize for cheap turns while missing
  higher-impact causes of delay, rework, scope drift, UI churn, and validation
  weakness.
- Candidate rule: Treat token usage as one cost signal inside a broader
  project retrospective system.
- Evidence: Initial project retrospective system created on 2026-07-06.
- Status: promote

## Keep raw session content out of repository retrospectives

- Source: `docs/retrospectives/PROJECT_REVIEW_SYSTEM.md`
- Area: privacy, token-cost, coordination
- Context: Codex session files can contain `token_count` events useful for
  cost analysis, but they also contain raw conversation and tool output.
- Problem: Copying raw session content into Git would create privacy, noise,
  and token-cost problems.
- Candidate rule: Extract only structured counts, task ids, review paths, and
  short lessons. Do not copy raw chats or long logs.
- Evidence: The task ledger schema records token source and counts without raw
  transcript fields.
- Status: promote
