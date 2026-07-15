# Auto SVGA 0.1 Distribution Preparation

Date: 2026-06-30
Track: Auto SVGA 0.1 / SVGA Preview MVP first distributable version
Status: prep started; release candidate not claimed

## Purpose

Start release and distribution preparation in parallel with the Auto SVGA
`0.1.x` / SVGA Preview MVP scope in `docs/product/PRODUCT_ROADMAP.md`.

This track prepares the first distributable Workbench version without changing
the active product acceptance boundary. It must keep packaging readiness,
Product Owner acceptance, trusted signing, notarization, and public release as
separate states.

Version naming follows `docs/product/VERSIONING_AND_RELEASE_POLICY.md`.
`0.1.x` names the product scope, `alpha` / `beta` / `rc` / stable names the
release stage, and the distribution channel names the package trust/audience.

## Auto SVGA 0.1 Target

The first distributable version is a macOS-first Workbench package that can be
handed to reviewers or internal users with clear provenance, privacy-clean
artifacts, rollback instructions, and truthful release limitations.

Distribution channels:

| Channel | Legacy shorthand | Target | Current status |
| --- | --- | --- | --- |
| `local` | D0 local stable app | Product Owner quick-open local app at `/Users/huangtengxin/Applications/Auto SVGA.app` | Available as internal evidence, not a product release |
| `internal` | D0 internal package | Unsigned local/team testing through the existing macOS App ZIP | Available as internal evidence, not a product release |
| `internal-signed` | D1 signed/notarized macOS | First trusted direct-download macOS candidate | Blocked until Apple Developer ID and notary credentials are provided |
| `windows-internal` | D2 Windows | Windows validation package | Blocked until Windows signing identity and runtime validation are planned |

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

An Auto SVGA `0.1.0-rc.N` release candidate can be produced only after all of
these are true:

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
   release candidate and assigns the `0.1.0-rc.N` identifier.

## Required Known Limitations Snapshot

Every Auto SVGA `0.1.x` review package or release-candidate handoff must
include an owner-readable limitations snapshot. It must at least state:

- product version, release stage, distribution channel, and build identity
- whether the package is `local`, `internal`, `internal-signed`, or another
  distribution channel
- whether the Product Owner has accepted the package
- audio parsing status; Auto SVGA `0.1.x` no-audio or unsupported-audio states
  are not blockers when shown truthfully
- text replacement status; Auto SVGA `0.1.x` text replacement is runtime
  preview and is not persisted into SVGA bytes
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

The internal macOS package must use the current temporary owner-provided app
icon at
`tools/electron-prototype/experiments/svga-web/packaging/macos/app-icon.icns`.
The source PNG is kept beside it as `app-icon-source.png` so future icon
iterations can replace the asset through the same packaging path instead of a
local Downloads/Desktop file.

Local stable app entry:

```bash
npm run svga-workbench:v1:promote-local-stable
```

Use the local stable app entry when a completed desktop-client change should
become the Product Owner's quick-open client on this Mac. The default target is
`~/Applications/Auto SVGA.app`; the Product Owner may pin this app once in the
Dock or open it from Launchpad/Spotlight. Shortcuts should point to this stable
target, not to generated `.artifacts` package paths.

The local stable app is currently:

```text
Auto SVGA 0.1.0-alpha local
```

The next deliberate package or review-packet stamping step should assign an
explicit `alpha.N` identifier and record the commit/package manifest.

For Product Owner daily-use reports, this local stable app is the default
Auto SVGA `0.1.x` owner-visible client unless the report names a different
build, path, product version, or distribution channel.
On the Product Owner's machine the expanded path is
`/Users/huangtengxin/Applications/Auto SVGA.app`. Development launches such as
`npm run desktop:dev`, smoke runs, historical Workbench v1 windows, and
generated `.artifacts` package paths may help narrow a problem, but they are
not the primary owner-used client and must not be reported as the reproduction
baseline for an Owner-reported client bug.

The promotion command is intentionally stricter than a manual copy:

1. Refuses to package a dirty worktree by default.
2. Rebuilds the local/internal macOS package unless `--use-existing` is passed.
3. Requires the internal package manifest to match current `HEAD`.
4. Requires the macOS package proof and privacy audit to pass.
5. Verifies the app identity is `Auto SVGA`.
6. Installs to `~/Applications/Auto SVGA.app` using an atomic temp-copy and
   previous-app backup.
7. Registers the installed app with Launch Services.
8. Writes a local promotion manifest under `.artifacts/local-stable-app/`.

### Local Recovery Inspection And Rollback

The same repository-owned command exposes recovery modes, but none of them is
an implicit promotion or rollback permit:

```bash
npm run svga-workbench:v1:promote-local-stable -- --inspect
npm run svga-workbench:v1:promote-local-stable -- --help
```

`--inspect` is strictly read-only. It reports the current candidate, installed
app, previous app, and any named rollback journal without registering Launch
Services, copying an app, or changing a manifest.

`--rollback-previous` is a separate single-use operation. It requires a safe
`--rollback-id` plus caller-supplied full build commit, `Info.plist` SHA-256,
`app.asar` SHA-256, and embedded build-info SHA-256 for both the installed and
previous apps. It rejects stale or same-build identities, running or ambiguous
target processes, path aliases, escaping symlinks, hardlinks, mid-read object
replacement, residue, and manifest collisions. After staging and validating a
copy of the previous app, it exchanges the installed and previous directory
entries with macOS `renameatx_np(RENAME_SWAP)`; there is no sequential rename
fallback. Launch Services registration occurs only after the exchanged bytes
pass their exact postconditions. The final no-overwrite rollback manifest is
fsynced and records `retrySafe=false` and one invocation.

`--recover-rollback` never starts another rollback attempt. Under a separate
explicit recovery authority, it reads an existing durable journal and either
removes pre-swap residue while preserving the original roles, or completes
manifest/registration work for an already atomically exchanged pair. Any
unbound or mixed role state remains failed closed for manual governance review.
Neither rollback nor recovery downloads dependencies, rebuilds a package,
launches the app, uses Finder, or manually copies an app into Applications.

`--use-existing` may be used only when a current-head internal package already
exists and the agent wants to avoid rebuilding from an unrelated dirty
worktree. It must not be used to claim uncommitted work is installed. If the
command fails, the agent must leave the previous local stable app in place,
record the reason in the review, and must not manually copy an app bundle as a
substitute.

Agents that complete a meaningful desktop-client, host, packaging, or
owner-visible UI change should run the local stable app promotion after the
final source commit for that change, or explicitly explain in the review why it
was skipped. This is a `local` channel convenience entry only; it does not
imply Product Owner acceptance, `internal-signed` macOS readiness, Windows
readiness, or public release.

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
  server work in this Auto SVGA `0.1.x` prep track.
- No Windows release claim until Windows runtime and signing are separately
  validated.
- No export acceptance UI, sequence-frame repair, advanced layer editing, broad
  batch replacement, public release, or inactive feature placeholders in the
  Auto SVGA `0.1.x` app.

## Current Blockers

- Apple Developer ID signing and notarization credentials are required for a
  trusted macOS package.
- Windows code-signing identity and Windows runtime validation are required for
  trusted Windows distribution.
- Auto SVGA `0.1.x` is still active product work and is not yet in Product
  Owner review as a beta, RC, or stable release.
- Sequence-frame repair is deferred to the mid-term product plan and must not
  be treated as an Auto SVGA `0.1.x` release-candidate blocker.

## Exit Criteria For This Prep Track

This prep track is ready when the distribution-readiness report is generated,
the current blockers are visible, and the release candidate gate can be rerun
without relying on chat-only instructions.

It is complete only when a final-head review package and distributable artifact
are explicitly accepted for the chosen distribution tier.
