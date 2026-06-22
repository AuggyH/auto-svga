import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { decode, encode } from "fast-png";

export const P6_STATE_EVIDENCE_DIR = "state-comparisons";
export const P6_MOTION_EVIDENCE_DIR = "motion-evidence";
export const P6_MOTION_PHASES = ["start", "mid", "end"];

const stateImageSources = {
  "local-empty": {
    web: "web-baseline/screenshot-local-empty-1440x900.png",
    desktop: "desktop-empty.png"
  },
  "mode-menu-open": {
    web: "web-baseline/screenshot-mode-menu-open-1440x900.png",
    desktop: "desktop-mode-menu-open.png"
  },
  "export-review-loaded": {
    web: "web-baseline/screenshot-export-review-loaded-1440x900.png",
    desktop: "desktop-loaded.png"
  },
  "info-overview-open": {
    web: "web-baseline/screenshot-info-overview-1440x900.png",
    desktop: "desktop-inspection.png"
  },
  "info-assets-open": {
    web: "web-baseline/screenshot-info-assets-1440x900.png",
    desktop: "desktop-inspection.png"
  },
  "logs-open": {
    web: "web-baseline/screenshot-logs-1440x900.png",
    desktop: "desktop-logs-open.png"
  },
  "settings-open": {
    web: "web-baseline/screenshot-settings-1440x900.png",
    desktop: "desktop-settings-open.png"
  },
  "accessibility-toggles-on": {
    web: "web-baseline/screenshot-settings-1440x900.png",
    desktop: "desktop-accessibility-toggles-on.png"
  },
  "settings-closed-by-escape": {
    web: "web-baseline/screenshot-export-review-loaded-1440x900.png",
    desktop: "desktop-settings-closed-by-escape.png"
  },
  "synchronized-playback-toggled-by-space": {
    web: "web-baseline/screenshot-export-review-loaded-1440x900.png",
    desktop: "desktop-synchronized-playback-toggled-by-space.png"
  },
  "local-compare-empty": {
    web: "web-baseline/screenshot-local-compare-empty-1440x900.png",
    desktop: "desktop-local-compare-empty.png"
  },
  "responsive-export-review-loaded-at-900-x-720": {
    web: "web-baseline/screenshot-export-review-loaded-900x720.png",
    desktop: "desktop-1440x900.png"
  },
  "invalid-error-state": {
    web: "web-baseline/screenshot-invalid-1440x900.png",
    desktop: "desktop-invalid.png"
  },
  invalid: {
    web: "web-baseline/screenshot-invalid-1440x900.png",
    desktop: "desktop-invalid.png"
  }
};

export async function generateP6StateAndMotionEvidence(input) {
  const stateComparisons = {};
  const stateIds = new Set((input.contract?.states ?? []).map((state) => state.id));
  stateIds.add("invalid-error-state");
  for (const stateId of stateIds) {
    stateComparisons[stateId] = await generateStateComparison(input.p6Root, stateId);
  }
  const motionEvidence = {};
  const motions = input.contract?.motions ?? [];
  for (const motion of motions) {
    motionEvidence[motion.id] = await collectMotionEvidence(input.p6Root, motion.id);
  }
  return { stateComparisons, motionEvidence };
}

export async function generateStateComparison(p6Root, stateId) {
  const outDir = path.join(p6Root, P6_STATE_EVIDENCE_DIR);
  await mkdir(outDir, { recursive: true });
  const source = stateImageSources[stateId];
  const webSource = source ? path.join(p6Root, source.web) : null;
  const desktopSource = source ? path.join(p6Root, source.desktop) : null;
  const webOutput = path.join(outDir, `web-${stateId}.png`);
  const desktopOutput = path.join(outDir, `desktop-${stateId}.png`);
  const comparisonOutput = path.join(outDir, `web-desktop-${stateId}-comparison.png`);
  const jsonOutput = path.join(outDir, `${stateId}-comparison.json`);
  const result = {
    schemaVersion: 1,
    stateId,
    web: await imageEvidence(webSource, source?.web ?? null),
    desktop: await imageEvidence(desktopSource, source?.desktop ?? null),
    outputs: {
      web: relativeArtifactPath(webOutput, p6Root),
      desktop: relativeArtifactPath(desktopOutput, p6Root),
      comparison: relativeArtifactPath(comparisonOutput, p6Root)
    },
    checks: {
      webPresent: false,
      desktopPresent: false,
      bothNonBlank: false,
      notSameSourceHash: false,
      comparisonGenerated: false
    },
    passed: false,
    generatedAt: new Date().toISOString()
  };
  if (result.web.present) {
    await copyFile(webSource, webOutput);
    result.web.outputSha256 = await sha256File(webOutput);
    result.checks.webPresent = true;
  }
  if (result.desktop.present) {
    await copyFile(desktopSource, desktopOutput);
    result.desktop.outputSha256 = await sha256File(desktopOutput);
    result.checks.desktopPresent = true;
  }
  result.checks.bothNonBlank = result.web.nonBlank === true && result.desktop.nonBlank === true;
  result.checks.notSameSourceHash = Boolean(
    result.web.sha256 && result.desktop.sha256 && result.web.sha256 !== result.desktop.sha256
  );
  if (result.web.present && result.desktop.present) {
    const comparison = await writeComparisonImage(webSource, desktopSource, comparisonOutput);
    result.comparison = comparison;
    result.checks.comparisonGenerated = comparison.present === true;
  }
  result.passed = Object.values(result.checks).every(Boolean);
  await writeFile(jsonOutput, `${JSON.stringify(result, null, 2)}\n`);
  return {
    ...result,
    jsonPath: relativeArtifactPath(jsonOutput, p6Root),
    jsonSha256: await sha256File(jsonOutput)
  };
}

export async function collectMotionEvidence(p6Root, motionId) {
  const outDir = path.join(p6Root, P6_MOTION_EVIDENCE_DIR);
  await mkdir(outDir, { recursive: true });
  const phases = {};
  for (const host of ["web", "desktop"]) {
    phases[host] = {};
    for (const phase of P6_MOTION_PHASES) {
      const output = path.join(outDir, `${host}-motion-${motionId}-${phase}.png`);
      const source = motionSourcePath(p6Root, host, motionId, phase);
      if (!existsSync(output) && existsSync(source)) await copyFile(source, output);
      phases[host][phase] = await imageEvidence(output, relativeArtifactPath(output, p6Root));
    }
  }
  const webHashes = P6_MOTION_PHASES.map((phase) => phases.web[phase].sha256).filter(Boolean);
  const desktopHashes = P6_MOTION_PHASES.map((phase) => phases.desktop[phase].sha256).filter(Boolean);
  const result = {
    schemaVersion: 1,
    motionId,
    phases,
    checks: {
      webStartMidEndPresent: webHashes.length === P6_MOTION_PHASES.length,
      desktopStartMidEndPresent: desktopHashes.length === P6_MOTION_PHASES.length,
      webFramesNotGeneric: new Set(webHashes).size === P6_MOTION_PHASES.length,
      desktopFramesNotGeneric: new Set(desktopHashes).size === P6_MOTION_PHASES.length
    },
    generatedAt: new Date().toISOString()
  };
  result.passed = Object.values(result.checks).every(Boolean);
  const jsonOutput = path.join(outDir, `${motionId}-motion-evidence.json`);
  await writeFile(jsonOutput, `${JSON.stringify(result, null, 2)}\n`);
  return {
    ...result,
    jsonPath: relativeArtifactPath(jsonOutput, p6Root),
    jsonSha256: await sha256File(jsonOutput)
  };
}

function motionSourcePath(p6Root, host, motionId, phase) {
  if (host === "web") return path.join(p6Root, "web-baseline", `web-motion-${motionId}-${phase}.png`);
  return path.join(p6Root, `desktop-motion-${motionId}-${phase}.png`);
}

async function imageEvidence(filePath, repoPath) {
  if (!filePath || !existsSync(filePath)) return { path: repoPath, present: false };
  const bytes = await readFile(filePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  try {
    const decoded = decode(bytes, { checkCrc: true });
    return {
      path: repoPath,
      present: true,
      sha256,
      sizeBytes: bytes.byteLength,
      width: decoded.width,
      height: decoded.height,
      nonBlank: hasVisiblePixels(decoded)
    };
  } catch (error) {
    return {
      path: repoPath,
      present: true,
      sha256,
      sizeBytes: bytes.byteLength,
      decodeError: error instanceof Error ? error.message : String(error),
      nonBlank: false
    };
  }
}

async function writeComparisonImage(webPath, desktopPath, outputPath) {
  const web = decode(await readFile(webPath), { checkCrc: true });
  const desktop = decode(await readFile(desktopPath), { checkCrc: true });
  const width = web.width + desktop.width + 4;
  const height = Math.max(web.height, desktop.height);
  const data = new Uint8Array(width * height * 4);
  fill(data, 246);
  blit(data, width, web, 0, 0);
  fillDivider(data, width, web.width, height);
  blit(data, width, desktop, web.width + 4, 0);
  const bytes = encode({ width, height, data, channels: 4 });
  await writeFile(outputPath, bytes);
  return {
    present: true,
    path: outputPath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width,
    height,
    sizeBytes: bytes.byteLength
  };
}

function blit(target, targetWidth, source, xOffset, yOffset) {
  const sourceData = toRgba(source);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (y * source.width + x) * 4;
      const targetIndex = ((y + yOffset) * targetWidth + x + xOffset) * 4;
      target[targetIndex] = sourceData[sourceIndex];
      target[targetIndex + 1] = sourceData[sourceIndex + 1];
      target[targetIndex + 2] = sourceData[sourceIndex + 2];
      target[targetIndex + 3] = sourceData[sourceIndex + 3];
    }
  }
}

function toRgba(decoded) {
  if (decoded.channels === 4) return decoded.data;
  const rgba = new Uint8Array(decoded.width * decoded.height * 4);
  const channels = decoded.channels;
  for (let i = 0, j = 0; i < decoded.data.length; i += channels, j += 4) {
    rgba[j] = decoded.data[i] ?? 0;
    rgba[j + 1] = decoded.data[i + 1] ?? decoded.data[i] ?? 0;
    rgba[j + 2] = decoded.data[i + 2] ?? decoded.data[i] ?? 0;
    rgba[j + 3] = channels === 2 ? decoded.data[i + 1] : 255;
  }
  return rgba;
}

function hasVisiblePixels(decoded) {
  const rgba = toRgba(decoded);
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] > 0 && (rgba[i] !== 0 || rgba[i + 1] !== 0 || rgba[i + 2] !== 0)) return true;
  }
  return false;
}

function fill(data, value) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
}

function fillDivider(data, width, xOffset, height) {
  for (let y = 0; y < height; y += 1) {
    for (let x = xOffset; x < xOffset + 4; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = 28;
      data[index + 1] = 35;
      data[index + 2] = 45;
      data[index + 3] = 255;
    }
  }
}

function relativeArtifactPath(filePath, p6Root) {
  return `.artifacts/product/P6/${path.relative(p6Root, filePath).split(path.sep).join("/")}`;
}

async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}
