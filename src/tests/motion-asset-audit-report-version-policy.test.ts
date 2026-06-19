import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertSupportedReportContractVersion,
  getCurrentReportContractVersion,
  getSupportedReportContractVersions,
  isSupportedReportContractVersion,
  parseMotionAssetAuditReportV1,
  parseReportContractVersion,
  validateMotionAssetAuditReportV1
} from "../workbench/motion-asset-audit-report-contract.js";

test("declares v1 as the current and only supported report contract", () => {
  assert.equal(getCurrentReportContractVersion(), 1);
  assert.deepEqual(getSupportedReportContractVersions(), [1]);
  assert.equal(isSupportedReportContractVersion(1), true);
  assert.doesNotThrow(() => assertSupportedReportContractVersion(1));
});

test("rejects unknown report contract versions without v1 fallback", async () => {
  const fixture = await fixtureValue();
  fixture.contractVersion = 2;

  assert.equal(parseReportContractVersion(fixture), 2);
  assert.equal(isSupportedReportContractVersion(2), false);
  assert.throws(() => assertSupportedReportContractVersion(2), /Unsupported.*2/);
  assert.equal(validateMotionAssetAuditReportV1(fixture).valid, false);
  assert.throws(
    () => parseMotionAssetAuditReportV1(JSON.stringify(fixture)),
    /Unsupported.*2/
  );
});

test("rejects missing and wrongly typed contract versions", () => {
  assert.throws(() => parseReportContractVersion({}), /contractVersion is required/);
  assert.throws(
    () => parseReportContractVersion({ contractVersion: "1" }),
    /positive integer/
  );
  assert.equal(validateMotionAssetAuditReportV1({ contractVersion: "1" }).valid, false);
});

test("accepts additive optional fields without changing v1 semantics", async () => {
  const fixture = await fixtureValue();
  fixture.optionalClientMetadata = { source: "compatibility-test" };

  const parsed = parseMotionAssetAuditReportV1(JSON.stringify(fixture));
  assert.deepEqual(
    (parsed as unknown as Record<string, unknown>).optionalClientMetadata,
    { source: "compatibility-test" }
  );
});

async function fixtureValue(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(fixturePath(), "utf8")) as Record<string, unknown>;
}

function fixturePath(): string {
  return fileURLToPath(new URL(
    "../../src/tests/fixtures/motion-asset-audit-report-v1.json",
    import.meta.url
  ));
}
