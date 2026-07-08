# Desktop Client Coordination Protocol

Status: active engineering coordination protocol
Owner: Product Manager + Release/QA coordination

## Purpose

Parallel Auto SVGA threads may need to launch, inspect, automate, or package a
desktop client at the same time. This protocol prevents foreground-control
conflicts, ambiguous screenshots, wrong-client QA, and accidental loss of
behavior that exists in the Product Owner's installed short-term client.

This protocol does not define product scope. Product scope remains in
`docs/product/PRODUCT_ROADMAP.md`.

## Current Baseline

The current owner-visible client baseline is the short-term macOS app:

```text
/Users/huangtengxin/Applications/Auto SVGA.app
~/Applications/Auto SVGA.app
```

Use this app as the default baseline for Product Owner daily-use QA and
owner-visible version progression.

Do not treat these as current baselines unless the Product Owner explicitly
names them:

- historical Workbench v1 surfaces
- Web Preview pages
- frozen parity artifacts
- development Electron windows
- generated `.artifacts` package paths
- Windows clients

Those surfaces may still be useful as lineage, rollback reference, supplemental
narrowing evidence, or future-platform work.

## Terms

| Term | Meaning |
| --- | --- |
| Owner local stable app | The app at `/Users/huangtengxin/Applications/Auto SVGA.app`. It is the Product Owner's daily-use short-term client and a D0 internal unsigned convenience app. |
| Candidate client | A package, development run, or branch build being tested before promotion. |
| Worker instance | A client launched by a specific process/thread for implementation or QA. |
| Foreground lease | A temporary claim that one process is intentionally controlling a specific foreground client instance. |
| Baseline drift | The installed owner local stable app appears to contain behavior not represented in source, product docs, review notes, package manifest, or promotion evidence. |

## Foreground Lease Rules

Before a process launches or controls a foreground desktop client:

1. Prefer non-foreground evidence first: unit tests, source checks, package
   metadata, headless/browser automation, smoke artifacts, or passive logs.
2. Check whether Auto SVGA or Electron clients are already running.
3. Check whether another process appears to be controlling a foreground client.
4. Record the target app path, PID when available, window title/state, display
   or workspace, launch command, and task/thread owner in the task review or
   handoff.
5. Do not assume the frontmost `Auto SVGA` or `Electron` window belongs to the
   current process. Match by path, PID, window, and task context.

Foreground operation on the Product Owner's main display is a last resort.
Prefer the second display when available. If no second display is available,
use silent, hidden, minimized, non-activating, or shortest-possible foreground
operation.

## Concurrent Client Rules

Multiple clients may run at the same time only when each process can identify
and control its own instance.

Allowed concurrent patterns:

- QA uses the owner local stable app while implementation uses a distinct
  development or packaged candidate instance.
- UI/UX uses a foreground candidate on a second display while QA keeps owner
  local stable regression separate.
- Release/Packaging inspects package metadata while another lane runs
  non-foreground tests.

Required instance evidence:

- app path or launch command
- PID or process identity when available
- display/workspace placement
- window title or visible identity when available
- branch or package manifest / commit when relevant
- whether the instance is owner local stable, candidate, or supplemental
  narrowing evidence

If a process cannot distinguish its client from another running client, it must
not automate or capture that window. It should wait, switch to non-foreground
evidence, or create an isolated candidate instance.

## Serialization Rules

Always serialize:

- replacement of `/Users/huangtengxin/Applications/Auto SVGA.app`
- `npm run svga-workbench:v1:promote-local-stable`
- shared-port development servers when the port or app state is not isolated
- any foreground step that cannot prove instance identity
- owner acceptance or owner-visible baseline regression

Do not serialize by default:

- pure source tests
- package metadata inspection
- headless/browser smoke when ports are isolated
- multiple candidate clients with separate identity and display/workspace

## Baseline Drift Gate

Before replacing the owner local stable app, the promotion owner must verify
that the candidate package is current-head bound and includes, supersedes, or
intentionally removes owner-visible behavior already present in the installed
baseline.

If the installed owner local stable app appears to contain behavior that is not
represented in the candidate source, product docs, review notes, package
manifest, or promotion evidence:

1. Stop replacement.
2. Record the suspected drift in the review or a QA/release ticket.
3. Route to Product Manager / Release to decide whether the behavior should be
   backfilled into source, documented as intentional, or removed.
4. Promote only after the drift is resolved or explicitly accepted.

This prevents a clean candidate package from accidentally deleting useful
temporary fixes that the Product Owner has already been using.

## QA Baseline Rules

For Product Owner daily-use reports, QA starts from the owner local stable app
unless the report explicitly names another build or path.

Development runs and historical surfaces may help narrow the root cause, but
they must be labeled as supplemental evidence. A bug should not be called
reproduced against the current owner client if it was only reproduced in a dev
window, Web Preview, or historical Workbench view.

## Handoff Checklist

Any review or handoff involving a foreground desktop client should include:

- target type: owner local stable / candidate / supplemental narrowing
- app path or launch command
- PID/process identity when available
- display/workspace strategy
- foreground lease strategy: second display / isolated instance / silent
  fallback / main display with reason
- whether another Auto SVGA/Electron client was running
- package manifest or source commit when relevant
- baseline-drift check result when replacing local stable
