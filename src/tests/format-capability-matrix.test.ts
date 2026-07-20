import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertSupportedCapabilityMatrixVersion,
  collectCapabilityMatrixWarnings,
  getCurrentCapabilityMatrixVersion,
  getSupportedCapabilityMatrixVersions,
  validateFormatCapabilityMatrix
} from "../workbench/format-capability-matrix.js";
import {
  createFormatRecommendationReport,
  FORMAT_RECOMMENDATION_CAPABILITY_MATRIX_DOCUMENT,
  type FormatCapabilityMatrixDocument
} from "../workbench/format-recommendation.js";
import { recommendationInput } from "./helpers/format-recommendation-fixture.js";

test("accepts current capability matrix version 1", () => {
  assert.equal(getCurrentCapabilityMatrixVersion(), 1);
  assert.deepEqual(getSupportedCapabilityMatrixVersions(), [1]);
  assert.doesNotThrow(() => assertSupportedCapabilityMatrixVersion(1));
  assert.equal(validateFormatCapabilityMatrix(FORMAT_RECOMMENDATION_CAPABILITY_MATRIX_DOCUMENT).valid, true);
});

test("rejects unknown capability matrix versions", () => {
  assert.throws(() => assertSupportedCapabilityMatrixVersion(2), /Unsupported capability matrix version/);
  const result = validateFormatCapabilityMatrix({
    ...FORMAT_RECOMMENDATION_CAPABILITY_MATRIX_DOCUMENT,
    capabilityMatrixVersion: 2
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(({ code }) => code === "unsupported_capability_matrix_version"));
});

test("rejects missing evidence and maturity metadata", () => {
  const missingEvidence = cloneMatrix();
  delete (missingEvidence.formats.vap as unknown as Record<string, unknown>).evidence;
  assert.ok(validateFormatCapabilityMatrix(missingEvidence).errors.some(
    ({ code, path }) => code === "missing_capability_evidence" && path === "formats.vap.evidence"
  ));

  const missingMaturity = cloneMatrix();
  delete (missingMaturity.formats.lottie as unknown as Record<string, unknown>).implementationMaturity;
  assert.ok(validateFormatCapabilityMatrix(missingMaturity).errors.some(
    ({ code, path }) => code === "missing_implementation_maturity" && path === "formats.lottie.implementationMaturity"
  ));
});

test("warns when capability is known but implementation is unavailable", () => {
  const warnings = collectCapabilityMatrixWarnings(FORMAT_RECOMMENDATION_CAPABILITY_MATRIX_DOCUMENT);
  assert.ok(warnings.some(
    ({ code, path }) => code === "implementation_unavailable" && path === "formats.lottie"
  ));
});

test("stale evidence warns without becoming a production recommendation", () => {
  const stale = cloneMatrix();
  stale.formats.lottie.evidence[0].reviewEpoch = 0;
  const validation = validateFormatCapabilityMatrix(stale);
  assert.equal(validation.valid, true);
  assert.ok(validation.warnings.some(
    ({ code, path }) => code === "stale_capability_evidence" && path.startsWith("formats.lottie")
  ));

  const report = createFormatRecommendationReport(recommendationInput({
    capabilityMatrixDocument: stale
  }));
  const lottie = report.candidateFormats.find(({ format }) => format === "lottie");
  assert.equal(lottie?.productionSupport, "not_supported");
  assert.equal(lottie?.status, "needs_more_data");
  assert.match(lottie?.rationale.join(" ") ?? "", /older than the current review epoch/);
});

test("keeps matrix validation host-neutral and deterministic", async () => {
  const source = await readFile(
    new URL("../../src/workbench/format-capability-matrix.ts", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /from\s+["']node:|globalThis\.document|window\.|Date\.now|new Date|fetch\(|readFile|writeFile|https?:\/\//
  );
});

function cloneMatrix(): FormatCapabilityMatrixDocument {
  return structuredClone(FORMAT_RECOMMENDATION_CAPABILITY_MATRIX_DOCUMENT);
}
