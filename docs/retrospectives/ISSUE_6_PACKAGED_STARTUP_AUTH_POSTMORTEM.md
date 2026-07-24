# Issue #6 Packaged Startup Authority Postmortem And Supersession

Date: 2026-07-24
Status: DR0 supersession record pending independent exact-head evidence review
Finding: `ASV-I6-PACKAGED-STARTUP-AUTH-001` — `open`
Implementation status: `architecture_disposition_approved_pending_successor_implementation`
Closure stage: `machine_gate_rejected_pending_fresh_implementation`

This record supersedes the durable-record content on rejected PR #21. It
preserves the exact R1–R6 history, records the Product Owner-approved private
single-output direction, and freezes the successor implementation contract.
It does not implement or validate the repair and is not QA, packaging,
promotion, Owner acceptance, Issue closure, or release evidence.

## Exact Authority

- Repository: `AuggyH/auto-svga`.
- DR0 base: exact `origin/main`
  `d5d309b0ebd39b328077c69f7bfffe26c32db34c`.
- Rejected and superseded PR: [#21](https://github.com/AuggyH/auto-svga/pull/21).
- Rejected head:
  `83fbd17aab38a401f5ab145d914983eef8de0d80`.
- Rejected tree:
  `8b44251911c35a937c151856a6edd516cbbe08d9`.
- Final independent Code Review:
  [Changes Requested / MANDATORY STOP, comment 5062337639](https://github.com/AuggyH/auto-svga/pull/21#issuecomment-5062337639).
- Issue #6: `OPEN/HOLD`.
- DR0 record task: `019f9202-a413-7101-b38e-40f8f9cb353e`.
- Architecture Disposition task:
  `019f91f7-0a08-7af0-bb73-84109bd17fa3`.
- PM/Integration task: `019f8575-8054-7580-9050-0c1011e85afd`.

The PR #21 source and test implementation is historical, rejected, and
superseded. Neither it nor any passing suite on its head is a current machine
gate.

## Latest Product Owner Approval

The latest explicit Product Owner decision is normalized as:

```text
OWNER_DECISION=APPROVE_ONE_MODULE_PRIVATE_STARTUP_SERIALIZATION_OUTPUT_CAPABILITY
FINDING_STATUS=open
IMPLEMENTATION_STATUS=architecture_disposition_approved_pending_successor_implementation
CLOSURE_STAGE=machine_gate_rejected_pending_fresh_implementation
```

One module-private high-level capability must own startup serialization and
output. This direction is approved; no new Product Owner decision is required
unless implementation would change product artifact retention or diagnostic
semantics, supported product scope, or release/installed-build identity.

The approval does not authorize reuse of PR #21 wholesale and does not change
the current product, retention, package, installed-app, or release identity.

## Exact R1–R6 Review History

| Round | Reviewed head | External outcome | Attempt | Evidence and why it failed |
| --- | --- | --- | --- | --- |
| R1 | `a8c1962203623262a769ac20d14eb7ef23277ec4` | [Changes Requested](https://github.com/AuggyH/auto-svga/pull/21#issuecomment-5058897824) | Route ordinary packaged runtime state to writable userData; introduce startup runtime policy and fatal proof handling. | Dot/traversal/relative roots, raw `Error.name`/reason, and missing package source closure remained. Path shape was treated as identity, raw fields were copied, and packaging authorities were not one fail-closed closure. |
| R2 | `434045b716ee3561859a218d74bd4629a58bd9e4` | [Changes Requested](https://github.com/AuggyH/auto-svga/pull/21#issuecomment-5059253198) | Harden roots, add source/hash/runtime/privacy closure, and cap diagnostic shapes. | Arbitrary safe-token code/syscall/acceptance and phase payloads survived, while fixed `startup_policy_invalid_*` categories collapsed. Syntactic safety replaced finite semantic authority. |
| R3 | `27ef52473187344298539af7e737f5893de3ac3c` | [Changes Requested](https://github.com/AuggyH/auto-svga/pull/21#issuecomment-5059602952) | Add finite fatal taxonomy, bounded phase mapping, and early/loaded adversarial coverage. | Late app-ready still emitted raw `Error.message`; early proof emitted raw execution/milestone identity; full early/loaded parity was absent. The repair enumerated known callsites rather than closing every sink. |
| R4 | `fdf7c7e38957fa387214a0bfaa3494a2160a18dd` | [Changes Requested](https://github.com/AuggyH/auto-svga/pull/21#issuecomment-5060097222) | Repair the five R3 discriminators, share execution/milestone proof validators, and add taxonomy parity. | `normal-visible-startup.json` still emitted raw milestone, launch command, and renderer-probe error; safe-unknown and 4096-character milestones reached artifact index and runtime trace. The inventory excluded legacy/product sinks and identity ingress. |
| R5 | `5aa8db412f023d45a005e07b2bb112353414a27e` | [Changes Requested](https://github.com/AuggyH/auto-svga/pull/21#issuecomment-5061736163) | Centralize formal identity, finite serializers, a logical 12-sink registry, early/loaded parity, and package closure. | The sink list was hand-authored, mutations changed the manifest rather than real writer reachability, early writers and live console summaries remained outside the claimed boundary, and raw fatal output still passed focused `50/50`. |
| R6 | `83fbd17aab38a401f5ab145d914983eef8de0d80` | [Changes Requested / MANDATORY STOP](https://github.com/AuggyH/auto-svga/pull/21#issuecomment-5062337639) | Replace the logical list with a package-source-derived TypeScript AST inventory of 175 normalized writer/builder/finalizer callsites and a fixed digest. | The oracle remained syntax-only. Alias, computed, destructured, optional, nested, and wrapper calls leaked raw payloads without changing the gate; unrelated logging changed the digest. The sole correction was rejected and correction `1/1` was exhausted. |

No round closed the stable finding. The PR #21 sequence is historical evidence,
not an implementation base.

## Why The R6 Oracle Is Rejected

At rejected head `83fbd17`, the committed oracle reported:

- package-authority source set: 6 files;
- observed callsites: `175`;
- digest:
  `d4d2396d2698c92997277b2df778bc13bbd7de78d8f992e42569fbb7ba56d85d`;
- classified architectural bypasses: `0`;
- committed callsite suite: `8/8`;
- focused authority/placement/store/trace suite: `50/50`.

Those results do not prove trusted output authority.

### Underbroad

The following equivalent real-handler mutations leaked raw `Error.message`
while keeping `175`, the same digest, and zero classified bypasses:

- identifier alias, including
  `const rawFatalSink = console.error; rawFatalSink(...)`;
- computed-property call;
- renamed destructuring;
- aliased optional call;
- nested alias;
- `Reflect` wrapper.

The committed mutation test exercised direct spellings and digest movement,
not these semantic indirections.

### Overbroad

Adding one unrelated `console.info("non-startup diagnostic")` changed the
observation count to `176` and changed the digest with zero architectural
bypasses.

Therefore `startup-callsite-closure.mjs`, its AST enumeration, the `175`
count, its digest, and `actualCallsiteClosure` are historical rejected evidence
and must never be used as a successor gate.

## Root Cause

The failure is authority topology, not a missing AST pattern.

- `main.cjs`, startup runtime policy, placement proof, generic product/index
  writers, trace writers, and the early mirror retain multiple writer
  capabilities and multiple field authorities.
- Early bootstrap and loaded startup code do not receive one validated frozen
  context before side effects.
- Raw console/fs/append primitives remain semantically reachable outside one
  private capability.
- Package closure can prove file presence, hashes, and required entries without
  proving that all output is reachable only through a trusted API.
- A syntax scanner is inherently coupled to JavaScript spelling and cannot
  establish semantic writer reachability.

The successor must change the capability topology and prove behavior at API
and host side-effect boundaries.

## Required SPLIT + SUPERSEDE Disposition

1. Open one fresh DR0 durable-record-only PR from exact main
   `d5d309b0ebd39b328077c69f7bfffe26c32db34c`. Its only changed files are this
   postmortem, the Issue #6 finding ledger, and one task-retro append.
2. After the DR0 PR exists and links #21, close PR #21 unmerged as superseded.
   Do not cherry-pick its source or tests.
3. Independently review and merge the exact DR0 record PR.
4. Bind the exact DR0 merge commit on main as the sole start for one fresh
   implementation owner and one fresh implementation PR.

This preserves the review history without merging the rejected oracle or
letting obsolete source policy become the new baseline.

## Frozen Successor Contract

### WP0 — Behavioral failure-first

- Start from the exact DR0 merge main, not PR #21.
- Use sealed-root, no-`AUTO_SVGA_*` environment, and capability-host spies.
- Prove current-base failures and payload reachability through observed bytes
  and side effects.
- Invalid identity must have zero read, mkdir, write, append, index, trace, or
  proof effects.
- Do not enumerate source syntax or callsite spellings.

### WP1 — One validated frozen tagged `StartupContext`

- Validate milestone/build-info, execution ID, argv/env names, proof root,
  trace ID, and runtime mode once before any side effect.
- Freeze and tag the resulting `StartupContext`.
- Downstream code receives only finite/tagged values, never raw env, argv, or
  `Error` payloads.
- Ordinary packaged no-environment routing uses only Electron userData
  `runtime/<formal milestone>`; explicit acceptance proof stays separate.

### WP2 — One module-private high-level output capability

- One module lexically owns console, fs, write, append, root derivation, and
  filename derivation.
- Export only finite high-level methods for fatal, phase, placement,
  product-artifact, artifact-index, and trace output.
- Export no generic writer, serializer, finalizer, raw fs, or stdio capability.
- Keep schema builders inside the boundary and return only typed finite status
  or category values.
- Placement proof and trace become pure producers; generic startup
  `writeJsonProductArtifact` authority is removed.
- Owner window-placement persistence remains a separate typed store, not an
  evidence sink.

### WP3 — Constant-only bootstrap and canonical package authority

- Pre-module fallback is one constant-only stderr record.
- It contains no raw `Error`, environment, path, command, or user payload and
  performs no file I/O.
- Parity covers only that tiny fixed marker/category.
- One canonical packaged-runtime manifest owns source files, hashes, required
  `app.asar` entries, runtime authority identity, and privacy scanning for
  every packaged runtime module.
- Actual staged/package inventory, not AST callsites, is the package authority.

### WP4 — API, side-effect, and package mutation tests

- Exercise every capability method with adversarial payloads and host writer
  spies; assert exact bytes/categories and zero rejected-identity side effects.
- Prove sealed-root owner routing and finite diagnostic distinction.
- Prove the returned API exposes no raw writer capability.
- Pure startup consumers must be load-tested with fs/stdio access denied.
- Package mutations cover missing, stale, and extra runtime modules plus
  manifest/hash/privacy mismatches.
- Do not port `startup-callsite-closure.mjs`, its count, its digest, or
  `actualCallsiteClosure` as a gate.

### WP5 — Exact-head integration and independent review

- Run the focused capability matrix, all existing required suites, build,
  design-system validation, canonical loop validation, JSON/JSONL checks,
  exact scope audit, and clean exact-head start/finish.
- Require exact-head CI `SUCCESS`.
- Require a fresh independent high-risk Code Review with zero Blocking
  findings.
- One fresh Lead Implementation Owner owns WP0–WP5; Evidence Owner and Code
  Reviewer remain independent.

## Selective Reuse Boundary

The following behavior may be deliberately ported from fresh main into the new
private boundary:

- formal milestone set and early rejection;
- owner Electron userData runtime routing;
- explicit-proof separation;
- `productEvidence=false` for ordinary packaged launch;
- finite diagnostic categories;
- no in-process Finder-equivalence claim.

Reuse is not inheritance. Do not cherry-pick `83fbd17`, reuse
`startup-runtime-policy.cjs` wholesale, or carry forward the AST callsite
scanner, observation count, digest, self-reported sink inventory, raw writer
modules, or large early mirror. Each allowed behavior must be deliberately
ported and re-proven against the fresh DR0 merge main.

## Budget And Mandatory Stops

- Source budget: one implementation round plus at most one bounded correction.
- No second correction is authorized.
- Stop immediately if the old syntax/digest oracle returns, a raw writer is
  exposed, any raw payload escapes, unknown identity reaches side effects, a
  packaged runtime module is omitted from canonical authority, ordinary
  packaged launch is overblocked, or any required machine gate is untrusted.
- The same finding or an untrusted gate after the one correction is
  `MANDATORY STOP`; do not merge, package, route to QA, or ask for Owner
  acceptance.

## Gate Separation

```text
implementation self-test
  != source Code Review
reviewed merge
  != fresh package
package integrity
  != packaged no-environment smoke
packaged no-environment smoke
  != QA
QA
  != Product Owner acceptance
Product Owner acceptance
  != promotion
local promotion
  != release
```

The stable finding remains open through DR0. Source implementation may advance
it only after trusted exact-head machine evidence and independent Code Review;
later package and product gates remain separate.

## Rollback And Protected State

- DR0 rollback: revert only the DR0 record commit through normal reviewed Git
  flow; it has no runtime or package effects.
- Fresh implementation pre-merge rollback: abandon the implementation PR and
  keep reviewed main unchanged.
- Post-merge regression: use a new reviewed revert PR; never patch a package
  in place.
- Package/no-environment failure: discard the fresh candidate.

Protected and untouched by DR0:

- installed build commit
  `cc9ddbc9796254be0094bd5c580a1ce8ad3cd93d`;
- frozen candidate build commit
  `6806e1370cd411fce8362c317e7f30543da889b1`;
- `Auto SVGA.previous.bundle`;
- LaunchServices;
- all package, app, source, test, dependency, lock, asset, and generated output
  state.

The installed cc9 metadata reports `Auto SVGA 0.2.0-alpha.2 internal`, while
the PRD names the owner baseline `Auto SVGA 0.1.0-alpha local`. This baseline
drift remains a Release coordination item. DR0 neither resolves it nor permits
promotion.

## Closure And Non-Claims

`ASV-I6-PACKAGED-STARTUP-AUTH-001` remains `open` with:

```text
implementationStatus=architecture_disposition_approved_pending_successor_implementation
closureStage=machine_gate_rejected_pending_fresh_implementation
```

DR0 changes no production source, test, runtime, package, dependency, lock,
asset, generated package, installed app, frozen candidate, previous bundle, or
LaunchServices state. It does not close Issue #6 and does not claim repair,
Code Review approval, merged integration, packaged launch compatibility, QA,
Owner acceptance, promotion, local stable, release readiness, or release.

The unique next gate is independent exact-head evidence review of the DR0
three-file record. After review and merge, PM must bind the exact DR0 merge main
before starting the one fresh successor implementation owner.
