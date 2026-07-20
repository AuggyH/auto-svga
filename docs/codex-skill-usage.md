# Codex Skill Usage

Use only the skills needed for the current Auto SVGA task.

## Always

Load `auto-svga-core-guard` for every task. It defines the product mainline,
priority, scope, validation, anti-drift rules, and report contract.

For meaningful tasks, also read the relevant section of
`docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md` after the authority check.
Use it to choose a lower-risk, lower-rework execution path; it is not product
scope authority.

For any product, UI, feature, release, planning, acceptance, or product-doc
task, follow the core guard's Product Authority Check before implementation.
That means checking `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md` and the
single project-level PRD authority, `docs/product/PRODUCT_ROADMAP.md`, then
stating whether the task aligns with the relevant roadmap horizon. If the task
conflicts with, duplicates, or revives scope outside the main PRD, stop and ask
the Product Owner.

## Load by Task

| Skill | Load when |
|---|---|
| `auto-svga-motion-formats` | Format recognition, parsing, playback, replacement, conversion, or export |
| `auto-svga-spec-check` | Asset specifications, dimensions, alpha padding, sequence consistency, size, memory, or performance checks |
| `auto-svga-ui-stability` | Web preview UI, responsive layout, dual preview, localization, controls, or state presentation |
| `auto-svga-client-ready` | New modules, dependencies, players, exporters, filesystem, cache, logs, paths, offline use, or cross-platform packaging |

## Optional General Skills

- `context-budget`: restrict repository reads and repeated context.
- `diff-first`: report changes and verification evidence first.
- `verification-budget`: choose validation depth based on change risk.
- `caveman-report`: compress plans and completion reports.

Do not load every skill by default. Combine `auto-svga-core-guard` with only the
domain skills required by the task.

## Inspection Primitives

Build parsing, normalized metadata, resource facts, spec profiles, role-aware
policies, memory estimates, diagnostics, and report contracts before product
features such as audit dashboards, recommendations, preflight, or batch tools.

For inspection primitives, load the core guard plus `auto-svga-spec-check`;
also load `auto-svga-motion-formats` for adapter/format work and
`auto-svga-client-ready` for host boundaries, dependencies, filesystem, memory,
or desktop reuse. Load `auto-svga-ui-stability` only when presenting an already
defined report. Do not put inspection or recommendation logic in UI components.

## AI or External Models

External AI, large language, multimodal, vision, or hosted inference capability
is not a normal implementation option. If a task appears to require one, stop
before design or integration and request explicit user confirmation.

The confirmation request must state the function, network requirement, uploaded
user data, privacy and retention risk, cost and frequency, offline impact,
macOS/Windows packaging impact, and available local or deterministic
alternatives. Only explicitly approved generative modules may proceed.

Examples:

- SVGA parser task: core guard + motion formats + client ready.
- Asset validation task: core guard + spec check.
- Responsive preview fix: core guard + UI stability.
- Export dependency change: core guard + motion formats + client ready.
