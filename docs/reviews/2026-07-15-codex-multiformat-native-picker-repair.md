# Review: Multi-format Native Picker Repair

## 1. Summary

This successor repair addresses the shared installed intake blocker reported by
`ASV-QA-20260714-001`, specifically the recurrence of
`ASV-QA-20260714-006` and new finding `ASV-QA-20260714-009`. It preserves the
bundled conformance milestone at `3231f2be` and changes only the macOS native
picker and renderer chooser-wait boundary.

Status: Fix Ready for independent Code Review and rebuilt installed QA. The QA
tickets remain open.

## 2. Git State

- Branch: `codex/0.2-multiformat-native-picker-repair-20260715`
- Base / failed installed source: `3231f2beb6c34de6cfe020dc5f62159ec6d45f7d`
- Final exact head: supplied in the Fix Ready callback and post-commit proof
- Classified residue: untracked `.pnpm-store/`, preserved and unstaged
- Temporary dependency overlay: hash-matched to the current package manifests;
  removed before commit

## 3. Root Cause And Repair Contract

### Root cause

Two independent assumptions failed in the installed product:

1. The renderer applied its 15-second terminal-state deadline to the complete
   human native-picker interaction. A normal chooser that remained open beyond
   that deadline was converted into a failed Preview shell before Cancel
   returned.
2. The packaged macOS chooser used extension-specific filters even though the
   routed regular files had no queryable temporary-root UTI metadata in the
   implementation discriminator. The installed chooser selected exact `.svga`
   and `.json` inputs but kept its Open action disabled.

### Why the prior milestone missed it

The prior cancellation test returned immediately, and its material proof
injected paths directly into the desktop session. Neither exercised a delayed
human chooser nor the packaged macOS filter boundary.

### Failure-first evidence

- The original controller source failed the new contract because
  `openFromHostDialog()` called `resolveMultiFormatOpenOutcome()` with the
  15-second deadline.
- The original main source failed the new picker contract because it supplied
  only `svga/json/mp4` filters and had no post-selection host validator.
- Permit 069 independently reproduced both installed failures before this
  source change.

### Repair

- `resolveMultiFormatChooserOutcome()` waits for the human chooser result with
  no renderer loading deadline. Drag, macOS file-open, and session parsing keep
  their existing bounded terminal deadlines.
- On macOS the native chooser exposes local files with Electron's documented
  all-files filter. The host then accepts only `.svga`, `.json`, and `.mp4`
  extensions before the existing bounded parser/session chain; other selections
  fail typed and path-redacted.
- The chooser helper catches host failures without returning raw filesystem
  paths.

### Success stop

Focused chooser/controller/host tests, related Electron tests, build, full
project tests, design-system checks, and a private-binding real-material source
proof must pass. The source proof must show three formats reaching
`previewReady` while keeping native-button acceptance explicitly pending
rebuilt installed QA.

### Failure stop

If a rebuilt macOS chooser still disables Open, stop at an OS-level
filter/content-type discriminator. Do not change parsers or playback based on a
pre-delivery symptom.

## 4. Changed Files

- `tools/electron-prototype/experiments/svga-web/multiformat-native-picker.cjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-conformance-source-proof.cjs`
- this review, retrospective records, and visible review packet

## 5. Document-To-Behavior Trace

| Authority / ticket | Required behavior | Evidence | Status |
|---|---|---|---|
| `PRODUCT_ROADMAP.md` shared local workflow | One host-owned open chain for SVGA, Lottie, and VAP | helper -> main -> existing desktop session proof | Implemented; installed QA pending |
| `SHORT_TERM_UI_UX_DESIGN_BRIEF.md` Launch hierarchy | Chooser open/cancel leaves Launch and compact geometry unchanged | delayed cancellation controller test | Implemented; installed QA pending |
| `SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md` state truth | Only accepted input may enter Preview | no session call on cancel; post-selection host validation | Implemented; installed QA pending |
| `DESIGN.md` desktop stability | No chooser-driven premature workbench resize | cancellation state/window-mode assertions | Implemented; installed QA pending |
| `ASV-QA-20260714-002..005` | Existing stage, intake, recent, and owner-copy repair | unchanged bundled tests | Preserved; installed QA pending |
| `ASV-QA-20260714-006` | Open/cancel is a Launch and geometry no-op | delayed human-decision test and proof row | Repaired in source |
| `ASV-QA-20260714-007..008` | Capability panel and SVGA workflow remain conformant | related Electron/formal 0.1 regressions | Preserved; installed QA pending |
| `ASV-QA-20260714-009` | Native chooser can submit supported SVGA/Lottie/VAP files | macOS wildcard filter plus host extension validation and real-input source proof | Repaired in source; native installed gate pending |

## 6. Validation

- Failure-first focused chooser tests: FAIL `2/3` before repair for the two
  expected boundaries; PASS `5/5` after repair.
- Bundled conformance suite: PASS `18/18`.
- Related Electron host/preload/session/runtime suite: PASS `80/80` with a
  temporary hash-matched dependency overlay.
- `npm run build`: PASS.
- `npm run test:all`: PASS; existing compiled suite count unchanged at
  `532/532`.
- `npm run desktop:short-term:design-system-check`: PASS.
- `git diff --check`: PASS.
- Private-binding real-material source proof before commit: PASS, SHA-256
  `59d103a0ea113f5025b947d4c781073e99d09577ae21a1b123ff67892bc1f12f`.
  The exact-head proof is regenerated after commit and reported in the callback.

## 7. Finding Ledger

| Finding | Source state | Next independent gate |
|---|---|---|
| `ASV-QA-20260714-002..005` | Prior repair preserved | Rebuilt installed matrix |
| `ASV-QA-20260714-006` | Repaired with no-deadline chooser wait | Native cancel QA |
| `ASV-QA-20260714-007..008` | Prior repair preserved | Rebuilt installed matrix |
| `ASV-QA-20260714-009` | Repaired with macOS exposure plus host validation | Native SVGA/Lottie/VAP submit QA |

## 8. Risks And Boundaries

- Electron documents `extensions: ["*"]` as the all-files filter, but only a
  rebuilt installed macOS session can prove the native Open button now enables.
- This repair does not claim playback, visual, full matrix, QA, Product Owner,
  support, packaging, distribution, or release acceptance.
- No installed app, foreground session, owner material, save/export/conversion,
  dependency manifest, lockfile, or production asset was changed.

## 9. Project Retrospective

- Value assessment: High.
- Product lesson: human file selection is an interaction phase, not a loading
  deadline phase.
- Technical lesson: when macOS type inference cannot be relied on, expose files
  in the picker and enforce the narrower format contract in the host/parser
  boundary.
- Evidence lesson: direct session injection proves parsing, not native chooser
  submission. Keep that installed gate explicit.
- Avoid next time: test delayed cancel and packaged picker acceptance before
  treating an intake architecture repair as installed-conformant.

## 10. Token Usage

- Source: unavailable.
- Exact token counts: unavailable.
