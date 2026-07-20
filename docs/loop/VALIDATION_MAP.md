# Auto SVGA Validation Map

Date: 2026-06-19

## Baseline Commands Run

| Area | Command | Result | Notes |
| --- | --- | --- | --- |
| TypeScript build | `npm run build` | Passed | Compiles `src` to `dist`. Mutates `dist`. |
| Root tests | `npm test` | Passed, 155 tests | Runs `tsc` and `node --test dist/tests/*.test.js`. |
| Example validation | `npm run validate:example` | Passed | Validates `examples/avatar_frame_basic`. |
| Launcher tests | `node --test tools/launch-local-preview.test.mjs` | Passed, 3 tests | Covers existing service detection, unknown port safety, startup cleanup. |
| Web inspection tests | `node --test tools/svga-player-preview/inspection-report-view.test.mjs tools/svga-player-preview/server-inspection-report.test.mjs` | Passed, 13 tests | Covers report rendering and HTTP inspection boundary. |
| Web syntax checks | `node --check tools/svga-player-preview/main.js && node --check tools/svga-player-preview/server.mjs && node --check tools/launch-local-preview.mjs` | Passed | No output on success. |
| Web local smoke | Local random-port preview server fetch for `/tools/svga-player-preview/` and `/api/latest-artifact` | Passed | Page 200, API 200, 2 artifacts discovered. |
| Electron prototype tests | `npm --prefix tools/electron-prototype run spike:electron:test` | Passed, 3 tests | Sequential run required; parallel run can race on shared `.runtime`. |
| svga-web prototype tests | `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test` | Passed, 5 tests | Isolated experiment only. |
| svga-web prototype smoke | `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:smoke` | Passed | Local page, local-only assets, playback, nonblank canvas, report, Audit panel, file input, drag-drop, cleanup. |

## Existing Validation Commands

| Category | Command | Safe For Default Loop | Mutates Workspace | Baseline | Notes |
| --- | --- | --- | --- | --- | --- |
| Build / typecheck | `npm run build` | Yes | Yes, `dist` | Passed | Main type/build gate. |
| Full root tests | `npm test` | Yes | Yes, `dist` and temp files | Passed, 155 tests | Best current root regression gate. |
| Focused MVP test | `npm run test:mvp` | Yes | Yes, `dist` | Not run separately | Covered by `npm test`. |
| Example validation | `npm run validate:example` | Yes | Yes, `dist`; reads example | Passed | Safe validation command. |
| Example build | `npm run build:example` | No by default | Yes, writes example outputs | Not run | Mutating generation command. |
| Example export | `npm run export:example` | No by default | Yes, writes SVGA outputs | Not run | Mutating generation command. |
| CLI plan | `npm run autosvga:plan -- <job>` | Task-dependent | Yes | Not run | Requires explicit job path and output allowance. |
| CLI preview | `npm run autosvga:preview -- <job>` | Task-dependent | Yes | Not run | Generates visual output. |
| CLI report | `npm run autosvga:report -- <job>` | Task-dependent | Yes | Not run | Updates report files. |
| CLI export | `npm run autosvga:export -- <job>` | Task-dependent | Yes | Not run | Produces real `.svga`. |
| CLI package | `npm run autosvga:package -- <job>` | Task-dependent | Yes | Not run | Produces delivery zip. |
| CLI accept | `npm run autosvga:accept -- <job>` | Task-dependent | Yes | Not run | Writes acceptance state. |
| Web preview server | `npm run preview:player` | Manual / smoke only | No expected source changes | Local smoke passed by direct server import | Long-running server command. |
| Local launcher | `npm run local:preview` | Manual / smoke only | Starts child process | Covered by launcher tests | Opens browser; not ideal for headless loop default. |
| Launcher tests | `node --test tools/launch-local-preview.test.mjs` | Yes | Temp/process only | Passed, 3 tests | Safe loop candidate. |
| Web report tests | `node --test tools/svga-player-preview/inspection-report-view.test.mjs tools/svga-player-preview/server-inspection-report.test.mjs` | Yes | Temp only | Passed, 13 tests | Safe loop candidate. |
| Web syntax | `node --check ...` | Yes | No | Passed | Safe fast check. |
| Electron prototype tests | `npm --prefix tools/electron-prototype run spike:electron:test` | Yes, sequential only | Ignored `.runtime` | Passed, 3 tests | Do not run in parallel with svga-web prepare. |
| svga-web experiment tests | `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test` | Yes, sequential only | Ignored `.runtime` | Passed, 5 tests | Isolated prototype only. |
| svga-web smoke | `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:smoke` | Optional Tier 3 | Ignored `.runtime`; launches Electron | Passed | Heavier smoke, useful before desktop trial work. |
| Lint | None found | Not available | N/A | Not available | Add a lint command before relying on Agent Loop style gates. |
| Format check | None found | Not available | N/A | Not available | No formatter gate discovered. |
| Performance tests | No dedicated script found | Not available | N/A | Not available | Memory/performance primitives are covered by unit tests, not benchmark tests. |
| Visual artifact generation | preview/export/build/package commands | No by default | Yes | Not run | Requires explicit task permission and artifact cleanup rules. |

## Machine-Verifiable Acceptance

The following are currently machine-verifiable:

- TypeScript compilation.
- Unit and integration behavior in `src/tests`.
- SVGA protobuf structure checks used by exporter-related tests.
- MotionAssetInfo, FormatAdapter, inspection service, spec checker, Motion Asset Audit, format recommendation contracts.
- Web inspection report rendering and HTTP inspection boundary.
- Local launcher behavior.
- Isolated Electron prototype security settings and smoke behavior.
- Nonblank canvas smoke in isolated svga-web prototype.
- Basic local preview server availability.

## Human-Or Visual-Review Acceptance

The following still require human or visual judgement:

- Premium animation quality.
- Exact visual parity between preview GIF, Web player, Electron prototype, and real SVGA players.
- Alpha edge quality, antialiasing, glow/sweep aesthetics, and loop feel.
- Whether a production avatar frame should be accepted or rejected.
- Product approval for thresholds and format recommendations.
- Security approval for any desktop production release.
- Real external sample parity, because real user assets are not committed.

## Commands Not Run In This Audit

- Mutating generation commands: `build:example`, `export:example`, job `plan/preview/report/export/package/accept`.
- Full Electron packaging commands.
- Real external sample parity.
- Network-based dependency/security scans.

These are valid in task-specific loops only when the task explicitly allows generated artifacts, package artifacts, or external samples.
