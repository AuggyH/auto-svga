"use strict";

const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_PREFIX = "auto-svga-registered-electron-bootstrap-v0";
const TASK_ROOT = "/private/tmp/auto-svga-aeb-d001-8594bcfa";
const SOURCE_HEAD = "57d27079d7db8812963d5e7cd0f2b085683c2524";
const EXPECTED_APP_PATH =
  "/Users/huangtengxin/Documents/auto-svga/tools/electron-prototype/node_modules/electron/dist/Electron.app";
const EXPECTED_EXECUTABLE_PATH = `${EXPECTED_APP_PATH}/Contents/MacOS/Electron`;
const EXPECTED_ELECTRON_VERSION = "42.4.1";
const EXPECTED_EVIDENCE_STORE_PATH = path.join(__dirname, "registered-electron-evidence-store.py");
const EXPECTED_EVIDENCE_STORE_SHA256 = "1bafafae217bf915239fdb1d554795eeedb6d2022898938228e06d0164d204c9";

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      fail(`missing value for ${token}`);
    }
    result[token.slice(2)] = value;
    index += 1;
  }
  return result;
}

function assertSafeOutputRoot(outputRoot) {
  const resolved = path.resolve(outputRoot);
  if (path.dirname(resolved) !== TASK_ROOT) {
    fail("output root must be a direct child of the task root");
  }
  return resolved;
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = sortJson(value[key]);
    }
    return result;
  }
  return value;
}

function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(sortJson(value), null, 2)}\n`, "utf8");
}

function loadEvidenceBinding(args, outputRoot) {
  const helperPath = args["evidence-store-path"];
  const helperSha256 = args["evidence-store-sha256"];
  const bindingSha256 = args["evidence-binding-sha256"];
  if (
    helperPath !== EXPECTED_EVIDENCE_STORE_PATH ||
    helperSha256 !== EXPECTED_EVIDENCE_STORE_SHA256 ||
    !/^[0-9a-f]{64}$/.test(bindingSha256 || "")
  ) {
    fail("evidence store identity is invalid");
  }
  const helperStat = fs.lstatSync(helperPath);
  if (!helperStat.isFile() || helperStat.isSymbolicLink() || fs.realpathSync(helperPath) !== helperPath) {
    fail("evidence store helper is not a canonical regular file");
  }
  const actualHelperSha256 = crypto.createHash("sha256").update(fs.readFileSync(helperPath)).digest("hex");
  if (actualHelperSha256 !== helperSha256) {
    fail("evidence store helper hash drifted");
  }
  let binding;
  try {
    binding = JSON.parse(Buffer.from(args["evidence-binding-base64"] || "", "base64url").toString("utf8"));
  } catch {
    fail("evidence binding is malformed");
  }
  const actualBindingSha256 = crypto.createHash("sha256").update(canonicalJsonBytes(binding)).digest("hex");
  if (
    actualBindingSha256 !== bindingSha256 ||
    !binding ||
    binding.helperSha256 !== helperSha256 ||
    binding.outputName !== path.basename(outputRoot)
  ) {
    fail("evidence binding does not match the launch contract");
  }
  return { helperPath, helperSha256, bindingSha256, binding };
}

function writeEvidenceRecord(context, recordName, value) {
  const result = spawnSync(
    "/usr/bin/python3",
    [
      context.evidenceStore.helperPath,
      "--mode",
      "write",
      "--output-root",
      context.outputRoot,
      "--binding-sha256",
      context.evidenceStore.bindingSha256,
      "--record-name",
      recordName,
    ],
    {
      encoding: "utf8",
      input: `${JSON.stringify({ binding: context.evidenceStore.binding, value })}\n`,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 5_000,
    },
  );
  if (result.status !== 0) {
    fail("evidence store rejected runtime publication");
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout || "");
  } catch {
    fail("evidence store returned invalid runtime output");
  }
  if (!parsed || parsed.status !== "pass") {
    fail("evidence store did not confirm runtime publication");
  }
}

function phaseRecord(phase, context, extra = {}) {
  return {
    schema: `${SCHEMA_PREFIX}-${phase}`,
    phase,
    permitId: context.permitId,
    executionId: context.executionId,
    sourceHead: SOURCE_HEAD,
    packetHead: context.packetHead,
    pid: process.pid,
    ppid: process.ppid,
    processExecPath: process.execPath,
    appPath: EXPECTED_APP_PATH,
    bundleId: "com.github.Electron",
    electronVersion: process.versions.electron || null,
    evidenceBindingSha256: context.evidenceStore.bindingSha256,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    recordedAtUtc: new Date().toISOString(),
    ...extra,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const permitId = args["permit-id"];
  const packetHead = args["packet-head"];
  const executionId = args["execution-id"];
  const outputRoot = assertSafeOutputRoot(args["output-root"] || "");
  if (!/^ASV-APR-\d{8}-\d{3}$/.test(permitId || "")) {
    fail("permit id is not an issued single-use permit identity");
  }
  if (!/^[0-9a-f]{40}$/.test(packetHead || "")) {
    fail("packet head must be a full commit identity");
  }
  if (!/^[a-z0-9][a-z0-9-]{15,95}$/.test(executionId || "")) {
    fail("execution id must be a bounded lowercase task identity");
  }
  if (process.execPath !== EXPECTED_EXECUTABLE_PATH) {
    fail("unexpected Electron executable identity");
  }
  if (process.versions.electron !== EXPECTED_ELECTRON_VERSION) {
    fail("unexpected Electron version");
  }
  const evidenceStore = loadEvidenceBinding(args, outputRoot);
  const context = { permitId, packetHead, executionId, outputRoot, evidenceStore };
  writeEvidenceRecord(context, "first-javascript-marker.json", phaseRecord("first-javascript", context, {
    argvSha256: crypto.createHash("sha256").update(JSON.stringify(process.argv)).digest("hex"),
  }));

  const { app } = require("electron");
  const userDataRoot = path.join(outputRoot, "electron-user-data");
  const sessionDataRoot = path.join(outputRoot, "electron-session-data");
  app.setPath("userData", userDataRoot);
  app.setPath("sessionData", sessionDataRoot);

  app.once("before-quit", () => {
    writeEvidenceRecord(
      context,
      "normal-quit-requested.json",
      phaseRecord("normal-quit-requested", context),
    );
  });
  app.once("will-quit", () => {
    writeEvidenceRecord(
      context,
      "normal-quit-will-quit.json",
      phaseRecord("normal-quit-will-quit", context),
    );
  });
  app.once("quit", (_event, exitCode) => {
    writeEvidenceRecord(
      context,
      "normal-quit-observed.json",
      phaseRecord("normal-quit-observed", context, { exitCode }),
    );
  });

  app.whenReady().then(() => {
    writeEvidenceRecord(
      context,
      "app-ready-marker.json",
      phaseRecord("app-ready", context, {
        userDataBound: app.getPath("userData") === userDataRoot,
        sessionDataBound: app.getPath("sessionData") === sessionDataRoot,
        windowsCreated: 0,
      }),
    );
    setTimeout(() => app.quit(), 750);
  }).catch((error) => {
    writeEvidenceRecord(
      context,
      "bootstrap-failure.json",
      phaseRecord("bootstrap-failure", context, {
        issueCode: "app_ready_rejected",
        errorName: error && error.name ? String(error.name) : "Error",
      }),
    );
    app.quit();
  });
}

try {
  main();
} catch (error) {
  process.stderr.write(`registered Electron bootstrap failed: ${error && error.message ? error.message : "unknown"}\n`);
  process.exitCode = 1;
}
