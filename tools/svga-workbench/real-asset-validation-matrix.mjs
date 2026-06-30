#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const defaultRoot = path.join(os.homedir(), "Downloads", "auto-svga测试物料");
const defaultArtifactRoot = path.join(repoRoot, ".artifacts/product/SVGA-Workbench-v1/real-assets");
const args = parseArgs(process.argv.slice(2));
const assetRoot = path.resolve(args.root ?? process.env.AUTO_SVGA_REAL_ASSET_ROOT ?? defaultRoot);
const outputPath = path.resolve(args.out ?? path.join(defaultArtifactRoot, "real-asset-validation-matrix.json"));
const summaryPath = path.resolve(args.summary ?? path.join(defaultArtifactRoot, "real-asset-validation-matrix.md"));
const limit = args.limit ? Number(args.limit) : undefined;
const headCommit = git(["rev-parse", "HEAD"]);
const headTree = git(["rev-parse", "HEAD^{tree}"]);

await assertDirectory(assetRoot);
await mkdir(path.dirname(outputPath), { recursive: true });
await mkdir(path.dirname(summaryPath), { recursive: true });

const modules = await loadBuiltModules();
const index = await readWorkbenchSampleIndex(assetRoot);
const discoveredFiles = await walkFiles(assetRoot);
const svgaFiles = discoveredFiles
  .filter((filePath) => filePath.toLowerCase().endsWith(".svga"))
  .sort((left, right) => relativeAssetPath(left).localeCompare(relativeAssetPath(right), "zh-Hans-CN"))
  .slice(0, limit);
const pngFiles = discoveredFiles
  .filter((filePath) => filePath.toLowerCase().endsWith(".png"))
  .sort((left, right) => relativeAssetPath(left).localeCompare(relativeAssetPath(right), "zh-Hans-CN"));

const svgaRows = [];
for (const filePath of svgaFiles) {
  svgaRows.push(await inspectSvgaFile(filePath, modules, index));
}
const syntheticCases = [await inspectSyntheticCorruptSvga(modules)];
const pngCompatibility = await inspectPngReplacementCompatibility(pngFiles);
const report = buildReport({
  index,
  svgaRows,
  syntheticCases,
  pngCompatibility,
  discoveredFileCount: discoveredFiles.length,
  discoveredSvgaCount: discoveredFiles.filter((filePath) => filePath.toLowerCase().endsWith(".svga")).length,
  discoveredPngCount: pngFiles.length
});

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(summaryPath, renderMarkdown(report));

console.log(JSON.stringify({
  passed: report.passed,
  reportPath: path.relative(repoRoot, outputPath),
  summaryPath: path.relative(repoRoot, summaryPath),
  svgaCount: report.summary.svgaCount,
  parsedCount: report.summary.parsedCount,
  replacementCandidateCount: report.summary.replacementCandidateCount,
  sequenceRepairAttemptCount: report.summary.sequenceRepairAttemptCount,
  sequenceRepairErrors: report.sequenceRepairErrorSummary,
  pngIndexedColorType3Count: report.pngReplacementCompatibility.indexedColorType3Count
}, null, 2));

if (!report.passed) process.exitCode = 1;

async function loadBuiltModules() {
  try {
    const [
      svga,
      alpha,
      hasher,
      memory,
      sequenceResidency,
      sequenceEvidence,
      intelligence
    ] = await Promise.all([
      import(pathToFileURL(path.join(repoRoot, "dist/workbench/svga/index.js")).href),
      import(pathToFileURL(path.join(repoRoot, "dist/hosts/fast-png-alpha-analyzer.js")).href),
      import(pathToFileURL(path.join(repoRoot, "dist/hosts/sha256-resource-hasher.js")).href),
      import(pathToFileURL(path.join(repoRoot, "dist/workbench/memory-estimation.js")).href),
      import(pathToFileURL(path.join(repoRoot, "dist/workbench/sequence-residency-diagnostics.js")).href),
      import(pathToFileURL(path.join(repoRoot, "dist/workbench/sequence-frame-evidence.js")).href),
      import(pathToFileURL(path.join(repoRoot, "dist/workbench/asset-intelligence.js")).href)
    ]);
    return { svga, alpha, hasher, memory, sequenceResidency, sequenceEvidence, intelligence };
  } catch (error) {
    throw new Error(`Built Workbench modules are unavailable. Run npm run build first. ${errorMessage(error)}`);
  }
}

async function inspectSvgaFile(filePath, modules, index) {
  const bytes = new Uint8Array(await readFile(filePath));
  const info = await stat(filePath);
  const relativePath = relativeAssetPath(filePath);
  const sha256 = digest(bytes);
  const source = {
    id: `real-asset:${sha256}`,
    name: path.basename(filePath),
    sizeBytes: bytes.byteLength,
    mediaType: "application/octet-stream",
    async read() {
      return bytes;
    }
  };
  const indexRecord = index.byRelativePath.get(relativePath);
  const row = {
    relativePath,
    sizeBytes: info.size,
    sha256,
    sourceRole: indexRecord?.workflow ?? "discovered_svga",
    category: indexRecord?.category ?? inferCategory(relativePath),
    sampleName: indexRecord?.name ?? path.basename(filePath, path.extname(filePath)),
    rawAssetIncluded: false,
    parse: { passed: false },
    previewLoadCandidate: false,
    assetIntelligence: { generated: false },
    safeOptimization: { candidateCount: 0, skippedOrRiskyCount: 0 },
    replacement: { candidateCount: 0, unsupportedCount: 0 },
    sequenceRepair: { attempted: false, status: "not_attempted" },
    capabilityClasses: []
  };

  const adapter = new modules.svga.SvgaFormatAdapter(
    new modules.svga.NodeProtobufSvgaInspector(),
    new modules.alpha.FastPngAlphaAnalyzer(),
    new modules.hasher.Sha256ResourceHasher()
  );
  const parseResult = await adapter.parse(source);
  if (!parseResult.value) {
    row.parse = {
      passed: false,
      issueCodes: parseResult.issues.map(({ code }) => code),
      message: parseResult.issues[0]?.message ?? "parse failed"
    };
    row.capabilityClasses.push("fail_closed_parse_rejected");
    return row;
  }

  const asset = parseResult.value;
  const memory = modules.memory.estimateDecodedMemory(asset.resources);
  const sequenceResidencyDiagnostics = modules.sequenceResidency.diagnoseSequenceResidency(asset.resources, memory);
  const sequenceFrameEvidence = modules.sequenceEvidence.collectSequenceFrameEvidence(asset.resources);
  const assetIntelligence = modules.intelligence.createAssetIntelligenceReport({
    asset,
    issues: parseResult.issues,
    memoryEstimation: memory,
    sequenceResidencyDiagnostics,
    sequenceFrameEvidence
  });
  const editSession = await createEditSession(modules, bytes, source.name);

  row.parse = {
    passed: true,
    canvas: asset.dimensions,
    fps: asset.timing.fps,
    frameCount: asset.timing.frameCount,
    imageCount: Number(asset.metadata?.imageCount ?? asset.resources.length),
    spriteCount: Number(asset.metadata?.spriteCount ?? asset.layers.length),
    audioCount: Number(asset.metadata?.audioCount ?? 0)
  };
  row.previewLoadCandidate = true;
  row.assetIntelligence = {
    generated: true,
    resourceCount: assetIntelligence.summary.resourceCount,
    findingCount: assetIntelligence.summary.findingCount,
    safeAutoOptimizeFindingCount: assetIntelligence.summary.safeAutoOptimizeFindingCount,
    unsupportedFindingCount: assetIntelligence.summary.unsupportedFindingCount,
    memoryRiskLevel: memory.memoryRiskLevel,
    decodedMemoryBytes: memory.totalEstimatedDecodedResourceBytes,
    sequenceGroupCount: sequenceResidencyDiagnostics.sequenceGroupCount,
    sequenceEvidenceConfidence: sequenceFrameEvidence.evidenceConfidence
  };
  row.safeOptimization = {
    candidateCount: assetIntelligence.summary.safeAutoOptimizeFindingCount,
    skippedOrRiskyCount: assetIntelligence.findings.filter((finding) => !finding.safeToAutoOptimize).length,
    findingCodes: [...new Set(assetIntelligence.findings.map(({ code }) => code))].sort()
  };
  row.replacement = editSession;
  row.sequenceRepair = await attemptSequenceRepair(modules, bytes, source.name);
  row.capabilityClasses = classifyRow(row);
  return row;
}

async function createEditSession(modules, bytes, name) {
  try {
    const editor = new modules.svga.SvgaImageResourceEditor();
    const session = await editor.createSession(bytes, name);
    const editableResources = session.imageResources.filter((resource) => (
      resource.validationStatus === "valid" && resource.usageCount > 0
    ));
    return {
      candidateCount: editableResources.length,
      unsupportedCount: session.imageResources.length - editableResources.length,
      totalImageResourceCount: session.imageResources.length,
      usedImageResourceCount: session.imageResources.filter((resource) => resource.usageCount > 0).length,
      limitation: "PNG replacement only; text/key/URL/timeline editing remains unsupported."
    };
  } catch (error) {
    return {
      candidateCount: 0,
      unsupportedCount: 0,
      errorCode: error?.code ?? error?.name ?? "edit_session_failed",
      message: errorMessage(error)
    };
  }
}

async function attemptSequenceRepair(modules, bytes, name) {
  try {
    const result = await modules.svga.repairSvgaSequenceFrameFlicker(bytes, {
      sourceName: name,
      headCommit
    });
    return {
      attempted: true,
      status: "repaired_candidate",
      productSaveAsEnabled: result.report.productSaveAsEnabled,
      repairSuccessClaimed: result.report.repairSuccessClaimed,
      manualVisualConfirmationRequired: result.report.manualVisualConfirmationRequired,
      repairedResourceKey: result.report.sequenceGroup.repairedResourceKey,
      selectionRule: result.report.selectedRepair.selectionRule ?? "unspecified",
      resourceKeyCount: result.report.sequenceGroup.resourceKeyCount,
      editedSha256: result.report.editedSha256,
      failureClosed: result.report.failureClosed,
      passed: result.report.passed
    };
  } catch (error) {
    return {
      attempted: true,
      status: "fail_closed_or_unsupported",
      errorCode: error?.code ?? error?.name ?? "sequence_repair_failed",
      message: errorMessage(error),
      details: redactedErrorDetails(error),
      failureClosed: true
    };
  }
}

function redactedErrorDetails(error) {
  if (!error || typeof error !== "object" || !("details" in error)) return undefined;
  return JSON.parse(JSON.stringify(error.details));
}

async function inspectSyntheticCorruptSvga(modules) {
  const bytes = Uint8Array.from([1, 2, 3, 4]);
  const adapter = new modules.svga.SvgaFormatAdapter(new modules.svga.NodeProtobufSvgaInspector());
  const result = await adapter.parse({
    id: "synthetic:corrupt-svga",
    name: "synthetic-corrupt.svga",
    sizeBytes: bytes.byteLength,
    mediaType: "application/octet-stream",
    async read() {
      return bytes;
    }
  });
  return {
    id: "synthetic-corrupt-svga",
    rawAssetIncluded: false,
    parsePassed: Boolean(result.value),
    issueCodes: result.issues.map(({ code }) => code),
    expectedBehavior: "fail_closed_parse_rejected"
  };
}

async function inspectPngReplacementCompatibility(pngFiles) {
  const records = [];
  for (const filePath of pngFiles) {
    const bytes = await readFile(filePath);
    const header = inspectPngHeader(bytes);
    records.push({
      relativePath: relativeAssetPath(filePath),
      sizeBytes: bytes.byteLength,
      sha256: digest(bytes),
      ...header,
      replacementDecodeRisk: header.colorType === 3
        ? "indexed_png_color_type_3_needs_palette_decode_support"
        : "none_detected_from_header"
    });
  }
  const byColorType = countBy(records, (record) => String(record.colorType ?? "unknown"));
  const indexed = records.filter((record) => record.colorType === 3);
  return {
    scannedPngCount: records.length,
    byColorType,
    indexedColorType3Count: indexed.length,
    indexedColorType3Samples: indexed.slice(0, 12),
    note: "PNG color type 3 means indexed/palette PNG. Current replacement decode paths can reject it unless palette decoding is supported."
  };
}

function inspectPngHeader(bytes) {
  const signature = bytes.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a" || bytes.length < 33) {
    return { pngHeaderValid: false };
  }
  return {
    pngHeaderValid: true,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25]
  };
}

function buildReport({
  index,
  svgaRows,
  syntheticCases,
  pngCompatibility,
  discoveredFileCount,
  discoveredSvgaCount,
  discoveredPngCount
}) {
  const parsedRows = svgaRows.filter((row) => row.parse.passed);
  const sequenceAttempts = svgaRows.filter((row) => row.sequenceRepair.attempted);
  const repairedRows = svgaRows.filter((row) => row.sequenceRepair.status === "repaired_candidate");
  const replacementCandidateCount = svgaRows.filter((row) => row.replacement.candidateCount > 0).length;
  const optimizationCandidateCount = svgaRows.filter((row) => row.safeOptimization.candidateCount > 0).length;
  const failClosedSequenceCount = sequenceAttempts.filter((row) => (
    row.sequenceRepair.status === "fail_closed_or_unsupported" && row.sequenceRepair.failureClosed
  )).length;
  const requiredCoverage = [
    {
      id: "single_file_preview_parse",
      passed: parsedRows.length > 0,
      evidence: `${parsedRows.length} parsed SVGA rows`
    },
    {
      id: "phase2_asset_intelligence",
      passed: parsedRows.every((row) => row.assetIntelligence.generated),
      evidence: `${parsedRows.length} generated reports`
    },
    {
      id: "phase2_safe_optimization_candidate_or_explicit_none",
      passed: parsedRows.length > 0,
      evidence: `${optimizationCandidateCount} rows expose safe optimization candidates`
    },
    {
      id: "phase3_png_replacement_candidate",
      passed: replacementCandidateCount > 0,
      evidence: `${replacementCandidateCount} rows expose supported PNG replacement candidates`
    },
    {
      id: "phase4_sequence_repair_fail_closed_or_repaired",
      passed: sequenceAttempts.length > 0 && sequenceAttempts.every((row) => (
        row.sequenceRepair.status === "repaired_candidate"
        || (row.sequenceRepair.status === "fail_closed_or_unsupported" && row.sequenceRepair.failureClosed)
      )),
      evidence: `${repairedRows.length} repaired candidates, ${failClosedSequenceCount} fail-closed/unsupported attempts`
    },
    {
      id: "invalid_corrupt_svga_rejected",
      passed: syntheticCases.some((item) => item.expectedBehavior === "fail_closed_parse_rejected" && !item.parsePassed),
      evidence: "synthetic corrupt SVGA parse rejected"
    },
    {
      id: "png_replacement_color_type_boundary_recorded",
      passed: pngCompatibility.scannedPngCount > 0,
      evidence: `${pngCompatibility.indexedColorType3Count} indexed PNG color-type-3 files recorded`
    }
  ];
  const passed = requiredCoverage.every((item) => item.passed);
  const sequenceRepairErrorSummary = summarizeSequenceRepairErrors(sequenceAttempts);
  return {
    schemaVersion: 1,
    reportId: "REAL_ASSET_VALIDATION_MATRIX",
    generatedAt: new Date().toISOString(),
    headCommit,
    headTree,
    assetRoot: "external_local_redacted",
    rawAssetsIncluded: false,
    sourceIndex: {
      present: index.present,
      relativePath: index.present ? "分类索引_20260630/Workbench测试样本.json" : null,
      workflowCount: index.workflowCount,
      indexedFileCount: index.byRelativePath.size
    },
    discovered: {
      fileCount: discoveredFileCount,
      svgaCount: discoveredSvgaCount,
      pngCount: discoveredPngCount
    },
    summary: {
      svgaCount: svgaRows.length,
      parsedCount: parsedRows.length,
      parseFailedCount: svgaRows.length - parsedRows.length,
      safeOptimizationCandidateAssetCount: optimizationCandidateCount,
      replacementCandidateCount,
      sequenceRepairAttemptCount: sequenceAttempts.length,
      sequenceRepairedCandidateCount: repairedRows.length,
      sequenceFailClosedOrUnsupportedCount: failClosedSequenceCount
    },
    requiredCoverage,
    sequenceRepairErrorSummary,
    passed,
    rows: svgaRows,
    syntheticCases,
    pngReplacementCompatibility: pngCompatibility
  };
}

function summarizeSequenceRepairErrors(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (row.sequenceRepair.status === "repaired_candidate") continue;
    const key = `${row.sequenceRepair.errorCode ?? "unknown"}\n${row.sequenceRepair.message ?? ""}`;
    const existing = groups.get(key) ?? {
      errorCode: row.sequenceRepair.errorCode ?? "unknown",
      message: row.sequenceRepair.message ?? "",
      count: 0
    };
    existing.count += 1;
    groups.set(key, existing);
  }
  return [...groups.values()].sort((left, right) => right.count - left.count);
}

function classifyRow(row) {
  const classes = [];
  if (!row.parse.passed) return ["fail_closed_parse_rejected"];
  classes.push("single_file_preview_candidate", "phase2_asset_intelligence_candidate");
  if (row.category.includes("头像框")) classes.push("avatar_frame_style_asset");
  if (row.sourceRole === "nonAvatarBoundary") classes.push("non_avatar_boundary_asset");
  if (row.safeOptimization.candidateCount > 0) classes.push("phase2_safe_optimization_candidate");
  else classes.push("phase2_no_safe_optimization_candidate");
  if (row.replacement.candidateCount > 0) classes.push("phase3_png_replacement_candidate");
  if (row.assetIntelligence.sequenceGroupCount > 0) classes.push("sequence_frame_group_detected");
  if (row.sequenceRepair.status === "repaired_candidate") classes.push("phase4_sequence_repair_candidate");
  if (row.sequenceRepair.status === "fail_closed_or_unsupported") classes.push("phase4_sequence_repair_fail_closed_or_unsupported");
  if (row.assetIntelligence.memoryRiskLevel === "high") classes.push("decoded_memory_high_risk");
  if (row.assetIntelligence.memoryRiskLevel === "medium") classes.push("decoded_memory_medium_risk");
  return classes;
}

async function readWorkbenchSampleIndex(root) {
  const indexPath = path.join(root, "分类索引_20260630", "Workbench测试样本.json");
  const byRelativePath = new Map();
  try {
    const json = JSON.parse(await readFile(indexPath, "utf8"));
    for (const [workflow, entries] of Object.entries(json)) {
      for (const entry of Array.isArray(entries) ? entries : []) {
        for (const file of entry.files ?? []) {
          byRelativePath.set(normalizeRelativePath(file), {
            workflow,
            category: entry.category ?? inferCategory(file),
            name: entry.name ?? path.basename(file, path.extname(file))
          });
        }
      }
    }
    return {
      present: true,
      workflowCount: Object.keys(json).length,
      byRelativePath
    };
  } catch {
    return {
      present: false,
      workflowCount: 0,
      byRelativePath
    };
  }
}

async function walkFiles(root) {
  const result = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (entry.isFile()) {
        result.push(absolute);
      }
    }
  }
  return result;
}

function renderMarkdown(report) {
  const rows = report.rows.map((row) => [
    row.sampleName,
    row.category,
    row.sizeBytes,
    row.parse.passed ? "yes" : "no",
    row.assetIntelligence.resourceCount ?? 0,
    row.safeOptimization.candidateCount,
    row.replacement.candidateCount,
    row.sequenceRepair.status,
    row.capabilityClasses.join(", ")
  ]);
  return `# Real Asset Validation Matrix

- Report: ${report.reportId}
- Head: \`${report.headCommit}\`
- Raw assets included: ${report.rawAssetsIncluded ? "yes" : "no"}
- SVGA rows: ${report.summary.svgaCount}
- Parsed: ${report.summary.parsedCount}
- Safe optimization candidate assets: ${report.summary.safeOptimizationCandidateAssetCount}
- PNG replacement candidate assets: ${report.summary.replacementCandidateCount}
- Sequence repaired candidates: ${report.summary.sequenceRepairedCandidateCount}
- Sequence fail-closed or unsupported attempts: ${report.summary.sequenceFailClosedOrUnsupportedCount}
- Indexed PNG color type 3 files: ${report.pngReplacementCompatibility.indexedColorType3Count}
- Passed coverage: ${report.passed ? "yes" : "no"}

## Required Coverage

| id | passed | evidence |
| --- | --- | --- |
${report.requiredCoverage.map((item) => `| ${escapeMarkdown(item.id)} | ${item.passed ? "yes" : "no"} | ${escapeMarkdown(item.evidence)} |`).join("\n")}

## Sequence Repair Outcomes

| error code | count | message |
| --- | ---: | --- |
${report.sequenceRepairErrorSummary.map((item) => `| ${escapeMarkdown(item.errorCode)} | ${item.count} | ${escapeMarkdown(item.message)} |`).join("\n")}

## SVGA Rows

| sample | category | bytes | parsed | resources | optimize | replace | sequence | classes |
| --- | --- | ---: | --- | ---: | ---: | ---: | --- | --- |
${rows.map((row) => `| ${row.map(escapeMarkdown).join(" | ")} |`).join("\n")}
`;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") parsed.root = argv[++index];
    else if (arg === "--out") parsed.out = argv[++index];
    else if (arg === "--summary") parsed.summary = argv[++index];
    else if (arg === "--limit") parsed.limit = argv[++index];
  }
  return parsed;
}

async function assertDirectory(directory) {
  const info = await stat(directory).catch(() => undefined);
  if (!info?.isDirectory()) {
    throw new Error(`Real asset root is unavailable: ${directory}`);
  }
}

function relativeAssetPath(filePath) {
  return normalizeRelativePath(path.relative(assetRoot, filePath));
}

function normalizeRelativePath(value) {
  return String(value).split(path.sep).join("/");
}

function inferCategory(relativePath) {
  const segments = normalizeRelativePath(relativePath).split("/");
  return segments.find((segment) => /^\d+_/.test(segment)) ?? segments[0] ?? "unknown";
}

function countBy(items, keyFor) {
  const counts = {};
  for (const item of items) {
    const key = keyFor(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function git(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) return "";
  return result.stdout.trim();
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}
