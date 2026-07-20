import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const externalSampleRoot = process.env.AUTO_SVGA_REAL_SAMPLE_ROOT;
const auditRuntimeRoot = path.join(experimentRoot, ".runtime/audit-samples");
const auditArtifactRoot = path.join(experimentRoot, ".artifacts/internal-trial");
const auditJsonPath = path.join(auditArtifactRoot, "real-sample-parity-audit.json");
const auditMarkdownPath = path.join(repoRoot, "docs/internal-electron-trial-real-sample-parity.md");
const selectedSamples = [
  ["sample-01-basic-small", "酷鹅玫影头像框/酷鹅玫影头像框.svga", "basic_legacy_small"],
  ["sample-02-production-size", "月汐星珠头像框/月汐星珠头像框.svga", "production_size_300"],
  ["sample-03-sequence-heavy", "贵族头像框7/贵族头像框7.svga", "sequence_heavy"],
  ["sample-04-sweep-glow", "金奢玫瑰/金奢玫瑰.svga", "sweep_glow_heavy"],
  ["sample-05-particle-heavy", "战狼头像框/战狼头像框.svga", "particle_heavy"],
  ["sample-06-mask-matte-candidate", "圣域君临头像框1/圣域君临头像框1.svga", "mask_matte_candidate"],
  ["sample-07-replaceable-key-candidate", "蓝色豪车头像框/蓝色豪车头像框.svga", "image_key_candidate"],
  ["sample-08-large-legacy", "猛虎头像框/猛虎头像框.svga", "large_legacy"]
];

await prepareRuntime();
if (!externalSampleRoot) {
  throw new Error("AUTO_SVGA_REAL_SAMPLE_ROOT is required and must point to a local external sample directory.");
}
const samples = await copySamples();
const baseline = runPlayerAudit("svgaplayerweb");
const candidate = runPlayerAudit("svga-web");
const comparison = compareResults(samples, baseline, candidate);
await mkdir(auditArtifactRoot, { recursive: true });
await writeFile(auditJsonPath, `${JSON.stringify(comparison, null, 2)}\n`);
await writeFile(auditMarkdownPath, renderMarkdown(comparison));
console.log(JSON.stringify({
  ok: comparison.summary.blocking === 0 && comparison.summary.major === 0,
  sampleCount: comparison.samples.length,
  summary: comparison.summary,
  json: path.relative(repoRoot, auditJsonPath),
  markdown: path.relative(repoRoot, auditMarkdownPath)
}));

async function prepareRuntime() {
  execFileSync("npm", ["run", "spike:svga-web:prepare"], {
    cwd: experimentRoot,
    stdio: "inherit"
  });
  await rm(auditRuntimeRoot, { recursive: true, force: true });
  await mkdir(auditRuntimeRoot, { recursive: true });
}

async function copySamples() {
  const samples = [];
  for (const [sampleId, relativePath, category] of selectedSamples) {
    const absolutePath = path.join(externalSampleRoot, relativePath);
    const fileName = `${sampleId}.svga`;
    const bytes = await readFile(absolutePath);
    await cp(absolutePath, path.join(auditRuntimeRoot, fileName));
    samples.push({
      sampleId,
      fileName,
      displayName: sampleId,
      category,
      sizeBytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex")
    });
  }
  await writeFile(path.join(auditRuntimeRoot, "manifest.json"), `${JSON.stringify({ samples }, null, 2)}\n`);
  return samples;
}

function runPlayerAudit(player) {
  const result = spawnSync("../../node_modules/.bin/electron", [".", `--audit-player=${player}`], {
    cwd: experimentRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const line = output.split(/\r?\n/).find((entry) => entry.startsWith("AUTO_SVGA_REAL_SAMPLE_AUDIT "));
  if (!line) {
    throw new Error(`Audit output missing for ${player}: ${redactOutput(output).slice(0, 1200)}`);
  }
  const audit = JSON.parse(line.slice("AUTO_SVGA_REAL_SAMPLE_AUDIT ".length));
  if (result.status !== 0) {
    throw new Error(`Audit failed for ${player}: ${redactOutput(output).slice(0, 1200)}`);
  }
  return audit;
}

function compareResults(samples, baseline, candidate) {
  const baselineById = new Map(baseline.samples.map((sample) => [sample.sampleId, sample]));
  const candidateById = new Map(candidate.samples.map((sample) => [sample.sampleId, sample]));
  const comparedSamples = samples.map((sample) => {
    const browser = baselineById.get(sample.sampleId);
    const electron = candidateById.get(sample.sampleId);
    const difference = classifyDifference(browser, electron);
    return {
      sampleId: sample.sampleId,
      category: sample.category,
      sizeBytes: sample.sizeBytes,
      sha256: sample.sha256,
      browser,
      electron,
      differenceSeverity: difference.severity,
      differenceNotes: difference.notes
    };
  });
  const summary = {
    blocking: comparedSamples.filter((sample) => sample.differenceSeverity === "blocking").length,
    major: comparedSamples.filter((sample) => sample.differenceSeverity === "major").length,
    minor: comparedSamples.filter((sample) => sample.differenceSeverity === "minor").length,
    none: comparedSamples.filter((sample) => sample.differenceSeverity === "none").length,
    inconclusive: comparedSamples.filter((sample) => sample.differenceSeverity === "inconclusive").length
  };
  return {
    generatedAt: new Date().toISOString(),
    sampleRoot: "external local sample root, not committed",
    browserBaseline: "local vendored svgaplayerweb@2.3.1 equivalent to current browser workflow player",
    electronCandidate: "isolated svga-web@2.4.4 internal prototype",
    automatedChecks: [
      "load success",
      "first frame nonblank",
      "playback started",
      "loop metadata present",
      "canvas nonblank",
      "inspection report",
      "Motion Asset Audit panel",
      "local-only resource loading"
    ],
    manualVisualChecks: [
      "alpha edge fidelity",
      "transform scale rotation layout parity",
      "mask matte parity",
      "sequence frame visual order",
      "sweep glow particle visual parity",
      "imageKey replacement parity"
    ],
    summary,
    samples: comparedSamples
  };
}

function classifyDifference(browser, electron) {
  if (!browser || !electron) return { severity: "blocking", notes: ["missing audit result"] };
  const browserCore = browser.loadSuccess && browser.playbackStarted && browser.canvasNonBlank;
  const electronCore = electron.loadSuccess && electron.playbackStarted && electron.canvasNonBlank;
  if (browserCore && !electronCore) return { severity: "blocking", notes: ["Electron candidate failed where browser baseline passed"] };
  if (!browserCore && electronCore) return { severity: "major", notes: ["Browser baseline failed where Electron candidate passed; baseline parity inconclusive"] };
  if (!browserCore && !electronCore) return { severity: "inconclusive", notes: ["Both environments failed core playback checks"] };
  const minorNotes = [];
  for (const key of ["inspectionReport", "auditPanel", "localOnly", "loopNormal"]) {
    if (browser[key] !== electron[key]) minorNotes.push(`${key} differs`);
  }
  return minorNotes.length > 0
    ? { severity: "minor", notes: minorNotes }
    : { severity: "none", notes: ["No automated difference detected"] };
}

function renderMarkdown(report) {
  const rows = report.samples.map((sample) => [
    sample.sampleId,
    sample.category,
    sample.sizeBytes,
    sample.browser?.severity ?? "missing",
    sample.electron?.severity ?? "missing",
    sample.differenceSeverity,
    sample.differenceNotes.join("; ")
  ]);
  return `# Internal Electron Trial Real-sample Parity Audit

## Summary

- Samples: ${report.samples.length}
- Browser baseline: ${report.browserBaseline}
- Electron candidate: ${report.electronCandidate}
- Blocking: ${report.summary.blocking}
- Major: ${report.summary.major}
- Minor: ${report.summary.minor}
- None: ${report.summary.none}
- Inconclusive: ${report.summary.inconclusive}
- Real assets committed: no

## Scope

This audit uses local external SVGA samples copied into ignored runtime storage.
The report stores sample IDs, categories, file sizes, and SHA-256 hashes, but no
absolute source paths and no asset bytes.

Automated checks cover loading, first nonblank frame, playback start, loop
metadata, nonblank canvas, inspection report, Motion Asset Audit panel, and
local-only resource loading.

Manual visual checks are still required for alpha edge fidelity, transform /
scale / rotation / layout parity, mask or matte behavior, sequence visual order,
sweep / glow / particle fidelity, and imageKey replacement behavior.

## Matrix

| Sample | Category | Size bytes | Browser baseline | Electron candidate | Difference | Notes |
|---|---:|---:|---|---|---|---|
${rows.map((row) => `| ${row.map(escapeMarkdown).join(" | ")} |`).join("\n")}

## Trial Readiness

Small-scope macOS internal trial is allowed only if blocking and major counts
remain zero. This does not approve production desktop distribution.

## Security Notes

- Electron candidate still uses restricted CSP with internal-only
  \`wasm-unsafe-eval\` exception.
- Browser baseline uses local vendored \`svgaplayerweb@2.3.1\` for parity
  evidence; it is not a production desktop security baseline.
- No AI, external model, telemetry, CDN runtime loading, or network analysis is
  used by this audit.
`;
}

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function redactOutput(value) {
  return String(value).replace(/(?:[A-Za-z]:\\|\/Users\/|\/home\/)[^\s"']+/g, "<local-path>");
}
