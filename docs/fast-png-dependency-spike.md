# fast-png Dependency Spike

Checked: 2026-06-13

## Recommendation

**Approved `fast-png` for a host alpha analyzer.** The follow-up implementation
is located at `src/hosts/fast-png-alpha-analyzer.ts`.

This document preserves the evidence used for approval. Production composition
is documented in `docs/TECH_SPEC.md`; the checker and Web UI still do not decode
PNG bytes.

## Versions and Licenses

| Package | Version | Role | License |
|---|---:|---|---|
| `fast-png` | 8.0.0 | PNG decode | MIT |
| `fflate` | 0.8.3 | zlib inflate used by `fast-png` | MIT |
| `iobuffer` | 6.0.1 | binary buffer utilities | MIT |

Each installed package contains a license file. No native or system dependency
is introduced.

## Size Measurements

Installed pnpm package-tree disk usage:

- `fast-png`: 344 KiB
- `fflate`: 828 KiB
- `iobuffer`: 100 KiB
- total observed tree: 1,272 KiB

Actual browser ESM bundle measurement used the repository's existing
`esbuild@0.28.0`, with bundling, minification, and tree shaking:

```text
baseline:              32 bytes
prototype bundle:  25,521 bytes
bundle delta:      25,489 bytes

baseline gzip:         64 bytes
prototype gzip:     8,288 bytes
gzip delta:         8,224 bytes
```

The entry was `src/spikes/fast-png-alpha-analyzer.ts`; only the decode path was
imported. These numbers are evidence for a browser-compatible JavaScript host,
not a complete Electron or Tauri installer measurement.

## Prototype Behavior

`FastPngAlphaAnalyzerPrototype`:

- accepts `Uint8Array`
- checks IHDR dimensions before decode
- enforces configurable width, height, and pixel-count limits
- decodes with CRC checking
- supports alpha channels and indexed `tRNS` palette alpha
- computes alpha bounding rectangle and bounding-box padding ratio
- never throws across the analyzer boundary

Status mapping:

| Input/result | `ImageAlphaBounds.status` |
|---|---|
| visible and transparent pixels | `known` |
| no visible pixel | `fullyTransparent` |
| every pixel visible, including RGB without alpha | `opaqueOnly` |
| malformed PNG or decoder failure | `unknown` |
| non-PNG or pre-decode allocation limit exceeded | `unsupported` |

The prototype deliberately treats any non-zero alpha as visible. A future
production task may add an explicit alpha threshold only if product evidence
requires it.

## Fixture Results

Passed:

- RGBA with transparent padding
- fully transparent RGBA
- opaque RGBA
- RGB without alpha
- grayscale alpha
- indexed transparency
- malformed PNG
- oversized image rejected before decode

The existing alpha-bound boundary tests also pass unchanged.

## Client Assessment

- macOS and Windows: pure JavaScript and `Uint8Array`; suitable for Electron,
  browser-hosted desktop UI, or a JavaScript host layer in another shell.
- Offline: fully bundleable; no network or service dependency.
- Privacy: image bytes remain local.
- Native packaging: no native binary, compiler, codec, or system installation.
- Bundle effect: about 25.5 KB minified / 8.2 KB gzip for the measured decode
  prototype.
- Memory: decoded pixels still expand in memory. Host limits must remain
  mandatory and should be calibrated for production assets.
- Distribution: MIT notices for the direct and transitive packages must be
  retained.

## Production Follow-up

Completed in the follow-up host-adapter task:

1. Moved the adapter outside `src/spikes/`.
2. Added malformed input and allocation-limit tests.
3. Connected it only through avatar-frame host composition.
4. Re-ran inspection and Web report tests.

Still deferred: broader malformed chunk, explicit 16-bit/Adam7 fixtures, and a
product decision on whether non-zero alpha or a threshold defines visibility.
