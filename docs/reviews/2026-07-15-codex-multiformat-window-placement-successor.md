# Review: Multi-format Window Placement Successor

## 1. Summary

Implemented the host-only first-frame window placement successor from approved
Reset head `6a4640875a8bddf5ae2ecbe04334b5cd167a21b3`. The 0.2 desktop host now resolves
normal owner placement or one internal acceptance display before constructing
`BrowserWindow`; no renderer, shared shell, AssetRow, Reset, or UI/UX source was
changed.

Normal visible launches read one fixed owner preference file, validate the
complete outer bounds against current display work areas, select the display by
maximum intersection with deterministic ties, clamp a valid placement, and
otherwise center on the primary display before the first frame. Only owner move
or resize of a normal non-minimized/non-fullscreen/non-maximized window can write
the preference.

An internal packaged 0.2 candidate may accept exactly one bounded display ID
only when a separately bounded execution identity is present. The display is
resolved from `screen.getAllDisplays()` before `BrowserWindow`; unknown,
duplicate, malformed, unbound, non-internal, coordinate-like, and undersized
requests fail closed. The override is process-only and never writes placement.

State: `Placement Implementation Ready / Pending Combined Integration`. This is
not package generation, installed placement acceptance, QA, Product Owner
acceptance, support, distribution, or release readiness.

## 2. Git State

- Branch: `codex/0.2-window-placement-successor-20260715`
- Base: `6a4640875a8bddf5ae2ecbe04334b5cd167a21b3`
- UI/UX line `1ca67dce21a185559a7821ccf746747cb4c09273`: not merged or copied.
- Classified residue preserved: `.pnpm-store/`.
- Temporary dependency overlay: none; focused package tests used a read-only
  `NODE_PATH` whose three package/lock hashes exactly matched this worktree.

## 3. Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/short-term-window-bounds-policy.cjs`
- `tools/electron-prototype/experiments/svga-web/short-term-window-placement-store.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement-store.test.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement Checks

| Requirement | Status | Evidence |
|---|---|---|
| Normal placement restore/fallback before first frame | Done in source | Pure policy tests cover restore, clamp, offline/malformed fallback, min size, and outer-frame containment. |
| Maximum intersection and deterministic tie | Done | Equal-overlap fixture selects the lower bounded display ID. |
| Internal candidate acceptance display | Done in source | One display argument plus execution binding; all coordinate-style and invalid requests reject. |
| Resolve online display before `BrowserWindow` | Done | Main composition test proves `screen.getAllDisplays()` and resolver precede construction. |
| Acceptance override never persists | Done | Placement record authority accepts only `launchMode=normal`; main persistence is additionally normal-mode gated. |
| Fixed no-follow bounded atomic owner preference | Done | 16 KiB max, regular non-symlink target, `O_NOFOLLOW`, full bounded reads/writes, mode `0600`, fsync, same-directory atomic rename, typed redacted failures. |
| Package/source closure | Done as contract | macOS package proof hashes `main`, policy, and store and requires packaged asar bytes to match; a tampered store fixture fails. Actual package proof remains downstream. |
| Preserve formal 0.1 and accepted 0.2 workflows | Done at regression boundary | Formal 0.1 IPC/preload and related conformance regressions pass; no product renderer/UI files changed. |

## 5. Finding Ledger And Repair Health

| Finding | State | Evidence |
|---|---|---|
| `MF-WINDOW-PLACEMENT-001` | Closed at source boundary | Existing pre-window launch bounds called display selection with no window and therefore defaulted to primary; no validated persistent placement or pre-construction acceptance display authority existed. |
| Installed first-frame placement | Open downstream gate | A rebuilt package and one placement-only installed discriminator are explicitly not part of this source milestone. |

- Root-cause hypothesis: placement authority ran before a window existed but
  delegated display choice to a helper that needs a window, so it always chose
  primary; attempting to repair after show would create a visible first-frame
  move. Owner placement and acceptance placement also lacked separate storage
  and lifecycle authority.
- Why the prior approach was insufficient: a post-first-frame move can prove a
  final location while still exposing the wrong initial frame and can persist a
  proof-only display as owner preference.
- Failure-first evidence: the new focused tests initially failed `6/6` because
  the policy functions did not exist, the store test failed with
  `MODULE_NOT_FOUND`, and the main composition test reported a missing initial
  resolver.
- Success stop: current displays resolve one contained outer window before
  construction; normal owner movement alone persists; acceptance override is
  internal, execution-bound, process-only, and byte-bound by package proof.
- Failure stop: any renderer/UIUX conflict, coordinate acceptance, arbitrary
  preference path, proof placement persistence, post-first-frame placement
  move, package byte drift, or formal 0.1 regression stops integration.

## 6. Verification

```text
placement policy/store/main focused tests
PASS 10/10

macOS package source-closure focused tests
PASS 4/4 (including tampered packaged-source rejection)

formal 0.1 and related conformance tests
PASS 27/27

npm run build
PASS

npm run test:all
PASS 536/536

npm run desktop:short-term:design-system-check
PASS
```

The package fixture tests used the existing d657 dependency tree only after
matching these SHA-256 values in both worktrees: prototype `package.json`
`2aeb1577...`, `package-lock.json` `c8c6bb84...`, and svga-web `package.json`
`e620a793...`. No install, download, symlink, or dependency write occurred.

## 7. Risks And Boundaries

- Electron display behavior is source- and package-contract ready, not installed
  accepted. The next combined product head still needs the placement-only
  installed discriminator required by the PM contract.
- Normal placement is intentionally limited to formal visible 0.2. Formal 0.1
  keeps its existing launch behavior.
- No GUI, Electron launch, Auto SVGA launch, Finder/dialog, foreground lease,
  package, install, promotion, QA, owner material, recent history, save/export,
  or production data action occurred.
- No production asset or raw owner path was added.

## 8. Next Step

Hold this placement successor for PM-owned combined integration after the UI/UX
source disposition. The combined head should join approved Reset, approved
UI/UX, and this host placement behavior, rerun the union contract, then request
one formal Code Review.

## 9. Project Retrospective

- Value: high; removes an installed-QA entry blocker without touching the active
  UI/UX repair line.
- Avoidable cost: package source closure initially reached a missing local
  `@electron/asar`; hash-checking an existing dependency tree avoided install
  or scope expansion.
- Product lesson: normal owner placement and one-shot acceptance placement are
  different authorities and must never share persistence.
- Technical lesson: resolve initial display and outer bounds before window
  construction; package evidence must bind the exact host modules that enforce
  that decision.
- Process lesson: a placement screenshot after launch cannot prove first-frame
  placement or non-persistence.
- Token usage: unavailable; exact session counts were not exposed.
