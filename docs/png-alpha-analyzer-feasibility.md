# PNG Alpha Analyzer Feasibility

Checked: 2026-06-13

## Decision

Keep `EmbeddedImageAlphaAnalyzer` as the stable host boundary. Do not promote
the current Node-only PNG reader into a general workbench decoder.

Recommended next step: run a separate dependency spike for `fast-png`, measure
its bundled cost, and implement the analyzer behind the existing boundary only
if fixture coverage and redistribution checks pass.

No runtime analyzer is added in this spike.

## Existing Repository Capability

| Capability | Location | Boundary |
|---|---|---|
| PNG signature, dimensions, alpha-channel flag | `src/utils/png.ts` | Node `Buffer`; metadata only |
| PNG RGBA pixel decoding | `src/utils/png-reader.ts` | Node `Buffer` + `node:zlib` |
| PNG dimension extraction for SVGA | `src/workbench/svga/image-metadata.ts` | Host-neutral `Uint8Array`; IHDR only |
| Alpha analysis contract | `src/workbench/image-alpha-analyzer.ts` | Host-neutral; no decoder |

`decodeRgbaPng()` already reconstructs filters and pixels, but intentionally
supports only:

- 8-bit samples
- non-interlaced images
- color types 0, 2, 4, and 6
- Node `zlib` and `Buffer`

It does not support indexed color type 3, `PLTE`/`tRNS`, 1/2/4/16-bit samples,
Adam7 interlace, CRC validation, or explicit decompression/pixel limits.
Reusing it inside a Node host adapter is feasible. Moving it into the shared
core would violate the current host-neutral contract.

## No-Dependency Complexity

A production-safe decoder must handle:

1. Signature and bounded chunk iteration.
2. IHDR validation and legal color-type/bit-depth combinations.
3. `PLTE` and `tRNS` transparency.
4. Concatenated IDAT streams and zlib inflation.
5. PNG filters 0-4 with correct bytes-per-pixel behavior.
6. Packed 1/2/4-bit samples and 8/16-bit samples.
7. Color types 0, 2, 3, 4, and 6.
8. Adam7 passes or an explicit unsupported result.
9. Pixel-count, inflated-size, chunk-length, and allocation limits.
10. Alpha scanning and `known`, `fullyTransparent`, or `opaqueOnly` results.

The alpha scan itself is small. PNG decoding and defensive validation are the
expensive parts. The existing limited decoder is about 100 lines; a robust
implementation plus fixtures would be several times larger and would duplicate
maintained codec work. A host-neutral implementation would still need a zlib
provider because `node:zlib` is not a shared browser/desktop-core API.

Conclusion: a no-dependency decoder is acceptable only as a narrowly declared
Node host adapter for the current 8-bit, non-interlaced asset profile. It is not
recommended as the production cross-platform route.

## Dependency Candidates

Package metadata was checked from npm and upstream repositories on 2026-06-13.
Sizes below are package tarball or unpacked install sizes, not measured desktop
bundle contribution.

| Candidate | License | Package evidence | Compatibility | Assessment |
|---|---|---|---|---|
| `fast-png@8.0.0` | MIT | 33,675-byte tarball; 162,913 bytes unpacked; depends on `fflate` and `iobuffer` | Pure JavaScript, ESM, accepts `TypedArray` or `Buffer`; latest release 2025-12-18 | Preferred candidate. Requires bundle measurement and fixture verification. |
| `pngjs@7.0.0` | MIT | 160,939-byte tarball; 650,101 bytes unpacked; no npm dependencies | Primarily Node; browser build exists; Node >=14.19 | Mature feature coverage, but less aligned with a host-neutral ESM desktop core. |
| `upng-js@2.1.0` | MIT | 11,656-byte tarball; 36,406 bytes unpacked; depends on `pako` | Browser-oriented and broad PNG/APNG support | Small wrapper but old release line and older pako dependency; not preferred for new core infrastructure. |

Transitive notes:

- `fast-png` uses `fflate` (MIT) and `iobuffer` (MIT).
- Current npm metadata reports unpacked sizes of about 797 KB for `fflate` and
  71 KB for `iobuffer`; tree-shaken bundle cost must be measured separately.
- `UPNG.js` uses `pako`; the current `pako` package is dual MIT/Zlib licensed
  and its npm metadata is older than the preferred candidate stack.

No dependency is approved or installed by this document.

## Platform Host Option

A desktop host could implement `EmbeddedImageAlphaAnalyzer` with:

- Node `zlib` in Electron or a Node sidecar.
- CoreGraphics/ImageIO on macOS.
- Windows Imaging Component on Windows.
- A Rust image codec in a Tauri command layer.

This keeps the workbench contract clean, but native platform codecs create two
implementations and may produce subtly different alpha/color behavior.
Platform APIs are a reasonable shell-level optimization later, not the first
portable implementation.

## Recommended Route

1. Keep the analyzer interface and checker unchanged.
2. Open a dedicated `fast-png` dependency spike.
3. Measure production bundle delta rather than npm unpacked size.
4. Test RGBA, RGB, grayscale-alpha, indexed transparency, 16-bit, interlaced,
   malformed chunks, and decompression limits.
5. Scan decoded alpha into the existing `ImageAlphaBounds` contract.
6. Keep decoder exceptions mapped to `unknown` or `unsupported`.
7. Wire the analyzer only at a host composition boundary.

If the dependency spike fails bundle, maintenance, or fixture requirements,
fallback to a Node-only adapter wrapping `decodeRgbaPng()` for the current MVP
profile. It must return `unsupported` for other PNG profiles rather than claim
complete support.

## Client Readiness

- macOS/Windows: the interface is reusable in Electron, Tauri, or another shell.
- Offline: all evaluated routes can be bundled; no network service is needed.
- Paths/permissions: analyzer consumes bytes and has no filesystem contract.
- UI/checker coupling: none.
- Native dependencies: none in the preferred pure-JavaScript candidate.
- Distribution: candidate and transitive licenses are permissive, but notices
  and locked versions still require release review.
- Memory risk: decoding expands images to pixel buffers; hosts must enforce
  dimensions and allocation limits before or during decode.

## Sources

- PNG specification: <https://www.w3.org/TR/PNG/>
- `fast-png`: <https://github.com/image-js/fast-png>
- `pngjs`: <https://github.com/pngjs/pngjs>
- `UPNG.js`: <https://github.com/photopea/UPNG.js>
- `fflate`: <https://github.com/101arrowz/fflate>
- `pako`: <https://github.com/nodeca/pako>
