#!/usr/bin/env node
import { createHash } from "node:crypto";
import { decode } from "fast-png";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const targetPath = path.join(repoRoot, "docs/product/P6_R1_MACOS_VISUAL_SYSTEM_TARGET.json");
const sourceOnly = process.argv.includes("--source-only");

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function countHardcodedColors(css) {
  return countMatches(css, /#[0-9a-fA-F]{3,8}\b|(?<!color-mix\()rgba?\(/g);
}

function countHardcodedDeclarations(css, property) {
  return countMatches(css, new RegExp(`${property}\\s*:\\s*(?!var\\()[^;]+`, "g"));
}

function includesClass(source, className) {
  return source.includes(`.${className}`)
    || source.includes(`class="${className}`)
    || source.includes(`class="`) && new RegExp(`class="[^"]*\\b${className}\\b`).test(source);
}

function assertCondition(errors, condition, message) {
  if (!condition) errors.push(message);
}

const target = JSON.parse(await readFile(targetPath, "utf8"));
const foundationContract = await readJson("docs/product/MACOS_SVGA_WORKBENCH_FOUNDATION_CONTRACT.json");
const roadmapCapacityMap = await readJson("docs/product/ROADMAP_UI_CAPACITY_MAP.json");
const [tokens, styles, shell, app] = await Promise.all([
  readText("tools/shared/product-tokens.css"),
  readText("tools/shared/product-frontend/product-styles.css"),
  readText("tools/shared/product-frontend/product-shell.html"),
  readText("tools/shared/product-frontend/product-app.mjs")
]);
const inspection = await readText("tools/shared/product-frontend/inspection-report-view.mjs");

const errors = [];
const evidenceResults = [];
const componentResults = [];
for (const token of target.requiredTokens) {
  assertCondition(errors, tokens.includes(`${token}:`), `missing visual token ${token}`);
  assertCondition(errors, styles.includes(`var(${token}`) || styles.includes(`${token}:`), `visual token not consumed by product styles ${token}`);
}

const componentSources = `${styles}\n${shell}\n${app}`;
for (const className of target.requiredComponentClasses) {
  const present = includesClass(componentSources, className);
  componentResults.push({ className, present });
  assertCondition(errors, present, `missing visual component class ${className}`);
}

for (const banned of target.ownerVisibleCopyBans) {
  assertCondition(errors, !shell.includes(banned) && !app.includes(banned), `owner-visible copy still contains ${banned}`);
}

const colorCount = countHardcodedColors(styles);
const radiusCount = countHardcodedDeclarations(styles, "border-radius");
const fontSizeCount = countHardcodedDeclarations(styles, "font-size");
const tokenReferenceCount = countMatches(styles, /var\(--visual-|var\(--preview-card|var\(--panel-header|var\(--metric-card|var\(--resource-row|var\(--log-row|var\(--inline-feedback|var\(--compact-toolbar|var\(--status-badge/g);

assertCondition(errors, colorCount <= target.auditRules.hardcodedOwnerVisibleColorCountMax, `hardcoded color count ${colorCount} exceeds ${target.auditRules.hardcodedOwnerVisibleColorCountMax}`);
assertCondition(errors, radiusCount <= target.auditRules.hardcodedOwnerVisibleRadiusCountMax, `hardcoded radius count ${radiusCount} exceeds ${target.auditRules.hardcodedOwnerVisibleRadiusCountMax}`);
assertCondition(errors, fontSizeCount <= target.auditRules.hardcodedOwnerVisibleFontSizeCountMax, `hardcoded font-size count ${fontSizeCount} exceeds ${target.auditRules.hardcodedOwnerVisibleFontSizeCountMax}`);
assertCondition(errors, tokenReferenceCount >= target.auditRules.requiredTokenReferenceMinimum, `visual token reference count ${tokenReferenceCount} below ${target.auditRules.requiredTokenReferenceMinimum}`);
assertCondition(errors, /body\s*\{[\s\S]*?min-width:\s*680px;/.test(styles), "body min-width must support the 900x720 owner-review viewport");
assertCondition(errors, /@media\s*\(max-width:\s*980px\)[\s\S]*?\.workspace\.withCompare/.test(styles), "missing 900px compact compare workspace rule");
assertCondition(errors, /duplicateFilePillHidden/.test(app), "preview card audit must prove duplicated file pill is hidden");
assertCondition(errors, /function reloadCurrentFile/.test(app), "Cmd/Ctrl+R reload path must be explicit");
assertCondition(errors, !/clearCurrentFile\("shortcut"\)/.test(app), "Cmd/Ctrl+R must not clear the current file");
assertCondition(errors, /overviewFileRow/.test(app) && /overviewFileRow/.test(styles), "Info Overview must separate current file from compact metric cards");
assertCondition(errors, /assetUsageLabel/.test(app) && /assetUsageLabel/.test(styles), "Resources tab must avoid exposing raw imageKey as primary row text");
assertCondition(errors, /specDiagnosticDetails/.test(inspection), "Inspection report must collapse raw diagnostic details by default");
assertCondition(errors, !inspection.includes("<code>${escapeHtml(issue.code)}</code></div>"), "Inspection report must not expose raw issue codes in default rows");
assertCondition(errors, foundationContract.contractId === "MACOS_SVGA_WORKBENCH_FOUNDATION_CONTRACT", "missing macOS workbench foundation contract id");
assertCondition(errors, foundationContract.phase2Started === false, "foundation contract must not start Phase 2");
assertCondition(errors, Array.isArray(foundationContract.regions) && foundationContract.regions.length >= 6, "foundation contract must define workbench regions");
const requiredRegions = target.auditRules.requiredWorkbenchRegions ?? [];
const foundationRegionIds = new Set((foundationContract.regions ?? []).map((region) => region.id));
for (const regionId of requiredRegions) {
  assertCondition(errors, foundationRegionIds.has(regionId), `foundation contract missing region ${regionId}`);
  assertCondition(errors, shell.includes(`data-workbench-region="${regionId.replace(/_/g, "-")}"`) || app.includes(regionId), `product shell/app missing workbench region ${regionId}`);
}
assertCondition(errors, roadmapCapacityMap.mapId === "ROADMAP_UI_CAPACITY_MAP", "missing roadmap UI capacity map id");
assertCondition(errors, roadmapCapacityMap.phase2Started === false, "roadmap capacity map must not start Phase 2");
const roadmapStatuses = new Set((roadmapCapacityMap.capabilities ?? []).map((item) => item.status));
for (const status of target.auditRules.requiredFutureStatuses ?? []) {
  assertCondition(errors, roadmapStatuses.has(status), `roadmap capacity map missing status ${status}`);
}
assertCondition(errors, !/\b(imageKey|Undo|Redo|一键优化|自动修复|格式转换|导出工作台|ComfyUI|Agent API)\b/.test(shell), "P6-R1 shell exposes future feature controls");

if (!sourceOnly) {
  const ownerTargets = Array.isArray(target.primaryOwnerEvidenceTargets) ? target.primaryOwnerEvidenceTargets : [];
  assertCondition(errors, ownerTargets.length > 0, "visual-system audit requires primary owner evidence targets");
  for (const evidenceTarget of ownerTargets) {
    if (!evidenceTarget || typeof evidenceTarget.path !== "string" || typeof evidenceTarget.id !== "string") {
      errors.push(`invalid primary owner evidence target ${JSON.stringify(evidenceTarget)}`);
      continue;
    }
    const absolute = path.join(repoRoot, evidenceTarget.path);
    try {
      const bytes = await readFile(absolute);
      const record = {
        id: evidenceTarget.id,
        path: evidenceTarget.path,
        kind: evidenceTarget.kind,
        sizeBytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex")
      };
      if (evidenceTarget.kind === "png") {
        const decoded = decode(bytes, { checkCrc: true });
        record.width = decoded.width;
        record.height = decoded.height;
        const minimumWidth = evidenceTarget.minimumWidth ?? 1;
        const minimumHeight = evidenceTarget.minimumHeight ?? 1;
        if (decoded.width < minimumWidth || decoded.height < minimumHeight) {
          errors.push(`owner evidence ${evidenceTarget.id} has ${decoded.width}x${decoded.height}, below ${minimumWidth}x${minimumHeight}`);
        }
      } else if (evidenceTarget.kind === "json") {
        JSON.parse(Buffer.from(bytes).toString("utf8"));
      }
      evidenceResults.push(record);
    } catch (error) {
      errors.push(`owner evidence ${evidenceTarget.id} unreadable: ${error.message}`);
    }
  }
  const decodedPngCount = evidenceResults.filter((record) => record.kind === "png" && record.width > 0 && record.height > 0).length;
  assertCondition(errors, decodedPngCount >= 5, `visual-system audit decoded only ${decodedPngCount} owner PNG targets`);
  const regionMapRecord = evidenceResults.find((record) => record.path.endsWith("workbench-region-map.json"));
  if (regionMapRecord) {
    const regionMap = await readJson(regionMapRecord.path);
    const regionIds = new Set((regionMap.regions ?? []).map((region) => region.id));
    for (const regionId of requiredRegions) {
      assertCondition(errors, regionIds.has(regionId), `workbench region map missing ${regionId}`);
    }
    assertCondition(errors, regionMap.passed === true, "workbench region map did not pass");
  }
  try {
    const renderProof = await readJson(".artifacts/product/P6/desktop-state-render-proof.json");
    assertCondition(errors, renderProof.passed === true, "desktop state render proof did not pass");
    assertCondition(errors, renderProof.states?.["responsive-local-compare-at-900-x-720"]?.passed === true, "responsive local compare proof missing or failed");
    assertCondition(errors, renderProof.states?.["info-diagnostics-open"]?.passed === true, "diagnostics panel proof missing or failed");
  } catch (error) {
    errors.push(`desktop state render proof unreadable: ${error.message}`);
  }
}

const tokenAudit = {
  passed: colorCount <= target.auditRules.hardcodedOwnerVisibleColorCountMax
    && radiusCount <= target.auditRules.hardcodedOwnerVisibleRadiusCountMax
    && fontSizeCount <= target.auditRules.hardcodedOwnerVisibleFontSizeCountMax
    && tokenReferenceCount >= target.auditRules.requiredTokenReferenceMinimum,
  policy: "Owner-visible style primitives must be token-backed or stay under the approved legacy threshold.",
  colorCount,
  radiusCount,
  fontSizeCount,
  tokenReferenceCount
};

const componentAudit = {
  passed: componentResults.every((record) => record.present),
  requiredComponentClassCount: componentResults.length,
  missing: componentResults.filter((record) => !record.present).map((record) => record.className)
};

const screenshotAudit = {
  passed: sourceOnly ? null : errors.filter((message) => /owner evidence|desktop state render proof|responsive local compare|diagnostics panel proof/.test(message)).length === 0,
  targetCount: Array.isArray(target.primaryOwnerEvidenceTargets) ? target.primaryOwnerEvidenceTargets.length : 0,
  decodedPngCount: evidenceResults.filter((record) => record.kind === "png" && record.width > 0 && record.height > 0).length
};

const foundationAudit = {
  passed: errors.filter((message) => /foundation contract|roadmap capacity|workbench region|future feature|Phase 2/.test(message)).length === 0,
  regionCount: foundationContract.regions?.length ?? 0,
  roadmapCapabilityCount: roadmapCapacityMap.capabilities?.length ?? 0,
  deferredStatuses: [...roadmapStatuses].filter((status) => status !== "implemented")
};

const summary = {
  passed: errors.length === 0,
  target: target.target,
  sourceOnly,
  tokenAudit,
  componentAudit,
  screenshotAudit,
  foundationAudit,
  metrics: {
    colorCount,
    radiusCount,
    fontSizeCount,
    tokenReferenceCount,
    requiredTokenCount: target.requiredTokens.length,
    requiredComponentClassCount: target.requiredComponentClasses.length,
    primaryOwnerEvidenceTargetCount: evidenceResults.length
  },
  evidenceResults,
  errors
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exit(1);
