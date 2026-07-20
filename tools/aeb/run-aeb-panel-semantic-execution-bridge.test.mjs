import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

import {
  buildFixtureRequestMaterial,
  ENTRY_CONTRACT
} from "./aeb-registered-fixture-runtime-entry.mjs";

const INBOX = "/private/tmp/auto-svga-aeb-dev/semantic-inbox";
const REQUEST_PATH = `${INBOX}/request.json`;
const AE26_INBOX = "/private/tmp/auto-svga-aeb-dev/semantic-inbox-ae26";
const AE26_REQUEST_PATH = `${AE26_INBOX}/request.json`;
const LEGACY_EXTENSION_ID = "local.auto-svga.aeb.panel.dev.export";
const AE26_EXTENSION_ID = "local.auto-svga.aeb.panel.ae26.dev.export";
const PANEL_SOURCE_IDENTITY = "aeb-panel-semantic-execution-bridge-v0";

function wildcardRegex(pattern) {
  return new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
}

function makeHost({
  requestText,
  requestPath = REQUEST_PATH,
  projectSeed = null,
  aliases = [],
  failWriteSuffix = "",
  appVersion = "26.3.0",
  jsxFileName = "",
  jsonAvailable = true,
  poisonedJsonParse = false
} = {}) {
  const files = new Map();
  const folders = new Set([
    "/",
    "/private",
    "/private/tmp",
    "/private/tmp/auto-svga-aeb-dev",
    INBOX,
    AE26_INBOX
  ]);
  const aliasSet = new Set(aliases);
  const createdComps = [];

  if (typeof requestText === "string") files.set(requestPath, requestText);

  function CompItem() {}

  function makeProject(seed = {}) {
    let activeItem = seed.activeItem ?? null;
    const project = {
      file: seed.fileBacked ? { fsName: "/redacted/source.aep" } : null,
      numItems: seed.numItems ?? 0,
      items: null
    };
    Object.defineProperty(project, "activeItem", {
      configurable: true,
      get() { return activeItem; },
      set(value) {
        if (seed.activeItemReadOnly) throw new Error("Project.activeItem is read-only");
        activeItem = value;
      }
    });
    project.items = {
      addComp(name, width, height, pixelAspect, duration, fps) {
        const comp = new CompItem();
        Object.assign(comp, {
          name,
          width,
          height,
          pixelAspect,
          duration,
          frameRate: fps,
          numLayers: 0,
          layer() {
            throw new Error("Semantic scratch comp must remain empty.");
          }
        });
        project.numItems += 1;
        createdComps.push(comp);
        return comp;
      }
    };
    return project;
  }

  function Folder(folderPath) {
    this.fsName = path.posix.normalize(String(folderPath));
    this.create = () => {
      folders.add(this.fsName);
      return true;
    };
    this.getFiles = (pattern) => {
      const match = wildcardRegex(pattern);
      return [...files.keys()]
        .filter((filePath) => path.posix.dirname(filePath) === this.fsName)
        .filter((filePath) => match.test(path.posix.basename(filePath)))
        .sort()
        .map((filePath) => new File(filePath));
    };
    Object.defineProperties(this, {
      exists: { get: () => folders.has(this.fsName) },
      alias: { get: () => aliasSet.has(this.fsName) },
      parent: { get: () => new Folder(path.posix.dirname(this.fsName)) }
    });
  }

  function File(filePath) {
    this.fsName = path.posix.normalize(String(filePath));
    this.encoding = "UTF-8";
    let mode = "";
    let buffer = "";
    this.open = (nextMode) => {
      const allowed = nextMode === "w"
        ? folders.has(path.posix.dirname(this.fsName)) &&
          !(failWriteSuffix && this.fsName.endsWith(failWriteSuffix))
        : files.has(this.fsName);
      mode = allowed ? nextMode : "";
      buffer = allowed && nextMode === "r" ? files.get(this.fsName) ?? "" : "";
      return allowed;
    };
    this.read = () => buffer;
    this.write = (text) => {
      if (mode !== "w") throw new Error("File is not open for writing.");
      buffer += String(text);
    };
    this.close = () => {
      if (mode === "w") files.set(this.fsName, buffer);
      mode = "";
      return true;
    };
    this.rename = (newName) => {
      const destination = path.posix.join(path.posix.dirname(this.fsName), String(newName));
      if (!files.has(this.fsName) || files.has(destination)) return false;
      files.set(destination, files.get(this.fsName));
      files.delete(this.fsName);
      this.fsName = destination;
      return true;
    };
    Object.defineProperties(this, {
      exists: { get: () => files.has(this.fsName) },
      alias: { get: () => aliasSet.has(this.fsName) },
      length: { get: () => Buffer.byteLength(files.get(this.fsName) ?? "") },
      parent: { get: () => new Folder(path.posix.dirname(this.fsName)) },
      name: { get: () => path.posix.basename(this.fsName) }
    });
  }

  const app = {
    version: appVersion,
    project: projectSeed ? makeProject(projectSeed) : null,
    newProject() {
      this.project = makeProject();
      return this.project;
    }
  };

  const context = {
    CompItem,
    File,
    Folder,
    app,
    $: { os: "macOS fake CEP", locale: "zh_CN", fileName: jsxFileName }
  };
  if (!jsonAvailable) context.JSON = undefined;
  if (poisonedJsonParse) {
    context.JSON = {
      parse() {
        throw new Error("AEB panel requires JSON.parse support in this AE host.");
      }
    };
  }

  return {
    context,
    files,
    folders,
    aliases: aliasSet,
    createdComps
  };
}

function makeRequest(patch = {}) {
  const now = Date.now();
  const requestId = patch.requestId ?? "aeb-semantic-test";
  return {
    schemaVersion: "aeb-panel-semantic-request-v1",
    action: "prepare-scratch-and-export-metadata",
    requestId,
    oneTimeState: "pending",
    executionState: "not_executed",
    sourceIdentity: PANEL_SOURCE_IDENTITY,
    panelIdentity: {
      bundleId: "local.auto-svga.aeb.panel.dev",
      extensionId: "local.auto-svga.aeb.panel.dev.export",
      version: "0.3.0"
    },
    targetHost: {
      appId: "AEFT",
      versionMajor: 26,
      versionMinor: 3,
      versionRule: "app.version.leading_major_minor"
    },
    createdAtEpochMs: now - 1000,
    expiresAtEpochMs: now + 60_000,
    outputRoot: `/private/tmp/auto-svga-aeb-dev/${requestId}/ae-export-package`,
    boundaries: {
      sourceProjectMutationAllowed: false,
      saveOrOverwriteAllowed: false,
      renderOrBakeAllowed: false,
      relinkOrCollectAllowed: false,
      encoderAllowed: false,
      networkOrCloudAllowed: false,
      targetSupportClaimAllowed: false,
      visualOrExportSuccessClaimAllowed: false
    },
    ...patch
  };
}

function makeAe26IsolatedRequest(patch = {}) {
  return makeRequest({
    panelIdentity: {
      bundleId: "local.auto-svga.aeb.panel.ae26.dev",
      extensionId: AE26_EXTENSION_ID,
      version: "0.3.0"
    },
    ...patch
  });
}

function makeCurrentRuntimeEntryAe26Request(patch = {}) {
  const now = Date.now();
  const requestId = patch.requestId ?? "aeb-semantic-ae26-current";
  const input = {
    schema: ENTRY_CONTRACT.requestSchema,
    permitId: "ASV-APR-20260717-135",
    requestCreatedAtEpochMs: now - 1000,
    requestExpiresAtEpochMs: now - 1000 + ENTRY_CONTRACT.requestLifetimeMs,
    requestId,
    sourceHead: ENTRY_CONTRACT.packetBaseHead,
    sourcePackageRoot: `/private/tmp/auto-svga-aeb-dev/${requestId}/ae-export-package`,
    ...patch.input
  };
  const material = buildFixtureRequestMaterial(input);
  return {
    input,
    material,
    request: material.request
  };
}

async function loadJsx(context, { legacyActiveItemAssignment = false } = {}) {
  let source = await readFile(
    new URL("./plugin-panel-dev/jsx/aeb-export-to-auto-svga.jsx", import.meta.url),
    "utf8"
  );
  if (legacyActiveItemAssignment) {
    const original = "    return comp;\n  }\n\n  function writeScratchMarker";
    const legacy = "    app.project.activeItem = comp;\n    return comp;\n  }\n\n  function writeScratchMarker";
    assert.equal(source.includes(original), true);
    source = source.replace(original, legacy);
  }
  vm.runInNewContext(source, context, { filename: "aeb-export-to-auto-svga.jsx" });
}

async function loadPanel(
  context,
  {
    extensionId = LEGACY_EXTENSION_ID,
    hostEnvironment = null,
    firstEvalResult = null,
    systemPathResults = null,
    bridgeReadyAfterTimeouts = 0
  } = {}
) {
  const statusNode = { textContent: "Idle" };
  const listeners = new Map();
  const nodes = {
    "aeb-status": statusNode,
    "aeb-output-folder": { value: "{PILOT_ROOT}/ae-export-package" },
    "aeb-scratch-prepare-button": {
      addEventListener(name, callback) { listeners.set(`scratch:${name}`, callback); }
    },
    "aeb-export-button": {
      addEventListener(name, callback) { listeners.set(`export:${name}`, callback); }
    }
  };
  const evalCalls = [];
  const systemPathCalls = [];
  let timeoutCalls = 0;
  const cepBridge = {
    getExtensionId() { return extensionId; },
    ...(hostEnvironment ? {
      getHostEnvironment() {
        return typeof hostEnvironment === "string" ? hostEnvironment : JSON.stringify(hostEnvironment);
      }
    } : {}),
    getSystemPath(name) {
      assert.equal(name, "extension");
      const fallback = "/mock/auto-svga-aeb-extension";
      const index = Math.min(systemPathCalls.length, (systemPathResults?.length ?? 1) - 1);
      const result = systemPathResults ? systemPathResults[index] : fallback;
      systemPathCalls.push(result);
      return result;
    },
    evalScript(script, callback) {
      evalCalls.push(script);
      if (firstEvalResult !== null && evalCalls.length === 1) {
        callback(firstEvalResult);
        return;
      }
      try {
        if (script.includes("aebConsumeSemanticPilotRequestAe26()")) {
          assert.match(script, /\$\.evalFile\(new File\("\/mock\/auto-svga-aeb-extension\/jsx\/aeb-export-to-auto-svga\.jsx"\)\)/u);
          callback(context.aebConsumeSemanticPilotRequestAe26());
        } else {
          assert.match(script, /aebConsumeSemanticPilotRequest\(\)/u);
          callback(context.aebConsumeSemanticPilotRequest());
        }
      } catch (error) {
        callback(`EvalScript error. ${error.message}`);
      }
    }
  };
  const panelWindow = bridgeReadyAfterTimeouts > 0 ? {} : { __adobe_cep__: cepBridge };
  const panelContext = {
    document: {
      readyState: "complete",
      getElementById(id) { return nodes[id] ?? null; },
      addEventListener() {}
    },
    window: panelWindow,
    setTimeout(callback) {
      timeoutCalls += 1;
      if (bridgeReadyAfterTimeouts > 0 && timeoutCalls >= bridgeReadyAfterTimeouts) {
        panelWindow.__adobe_cep__ = cepBridge;
      }
      callback();
    }
  };
  const source = await readFile(
    new URL("./plugin-panel-dev/js/aeb-panel.js", import.meta.url),
    "utf8"
  );
  vm.runInNewContext(source, panelContext, { filename: "aeb-panel.js" });
  return { statusNode, listeners, evalCalls, systemPathCalls, timeoutCalls };
}

async function makeScenario({
  request,
  rawRequestText,
  projectSeed,
  aliases = [],
  failWriteSuffix = "",
  extraFiles = {},
  appVersion,
  jsxFileName,
  requestPath = REQUEST_PATH
} = {}) {
  const requestText = rawRequestText ?? JSON.stringify(request ?? makeRequest());
  const host = makeHost({ requestText, requestPath, projectSeed, aliases, failWriteSuffix, appVersion, jsxFileName });
  for (const [filePath, contents] of Object.entries(extraFiles)) {
    host.files.set(filePath, contents);
  }
  const parsedRequest = request ?? (rawRequestText ? null : JSON.parse(requestText));
  if (parsedRequest?.outputRoot) {
    host.folders.add(path.posix.dirname(parsedRequest.outputRoot));
  }
  await loadJsx(host.context);
  return host;
}

test("fake CEP leaves the normal panel idle when no semantic request exists", async () => {
  const host = makeHost();
  await loadJsx(host.context);
  const panel = await loadPanel(host.context);

  assert.equal(panel.evalCalls.length, 2);
  assert.match(panel.evalCalls[0], /aebConsumeSemanticPilotRequestAe26\(\)/u);
  assert.match(panel.evalCalls[1], /aebConsumeSemanticPilotRequest\(\)/u);
  assert.equal(panel.statusNode.textContent, "Idle");
  assert.equal(host.files.size, 0);
  assert.equal(host.context.app.project, null);
});

test("fake CEP consumes one request through existing scratch and metadata export entrypoints", async () => {
  const request = makeRequest({ requestId: "aeb-semantic-e2e" });
  const host = await makeScenario({ request });
  let scratchCalls = 0;
  let exportCalls = 0;
  const scratchEntry = host.context.aebPrepareScratchForAutoSvga;
  const exportEntry = host.context.aebExportToAutoSvga;
  host.context.aebPrepareScratchForAutoSvga = (...args) => {
    scratchCalls += 1;
    return scratchEntry(...args);
  };
  host.context.aebExportToAutoSvga = (...args) => {
    exportCalls += 1;
    return exportEntry(...args);
  };
  const panel = await loadPanel(host.context);

  assert.equal(panel.evalCalls.length, 2);
  assert.match(panel.evalCalls[0], /aebConsumeSemanticPilotRequestAe26\(\)/u);
  assert.match(panel.evalCalls[1], /aebConsumeSemanticPilotRequest\(\)/u);
  assert.equal(scratchCalls, 1);
  assert.equal(exportCalls, 1);
  assert.equal(panel.statusNode.textContent, "AEB semantic request consumed: aeb-semantic-e2e");
  assert.equal(host.files.has(REQUEST_PATH), false);
  assert.equal(host.files.has(`${INBOX}/consumed-aeb-semantic-e2e.json`), true);

  const markerPath = "/private/tmp/auto-svga-aeb-dev/aeb-semantic-e2e/reports/scratch-setup-marker.json";
  const packagePath = `${request.outputRoot}/ae-export-package.json`;
  const receiptPath = "/private/tmp/auto-svga-aeb-dev/aeb-semantic-e2e/reports/semantic-execution-receipt.json";
  const marker = JSON.parse(host.files.get(markerPath));
  const pkg = JSON.parse(host.files.get(packagePath));
  const receiptText = host.files.get(receiptPath);
  const receipt = JSON.parse(receiptText);

  assert.equal(marker.status, "pass");
  assert.equal(marker.scratch.layerCount, 0);
  assert.equal(pkg.aeExportPackage.s3Report.scanStatus, "completed_metadata_only");
  assert.equal(pkg.aeExportPackage.outputProfiles[0].supportClaim, false);
  assert.equal(receipt.status, "pass");
  assert.equal(receipt.hostActionState, "metadata_only_executed");
  assert.equal(receipt.schemaVersion, "aeb-panel-semantic-execution-receipt-v1");
  assert.deepEqual(receipt.targetHost, {
    appId: "AEFT",
    versionMajor: 26,
    versionMinor: 3,
    versionRule: "app.version.leading_major_minor"
  });
  assert.deepEqual(receipt.actualHost, {
    appId: "AEFT",
    versionMajor: 26,
    versionMinor: 3,
    versionNormalized: "26.3",
    versionRule: "app.version.leading_major_minor"
  });
  assert.equal(receipt.phases.requestConsumed, "pass");
  assert.equal(receipt.boundaries.renderOrBakeExecuted, false);
  assert.equal(receipt.boundaries.saveOrOverwriteExecuted, false);
  assert.equal(receipt.boundaries.targetSupportClaimAllowed, false);
  assert.equal(receipt.redaction.absolutePathsAllowed, false);
  assert.equal(receiptText.includes("/private/tmp"), false);
  assert.equal(host.context.app.project.file, null);
  assert.equal(host.context.app.project.activeItem, null);
  assert.equal(host.createdComps.length, 1);
  assert.equal(host.createdComps[0].numLayers, 0);
});

test("non-target AE 25.5 host leaves an AE 26.3 semantic request pending and byte-identical", async () => {
  const request = makeRequest({ requestId: "aeb-semantic-ae26-target" });
  const host = await makeScenario({ request, appVersion: "25.5x4" });
  const initialFiles = new Map(host.files);
  const initialFolders = new Set(host.folders);
  const initialProject = host.context.app.project;
  const panel = await loadPanel(host.context);

  assert.equal(panel.evalCalls.length, 2);
  assert.match(panel.evalCalls[0], /aebConsumeSemanticPilotRequestAe26\(\)/u);
  assert.match(panel.evalCalls[1], /aebConsumeSemanticPilotRequest\(\)/u);
  assert.equal(panel.statusNode.textContent, "Idle");
  assert.deepEqual(host.files, initialFiles);
  assert.deepEqual(host.folders, initialFolders);
  assert.equal(host.context.app.project, initialProject);
  assert.equal(host.createdComps.length, 0);
  assert.equal(host.files.has(REQUEST_PATH), true);
  assert.equal(host.files.has(`${INBOX}/consumed-aeb-semantic-ae26-target.json`), false);
  assert.equal(host.files.has(`${INBOX}/consumed-failed-aeb-semantic-ae26-target.json`), false);
});

test("AE 26.3 isolated panel uses a distinct manifest identity and semantic inbox", async () => {
  const manifest = await readFile(
    new URL("./plugin-panel-ae26-isolated/CSXS/manifest.xml", import.meta.url),
    "utf8"
  );
  assert.match(manifest, /ExtensionBundleId="local\.auto-svga\.aeb\.panel\.ae26\.dev"/);
  assert.match(manifest, /Extension Id="local\.auto-svga\.aeb\.panel\.ae26\.dev\.export"/);
  assert.match(manifest, /Host Name="AEFT" Version="\[26\.0,26\.99\]"/);
  assert.doesNotMatch(manifest, /Host Name="AEFT" Version="\[22\.0,99\.9\]"/);
  assert.match(manifest, /<Menu>Auto SVGA AEB Dev 26\.3<\/Menu>/);

  const request = makeAe26IsolatedRequest({ requestId: "aeb-semantic-ae26-isolated" });
  const host = makeHost({ appVersion: "26.3.0" });
  host.files.set(AE26_REQUEST_PATH, JSON.stringify(request));
  host.folders.add(path.posix.dirname(request.outputRoot));
  await loadJsx(host.context);

  const isolatedPanel = await loadPanel(host.context, { extensionId: AE26_EXTENSION_ID });
  assert.equal(isolatedPanel.evalCalls.length, 1);
  assert.match(isolatedPanel.evalCalls[0], /aebConsumeSemanticPilotRequestAe26\(\)/u);
  assert.equal(
    isolatedPanel.statusNode.textContent,
    "AEB semantic request consumed: aeb-semantic-ae26-isolated"
  );
  assert.equal(host.files.has(AE26_REQUEST_PATH), false);
  assert.equal(
    host.files.has(`${AE26_INBOX}/consumed-aeb-semantic-ae26-isolated.json`),
    true
  );
  const receipt = JSON.parse(
    host.files.get(
      "/private/tmp/auto-svga-aeb-dev/aeb-semantic-ae26-isolated/reports/semantic-execution-receipt.json"
    )
  );
  assert.deepEqual(receipt.panelIdentity, {
    bundleId: "local.auto-svga.aeb.panel.ae26.dev",
    extensionId: AE26_EXTENSION_ID,
    version: "0.3.0"
  });
  assert.equal(receipt.actualHost.versionNormalized, "26.3");
});

test("AE 26.3 legacy menu probes the isolated semantic inbox when CEP host environment is unavailable", async () => {
  const { request, input } = makeCurrentRuntimeEntryAe26Request({
    requestId: "aeb-semantic-ae26-legacy-no-env"
  });
  const host = makeHost({ appVersion: "26.3.0" });
  const assetPath = `${input.sourcePackageRoot}/assets/layer-0001.png`;
  host.folders.add(path.posix.dirname(input.sourcePackageRoot));
  host.folders.add(input.sourcePackageRoot);
  host.folders.add(`${input.sourcePackageRoot}/assets`);
  host.files.set(AE26_REQUEST_PATH, JSON.stringify(request));
  host.files.set(assetPath, "x".repeat(811));
  await loadJsx(host.context);

  const panel = await loadPanel(host.context, { extensionId: LEGACY_EXTENSION_ID });

  assert.equal(panel.evalCalls.length, 1);
  assert.match(panel.evalCalls[0], /aebConsumeSemanticPilotRequestAe26\(\)/u);
  assert.equal(panel.statusNode.textContent, "AEB semantic request consumed: aeb-semantic-ae26-legacy-no-env");
  assert.equal(host.files.has(AE26_REQUEST_PATH), false);
  assert.equal(host.files.has(`${AE26_INBOX}/consumed-aeb-semantic-ae26-legacy-no-env.json`), true);
});

test("AE 26.3 legacy menu entry consumes the isolated semantic inbox through host identity", async () => {
  const { request, input } = makeCurrentRuntimeEntryAe26Request({
    requestId: "aeb-semantic-ae26-legacy-menu"
  });
  const host = makeHost({ appVersion: "26.3.0" });
  const assetPath = `${input.sourcePackageRoot}/assets/layer-0001.png`;
  host.folders.add(path.posix.dirname(input.sourcePackageRoot));
  host.folders.add(input.sourcePackageRoot);
  host.folders.add(`${input.sourcePackageRoot}/assets`);
  host.files.set(AE26_REQUEST_PATH, JSON.stringify(request));
  host.files.set(assetPath, "x".repeat(811));
  await loadJsx(host.context);

  const panel = await loadPanel(host.context, {
    extensionId: LEGACY_EXTENSION_ID,
    hostEnvironment: { appName: "AEFT", appVersion: "26.3.0" }
  });

  assert.equal(panel.evalCalls.length, 1);
  assert.match(panel.evalCalls[0], /aebConsumeSemanticPilotRequestAe26\(\)/u);
  assert.equal(
    panel.statusNode.textContent,
    "AEB semantic request consumed: aeb-semantic-ae26-legacy-menu"
  );
  assert.equal(host.files.has(AE26_REQUEST_PATH), false);
  assert.equal(
    host.files.has(`${AE26_INBOX}/consumed-aeb-semantic-ae26-legacy-menu.json`),
    true
  );
  assert.equal(host.context.app.project, null);
  assert.equal(host.createdComps.length, 0);
});

test("AE 26.3 legacy menu accepts CEP XML host environment for isolated routing", async () => {
  const { request, input } = makeCurrentRuntimeEntryAe26Request({
    requestId: "aeb-semantic-ae26-hostxml"
  });
  const host = makeHost({ appVersion: "26.3.0" });
  const assetPath = `${input.sourcePackageRoot}/assets/layer-0001.png`;
  host.folders.add(path.posix.dirname(input.sourcePackageRoot));
  host.folders.add(input.sourcePackageRoot);
  host.folders.add(`${input.sourcePackageRoot}/assets`);
  host.files.set(AE26_REQUEST_PATH, JSON.stringify(request));
  host.files.set(assetPath, "x".repeat(811));
  await loadJsx(host.context);

  const panel = await loadPanel(host.context, {
    extensionId: LEGACY_EXTENSION_ID,
    hostEnvironment: '<HostEnvironment appId="AEFT" appVersion="26.3.0x87" />'
  });

  assert.equal(panel.evalCalls.length, 1);
  assert.match(panel.evalCalls[0], /aebConsumeSemanticPilotRequestAe26\(\)/u);
  assert.equal(panel.statusNode.textContent, "AEB semantic request consumed: aeb-semantic-ae26-hostxml");
  assert.equal(host.files.has(AE26_REQUEST_PATH), false);
  assert.equal(host.files.has(`${AE26_INBOX}/consumed-aeb-semantic-ae26-hostxml.json`), true);
});

test("Permit135 regression: AE 26.3 isolated panel consumes current runtime-entry fixture request and finalizes package", async () => {
  const { request, input } = makeCurrentRuntimeEntryAe26Request({
    requestId: "aeb-semantic-ae26-current"
  });
  const host = makeHost({ appVersion: "26.3.0" });
  const assetPath = `${input.sourcePackageRoot}/assets/layer-0001.png`;
  host.folders.add(path.posix.dirname(input.sourcePackageRoot));
  host.folders.add(input.sourcePackageRoot);
  host.folders.add(`${input.sourcePackageRoot}/assets`);
  host.files.set(AE26_REQUEST_PATH, JSON.stringify(request));
  host.files.set(assetPath, "x".repeat(811));
  await loadJsx(host.context);

  const isolatedPanel = await loadPanel(host.context, { extensionId: AE26_EXTENSION_ID });

  assert.equal(isolatedPanel.evalCalls.length, 1);
  assert.match(isolatedPanel.evalCalls[0], /aebConsumeSemanticPilotRequestAe26\(\)/u);
  assert.equal(isolatedPanel.statusNode.textContent, "AEB semantic request consumed: aeb-semantic-ae26-current");
  assert.equal(host.files.has(AE26_REQUEST_PATH), false);
  assert.equal(host.files.has(`${AE26_INBOX}/consumed-aeb-semantic-ae26-current.json`), true);
  assert.equal(host.context.app.project, null);
  assert.equal(host.createdComps.length, 0);

  const finalizedPath = `${input.sourcePackageRoot}/ae-export-package.finalized.json`;
  assert.equal(host.files.has(finalizedPath), true);
  assert.equal(host.files.has(`${input.sourcePackageRoot}/ae-export-package.json`), false);
  const finalized = JSON.parse(host.files.get(finalizedPath));
  const pkg = finalized.aeExportPackage;
  assert.equal(finalized.schemaVersion, "aeb-wp2-script-output-v0");
  assert.equal(pkg.semanticGraph.nativeSubset, "image_transform_v0");
  assert.equal(pkg.semanticGraph.assets.length, 1);
  assert.equal(pkg.semanticGraph.assets[0].assetId, request.assetFixture.assetId);
  assert.equal(pkg.semanticGraph.assets[0].packagePath, "assets/layer-0001.png");
  assert.equal(pkg.semanticGraph.assets[0].sha256, "b7970b1a9c9a313e9b9f912411dacfe61d6e196c102918f4c77f49883da06936");
  assert.deepEqual(pkg.semanticGraph.assets[0].materialization, {
    status: "copied_hash_finalized",
    rawPathCollected: false
  });
  assert.equal(pkg.semanticGraph.layers.length, 1);
  assert.equal(pkg.semanticGraph.layers[0].layerId, request.assetFixture.layerId);
  assert.deepEqual(pkg.semanticGraph.layers[0].keyframes, request.assetFixture.keyframes);
  assert.equal(pkg.s3Report.composition.width, 300);
  assert.equal(pkg.s3Report.composition.height, 300);
  assert.equal(pkg.s3Report.composition.fps, 24);
  assert.equal(pkg.s3Report.composition.durationFrames, 120);

  const receipt = JSON.parse(
    host.files.get(
      "/private/tmp/auto-svga-aeb-dev/aeb-semantic-ae26-current/reports/semantic-execution-receipt.json"
    )
  );
  assert.equal(receipt.status, "pass");
  assert.equal(receipt.action, ENTRY_CONTRACT.requestAction);
  assert.equal(receipt.phases.scratchPrepared, "not_required");
  assert.equal(receipt.phases.metadataPackageWritten, "pass");
  assert.equal(receipt.phases.requestConsumed, "pass");
  assert.equal(receipt.boundaries.sourceProjectMutationExecuted, false);
  assert.equal(receipt.boundaries.renderOrBakeExecuted, false);
  assert.equal(receipt.boundaries.saveOrOverwriteExecuted, false);
});

test("AE 26.3 ScriptPath load is inert, one panel open consumes, and reopen stays stable", async () => {
  const { request, input } = makeCurrentRuntimeEntryAe26Request({
    requestId: "aeb-semantic-ae26-scriptpath"
  });
  const host = makeHost({
    appVersion: "26.3.0",
    jsxFileName: "/Users/owner/Library/Application Support/Adobe/CEP/extensions/local.auto-svga.aeb.panel.ae26.dev/jsx/aeb-export-to-auto-svga.jsx"
  });
  const assetPath = `${input.sourcePackageRoot}/assets/layer-0001.png`;
  host.folders.add(path.posix.dirname(input.sourcePackageRoot));
  host.folders.add(input.sourcePackageRoot);
  host.folders.add(`${input.sourcePackageRoot}/assets`);
  host.files.set(AE26_REQUEST_PATH, JSON.stringify(request));
  host.files.set(assetPath, "x".repeat(811));

  await loadJsx(host.context);

  assert.equal(host.files.has(AE26_REQUEST_PATH), true);
  assert.equal(host.files.has(`${AE26_INBOX}/consumed-aeb-semantic-ae26-scriptpath.json`), false);

  const panel = await loadPanel(host.context, { extensionId: AE26_EXTENSION_ID });

  assert.equal(panel.evalCalls.length, 1);
  assert.equal(host.files.has(AE26_REQUEST_PATH), false);
  assert.equal(host.files.has(`${AE26_INBOX}/consumed-aeb-semantic-ae26-scriptpath.json`), true);
  assert.equal(host.files.has(`${input.sourcePackageRoot}/ae-export-package.finalized.json`), true);
  assert.equal(host.context.app.project, null);
  assert.equal(host.createdComps.length, 0);
  const receipt = JSON.parse(
    host.files.get(
      "/private/tmp/auto-svga-aeb-dev/aeb-semantic-ae26-scriptpath/reports/semantic-execution-receipt.json"
    )
  );
  assert.equal(receipt.status, "pass");
  assert.equal(receipt.phases.scratchPrepared, "not_required");
  assert.equal(receipt.phases.metadataPackageWritten, "pass");
  assert.equal(receipt.phases.requestConsumed, "pass");

  const packageBytes = host.files.get(`${input.sourcePackageRoot}/ae-export-package.finalized.json`);
  const reopenedPanel = await loadPanel(host.context, { extensionId: AE26_EXTENSION_ID });
  assert.equal(reopenedPanel.evalCalls.length, 1);
  assert.equal(reopenedPanel.statusNode.textContent, "Idle");
  assert.equal(host.files.get(`${input.sourcePackageRoot}/ae-export-package.finalized.json`), packageBytes);
});

test("AE 26.3 semantic request parses with the ExtendScript JSON fallback", async () => {
  const { request, input } = makeCurrentRuntimeEntryAe26Request({
    requestId: "aeb-semantic-ae26-json-fallback"
  });
  const host = makeHost({
    appVersion: "26.3.0",
    jsonAvailable: false
  });
  const assetPath = `${input.sourcePackageRoot}/assets/layer-0001.png`;
  host.folders.add(path.posix.dirname(input.sourcePackageRoot));
  host.folders.add(input.sourcePackageRoot);
  host.folders.add(`${input.sourcePackageRoot}/assets`);
  host.files.set(AE26_REQUEST_PATH, JSON.stringify(request));
  host.files.set(assetPath, "x".repeat(811));

  await loadJsx(host.context);
  const result = host.context.aebConsumeSemanticPilotRequestAe26();

  assert.equal(result, "AEB semantic request consumed: aeb-semantic-ae26-json-fallback");
  assert.equal(host.files.has(AE26_REQUEST_PATH), false);
  assert.equal(host.files.has(`${AE26_INBOX}/consumed-aeb-semantic-ae26-json-fallback.json`), true);
  assert.equal(host.files.has(`${input.sourcePackageRoot}/ae-export-package.finalized.json`), true);
});

test("AE 26.3 semantic request ignores a poisoned ambient JSON parser", async () => {
  const { request, input } = makeCurrentRuntimeEntryAe26Request({
    requestId: "aeb-semantic-ae26-json-poisoned"
  });
  const host = makeHost({
    appVersion: "26.3.0",
    poisonedJsonParse: true
  });
  const assetPath = `${input.sourcePackageRoot}/assets/layer-0001.png`;
  host.folders.add(path.posix.dirname(input.sourcePackageRoot));
  host.folders.add(input.sourcePackageRoot);
  host.folders.add(`${input.sourcePackageRoot}/assets`);
  host.files.set(AE26_REQUEST_PATH, JSON.stringify(request));
  host.files.set(assetPath, "x".repeat(811));

  await loadJsx(host.context);
  const result = host.context.aebConsumeSemanticPilotRequestAe26();

  assert.equal(result, "AEB semantic request consumed: aeb-semantic-ae26-json-poisoned");
  assert.equal(host.files.has(AE26_REQUEST_PATH), false);
  assert.equal(host.files.has(`${AE26_INBOX}/consumed-aeb-semantic-ae26-json-poisoned.json`), true);
  assert.equal(host.files.has(`${input.sourcePackageRoot}/ae-export-package.finalized.json`), true);
});

test("AE 26.3 panel recovers one transient JSX load error without reopening the panel", async () => {
  const { request, input } = makeCurrentRuntimeEntryAe26Request({
    requestId: "aeb-semantic-ae26-first-load-recovery"
  });
  const host = makeHost({ appVersion: "26.3.0" });
  const assetPath = `${input.sourcePackageRoot}/assets/layer-0001.png`;
  host.folders.add(path.posix.dirname(input.sourcePackageRoot));
  host.folders.add(input.sourcePackageRoot);
  host.folders.add(`${input.sourcePackageRoot}/assets`);
  host.files.set(AE26_REQUEST_PATH, JSON.stringify(request));
  host.files.set(assetPath, "x".repeat(811));
  await loadJsx(host.context);

  const panel = await loadPanel(host.context, {
    extensionId: AE26_EXTENSION_ID,
    firstEvalResult: "EvalScript error. net::ERR_FILE_NOT_FOUND"
  });

  assert.equal(panel.evalCalls.length, 2);
  assert.match(panel.evalCalls[1], /\$\.evalFile/u);
  assert.equal(panel.statusNode.textContent, "AEB semantic request consumed: aeb-semantic-ae26-first-load-recovery");
  assert.equal(host.files.has(AE26_REQUEST_PATH), false);
  assert.equal(host.files.has(`${AE26_INBOX}/consumed-aeb-semantic-ae26-first-load-recovery.json`), true);
  assert.equal(host.files.has(`${input.sourcePackageRoot}/ae-export-package.finalized.json`), true);
});

test("AE 26.3 panel waits for its extension root before the only semantic eval", async () => {
  const { request, input } = makeCurrentRuntimeEntryAe26Request({
    requestId: "aeb-semantic-ae26-extension-root-race"
  });
  const host = makeHost({ appVersion: "26.3.0" });
  const assetPath = `${input.sourcePackageRoot}/assets/layer-0001.png`;
  host.folders.add(path.posix.dirname(input.sourcePackageRoot));
  host.folders.add(input.sourcePackageRoot);
  host.folders.add(`${input.sourcePackageRoot}/assets`);
  host.files.set(AE26_REQUEST_PATH, JSON.stringify(request));
  host.files.set(assetPath, "x".repeat(811));
  await loadJsx(host.context);

  const panel = await loadPanel(host.context, {
    extensionId: AE26_EXTENSION_ID,
    systemPathResults: ["", "/mock/auto-svga-aeb-extension"]
  });

  assert.deepEqual(panel.systemPathCalls, ["", "/mock/auto-svga-aeb-extension"]);
  assert.equal(panel.evalCalls.length, 1);
  assert.match(panel.evalCalls[0], /\$\.evalFile/u);
  assert.equal(
    panel.statusNode.textContent,
    "AEB semantic request consumed: aeb-semantic-ae26-extension-root-race"
  );
});

test("AE 26.3 first panel load waits for the CEP bridge without reopening", async () => {
  const { request, input } = makeCurrentRuntimeEntryAe26Request({
    requestId: "aeb-semantic-ae26-cep-bridge-race"
  });
  const host = makeHost({ appVersion: "26.3.0" });
  const assetPath = `${input.sourcePackageRoot}/assets/layer-0001.png`;
  host.folders.add(path.posix.dirname(input.sourcePackageRoot));
  host.folders.add(input.sourcePackageRoot);
  host.folders.add(`${input.sourcePackageRoot}/assets`);
  host.files.set(AE26_REQUEST_PATH, JSON.stringify(request));
  host.files.set(assetPath, "x".repeat(811));
  await loadJsx(host.context);

  const panel = await loadPanel(host.context, {
    extensionId: AE26_EXTENSION_ID,
    bridgeReadyAfterTimeouts: 1
  });

  assert.equal(panel.timeoutCalls, 1);
  assert.equal(panel.evalCalls.length, 1);
  assert.equal(
    panel.statusNode.textContent,
    "AEB semantic request consumed: aeb-semantic-ae26-cep-bridge-race"
  );
  assert.equal(host.files.has(AE26_REQUEST_PATH), false);
  assert.equal(host.files.has(`${AE26_INBOX}/consumed-aeb-semantic-ae26-cep-bridge-race.json`), true);
  assert.equal(host.files.has(`${input.sourcePackageRoot}/ae-export-package.finalized.json`), true);
});

test("AE 26.3 panel bridge wait is bounded and never dispatches without CEP", async () => {
  const { request, input } = makeCurrentRuntimeEntryAe26Request({
    requestId: "aeb-semantic-ae26-cep-bridge-unavailable"
  });
  const host = makeHost({ appVersion: "26.3.0" });
  const assetPath = `${input.sourcePackageRoot}/assets/layer-0001.png`;
  host.folders.add(path.posix.dirname(input.sourcePackageRoot));
  host.folders.add(input.sourcePackageRoot);
  host.folders.add(`${input.sourcePackageRoot}/assets`);
  host.files.set(AE26_REQUEST_PATH, JSON.stringify(request));
  host.files.set(assetPath, "x".repeat(811));
  await loadJsx(host.context);

  const panel = await loadPanel(host.context, {
    extensionId: AE26_EXTENSION_ID,
    bridgeReadyAfterTimeouts: Number.POSITIVE_INFINITY
  });

  assert.equal(panel.timeoutCalls, 100);
  assert.equal(panel.evalCalls.length, 0);
  assert.equal(panel.statusNode.textContent, "CEP host unavailable.");
  assert.equal(host.files.has(AE26_REQUEST_PATH), true);
  assert.equal(host.files.has(`${AE26_INBOX}/consumed-aeb-semantic-ae26-cep-bridge-unavailable.json`), false);
  assert.equal(host.files.has(`${input.sourcePackageRoot}/ae-export-package.finalized.json`), false);
});

test("AE 26.3 panel does not retry a semantic business failure", async () => {
  const host = makeHost({ appVersion: "26.3.0" });
  await loadJsx(host.context);

  const panel = await loadPanel(host.context, {
    extensionId: AE26_EXTENSION_ID,
    firstEvalResult: "EvalScript error. AEB semantic request failed closed after validation."
  });

  assert.equal(panel.evalCalls.length, 1);
  assert.equal(
    panel.statusNode.textContent,
    "EvalScript error. AEB semantic request failed closed after validation."
  );
});

test("current AE 26.3 fixture request fails closed and consumes-failed when finalized package write is blocked", async () => {
  const { request, input } = makeCurrentRuntimeEntryAe26Request({
    requestId: "aeb-semantic-ae26-write-failure"
  });
  const assetPath = `${input.sourcePackageRoot}/assets/layer-0001.png`;
  const host = makeHost({
    appVersion: "26.3.0",
    failWriteSuffix: "/ae-export-package.finalized.json"
  });
  host.folders.add(path.posix.dirname(input.sourcePackageRoot));
  host.folders.add(input.sourcePackageRoot);
  host.folders.add(`${input.sourcePackageRoot}/assets`);
  host.files.set(AE26_REQUEST_PATH, JSON.stringify(request));
  host.files.set(assetPath, "x".repeat(811));
  await loadJsx(host.context);

  const isolatedPanel = await loadPanel(host.context, { extensionId: AE26_EXTENSION_ID });

  assert.match(isolatedPanel.statusNode.textContent, /failed closed after validation/);
  assert.equal(host.files.has(AE26_REQUEST_PATH), false);
  assert.equal(host.files.has(`${AE26_INBOX}/consumed-failed-aeb-semantic-ae26-write-failure.json`), true);
  assert.equal(host.files.has(`${input.sourcePackageRoot}/ae-export-package.finalized.json`), false);
  assert.equal(host.context.app.project, null);
  assert.equal(host.createdComps.length, 0);
  const receipt = JSON.parse(
    host.files.get(
      "/private/tmp/auto-svga-aeb-dev/aeb-semantic-ae26-write-failure/reports/semantic-execution-receipt.json"
    )
  );
  assert.equal(receipt.status, "fail");
  assert.equal(receipt.requestState, "consumed_failed");
  assert.equal(receipt.issueCode, "metadata_package_write_failed");
  assert.equal(receipt.phases.scratchPrepared, "not_required");
  assert.equal(receipt.phases.metadataPackageWritten, "fail");
  assert.equal(receipt.phases.requestConsumed, "failed_request_consumed");
});

test("semantic profile selection rejects arbitrary identities and inbox paths before reads or writes", async () => {
  const host = makeHost();
  await loadJsx(host.context);
  const initialFiles = new Map(host.files);
  const initialFolders = new Set(host.folders);

  assert.throws(
    () => host.context.aebConsumeSemanticPilotRequestForProfile("forged"),
    /unknown panel profile/
  );
  assert.deepEqual(host.files, initialFiles);
  assert.deepEqual(host.folders, initialFolders);
  assert.equal(host.context.app.project, null);
});

test("read-only activeItem reproduces the legacy scratch failure but repaired semantic flow exports the created comp", async () => {
  const request = makeRequest({ requestId: "aeb-semantic-active-item-readonly" });
  const legacyHost = await makeScenario({ request, projectSeed: { activeItemReadOnly: true } });
  await loadJsx(legacyHost.context, { legacyActiveItemAssignment: true });
  const legacyPanel = await loadPanel(legacyHost.context);

  assert.match(legacyPanel.statusNode.textContent, /failed closed after validation/);
  assert.equal(legacyHost.files.has(`${request.outputRoot}/ae-export-package.json`), false);
  assert.equal(
    legacyHost.files.has("/private/tmp/auto-svga-aeb-dev/aeb-semantic-active-item-readonly/reports/scratch-setup-marker.json"),
    false
  );
  assert.equal(legacyHost.context.app.project.numItems, 1);
  assert.equal(
    JSON.parse(
      legacyHost.files.get("/private/tmp/auto-svga-aeb-dev/aeb-semantic-active-item-readonly/reports/semantic-execution-receipt.json")
    ).issueCode,
    "host_active_item_readonly"
  );

  const repairedHost = await makeScenario({ request, projectSeed: { activeItemReadOnly: true } });
  const repairedPanel = await loadPanel(repairedHost.context);
  const receipt = JSON.parse(
    repairedHost.files.get("/private/tmp/auto-svga-aeb-dev/aeb-semantic-active-item-readonly/reports/semantic-execution-receipt.json")
  );

  assert.equal(repairedPanel.statusNode.textContent, "AEB semantic request consumed: aeb-semantic-active-item-readonly");
  assert.equal(repairedHost.context.app.project.activeItem, null);
  assert.equal(repairedHost.createdComps.length, 1);
  assert.equal(repairedHost.files.has(`${request.outputRoot}/ae-export-package.json`), true);
  assert.equal(receipt.status, "pass");
  assert.equal(receipt.issueCode, null);
});

test("semantic request failures happen before project or filesystem mutation", async () => {
  const now = Date.now();
  const canonicalRequestText = JSON.stringify(makeRequest());
  const cases = [
    { name: "malformed", rawRequestText: "{not-json" },
    {
      name: "duplicate-key",
      rawRequestText: canonicalRequestText.replace(
        '"requestId":"aeb-semantic-test"',
        '"requestId":"aeb-semantic-test","requestId":"aeb-semantic-test"'
      )
    },
    {
      name: "prototype-key",
      rawRequestText: canonicalRequestText.replace("{", '{"__proto__":{"polluted":true},')
    },
    {
      name: "multiple-pending",
      request: makeRequest(),
      extraFiles: { [`${INBOX}/request-extra.json`]: JSON.stringify(makeRequest({ requestId: "aeb-semantic-extra" })) }
    },
    { name: "oversized", rawRequestText: `${JSON.stringify(makeRequest())}${" ".repeat(65 * 1024)}` },
    { name: "stale", request: makeRequest({ expiresAtEpochMs: now - 1 }) },
    { name: "future", request: makeRequest({ createdAtEpochMs: now + 60_000, expiresAtEpochMs: now + 120_000 }) },
    { name: "unsupported", request: makeRequest({ action: "render-and-export" }) },
    { name: "unknown-claim", request: makeRequest({ targetSupportClaimAllowed: true }) },
    { name: "wrong-source", request: makeRequest({ sourceIdentity: "forged-source" }) },
    { name: "missing-target-host", request: (() => { const request = makeRequest(); delete request.targetHost; return request; })() },
    {
      name: "ambiguous-target-host",
      request: makeRequest({
        targetHost: {
          appId: "AEFT",
          versionMajor: "26",
          versionMinor: 3,
          versionRule: "app.version.leading_major_minor"
        }
      })
    },
    {
      name: "unknown-target-host-field",
      request: makeRequest({
        targetHost: {
          appId: "AEFT",
          versionMajor: 26,
          versionMinor: 3,
          versionRule: "app.version.leading_major_minor",
          build: "26.3.0.87"
        }
      })
    },
    {
      name: "unsupported-target-host",
      request: makeRequest({
        targetHost: {
          appId: "AEFT",
          versionMajor: 25,
          versionMinor: 5,
          versionRule: "app.version.leading_major_minor"
        }
      })
    },
    { name: "ambiguous-current-host", request: makeRequest(), appVersion: "26" },
    { name: "user-path", request: makeRequest({ outputRoot: "/Users/reviewer/Private/ae-export-package" }) },
    { name: "traversal", request: makeRequest({ outputRoot: "/private/tmp/auto-svga-aeb-dev/run/../escape/ae-export-package" }) },
    {
      name: "forged-render",
      request: makeRequest({ boundaries: { ...makeRequest().boundaries, renderOrBakeAllowed: true } })
    },
    { name: "request-alias", request: makeRequest(), aliases: [REQUEST_PATH] },
    {
      name: "output-ancestor-alias",
      request: makeRequest(),
      aliases: ["/private/tmp/auto-svga-aeb-dev/aeb-semantic-test"]
    },
    { name: "unsafe-project", request: makeRequest(), projectSeed: { fileBacked: true } }
  ];

  for (const scenario of cases) {
    const host = await makeScenario(scenario);
    const initialFiles = new Map(host.files);
    const initialFolders = new Set(host.folders);
    const initialProject = host.context.app.project;
    const panel = await loadPanel(host.context);

    assert.match(panel.statusNode.textContent, /^EvalScript error\./, scenario.name);
    assert.deepEqual(host.files, initialFiles, scenario.name);
    assert.deepEqual(host.folders, initialFolders, scenario.name);
    assert.equal(host.context.app.project, initialProject, scenario.name);
  }
});

test("consumed request id fails closed on replay without new writes", async () => {
  const request = makeRequest({ requestId: "aeb-semantic-replay" });
  const host = await makeScenario({ request });
  await loadPanel(host.context);
  const filesAfterSuccess = new Map(host.files);
  host.files.set(REQUEST_PATH, JSON.stringify(request));

  const panel = await loadPanel(host.context);
  assert.match(panel.statusNode.textContent, /replayed requestId/);
  assert.equal(host.files.has(REQUEST_PATH), true);
  assert.equal(host.files.has(`${INBOX}/consumed-aeb-semantic-replay.json`), true);
  assert.equal(host.files.size, filesAfterSuccess.size + 1);
  for (const [filePath, contents] of filesAfterSuccess) {
    assert.equal(host.files.get(filePath), contents, filePath);
  }
});

test("valid request records a consumed failure receipt when metadata package writing fails", async () => {
  const request = makeRequest({ requestId: "aeb-semantic-package-failure" });
  const host = await makeScenario({ request, failWriteSuffix: "/ae-export-package.json" });
  const panel = await loadPanel(host.context);

  assert.match(panel.statusNode.textContent, /failed closed after validation/);
  assert.equal(host.files.has(REQUEST_PATH), false);
  assert.equal(host.files.has(`${INBOX}/consumed-failed-aeb-semantic-package-failure.json`), true);
  assert.equal(host.files.has(`${request.outputRoot}/ae-export-package.json`), false);

  const receiptPath =
    "/private/tmp/auto-svga-aeb-dev/aeb-semantic-package-failure/reports/semantic-execution-receipt.json";
  const receiptText = host.files.get(receiptPath);
  const receipt = JSON.parse(receiptText);
  assert.equal(receipt.status, "fail");
  assert.equal(receipt.requestState, "consumed_failed");
  assert.equal(receipt.hostActionState, "metadata_only_failed_closed");
  assert.equal(receipt.phases.scratchPrepared, "pass");
  assert.equal(receipt.phases.metadataPackageWritten, "fail");
  assert.equal(receipt.phases.requestConsumed, "failed_request_consumed");
  assert.equal(receipt.issueCode, "metadata_package_write_failed");
  assert.equal(receipt.boundaries.renderOrBakeExecuted, false);
  assert.equal(receiptText.includes("/private/tmp"), false);
});
