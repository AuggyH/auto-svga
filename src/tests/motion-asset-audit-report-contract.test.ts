import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  MOTION_ASSET_AUDIT_REPORT_CONTRACT_VERSION,
  parseMotionAssetAuditReportV1,
  serializeMotionAssetAuditReportV1,
  validateMotionAssetAuditReportV1
} from "../workbench/motion-asset-audit-report-contract.js";

test("validates and parses the representative v1 fixture", async () => {
  const serialized = await readFixture();
  const value = JSON.parse(serialized) as unknown;
  const validation = validateMotionAssetAuditReportV1(value);

  assert.deepEqual(validation, { valid: true, errors: [] });
  const parsed = parseMotionAssetAuditReportV1(serialized);
  assert.equal(parsed.contractVersion, MOTION_ASSET_AUDIT_REPORT_CONTRACT_VERSION);
  assert.equal(parsed.profileId, "production_target");
  assert.equal(parsed.auditSummary.auditStatus, "needs_review");
  assert.equal(parsed.auditPresentation.statusLabel, "audit.status.needs_review");
  assert.equal(parsed.auditPresentation.opportunityCards[0].actionType, "review_only");
});

test("preserves the stable v1 structure through JSON serialization", async () => {
  const parsed = parseMotionAssetAuditReportV1(await readFixture());
  const roundTrip = parseMotionAssetAuditReportV1(
    serializeMotionAssetAuditReportV1(parsed)
  );

  assert.deepEqual(roundTrip, parsed);
});

test("rejects incompatible versions and missing stable sections", async () => {
  const fixture = JSON.parse(await readFixture()) as Record<string, unknown>;
  const wrongVersion = { ...fixture, contractVersion: 2 };
  const missingPresentation = { ...fixture };
  delete missingPresentation.auditPresentation;

  assert.equal(validateMotionAssetAuditReportV1(wrongVersion).valid, false);
  assert.equal(validateMotionAssetAuditReportV1(missingPresentation).valid, false);
  assert.throws(
    () => parseMotionAssetAuditReportV1(JSON.stringify(wrongVersion)),
    /Unsupported Motion Asset Audit report contract version: 2/
  );
});

test("rejects executable opportunity actions in the read-only contract", async () => {
  const fixture = JSON.parse(await readFixture()) as Record<string, unknown>;
  const presentation = structuredClone(fixture.auditPresentation) as Record<string, unknown>;
  const cards = structuredClone(presentation.opportunityCards) as Array<Record<string, unknown>>;
  cards[0].actionType = "auto_fix";
  presentation.opportunityCards = cards;
  fixture.auditPresentation = presentation;

  const validation = validateMotionAssetAuditReportV1(fixture);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes("actionType must equal review_only")));
});

async function readFixture(): Promise<string> {
  return readFile(fixturePath(), "utf8");
}

function fixturePath(): string {
  return fileURLToPath(new URL(
    "../../src/tests/fixtures/motion-asset-audit-report-v1.json",
    import.meta.url
  ));
}
