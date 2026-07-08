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

Every tracked issue uses one ticket ID:

```text
ASV-QA-YYYYMMDD-###
```

Store files under:

| Artifact | Path |
| --- | --- |
| Ticket | `docs/quality/tickets/ASV-QA-YYYYMMDD-###.md` |
| Reproduction report | `docs/quality/reports/ASV-QA-YYYYMMDD-###-repro.md` |
| Owner fix report | `docs/quality/reports/ASV-QA-YYYYMMDD-###-fix.md` |
| Regression report | `docs/quality/reports/ASV-QA-YYYYMMDD-###-regression.md` |
| Optional non-sensitive evidence | `docs/quality/evidence/ASV-QA-YYYYMMDD-###/` |

Use the templates in `docs/quality/templates/`.

Do not commit production SVGA files, design source files, screenshots with
private user data, large videos, local job folders, or generated runtime output.
When a real production asset is needed for reproduction, reference it with an
alias and a local path in chat only, or write a redacted path if it must appear
in a committed report.

## Status Model

| Status | Meaning | Next owner |
| --- | --- | --- |
| New | Product Owner or another lane reported a problem. | Test Engineer |
| Intake | Test Engineer is collecting minimum context. | Test Engineer |
| Needs Info | Required reproduction context is missing. | Product Owner or reporter |
| Reproducible | Test Engineer reproduced or created a narrow failing case. | Test Engineer |
| Not Reproduced | Current evidence cannot reproduce; ticket stays open only with a clear next attempt. | Test Engineer / reporter |
| Routed | Ticket and repro report were sent to the responsible owner. | Responsible owner |
| Accepted By Owner | Owner accepted responsibility and started investigation or fix. | Responsible owner |
| Fix Ready | Owner provided a fix commit, report, and requested QA regression. | Test Engineer |
| Regression | Test Engineer is validating the fix. | Test Engineer |
| Closed | Original issue and agreed regressions pass. | None |
| Reopened | Regression failed or the fix introduced a related break. | Responsible owner |
| Deferred | Product Manager or owner intentionally deferred the issue. | Product Manager |
| Duplicate | Another ticket is the source of truth. | Linked ticket |
| Won't Fix | Product Manager or owner intentionally rejected the change. | Product Manager |

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
| Unknown or cross-lane issue | Test Engineer keeps ticket in Intake, adds suspected lanes, then asks Product Manager to route |

When an issue spans several lanes, nominate one primary owner and list secondary
owners. The primary owner is accountable for returning one fix-ready handoff to
QA.

## Standard Flow

1. Intake
   - Create or update a ticket from `BUG_TICKET_TEMPLATE.md`.
   - Capture reporter, date, app/build identity, affected file alias, observed
     behavior, expected behavior, and privacy boundary.
   - Assign preliminary severity and suspected lane.

2. Reproduce
   - Use the latest relevant stable app or lane build.
   - Record exact steps, reproduction rate, environment, app path, commit/build
     identity, and evidence paths.
   - If reproduction needs a production file, keep the file out of Git and
     redact sensitive path details in committed docs.

3. Report
   - Create `ASV-QA-...-repro.md`.
   - Mark the ticket `Reproducible`, `Not Reproduced`, or `Needs Info`.
   - Include only concise evidence and links, not full logs or raw chat.

4. Route
   - Send the ticket and repro report path to the responsible thread.
   - Do not paste the full report into chat unless the recipient cannot access
     the repository.
   - Ask the owner for either `Accepted By Owner` or a clear routing objection.

5. Fix
   - The implementation owner reproduces or explains why it cannot reproduce.
   - The owner fixes on the correct lane, writes `ASV-QA-...-fix.md`, and
     provides commit hash, changed files, validation, risk, and QA callback
     criteria.

6. Regress
   - Test Engineer reruns the original reproduction steps.
   - Add adjacent checks based on risk and owner callback criteria.
   - Write `ASV-QA-...-regression.md`.

7. Close or Reopen
   - Close only when the original issue and agreed regression checks pass.
   - Reopen with the failed step, current evidence, and the responsible owner
     when the fix fails or creates a related regression.

## Cross-Thread Handoff Rules

- Chat is the transport; repository docs are the durable record.
- Every routed message must include ticket ID, severity, primary owner, current
  status, and paths to the ticket/repro report.
- Keep each handoff short. Link to docs instead of pasting long reports.
- Do not ask multiple owners to fix the same issue in parallel unless the
  ticket names one primary owner.
- If the receiving owner finds the route wrong, they must state the reason and
  suggested owner in the ticket before handoff returns to QA or PM.
- Implementation owners must not close tickets directly. They return `Fix
  Ready`; QA closes after regression.
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

1. The ticket status is `Closed`.
2. The regression report exists and links to the fix report.
3. The original reproduction steps pass or the accepted product behavior is
   explicitly different.
4. Required adjacent checks are recorded.
5. Any remaining limitation is moved to Product Manager, backlog, or known
   limitation docs.
6. No production asset was committed.

## Templates

- `docs/quality/templates/BUG_TICKET_TEMPLATE.md`
- `docs/quality/templates/TEST_REPRO_REPORT_TEMPLATE.md`
- `docs/quality/templates/OWNER_FIX_REPORT_TEMPLATE.md`
- `docs/quality/templates/REGRESSION_ACCEPTANCE_REPORT_TEMPLATE.md`
