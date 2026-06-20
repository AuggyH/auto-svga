# NQ1 Overnight Hardening Queue

Milestone ID: NQ1
Title: Overnight Reliability, Compatibility And Evidence Hardening
Branch: `agent/codex/nq1-overnight-hardening`
P4 final machine HEAD: `fc5e953f6f96a4eb49776af6c5166bd2c2c4f4c4`
NQ1 start HEAD: `fc5e953f6f96a4eb49776af6c5166bd2c2c4f4c4`

NQ1 is engineering hardening. It does not accept P4, start P5, or add product scope.

## Rules

- Work packages run in order.
- Each package records start, finish, commands, evidence, changed files, and deferred items in `NQ1_STATE.json` and `NQ1_HISTORY.jsonl`.
- Stop starting new work at `packagingStartTime`.
- If one package produces no new evidence for 25 minutes, record partial or blocked and move to the next independent package.
- Product code fixes require a repeatable failing test and must preserve P1-P4 semantics.
- No third-party dependency, public network, real user assets, push, merge, release, publish, deploy, or irreversible operation.

## Main Queue

1. `NQ1-WP01` - Baseline, queue, and resumable state.
2. `NQ1-WP02` - Synthetic multi-resource fixture matrix.
3. `NQ1-WP03` - Model-driven undo/redo state-machine tests.
4. `NQ1-WP04` - Async race and failure injection.
5. `NQ1-WP05` - Multi-resource round-trip matrix.
6. `NQ1-WP06` - Cross-platform path and Save As safety matrix.
7. `NQ1-WP07` - Resource, process, and memory cleanup stress.
8. `NQ1-WP08` - Performance baseline.
9. `NQ1-WP09` - Accessibility, keyboard, and error semantics audit.
10. `NQ1-WP10` - Test determinism, flake, and developer documentation.

## Reserve Queue

Reserve work starts only if all main packages finish before `packagingStartTime`.

1. `NQ1-RA` - Expand model testing.
2. `NQ1-RB` - Long lifecycle stress.
3. `NQ1-RC` - 50-resource synthetic fixture.
4. `NQ1-RD` - Mutation verification.
5. `NQ1-RE` - Electron editor threat model.
