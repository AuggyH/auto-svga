"use strict";

const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const {
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} = require("node:fs");
const path = require("node:path");
const {
  createMultiFormatDesktopPreviewSession
} = require("../multiformat-desktop-session.cjs");

const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "../../../..");
const bindingPath = String(process.env.AUTO_SVGA_REAL_MATERIAL_COMPAT_BINDING ?? "").trim();

const matrix = Object.freeze([
  { alias: "SVGA-BASELINE", format: "svga", status: "playing" },
  { alias: "SVGA-A", format: "svga", status: "playing" },
  { alias: "SVGA-B", format: "svga", status: "playing" },
  { alias: "SVGA-C", format: "svga", status: "playing" },
  { alias: "SVGA-D", format: "svga", status: "playing" },
  { alias: "LOTTIE-NEAR-LIMIT", format: "lottie", status: "playing", images: 72 },
  { alias: "LOTTIE-LEGACY-SHAPE", format: "lottie", status: "playing", images: 0 },
  { alias: "LOTTIE-EXPRESSION-MASK", format: "lottie", status: "playbackBlocked", issueCode: "unsupported_feature", images: 80 },
  { alias: "LOTTIE-EXTERNAL-BUNDLE", format: "lottie", status: "playbackBlocked", issueCode: "unsupported_feature", images: 27 },
  { alias: "LOTTIE-FONT-NEGATIVE", format: "lottie", status: "playbackBlocked", issueCode: "owner_issue", images: 1, texts: 1 },
  { alias: "VAP-NO-FUSION", format: "vap", status: "playing", images: 0, texts: 0 },
  { alias: "VAP-MIXED-FUSION", format: "vap", status: "playing", images: 2, texts: 3 }
]);

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main() {
  const binding = readBinding();
  const proofRoot = path.join(binding.root, "source-classification");
  const proofPath = path.join(binding.root, "source-classification-proof.json");
  mkdirSync(proofRoot, { recursive: true, mode: 0o700 });
  const rows = [];
  try {
    for (const spec of matrix) {
      rows.push(await inspect(spec, binding.entries.get(spec.alias), proofRoot));
    }
    const proof = {
      schemaVersion: 1,
      status: "classified",
      sourceHead: gitHead(),
      inputBindingSha256: sha256File(bindingPath),
      rows,
      pathRedacted: true,
      boundaries: {
        foreground: false,
        runtimePixels: false,
        originalMaterialsMutated: false,
        rawPathsPublished: false
      }
    };
    assertNoRawPathLeak(proof, binding);
    writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ proofPath, sha256: sha256File(proofPath), rows: rows.length })}\n`);
  } finally {
    rmSync(proofRoot, { recursive: true, force: true });
  }
}

function readBinding() {
  if (!bindingPath || !path.isAbsolute(bindingPath)) {
    throw new Error("A private absolute real-material compatibility binding is required.");
  }
  const bindingLinkStat = lstatSync(bindingPath);
  const bindingStat = statSync(bindingPath);
  if (!bindingLinkStat.isFile() || bindingLinkStat.isSymbolicLink() || (bindingStat.mode & 0o777) !== 0o600) {
    throw new Error("The real-material compatibility binding must use mode 0600.");
  }
  const parsed = JSON.parse(readFileSync(bindingPath, "utf8"));
  if (parsed?.schemaVersion !== 1 || typeof parsed.root !== "string" || !path.isAbsolute(parsed.root)) {
    throw new Error("The real-material compatibility binding is malformed.");
  }
  const entries = new Map();
  for (const entry of parsed.entries ?? []) {
    if (!matrix.some(({ alias }) => alias === entry.alias)) continue;
    if (!entry.copy || !path.isAbsolute(entry.copy) || !entry.copy.startsWith(`${parsed.root}${path.sep}`)) {
      throw new Error(`${entry.alias} copy binding is outside the task root.`);
    }
    const copyStat = lstatSync(entry.copy);
    if (!copyStat.isFile() || copyStat.isSymbolicLink() || copyStat.nlink !== 1) {
      throw new Error(`${entry.alias} copy is outside the regular-file contract.`);
    }
    if (copyStat.size !== entry.copyBytes || sha256File(entry.copy) !== entry.copySha256) {
      throw new Error(`${entry.alias} copy identity drifted.`);
    }
    entries.set(entry.alias, entry);
  }
  for (const { alias } of matrix) {
    if (!entries.has(alias)) throw new Error(`${alias} is missing from the private binding.`);
  }
  const externalResources = parsed.externalResources;
  if (
    externalResources?.alias !== "LOTTIE-EXTERNAL-RESOURCES"
    || externalResources.count !== 27
    || !Array.isArray(externalResources.resources)
    || externalResources.resources.length !== externalResources.count
  ) {
    throw new Error("The external-image Lottie resource binding is incomplete.");
  }
  for (const resource of externalResources.resources) {
    if (!resource.copy || !path.isAbsolute(resource.copy) || !resource.copy.startsWith(`${parsed.root}${path.sep}`)) {
      throw new Error("An external-image Lottie resource is outside the task root.");
    }
    const resourceStat = lstatSync(resource.copy);
    if (
      !resourceStat.isFile()
      || resourceStat.isSymbolicLink()
      || resourceStat.nlink !== 1
      || resourceStat.size !== resource.bytes
      || sha256File(resource.copy) !== resource.copySha256
    ) {
      throw new Error("An external-image Lottie resource identity drifted.");
    }
  }
  return {
    root: parsed.root,
    entries,
    rawPaths: [
      ...(parsed.entries ?? []).flatMap((entry) => [entry.source, entry.copy]),
      ...externalResources.resources.flatMap((resource) => [resource.source, resource.copy])
    ].filter(Boolean)
  };
}

async function inspect(spec, entry, proofRoot) {
  const sessionRoot = path.join(proofRoot, slug(spec.alias));
  mkdirSync(sessionRoot, { recursive: true, mode: 0o700 });
  const sourceStore = new Map();
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot,
    sourceStore,
    openTimeoutMs: 15_000
  });
  try {
    const opened = await session.openLocalFilePath(entry.copy, "fileOpenEvent");
    const model = opened?.model;
    let prepared;
    if (["previewReady", "playing", "paused"].includes(model?.status)) {
      prepared = await session.prepareRuntimePreview({
        sourceId: opened.sourceId,
        format: spec.format,
        requestId: model.requestId,
        replacements: []
      });
    }
    const issues = Array.isArray(model?.rightPanel?.issues) ? model.rightPanel.issues : [];
    const inventory = model?.rightPanel?.assetInventory?.summary ?? {};
    const row = {
      alias: spec.alias,
      sha256: entry.copySha256,
      byteLength: entry.copyBytes,
      expectedFormat: spec.format,
      detectedFormat: model?.detectedFormat,
      openStatus: model?.status,
      runtimeStatus: prepared?.status ?? "notPrepared",
      runtimeIssueCode: prepared?.issue?.code,
      issueCodes: issues.map((issue) => issue?.code).filter(Boolean),
      dimensions: factValue(model, "dimensions"),
      duration: factValue(model, "duration"),
      frameRate: factValue(model, "frame_rate"),
      inventory: {
        totalItems: finiteCount(inventory.totalItems),
        imageCount: finiteCount(inventory.imageCount),
        textCount: finiteCount(inventory.textCount),
        audioVideoCount: finiteCount(inventory.audioVideoCount),
        replaceableItems: finiteCount(inventory.replaceableItems)
      },
      payload: {
        svgaBytes: typeof prepared?.svgaBase64 === "string" ? Buffer.from(prepared.svgaBase64, "base64").byteLength : 0,
        lottieAssets: Array.isArray(prepared?.animationData?.assets) ? prepared.animationData.assets.length : 0,
        lottieInlinedImages: Array.isArray(prepared?.animationData?.assets)
          ? prepared.animationData.assets.filter((asset) => typeof asset?.p === "string" && asset.p.startsWith("data:image/")).length
          : 0,
        vapBytes: typeof prepared?.mp4Base64 === "string" ? Buffer.from(prepared.mp4Base64, "base64").byteLength : 0,
        vapFusionImages: Array.isArray(prepared?.vapConfig?.src)
          ? prepared.vapConfig.src.filter((entry) => entry?.srcType === "img").length
          : 0,
        vapFusionText: Array.isArray(prepared?.vapConfig?.src)
          ? prepared.vapConfig.src.filter((entry) => entry?.srcType === "txt").length
          : 0
      },
      lifecycleBeforeDispose: { ...session.lifecycle },
      pathRedacted: opened?.pathRedacted === true
    };
    assertExpectedClassification(spec, row);
    return row;
  } finally {
    await session.control({ action: "dispose" }).catch(() => {});
    sourceStore.clear();
  }
}

function assertExpectedClassification(spec, row) {
  if (row.detectedFormat !== spec.format || row.openStatus !== spec.status || row.pathRedacted !== true) {
    throw new Error(`${spec.alias} source classification drifted.`);
  }
  if (spec.status === "playing" && row.runtimeStatus !== "prepared") {
    throw new Error(`${spec.alias} did not produce a prepared runtime payload.`);
  }
  if (spec.issueCode && !row.issueCodes.includes(spec.issueCode)) {
    throw new Error(`${spec.alias} did not preserve its typed blocking issue.`);
  }
  if (Number.isFinite(spec.images) && row.inventory.imageCount !== spec.images) {
    throw new Error(`${spec.alias} image inventory drifted.`);
  }
  if (Number.isFinite(spec.texts) && row.inventory.textCount !== spec.texts) {
    throw new Error(`${spec.alias} text inventory drifted.`);
  }
  if (spec.alias === "VAP-MIXED-FUSION" && (
    row.payload.vapFusionImages !== spec.images || row.payload.vapFusionText !== spec.texts
  )) {
    throw new Error("VAP-MIXED-FUSION canonical runtime fusion binding drifted.");
  }
}

function factValue(model, id) {
  const fact = model?.rightPanel?.facts?.find((candidate) => candidate?.id === id);
  return typeof fact?.value === "string" ? fact.value : undefined;
}

function finiteCount(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;
}

function assertNoRawPathLeak(proof, binding) {
  const serialized = JSON.stringify(proof);
  for (const rawPath of binding.rawPaths) {
    if (serialized.includes(rawPath)) throw new Error("The source matrix proof contains a raw path.");
  }
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function gitHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
}
