# Short-term UI/UX WP6AD API Client Split Review

## Summary

Moved short-term internal API endpoint construction, token header handling, and
JSON response parsing out of the short-term macOS app entry file into a
dedicated API client module. The app entry still owns the product flow and
state transitions, while the new client module owns how inspection,
optimization, imageKey rename, image replacement, and invalid-inspection smoke
probe requests are sent.

No PRD-owned document, product behavior, visible copy, styling, state name, or
interaction flow was changed.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit status at review time: pending commit

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-api-client.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- PRD authority preserved: `docs/product/PRODUCT_ROADMAP.md` remains the only
  product scope authority.
- Short-term scope preserved: S1, S2, S8-S14 request flows are unchanged; this
  slice only moves request construction and response parsing behind a module
  boundary.
- Owner boundary preserved: no new user-facing text, labels, states, panels, or
  explanatory UI were introduced.
- Design-system direction improved: the app entry file no longer owns internal
  API URL strings, token-header assembly, or JSON response parsing.
- Regression guard added: tests require the API client import, exported client
  functions, token header, and endpoint strings, while rejecting API endpoint
  strings and low-level request helpers in the app entry file.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-api-client.mjs`
- `npm run desktop:short-term:design-system-check`
  - Result: passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - First run: failed because one structure assertion still expected
    `name=invalid.svga` in the app entry after the invalid-inspection probe
    moved to the API client.
  - Repair: moved that assertion to the API client.
  - Final result: 30/30 passed.
- `npm run desktop:smoke`
  - Result: passed.

## Risks

- This is a structural componentization slice. It does not claim high-fidelity
  visual improvement by itself.
- Desktop smoke remains regression evidence only; visual or interaction
  acceptance still needs foreground macOS screenshots with real production SVGA
  files.

## Next Steps

- Continue reducing the main short-term app entry file by moving remaining
  proof-only and state-specific helper logic behind documented module
  boundaries.
