import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

interface P6ContractItem {
  id: string;
  required?: boolean;
  selector?: string;
  selectors?: readonly string[];
  visibleStates?: readonly string[];
}

interface P6WebParityContract {
  baselineCommit: string;
  baselineArtifactsRoot: string;
  contractSha256: string;
  regions: P6ContractItem[];
  features: P6ContractItem[];
  interactions: P6ContractItem[];
  states: P6ContractItem[];
  motions: P6ContractItem[];
  requiredCounts: Record<InventorySection, number>;
}

type InventorySection = "regions" | "features" | "interactions" | "states" | "motions";

const inventoryMarkdown = readFileSync("docs/product/P6_WEB_FEATURE_INVENTORY.md", "utf8");
const contract = JSON.parse(
  readFileSync("docs/product/P6_WEB_PARITY_CONTRACT.json", "utf8")
) as P6WebParityContract;
const previewHtml = readFileSync("tools/svga-player-preview/index.html", "utf8");
const productShellHtml = readFileSync("tools/shared/product-frontend/product-shell.html", "utf8");
const productAppSource = readFileSync("tools/shared/product-frontend/product-app.mjs", "utf8");
const previewProductHtml = `${previewHtml}\n${productShellHtml}\n${productAppSource}`;
const baselineCaptureScript = readFileSync("tools/p6/p6-web-baseline-capture.cjs", "utf8");
const runtimeScenarioContractSource = readFileSync("tools/p6/runtime-scenarios/contract.mjs", "utf8");

const sectionHeadings: Record<InventorySection, string> = {
  regions: "Required Regions",
  features: "Required Features",
  interactions: "Required Interactions",
  states: "Required States",
  motions: "Required Motion"
};

const lowerBounds: Record<InventorySection, number> = {
  regions: 20,
  features: 33,
  interactions: 10,
  states: 22,
  motions: 9
};

const repair6RequiredStateIds = [
  "loading",
  "loaded",
  "playing",
  "paused",
  "invalid-error-state",
  "recovered-from-invalid",
  "local-compare-loaded",
  "reference-media-loaded",
  "latest-artifact-loaded",
  "asset-preview-modal-open"
];

test("P6 web inventory contract matches Markdown required item sets", () => {
  for (const section of Object.keys(sectionHeadings) as InventorySection[]) {
    const expectedIds = markdownIdsFor(section);
    const actualIds = contract[section].filter(({ required }) => required === true).map(({ id }) => id);

    assert.deepEqual(actualIds, expectedIds, `${section} required IDs must match Markdown inventory`);
  }
});

test("P6 web inventory contract keeps required flags and count floors", () => {
  for (const section of Object.keys(lowerBounds) as InventorySection[]) {
    const items = contract[section];
    const requiredIds = items.filter(({ required }) => required === true).map(({ id }) => id);

    assert.equal(requiredIds.length, items.length, `${section} must not contain optional parity items`);
    assert.ok(requiredIds.length >= lowerBounds[section], `${section} must not shrink below P6 repair lower bound`);
    assert.equal(
      contract.requiredCounts[section],
      requiredIds.length,
      `${section} requiredCounts must match the required inventory length`
    );
  }
});

test("P6 web inventory contract is bound to Repair 4 runtime capture outputs", () => {
  assert.equal(contract.baselineCommit, "dbab38fc7fc3cad09f6305775467422ded63318c");
  assert.equal(contract.baselineArtifactsRoot, ".artifacts/product/P6/web-baseline-r4");
  assert.notEqual(contract.contractSha256, "99bf9d777a5c0d303a30bd4992929d4e9dc553ada195daf69ee819ce402d1fc4");
  assert.ok(baselineCaptureScript.includes("artifact-index.json"));
  assert.ok(baselineCaptureScript.includes("request-audit.json"));
  assert.ok(baselineCaptureScript.includes("@import\\\\s+url"), "capture must parse imported CSS");
  assert.ok(baselineCaptureScript.includes("@keyframes\\\\s+"), "capture must parse keyframes from CSS text");
});

test("P6 web inventory contract lists reachable baseline controls", () => {
  const featuresById = byId(contract.features);
  const regionsById = byId(contract.regions);

  const requiredFeatureSelectors: Record<string, readonly string[]> = {
    "secondary-svga-file-select": ["#secondaryFileInput", "#secondaryEmptyFileButton"],
    "secondary-svga-drag-drop": ["#svgaPanelB"],
    "reference-media-select": ["#referenceFileInput", "#referenceEmptyFileButton"],
    "reference-media-drag-drop": ["#referencePanel"],
    "latest-artifact-scan-and-load": ["#rescanButton", "#autoLoadLatestToggle"],
    "synchronized-review-playback": ["#syncPlayControl", "#syncProgress"],
    "synchronized-replay": ["#syncReplayControl"],
    "copy-logs": ["#copyFullLogsButton"],
    "clear-logs": ["#clearFullLogsButton"],
    "reduced-motion-setting": ["#reduceMotionToggle"],
    "reduced-blur-setting": ["#reduceBlurToggle"],
    "status-announcements": ["#statusAnnouncer", "#settingsToast", "#rescanStatus"]
  };

  const requiredRegionSelectors: Record<string, string> = {
    playerBarA: "#svgaPanelA .playerBar",
    playerBarB: "#svgaPanelB .playerBar",
    referencePlayerBar: "#referencePanel .playerBar",
    assetPreviewModal: "#assetPreviewModal",
    reportGrid: "#tab-overview .overviewGrid, #reportGrid",
    floatingRoot: "#floatingRoot"
  };

  for (const [featureId, selectors] of Object.entries(requiredFeatureSelectors)) {
    const feature = featuresById.get(featureId);
    assert.ok(feature, `${featureId} must be present in contract features`);
    for (const selector of selectors) {
      assert.ok(feature.selectors?.includes(selector), `${featureId} must list ${selector}`);
      assert.ok(selectorExists(selector), `${selector} must exist in the Web preview HTML`);
    }
  }

  for (const [regionId, selector] of Object.entries(requiredRegionSelectors)) {
    const region = regionsById.get(regionId);
    assert.ok(region, `${regionId} must be present in contract regions`);
    assert.equal(region.selector, selector);
    assert.ok(selectorExists(selector), `${selector} must exist in the Web preview HTML`);
  }
});

test("P6 web inventory contract keeps Repair 5 runtime-visible regions reachable", () => {
  const regionsById = byId(contract.regions);

  const requiredRegionStates: Record<string, readonly string[]> = {
    playerBarB: ["local-compare-loaded"],
    referencePlayerBar: ["export-review-loaded"],
    assetPreviewModal: ["asset-preview-modal-open"],
    reportGrid: ["info-overview-open"]
  };

  for (const [regionId, visibleStates] of Object.entries(requiredRegionStates)) {
    const region = regionsById.get(regionId);
    assert.ok(region, `${regionId} must be present in contract regions`);
    assert.deepEqual(region.visibleStates, visibleStates, `${regionId} must use an item-specific reachable visible state`);
    for (const stateId of visibleStates) {
      assert.ok(baselineCaptureScript.includes(stateId), `${regionId} visible state ${stateId} must be captured`);
    }
  }

  assert.ok(contract.requiredCounts.states >= 22, "Repair 6 must not shrink required state coverage");
});

test("P6 web baseline capture records item-specific runtime evidence for Repair 5 false negatives", () => {
  for (const stateId of [
    "mode-menu-open",
    "asset-preview-modal-open",
    "local-compare-empty",
    "local-compare-loaded"
  ]) {
    assert.ok(baselineCaptureScript.includes(stateId), `capture must collect ${stateId}`);
  }

  for (const selector of [
    "#modeDropdownMenu",
    "#tab-assets [data-preview-image-key]:not(:disabled)",
    "#assetPreviewModal",
    "#secondaryFileInput",
    "#svgaCanvasB canvas",
    "[role=status]",
    "[aria-live]"
  ]) {
    assert.ok(baselineCaptureScript.includes(selector), `capture must exercise ${selector}`);
  }

  assert.ok(baselineCaptureScript.includes("stateId:"), "runtime snapshots must keep stateId for parity checks");
  assert.ok(baselineCaptureScript.includes("present: Boolean(node)"), "runtime snapshots must record selector presence");
  assert.ok(baselineCaptureScript.includes("visible: isVisible(node)"), "runtime snapshots must record computed visibility");
  assert.ok(baselineCaptureScript.includes("screenshot-asset-preview-modal-1440x900.png"));
  assert.ok(baselineCaptureScript.includes("screenshot-local-compare-loaded-1440x900.png"));
});

test("P6 web inventory contract appends Repair 6 required states", () => {
  const contractStateIds = contract.states.map(({ id }) => id);

  for (const stateId of repair6RequiredStateIds) {
    assert.ok(contractStateIds.includes(stateId), `contract must require ${stateId}`);
  }
});

test("P6 web runtime scenario capture and required state contract stay in union", () => {
  const contractStateIds = contract.states.map(({ id }) => id).sort();
  const capturedStateIds = [...baselineCaptureScript.matchAll(/collectSnapshot\(window, "([^"]+)"\)/g)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(capturedStateIds, contractStateIds, "Web reachable capture states and required contract states must match exactly");

  for (const stateId of contractStateIds) {
    assert.ok(runtimeScenarioContractSource.includes(screenshotNameForState(stateId)), `${stateId} must have scenario artifact coverage`);
  }
});

function markdownIdsFor(section: InventorySection): string[] {
  return markdownItems(sectionHeadings[section]).map((item) => {
    if (section === "regions" || section === "motions") {
      const codeId = item.match(/`([^`]+)`/)?.[1];
      assert.ok(codeId, `${section} item must use a code ID: ${item}`);
      return codeId;
    }
    return slugifyInventoryItem(item);
  });
}

function markdownItems(heading: string): string[] {
  const match = inventoryMarkdown.match(new RegExp(`## ${escapeRegExp(heading)}\\n\\n([\\s\\S]*?)(?=\\n## |$)`));
  assert.ok(match, `${heading} section must exist`);
  return match[1]
    .split(/\r?\n/)
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function slugifyInventoryItem(value: string): string {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/->/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function byId(items: readonly P6ContractItem[]): Map<string, P6ContractItem> {
  return new Map(items.map((item) => [item.id, item]));
}

function selectorExists(selector: string): boolean {
  if (selector === "body") return /<body\b/.test(previewHtml);
  return selector
    .split(",")
    .every((part) => selectorPartExists(part.trim()));
}

function selectorPartExists(selector: string): boolean {
  return selector
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => {
      const id = part.match(/#([a-zA-Z0-9_-]+)/)?.[1];
      if (id && !hasId(id)) return false;

      for (const classMatch of part.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
        if (!hasClass(classMatch[1])) return false;
      }

      for (const attrMatch of part.matchAll(/\[([a-zA-Z0-9_-]+)=['"]?([^'"\]]+)['"]?\]/g)) {
        if (!hasAttributeValue(attrMatch[1], attrMatch[2])) return false;
      }

      return true;
    });
}

function hasId(id: string): boolean {
  return previewProductHtml.includes(`id="${id}"`);
}

function hasClass(className: string): boolean {
  for (const match of previewProductHtml.matchAll(/class="([^"]+)"/g)) {
    if (match[1].split(/\s+/).includes(className)) return true;
  }
  return false;
}

function hasAttributeValue(name: string, value: string): boolean {
  return new RegExp(`${escapeRegExp(name)}="${escapeRegExp(value)}"`).test(previewProductHtml);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function screenshotNameForState(stateId: string): string {
  if (stateId === "invalid-error-state") return "screenshot-invalid-1440x900.png";
  if (stateId === "asset-preview-modal-open") return "screenshot-asset-preview-modal-1440x900.png";
  if (stateId === "info-overview-open") return "screenshot-info-overview-1440x900.png";
  if (stateId === "info-assets-open") return "screenshot-info-assets-1440x900.png";
  if (stateId === "logs-open") return "screenshot-logs-1440x900.png";
  if (stateId === "settings-open") return "screenshot-settings-1440x900.png";
  if (stateId === "responsive-export-review-loaded-at-900-x-720") return "screenshot-export-review-loaded-900x720.png";
  return `screenshot-${stateId}-1440x900.png`;
}
