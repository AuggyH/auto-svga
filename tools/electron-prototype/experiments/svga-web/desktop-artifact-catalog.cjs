"use strict";

const { createHash } = require("node:crypto");
const { readdir, readFile, stat } = require("node:fs/promises");
const path = require("node:path");

const MIME_TYPES = new Map([
  [".gif", "image/gif"],
  [".json", "application/json; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".svga", "application/octet-stream"],
  [".webm", "video/webm"]
]);

function createDesktopArtifactCatalog({ groupedRoots = [], standaloneRoots = [], routePrefix = "/desktop-artifact" }) {
  const files = new Map();
  const normalizedPrefix = routePrefix.replace(/\/+$/, "");

  async function scan() {
    files.clear();
    const groups = [];
    for (const root of groupedRoots) {
      for (const itemDirectory of await listDirectories(root.rootPath)) {
        const itemName = path.basename(itemDirectory);
        const outputDirectory = path.join(itemDirectory, "output");
        const generatedDirectory = path.join(itemDirectory, "generated");
        const group = await inspectArtifactDirectory({
          directoryPath: outputDirectory,
          extraDirectories: [generatedDirectory],
          jobId: `${root.kind}:${itemName}`,
          outputLabel: `${root.kind}:${itemName}/output`,
          files,
          routePrefix: normalizedPrefix
        });
        if (group) groups.push(group);
      }
    }
    for (const root of standaloneRoots) {
      const group = await inspectArtifactDirectory({
        directoryPath: root.rootPath,
        jobId: root.jobId,
        outputLabel: root.outputLabel ?? root.jobId,
        files,
        routePrefix: normalizedPrefix
      });
      if (group) groups.push(group);
    }
    groups.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const latestWithSvga = groups.find(isCompleteSvgaGroup)
      ?? groups.find((group) => group.svgaPath)
      ?? null;
    const latestAny = groups[0] ?? null;
    const warnings = [];
    if (!latestWithSvga && latestAny) warnings.push("未找到包含 SVGA 的产物组，将仅提供最新参考文件。");
    if (!latestAny) warnings.push("未扫描到可用的本地产物。");
    return { latestWithSvga, latestAny, artifacts: groups, warnings };
  }

  async function readArtifact(publicPath) {
    const value = String(publicPath ?? "");
    if (!value.startsWith(`${normalizedPrefix}/`)) return undefined;
    const [, token] = value.slice(normalizedPrefix.length).split("/");
    if (!/^[a-f0-9]{24}$/.test(token)) return undefined;
    const artifact = files.get(token);
    if (!artifact || artifact.publicPath !== value) return undefined;
    const filePath = artifact.filePath;
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return undefined;
    const bytes = await readFile(filePath);
    return {
      bytes,
      mimeType: MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream",
      sizeBytes: bytes.byteLength
    };
  }

  return Object.freeze({ scan, readArtifact });
}

async function listDirectories(parentPath) {
  try {
    return (await readdir(parentPath, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(parentPath, entry.name));
  } catch {
    return [];
  }
}

async function inspectArtifactDirectory({ directoryPath, extraDirectories = [], jobId, outputLabel, files, routePrefix }) {
  const entries = [];
  for (const searchDirectory of [directoryPath, ...extraDirectories]) {
    try {
      for (const entry of await readdir(searchDirectory, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const absolutePath = path.join(searchDirectory, entry.name);
        const fileStat = await stat(absolutePath);
        entries.push({ absolutePath, name: entry.name, mtimeMs: fileStat.mtimeMs });
      }
    } catch {
      // Optional output/generated directories may not exist yet.
    }
  }
  const pickNewest = (predicate) => entries
    .filter(({ name }) => predicate(name.toLowerCase()))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  const svga = pickNewest((name) => name.endsWith(".svga"));
  const gif = pickNewest((name) => name.endsWith(".gif"));
  const mp4 = pickNewest((name) => name.endsWith(".mp4"));
  const webm = pickNewest((name) => name.endsWith(".webm"));
  const report = pickNewest((name) => name === "report.json");
  const keyFiles = [svga, gif, mp4, webm, report].filter(Boolean);
  if (keyFiles.length === 0) return undefined;

  const warnings = [];
  if (!svga) warnings.push("该产物组不包含 SVGA。");
  if (!gif && !mp4 && !webm) warnings.push("该产物组不包含参考预览文件。");
  if (!report) warnings.push("该产物组不包含 report.json。");

  return {
    jobId,
    outputDir: outputLabel,
    updatedAt: new Date(Math.max(...keyFiles.map(({ mtimeMs }) => mtimeMs))).toISOString(),
    ...(svga ? { svgaPath: registerFile(svga.absolutePath, files, routePrefix) } : {}),
    ...(gif ? { gifPath: registerFile(gif.absolutePath, files, routePrefix) } : {}),
    ...(mp4 ? { mp4Path: registerFile(mp4.absolutePath, files, routePrefix) } : {}),
    ...(webm ? { webmPath: registerFile(webm.absolutePath, files, routePrefix) } : {}),
    ...(report ? { reportPath: registerFile(report.absolutePath, files, routePrefix) } : {}),
    warnings
  };
}

function isCompleteSvgaGroup(group) {
  return Boolean(
    group.svgaPath
    && group.reportPath
    && (group.gifPath || group.mp4Path || group.webmPath)
  );
}

function registerFile(filePath, files, routePrefix) {
  const token = createHash("sha256").update(filePath).digest("hex").slice(0, 24);
  const publicPath = `${routePrefix}/${token}/${encodeURIComponent(path.basename(filePath))}`;
  files.set(token, { filePath, publicPath });
  return publicPath;
}

module.exports = {
  createDesktopArtifactCatalog
};
