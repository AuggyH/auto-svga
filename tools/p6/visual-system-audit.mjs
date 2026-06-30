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
  return countMatches(css, new RegExp(`${property}\\s*:\\s*(?!\\s*var\\()[^;]+`, "g"));
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
const layoutContract = await readJson("docs/product/MACOS_WORKBENCH_LAYOUT_CONTRACT.json");
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
assertCondition(errors, /body\s*\{[\s\S]*?min-width:\s*min\(100vw,\s*var\(--visual-minimum-workbench-width\)\);/.test(styles), "body min-width must use the declared macOS workbench minimum token without forcing horizontal clipping");
assertCondition(errors, /--visual-minimum-workbench-width:\s*1180px;/.test(tokens), "visual minimum workbench width must be 1180px");
assertCondition(errors, /duplicateFilePillHidden/.test(app), "preview card audit must prove duplicated file pill is hidden");
assertCondition(errors, /function reloadCurrentFile/.test(app), "Cmd/Ctrl+R reload path must be explicit");
assertCondition(errors, !/clearCurrentFile\("shortcut"\)/.test(app), "Cmd/Ctrl+R must not clear the current file");
assertCondition(errors, /overviewFileRow/.test(app) && /overviewFileRow/.test(styles), "Info Overview must separate current file from compact metric cards");
assertCondition(errors, /assetUsageLabel/.test(app) && /assetUsageLabel/.test(styles), "Resources tab must avoid exposing raw imageKey as primary row text");
assertCondition(errors, /assetInlineActions/.test(app) && /assetInlineActions/.test(styles), "Resources sequence actions must live in normal row flow");
assertCondition(errors, /\.sequenceToggle\s*\{[\s\S]*?position:\s*static/.test(styles), "sequence toggle must stay in normal resource row flow");
assertCondition(errors, !/\.sequenceToggle\s*\{[^}]*position:\s*absolute/.test(styles), "sequence toggle must not be absolutely positioned over resource text");
assertCondition(errors, /\.assetFilters\s*\{[\s\S]*?display:\s*flex/.test(styles), "resource filters must use non-wrapping overflow layout");
assertCondition(errors, /\.assetFilters button\s*\{[\s\S]*?white-space:\s*nowrap/.test(styles), "resource filter buttons must not wrap vertically");
assertCondition(errors, /specDiagnosticDetails/.test(inspection), "Inspection report must collapse raw diagnostic details by default");
assertCondition(errors, !inspection.includes("<code>${escapeHtml(issue.code)}</code></div>"), "Inspection report must not expose raw issue codes in default rows");
assertCondition(errors, foundationContract.contractId === "MACOS_SVGA_WORKBENCH_FOUNDATION_CONTRACT", "missing macOS workbench foundation contract id");
assertCondition(errors, foundationContract.phase2Started === false, "foundation contract must not start Phase 2");
assertCondition(errors, Array.isArray(foundationContract.regions) && foundationContract.regions.length >= 6, "foundation contract must define workbench regions");
assertCondition(errors, layoutContract.contractId === "MACOS_WORKBENCH_LAYOUT_CONTRACT", "missing macOS workbench layout contract id");
assertCondition(errors, layoutContract.phase2Started === false, "layout contract must not start Phase 2");
assertCondition(errors, layoutContract.minimumSupportedWindow?.width >= 1180, "layout contract must define 1180px or wider supported minimum width");
assertCondition(errors, layoutContract.minimumSupportedWindow?.height >= 760, "layout contract must define 760px or taller supported minimum height");
assertCondition(errors, layoutContract.windowSizingSystem?.defaultLaunchWindow?.width === 1440, "layout contract must define 1440x900 default launch width");
assertCondition(errors, layoutContract.windowSizingSystem?.defaultLaunchWindow?.height === 900, "layout contract must define 1440x900 default launch height");
assertCondition(errors, layoutContract.windowSizingSystem?.legacyStressViewport?.width === 900, "layout contract may keep 900x720 only as legacy stress width");
assertCondition(errors, /not the default window/i.test(layoutContract.windowSizingSystem?.legacyStressViewport?.policy ?? ""), "legacy stress policy must forbid 900x720 as the default window");
assertCondition(errors, layoutContract.layoutModes?.fullWorkbench?.minWidth === 1180, "layout contract must define full workbench supported boundary");
assertCondition(errors, layoutContract.layoutModes?.compactWorkbench?.minWidth === 1180, "layout contract must define compact persistent-sidebar boundary");
assertCondition(errors, layoutContract.layoutModes?.minimalWorkbench?.maxWidth === 1179, "layout contract must keep sub-minimum sizes as legacy stress only");
assertCondition(errors, Array.isArray(layoutContract.regions) && layoutContract.regions.length >= 3, "layout contract must define major layout regions");
for (const region of layoutContract.regions ?? []) {
  assertCondition(errors, typeof region.direction === "string", `layout region ${region.id} missing direction`);
  assertCondition(errors, region.minWidth !== undefined, `layout region ${region.id} missing minWidth`);
  assertCondition(errors, region.collapsePriority !== undefined, `layout region ${region.id} missing collapsePriority`);
  assertCondition(errors, typeof region.overflowRule === "string", `layout region ${region.id} missing overflowRule`);
  assertCondition(errors, typeof region.parentResponseRule === "string", `layout region ${region.id} missing parentResponseRule`);
}
assertCondition(errors, shell.includes('data-workbench-region="source-document"'), "shell missing left source document region");
assertCondition(errors, shell.includes('data-workbench-region="preview-stage"'), "shell missing center preview stage region");
assertCondition(errors, shell.includes('data-workbench-region="inspector"'), "shell missing right inspector region");
assertCondition(errors, shell.includes('id="tab-overview"') && shell.includes("fileOverviewCard"), "left source panel missing compact File Overview card");
assertCondition(errors, shell.includes('data-source-tab="assets"') && shell.includes('data-source-tab="layers"'), "left source panel missing Resources/Layers tabs");
for (const filterLabel of ["全部", "图片", "序列帧", "未引用", "异常"]) {
  assertCondition(errors, app.includes(filterLabel), `resource filter missing ${filterLabel}`);
}
assertCondition(errors, !/id="infoPanel"[\s\S]*id="tab-overview"/.test(shell), "right inspector must not duplicate file overview");
assertCondition(errors, /id="logsPanel"[\s\S]*class="[^"]*\bisHidden\b/.test(shell), "Activity/Logs panel must be hidden by default");
assertCondition(errors, app.includes("renderInspectorActions"), "right inspector must render diagnostics/actions capacity");
assertCondition(errors, /grid-template-areas:\s*"source preview inspector"/.test(styles), "workspace must use Source / Preview / Inspector grid areas");
assertCondition(errors, /minmax\(/.test(styles), "layout must use intrinsic minmax sizing");
assertCondition(errors, /text-overflow:\s*ellipsis/.test(styles), "text-bearing components must define truncation rules");
assertCondition(errors, /--layout-left-width/.test(styles) && /--layout-right-width/.test(styles), "side regions must be sized from layoutEngine variables");
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
    const sourceRegion = (regionMap.regions ?? []).find((region) => region.id === "source_document");
    assertCondition(errors, sourceRegion?.selector === "aside[data-workbench-region='source-document']", "source_document region must bind the left source panel, not toolbar");
    assertCondition(errors, Number(sourceRegion?.rect?.y) >= 56, "source_document region appears to map the top toolbar");
    assertCondition(errors, regionMap.layoutIntegrity?.passed === true, "workbench layout integrity did not pass");
    assertCondition(errors, Array.isArray(regionMap.layoutIntegrity?.failures) && regionMap.layoutIntegrity.failures.length === 0, "workbench layout integrity has failures");
    const requiredIntegrityChecks = [
      "noRegionOverlap",
      "sourceDocumentNotToolbar",
      "noResourceActionCollision",
      "noVerticalFilterWrapping",
      "noOneCharacterChips",
      "inspectorTextReadable",
      "coreRegionsInsideViewport",
      "persistentSidePanels",
      "primaryActionVisible"
    ];
    for (const check of requiredIntegrityChecks) {
      assertCondition(errors, regionMap.layoutIntegrity?.checks?.[check] === true, `workbench layout integrity missing ${check}`);
    }
  }
  try {
    const renderProof = await readJson(".artifacts/product/P6/desktop-state-render-proof.json");
    assertCondition(errors, renderProof.passed === true, "desktop state render proof did not pass");
    assertCondition(errors, renderProof.states?.["local-minimum-size"]?.passed === true, "minimum supported local preview proof missing or failed");
    assertCondition(errors, renderProof.states?.["info-diagnostics-open"]?.passed === true, "diagnostics panel proof missing or failed");
  } catch (error) {
    errors.push(`desktop state render proof unreadable: ${error.message}`);
  }
  try {
    const artifactIndex = await readJson(".artifacts/product/P6/artifact-index.json");
    const byScenario = new Map((artifactIndex.artifacts ?? []).map((artifact) => [artifact.scenario, artifact]));
    const minimum = layoutContract.minimumSupportedWindow ?? {};
    for (const scenario of ["desktop-local-minimum-size"]) {
      const artifact = byScenario.get(scenario);
      assertCondition(errors, Boolean(artifact), `minimum-size artifact missing ${scenario}`);
      assertCondition(errors, artifact?.viewport?.width === minimum.width && artifact?.viewport?.height === minimum.height, `${scenario} viewport ${artifact?.viewport?.width}x${artifact?.viewport?.height} does not match declared minimum ${minimum.width}x${minimum.height}`);
    }
  } catch (error) {
    errors.push(`artifact index viewport proof unreadable: ${error.message}`);
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

const layoutAudit = {
  passed: errors.filter((message) => /layout contract|source document|preview stage|inspector|File Overview|Resources\/Layers|resource filter|duplicate file overview|Activity\/Logs|grid areas|sizing|truncation|collapse|sequence toggle|resource filters|source_document|workbench layout|min(imum)?-size artifact|viewport/.test(message)).length === 0,
  layoutContractPath: "docs/product/MACOS_WORKBENCH_LAYOUT_CONTRACT.json",
  regionCount: layoutContract.regions?.length ?? 0,
  componentCount: layoutContract.components?.length ?? 0,
  responsiveRuleCount: layoutContract.responsiveRules?.length ?? 0,
  minimumSupportedWindow: layoutContract.minimumSupportedWindow
};

const summary = {
  passed: errors.length === 0,
  target: target.target,
  sourceOnly,
  tokenAudit,
  componentAudit,
  layoutAudit,
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
