# Review Packet: Owner Envelope Oracle CR Repair

## Outcome

Fix Ready for same-thread Code Review re-review of `MF-OWNER-ENVELOPE-CR-001`.

## Source Binding

- Base/rejected head: `e41fed4d3993191f2506a1eb39e811fd5576f834`
- Successor head: `commit-containing-this-packet`
- Branch: `codex/0.2-owner-envelope-oracle-cr-repair-20260716`
- Product diff SHA-256: `8e48e5f3c9a656765b72d5710924aac8037c326b08a64f27ecb4ff282473302c`
- Actual route profile recorded: `gpt-5.5/xhigh` fallback.

## What Changed

- The source oracle now imports the canonical `OwnerRightPanelSnapshotV1`
  verifier and rejects noncanonical, schema-drifted, path-bearing, or
  digest-recomputed fake envelopes before consuming snapshot content.
- The oracle now requires exact equality for fixture image targets, text
  targets, and replaceable inventory target ids.
- The oracle recomputes inventory summary counts from groups.
- The task fixture contract now names the actual Lottie text target as
  `text:2`.

## Failure-First Coverage

`multiformat-task-fixture-source-oracle.test.mjs` now rejects:

- extra owner fields;
- extra replaceable target;
- missing target;
- duplicate target;
- recomputed-hash fake envelope;
- noncanonical JSON.

The focused test failed before the verifier/target repair and now passes.

## Validation

- Source oracle focused: PASS 3/3.
- CJS syntax: PASS.
- Multi-format conformance: PASS 28/28.
- Owner preview candidate: PASS 19/19.
- Build: PASS.
- Full source suite: PASS 538/538.
- Design-system check: PASS.
- Diff hygiene: PASS.

## Nonclaims

No Electron runtime proof, installed app mutation, foreground work, QA,
Packaging, Product Owner acceptance, support, distribution, or release claim is
made by this packet.
