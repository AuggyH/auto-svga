import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventory = JSON.parse(readFileSync(
  path.join(experimentRoot, "tests/startup-serialization-authority-inventory.json"),
  "utf8"
));
const startupRuntimePolicy = require("../startup-runtime-policy.cjs");
const { createMultiFormatOpenRuntimeTrace } = require("../multiformat-open-runtime-trace.cjs");
const {
  buildAcceptanceStartupPlacementProof,
  buildRejectedAcceptanceStartupPlacementProof
} = require("../acceptance-startup-placement-proof.cjs");
const mainSource = readFileSync(path.join(experimentRoot, "main.cjs"), "utf8");
const startupSinkSources = [
  mainSource,
  readFileSync(path.join(experimentRoot, "startup-runtime-policy.cjs"), "utf8"),
  readFileSync(path.join(experimentRoot, "acceptance-startup-placement-proof.cjs"), "utf8"),
  readFileSync(path.join(experimentRoot, "multiformat-open-runtime-trace.cjs"), "utf8")
].join("\n");

const adversarialPayloads = Object.freeze([
  "PRIVATE_CLIENT_NAME_SVGA",
  "/Users/owner/private/client-name.svga",
  "用户隐私素材",
  "PRIVATE\0CLIENT",
  "x".repeat(4096)
]);

function extractNamedFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} must exist`);
  const nextFunction = source.indexOf("\nfunction ", start + signature.length);
  const nextAsyncFunction = source.indexOf("\nasync function ", start + signature.length);
  const candidates = [nextFunction, nextAsyncFunction].filter((index) => index > start);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

function runMilestoneBeforeSideEffects(productMilestoneId, effects) {
  const policy = startupRuntimePolicy.resolveStartupRuntimePolicy({
    appIsPackaged: true,
    repoRoot: "/sealed/candidate",
    ownerUserDataRoot: "/owner/user-data",
    productMilestoneId,
    normalVisibleStartupMode: true,
    acceptanceLaunch: false,
    environment: {}
  });
  for (const sideEffect of inventory.sideEffectBoundary) effects.push(sideEffect);
  return policy;
}

async function observeLegacyVisibleStartupPayload(payload) {
  const captured = [];
  const sandbox = {
    Error,
    Set,
    appRoot: "/sealed/candidate/Auto SVGA.app/Contents/Resources/app.asar",
    blockedExternalRequests: [payload],
    buildNormalVisibleStartupProof: startupRuntimePolicy.buildNormalVisibleStartupProof,
    buildStartupRuntimeIdentity: startupRuntimePolicy.buildStartupRuntimeIdentity,
    canonicalFixtureMetadata: () => ({}),
    csp: "fixed-csp",
    describeFinderEquivalentLaunchEvidence: () => ({
      compatible: false,
      reason: "explicit_acceptance_or_auto_svga_overrides"
    }),
    hostMenuActions: ["quit"],
    isAcceptanceStartupProofLaunch: () => true,
    launchEnvironmentOverrides: undefined,
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
    safeExternalRequestCategories: startupRuntimePolicy.safeExternalRequestCategories,
    sessionRoot: "/private/session",
    sha256RelativeFile: () => "a".repeat(64),
    startupRuntimePolicy: {
      autoSvgaOverrides: ["AUTO_SVGA_PRIVATE_CLIENT_NAME_SVGA"],
      outputMode: "explicit-proof",
      visibleStartupProofEnabled: true
    },
    stylesEntry: "web/short-term-macos.css",
    writeJsonProductArtifact: (...args) => captured.push(args)
  };
  const functionSources = [
    "function sanitizeRuntimeArgument",
    "function defaultActualLaunchCommand",
    "function runtimeIdentityInput",
    "function runtimeIdentity",
    "async function writeVisibleNormalStartupProof"
  ].map((signature) => extractNamedFunction(mainSource, signature));
  vm.runInNewContext(
    `${functionSources.join("\n")}\n      globalThis.observe = writeVisibleNormalStartupProof;`,
    sandbox
  );
  let error;
  try {
    await sandbox.observe({
      isVisible: () => true,
      webContents: {
        executeJavaScript: async () => {
          throw new Error(payload);
        }
      }
    }, payload);
  } catch (caught) {
    error = caught;
  }
  return { captured, error };
}

function objectContainsPayload(value, payload) {
  if (typeof value === "string") return value.includes(payload);
  if (Array.isArray(value)) return value.some((entry) => objectContainsPayload(entry, payload));
  return value && typeof value === "object"
    ? Object.entries(value).some(([key, entry]) => key.includes(payload) || objectContainsPayload(entry, payload))
    : false;
}

function runtimeIdentityInput(payload = "") {
  return {
    milestoneId: "0.2-multiformat-preview",
    headCommit: "a".repeat(40),
    launchContext: {
      actualLaunchCommand: payload,
      defaultActualLaunchCommand: "open -n <Auto SVGA.app>",
      argv: ["/private/Auto SVGA", payload],
      environment: {
        AUTO_SVGA_ACTUAL_LAUNCH_COMMAND: payload,
        [`AUTO_SVGA_${payload}`]: payload
      }
    },
    rendererEntry: "web/short-term-macos-app.mjs",
    rendererUrl: payload,
    mode: "normal-visible",
    processId: 42,
    runtimeInstanceId: "ASV-RUNTIME-001",
    normalVisibleStartup: true,
    finderEquivalentLaunchEvidenceReason: payload,
    fixtureMetadata: {
      fixtureLabel: payload,
      fixtureSha256: payload,
      fixtureSourcePath: payload,
      fixtureArtifactPath: payload
    },
    indexHtmlSha256: payload,
    rendererJsSha256: payload,
    stylesCssSha256: payload,
    preloadSha256: payload,
    mainSha256: payload,
    externalRequests: [payload],
    generatedAt: payload
  };
}

function acceptedPlacementInput(payload = "") {
  const primaryDisplay = {
    id: 100,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 24, width: 1920, height: 1056 },
    scaleFactor: 1
  };
  const selectedDisplay = {
    id: 200,
    bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
    workArea: { x: 1920, y: 24, width: 1920, height: 1056 },
    scaleFactor: 2
  };
  const bounds = { x: 2080, y: 220, width: 640, height: 640 };
  return {
    placement: {
      status: "accepted",
      mode: "acceptance",
      displayId: 200,
      requestedDisplayId: 200,
      executionId: "ASV-ACCEPTANCE-001",
      bounds,
      persist: false,
      [payload]: payload
    },
    requestedDisplayId: 200,
    selectedDisplay,
    primaryDisplay,
    windowBounds: bounds,
    runtimeInstanceId: "ASV-RUNTIME-001",
    productMilestoneId: "0.2-multiformat-preview",
    headCommit: "a".repeat(40),
    packagedRuntimeBuildInfo: {
      buildCommit: "a".repeat(40),
      source: "package-internal-trial",
      productMilestoneId: "0.2-multiformat-preview",
      privatePayload: payload
    },
    generatedAt: "2026-07-24T00:00:00.000Z",
    [payload]: payload
  };
}

test("WP0 inventory mechanically closes every approved startup input, authority, sink, and side-effect class", () => {
  assert.equal(inventory.findingId, "ASV-I6-PACKAGED-STARTUP-AUTH-001");
  assert.equal(inventory.formalProductMilestoneIds.length, 10);
  assert.equal(new Set(inventory.formalProductMilestoneIds).size, 10);
  assert.deepEqual(
    new Set(inventory.sideEffectBoundary),
    new Set(["read", "mkdir", "write", "append", "artifact-index", "runtime-trace"])
  );
  const expectedSinkIds = [
    "fatal-console",
    "placement-summary-console",
    "early-phase-jsonl",
    "early-failure-proof",
    "loaded-placement-accepted",
    "loaded-placement-rejected",
    "normal-visible-startup",
    "normal-runtime-proof",
    "normal-smoke-parity",
    "normal-proof-summary-console",
    "product-artifact-index",
    "multi-format-runtime-trace",
    "renderer-probe",
    "blocked-external-requests"
  ];
  assert.deepEqual(inventory.sinks.map(({ id }) => id), expectedSinkIds);
  for (const sink of inventory.sinks) {
    assert.match(startupSinkSources, new RegExp(sink.writer.replaceAll(".", "\\."), "u"), sink.id);
  }
});

test("WP0 failure-first: one runtime authority registers the entire inventory", () => {
  assert.equal(typeof startupRuntimePolicy.startupSerializationAuthority, "object");
  assert.deepEqual(
    startupRuntimePolicy.startupSerializationAuthority.registeredSinkIds,
    inventory.sinks.map(({ id }) => id)
  );
  assert.deepEqual(
    startupRuntimePolicy.startupSerializationAuthority.productMilestoneIds,
    inventory.formalProductMilestoneIds
  );
});

test("WP0 failure-first: all formal milestones pass and every invalid milestone stops before all side effects", () => {
  for (const productMilestoneId of inventory.formalProductMilestoneIds) {
    const effects = [];
    runMilestoneBeforeSideEffects(productMilestoneId, effects);
    assert.equal(startupRuntimePolicy.safeStartupProductMilestoneId(productMilestoneId), productMilestoneId);
    assert.deepEqual(effects, inventory.sideEffectBoundary);
  }
  const failures = [];
  for (const productMilestoneId of [
    "",
    ".",
    "..",
    "../escape",
    "/absolute/escape",
    "nested/escape",
    "nested\\escape",
    ...adversarialPayloads
  ]) {
    const effects = [];
    let error;
    try {
      runMilestoneBeforeSideEffects(productMilestoneId, effects);
    } catch (caught) {
      error = caught;
    }
    if (!/startup_policy_invalid_product_milestone/u.test(String(error?.message)) || effects.length > 0) {
      failures.push({ productMilestoneId, error: error?.message, effects });
    }
  }
  assert.deepEqual(failures, []);
});

test("WP1 integration: one milestone ingress authority executes before branches, path merge, trace, index, or I/O", () => {
  const ingress = mainSource.indexOf("const startupProductIdentity = resolveStartupProductIdentity(");
  const branch = mainSource.indexOf("const isShortTermProduct =");
  const pathMerge = mainSource.indexOf("const startupRuntimePolicy = resolveStartupRuntimePolicy(");
  const trace = mainSource.indexOf("const multiFormatTrace = createMultiFormatOpenRuntimeTrace");
  const index = mainSource.indexOf("const productArtifactIndex =");
  const merge = mainSource.indexOf("mergeExistingProductArtifactIndex();");
  const mkdir = mainSource.indexOf("mkdirSync(sessionRoot");
  assert.ok(ingress >= 0);
  for (const [name, sinkIndex] of Object.entries({ branch, pathMerge, trace, index, merge, mkdir })) {
    assert.ok(sinkIndex > ingress, name);
  }
});

test("WP1 identity ingress rejects an invalid environment milestone before packaged reads", () => {
  let readCount = 0;
  assert.throws(
    () => startupRuntimePolicy.resolveStartupProductIdentity({
      appIsPackaged: true,
      environment: { AUTO_SVGA_PRODUCT_MILESTONE: "PRIVATE_CLIENT_NAME_SVGA" },
      readPackagedRuntimeBuildInfo: () => {
        readCount += 1;
        return { productMilestoneId: "0.2-multiformat-preview" };
      }
    }),
    /startup_policy_invalid_product_milestone/u
  );
  assert.equal(readCount, 0);
  for (const productMilestoneId of inventory.formalProductMilestoneIds) {
    const identity = startupRuntimePolicy.resolveStartupProductIdentity({
      appIsPackaged: true,
      environment: { AUTO_SVGA_PRODUCT_MILESTONE: productMilestoneId },
      readPackagedRuntimeBuildInfo: () => ({ productMilestoneId: "short-term" })
    });
    assert.equal(identity.productMilestoneId, productMilestoneId);
  }
  assert.equal(
    startupRuntimePolicy.resolveStartupProductIdentity({
      appIsPackaged: true,
      environment: {},
      readPackagedRuntimeBuildInfo: () => ({ productMilestoneId: "0.2-multiformat-preview" })
    }).productMilestoneId,
    "0.2-multiformat-preview"
  );
});

test("WP1 integration: invalid environment milestone exits before every early proof side effect", () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "auto-svga-startup-authority-"));
  try {
    for (const productMilestoneId of ["", "../escape", "/absolute/escape", "PRIVATE_CLIENT_NAME_SVGA", "用户隐私素材", "x".repeat(4096)]) {
      const proofRoot = path.join(tempRoot, Buffer.from(productMilestoneId).toString("hex").slice(0, 32) || "empty");
      const result = spawnSync(process.execPath, [path.join(experimentRoot, "main.cjs")], {
        encoding: "utf8",
        env: {
          ...process.env,
          AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "issue6-auth-regression",
          AUTO_SVGA_PRODUCT_ARTIFACTS: proofRoot,
          AUTO_SVGA_PRODUCT_MILESTONE: productMilestoneId
        }
      });
      assert.equal(result.status, 1, productMilestoneId);
      assert.match(result.stderr, /startup_policy_invalid_product_milestone/u, productMilestoneId);
      assert.equal(existsSync(proofRoot), false, productMilestoneId);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("WP0 failure-first: invalid milestone never appends a runtime trace", () => {
  let sequence = 0;
  const failures = [];
  for (const productMilestoneId of ["", "PRIVATE_CLIENT_NAME_SVGA", "../escape", "用户隐私素材", "PRIVATE\0CLIENT", "x".repeat(4096)]) {
    sequence += 1;
    const runId = `auth-${process.pid}-${sequence}`;
    const tracePath = `/private/tmp/auto-svga-multiformat-trace-${runId}.jsonl`;
    rmSync(tracePath, { force: true });
    try {
      const trace = createMultiFormatOpenRuntimeTrace({ runId, clock: () => 1000 });
      const recorded = trace.record({ phase: "main_started", productMilestoneId });
      const traceExists = existsSync(tracePath);
      if (recorded !== false || traceExists) failures.push({ productMilestoneId, recorded, traceExists });
    } finally {
      rmSync(tracePath, { force: true });
    }
  }
  assert.deepEqual(failures, []);
});

test("WP0 failure-first: visible startup proof bytes contain no raw Error, env, command, argv, milestone, or renderer payload", async () => {
  const failures = [];
  for (const payload of adversarialPayloads) {
    const observation = await observeLegacyVisibleStartupPayload(payload);
    const leaked = observation.captured.some((entry) => objectContainsPayload(entry, payload));
    const fixedRejection = observation.error?.code === "AUTO_SVGA_STARTUP_POLICY_INVALID_PRODUCT_MILESTONE";
    if (leaked || (observation.captured.length === 0 && !fixedRejection)) {
      failures.push({ payload, leaked, writeCount: observation.captured.length, errorCode: observation.error?.code });
    }
  }
  assert.deepEqual(failures, []);
});

test("WP0 failure-first: artifact-index writer cannot serialize an unvalidated milestone", () => {
  const writeProductArtifactIndexSource = extractNamedFunction(mainSource, "function writeProductArtifactIndex");
  const failures = [];
  for (const payload of adversarialPayloads) {
    const writes = [];
    const sandbox = {
      JSON,
      path,
      productArtifactIndex: { milestoneId: payload, artifacts: [] },
      productArtifactRoot: "/private/proof",
      sanitizeProductArtifactIndex: startupRuntimePolicy.sanitizeProductArtifactIndex,
      writeFileSync: (...args) => writes.push(args)
    };
    vm.runInNewContext(
      `${writeProductArtifactIndexSource}\n        globalThis.writeIndex = writeProductArtifactIndex;`,
      sandbox
    );
    let error;
    try {
      sandbox.writeIndex();
    } catch (caught) {
      error = caught;
    }
    if (!/startup_policy_invalid_product_milestone/u.test(String(error?.message)) || writes.length > 0) {
      failures.push({ payload, error: error?.message, writeCount: writes.length });
    }
  }
  assert.deepEqual(failures, []);
});

test("WP2 property: every loaded startup serializer omits arbitrary payloads and preserves finite diagnostics", () => {
  const failures = [];
  for (const payload of adversarialPayloads) {
    const error = Object.assign(new Error(payload), { name: payload, code: payload, syscall: payload, path: payload });
    const fatal = startupRuntimePolicy.describeFatalBootstrapError({
      source: payload,
      error,
      acceptanceLaunch: true,
      acceptanceProofResult: { status: payload, reason: payload }
    });
    const runtimeIdentity = startupRuntimePolicy.buildStartupRuntimeIdentity(runtimeIdentityInput(payload));
    const visible = startupRuntimePolicy.buildNormalVisibleStartupProof({
      milestoneId: "0.2-multiformat-preview",
      headCommit: "a".repeat(40),
      runtimeIdentityInput: runtimeIdentityInput(payload),
      proofOutputMode: payload,
      rendererProbe: {
        rendererQuery: payload,
        primaryBridge: true,
        localOnly: false,
        externalRequests: [payload]
      },
      processId: 42,
      runtimeInstanceId: "ASV-RUNTIME-001",
      windowShown: true,
      finderEquivalentLaunchEvidenceReason: payload
    });
    const normalRuntime = startupRuntimePolicy.buildNormalRuntimeProof({
      milestoneId: "0.2-multiformat-preview",
      headCommit: "a".repeat(40),
      runtimeIdentityInput: runtimeIdentityInput(payload),
      processId: 42,
      runtimeInstanceId: "ASV-RUNTIME-001",
      fixtureMetadata: runtimeIdentityInput(payload).fixtureMetadata,
      screenshotHash: payload,
      result: { rendererQuery: payload, [payload]: payload },
      passed: false,
      generatedAt: payload
    });
    const parity = startupRuntimePolicy.buildNormalSmokeParity({
      milestoneId: "0.2-multiformat-preview",
      headCommit: "a".repeat(40),
      normalIdentity: { ...runtimeIdentity, [payload]: payload },
      smokeIdentity: { ...runtimeIdentity, mode: "smoke", processId: 43, runtimeInstanceId: "ASV-RUNTIME-002" },
      generatedAt: payload
    });
    const rendererProbe = startupRuntimePolicy.buildRendererProbeEvidence({
      rendererQuery: payload,
      primaryBridge: false,
      localOnly: false,
      externalRequests: [payload]
    });
    const trace = startupRuntimePolicy.sanitizeRuntimeTraceEntry({
      phase: "session_open_completed",
      productMilestoneId: "0.2-multiformat-preview",
      eventId: payload,
      requestId: payload,
      format: payload,
      modelStatus: payload,
      issueCode: payload
    }, 1000);
    const placementAccepted = buildAcceptanceStartupPlacementProof(acceptedPlacementInput(payload));
    const placementRejected = buildRejectedAcceptanceStartupPlacementProof(acceptedPlacementInput(payload), payload);
    const placementSummary = startupRuntimePolicy.buildStartupPlacementSummary({
      status: payload,
      reason: payload,
      fileName: payload,
      proof: { reason: payload },
      [payload]: payload
    });
    const normalProofSummary = startupRuntimePolicy.buildNormalProofSummary({
      milestoneId: "0.2-multiformat-preview",
      passed: payload,
      windowShown: payload,
      localOnly: payload,
      noCspViolation: payload,
      [payload]: payload
    });
    const index = startupRuntimePolicy.sanitizeProductArtifactIndex({
      milestoneId: "0.2-multiformat-preview",
      title: payload,
      productIdentity: payload,
      headCommit: "a".repeat(40),
      generatedAt: "2026-07-24T00:00:00.000Z",
      humanReviewRequired: true,
      [payload]: payload,
      artifacts: [
        {
          scenario: "normal-visible-startup",
          mode: "normal",
          source: payload,
          viewport: { width: 640, height: 640, [payload]: payload },
          path: ".artifacts/product/0.2-multiformat-preview/normal-visible-startup.json",
          mime: payload,
          sizeBytes: 42,
          sha256: "b".repeat(64),
          headCommit: payload,
          rendererEntry: payload,
          generatedAt: "2026-07-24T00:00:00.000Z",
          [payload]: payload
        },
        {
          scenario: payload,
          path: `.artifacts/product/0.2-multiformat-preview/${payload}.json`,
          sizeBytes: 42,
          sha256: "b".repeat(64)
        }
      ]
    });
    const observations = {
      fatal,
      runtimeIdentity,
      visible,
      normalRuntime,
      parity,
      rendererProbe,
      trace,
      placementAccepted,
      placementRejected,
      placementSummary,
      normalProofSummary,
      index
    };
    for (const [sink, value] of Object.entries(observations)) {
      if (objectContainsPayload(value, payload)) failures.push({ payload, sink });
    }
    if (index.artifacts.length !== 1) failures.push({ payload, sink: "product-artifact-index-valid-record" });
  }
  assert.deepEqual(failures, []);

  const fixedPolicy = Object.assign(new Error("private"), {
    code: "AUTO_SVGA_STARTUP_POLICY_INVALID_PRODUCT_MILESTONE"
  });
  assert.equal(
    startupRuntimePolicy.describeFatalBootstrapError({
      source: "uncaught_exception",
      error: fixedPolicy,
      acceptanceLaunch: false
    }).reason,
    "startup_policy_invalid_product_milestone"
  );
});

test("WP2 property: field-set authority rejects spread or override drift", () => {
  for (const schemaId of startupRuntimePolicy.startupSerializationAuthority.schemaIds) {
    assert.throws(
      () => startupRuntimePolicy.finalizeStartupRecord(schemaId, { PRIVATE_CLIENT_NAME_SVGA: "payload" }),
      /startup_serialization_field_set_invalid/u,
      schemaId
    );
  }
});

test("WP3 mutation gate: early mirror and loaded authority have whole-manifest parity", () => {
  const start = mainSource.indexOf("const earlyStartupSchemaFieldSets");
  const end = mainSource.indexOf("function safeBootstrapErrorClass", start);
  assert.ok(start >= 0 && end > start);
  const loadedEarlyAuthority = startupRuntimePolicy.startupEarlySerializationAuthority;
  const earlySource = mainSource.slice(start, end);
  const evaluateEarlyAuthority = (source, overrides = {}) => {
    const sandbox = {
      JSON,
      Object,
      Set,
      createHash: require("node:crypto").createHash,
      acceptanceExecutionIdPattern: /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u,
      safeStartupProductMilestoneIds: new Set(loadedEarlyAuthority.productMilestoneIds),
      safeBootstrapSources: new Set(loadedEarlyAuthority.sources),
      safeBootstrapErrorClasses: new Set(loadedEarlyAuthority.errorClasses),
      safeBootstrapReasonByErrorCode: loadedEarlyAuthority.reasonByErrorCode,
      safeBootstrapErrorSyscalls: new Set(loadedEarlyAuthority.errorSyscalls),
      safeAcceptanceBootstrapReasons: new Set(loadedEarlyAuthority.acceptanceReasons),
      ...overrides
    };
    vm.runInNewContext(
      `${source}\n      globalThis.authority = earlyStartupSerializationAuthority;`,
      sandbox
    );
    return JSON.parse(JSON.stringify(sandbox.authority));
  };
  const earlyAuthority = evaluateEarlyAuthority(earlySource);
  assert.deepEqual(
    earlyAuthority,
    JSON.parse(JSON.stringify(loadedEarlyAuthority))
  );
  assert.match(mainSource, /assertStartupEarlySerializationAuthorityParity\(earlyStartupSerializationAuthority\)/u);
  for (const key of Object.keys(loadedEarlyAuthority)) {
    const original = loadedEarlyAuthority[key];
    const mutated = {
      ...loadedEarlyAuthority,
      [key]: Array.isArray(original)
        ? [...original, "PRIVATE_CLIENT_NAME_SVGA"]
        : typeof original === "string"
          ? `${original}PRIVATE_CLIENT_NAME_SVGA`
          : typeof original === "number"
            ? original + 1
            : { ...original, PRIVATE_CLIENT_NAME_SVGA: "payload" }
    };
    assert.throws(
      () => startupRuntimePolicy.assertStartupEarlySerializationAuthorityParity(mutated),
      /startup_serialization_authority_mismatch/u,
      key
    );
  }
  const earlySourceMutations = [
    earlySource.replace(
      '"placement-summary": Object.freeze(["status", "reason", "fileName"])',
      '"placement-summary": Object.freeze(["status", "reason", "fileName", "PRIVATE_CLIENT_NAME_SVGA"])'
    ),
    earlySource.replace(
      '"placement-summary": Object.freeze(["status", "reason", "fileName"])',
      '"placement-summary": Object.freeze(["reason", "status", "fileName"])'
    ),
    earlySource.replace('  "server_started"\n]);', '  "server_started",\n  "PRIVATE_CLIENT_NAME_SVGA"\n]);'),
    earlySource.replace(
      '  "early-failure-proof"\n]);',
      '  "early-failure-proof",\n  "PRIVATE_CLIENT_NAME_SVGA"\n]);'
    )
  ];
  for (const [index, mutatedSource] of earlySourceMutations.entries()) {
    assert.notEqual(mutatedSource, earlySource, `early-source-mutation-${index}`);
    const mutatedAuthority = evaluateEarlyAuthority(mutatedSource);
    assert.throws(
      () => startupRuntimePolicy.assertStartupEarlySerializationAuthorityParity(mutatedAuthority),
      /startup_serialization_authority_mismatch/u,
      `early-source-mutation-${index}`
    );
  }
});

test("WP3 mutation gate: every alternate startup validator and local serializer is absent", () => {
  const traceSource = readFileSync(path.join(experimentRoot, "multiformat-open-runtime-trace.cjs"), "utf8");
  const placementSource = readFileSync(path.join(experimentRoot, "acceptance-startup-placement-proof.cjs"), "utf8");
  assert.match(mainSource, /function validateArtifactScenario\(value\) \{\s*return safeProductArtifactScenario\(value\);\s*\}/u);
  assert.match(mainSource, /function artifactFileNameForScenario\(scenario\) \{\s*return productArtifactFileNameForScenario\(scenario\);\s*\}/u);
  assert.equal(mainSource.includes("^desktop-motion-[a-zA-Z0-9_-]+"), false);
  assert.match(traceSource, /sanitizeRuntimeTraceEntry\(input, clock\(\)\)/u);
  assert.doesNotMatch(traceSource, /function assignToken|function sanitizeTraceEntry/u);
  assert.match(placementSource, /finalizeStartupRecord\("placement-accepted", proof\)/u);
  assert.match(placementSource, /finalizeStartupRecord\("placement-rejected", proof\)/u);
  assert.match(mainSource, /buildNormalVisibleStartupProof\(/u);
  assert.match(mainSource, /sanitizeProductArtifactIndex\(productArtifactIndex\)/u);
});
