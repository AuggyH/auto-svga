import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { canonicalJsonBytes } from "./aeb-registered-fixture-runtime-entry.mjs";
import {
  loadPreparedMaterial,
  loadExistingRequestPublication,
  runAebAe26FixtureMilestone,
} from "./run-aeb-ae26-fixture-milestone.mjs";

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const ORCHESTRATOR_PATH = path.join(SCRIPT_ROOT, "run-registered-fixture-product-proof-orchestrator.mjs");
const HEAD = "b".repeat(40);
const REQUEST_ID = "aeb-semantic-runtime-20260717-001";
const PERMIT_ID = "ASV-APR-20260717-999";

function requestResult(overrides = {}) {
  return {
    schema: "auto-svga-aeb-ae26-fixture-request-run-v1",
    ready: true,
    sourceHead: HEAD,
    requestId: REQUEST_ID,
    permitId: PERMIT_ID,
    requestCreatedAtEpochMs: 1_800_000_000_000,
    requestExpiresAtEpochMs: 1_800_000_540_000,
    sourcePackageRoot: `/private/tmp/auto-svga-aeb-dev/${REQUEST_ID}/ae-export-package`,
    requestSha256: "1".repeat(64),
    requestPublicationPath: `/private/tmp/auto-svga-aeb-dev/semantic-inbox-ae26/publication-${REQUEST_ID}.json`,
    requestPublicationSha256: "2".repeat(64),
    mutationPerformed: true,
    ...overrides,
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function publicationRecord(overrides = {}) {
  const inboxRoot = "/private/tmp/auto-svga-aeb-dev/semantic-inbox-ae26";
  return {
    schema: "auto-svga-aeb-registered-fixture-request-publication-v2",
    permitId: PERMIT_ID,
    requestId: REQUEST_ID,
    sourceHead: HEAD,
    requestCreatedAtEpochMs: 1_800_000_000_000,
    requestExpiresAtEpochMs: 1_800_000_540_000,
    requestPath: path.join(inboxRoot, "request.json"),
    requestSha256: "1".repeat(64),
    requestBytes: 1024,
    publicationPath: path.join(inboxRoot, `publication-${REQUEST_ID}.json`),
    sourcePackageRoot: `/private/tmp/auto-svga-aeb-dev/${REQUEST_ID}/ae-export-package`,
    fixtureSha256: "8".repeat(64),
    fixtureBytes: 811,
    directories: {},
    files: {},
    mutationPerformed: true,
    ...overrides,
  };
}

function publicationRead(record) {
  const bytes = Buffer.from(JSON.stringify(record), "utf8");
  return (publicationPath) => ({
    path: publicationPath,
    bytes,
    sha256: sha256(bytes),
  });
}

function resumeStateInspector(states) {
  return (filePath) => states.get(filePath) || "missing";
}

function preparedResult(overrides = {}) {
  return {
    schema: "auto-svga-aeb-registered-fixture-runtime-entry-prepared-v1",
    packetHead: HEAD,
    descriptor: { sha256: "5".repeat(64) },
    d001Lifecycle: { sha256: "6".repeat(64) },
    command: { argvSha256: "7".repeat(64) },
    ...overrides,
  };
}

function executablePreparedMaterial(overrides = {}) {
  const descriptorBytes = Buffer.from("descriptor", "utf8");
  const lifecycleBytes = Buffer.from("lifecycle", "utf8");
  const descriptorBase64 = descriptorBytes.toString("base64url");
  const lifecycleBase64 = lifecycleBytes.toString("base64url");
  const descriptorSha = sha256(descriptorBytes);
  const argv = [
    ORCHESTRATOR_PATH,
    "--mode",
    "execute",
    "--descriptor-base64",
    descriptorBase64,
    "--descriptor-sha256",
    descriptorSha,
    "--d001-lifecycle-base64",
    lifecycleBase64,
  ];
  const command = {
    executable: process.execPath,
    argv,
  };
  return {
    schema: "auto-svga-aeb-registered-fixture-runtime-entry-prepared-v1",
    packetHead: HEAD,
    launchAuthorized: false,
    mutationPerformed: true,
    descriptor: {
      sha256: descriptorSha,
      base64url: descriptorBase64,
      value: {
        permitId: PERMIT_ID,
        requestId: REQUEST_ID,
        sourceHead: HEAD,
      },
    },
    d001Lifecycle: {
      sha256: sha256(lifecycleBytes),
      base64url: lifecycleBase64,
    },
    command: {
      ...command,
      argvSha256: sha256(canonicalJsonBytes(command)),
    },
    ...overrides,
  };
}

test("milestone runner fails before install or request when host readiness is not ready", async () => {
  let installCalled = false;
  await assert.rejects(
    () => runAebAe26FixtureMilestone(
      ["--permit-id", PERMIT_ID, "--request-id", REQUEST_ID],
      {
        currentHead: () => HEAD,
        collectReadiness: () => ({
          ready: false,
          blockers: [{ code: "aeb.host_readiness_loginwindow_frontmost" }],
        }),
        installIsolatedPanel: () => {
          installCalled = true;
        },
      },
    ),
    (error) => {
      assert.equal(error.code, "aeb_fixture_milestone_host_not_ready");
      assert.equal(error.readiness.ready, false);
      return true;
    },
  );
  assert.equal(installCalled, false);
});

test("milestone runner can resume from an existing request publication without reinstalling or republishing", async () => {
  let installCalled = false;
  let requestCalled = false;
  let loadedInput;
  const result = await runAebAe26FixtureMilestone(
    [
      "--permit-id", PERMIT_ID,
      "--request-id", REQUEST_ID,
      "--source-head", HEAD,
      "--resume-existing", "true",
      "--stop-after", "request",
    ],
    {
      collectReadiness: () => assert.fail("read-only resume should not require host readiness"),
      installIsolatedPanel: () => {
        installCalled = true;
      },
      runFixtureRequest: () => {
        requestCalled = true;
      },
      loadExistingRequestPublication: (input) => {
        loadedInput = input;
        return requestResult({
          schema: "auto-svga-aeb-ae26-fixture-request-resume-v1",
          mutationPerformed: false,
          resumedFromPublication: true,
        });
      },
    },
  );
  assert.equal(installCalled, false);
  assert.equal(requestCalled, false);
  assert.deepEqual(loadedInput, {
    permitId: PERMIT_ID,
    requestId: REQUEST_ID,
    sourceHead: HEAD,
  });
  assert.equal(result.status, "request_resumed");
  assert.equal(result.install, null);
  assert.equal(result.request.resumedFromPublication, true);
  assert.equal(result.mutationPerformed, false);
});

test("milestone runner requires host readiness when resumed publication is still waiting for AE package", async () => {
  let loadedInput;
  await assert.rejects(
    () => runAebAe26FixtureMilestone(
      [
        "--permit-id", PERMIT_ID,
        "--request-id", REQUEST_ID,
        "--source-head", HEAD,
        "--resume-existing", "true",
        "--stop-after", "prepare",
      ],
      {
        loadExistingRequestPublication: (input) => {
          loadedInput = input;
          return requestResult({
            schema: "auto-svga-aeb-ae26-fixture-request-resume-v1",
            mutationPerformed: false,
            resumedFromPublication: true,
            packageReady: false,
          });
        },
        collectReadiness: () => ({
          ready: false,
          blockers: [{ code: "aeb.host_readiness_loginwindow_frontmost" }],
        }),
      },
    ),
    { code: "aeb_fixture_milestone_host_not_ready" },
  );
  assert.deepEqual(loadedInput, {
    permitId: PERMIT_ID,
    requestId: REQUEST_ID,
    sourceHead: HEAD,
  });
});

test("milestone runner skips host readiness when executing prepared material", async () => {
  let executed = false;
  const result = await runAebAe26FixtureMilestone(
      [
        "--permit-id", PERMIT_ID,
        "--request-id", REQUEST_ID,
        "--source-head", HEAD,
        "--resume-prepared", "true",
      ],
      {
        collectReadiness: () => assert.fail("prepared execution does not require AE host readiness"),
        loadPreparedMaterial: () => ({
          prepared: preparedResult(),
          preparedPath: "/private/tmp/auto-svga-aeb-d001-8594bcfa/aeb-d001-runtime-20260717-001-prepared.json",
          preparedSha256: "8".repeat(64),
        }),
        executePreparedCommand: () => {
          executed = true;
          return { schema: "fake-product-proof-result", status: "pass" };
        },
      },
  );
  assert.equal(executed, true);
  assert.equal(result.status, "executed_from_prepared");
});

test("milestone runner can resume execution from prepared material without rebuilding package authority", async () => {
  let installCalled = false;
  let requestCalled = false;
  let waitCalled = false;
  let prepareCalled = false;
  let loadedInput;
  let executed = false;
  const prepared = preparedResult();
  const result = await runAebAe26FixtureMilestone(
    [
      "--permit-id", PERMIT_ID,
      "--request-id", REQUEST_ID,
      "--source-head", HEAD,
      "--resume-prepared", "true",
    ],
    {
      collectReadiness: () => assert.fail("prepared execution should not require host readiness"),
      installIsolatedPanel: () => {
        installCalled = true;
      },
      runFixtureRequest: () => {
        requestCalled = true;
      },
      waitForAePackage: () => {
        waitCalled = true;
      },
      prepareRuntimeEntry: () => {
        prepareCalled = true;
      },
      loadPreparedMaterial: (input) => {
        loadedInput = input;
        return {
          prepared,
          preparedPath: "/private/tmp/auto-svga-aeb-d001-8594bcfa/aeb-d001-runtime-20260717-001-prepared.json",
          preparedSha256: "8".repeat(64),
        };
      },
      executePreparedCommand: (value) => {
        assert.equal(value, prepared);
        executed = true;
        return { schema: "fake-product-proof-result", status: "pass" };
      },
    },
  );
  assert.equal(installCalled, false);
  assert.equal(requestCalled, false);
  assert.equal(waitCalled, false);
  assert.equal(prepareCalled, false);
  assert.equal(executed, true);
  assert.deepEqual(loadedInput.parsed["resume-prepared"], "true");
  assert.equal(loadedInput.sourceHead, HEAD);
  assert.equal(result.status, "executed_from_prepared");
  assert.equal(result.preparedPath.endsWith("-prepared.json"), true);
  assert.equal(result.execution.status, "pass");
});

test("auto-resume executes prepared material before checking older request publication", async () => {
  let publicationCalled = false;
  let installCalled = false;
  let executed = false;
  const prepared = preparedResult();
  const result = await runAebAe26FixtureMilestone(
    [
      "--permit-id", PERMIT_ID,
      "--request-id", REQUEST_ID,
      "--source-head", HEAD,
      "--auto-resume", "true",
    ],
    {
      collectReadiness: () => assert.fail("prepared auto-resume should not require host readiness"),
      loadPreparedMaterial: () => ({
        prepared,
        preparedPath: "/private/tmp/auto-svga-aeb-d001-8594bcfa/aeb-d001-runtime-20260717-001-prepared.json",
        preparedSha256: "8".repeat(64),
      }),
      loadExistingRequestPublication: () => {
        publicationCalled = true;
      },
      installIsolatedPanel: () => {
        installCalled = true;
      },
      executePreparedCommand: (value) => {
        assert.equal(value, prepared);
        executed = true;
        return { schema: "fake-product-proof-result", status: "pass" };
      },
    },
  );
  assert.equal(publicationCalled, false);
  assert.equal(installCalled, false);
  assert.equal(executed, true);
  assert.equal(result.status, "auto_resumed_prepared_executed");
});

test("milestone runner prepares from a consumed resumed publication without AE host readiness or wait", async () => {
  let preflightInput;
  let entryInput;
  let waitCalled = false;
  const result = await runAebAe26FixtureMilestone(
    [
      "--permit-id", PERMIT_ID,
      "--request-id", REQUEST_ID,
      "--source-head", HEAD,
      "--resume-existing", "true",
      "--stop-after", "prepare",
    ],
    {
      collectReadiness: () => assert.fail("consumed resumed publication does not require AE host readiness"),
      loadExistingRequestPublication: () => requestResult({
        schema: "auto-svga-aeb-ae26-fixture-request-resume-v1",
        mutationPerformed: false,
        resumedFromPublication: true,
        packageReady: true,
        consumedPath: `/private/tmp/auto-svga-aeb-dev/semantic-inbox-ae26/consumed-${REQUEST_ID}.json`,
        finalizedPackagePath: `/private/tmp/auto-svga-aeb-dev/${REQUEST_ID}/ae-export-package/ae-export-package.finalized.json`,
      }),
      waitForAePackage: () => {
        waitCalled = true;
      },
      prepareD001Preflight: (input) => {
        preflightInput = input;
        return {
          relayPath: "/private/tmp/preflight-relay.json",
          relaySha256: "3".repeat(64),
          prelaunchAuthorityPath: "/private/tmp/prelaunch-authority.json",
          prelaunchAuthoritySha256: "4".repeat(64),
        };
      },
      prepareRuntimeEntry: (input) => {
        entryInput = input;
        return preparedResult({ packetHead: input.sourceHead });
      },
      writePreparedMaterial: () => ({
        preparedPath: "/private/tmp/prepared.json",
        preparedSha256: "8".repeat(64),
      }),
    },
  );
  assert.equal(waitCalled, false);
  assert.equal(result.status, "prepared");
  assert.equal(result.ae.resumedPackageReady, true);
  assert.equal(preflightInput.packetHead, HEAD);
  assert.equal(entryInput.requestId, REQUEST_ID);
});

test("auto-resume falls back to request publication when prepared material is absent", async () => {
  let installCalled = false;
  let requestCalled = false;
  let preparedInput;
  let executed = false;
  const result = await runAebAe26FixtureMilestone(
    [
      "--permit-id", PERMIT_ID,
      "--request-id", REQUEST_ID,
      "--source-head", HEAD,
      "--auto-resume", "true",
    ],
    {
      collectReadiness: () => ({ ready: true }),
      loadPreparedMaterial: () => {
        const error = new Error("missing prepared");
        error.code = "aeb_fixture_milestone_prepared_missing";
        throw error;
      },
      loadExistingRequestPublication: () => requestResult({
        schema: "auto-svga-aeb-ae26-fixture-request-resume-v1",
        mutationPerformed: false,
        resumedFromPublication: true,
      }),
      installIsolatedPanel: () => {
        installCalled = true;
      },
      runFixtureRequest: () => {
        requestCalled = true;
      },
      waitForAePackage: () => ({ consumedPath: "/private/tmp/consumed.json", finalizedPackagePath: "/private/tmp/finalized.json" }),
      prepareD001Preflight: () => ({
        relayPath: "/private/tmp/preflight-relay.json",
        relaySha256: "3".repeat(64),
        prelaunchAuthorityPath: "/private/tmp/prelaunch-authority.json",
        prelaunchAuthoritySha256: "4".repeat(64),
      }),
      prepareRuntimeEntry: (input) => {
        preparedInput = input;
        return preparedResult();
      },
      writePreparedMaterial: () => ({
        preparedPath: "/private/tmp/prepared.json",
        preparedSha256: "8".repeat(64),
      }),
      executePreparedCommand: () => {
        executed = true;
        return { schema: "fake-product-proof-result", status: "pass" };
      },
    },
  );
  assert.equal(installCalled, false);
  assert.equal(requestCalled, false);
  assert.equal(executed, true);
  assert.equal(preparedInput.requestId, REQUEST_ID);
  assert.equal(result.status, "auto_resumed_publication_executed");
});

test("auto-resume stops before host readiness when a publication lost request markers after host crash", async () => {
  let readinessCalled = false;
  await assert.rejects(
    () => runAebAe26FixtureMilestone(
      [
        "--permit-id", PERMIT_ID,
        "--request-id", REQUEST_ID,
        "--source-head", HEAD,
        "--auto-resume", "true",
      ],
      {
        loadPreparedMaterial: () => {
          const error = new Error("missing prepared");
          error.code = "aeb_fixture_milestone_prepared_missing";
          throw error;
        },
        loadExistingRequestPublication: () => {
          const error = new Error("missing request marker");
          error.code = "aeb_fixture_milestone_publication_unconsumed_ambiguous";
          throw error;
        },
        collectReadiness: () => {
          readinessCalled = true;
          return { ready: true };
        },
      },
    ),
    { code: "aeb_fixture_milestone_publication_unconsumed_ambiguous" },
  );
  assert.equal(readinessCalled, false);
});

test("milestone runner can stop after request publication without waiting for AE", async () => {
  let waitCalled = false;
  const result = await runAebAe26FixtureMilestone(
    ["--permit-id", PERMIT_ID, "--request-id", REQUEST_ID, "--source-head", HEAD, "--stop-after", "request"],
    {
      currentHead: () => assert.fail("source head should come from explicit argument"),
      collectReadiness: () => ({ ready: true }),
      installIsolatedPanel: () => ({ stdout: "AEB_AE26_ISOLATED_INSTALL_SUCCESS\n" }),
      runFixtureRequest: (argv) => {
        assert.deepEqual(argv, [
          "--permit-id", PERMIT_ID,
          "--request-id", REQUEST_ID,
          "--source-head", HEAD,
        ]);
        return requestResult();
      },
      waitForAePackage: () => {
        waitCalled = true;
      },
    },
  );
  assert.equal(result.status, "request_published");
  assert.equal(result.request.requestId, REQUEST_ID);
  assert.equal(waitCalled, false);
});

test("existing request publication loader rejects mismatched authority", () => {
  const inboxRoot = "/private/tmp/auto-svga-aeb-dev/semantic-inbox-ae26";
  const record = publicationRecord({ permitId: "ASV-APR-20260717-000" });
  const bytes = Buffer.from(JSON.stringify(record), "utf8");
  assert.throws(
    () => loadExistingRequestPublication({
      permitId: PERMIT_ID,
      requestId: REQUEST_ID,
      sourceHead: HEAD,
    }, {
      inboxRoot,
      readPublicationFile: (publicationPath) => ({
        path: publicationPath,
        bytes,
        sha256: sha256(bytes),
      }),
    }),
    { code: "aeb_fixture_milestone_publication_mismatch" },
  );
});

test("existing request publication loader returns a typed missing-publication error", () => {
  assert.throws(
    () => loadExistingRequestPublication({
      permitId: PERMIT_ID,
      requestId: REQUEST_ID,
      sourceHead: HEAD,
    }, {
      inboxRoot: "/private/tmp/auto-svga-aeb-dev/semantic-inbox-ae26",
      readPublicationFile: () => {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      },
    }),
    { code: "aeb_fixture_milestone_publication_missing" },
  );
});

test("existing request publication loader reports pending or consumed state and rejects crash-ambiguous residue", () => {
  const inboxRoot = "/private/tmp/auto-svga-aeb-dev/semantic-inbox-ae26";
  const record = publicationRecord();
  const requestPath = path.join(inboxRoot, "request.json");
  const consumedPath = path.join(inboxRoot, `consumed-${REQUEST_ID}.json`);
  const finalizedPackagePath = path.join(record.sourcePackageRoot, "ae-export-package.finalized.json");

  const pending = loadExistingRequestPublication({
    permitId: PERMIT_ID,
    requestId: REQUEST_ID,
    sourceHead: HEAD,
  }, {
    inboxRoot,
    readPublicationFile: publicationRead(record),
    inspectResumeFile: resumeStateInspector(new Map([[requestPath, "file"]])),
  });
  assert.equal(pending.requestState, "pending");
  assert.equal(pending.packageReady, false);

  const consumed = loadExistingRequestPublication({
    permitId: PERMIT_ID,
    requestId: REQUEST_ID,
    sourceHead: HEAD,
  }, {
    inboxRoot,
    readPublicationFile: publicationRead(record),
    inspectResumeFile: resumeStateInspector(new Map([
      [consumedPath, "file"],
      [finalizedPackagePath, "file"],
    ])),
  });
  assert.equal(consumed.requestState, "consumed");
  assert.equal(consumed.packageReady, true);

  assert.throws(
    () => loadExistingRequestPublication({
      permitId: PERMIT_ID,
      requestId: REQUEST_ID,
      sourceHead: HEAD,
    }, {
      inboxRoot,
      readPublicationFile: publicationRead(record),
      inspectResumeFile: resumeStateInspector(new Map()),
    }),
    { code: "aeb_fixture_milestone_publication_unconsumed_ambiguous" },
  );
});

test("prepared material loader returns a typed missing-prepared error", () => {
  assert.throws(
    () => loadPreparedMaterial({
      parsed: {
        "permit-id": PERMIT_ID,
        "request-id": REQUEST_ID,
        "source-head": HEAD,
        "d001-execution-id": undefined,
      },
      sourceHead: HEAD,
    }, {
      readPreparedFile: () => {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      },
    }),
    { code: "aeb_fixture_milestone_prepared_missing" },
  );
});

test("prepared material loader accepts canonical reviewed command material", () => {
  const parsed = {
    "permit-id": PERMIT_ID,
    "request-id": REQUEST_ID,
    "source-head": HEAD,
    "d001-execution-id": undefined,
  };
  const preparedPath = "/private/tmp/auto-svga-aeb-d001-8594bcfa/aeb-d001-runtime-20260717-001-prepared.json";
  const prepared = executablePreparedMaterial();
  const bytes = canonicalJsonBytes(prepared);
  const loaded = loadPreparedMaterial({ parsed, sourceHead: HEAD }, {
    readPreparedFile: (requestedPath) => ({
      path: requestedPath,
      bytes,
      sha256: sha256(bytes),
    }),
  });
  assert.equal(loaded.preparedPath, preparedPath);
  assert.equal(loaded.prepared.command.argvSha256, prepared.command.argvSha256);
});

test("milestone runner prepares current-head descriptor after AE package consumption", async () => {
  let preflightInput;
  let entryInput;
  const result = await runAebAe26FixtureMilestone(
    ["--permit-id", PERMIT_ID, "--request-id", REQUEST_ID, "--stop-after", "prepare"],
    {
      currentHead: () => HEAD,
      collectReadiness: () => ({ ready: true }),
      installIsolatedPanel: () => ({ stdout: "AEB_AE26_ISOLATED_INSTALL_SUCCESS\n" }),
      runFixtureRequest: () => requestResult(),
      waitForAePackage: ({ requestId, sourcePackageRoot }) => ({
        consumedPath: `/private/tmp/auto-svga-aeb-dev/semantic-inbox-ae26/consumed-${requestId}.json`,
        finalizedPackagePath: `${sourcePackageRoot}/ae-export-package.finalized.json`,
      }),
      prepareD001Preflight: (input) => {
        preflightInput = input;
        return {
          relayPath: "/private/tmp/preflight-relay.json",
          relaySha256: "3".repeat(64),
          prelaunchAuthorityPath: "/private/tmp/prelaunch-authority.json",
          prelaunchAuthoritySha256: "4".repeat(64),
        };
      },
      prepareRuntimeEntry: (input) => {
        entryInput = input;
        return preparedResult({ packetHead: input.sourceHead });
      },
      writePreparedMaterial: ({ prepared }) => {
        assert.equal(prepared.packetHead, HEAD);
        return {
          preparedPath: "/private/tmp/prepared.json",
          preparedSha256: "8".repeat(64),
        };
      },
    },
  );
  assert.equal(preflightInput.packetHead, HEAD);
  assert.equal(preflightInput.d001ExecutionId, "aeb-d001-runtime-20260717-001");
  assert.equal(entryInput.executionId, "aeb-fixture-runtime-20260717-001");
  assert.equal(entryInput.d001ExecutionId, "aeb-d001-runtime-20260717-001");
  assert.equal(entryInput.preflightRelaySha256, "3".repeat(64));
  assert.equal(entryInput.prelaunchAuthoritySha256, "4".repeat(64));
  assert.equal(result.status, "prepared");
  assert.equal(result.prepared.packetHead, HEAD);
  assert.equal(result.preparedPath, "/private/tmp/prepared.json");
  assert.equal(result.preparedSha256, "8".repeat(64));
});

test("milestone runner executes the prepared product orchestrator when requested", async () => {
  let executed = false;
  const result = await runAebAe26FixtureMilestone(
    ["--permit-id", PERMIT_ID, "--request-id", REQUEST_ID],
    {
      currentHead: () => HEAD,
      collectReadiness: () => ({ ready: true }),
      installIsolatedPanel: () => ({ stdout: "AEB_AE26_ISOLATED_INSTALL_SUCCESS\n" }),
      runFixtureRequest: () => requestResult(),
      waitForAePackage: () => ({ consumedPath: "/private/tmp/consumed.json", finalizedPackagePath: "/private/tmp/finalized.json" }),
      prepareD001Preflight: () => ({
        relayPath: "/private/tmp/preflight-relay.json",
        relaySha256: "3".repeat(64),
        prelaunchAuthorityPath: "/private/tmp/prelaunch-authority.json",
        prelaunchAuthoritySha256: "4".repeat(64),
      }),
      prepareRuntimeEntry: () => ({
        ...preparedResult(),
      }),
      writePreparedMaterial: ({ prepared }) => {
        assert.equal(prepared.packetHead, HEAD);
        return {
          preparedPath: "/private/tmp/prepared.json",
          preparedSha256: "8".repeat(64),
        };
      },
      executePreparedCommand: () => {
        executed = true;
        return { schema: "fake-product-proof-result", status: "pass" };
      },
    },
  );
  assert.equal(executed, true);
  assert.equal(result.status, "executed");
  assert.equal(result.execution.status, "pass");
});
