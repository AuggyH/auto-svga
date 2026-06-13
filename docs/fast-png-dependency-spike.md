# fast-png Dependency Spike

Checked: 2026-06-13

## Recommendation

**Approve `fast-png` for a future host alpha analyzer**, subject to a separate
production-integration task.

This spike adds `fast-png` as a development dependency only. The prototype is
isolated under `src/spikes/` and is not composed into SVGA inspection, reports,
the CLI, exporter, Web preview, or playback.

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

## Production Gate

Before production wiring:

1. Move or reimplement the approved adapter outside `src/spikes/`.
2. Add malformed chunk, 16-bit, Adam7, large compressed input, and memory-budget tests.
3. Decide whether partial alpha counts as visible or needs a threshold.
4. Connect it only at the host composition boundary.
5. Re-run inspection report tests and desktop bundle measurements.

Until then, existing reports continue to return the current unavailable-analysis warning.
