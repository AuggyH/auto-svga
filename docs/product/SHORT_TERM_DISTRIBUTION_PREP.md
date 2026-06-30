# Short-term Distribution Preparation

Date: 2026-06-30
Track: SVGA Workbench v1 first distributable version
Status: prep started; release candidate not claimed

## Purpose

Start release and distribution preparation in parallel with Phase 1, Phase 2,
Phase 3, and Phase 4 product function completion.

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
| Release candidate gate | Integration/Product Owner | Current-head complete review directory, validation summary, App ZIP, and explicit acceptance decision | Not ready; Phase 1-4 review continues |
| macOS package hygiene | Engineering | Clean App ZIP entries, Info.plist audit, privacy audit, normal packaged startup proof | Prepared for internal package |
| macOS signing/notarization | Credential holder + Integration | Signed archive, notarization ticket, stapled app, `spctl` assessment | Workflow dry-run exists; credentials blocked |
| Windows distribution | Future release owner | Windows packaging plan, signing certificate, runtime proof, installer/ZIP decision | Not started beyond blocker tracking |
| Privacy and asset boundary | Engineering | No raw production assets in review/release packages; redacted real-asset matrix only | Active policy |
| Release notes and rollback | Product/Engineering | Changelog, known limitations, rollback to local preview/internal package | Prepared here as a required gate |

## Release Candidate Gate

A short-term release candidate can be produced only after all of these are true:

1. Phase 1, Phase 2, Phase 3, and Phase 4 included capabilities have current-head
   evidence or explicit nonblocking limitation records.
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
- No new editor scope or broad UI polish.

## Current Blockers

- Apple Developer ID signing and notarization credentials are required for a
  trusted macOS package.
- Windows code-signing identity and Windows runtime validation are required for
  trusted Windows distribution.
- Current Workbench v1 is still active product work and is not yet in Product
  Owner review.
- Phase 4 real-asset sequence repair remains narrow: 3 duplicate real-asset
  rows repair through the terminal-tail near-empty-speck rule, while the rest of
  the current 53-sample redacted matrix still fails closed under documented
  detection and safety limits.

## Exit Criteria For This Prep Track

This prep track is ready when the distribution-readiness report is generated,
the current blockers are visible, and the release candidate gate can be rerun
without relying on chat-only instructions.

It is complete only when a final-head review package and distributable artifact
are explicitly accepted for the chosen distribution tier.
