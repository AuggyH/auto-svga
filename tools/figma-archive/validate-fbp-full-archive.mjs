#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_REQUEST_PATH = "docs/research/fbp-full-archive-request-20260716.json";

function parseArgs(argv) {
  const args = {
    requestPath: DEFAULT_REQUEST_PATH,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--request") {
      args.requestPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return [
    "Usage: node tools/figma-archive/validate-fbp-full-archive.mjs [--request <path>] [--json]",
    "",
    "Validates the full frozen Figma FBP archive contract without contacting Figma or FBP.",
  ].join("\n");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function fileByteLength(filePath) {
  return fs.statSync(filePath).size;
}

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function existsDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function listJsonFiles(directoryPath) {
  try {
    return fs.readdirSync(directoryPath).filter((file) => file.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function findTargetMetadata(manifest, deliveryTarget) {
  const manifestSource = getObject(manifest?.source);
  const manifestPage = getObject(manifestSource?.page);
  const manifestSelection = getObject(manifestSource?.selection);
  const normalizedManifestSource = manifestSource ? {
    fileKey: manifestSource.documentId,
    figmaFileKey: manifestSource.documentId,
    pageId: manifestPage?.id,
    figmaPageId: manifestPage?.id,
    pageName: manifestPage?.name,
    figmaPageName: manifestPage?.name,
    nodeId: manifestSelection?.id,
    figmaNodeId: manifestSelection?.id,
    nodeName: manifestSelection?.name,
    name: manifestSelection?.name,
  } : null;
  const candidates = [
    getObject(manifest?.target),
    getObject(manifest?.figmaTarget),
    getObject(manifest?.packageTarget),
    normalizedManifestSource,
    getObject(manifest?.source?.target),
    getObject(manifest?.source),
    getObject(deliveryTarget),
    getObject(deliveryTarget?.target),
    getObject(deliveryTarget?.figmaTarget),
  ].filter(Boolean);

  const merged = {};
  for (const candidate of candidates) {
    for (const [key, value] of Object.entries(candidate)) {
      if (merged[key] === undefined) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

function normalizeId(value) {
  return typeof value === "string" ? value : null;
}

function selectFirstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

function validateManifestEntries(packageDir, manifest, target, errors) {
  const entries = [
    ...(Array.isArray(manifest?.entries) ? manifest.entries : []),
    ...(Array.isArray(manifest?.media) ? manifest.media : []),
  ];
  const entryByPath = new Map();
  for (const entry of entries) {
    if (entry && typeof entry.path === "string") {
      entryByPath.set(entry.path, entry);
    }
  }

  for (const relPath of target.requiredFiles) {
    const filePath = path.join(packageDir, relPath);
    const entry = entryByPath.get(relPath);
    if ((relPath === "manifest.json" || relPath === "figma-handoff-package.zip") && existsFile(filePath)) {
      continue;
    }
    if (!entry) {
      errors.push(`target ${target.slug}: manifest missing entry ${relPath}`);
      continue;
    }
    if (!existsFile(filePath)) {
      errors.push(`target ${target.slug}: manifest entry file missing ${relPath}`);
      continue;
    }
    if (typeof entry.byteLength !== "number" || entry.byteLength !== fileByteLength(filePath)) {
      errors.push(`target ${target.slug}: byteLength mismatch for ${relPath}`);
    }
    if (typeof entry.sha256 !== "string" || entry.sha256 !== fileSha256(filePath)) {
      errors.push(`target ${target.slug}: sha256 mismatch for ${relPath}`);
    }
    if (typeof entry.mediaType !== "string") {
      errors.push(`target ${target.slug}: mediaType missing for ${relPath}`);
    }
  }
}

function validatePreview(packageDir, target, errors) {
  const previewManifestPath = path.join(packageDir, "previews/manifest.json");
  const previewPath = path.join(packageDir, "previews/reference.png");
  if (!existsFile(previewManifestPath) || !existsFile(previewPath)) {
    return;
  }

  let previewManifest;
  try {
    previewManifest = readJson(previewManifestPath);
  } catch (error) {
    errors.push(`target ${target.slug}: previews/manifest.json is invalid JSON: ${error.message}`);
    return;
  }

  const preview = getObject(previewManifest.referencePreview)
    || (Array.isArray(previewManifest.previews) ? getObject(previewManifest.previews[0]) : null);
  if (!preview) {
    errors.push(`target ${target.slug}: reference preview metadata missing`);
    return;
  }

  if (typeof preview.sha256 !== "string" || preview.sha256 !== fileSha256(previewPath)) {
    errors.push(`target ${target.slug}: reference preview sha256 mismatch`);
  }
  if (typeof preview.byteLength !== "number" || preview.byteLength !== fileByteLength(previewPath)) {
    errors.push(`target ${target.slug}: reference preview byteLength mismatch`);
  }
  if (typeof preview.width !== "number" || typeof preview.height !== "number") {
    errors.push(`target ${target.slug}: reference preview dimensions missing`);
  }
}

function validatePackage(request, delivery, target) {
  const requiredFiles = request.requiredOutputs.perTargetRequiredFiles;
  const packageDir = path.join(request.archiveRoot, target.expectedPackageDirectory);
  const errors = [];

  if (!existsDirectory(packageDir)) {
    return {
      slug: target.slug,
      status: "missing",
      packageDir,
      errors: [`target ${target.slug}: package directory missing`],
    };
  }

  const targetWithFiles = { ...target, requiredFiles };
  for (const relPath of requiredFiles) {
    if (!existsFile(path.join(packageDir, relPath))) {
      errors.push(`target ${target.slug}: required file missing ${relPath}`);
    }
  }

  let manifest = null;
  const manifestPath = path.join(packageDir, "manifest.json");
  if (existsFile(manifestPath)) {
    try {
      manifest = readJson(manifestPath);
    } catch (error) {
      errors.push(`target ${target.slug}: manifest.json is invalid JSON: ${error.message}`);
    }
  }

  const deliveryTargets = Array.isArray(delivery?.targets) ? delivery.targets : [];
  const deliveryTarget = deliveryTargets.find((item) => {
    return item?.targetId === target.slug
      || item?.targetSlug === target.slug
      || item?.slug === target.slug
      || item?.nodeId === target.nodeId
      || item?.figmaNodeId === target.nodeId
      || item?.target?.targetId === target.slug
      || item?.target?.targetSlug === target.slug
      || item?.target?.slug === target.slug
      || item?.target?.nodeId === target.nodeId
      || item?.target?.figmaNodeId === target.nodeId;
  });

  if (manifest) {
    validateManifestEntries(packageDir, manifest, targetWithFiles, errors);
  }
  validatePreview(packageDir, targetWithFiles, errors);

  const metadata = findTargetMetadata(manifest, deliveryTarget);
  const actualFileKey = selectFirstString(metadata.fileKey, metadata.figmaFileKey);
  const actualPageId = selectFirstString(metadata.pageId, metadata.figmaPageId);
  const actualPageName = selectFirstString(metadata.pageName, metadata.figmaPageName);
  const actualNodeId = selectFirstString(metadata.nodeId, metadata.figmaNodeId, metadata.id);
  const actualNodeName = selectFirstString(metadata.nodeName, metadata.name);
  const actualSlug = selectFirstString(metadata.targetSlug, metadata.targetId, metadata.slug);
  const actualKind = selectFirstString(metadata.targetKind, metadata.kind, metadata.archiveKind);

  const expectations = [
    ["fileKey", actualFileKey, request.file.key],
    ["pageId", actualPageId, target.pageId],
    ["pageName", actualPageName, target.pageName],
    ["nodeId", actualNodeId, target.nodeId],
    ["nodeName", actualNodeName, target.nodeName],
    ["targetSlug", actualSlug, target.slug],
    ["targetKind", actualKind, target.kind],
  ];

  for (const [field, actual, expected] of expectations) {
    if (actual !== expected) {
      errors.push(`target ${target.slug}: ${field} expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
    }
  }

  return {
    slug: target.slug,
    status: errors.length === 0 ? "ok" : "invalid",
    packageDir,
    errors,
  };
}

function validateRunDelivery(request, errors) {
  const deliveryPath = path.join(request.archiveRoot, "fbp/full-archive-delivery/latest/delivery.json");
  const hashesPath = path.join(request.archiveRoot, "fbp/full-archive-delivery/latest/hashes.json");
  const callbackPath = path.join(request.archiveRoot, "fbp/full-archive-delivery/latest/uiux-context-callback.json");
  const progressPath = path.join(request.archiveRoot, "fbp/full-archive-delivery/latest/progress.json");

  const files = [
    ["delivery", deliveryPath],
    ["hashes", hashesPath],
    ["uiuxContextCallback", callbackPath],
    ["progress", progressPath],
  ];

  for (const [label, filePath] of files) {
    if (!existsFile(filePath)) {
      errors.push(`run delivery file missing: ${label} (${path.relative(request.archiveRoot, filePath)})`);
    }
  }

  return existsFile(deliveryPath) ? readJson(deliveryPath) : null;
}

function validateArchiveHashManifest(request, errors) {
  const hashManifestPath = path.join(request.archiveRoot, "manifests/files.sha256.json");
  if (!existsFile(hashManifestPath)) {
    errors.push("MCP archive hash manifest missing: manifests/files.sha256.json");
    return { fileCount: 0, checkedFiles: 0 };
  }

  let hashManifest;
  try {
    hashManifest = readJson(hashManifestPath);
  } catch (error) {
    errors.push(`MCP archive hash manifest is invalid JSON: ${error.message}`);
    return { fileCount: 0, checkedFiles: 0 };
  }

  const files = Array.isArray(hashManifest.files) ? hashManifest.files : [];
  if (typeof hashManifest.fileCount !== "number" || hashManifest.fileCount !== files.length) {
    errors.push("MCP archive hash manifest fileCount mismatch");
  }

  let checkedFiles = 0;
  for (const entry of files) {
    if (!entry || typeof entry.path !== "string") {
      errors.push("MCP archive hash manifest contains an entry without a path");
      continue;
    }
    const filePath = path.join(request.archiveRoot, entry.path);
    if (!existsFile(filePath)) {
      errors.push(`MCP archive hashed file missing: ${entry.path}`);
      continue;
    }
    checkedFiles += 1;
    if (typeof entry.byteLength !== "number" || entry.byteLength !== fileByteLength(filePath)) {
      errors.push(`MCP archive byteLength mismatch: ${entry.path}`);
    }
    if (typeof entry.sha256 !== "string" || entry.sha256 !== fileSha256(filePath)) {
      errors.push(`MCP archive sha256 mismatch: ${entry.path}`);
    }
  }

  return { fileCount: files.length, checkedFiles };
}

function requireArchiveFiles(request, target, relPaths, errors) {
  for (const relPath of relPaths) {
    if (!existsFile(path.join(request.archiveRoot, relPath))) {
      errors.push(`MCP target ${target.slug}: required file missing ${relPath}`);
    }
  }
}

function validateMcpTargetFiles(request, target, mcpTarget, errors) {
  if (target.kind === "page-state") {
    requireArchiveFiles(request, target, [
      `screenshots/page-states/${target.slug}.png`,
      `screenshots/page-states/${target.slug}.json`,
      `mcp/page-states/${target.slug}.design-context.json`,
      `mcp/page-states/${target.slug}.variables.json`,
    ], errors);
    return;
  }

  if (target.kind === "token-system") {
    requireArchiveFiles(request, target, [
      "screenshots/tokens/token-reference.png",
      "screenshots/tokens/token-reference.json",
      "mcp/tokens/01-base-colors.json",
      "mcp/tokens/02-semantic-colors.json",
      "mcp/tokens/03-base-spacing.json",
      "mcp/tokens/04-base-radius.json",
      "mcp/tokens/05-semantic-spacing.json",
      "mcp/tokens/06-local-styles.json",
      "mcp/tokens/token-reference-000-049.json",
      "mcp/tokens/token-reference-050-099.json",
      "mcp/tokens/token-reference-100-149.json",
      "mcp/tokens/token-reference-150-199.json",
      "mcp/tokens/token-reference-200-248.json",
    ], errors);
    return;
  }

  if (target.kind === "component-section") {
    requireArchiveFiles(request, target, [
      `screenshots/components/${target.slug}.png`,
      `screenshots/components/${target.slug}.json`,
      `mcp/components/${target.slug}-index.json`,
      `mcp/components/${target.slug}-sets.json`,
    ], errors);

    const expectedContracts = typeof mcpTarget?.mcp?.componentContracts === "number"
      ? mcpTarget.mcp.componentContracts
      : null;
    const contractDir = path.join(request.archiveRoot, `mcp/components/contracts/${target.slug}`);
    if (!existsDirectory(contractDir)) {
      errors.push(`MCP target ${target.slug}: component contract directory missing`);
      return;
    }
    if (expectedContracts !== null) {
      const contractCount = listJsonFiles(contractDir).length;
      if (contractCount !== expectedContracts) {
        errors.push(`MCP target ${target.slug}: component contract count expected ${expectedContracts} got ${contractCount}`);
      }
    }
    return;
  }

  errors.push(`MCP target ${target.slug}: unsupported target kind ${target.kind}`);
}

function validateMcpArchive(request, mcpManifest, errors) {
  const completenessPath = path.join(request.archiveRoot, "manifests/completeness.json");
  if (!existsFile(completenessPath)) {
    errors.push("MCP archive completeness manifest missing: manifests/completeness.json");
  } else {
    const completeness = readJson(completenessPath);
    if (completeness.fileKey !== request.file?.key) {
      errors.push("MCP archive completeness fileKey mismatch");
    }
    if (completeness.counts?.targets !== request.targetCount) {
      errors.push("MCP archive completeness target count mismatch");
    }
    if (completeness.mcpGate?.complete !== true) {
      errors.push("MCP archive completeness mcpGate is not complete");
    }
    if (Array.isArray(completeness.mcpGate?.missing) && completeness.mcpGate.missing.length > 0) {
      errors.push(`MCP archive completeness reports missing targets: ${completeness.mcpGate.missing.join(", ")}`);
    }
  }

  const hashSummary = validateArchiveHashManifest(request, errors);
  const mcpTargets = Array.isArray(mcpManifest?.targets) ? mcpManifest.targets : [];
  const mcpBySlug = new Map(mcpTargets.map((target) => [target.slug, target]));

  for (const target of request.targets || []) {
    const mcpTarget = mcpBySlug.get(target.slug);
    if (!mcpTarget) {
      continue;
    }
    validateMcpTargetFiles(request, target, mcpTarget, errors);
  }

  return {
    fileHashEntries: hashSummary.fileCount,
    checkedHashEntries: hashSummary.checkedFiles,
    targetsChecked: (request.targets || []).length,
  };
}

function validateRequest(requestPath) {
  const request = readJson(requestPath);
  const errors = [];
  const mcpArchiveErrors = [];
  let mcpManifest = null;

  if (request.schemaVersion !== 1) {
    errors.push("request schemaVersion must be 1");
  }
  if (!Array.isArray(request.targets) || request.targets.length !== request.targetCount) {
    errors.push("request targetCount does not match targets length");
  }
  if (!existsFile(request.sourceMcpManifest)) {
    errors.push(`source MCP manifest missing: ${request.sourceMcpManifest}`);
  } else {
    mcpManifest = readJson(request.sourceMcpManifest);
    const mcpTargets = Array.isArray(mcpManifest.targets) ? mcpManifest.targets : [];
    if (mcpTargets.length !== request.targets.length) {
      errors.push(`MCP target count ${mcpTargets.length} does not match request ${request.targets.length}`);
    }
    const mcpBySlug = new Map(mcpTargets.map((target) => [target.slug, target]));
    for (const target of request.targets) {
      const mcpTarget = mcpBySlug.get(target.slug);
      if (!mcpTarget) {
        errors.push(`MCP manifest missing target ${target.slug}`);
        continue;
      }
      for (const field of ["kind", "pageId", "pageName", "nodeId"]) {
        if (mcpTarget[field] !== target[field]) {
          errors.push(`target ${target.slug}: MCP ${field} mismatch`);
        }
      }
      if (mcpTarget.name !== target.nodeName) {
        errors.push(`target ${target.slug}: MCP nodeName mismatch`);
      }
    }
  }

  const slugs = new Set();
  for (const target of request.targets || []) {
    if (slugs.has(target.slug)) {
      errors.push(`duplicate target slug: ${target.slug}`);
    }
    slugs.add(target.slug);
  }

  const mcpArchive = mcpManifest
    ? validateMcpArchive(request, mcpManifest, mcpArchiveErrors)
    : { fileHashEntries: 0, checkedHashEntries: 0, targetsChecked: 0 };
  const deliveryErrors = [];
  const delivery = validateRunDelivery(request, deliveryErrors);
  const targetResults = (request.targets || []).map((target) => validatePackage(request, delivery, target));

  const missing = targetResults.filter((result) => result.status === "missing").map((result) => result.slug);
  const invalid = targetResults.filter((result) => result.status === "invalid").map((result) => result.slug);

  const result = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    requestPath,
    archiveRoot: request.archiveRoot,
    fileKey: request.file?.key ?? null,
    expectedTargetCount: request.targetCount,
    packageUnits: targetResults.filter((item) => item.status === "ok").length,
    mcpArchive,
    missingTargetSlugs: missing,
    invalidTargetSlugs: invalid,
    requestErrors: errors,
    mcpArchiveErrors,
    deliveryErrors,
    targetErrors: Object.fromEntries(targetResults.filter((item) => item.errors.length > 0).map((item) => [item.slug, item.errors])),
  };
  result.complete = errors.length === 0
    && mcpArchiveErrors.length === 0
    && deliveryErrors.length === 0
    && missing.length === 0
    && invalid.length === 0
    && result.packageUnits === request.targetCount;

  return result;
}

function printHuman(result) {
  const lines = [];
  lines.push(`FBP full archive: ${result.complete ? "PASS" : "FAIL"}`);
  lines.push(`Archive root: ${result.archiveRoot}`);
  lines.push(`MCP archive: ${result.mcpArchiveErrors.length === 0 ? "PASS" : "FAIL"} (${result.mcpArchive.checkedHashEntries}/${result.mcpArchive.fileHashEntries} hashed files checked)`);
  lines.push(`Targets: ${result.packageUnits}/${result.expectedTargetCount} valid`);
  if (result.requestErrors.length > 0) {
    lines.push("");
    lines.push("Request errors:");
    for (const error of result.requestErrors) lines.push(`- ${error}`);
  }
  if (result.mcpArchiveErrors.length > 0) {
    lines.push("");
    lines.push("MCP archive errors:");
    for (const error of result.mcpArchiveErrors) lines.push(`- ${error}`);
  }
  if (result.deliveryErrors.length > 0) {
    lines.push("");
    lines.push("Delivery errors:");
    for (const error of result.deliveryErrors) lines.push(`- ${error}`);
  }
  if (result.missingTargetSlugs.length > 0) {
    lines.push("");
    lines.push(`Missing targets (${result.missingTargetSlugs.length}):`);
    lines.push(result.missingTargetSlugs.join(", "));
  }
  if (result.invalidTargetSlugs.length > 0) {
    lines.push("");
    lines.push(`Invalid targets (${result.invalidTargetSlugs.length}):`);
    for (const slug of result.invalidTargetSlugs) {
      lines.push(`- ${slug}`);
      for (const error of result.targetErrors[slug] || []) {
        lines.push(`  - ${error}`);
      }
    }
  }
  console.log(lines.join("\n"));
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  const result = validateRequest(path.resolve(args.requestPath));
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }
  process.exit(result.complete ? 0 : 1);
} catch (error) {
  console.error(error?.stack || String(error));
  process.exit(2);
}
