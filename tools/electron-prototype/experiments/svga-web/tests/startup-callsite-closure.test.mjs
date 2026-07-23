import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import {
  architecturalStartupBypasses,
  deriveStartupAuthoritySourcePaths,
  deriveStartupCallsites,
  startupCallsiteDigest
} from "./startup-callsite-closure.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(experimentRoot, "../../../..");
const packageProofPath = "tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs";
const mainSourcePath = "tools/electron-prototype/experiments/svga-web/main.cjs";
const policySourcePath = "tools/electron-prototype/experiments/svga-web/startup-runtime-policy.cjs";
const runtimeTraceSourcePath = "tools/electron-prototype/experiments/svga-web/multiformat-open-runtime-trace.cjs";
const inventory = JSON.parse(readFileSync(
  path.join(experimentRoot, "tests/startup-serialization-authority-inventory.json"),
  "utf8"
));

function sourceAt(ref, relativePath) {
  return ref
    ? execFileSync("git", ["show", `${ref}:${relativePath}`], {
        cwd: repositoryRoot,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024
      })
    : readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function sourcePathsAt(ref) {
  return deriveStartupAuthoritySourcePaths(sourceAt(ref, packageProofPath));
}

function sourcesAt(ref) {
  return Object.fromEntries(sourcePathsAt(ref).map((relativePath) => [
    relativePath,
    sourceAt(ref, relativePath)
  ]));
}

function extractNamedFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} must exist`);
  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = openingBrace; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "'" || character === "\"" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${signature} body is incomplete`);
}

async function observeC3VisibleStartupBytes(payload) {
  const c3Source = sourcesAt("c3e47aec3efe889842442de330f5ca450b3c692d")[
    mainSourcePath
  ];
  const bytes = [];
  const sandbox = {
    Error,
    JSON,
    Set,
    appRoot: "/sealed/candidate/Auto SVGA.app/Contents/Resources/app.asar",
    blockedExternalRequests: [payload],
    canonicalFixtureMetadata: () => ({}),
    csp: "fixed-csp",
    describeFinderEquivalentLaunchEvidence: () => ({
      compatible: false,
      reason: "explicit_acceptance_or_auto_svga_overrides"
    }),
    hostMenuActions: ["quit"],
    isAcceptanceStartupProofLaunch: () => true,
    mainEntry: "main.cjs",
    normalProofMode: false,
    normalVisibleStartupMode: true,
    path,
    playerIdentity: "svga-web@2.4.4",
    preloadEntry: "preload.cjs",
    process: {
      argv: ["/private/Auto SVGA", payload],
      env: {
        AUTO_SVGA_ACTUAL_LAUNCH_COMMAND: payload,
        AUTO_SVGA_PRIVATE_CLIENT_NAME_SVGA: payload
      },
      pid: 42
    },
    productArtifactIndex: { headCommit: "c3e47aec" },
    productIdentity: "auto-svga",
    productMilestoneId: payload,
    redactLocalPaths: (value) => String(value),
    redactLogMessage: (value) => String(value),
    rendererEntry: "web/short-term-macos-app.mjs",
    rendererHtmlEntry: "web/index.html",
    repoRoot: "/sealed/candidate",
    runtimeInstanceId: "ASV-RUNTIME-001",
    sessionRoot: "/private/session",
    sha256RelativeFile: () => "a".repeat(64),
    startupRuntimePolicy: {
      autoSvgaOverrides: ["AUTO_SVGA_PRIVATE_CLIENT_NAME_SVGA"],
      outputMode: "explicit-proof",
      visibleStartupProofEnabled: true
    },
    stylesEntry: "web/short-term-macos.css",
    writeJsonProductArtifact: (_fileName, _scenario, value) => {
      bytes.push(Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
    }
  };
  const functionSources = [
    "function sanitizeRuntimeArgument",
    "function sanitizedRuntimeArgv",
    "function launchEnvironmentOverrides",
    "function defaultActualLaunchCommand",
    "function runtimeIdentity",
    "async function writeVisibleNormalStartupProof"
  ].map((signature) => extractNamedFunction(c3Source, signature));
  vm.runInNewContext(
    `${functionSources.join("\n")}\nglobalThis.observe = writeVisibleNormalStartupProof;`,
    sandbox
  );
  await sandbox.observe({
    isVisible: () => true,
    webContents: {
      executeJavaScript: async () => ({
        rendererQuery: payload,
        primaryBridge: true,
        localOnly: false,
        externalRequests: [payload]
      })
    }
  }, payload);
  return bytes;
}

function observeC3ArtifactIndexBytes(productMilestoneId) {
  const c3Source = sourcesAt("c3e47aec3efe889842442de330f5ca450b3c692d")[
    mainSourcePath
  ];
  const writes = [];
  const sandbox = {
    JSON,
    path,
    productArtifactIndex: { milestoneId: productMilestoneId, artifacts: [] },
    productArtifactRoot: "/private/proof",
    writeFileSync: (_filePath, bytes) => writes.push(Buffer.from(bytes))
  };
  vm.runInNewContext(
    `${extractNamedFunction(c3Source, "function writeProductArtifactIndex")}\n`
      + "globalThis.writeIndex = writeProductArtifactIndex;",
    sandbox
  );
  sandbox.writeIndex();
  return writes;
}

function observeC3TraceBytes(productMilestoneId) {
  const c3TraceSource = sourceAt(
    "c3e47aec3efe889842442de330f5ca450b3c692d",
    runtimeTraceSourcePath
  );
  const appends = [];
  const sandbox = {
    JSON,
    Number,
    Object,
    Set,
    module: { exports: {} },
    require: (specifier) => {
      if (specifier === "node:fs") {
        return {
          appendFileSync: (_filePath, bytes) => appends.push(Buffer.from(bytes)),
          existsSync: () => false,
          readFileSync: () => ""
        };
      }
      if (specifier === "node:path") return path;
      throw new Error(`unexpected c3 trace require: ${specifier}`);
    }
  };
  vm.runInNewContext(c3TraceSource, sandbox);
  const trace = sandbox.module.exports.createMultiFormatOpenRuntimeTrace({
    runId: "issue6-c3-trace",
    clock: () => 1000
  });
  const recorded = trace.record({
    phase: "main_started",
    productMilestoneId,
    formalRuntimeMode: true,
    queueDepth: 0,
    bridgeReady: false
  });
  return { appends, recorded };
}

function observeC3RelativeAcceptanceRoot() {
  const c3Source = sourcesAt("c3e47aec3efe889842442de330f5ca450b3c692d")[
    mainSourcePath
  ];
  const sandbox = {
    path,
    process: { env: { AUTO_SVGA_PRODUCT_ARTIFACTS: "relative/proof" } }
  };
  vm.runInNewContext(
    `${extractNamedFunction(c3Source, "function acceptanceStartupArtifactRoot")}\n`
      + "globalThis.observeRoot = acceptanceStartupArtifactRoot;",
    sandbox
  );
  return sandbox.observeRoot();
}

function insertAfter(source, needle, addition) {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, needle);
  return `${source.slice(0, index + needle.length)}${addition}${source.slice(index + needle.length)}`;
}

test("failure-first: exact c3 visible-startup harness observes leaked predecessor bytes", async () => {
  for (const payload of [
    "PRIVATE_CLIENT_NAME_SVGA",
    "/Users/owner/private/client-name.svga",
    "用户隐私素材",
    "x".repeat(4096)
  ]) {
    const bytes = await observeC3VisibleStartupBytes(payload);
    assert.equal(bytes.length, 1, payload);
    assert.equal(bytes[0].includes(Buffer.from(payload)), true, payload);
  }
});

test("failure-first: exact c3 discriminator is truthful 1/5 with product-behavior reasons", async () => {
  const safeUnknown = "PRIVATE_CLIENT_NAME_SVGA";
  const overlong = "x".repeat(4096);
  const visibleBytes = await observeC3VisibleStartupBytes(safeUnknown);
  const safeIndex = observeC3ArtifactIndexBytes(safeUnknown);
  const longIndex = observeC3ArtifactIndexBytes(overlong);
  const safeTrace = observeC3TraceBytes(safeUnknown);
  const longTrace = observeC3TraceBytes(overlong);
  const rows = [
    {
      id: "relative-acceptance-root",
      passed: observeC3RelativeAcceptanceRoot().reason === "acceptance_artifact_root_invalid",
      reason: "relative_acceptance_root_rejected_before_write"
    },
    {
      id: "visible-startup",
      passed: !visibleBytes.some((bytes) => bytes.includes(Buffer.from(safeUnknown))),
      reason: "visible_startup_serialized_payload_bytes"
    },
    {
      id: "safe-unknown-index",
      passed: !safeIndex.some((bytes) => bytes.includes(Buffer.from(safeUnknown))),
      reason: "artifact_index_serialized_safe_unknown_milestone"
    },
    {
      id: "overlong-index",
      passed: !longIndex.some((bytes) => bytes.includes(Buffer.from(overlong))),
      reason: "artifact_index_serialized_overlong_milestone"
    },
    {
      id: "safe-unknown-trace",
      passed: safeTrace.recorded === false && safeTrace.appends.length === 0,
      reason: "runtime_trace_appended_for_safe_unknown_milestone"
    },
    {
      id: "overlong-trace",
      passed: longTrace.recorded === false && longTrace.appends.length === 0,
      reason: "runtime_trace_appended_for_overlong_milestone"
    }
  ];
  assert.deepEqual(
    {
      passed: rows.filter((row) => row.passed).length,
      failed: rows.filter((row) => !row.passed).length
    },
    { passed: 1, failed: 5 }
  );
  assert.deepEqual(
    rows.filter((row) => !row.passed).map(({ id, reason }) => ({ id, reason })),
    [
      { id: "visible-startup", reason: "visible_startup_serialized_payload_bytes" },
      { id: "safe-unknown-index", reason: "artifact_index_serialized_safe_unknown_milestone" },
      { id: "overlong-index", reason: "artifact_index_serialized_overlong_milestone" },
      { id: "safe-unknown-trace", reason: "runtime_trace_appended_for_safe_unknown_milestone" },
      { id: "overlong-trace", reason: "runtime_trace_appended_for_overlong_milestone" }
    ]
  );
});

test("machine closure: actual writer callsites exactly match the independently derived inventory", () => {
  const callsites = deriveStartupCallsites(sourcesAt());
  assert.equal(
    startupCallsiteDigest(callsites),
    inventory.actualCallsiteClosure?.sha256
  );
  assert.equal(callsites.length, inventory.actualCallsiteClosure?.observedCount);
  assert.equal(
    inventory.actualCallsiteClosure?.derivation,
    "package-source-authority+typescript-ast:writer-primitives+enclosing-function+normalized-call-sha256"
  );
});

test("architectural closure: no startup-sensitive writer bypasses a finite emitter", () => {
  assert.deepEqual(architecturalStartupBypasses(deriveStartupCallsites(sourcesAt())), []);
});

test("mutation gate: exact 5aa8 reviewer raw fatal console injection is detected as a new actual callsite", () => {
  const sources = sourcesAt("5aa8db412f023d45a005e07b2bb112353414a27e");
  const baseline = deriveStartupCallsites(sources);
  const baselineKeys = new Set(baseline.map((callsite) => JSON.stringify(callsite)));
  sources[mainSourcePath] = insertAfter(
    sources[mainSourcePath],
    "function handleAcceptanceStartupFatalError(source, error) {",
    "\n  console.error(`AUTO_SVGA_WEB_EXPERIMENT_FATAL_BOOTSTRAP ${JSON.stringify({ reason: error.message })}`);"
  );
  const mutated = deriveStartupCallsites(sources);
  assert.notEqual(startupCallsiteDigest(mutated), startupCallsiteDigest(baseline));
  assert.equal(mutated.length, baseline.length + 2);
  const additions = mutated.filter((callsite) => !baselineKeys.has(JSON.stringify(callsite)));
  assert.ok(additions.some((callsite) => (
    callsite.context === "handleAcceptanceStartupFatalError"
      && callsite.callee === "console.error"
      && callsite.hint.startsWith("AUTO_SVGA_WEB_EXPERIMENT_FATAL_BOOTSTRAP")
  )));
});

test("failure-first: exact 5aa8 actual-callsite oracle exposes the predecessor bypass set", () => {
  const violations = architecturalStartupBypasses(
    deriveStartupCallsites(sourcesAt("5aa8db412f023d45a005e07b2bb112353414a27e"))
  );
  assert.equal(violations.length, 12);
  assert.ok(violations.some(({ context, reason }) => (
    context === "writeAcceptanceStartupBootstrapPhase"
      && reason === "early_record_bypasses_early_writer"
  )));
  assert.ok(violations.some(({ context, reason }) => (
    context === "handleAcceptanceStartupFatalError"
      && reason === "startup_console_outside_central_emitter"
  )));
});

test("mutation gate: direct console, generic artifact, append/trace, spread, and alternate serializer mutations change closure", () => {
  const baselineSources = sourcesAt();
  const baselineDigest = startupCallsiteDigest(deriveStartupCallsites(baselineSources));
  const mutations = [
    ["direct-console", "function handleAcceptanceStartupFatalError(source, error) {",
      "\n  console.error(`AUTO_SVGA_WEB_EXPERIMENT_ERROR ${JSON.stringify({ reason: error.message })}`);"],
    ["generic-artifact", "async function writeVisibleNormalStartupProof(window, rendererUrl) {",
      "\n  writeJsonProductArtifact(\"raw.json\", \"normal-visible-startup\", { reason: rendererUrl });"],
    ["append-trace", "function handleAcceptanceStartupFatalError(source, error) {",
      "\n  appendFileSync(\"/tmp/raw\", JSON.stringify({ reason: error.message }));"],
    ["field-spread", "function handleAcceptanceStartupFatalError(source, error) {",
      "\n  console.error(`AUTO_SVGA_WEB_EXPERIMENT_ERROR ${JSON.stringify({ ...error })}`);"],
    ["alternate-serializer", "function handleAcceptanceStartupFatalError(source, error) {",
      "\n  console.error(`AUTO_SVGA_WEB_EXPERIMENT_ERROR ${serializeRawStartupRecord(error)}`);"],
    ["alternate-writer", "function handleAcceptanceStartupFatalError(source, error) {",
      "\n  fs.writeFileSync(\"/tmp/raw\", JSON.stringify({ reason: error.message }));"]
  ];
  for (const [name, needle, addition] of mutations) {
    const sources = { ...baselineSources };
    sources[mainSourcePath] = insertAfter(sources[mainSourcePath], needle, addition);
    assert.notEqual(startupCallsiteDigest(deriveStartupCallsites(sources)), baselineDigest, name);
  }
  const builderOverride = { ...baselineSources };
  builderOverride[policySourcePath] = builderOverride[policySourcePath].replace(
    'return finalizeStartupRecord("fatal-diagnostic", {',
    'return finalizeStartupRecord("fatal-diagnostic", { ...input,'
  );
  assert.notEqual(builderOverride[policySourcePath], baselineSources[policySourcePath]);
  assert.notEqual(
    startupCallsiteDigest(deriveStartupCallsites(builderOverride)),
    baselineDigest,
    "existing-builder-field-override"
  );
  const deletedWriter = { ...baselineSources };
  deletedWriter[mainSourcePath] = deletedWriter[mainSourcePath].replace(
    "  console.error(`${sink.marker} ${serialized}`);",
    "  void serialized;"
  );
  assert.notEqual(deletedWriter[mainSourcePath], baselineSources[mainSourcePath]);
  assert.notEqual(
    startupCallsiteDigest(deriveStartupCallsites(deletedWriter)),
    baselineDigest,
    "deleted-writer"
  );
  const movedWriter = { ...baselineSources };
  movedWriter[mainSourcePath] = movedWriter[mainSourcePath]
    .replace("  console.error(`${sink.marker} ${serialized}`);", "")
    .replace(
      "function buildEarlyStartupPlacementSummary(input = {}) {",
      "function buildEarlyStartupPlacementSummary(input = {}) {\n  console.error(`${sink.marker} ${serialized}`);"
    );
  assert.notEqual(movedWriter[mainSourcePath], baselineSources[mainSourcePath]);
  assert.notEqual(
    startupCallsiteDigest(deriveStartupCallsites(movedWriter)),
    baselineDigest,
    "moved-writer"
  );
  const alternateValidator = { ...baselineSources };
  alternateValidator[runtimeTraceSourcePath] = alternateValidator[runtimeTraceSourcePath].replace(
    "sanitizeRuntimeTraceEntry(input, clock())",
    "sanitizeTraceEntry(input, clock())"
  );
  assert.notEqual(alternateValidator[runtimeTraceSourcePath], baselineSources[runtimeTraceSourcePath]);
  assert.notEqual(
    startupCallsiteDigest(deriveStartupCallsites(alternateValidator)),
    baselineDigest,
    "alternate-validator"
  );
});

test("independent parity: early authority derives its own field sets and hash instead of copying loaded hash", () => {
  const main = sourcesAt()[mainSourcePath];
  assert.match(main, /const earlyStartupSchemaFieldSets = Object\.freeze\(/u);
  assert.match(
    main,
    /createHash\("sha256"\)\s*\.update\(JSON\.stringify\(earlyStartupSchemaFieldSets\)\)/u
  );
  assert.doesNotMatch(
    main,
    /schemaFieldSetsSha256:\s*"[a-f0-9]{64}"/u
  );
});
