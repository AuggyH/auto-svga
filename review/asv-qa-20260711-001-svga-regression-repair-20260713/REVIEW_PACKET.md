# ASV-QA-20260711-001 SVGA Regression Repair Packet

## Binding
- Requirement: `ASV-REQ-20260709-003`
- Branch: `codex/0.2-svga-regression-repair-20260713`
- Base/source head: `3547156e4ffaac65a56bd07a9c55c0f2a24435d5`
- Repair status: Fix Ready for Code Review
- Accepted material: `SVGA-A`
- Accepted material SHA-256: `d7315b1e6ba5fdecc7bb071dc6734c3e3948cff1b96c27b94467cae5e56a5193`
- Raw material path: redacted from durable handoff

## Root Cause
The accepted SVGA material is larger than the registry probe window. Detection succeeded using bounded range reads, but the workspace parse path could not obtain a bounded full source payload and failed with `parse_precondition`. After that was repaired, the desktop headless SVGA playback adapter returned ready state without a normalized value, which caused the workspace to classify playback as failed.

## Repair
- Added explicit bounded local full-read support to the hidden multi-format workspace host contract.
- Kept range reads bounded to the 256 KiB probe path.
- Added a 50 MiB local full-read cap for accepted local sources.
- Added stat and read-after-stat byte bound checks in the desktop host.
- Returned a minimal normalized value from the desktop headless SVGA playback adapter.
- Added focused tests for accepted SVGA payloads beyond the probe window and headless SVGA load value contract.

## Proof
- Hidden/non-foreground Electron proof: `/var/folders/vh/lkxvz3qn4wzbk5mbwxc9fb9r0000gn/T/auto-svga-svga-regression-proof-96603/svga-regression-proof.json`
- Proof SHA-256: `f55e627978f397e46fc62f1e16f0b693bfd2b3d83daeadd4dbefe9fd29be5af5`
- Source head in proof: `3547156e4ffaac65a56bd07a9c55c0f2a24435d5`
- Model states: `previewReady -> playing -> paused`
- Active issue codes: none
- External requests: none
- Owner installed app: not touched
- Foreground: not used

## Validation
- `npm run build`: PASS
- Focused workspace SVGA tests: PASS 2/2
- Focused desktop session tests: PASS 4/4
- `node --check` desktop session: PASS
- `npm run test:all`: PASS 528/528
- `npm run desktop:short-term:design-system-check`: PASS
- `git diff --check`: PASS
- JSONL parse: PASS
- Package/lockfile changed-path scan: PASS, no output
- Production media/archive changed-path scan: PASS, no output

## Boundaries
- No Lottie rerun.
- No VAP rerun.
- No QA or Packaging route.
- No installed app mutation.
- No foreground action.
- No save/export/conversion.
- No product support, Product Owner acceptance, release, distribution, or foreground visual success claim.
