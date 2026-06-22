import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

interface P6ContractItem {
  id: string;
  required?: boolean;
  selector?: string;
  selectors?: readonly string[];
}

interface P6WebParityContract {
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
  states: 12,
  motions: 9
};

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
    reportGrid: "#reportGrid",
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
  return previewHtml.includes(`id="${id}"`);
}

function hasClass(className: string): boolean {
  for (const match of previewHtml.matchAll(/class="([^"]+)"/g)) {
    if (match[1].split(/\s+/).includes(className)) return true;
  }
  return false;
}

function hasAttributeValue(name: string, value: string): boolean {
  return new RegExp(`${escapeRegExp(name)}="${escapeRegExp(value)}"`).test(previewHtml);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
