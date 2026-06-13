# Codex Skill Usage

Use only the skills needed for the current Auto SVGA task.

## Always

Load `auto-svga-core-guard` for every task. It defines the product mainline,
priority, scope, validation, anti-drift rules, and report contract.

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
- `caveman-report`: compress plans and completion reports.

Do not load every skill by default. Combine `auto-svga-core-guard` with only the
domain skills required by the task.

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
