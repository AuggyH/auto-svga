# Short-term Distribution Preparation

Date: 2026-06-30
Track: SVGA Workbench v1 first distributable version
Status: prep started; release candidate not claimed

## Purpose

Start release and distribution preparation in parallel with the corrected
short-term SVGA app scope in `docs/product/PRODUCT_ROADMAP.md`.

This track prepares the first distributable Workbench version without changing
the active product acceptance boundary. It must keep packaging readiness,
Product Owner acceptance, trusted signing, notarization, and public release as
separate states.

## Short-term Target

The first distributable version is a macOS-first Workbench package that can be
handed to reviewers or internal users with clear provenance, privacy-clean
artifacts, rollback instructions, and truthful release limitations.

Distribution tiers:

| Tier | Name | Target | Current status |
| --- | --- | --- | --- |
| D0 | Internal unsigned ZIP | Local/internal testing through the existing macOS App ZIP | Available as internal evidence, not a product release |
| D1 | Signed and notarized macOS ZIP | First trusted direct-download candidate | Blocked until Apple Developer ID and notary credentials are provided |
| D2 | Windows trusted package | Windows distributable candidate | Blocked until Windows signing identity and runtime validation are planned |

## Parallel Workstreams

| Workstream | Owner boundary | Required output | Status |
| --- | --- | --- | --- |
| Release candidate gate | Integration/Product Owner | Current-head complete review directory, validation summary, App ZIP, and explicit acceptance decision | Not ready; corrected short-term scope review continues |
| macOS package hygiene | Engineering | Clean App ZIP entries, Info.plist audit, privacy audit, normal packaged startup proof | Prepared for internal package |
| macOS signing/notarization | Credential holder + Integration | Signed archive, notarization ticket, stapled app, `spctl` assessment | Workflow dry-run exists; credentials blocked |
| Windows distribution | Future release owner | Windows packaging plan, signing certificate, runtime proof, installer/ZIP decision | Not started beyond blocker tracking |
| Privacy and asset boundary | Engineering | No raw production assets in review/release packages; redacted real-asset matrix only | Active policy |
| Release notes and rollback | Product/Engineering | Changelog, known limitations, rollback to local preview/internal package | Prepared here as a required gate |

## Release Candidate Gate

A short-term release candidate can be produced only after all of these are true:

1. All required short-term capabilities in `docs/product/PRODUCT_ROADMAP.md`
   have current-head evidence or explicit nonblocking limitation records.
2. `npm run svga-workbench:v1:validate` passes on the final source head.
3. `npm run svga-workbench:v1:complete-review` is regenerated after the final
   tracked commit.
4. The review directory includes a current App ZIP, package proof, packaged
   normal runtime proof, validation summary, privacy audit, and owner-readable
   limitations.
5. Raw production assets are absent from git, review packages, and distributable
   packages unless separately approved.
6. Product Owner or Integration Coordinator explicitly marks the package as a
   release candidate.

## Required Known Limitations Snapshot

Every short-term review package or release-candidate handoff must include an
owner-readable limitations snapshot. It must at least state:

- whether the package is D0 unsigned internal, D1 signed/notarized macOS, or
  another distribution tier
- whether the Product Owner has accepted the package
- audio parsing status; short-term no-audio or unsupported-audio states are not
  blockers when shown truthfully
- text replacement status; short-term text replacement is runtime preview and
  is not persisted into SVGA bytes
- which optimization methods are enabled as real output and which are
  suggestion-only
- whether image replacement is runtime preview only or also persisted as
  byte-edited output in that build
- active production-spec profile and any provisional thresholds
- unsupported SVGA round-trip cases and fail-closed behavior
- signing, notarization, Windows packaging, public release, auto-update, and
  telemetry status

Trusted macOS distribution additionally requires:

1. Apple Developer ID Application signing identity.
2. Notary credentials or keychain profile.
3. Signing workflow executed with explicit `--execute`.
4. Notarization and stapling succeed.
5. `spctl --assess --type execute` succeeds on the stapled app.

## Commands

Prep and validation:

```bash
npm run svga-workbench:v1:distribution-readiness
npm run svga-workbench:v1:validate
npm run svga-workbench:v1:complete-review
```

macOS internal package:

```bash
npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac
npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:proof:mac
npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:signing-plan:mac
```

Local stable app entry:

```bash
npm run svga-workbench:v1:promote-local-stable
```

Use the local stable app entry when a completed desktop-client change should
become the Product Owner's quick-open client on this Mac. The default target is
`~/Applications/Auto SVGA.app`; the Product Owner may pin this app once in the
Dock or open it from Launchpad/Spotlight. Shortcuts should point to this stable
target, not to generated `.artifacts` package paths.

The promotion command is intentionally stricter than a manual copy:

1. Refuses to package a dirty worktree by default.
2. Rebuilds the D0 internal macOS package unless `--use-existing` is passed.
3. Requires the internal package manifest to match current `HEAD`.
4. Requires the macOS package proof and privacy audit to pass.
5. Verifies the app identity is `Auto SVGA`.
6. Installs to `~/Applications/Auto SVGA.app` using an atomic temp-copy and
   previous-app backup.
7. Registers the installed app with Launch Services.
8. Writes a local promotion manifest under `.artifacts/local-stable-app/`.

`--use-existing` may be used only when a current-head internal package already
exists and the agent wants to avoid rebuilding from an unrelated dirty
worktree. It must not be used to claim uncommitted work is installed. If the
command fails, the agent must leave the previous local stable app in place,
record the reason in the review, and must not manually copy an app bundle as a
substitute.

Agents that complete a meaningful desktop-client, host, packaging, or
owner-visible UI change should run the local stable app promotion after the
final source commit for that change, or explicitly explain in the review why it
was skipped. This is a D0 internal convenience entry only; it does not imply
Product Owner acceptance, D1 signing/notarization, Windows readiness, or public
release.

Credential-backed execution, only after release approval:

```bash
AUTO_SVGA_MACOS_SIGN_IDENTITY="Developer ID Application: ..." \
  npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:sign:mac -- --execute

AUTO_SVGA_NOTARY_PROFILE="auto-svga-notary" \
  npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:notarize:mac -- --execute
```

## Non-goals

- No automatic push, merge, tag, upload, release, or deployment.
- No production release claim from an unsigned internal package.
- No App Store, auto-update, account system, telemetry, cloud sync, or license
  server work in this short-term prep track.
- No Windows release claim until Windows runtime and signing are separately
  validated.
- No export acceptance UI, sequence-frame repair, advanced layer editing, broad
  batch replacement, public release, or inactive feature placeholders in the
  short-term app.

## Current Blockers

- Apple Developer ID signing and notarization credentials are required for a
  trusted macOS package.
- Windows code-signing identity and Windows runtime validation are required for
  trusted Windows distribution.
- Current Workbench v1 is still active product work and is not yet in Product
  Owner review.
- Sequence-frame repair is deferred to the mid-term product plan and must not
  be treated as a short-term release-candidate blocker.

## Exit Criteria For This Prep Track

This prep track is ready when the distribution-readiness report is generated,
the current blockers are visible, and the release candidate gate can be rerun
without relying on chat-only instructions.

It is complete only when a final-head review package and distributable artifact
are explicitly accepted for the chosen distribution tier.
