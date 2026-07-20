# Desktop Foreground And Client Coordination Protocol

Status: active engineering coordination protocol
Owner: Product Manager + Release/QA coordination

## Purpose

Parallel Auto SVGA threads may need to launch, inspect, automate, or package a
desktop client at the same time. They may also need foreground access to
Finder, Open/Save dialogs, After Effects, browsers, system permission dialogs,
the menu bar, Dock/Launchpad, the clipboard, or screen capture. This protocol
prevents foreground-control conflicts, ambiguous screenshots, wrong-client QA,
wrong-application automation, clipboard collisions, and accidental loss of
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
| Foreground input lease | A temporary claim that one process is intentionally controlling shared macOS foreground input: keyboard, mouse, menu bar, modal dialog focus, file dialogs, app focus, or clipboard. |
| Shared foreground resource | Any foreground macOS resource that can be stolen or mutated by another process: Auto SVGA, Finder, Open/Save dialogs, After Effects, browser windows, system dialogs, Dock/Launchpad, menu bar, clipboard, screenshots, display, or workspace. |
| External app instance | A non-Auto-SVGA app or system UI used during the workflow, such as Finder, After Effects, Chrome, an Open dialog, or a permission dialog. |
| Baseline drift | The installed owner local stable app appears to contain behavior not represented in source, product docs, review notes, package manifest, or promotion evidence. |

## Global Foreground Lease Rules

There is only one active foreground input lease at a time across the user's
desktop. Separate visible windows may coexist, especially on a second display,
but two workers must not concurrently drive keyboard, mouse, menu bar, file
dialogs, modal dialogs, clipboard, or app focus.

Before a process launches or controls any foreground app or system UI:

1. Prefer non-foreground evidence first: unit tests, source checks, package
   metadata, headless/browser automation, smoke artifacts, or passive logs.
2. Check whether Auto SVGA, Electron, Finder, After Effects, browsers, or
   relevant system dialogs are already running or frontmost.
3. Check whether another process appears to be controlling a foreground app,
   modal dialog, file dialog, menu, or clipboard.
4. Record the target resource type, app path, PID when available, window or
   dialog title/state, display/workspace, launch command or automation entry,
   clipboard use, and task/thread owner in the task review or handoff.
5. Do not assume the frontmost `Auto SVGA`, `Electron`, Finder, After Effects,
   browser, or file dialog belongs to the current process. Match by path, PID,
   window/dialog identity, display/workspace, and task context.
6. If another worker appears to hold the foreground input lease, wait, switch
   to non-foreground evidence, ask for a safe checkpoint, or route through QA /
   PM. Do not steal focus to "quickly check" something.
7. Do not hold a foreground input lease while a build, install, package, smoke
   test, or external render is running in the background. Release or restore
   focus before waiting.
8. Close or resolve modal dialogs before releasing the lease unless the open
   modal itself is the evidence being captured.

Foreground operation on the Product Owner's main display is a last resort.
Prefer the second display when available. If no second display is available,
use silent, hidden, minimized, non-activating, or shortest-possible foreground
operation. Using a second display reduces owner disruption, but it does not
permit two workers to drive foreground input at the same time.

## Shared Resource Scopes

| Scope | Examples | Rule |
| --- | --- | --- |
| Auto SVGA client | Owner local stable, candidate package, dev Electron | May run concurrently only with instance identity. Active input is serialized. |
| Finder and file dialogs | Finder windows, Open/Save panels, drag-and-drop from Desktop/Dock folders | Serialize active input. Record source/target paths with sensitive details redacted. |
| After Effects / AEB | AE project windows, Render Queue, script dialogs, plugin panels | Serialize active input. Do not let AEB work steal focus from QA/UI foreground work. |
| Browser or web tooling | Chrome, in-app browser, local preview pages | Prefer browser automation/headless. Foreground browser control still needs the foreground input lease. |
| System UI | permission prompts, menu bar, Dock, Launchpad, file association prompts | Serialize and keep short. Record the prompt or menu state. |
| Clipboard | copying paths into dialogs, pasting file paths, temporary text/image payloads | Treat as global mutable state. Save/restore or record use when practical; serialize clipboard-changing operations. |
| Display/workspace | moving windows, screenshots, Stage Manager, Mission Control | Prefer second display. Record display/workspace and restore when practical. |

## Concurrent Client Rules

Multiple apps or clients may be open at the same time only when each process can
identify its own target and only one process actively drives foreground input.

Allowed concurrent patterns:

- QA uses the owner local stable app while implementation uses a distinct
  development or packaged candidate instance, with only one active input lease.
- UI/UX keeps a candidate visible on a second display while QA runs
  non-foreground evidence, or the reverse.
- AEB keeps After Effects open while another lane runs source tests, as long as
  only one lane drives foreground input.
- Release/Packaging inspects package metadata while another lane runs
  non-foreground tests.

Required target evidence:

- app path or launch command
- PID or process identity when available
- display/workspace placement
- window, dialog, or visible identity when available
- resource scope: Auto SVGA, Finder/dialog, After Effects, browser, system UI,
  clipboard, display/workspace
- branch or package manifest / commit when relevant
- whether the target is owner local stable, candidate, supplemental narrowing
  evidence, or an external app instance

If a process cannot distinguish its target from another running app, dialog, or
clipboard operation, it must not automate or capture that foreground state. It
should wait, switch to non-foreground evidence, create an isolated candidate
instance, or route for coordination.

## Serialization Rules

Always serialize:

- replacement of `/Users/huangtengxin/Applications/Auto SVGA.app`
- `npm run svga-workbench:v1:promote-local-stable`
- shared-port development servers when the port or app state is not isolated
- active keyboard/mouse/menu-bar input
- Finder window and Open/Save dialog automation
- After Effects UI automation, script dialogs, plugin panels, and Render Queue
  operations that require foreground control
- clipboard-changing operations
- system permission dialogs and file association prompts
- any foreground step that cannot prove target identity
- owner acceptance or owner-visible baseline regression

Do not serialize by default:

- pure source tests
- package metadata inspection
- headless/browser smoke when ports are isolated
- passive visible windows on separate displays when no foreground input is
  being driven
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

Any review or handoff involving foreground desktop resources should include:

- target type: owner local stable / candidate / supplemental narrowing
- app path or launch command
- PID/process identity when available
- display/workspace strategy
- foreground lease strategy: second display / isolated instance / active input
  lease / silent fallback / main display with reason
- resource scopes touched: Auto SVGA, Finder/dialog, After Effects, browser,
  system UI, clipboard, display/workspace
- whether another Auto SVGA/Electron/Finder/After Effects/browser foreground
  target was running
- clipboard use and restoration when relevant
- package manifest or source commit when relevant
- baseline-drift check result when replacing local stable
