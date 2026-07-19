import assert from "node:assert/strict";
import { test } from "node:test";

import { ENTRY_CONTRACT } from "./aeb-registered-fixture-runtime-entry.mjs";
import { runAe26FixtureRequest } from "./run-aeb-ae26-fixture-request.mjs";

const HEAD = "a".repeat(40);

test("fixture request runner fails before materialization when host foreground is not ready", async () => {
  let materializeCalled = false;
  await assert.rejects(
    () => runAe26FixtureRequest(
      ["--permit-id", "ASV-APR-test", "--request-id", "aeb-semantic-runner-test"],
      {
        collectReadiness: () => ({
          ready: false,
          blockers: [{ code: "aeb.host_readiness_loginwindow_frontmost" }],
        }),
        materializeFixtureRequest: () => {
          materializeCalled = true;
        },
      },
    ),
    (error) => {
      assert.equal(error.code, "aeb_fixture_request_host_not_ready");
      assert.equal(error.readiness.ready, false);
      return true;
    },
  );
  assert.equal(materializeCalled, false);
});

test("fixture request runner publishes one current-head request after readiness passes", async () => {
  const now = Date.parse("2026-07-17T05:00:00.000Z");
  let materializeInput;
  const result = await runAe26FixtureRequest(
    ["--permit-id", "ASV-APR-test", "--request-id", "aeb-semantic-runner-test", "--source-head", HEAD],
    {
      now: () => now,
      collectReadiness: () => ({ ready: true, blockers: [] }),
      materializeFixtureRequest: (input) => {
        materializeInput = input;
        return {
          requestSha256: "1".repeat(64),
          requestPublicationPath: "/private/tmp/publication.json",
          requestPublicationSha256: "2".repeat(64),
          mutationPerformed: true,
        };
      },
    },
  );

  assert.equal(materializeInput.schema, ENTRY_CONTRACT.requestSchema);
  assert.equal(materializeInput.permitId, "ASV-APR-test");
  assert.equal(materializeInput.requestId, "aeb-semantic-runner-test");
  assert.equal(materializeInput.sourceHead, HEAD);
  assert.equal(materializeInput.requestCreatedAtEpochMs, now);
  assert.equal(materializeInput.requestExpiresAtEpochMs, now + ENTRY_CONTRACT.requestLifetimeMs);
  assert.equal(
    materializeInput.sourcePackageRoot,
    "/private/tmp/auto-svga-aeb-dev/aeb-semantic-runner-test/ae-export-package",
  );

  assert.equal(result.schema, "auto-svga-aeb-ae26-fixture-request-run-v1");
  assert.equal(result.ready, true);
  assert.equal(result.sourceHead, HEAD);
  assert.equal(result.requestSha256, "1".repeat(64));
  assert.equal(result.mutationPerformed, true);
});

test("fixture request runner rejects malformed or duplicate arguments", async () => {
  await assert.rejects(
    () => runAe26FixtureRequest(["--permit-id", "x"], { collectReadiness: () => ({ ready: true }) }),
    { code: "aeb_fixture_request_arguments_invalid" },
  );
  await assert.rejects(
    () => runAe26FixtureRequest(
      ["--permit-id", "x", "--request-id", "y", "--request-id", "z"],
      { collectReadiness: () => ({ ready: true }) },
    ),
    { code: "aeb_fixture_request_arguments_invalid" },
  );
});
