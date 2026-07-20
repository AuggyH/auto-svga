# Player and CSP Compatibility Decision

Date: 2026-06-19

Status: decision boundary; no production desktop approval

## Decision

Keep `svgaplayerweb@2.3.1` only in the isolated Electron prototype. Do not use
`script-src 'unsafe-eval'` as a production desktop policy.

The next permitted desktop task is one isolated strict-CSP playback parity
spike using `svga-web@2.4.4`. It must not change the root dependency graph,
the current Web preview, or the browser rollback path. If that candidate cannot
meet playback parity and maintenance requirements, freeze production desktop
shell work. Do not start an installer, a production fork, or a custom renderer.

## Current Player Finding

The vendored `svgaplayerweb@2.3.1` bundle is 123,583 bytes and is licensed
under Apache-2.0. Its source uses `protobufjs/light` with
`Root.fromJSON(...)`. The bundled protobuf.js 6 runtime contains three
relevant dynamic-code paths:

1. Dynamic Node `require` probing through `eval`.
2. Global-object probing through `Function("return this")` and `eval`.
3. Reflection decoder generation through `Function.apply(...)`.

The third path is material. A temporary isolated experiment removed the first
two paths and ran the existing synthetic SVGA Electron smoke under
`script-src 'self'`. The page remained local-only, but playback, nonblank
canvas, inspection report, and Motion Asset Audit checks failed with CSP
`EvalError`. The experiment was restored and no patched player was committed.

Conclusion: replacing the visible `eval` call is not sufficient. A safe fork
would need a static generated protobuf decoder or a CSP-safe non-codegen
decoder, followed by full playback parity tests.

Sources:

- <https://github.com/yyued/SVGAPlayer-Web>
- <https://www.npmjs.com/package/svgaplayerweb/v/2.3.1>
- repository evidence: `tools/electron-prototype/vendor/svgaplayerweb-2.3.1.min.js`

## Option Comparison

### 1. Keep SVGAPlayer-Web 2.3.1 for prototype only

- CSP: requires `unsafe-eval`; production prohibited.
- Playback parity: already proven for the current synthetic fixture.
- Inspection and audit: unaffected; they run through the local report host.
- Offline: proven with the vendored player and pako assets.
- License and size: Apache-2.0; 123,583-byte player asset.
- Maintenance: low for the frozen prototype, unacceptable for production.
- macOS/Windows: same renderer risk on both platforms.
- Decision: retained only as rollback evidence for the isolated prototype.

### 2. Patch or fork the current player

- CSP: potentially removable only by replacing reflection protobuf codegen,
  not by deleting one `eval` string.
- Playback parity: high regression risk across shapes, masks, transforms,
  dynamic elements, frame timing, and image decode.
- Inspection and audit: logically independent, but prototype integration must
  still prove both remain visible while playback succeeds.
- Offline: feasible with a vendored fork.
- License: Apache-2.0 permits modification with required notices.
- Size: likely close to the current bundle; exact result requires a spike.
- Maintenance: high because the project would own a security-sensitive fork of
  an old player and protobuf toolchain.
- Decision: not selected first. A fork spike is allowed only if the modern
  replacement candidate fails for a clearly documented parity reason.

### 3. Replace with another Web player

`svga-web@2.4.4` is the bounded candidate:

- CSP evidence: published JavaScript contains zero `eval(` and zero
  `Function(` matches; source uses static generated protobuf decode methods.
- Playback parity: not yet verified. Its API and rendering implementation differ
  from the current player.
- Inspection and audit: expected to remain independent, but must be included in
  the parity smoke.
- Offline: package can be vendored; package declares no runtime dependencies.
- License: MIT.
- Package evidence: 569,692 bytes npm unpacked, 121,142-byte tarball, 467,289
  bytes of published JavaScript.
- Maintenance: repository commit `c6e43b78f761cb197aff420c62e21e4b5ac0c525`
  was dated 2026-05-13, but the README states it is unofficial and maintained
  by one maintainer.
- macOS/Windows: browser APIs should be portable across Electron WebViews;
  native runtime parity remains required on both platforms.
- Security: promising static evidence, not a production approval.
- Decision: recommended for one isolated strict-CSP parity spike.

The official-lite `svga@2.1.1` package is not selected: its published
JavaScript still contains dynamic `eval`/`Function` paths, so it does not solve
the blocker.

Sources:

- <https://github.com/Naeemo/svga-web>
- <https://www.npmjs.com/package/svga-web/v/2.4.4>
- <https://github.com/svga/SVGAPlayer-Web-Lite>
- <https://www.npmjs.com/package/svga/v/2.1.1>

### 4. Build a minimal custom SVGA renderer

- CSP: fully controllable.
- Playback parity: highest risk. Even a narrow renderer must define protobuf
  parsing, transforms, frame timing, alpha, shapes, masks, image lifecycle,
  replacement behavior, and playback controls.
- Inspection and audit: reusable, but do not reduce rendering scope.
- Offline and license: controllable; maintenance cost shifts entirely to this
  project.
- Package size: potentially smaller, not evidence-backed yet.
- macOS/Windows: portable Canvas code is plausible, but performance and visual
  parity require separate verification.
- Decision: rejected for the current milestone. It would be a distinct P3
  renderer project, not a CSP patch.

### 5. Freeze production desktop shell

- CSP and security: safest option if no player passes strict CSP.
- Playback parity: current browser workflow remains the proven fallback.
- Inspection and audit: continue through the existing browser/local host.
- Offline: browser workflow remains locally runnable, with its existing asset
  constraints.
- Maintenance and package size: no new desktop burden.
- Decision: mandatory fallback if the replacement-player parity spike fails.

## Next Spike Acceptance Criteria

The isolated `svga-web@2.4.4` spike must prove all of the following without
changing production code:

1. `script-src 'self'` with no `unsafe-eval` and no CSP console violation.
2. Local vendored assets only; all remote requests blocked.
3. Synthetic SVGA playback and nonblank canvas.
4. Representative generated avatar-frame SVGA playback with correct timing,
   alpha, transforms, anchors, z-order, and loop behavior.
5. Existing inspection report and read-only Motion Asset Audit panel remain
   available.
6. Basic playback control parity and deterministic cleanup.
7. Version, license, checksums, package delta, and removal path recorded.
8. macOS smoke passed; Windows recorded as run or explicitly not run.

Failure of strict CSP, material visual parity, or maintainability criteria
freezes production desktop work. It does not justify relaxing CSP.

## Client and Security Boundary

- macOS and Windows must use the same strict CSP baseline.
- Player assets remain local and checksum-pinned.
- No remote content, telemetry, AI, model, or network analysis service is
  permitted.
- File access stays behind the Electron host boundary; reports must not persist
  absolute paths.
- Package-size changes remain isolated until product approval.
- Browser workflow remains the rollback path.
