# Project Test Engineer Workflow

Status: active project QA workflow
Owner role: Project Test Engineer
Created: 2026-07-08

## Purpose

This workflow creates one project-level testing lane for real issues found by
the Product Owner during daily use of Auto SVGA.

The Test Engineer lane owns intake, reproduction, evidence, routing,
regression verification, and closure. It does not own product scope, UI/UX
direction, or feature implementation. Those remain with the relevant owner
threads and the authoritative product documents.

The process is intended to run as a closed loop without Product Owner manual
chasing. After a Product Owner report enters this lane, the Test Engineer owns
the ticket lifecycle until the ticket is closed, deferred, duplicated, or
explicitly blocked for missing information.

## Source Hierarchy

Use this workflow after reading:

1. `AGENTS.md`
2. `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
3. `docs/product/PRODUCT_ROADMAP.md`
4. `docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md`
5. The relevant lane document for the affected feature

This workflow must not override the main PRD. If a reported issue exposes a
scope conflict or an unclear requirement, route it to the Product Manager lane
before asking an implementation owner to choose silently.

## Roles

| Role | Responsibility | Must not |
| --- | --- | --- |
| Product Owner | Reports real-use problems, provides files/screenshots/videos when useful, confirms final acceptance when needed. | Diagnose implementation details unless they are already known. |
| Test Engineer | Reproduces or narrows the issue, writes the ticket and reproduction report, routes it to the right owner, runs regression, and closes or reopens. | Implement feature fixes, redefine scope, or commit production assets. |
| Product Manager | Resolves requirement ambiguity, phase routing, priority, and PRD updates. | Treat a bug report as approved scope expansion without recording it. |
| Short-term Main Engineer | Fixes short-term client, preview, inspection, replacement, optimization, save, recent-file, packaging-facing client bugs. | Expose deferred mid-term/AEB features in the formal short-term client. |
| Mid-term Main Engineer | Fixes mid-term edit-mode, transform, template, layer, audio, curve, mirror, and internal integration bugs. | Leak internal mid-term surfaces into short-term release scope. |
| AEB Main Engineer | Fixes AE bridge, AE export package, bake/conversion, compatibility, and AE handoff bugs. | Treat AE bridge work as a generic client UI bug. |
| UI/UX Owner | Fixes visual hierarchy, layout, interaction design, design tokens, and native macOS experience issues. | Change PRD scope or implement unrelated product behavior. |
| Release/Packaging Owner | Fixes app bundle, local-stable promotion, icon, runtime dependency, unsigned package, and distribution workflow issues. | Call a D0 internal app a release candidate or public release. |

## Ticket Location

Use one GitHub Issue for each real defect. The Issue is the default ticket,
reproduction record, routing state, fix link, and regression result. Use the
`Product defect` Issue form and link the fixing PR.

Create `ASV-QA-YYYYMMDD-###` repository reports only when a defect needs a
long-lived release/acceptance record, cannot be represented safely in GitHub,
or the Product Owner explicitly requests one. Do not create separate repro,
fix, and regression files for an ordinary defect.

Do not commit production SVGA files, design source files, screenshots with
private user data, large videos, local job folders, or generated runtime output.
When a real production asset is needed for reproduction, reference it with an
alias and a local path in chat only, or write a redacted path if it must appear
in a committed report.

## Status Model

| Status | Meaning | Next owner |
| --- | --- | --- |
| New | A defect Issue was reported. | Test Engineer |
| Triage | Test Engineer is collecting or narrowing evidence. | Test Engineer |
| Needs Info | Required reproduction context is missing. | Product Owner or reporter |
| Reproducible | Test Engineer reproduced or created a narrow failing case. | Test Engineer |
| In Progress | One accountable owner is implementing a fix. | Responsible owner |
| Ready For QA | A linked, self-tested PR is merged into the exact candidate. | Test Engineer |
| Closed | Original issue and agreed regressions pass. | None |
| Reopened | Regression failed or the fix introduced a related break. | Responsible owner |
| Dispositioned | Deferred, duplicate, not reproduced, or won't fix with a recorded reason. | Product Manager or Test Engineer |

Do not use `PASS`, accepted, released, or fixed unless the exact evidence and
gate are named.

## Severity

| Severity | Definition | Examples |
| --- | --- | --- |
| S0 Blocker | Data loss, crash, app cannot start, core flow impossible, or release must stop. | Cannot open the packaged app; Save corrupts source bytes; output cannot be parsed. |
| S1 High | Core workflow broken or production output materially wrong. | Real SVGA cannot preview; imageKey rename leaves dangling references; optimized output is visually wrong. |
| S2 Medium | Important behavior degraded but recoverable. | Missing error feedback; compare state loses one metric; recent-file entry fails without recovery. |
| S3 Low | Non-blocking polish, wording, layout, or convenience issue. | Copy inconsistency; minor spacing issue; low-risk icon state mismatch. |

Severity is impact. Priority is scheduling. A low-severity issue can be urgent
when it blocks an imminent review, and a high-severity issue can be deferred if
it affects only out-of-scope work.

## Lane Routing Rules

Route by the smallest owner who can fix the issue without redefining scope:

| Issue type | Route to |
| --- | --- |
| Short-term open, drag, playback, inspection, replaceable preview, imageKey rename, optimization, save, recent-file, compare, launch, app shell | Short-term Main Engineer |
| Short-term visual layout, native-feel interaction, design token, typography, spacing, mode switch placement, right-surface hierarchy | UI/UX Owner; include Short-term Main Engineer only when behavior code is also wrong |
| Mid-term edit mode, layer transform, blend mode, curves, templates, particles, mirror layer, audio parsing/export option, internal integration client | Mid-term Main Engineer |
| AE bridge, AE plugin/export package, compatibility matrix, bake strategy, AE-to-client handoff, source-effect conversion | AEB Main Engineer |
| Local stable app promotion, packaged dependency, app icon, bundle identity, unsigned ZIP, LaunchServices, packaging script | Release/Packaging Owner |
| Requirement conflict, hidden/deferred scope resurfacing, priority ambiguity, acceptance criteria missing | Product Manager |
| Unknown or cross-lane issue | Test Engineer keeps the Issue in Triage, adds suspected lanes, then asks Product Manager to route |

When an issue spans several lanes, nominate one primary owner and list secondary
owners. The primary owner is accountable for one linked fix PR and QA handoff.

## Standard Flow

1. Triage
   - Create or update one GitHub Issue using the product defect form.
   - Capture reporter, date, app/build identity, affected file alias, observed
     behavior, expected behavior, and privacy boundary.
   - Assign preliminary severity and suspected lane.

2. Reproduce
   - Use the latest relevant stable app or lane build.
   - Record exact steps, reproduction rate, environment, app path, commit/build
     identity, and evidence paths.
   - If reproduction needs a production file, keep the file out of Git and
     redact sensitive path details in committed docs.

3. Route and fix
   - Assign one accountable owner and move the Issue to `In Progress`.
   - The implementation owner reproduces or explains why it cannot reproduce.
   - The fixing PR links the Issue and records scope, risk, validation, skipped
     checks, and rollback. CR and CI inspect only self-tested PRs.

4. Regress
   - Test Engineer reruns the original reproduction steps.
   - Add adjacent checks based on risk and owner callback criteria.
   - Record the concise result on the Issue and exact merged candidate.

5. Close or reopen
   - Close only when the original issue and agreed regression checks pass.
   - Reopen with the failed step, current evidence, and the responsible owner
     when the fix fails or creates a related regression.

## Cross-Thread Handoff Rules

- GitHub Issue, PR, and Actions are the durable record; chat only routes work.
- Every routed message includes the Issue, severity, primary owner, exact
  candidate, and next gate.
- Keep each handoff short. Link to the Issue or PR instead of duplicating it.
- Do not ask multiple owners to fix the same issue in parallel unless the
  ticket names one primary owner.
- Product scope disputes go to PM before implementation.

## Minimum Evidence By Issue Type

| Issue type | Minimum QA evidence |
| --- | --- |
| Client functional bug | App/build identity, file alias, exact steps, expected/actual, screenshot or concise log, reproduction rate. |
| SVGA parsing/playback/output bug | Source file alias, parser/inspection summary, app/build identity, output hash when relevant, inflate/decode or reopen result when available. |
| Optimization bug | Before/after metrics, selected optimization items, output validation, visual/playback comparison status. |
| UI/UX bug | Foreground desktop screenshot with macOS chrome when possible, window size, light/dark mode, reduced-motion state if relevant. Smoke screenshots are regression evidence only. |
| Packaging bug | App bundle path, package/build commit, launch method, runtime error excerpt, local-stable promotion status if relevant. |
| AEB bug | AE version, OS, bridge package/build identity, project/export package alias, unsupported effect or bake path, conversion result. |

## Privacy And Asset Boundary

- Do not commit real production SVGA, PNG, GIF, video, AE projects, PSD/Figma
  exports, or local job output unless the Product Owner explicitly approves a
  sanitized fixture.
- Prefer aliases such as `owner-production-svga-001` in committed docs.
- Store sensitive raw evidence outside Git and mention only that it exists.
- Redact absolute local paths when they reveal private team folders.
- Keep logs short and remove personal names, tokens, or private paths when not
  needed for reproduction.

## Done Definition

A ticket is closed only when:

1. The GitHub Issue is closed by QA or the designated acceptance owner.
2. The Issue links the merged fix PR and exact tested candidate.
3. The original reproduction steps pass or the accepted product behavior is
   explicitly different.
4. Required adjacent checks are recorded.
5. Any remaining limitation is moved to Product Manager, backlog, or known
   limitation docs.
6. No production asset was committed.

## Templates

- `.github/ISSUE_TEMPLATE/bug.yml` is the default.
- `docs/quality/templates/` is retained for exceptional durable reports only.
