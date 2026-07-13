# VAP Fusion Pixel Replacement Repair Packet

## Identity

- Requirement: `ASV-REQ-20260709-003`
- QA ticket: `ASV-QA-20260711-001`
- Branch: `codex/0.2-vap-fusion-pixel-replacement-repair-20260714`
- Base: `32990e90077ad90d7dd1c21bc4fe527d2dbe80c3`
- State: `Fix Ready / PM Independent Review Required`

## Change

The owner-visible selected VAP resource id is now resolved through `vapFusionImages` to its canonical `runtimeBindingKey` / `srcTag` before the private renderer replacement value is prepared. UI selection, command target, model state, host picker authority, and other formats are unchanged.

## Failure-First Evidence

- Permit 058 changed model inventory/issues and enabled Reset, but aligned source/replacement frame bytes were identical.
- Real runtime diagnostics reached replacement player instance 2 with parser, video, and frame-zero readiness but no constructor `avatar` option, no `srcData.avatar`, and no `textureMap.avatar`.
- The IPC discriminator showed a private runtime value under the selected display/resource id rather than the sidecar's canonical `avatar` key.

## Positive Direct-Pixel Evidence

- Inputs are bound by hashes only: VAP `25ce657c...`, sidecar `d1e9160d...`, replacement PNG `bb976694...`.
- Runtime instances: source 1, replacement 2, Reset 3.
- Replacement instance: `avatar` constructor option present; decoded image `1254x1254`; `textureMap.avatar=1`; frame zero references `avatar`.
- Every frame-zero capture waits for seek completion and one video-frame callback.
- Source digest `9b8fcfe8...` differs from replacement `7641030d...`.
- Delayed paused replacement remains `7641030d...`.
- Reset restores source digest `9b8fcfe8...`.
- Lifecycle balances VAP `3/3` and object URLs `3/3`; external requests are empty.
- Pre-commit proof SHA-256: `ffff75db15c8a14b34ecf8c81a730102521c660b05a96445a97d3c69f738f1e7`.
- Final exact-head proof is supplied in the PM callback after commit.

## Validation

- Build: PASS.
- Focused controller/proof contract: PASS 2/2.
- Related VAP/multi-format suites: PASS 67/67.
- Full suite: PASS 530/530.
- Design-system: PASS.
- Diff, JSONL, dependency, and media hygiene: required before final callback.

## Boundaries

- No installed app mutation or foreground control.
- No QA or Packaging route.
- No package/lock change.
- No owner/production asset commit or raw-path publication.
- No save/export/conversion, support, Product Owner acceptance, distribution, or release claim.
