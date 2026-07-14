"use strict";

const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createMultiFormatDesktopPreviewSession
} = require("../multiformat-desktop-session.cjs");

const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "../../../..");
const bindingPath = String(process.env.AUTO_SVGA_CONFORMANCE_INPUT_BINDING ?? "").trim();
const proofRoot = mkdtempSync(path.join(os.tmpdir(), "auto-svga-multiformat-conformance-source-proof-"));
const proofPath = path.join(proofRoot, "multiformat-conformance-source-proof.json");

const expectedInputs = Object.freeze([
  { alias: "REAL-SVGA-SQUARE-A", sha256: "da75da15150fb7d9bca0c3a5acafbcce9601438a2142afdd2c014b0c3d64449d", byteLength: 475233, format: "svga" },
  { alias: "REAL-SVGA-WIDE-A", sha256: "d7315b1e6ba5fdecc7bb071dc6734c3e3948cff1b96c27b94467cae5e56a5193", byteLength: 350793, format: "svga" },
  { alias: "REAL-LOTTIE-EMBEDDED-A", sha256: "4d415de7f6ec0a3742281e91f60a0dcc9e1c5574760e82e17a053eafc1d82eb1", byteLength: 116760, format: "lottie" },
  { alias: "OWNER-VAP-A", sha256: "22cb7c516cba552ba5347e82aea7d17b8a3f988b68befbb7e6f69743b096de9d", byteLength: 4541737, format: "vap", sidecarAlias: "OWNER-VAP-A-SIDECAR" },
  { alias: "OWNER-VAP-A-SIDECAR", sha256: "025378648238f3736228bdcbb5b1607f516daf4841fb525d94ece316f0dd96b7", byteLength: 202 },
  { alias: "REAL-VAP-ALT-A", sha256: "4302c18c969271472fe393c297b100cec6deefa091e1c0f0b5003afaa57e5fcd", byteLength: 4839653, format: "vap", sidecarAlias: "REAL-VAP-ALT-A-SIDECAR" },
  { alias: "REAL-VAP-ALT-A-SIDECAR", sha256: "738f4b288d74916700b9c12c2a0526308c0f21972003558c64439a24c5376913", byteLength: 150 }
]);

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main() {
  const inputs = readAndValidateBinding();
  const rows = [];
  for (const spec of expectedInputs.filter(({ format }) => Boolean(format))) {
    rows.push(await inspectInput(spec, inputs.get(spec.alias)));
  }
  const proof = {
    status: "passed",
    sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim(),
    inputBinding: {
      sha256: sha256File(bindingPath),
      mode: "0600",
      aliases: expectedInputs.map(({ alias, sha256, byteLength }) => ({ alias, sha256, byteLength })),
      pathRedacted: true
    },
    rows,
    boundaries: {
      foreground: false,
      installedAppMutated: false,
      materialMutated: false,
      rawPathsPublished: false,
      runtimePixelPlayback: false,
      fusionReplacementRuntimeRerun: false
    }
  };
  assertNoPathLeak(proof, inputs);
  writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ proofPath, sha256: sha256File(proofPath), status: proof.status })}\n`);
}

function readAndValidateBinding() {
  if (!bindingPath || !path.isAbsolute(bindingPath)) throw new Error("A private absolute conformance input binding is required.");
  const bindingStat = statSync(bindingPath);
  if ((bindingStat.mode & 0o777) !== 0o600) throw new Error("The conformance input binding must use mode 0600.");
  const parsed = JSON.parse(readFileSync(bindingPath, "utf8"));
  const byAlias = new Map((parsed.inputs ?? []).map((entry) => [entry.alias, entry]));
  for (const spec of expectedInputs) {
    const input = byAlias.get(spec.alias);
    if (!input || typeof input.path !== "string" || !path.isAbsolute(input.path)) throw new Error(`${spec.alias} binding is unavailable.`);
    const inputStat = lstatSync(input.path);
    if (!inputStat.isFile() || inputStat.isSymbolicLink()) throw new Error(`${spec.alias} must be a regular non-symlink file.`);
    if (inputStat.size !== spec.byteLength || sha256File(input.path) !== spec.sha256) throw new Error(`${spec.alias} identity drifted.`);
  }
  return byAlias;
}

async function inspectInput(spec, input) {
  const sessionRoot = path.join(proofRoot, spec.alias.toLowerCase());
  mkdirSync(sessionRoot, { recursive: true });
  const sourceStore = new Map();
  const session = createMultiFormatDesktopPreviewSession({ repoRoot, sessionRoot, sourceStore, openTimeoutMs: 15_000 });
  const opened = await session.openLocalFilePath(input.path, "fileOpenEvent");
  const model = opened?.model;
  if (opened?.status !== "opened" || model?.detectedFormat !== spec.format || model?.status !== "previewReady") {
    throw new Error(`${spec.alias} did not reach previewReady through the host-owned source chain: ${JSON.stringify({
      openStatus: opened?.status,
      format: model?.detectedFormat,
      modelStatus: model?.status,
      issues: (model?.rightPanel?.issues ?? []).map(({ code, details }) => ({ code, reason: details?.reason }))
    })}`);
  }
  const prepared = await session.prepareRuntimePreview({
    sourceId: opened.sourceId,
    format: spec.format,
    requestId: model.requestId,
    replacements: []
  });
  if (prepared?.status !== "prepared" || prepared?.format !== spec.format) {
    throw new Error(`${spec.alias} did not produce a prepared runtime payload.`);
  }
  const issues = model.rightPanel?.issues ?? [];
  const dimensions = model.rightPanel?.facts?.find(({ id }) => id === "dimensions");
  const riskIssues = issues.filter(({ details }) => details?.reason === "vap_dimensions_over_1504");
  if (spec.alias === "OWNER-VAP-A" && (dimensions?.status !== "warning" || riskIssues.length !== 1)) {
    throw new Error("OWNER-VAP-A did not preserve exactly one truthful canvas risk warning while remaining previewReady.");
  }
  const inventory = model.rightPanel?.assetInventory?.summary ?? {};
  const row = {
    alias: spec.alias,
    sha256: spec.sha256,
    format: spec.format,
    openStatus: model.status,
    runtimeStatus: prepared.status,
    dimensions: dimensions ? { value: dimensions.value, status: dimensions.status } : undefined,
    issueCodes: issues.map(({ code }) => code),
    inventory: {
      totalItems: Number(inventory.totalItems) || 0,
      imageCount: Number(inventory.imageCount) || 0,
      textCount: Number(inventory.textCount) || 0,
      audioVideoCount: Number(inventory.audioVideoCount) || 0,
      replaceableItems: Number(inventory.replaceableItems) || 0
    },
    runtimePayload: {
      hasSvgaBytes: spec.format === "svga" ? typeof prepared.svgaBase64 === "string" && prepared.svgaBase64.length > 0 : undefined,
      hasLottieDocument: spec.format === "lottie" ? Boolean(prepared.animationData) : undefined,
      lottieImageCount: spec.format === "lottie" ? (prepared.animationData?.assets ?? []).filter(({ p }) => typeof p === "string").length : undefined,
      hasVapBytes: spec.format === "vap" ? typeof prepared.mp4Base64 === "string" && prepared.mp4Base64.length > 0 : undefined,
      hasVapConfig: spec.format === "vap" ? Boolean(prepared.vapConfig) : undefined
    },
    lifecycle: { ...session.lifecycle },
    pathRedacted: true
  };
  await session.control({ action: "dispose" });
  row.lifecycleAfterDispose = { ...session.lifecycle };
  sourceStore.clear();
  return row;
}

function assertNoPathLeak(proof, inputs) {
  const serialized = JSON.stringify(proof);
  for (const input of inputs.values()) {
    const rawPath = String(input.path ?? "");
    if (rawPath && serialized.includes(rawPath)) throw new Error("The source proof contains a raw material path.");
  }
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

process.on("exit", () => {
  for (const entry of expectedInputs) {
    const sessionPath = path.join(proofRoot, entry.alias.toLowerCase());
    if (sessionPath !== proofRoot) rmSync(sessionPath, { recursive: true, force: true });
  }
});
