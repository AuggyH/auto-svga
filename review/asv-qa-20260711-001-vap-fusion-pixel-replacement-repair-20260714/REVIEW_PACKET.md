# VAP Fusion Pixel Replacement Repair Packet

## Identity

- Requirement: `ASV-REQ-20260709-003`
- QA ticket: `ASV-QA-20260711-001`
- Branch: `codex/0.2-vap-fusion-pixel-replacement-repair-20260714`
- Base: `32990e90077ad90d7dd1c21bc4fe527d2dbe80c3`
- State: `Fix Ready / PM Independent Review Required`

## Change

The normalized VAP `resourceId` is now the only public fusion selection identity. The owner model rejects zero, duplicate, malformed, and nonreplaceable records, resolves one accepted record to its canonical runtime key, and returns that key explicitly. The host snapshots the binding before and after the picker; stale bindings reject before apply. The renderer consumes only the accepted key and has no alias search or requested-id fallback. Other formats, VAP text behavior, source identity guards, playback, and Reset semantics remain bounded by their existing contracts.

## Failure-First Evidence

- Permit 058 changed model inventory/issues and enabled Reset, but aligned source/replacement frame bytes were identical.
- Real runtime diagnostics reached replacement player instance 2 with parser, video, and frame-zero readiness but no constructor `avatar` option, no `srcData.avatar`, and no `textureMap.avatar`.
- The IPC discriminator showed a private runtime value under the selected display/resource id rather than the sidecar's canonical `avatar` key.
- The CR failure-first collision used `resourceId=vap_fusion_2` for canonical `badge` while an earlier record had `srcTag=vap_fusion_2`; current source initially remounted the wrong key and the new test failed on `badge`.

## Selection Authority Evidence

- Exact collision now resolves public `vap_fusion_2` to canonical runtime key `badge` in both owner-model and renderer integration.
- Zero, duplicate public id, duplicate canonical runtime key across unique resources, blank/non-string canonical fields, and nonreplaceable targets remain revision `0`, dirty `false`, active replacement empty, and cause no runtime reload.
- Upstream duplicate `srcTag` preparation is independently asserted as `status=failed` with `ambiguous_fusion_source_tag`; because both records remain in the prepared model, owner authority still performs its own canonical-key uniqueness check before picker access.
- Missing/stale source ids and a binding token changed while the host picker is pending reject before replacement apply.
- VAP image/text rows use `resourceId` as their public id; duplicate fusion-backed generic asset rows are suppressed.
- Accepted host results carry `replacementRuntimeValue.targetId`; renderer storage/remount requires that nonblank canonical key and cannot reconstruct it from aliases.

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
- Focused owner authority: PASS 13/13.
- Combined owner authority and VAP preparation: PASS 23/23.
- Focused host/controller authority: PASS 4/4.
- Complete Electron experiment suite: PASS 74/74 with a temporary hash-matched dependency overlay.
- Related VAP/Lottie/multi-format suites: PASS 89/89.
- Full suite: PASS 532/532.
- Design-system: PASS.
- Diff, JSONL, dependency, and media hygiene: PASS before commit; repeated at final callback.

## Boundaries

- No installed app mutation or foreground control.
- No QA or Packaging route.
- No package/lock change.
- No owner/production asset commit or raw-path publication.
- No save/export/conversion, support, Product Owner acceptance, distribution, or release claim.
