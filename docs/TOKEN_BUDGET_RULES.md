# Token Budget Rules

Agent behavior rules for this repository. Applies to all agents (Codex, Hermes, etc.).

## Context Loading

1. Repo files are the only trusted context — do not rely on chat memory.
2. On handoff, read `AGENTS.md` → `docs/CURRENT_STATUS.md` first.
3. Load `docs/PROJECT_CONTEXT.md` only if background is needed.
4. Load `docs/TECH_SPEC.md` only if module details are needed.
5. Use `git log`, `git status`, `git diff --stat` — not `git diff` (full diff wastes tokens).

## Output Rules

6. Do NOT paste full diffs in chat or reviews.
7. Do NOT paste full logs — keep only key errors.
8. Review files: conclusions, paths, commands, risks, next steps. No project background.
9. Code references: cite file paths + line numbers, not full file contents.
10. User-facing summaries: short — status, commit, tag, risks, next step.

## Documentation

11. Write docs in index style: file paths, commit hashes, tags, checklists.
12. Each doc serves one purpose — no dumping everything into one file.
13. Do not rewrite entire docs every iteration. Patch what changed.
14. Do not copy chat history into repo files.

## Scope

15. Do not expand beyond avatar_frame MVP unless explicitly asked.
16. No unrelated refactors.
17. No premature abstractions or "future proofing."
18. Use existing scripts — do not add complex new workflows unless required.

## Verification

19. Locate first, change second, verify third.
20. Run build + test + pipeline before claiming completion.
21. If verification fails, report the exact error — do not guess at success.
