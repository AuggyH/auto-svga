# Auto-SVGA Autonomous Execution Rules

Date: 2026-06-30
Scope: SVGA Workbench v1 autonomous branch

These rules refine `docs/loop/AUTONOMOUS_PROTOCOL.md` for the active SVGA
Workbench v1 run. They are project requirements, not review-package content.

## Current Correction

- `review/SVGA-Workbench-v1-cdb101e-complete-review-directory.zip` is an
  autonomous progress checkpoint only.
- It must not be presented as Product Owner accepted, basically complete, or
  review-ready.
- The run continues from the current branch and preserves completed Phase 1,
  Phase 2, Phase 3, Phase 4, package hygiene, privacy, App ZIP, and validation
  work.

## Execution Rules

1. Continue product execution instead of stopping after small fixes.
2. Treat ordinary bugs, failed tests, parser gaps, UI issues, evidence gaps,
   naming, local refactors, and packaging hygiene regressions as implementation
   work for Codex to repair.
3. Stop only for true external blockers: signing or notarization credentials,
   Windows code-signing certificate, unavailable real assets that cannot be
   replaced by fixtures, or an explicit product-direction decision.
4. Do not start broad UI polish, layout-system theory, or unrelated product
   planning when the active task is product function completion.
5. Do not generate a new review/upload package after every small change. Create
   the next complete review directory only at a meaningful product checkpoint.
6. Never claim PASS, complete, accepted, or clean handoff when any included
   evidence still records failed required states.
7. Keep feature status, review packets, upload indexes, validation summaries,
   and generated evidence bound to the current final head when a review package
   is generated.
8. Keep real production assets out of git and review packages unless explicitly
   approved. Store only redacted relative paths, file sizes, hashes, metrics,
   and issue summaries.
9. Maintain a `REAL_ASSET_VALIDATION_MATRIX` for realistic SVGA coverage,
   including parse, preview/load, resource classification, optimization,
   replacement, sequence repair, failure-closed behavior, and unsupported cases.
10. Keep documentation concise and durable: status, blockers, run log, lessons,
    and validation artifacts should explain decisions without copying raw chat.

## Basically Complete Bar

Workbench v1 can be treated as basically complete only when current-head
evidence shows:

- primary single-file preview works in the packaged macOS App or an exact
  documented equivalent when the environment cannot launch the package;
- Phase 2 asset intelligence and optimization reports are self-contained;
- Phase 3 PNG replacement, undo/redo, reset, Save As, and reopen are validated;
- Phase 4 sequence repair is either product-complete with Save As/reopen/alpha
  proof or has a precise terminal technical blocker after a serious attempt;
- real or production-like assets are represented in a redacted validation
  matrix;
- package hygiene, privacy audit, Info.plist security, App ZIP cleanliness,
  manifest verification, and validation summary remain clean;
- outstanding blockers are external or explicitly nonblocking backlog items.

