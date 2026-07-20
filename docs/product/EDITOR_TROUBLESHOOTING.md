# Editor Troubleshooting

Use this when the bounded SVGA image-resource editor, Electron prototype, or
local browser workflow fails during validation.

## First Checks

1. Confirm the repository is clean except ignored artifacts.
2. Run `npm run build`.
3. Run the smallest targeted command from `docs/product/EDITOR_TEST_MATRIX.md`.
4. If a script writes `.artifacts/product/NQ1/*.json`, inspect the summary
   fields first: `passed`, `failures`, `advisories`, and `deferredItems`.

## Common Failures

### Dist output is stale

Symptom: a `dist/tests/*.test.js` file is missing or does not match recent
source changes.

Action: run `npm run build`, then rerun the targeted `node --test` command.

### Port is occupied

Symptom: launcher or local smoke says the port is occupied by an unknown
service.

Action: do not kill the process automatically. Pick another port or stop the
unknown service manually after confirming ownership.

### Electron runtime is stale

Symptom: Electron prototype tests fail after source changes, or `.runtime`
contains outdated files.

Action: run the explicit prepare script through the existing prototype command:

`npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`

The prepare step resets only the prototype-owned `.runtime` directory.

### SVGA fails closed as unsupported

Symptom: editor returns `unsupported_round_trip_file`.

Action: treat this as the expected safe boundary unless a synthetic fixture or
previously supported file now regresses. Do not weaken invariant checks just to
open the file.

### Replacement PNG is rejected

Symptom: replacement input does not apply.

Action: verify it is PNG, decodable, non-empty, within size limits, and not
assigned to the same resource twice.

### Save As is rejected

Symptom: Save As fails before writing output.

Action: confirm the source SVGA was opened through the desktop file picker and
the target path is not the original source path. Browser drag/drop imports do
not provide a safe original path for desktop Save As.

### Visual smoke is inconclusive

Symptom: playback runs but automated canvas proof is missing.

Action: keep the validation result inconclusive. Do not mark visual parity as
passed without nonblank canvas evidence or manual review.

## Protected Behaviors

- Main Web preview remains the browser rollback path.
- Existing SVGA exporter bytes are not edited by the image-resource editor.
- CLI default flow is separate from Electron prototype editing.
- Import, drag-drop, and comparison behavior must not be changed to fix an
  isolated Electron issue.

## What Not To Do

- Do not add fixed sleeps to hide readiness races.
- Do not remove tests or loosen assertions for a green run.
- Do not commit real user SVGA, PNG, screenshots, or local paths.
- Do not make Electron the default entrypoint.
- Do not promote `wasm-unsafe-eval` to a production desktop security baseline.
