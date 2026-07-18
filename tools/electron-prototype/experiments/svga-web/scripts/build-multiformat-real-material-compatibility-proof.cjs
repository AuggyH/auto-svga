"use strict";

const { createHash } = require("node:crypto");
const { lstatSync, readFileSync, statSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const [sourcePath, outputPath, appRoot, repoRoot, bindingPath] = process.argv.slice(2);
if (![sourcePath, outputPath, appRoot, repoRoot, bindingPath].every(Boolean)) {
  throw new Error("Real-material compatibility proof builder arguments are incomplete.");
}

const bindingLinkStat = lstatSync(bindingPath);
const bindingStat = statSync(bindingPath);
if (!bindingLinkStat.isFile() || bindingLinkStat.isSymbolicLink() || (bindingStat.mode & 0o777) !== 0o600) {
  throw new Error("The real-material compatibility binding must use mode 0600.");
}
const binding = JSON.parse(readFileSync(bindingPath, "utf8"));
const bindingEntries = new Map((binding.entries ?? []).map((entry) => [entry.alias, entry]));
const expectedInputs = Object.freeze({
  svgaWide: input("SVGA-A", "dc4ff0c5d3f9f6254a28fb4410c340519738ad47d77dc0b33d8768407cdcf0ad"),
  lottieNearLimit: input("LOTTIE-NEAR-LIMIT", "d593a4696bc714b0d72f0dc258b6d493c7a447557d864a170ec19214877c55c1"),
  lottieLegacy: input("LOTTIE-LEGACY-SHAPE", "264952d02f65a41df90b03c7685dd77f967ed55406be74ac65b6e761fa6700f7"),
  lottieExpression: input("LOTTIE-EXPRESSION-MASK", "d81ff3608cfb0400ba9ab7f7a552d855c6a879d866554c2d09a93464b159cbcc"),
  lottieExternal: input("LOTTIE-EXTERNAL-BUNDLE", "66d8942ea5e98c2cfddd77706f962e688a4a93ee8bf8e46635a890804fc2cc58"),
  lottieFont: input("LOTTIE-FONT-NEGATIVE", "c5a9580ef7bdab723277ea3554f6b37dd5cf1cccae50a11307d1bfd184264842"),
  vapMixedFusion: input("VAP-MIXED-FUSION", "460c3bc8353084360907024dcaa055416cae5f987fb5740e81984e2ce02036f1")
});

let source = readFileSync(sourcePath, "utf8");
const replaceOnce = (needle, replacement) => {
  const index = source.indexOf(needle);
  if (index < 0 || source.indexOf(needle, index + needle.length) >= 0) {
    throw new Error(`Expected one proof marker: ${needle.slice(0, 100)}`);
  }
  source = source.replace(needle, replacement);
};

replaceOnce(
  'const scriptRoot = __dirname;\nconst appRoot = path.resolve(scriptRoot, "..");\nconst repoRoot = path.resolve(appRoot, "../../../..");',
  `const scriptRoot = ${JSON.stringify(path.join(appRoot, "scripts"))};\nconst appRoot = ${JSON.stringify(appRoot)};\nconst repoRoot = ${JSON.stringify(repoRoot)};`
);
replaceOnce(
  'require("../multiformat-desktop-session.cjs")',
  `require(${JSON.stringify(path.join(appRoot, "multiformat-desktop-session.cjs"))})`
);
replaceOnce(
  'const skipFusionFixture = process.env.AUTO_SVGA_SKIP_FUSION_FIXTURE === "1";',
  'const skipFusionFixture = true;'
);
replaceOnce(
  'const tinyPngBase64 =',
  `const compatibilityInputs = Object.freeze(${JSON.stringify(expectedInputs)});\nconst tinyPngBase64 =`
);
replaceOnce('alias: "REAL-LOTTIE-EMBEDDED-A"', 'alias: "OWNER-LOTTIE-LUCKY-COMBO"');
replaceOnce(
  'sha256: "4d415de7f6ec0a3742281e91f60a0dcc9e1c5574760e82e17a053eafc1d82eb1"',
  'sha256: "6e8c6c3a63bae939bfe5574c8f2bf862778b90e9b4f59779a3fb515834c61a81"'
);
replaceOnce('expectedImageCount: 2', 'expectedImageCount: 26');
replaceOnce('modelStatus(snapshot) === "previewReady"', 'modelStatus(snapshot) === "playing"');
replaceOnce(
  '  await runInPage(`${input.label} play`, "window.__autoSvgaShortTermActions.playPause()");\n',
  ''
);

const vapEvidenceMarker = `  const vapEvidence = await provePlayableFormat({
    label: ownerInputs.vap.alias,
    format: "vap",
    filePath: ownerInputs.vap.filePath,
    expectedCanvas: "runtime",
    requireVideo: true,
    requireWebgl: true,
    requireCanvasRisk: true,
    expectedBacking: { width: 750, height: 1624 }
  });`;
replaceOnce(vapEvidenceMarker, `${vapEvidenceMarker}
  const compatibilityEvidence = {
    svgaWide: await provePlayableFormat({ label: compatibilityInputs.svgaWide.alias, format: "svga", filePath: compatibilityInputs.svgaWide.filePath, expectedCanvas: "primary" }),
    lottieNearLimit: await provePlayableFormat({ label: compatibilityInputs.lottieNearLimit.alias, format: "lottie", filePath: compatibilityInputs.lottieNearLimit.filePath, expectedCanvas: "runtime", expectedImageCount: 72 }),
    lottieLegacy: await provePlayableFormat({ label: compatibilityInputs.lottieLegacy.alias, format: "lottie", filePath: compatibilityInputs.lottieLegacy.filePath, expectedCanvas: "runtime", expectedImageCount: 0 }),
    vapMixedFusion: await provePlayableFormat({ label: compatibilityInputs.vapMixedFusion.alias, format: "vap", filePath: compatibilityInputs.vapMixedFusion.filePath, expectedCanvas: "runtime", requireVideo: true, requireWebgl: true, expectedBacking: { width: 999, height: 1347 } }),
    lottieExpression: await proveTypedBlockedFormat({ label: compatibilityInputs.lottieExpression.alias, format: "lottie", filePath: compatibilityInputs.lottieExpression.filePath, issueCode: "unsupported_feature", expectedImageCount: 80 }),
    lottieExternal: await proveTypedBlockedFormat({ label: compatibilityInputs.lottieExternal.alias, format: "lottie", filePath: compatibilityInputs.lottieExternal.filePath, issueCode: "unsupported_feature", expectedImageCount: 27 }),
    lottieFont: await proveTypedBlockedFormat({ label: compatibilityInputs.lottieFont.alias, format: "lottie", filePath: compatibilityInputs.lottieFont.filePath, issueCode: "owner_issue", expectedImageCount: 1, expectedTextCount: 1 })
  };`);

replaceOnce(
  '      ownerVap: ownerInputEvidence(ownerInputs.vap),',
  `      ownerVap: ownerInputEvidence(ownerInputs.vap),
      compatibility: Object.values(compatibilityInputs).map(({ alias, sha256 }) => ({ alias, sha256, pathRedacted: true })),`
);
replaceOnce(
  '      vap: vapEvidence,',
  `      vap: vapEvidence,
      compatibility: compatibilityEvidence,`
);
replaceOnce(
  'async function proveMissingLottieAssetFailure() {',
  `async function proveTypedBlockedFormat(input) {
  const openAction = await openFileInProduct(input.filePath, input.label);
  const snapshot = await waitForPage(\`${"${input.label}"} typed blocked\`, () => pageSnapshot(), (candidate) => {
    const model = candidate.hostModel?.model;
    return modelFormat(candidate) === input.format
      && ["failed", "playbackBlocked", "playbackFailed"].includes(model?.status)
      && model?.rightPanel?.issues?.some((issue) => issue.code === input.issueCode);
  });
  const summary = snapshot.hostModel?.model?.rightPanel?.assetInventory?.summary ?? {};
  if (Number.isFinite(input.expectedImageCount) && Number(summary.imageCount) !== input.expectedImageCount) {
    throw new Error(\`${"${input.label}"} image inventory mismatch.\`);
  }
  if (Number.isFinite(input.expectedTextCount) && Number(summary.textCount) !== input.expectedTextCount) {
    throw new Error(\`${"${input.label}"} text inventory mismatch.\`);
  }
  if (snapshot.runtimeMountState === "loaded" && snapshot.runtimeFormat === input.format) {
    throw new Error(\`${"${input.label}"} reached a runtime mount despite a typed blocking issue.\`);
  }
  return { openAction, snapshot: compactSnapshot(snapshot) };
}

async function proveMissingLottieAssetFailure() {`
);
replaceOnce(
  '    sourceHead: await gitHead(),\n    input:',
  `    sourceHead: await gitHead(),
    runtimeProcess: {
      taskOwner: "codex-multiformat-real-material-compatibility-20260718",
      pid: process.pid,
      listener: { host: "127.0.0.1", port: Number(new URL(server.origin).port) }
    },
    input:`
);

writeFileSync(outputPath, source, { mode: 0o600 });

function input(alias, expectedSha256) {
  const entry = bindingEntries.get(alias);
  if (!entry || typeof entry.copy !== "string" || !path.isAbsolute(entry.copy)) {
    throw new Error(`${alias} is unavailable in the private binding.`);
  }
  if (entry.copySha256 !== expectedSha256) throw new Error(`${alias} hash drifted.`);
  const entryLinkStat = lstatSync(entry.copy);
  if (!entryLinkStat.isFile() || entryLinkStat.isSymbolicLink()) throw new Error(`${alias} copy is not a regular file.`);
  const entryStat = statSync(entry.copy);
  if (!entryStat.isFile() || entryStat.size !== entry.copyBytes) throw new Error(`${alias} copy identity drifted.`);
  const actualSha256 = createHash("sha256").update(readFileSync(entry.copy)).digest("hex");
  if (actualSha256 !== expectedSha256) throw new Error(`${alias} copy bytes drifted.`);
  return { alias, filePath: entry.copy, sha256: expectedSha256 };
}
