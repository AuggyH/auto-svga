import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  overviewFactGroups,
  overviewVisibleFacts
} from "../web/short-term-macos-render-model.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("runtime structure overview facts keep secondary detail accessible", () => {
  const model = {
    overview: {
      facts: [
        { id: "runtimeStructure", label: "运行时结构", value: "低风险", status: "pass" },
        { id: "runtimeObjectCount", label: "运行对象数", value: "12", status: "pass" },
        { id: "runtimeVisibleDensity", label: "活跃绘制峰值/平均", value: "4 / 2.1", status: "pass", disclosure: "moreInfo" },
        { id: "runtimeInvisibleRatio", label: "不可见记录占比", value: "38%", status: "warning", disclosure: "moreInfo" },
        { id: "sequenceFanoutRisk", label: "序列帧展开风险", value: "未发现", status: "pass", disclosure: "moreInfo" },
        { id: "unusedInternal", label: "内部字段", value: "不显示", status: "pass", disclosure: "moreInfo" }
      ]
    }
  };

  const groups = overviewFactGroups(model);

  assert.deepEqual(groups.summary.map((fact) => fact.id), [
    "runtimeStructure",
    "runtimeObjectCount",
    "runtimeInvisibleRatio"
  ]);
  assert.deepEqual(groups.moreInfo.map((fact) => fact.id), [
    "runtimeVisibleDensity",
    "sequenceFanoutRisk"
  ]);
  assert.deepEqual(overviewVisibleFacts(model), groups.summary);
});

test("owner-visible right panel contains more info disclosure markers", async () => {
  const [renderModel, overviewModel, overviewRenderers, componentStyles] = await Promise.all([
    readFile(path.join(experimentRoot, "web/short-term-macos-render-model.mjs"), "utf8"),
    readFile(path.join(experimentRoot, "web/short-term-macos-overview-model.mjs"), "utf8"),
    readFile(path.join(experimentRoot, "web/short-term-macos-overview-renderers.mjs"), "utf8"),
    readFile(path.join(experimentRoot, "web/short-term-macos.components.css"), "utf8")
  ]);

  assert.match(renderModel, /export function overviewFactGroups/);
  assert.match(overviewModel, /moreInfoFacts: factGroups\.moreInfo/);
  assert.match(overviewRenderers, /export function createOverviewMoreInfoDisclosure/);
  assert.match(overviewRenderers, /RuntimeStructureMoreInfo/);
  assert.match(overviewRenderers, /factMoreInfo/);
  assert.match(overviewRenderers, /summary\.textContent = "更多信息"/);
  assert.match(componentStyles, /\.factMoreInfo/);
  assert.doesNotMatch(overviewRenderers, /SpriteEntity|FrameEntity|图层数|图层过多/);
});
