# Project Code Review Workflow

Status: active engineering quality workflow
Owner role: Code Review Owner
Created: 2026-07-10

## Purpose

This workflow establishes a dedicated code-quality gate for Auto SVGA.

QA validates user-visible behavior and regression outcomes. Product Management
validates scope and acceptance boundaries. Code Review validates the
implementation itself: architecture fit, maintainability, hidden regressions,
test adequacy, dependency risk, and cross-lane safety.

The goal is not to slow every small task. The goal is to keep a growing
multi-threaded codebase from accumulating avoidable structural debt while
short-term client, UI/UX, mid-term editing, AE Bridge, multi-format, QA, and
packaging work continue in parallel.

## Role Boundary

| Role | Owns | Must not |
| --- | --- | --- |
| Product Manager | Product scope, priority, phase/version routing, acceptance boundary. | Approve risky implementation details without engineering evidence. |
| Code Review Owner | Source-level review, architectural risk, dependency risk, test adequacy, technical findings, review status. | Redefine product scope, run QA closure, or take over feature implementation by default. |
| Test Engineer / QA | Reproduction, user-visible regression, owner-visible acceptance evidence, ticket closure. | Treat a passing UI flow as proof that implementation risk is acceptable. |
| Implementation owner | Build the feature or fix, self-test, provide review material, repair code-review findings. | Close their own code-review findings without reviewer agreement. |
| Release/Packaging owner | Package integrity, build identity, local stable promotion, signing/notarization/channel evidence. | Package high-risk source changes without required code-review disposition. |

## When Code Review Is Required

Code Review is required before QA acceptance or local-stable promotion when a
change touches any high-risk area:

- save, overwrite, export, optimization output, byte mutation, or source-file
  preservation;
- SVGA parsing, protobuf encoding/decoding, image/resource replacement,
  runtime-structure pruning, or file repair;
- playback model, player bridge, renderer lifecycle, timing, comparison, or
  multi-format adapter code;
- Electron main/preload/IPC, filesystem access, dialogs, menu commands,
  clipboard, path redaction, permissions, or host boundary code;
- packaging, dependency bundling, runtime closure, app identity, LaunchServices,
  local stable promotion, signing, or notarization;
- new dependency, codec/toolchain, native module, external service, AI module,
  or license-sensitive package;
- broad refactor, module split, state model rewrite, cross-lane shared
  abstraction, or deletion of legacy paths;
- security, privacy, production-asset handling, or local-path exposure;
- any change an implementation owner marks as high risk or any QA/PM ticket
  requests code review for.

Lightweight review is recommended but not blocking for:

- small UI copy/layout changes with no behavior change;
- test-only changes;
- documentation-only changes;
- narrow bug fixes fully covered by targeted tests and outside the high-risk
  list.

## Review States

| State | Meaning | Next owner |
| --- | --- | --- |
| Not requested | Change does not need independent code review or has not reached review. | Implementation owner |
| Requested | Implementation owner or PM asked for review. | Code Review Owner |
| In Review | Reviewer is inspecting the diff, tests, and evidence. | Code Review Owner |
| Changes Requested | Blocking findings must be fixed before QA/package gate. | Implementation owner |
| Advisory Findings | Non-blocking findings recorded as follow-ups or technical debt. | PM or implementation owner |
| Approved For QA | Source-level risk is acceptable for QA acceptance. | Test Engineer |
| Approved For Packaging | Source-level risk is acceptable for packaging/promotion. | Release/Packaging owner |
| Blocked | Missing evidence, ambiguous scope, dirty handoff, or unsafe dependency prevents review. | PM or implementation owner |

Do not use `PASS`, `accepted`, `released`, or `production ready` as a shorthand
for code review. Name the exact gate: `Approved For QA`, `Approved For
Packaging`, or `Advisory Findings`.

## Required Inputs

An implementation owner requesting review must provide:

- GitHub PR URL;
- requirement or defect Issue, when applicable;
- product version/channel/build identity, when applicable;
- branch and exact head commit;
- concise scope and changed-area summary;
- tests/validation run and skipped checks;
- risk areas touched;
- known limitations and rollback path;
- confirmation that production assets and sensitive paths were not committed;
- whether the owner-visible local stable app was changed.

If these are missing, Code Review may return `Blocked` instead of reviewing a
guess.

## Review Output

Code Review findings should be written as GitHub PR review comments by default.

Findings must be concise and actionable:

- severity: Blocking / Advisory / Question;
- file and line when practical;
- issue;
- risk;
- expected fix or evidence;
- owner responsible.

For broad code-health audits or milestone decisions, a structured report under
`docs/reviews/` is optional. It should identify hotspots, recurring risks,
missing tests, and recommended work packages without duplicating the PR.

## Interaction With QA

QA and Code Review are separate gates.

- Code Review approval does not prove user-visible behavior works.
- QA pass does not prove architecture, dependency, or source-level safety.
- High-risk implementation handoffs should normally flow:

```text
Self-tested PR -> CI and Code Review -> merged candidate -> QA Acceptance -> Packaging / Owner-visible promotion
```

For urgent defects, QA may start reproduction while Code Review is pending, but
Release/Packaging must not treat the fix as safe for promotion until blocking
code-review findings are resolved or explicitly accepted by PM.

## Interaction With Product Scope

If review finds that code implements hidden/deferred scope, revives old
Workbench/Web Preview behavior as a target, or conflicts with
`docs/product/PRODUCT_ROADMAP.md`, the reviewer routes the issue to Product
Manager. The reviewer should not silently choose the product direction.

## First Project Code Health Audit

The first Code Review Owner task is a repository code-health audit, not a
rewrite.

Scope:

- map major source areas and ownership lanes;
- identify high-complexity or high-churn files;
- inspect Electron main/preload/IPC and host boundary risk;
- inspect parser/playback/save/optimization/resource-mutation risk;
- inspect test coverage around critical workflows;
- inspect dependency and packaging risk;
- inspect how current structure affects upcoming `0.2.x` VAP/Lottie, AE
  Bridge, and edit-mode integration;
- produce a prioritized technical-debt list with suggested owners.

Non-goals:

- no sweeping refactor;
- no behavior changes;
- no package promotion;
- no production asset commits;
- no foreground desktop automation unless specifically justified and coordinated.

Exit criteria:

- a code-health report under `docs/reviews/`;
- a short list of blocking project risks, if any;
- a prioritized follow-up backlog with suggested owners;
- optional proposed updates to this workflow if the first audit finds missing
  review rules.
