# Issue #6 Packaged Startup Authority Postmortem

Date: 2026-07-24
Status: Phase -1 durable record pending independent Evidence Owner review
Finding: `ASV-I6-PACKAGED-STARTUP-AUTH-001`
Start head: `fdf7c7e38957fa387214a0bfaa3494a2160a18dd`

This document records a Repair Health mandatory stop after the same packaged
startup identity and proof-serialization authority finding survived four
independent reviews. It is execution history and an approved successor
contract, not product scope, source approval, QA evidence, package evidence, or
Owner product acceptance.

## Owner Approval

The Product Owner approved the following frozen contract:

```text
OWNER_DECISION=APPROVE_ISSUE6_PACKAGED_STARTUP_AUTH_SUCCESSOR_CONTRACT
START_HEAD=fdf7c7e38957fa387214a0bfaa3494a2160a18dd
AUTHORIZED_SCOPE=WP0-WP4_SOURCE_ONLY
LEAD_IMPLEMENTATION_OWNER=019f8efe-5600-73a1-bf86-9ea6dcd281ce
EVIDENCE_OWNER=019f8f15-b316-7a01-b1bd-c471e5c93343
INTEGRATION_VERIFIER=FRESH_INDEPENDENT_EXACT_HEAD_CR
MAX_REPAIR_ROUNDS=1
DOWNSTREAM_PACKAGED_NO_ENV_QA=ONLY_AFTER_REVIEWED_MERGE
```

Phase -1 is narrower than the approved future source scope: only this
postmortem, the Issue #6 finding ledger, and exactly one task-retro line may be
changed. Production source work remains unauthorized until this exact durable
record receives independent Evidence Owner PASS and PM separately authorizes
WP0-WP4.

## Frozen Identity And Evidence

- Repository/PR: `AuggyH/auto-svga#21`.
- Main/base: `d5d309b0ebd39b328077c69f7bfffe26c32db34c`.
- Branch: `codex/normal-packaged-launch-writable-runtime`.
- Phase -1 start head and reviewed R4 head:
  `fdf7c7e38957fa387214a0bfaa3494a2160a18dd`.
- Start-head CI: run `30017855840`, `SUCCESS`.
- Issue #6: `OPEN/HOLD`.
- Owner-contract record: [PR comment 5060819811](https://github.com/AuggyH/auto-svga/pull/21#issuecomment-5060819811).
- Repair Health pause record: [PR comment 5060174164](https://github.com/AuggyH/auto-svga/pull/21#issuecomment-5060174164).

The rejected frozen `0.2.0-alpha.2` candidate remains immutable. Its
`buildCommit=6806e1370cd411fce8362c317e7f30543da889b1` and `app.asar` SHA-256
`1ae863782ef33752f36a7e8f7fcb00af1aeb3a1a8860d6d38dc8dd641b88ce99`
are evidence identity only; this contract does not repair or repackage it.

## Reviewed Round History

| Round | Reviewed head | External outcome | Attempt | Evidence and why it failed |
| --- | --- | --- | --- | --- |
| R1 | `a8c1962203623262a769ac20d14eb7ef23277ec4` | [Changes Requested](https://github.com/AuggyH/auto-svga/pull/21#issuecomment-5058897824) | Route ordinary packaged runtime state to writable userData; introduce startup runtime policy and fatal proof handling. | Dot/traversal/relative proof roots, raw `Error.name`/reason, and missing package source closure remained. Path shape was treated as identity, raw diagnostic fields were copied, and packaging authorities were not updated as one closure. |
| R2 | `434045b716ee3561859a218d74bd4629a58bd9e4` | [Changes Requested](https://github.com/AuggyH/auto-svga/pull/21#issuecomment-5059253198) | Harden roots, add source/hash/runtime/privacy closure, and cap diagnostic shapes. | Arbitrary safe-token code/syscall/acceptance and phase payloads survived, while fixed `startup_policy_invalid_*` categories collapsed. Syntactic safety replaced finite authority; early and loaded writers stayed independent. |
| R3 | `27ef52473187344298539af7e737f5893de3ac3c` | [Changes Requested](https://github.com/AuggyH/auto-svga/pull/21#issuecomment-5059602952) | Add finite fatal taxonomy, bounded phase mapping, and early/loaded adversarial coverage. | Late app-ready still emitted raw `Error.message`; early proof emitted raw execution/milestone identity; full early/loaded parity was absent. The repair enumerated call sites rather than closing every sink. |
| R4 | `fdf7c7e38957fa387214a0bfaa3494a2160a18dd` | [Changes Requested](https://github.com/AuggyH/auto-svga/pull/21#issuecomment-5060097222) | Repair the five R3 discriminators, share execution/milestone proof validators, and add taxonomy parity. | `normal-visible-startup.json` still emitted raw milestone, actual-launch command, and renderer-probe error; safe-unknown and 4096-character milestones reached artifact index and runtime trace. The inventory excluded legacy/product sinks and identity ingestion. |

The R4 source harness captured this adversarial payload, demonstrating that
path-safe tokens were still serialized without finite identity authority:

```json
{"milestoneId":"PRIVATE_CLIENT_NAME_SVGA","actualLaunchCommand":"PRIVATE_LAUNCH_COMMAND","externalRequests":["renderer probe failed: PRIVATE_CLIENT_NAME_SVGA"]}
```

No round closed the stable finding. Green self-tests or CI at those heads are
not source acceptance and do not override the external review outcomes.

## Root-Cause Tree

### A. `normal-visible-startup.json` was missed

- Scope decomposition followed the newest review symptoms: fatal console,
  early phase/failure proof, and loaded placement proof. The older visible
  product-evidence writer was not classified inside the same startup proof
  domain.
- `main.cjs` combines startup with legacy `writeJsonProductArtifact` and
  `productArtifactIndex` paths. The visible proof is gated by explicit proof or
  acceptance state, so ordinary focused execution did not exercise it.
- Existing coverage asserted the writer or filename structurally; it did not
  maintain a behavioral sink registry or require every startup JSON string to
  pass one approved serializer.

### B. Path-safe milestone and formal identity split

- `productMilestoneId` was used both as a filesystem path segment and as formal
  product identity.
- `resolveStartupRuntimePolicy` accepted a nonempty path-safe segment, while
  `safeStartupProductMilestoneId` applied the formal 10-ID set only later for
  proof sanitization.
- The raw value remained globally available and was consumed before or beside
  the formal value. Path confinement passing was therefore misread as semantic
  identity closure.

The formal start-head set is exactly:
`0.2-multiformat-preview`, `0.3.0-alpha.1`, `P2`, `P3`, `P4`, `P5`, `P6`,
`P6-R1`, `aeb`, and `short-term`.

### C. Green tests, loop validation, and CI shared an incomplete oracle

- Focused tests encoded only known failures and trusted constants. R4's
  predecessor discriminator produced `30/35` on the declared R3 delta, but did
  not enumerate the older product/index/trace sinks.
- `normal-visible-startup` coverage was structural rather than behavioral. The
  milestone matrix omitted safe-unknown/overlong values and zero-I/O assertions
  across proof, index, and trace.
- `loop:validate`, CI, package closure, and P6 mutations reused the same
  incomplete oracle. Package checks proved file presence, source hash, runtime
  authority naming, and privacy inclusion—not complete startup data flow.
- Taxonomy mutations caught changes inside finite tables but not an unregistered
  writer, generic JSON spread/merge, or a second validator.
- Packaged no-environment visible smoke was correctly downstream and was not
  run. No source-level writer harness substituted for its identity/privacy
  boundary.

### D. Ownership, early/loaded duplication, and closure were split

- Issue #6 had no active stable finding ledger, so each local symptom could be
  described as predecessor-closed while the systemic authority finding stayed
  unnamed.
- Repeated “minimal successor” scopes optimized for the newest line-level
  review finding; no Evidence Owner owned a complete ingress-to-sink inventory.
- Early bootstrap must survive before the loaded module is trusted, but it
  mirrored a large taxonomy inside `main.cjs`. R4 parity covered finite
  taxonomy, not validators, schemas, field ownership, or sink registration.
- Loaded placement proof used a bounded builder, while normal product proof,
  artifact index, and runtime trace used different generic writers. There was
  no single mechanical closure boundary.

## Complete Startup Data-Flow Authority At The Start Head

### Ingress

- Environment: `AUTO_SVGA_PRODUCT_MILESTONE`,
  `AUTO_SVGA_PRODUCT_ARTIFACTS`, `AUTO_SVGA_ACTUAL_LAUNCH_COMMAND`,
  `AUTO_SVGA_ACCEPTANCE_EXECUTION_ID`,
  `AUTO_SVGA_MULTIFORMAT_TRACE_RUN_ID`, and the names of every other
  `AUTO_SVGA_*` override.
- Arguments and user/runtime state: `--auto-svga-acceptance-display-id`, every
  other `--auto-svga-acceptance-*` argument, proof/smoke arguments,
  executable/argv strings, Electron userData/repository/resources roots,
  packaged build-info milestone/source/commit, owner placement record, online
  displays, and window bounds.
- Errors and phases: `uncaughtException`, `unhandledRejection`, app-ready
  rejection, raw or plain Error name/message/code/syscall/source, placement or
  rejection reason, raw phase and fields, runtime instance/time, renderer
  resource list, renderer-probe error, and blocked external requests.

### Current normalize/validate/sanitize authorities and gaps

| Authority | Current responsibility | Start-head gap |
| --- | --- | --- |
| `startup-runtime-policy.cjs` | Absolute roots, output-mode routing, override-name list, fatal taxonomy, formal 10 IDs, execution-ID format, and Finder-evidence mapping. | Path-segment milestone validation is separate and weaker than formal identity; raw identity remains consumable. |
| Early mirror in `main.cjs` | Early taxonomy, phase enum/field mapping, early artifact root, and deferred validated identities. | Duplicated authority and independent serialization can drift from the loaded module. |
| `short-term-window-bounds-policy.cjs` | Acceptance argv/display parsing and execution-ID validation/revalidation. | Its result is not the only identity ingress consumed by early and loaded writers. |
| `acceptance-startup-placement-proof.cjs` | Fixed placement schema and safe commit/source/time/milestone/execution/reason fields. | It governs placement proof, not every startup proof/index/trace writer. |
| `redactLogMessage` / `sanitizeRuntimeArgument` | Path-oriented log redaction. | Path redaction is not arbitrary-payload or semantic-field authority. |
| Multiformat runtime trace | Fixed phases and run-ID handling. | `productMilestoneId` accepts a generic safe token instead of the formal 10-ID authority. |

### Serialization and write sinks

The successor must register and govern every sink below; naming a subset
“fatal/placement proof” is insufficient.

- early and late fatal console JSON, plus acceptance placement summary console;
- early `acceptance-startup-bootstrap-phases.jsonl`;
- early rejected `acceptance-startup-placement-proof.json`;
- loaded accepted and rejected `acceptance-startup-placement-proof.json`;
- `normal-visible-startup.json`, including nested renderer probe and external
  request fields;
- `normal-runtime-proof.json`, `normal-smoke-parity`, and
  `AUTO_SVGA_DESKTOP_NORMAL_PROOF` paths that consume runtime identity;
- `artifact-index.json` and every startup identity field added by generic
  `writeJsonProductArtifact`;
- multiformat runtime trace JSONL under `/private/tmp`.

Required invariant: every outward string field is a constant, formal enum,
explicit bounded validated format, or omitted. Unknown values map to a fixed
generic category or omission; no raw Error/env/argv/phase/reason/command,
renderer resource/error, or arbitrary safe token may be serialized.

### Package source, hash, runtime, and privacy closure

At the start head, `main.cjs`, `startup-runtime-policy.cjs`,
`acceptance-startup-placement-proof.cjs`, and the bounds/store modules are
represented by package source hashes, named runtime policy/proof authorities,
privacy audit, fixtures, and required `app.asar` entries. Any centralized
identity or serialization authority introduced by WP1/WP2 must join all four
closures. Missing/stale hash, missing runtime authority, privacy omission,
required-entry omission, or main/authority mismatch must fail closed.

## Approved WP0-WP4 Successor Contract

### Roles and budget

- Lead Implementation Owner:
  `019f8efe-5600-73a1-bf86-9ea6dcd281ce`, the only source implementation
  owner.
- Evidence Owner: `019f8f15-b316-7a01-b1bd-c471e5c93343`, read-only and
  independent from implementation.
- Integration Verifier: fresh independent exact-head Code Review with live
  authority readback. A previous reviewer may serve only under a fresh mandate.
- `MAX_REPAIR_ROUNDS=1`: one implementation round plus at most one bounded
  correction within that round. If the same finding remains after that
  correction, or any required machine gate becomes untrusted, return to a
  mandatory stop. No third local sink patch is allowed.

### WP0 — Failure-first inventory

Entry gate: Phase -1 receives independent Evidence Owner PASS and PM separately
authorizes WP0-WP4 source work.

- Freeze a machine-readable ingress-to-authority-to-sink matrix for every item
  in this document before production edits.
- On exact `fdf7c7e3`, a behavioral harness must fail for raw safe-token,
  path-shaped, Unicode, NUL, and overlong Error/env/phase/reason/actual-command
  payloads at every relevant sink; safe-unknown and long milestones; artifact
  index and trace leakage; and any I/O before invalid milestone rejection.
- Prove all 10 formal milestone IDs are valid baselines and ordinary packaged
  runtime routing remains Electron userData `runtime/<milestone>`.

Exit gate: the failure-first matrix distinguishes every registered ingress and
sink and produces the expected failures on the exact start head.

### WP1 — Central identity ingress

- One formal milestone authority owns the current 10 IDs and runs once before
  product branching, path merge, read, mkdir, write, append, trace, artifact
  index, or proof construction. Downstream code receives only validated
  identity.
- One execution-ID authority is used by parser, revalidation, early proof, and
  loaded proof.
- Empty, dot, traversal, separator, safe-unknown, long, Unicode, and NUL
  milestone inputs fail with a fixed category and zero read/mkdir/write/append/
  index/trace side effects.

Exit gate: no raw milestone or execution identity can reach a branch, path, or
sink, and all formal valid inputs retain required behavior.

### WP2 — Central startup-proof serialization boundary

- All fatal, phase, proof, index, and trace startup fields pass schema-specific
  builders owned by one finite authority.
- Remove raw Error name/message/path/source, arbitrary code/syscall/reason/
  phase, raw environment identity/command, and renderer resource/error payload
  from serialization. Preserve approved `startup_policy_invalid_*` and finite
  filesystem code/syscall/category diagnostics.
- Treat `normal-visible-startup`, generic product artifact/index, and runtime
  trace as first-class sinks. Do not add another local per-sink sanitizer.
- If a pre-module early mirror is unavoidable, limit it to minimal constants and
  make parity fail closed for sources, classes, codes, syscalls, reasons,
  phases, formal milestones, execution format, schema field sets, and
  registered sinks.

Exit gate: behavioral property tests prove no raw payload reaches any registered
sink while approved fixed diagnostics remain distinguishable.

### WP3 — Closure and regression/mutation gates

- Bind every new authority and serializer into package required entries, source
  hashes, named runtime authority, privacy audit, and fixtures.
- Fail closed for missing/stale/omitted authority, added/deleted sink, field
  spread/override, early/loaded drift, alternate validator, raw-payload
  mutation, and package hash/runtime omission.
- Execute builders and writers and inspect bytes and pre-rejection side effects;
  source-string assertions are supplemental only.

Exit gate: all closure and mutation cases fail when deliberately corrupted and
pass only with the exact centralized authority.

### WP4 — Exact-head integration verification

Required source machine gates:

- focused full adversarial matrix and exact-start-head failure-first evidence;
- package authority/privacy/missing/stale mutations;
- all 36 P6 mutations;
- full SVGA Web and Electron suites;
- build, design-system check, and canonical `npm run loop:validate`;
- syntax, cumulative and successor diff, JSONL parse;
- dependency/lock, production-asset, generated-package, unrelated-scope audit;
- clean exact-head start and finish.

Exit gate: CI is `SUCCESS` on the exact successor and fresh independent Code
Review has zero Blocking findings. The finding may advance only to
`machine_resolved_pending_packaged_integration`; it does not close.

## Stops, Downstream Boundary, And Rollback

Success stop:

- all enumerated inputs and sinks are governed mechanically;
- all 10 legal milestones pass;
- every invalid matrix case has zero pre-rejection side effects;
- the exact start head fails and the successor passes;
- package closure mutations fail as designed;
- independent exact-head Code Review has zero Blocking findings.

Failure stop: stop immediately if any raw string escapes, any sink is
unregistered, any unknown milestone reaches I/O/index/trace, valid packaged
normal launch is overblocked, package closure is incomplete, or scope drifts.
Do not spend the bounded correction on another local sink patch after the same
systemic finding is reproduced.

Downstream packaged no-environment QA is authorized only after reviewed merge.
That later lane must create a fresh frozen candidate and independently prove a
sealed-root launch with no `AUTO_SVGA_*` environment: one visible/live window,
writes only under Electron userData `runtime/<formal milestone>`, no
candidate-adjacent mutation, fixed-safe fatal diagnostics, clean exit and no
residue. Explicit acceptance-root placement proof remains a separate check.
Only then may independent QA and Owner launch gates proceed. No source test or
Code Review may claim Finder-equivalent launch compatibility.

Rollback:

- Pre-merge: do not merge; keep PR #21 and the `fdf7c7e3` evidence, leave main
  `d5d309b0` unchanged, and abandon the failed successor head.
- Post-merge or package failure: revert the merge through a new reviewed revert;
  never patch a package in place. Keep the frozen `6806e137` candidate, the
  installed local-stable app, `Auto SVGA.previous.bundle`, and LaunchServices
  untouched and on HOLD.

## Closure And Non-Claims

`ASV-I6-PACKAGED-STARTUP-AUTH-001` remains `open`; repair budget is exhausted,
and the current closure stage is
`postmortem_record_pending_evidence_review`. Phase -1 completion does not claim
source resolution, Code Review approval, merged integration, packaged normal or
Finder launch compatibility, QA, Owner acceptance, packaging, installation,
promotion, Issue closure, local stable, release readiness, or release.

The unique next gate is independent Evidence Owner review of the exact
three-file Phase -1 commit. A PASS authorizes no production edit by itself; PM
must separately authorize WP0-WP4 source work.
