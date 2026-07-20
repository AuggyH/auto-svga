import assert from "node:assert/strict";
import test from "node:test";
import {
  createP6ParityArtifactBinding,
  P6_PARITY_SECTION_IDS,
  parseP6ParityReportV1,
  validateP6ParityReportV1,
  type P6ArtifactIndexReport,
  type P6ParityRuntimeItemEvidence,
  type P6ParityReportV1,
  type P6ParitySectionBase,
  type P6ParitySectionId
} from "../workbench/p6-parity-report-contract.js";

test("P6 parity contract enumerates every required report schema", () => {
  assert.deepEqual(P6_PARITY_SECTION_IDS, [
    "feature_parity",
    "visual_parity",
    "interaction_parity",
    "state_parity",
    "motion_parity",
    "browser_regression",
    "desktop_runtime_proof",
    "security_audit",
    "accessibility_report",
    "artifact_index"
  ]);
});

test("validates a complete fail report without claiming parity pass", () => {
  const report = fixtureReport();
  const validation = validateP6ParityReportV1(report);

  assert.deepEqual(validation, { valid: true, errors: [] });
  assert.equal(report.sections.featureParity.status, "fail");
  assert.equal(parseP6ParityReportV1(JSON.stringify(report)).source.branch, "agent/codex/p6-a4-parity-tests");
});

test("validates a complete pass report with artifact-bound final evidence", () => {
  const report = fixtureReport(true);
  const sectionNames = [
    "featureParity",
    "visualParity",
    "interactionParity",
    "stateParity",
    "motionParity",
    "browserRegression",
    "desktopRuntimeProof",
    "securityAudit",
    "accessibilityReport",
    "artifactIndex"
  ] as const;

  for (const sectionName of sectionNames) {
    assert.equal(report.sections[sectionName].status, "pass");
    assert.ok(report.sections[sectionName].evidence.every((evidence) => evidence.status === "pass"));
    assert.ok(report.sections[sectionName].evidence.every((evidence) => evidence.artifactIds.length > 0));
    assert.ok(report.sections[sectionName].items.every((item) => item.status === "pass"));
  }

  assert.deepEqual(validateP6ParityReportV1(report), { valid: true, errors: [] });
  assert.equal(parseP6ParityReportV1(JSON.stringify(report)).sections.desktopRuntimeProof.status, "pass");
});

test("rejects missing sections and mismatched section identities", () => {
  const report = fixtureReport() as unknown as Record<string, unknown>;
  const sections = report.sections as Record<string, unknown>;
  sections.visualParity = { ...(sections.visualParity as Record<string, unknown>), id: "motion_parity" };
  delete sections.stateParity;

  const validation = validateP6ParityReportV1(report);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("sections.visualParity.id must equal visual_parity"));
  assert.ok(validation.errors.includes("sections.stateParity must be an object"));
});

test("enforces deterministic required evidence counts", () => {
  const report = fixtureReport();
  report.sections.motionParity = {
    ...report.sections.motionParity,
    requiredEvidenceCount: 2,
    evidence: report.sections.motionParity.evidence.slice(0, 1)
  };

  const validation = validateP6ParityReportV1(report);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("sections.motionParity.evidence has 1, requires 2"));
});

test("rejects silent inventory shrink unless the report records an explicit reason", () => {
  const previousReport = fixtureReport();
  const report = fixtureReport();
  previousReport.sections.featureParity = section("feature_parity", ["import", "playback"]);
  report.sections.featureParity = section("feature_parity", ["import"]);

  const blocked = validateP6ParityReportV1(report, { previousReport });
  assert.equal(blocked.valid, false);
  assert.ok(blocked.errors.includes("sections.featureParity.inventory silently shrank from 2 to 1"));

  report.allowedInventoryShrink = [{
    sectionId: "feature_parity",
    previousItemCount: 2,
    currentItemCount: 1,
    reason: "A1 removed a duplicate checklist row during integration."
  }];
  assert.deepEqual(validateP6ParityReportV1(report, { previousReport }), { valid: true, errors: [] });
});

test("creates artifact hash bindings and checks manifest references", () => {
  const binding = createP6ParityArtifactBinding({
    id: "browser-matrix",
    path: "artifacts/p6/browser-matrix.json",
    role: "browser_regression",
    bytes: new TextEncoder().encode("browser matrix"),
    mediaType: "application/json"
  });

  assert.equal(binding.sizeBytes, 14);
  assert.equal(binding.sha256, "018a0d13d35cc9861efc273985e9814ff438714f1f133389ba34a2eac7aa7de7");

  const report = fixtureReport();
  report.sections.artifactIndex = artifactIndex([binding], ["browser-matrix"]);
  assert.deepEqual(validateP6ParityReportV1(report), { valid: true, errors: [] });

  report.sections.artifactIndex.manifests = [{
    id: "bad-manifest",
    artifactIds: ["missing-artifact"],
    sha256: "not-a-hash"
  }];
  const validation = validateP6ParityReportV1(report);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("sections.artifactIndex.manifests[0].sha256 must be a sha256 hex string"));
  assert.ok(validation.errors.includes("sections.artifactIndex.manifests[0].artifactIds references unknown artifact missing-artifact"));
});

test("rejects evidence in any parity section that references missing artifacts", () => {
  const report = fixtureReport();
  report.sections.featureParity = {
    ...report.sections.featureParity,
    evidence: [{
      id: "feature-evidence",
      status: "partial",
      artifactIds: ["missing-feature-artifact"],
      summary: "Feature parity evidence references a missing artifact."
    }]
  };

  const validation = validateP6ParityReportV1(report);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes(
    "sections.featureParity.evidence[0].artifactIds references unknown artifact missing-feature-artifact"
  ));
});

test("rejects item status that is not derived from checks", () => {
  const report = fixtureReport(true);
  report.sections.featureParity.items = [{
    ...report.sections.featureParity.items[0],
    status: "pass",
    checks: [{ ...report.sections.featureParity.items[0].checks[0], passed: false }],
    failures: ["runtime-check"]
  }];

  const validation = validateP6ParityReportV1(report);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes(
    "sections.featureParity.items[0].status must be derived from checks.every(check => check.passed)"
  ));
});

test("rejects generic artifact blanket binding on item evidence", () => {
  const report = fixtureReport(true);
  const extraArtifact = createP6ParityArtifactBinding({
    id: "desktop-proof",
    path: "artifacts/p6/desktop-proof.json",
    role: "desktop_runtime_proof",
    bytes: new TextEncoder().encode("desktop proof")
  });
  report.sections.artifactIndex = artifactIndex([
    ...report.sections.artifactIndex.artifacts,
    extraArtifact
  ], ["feature-inventory"], true);
  const allArtifactIds = report.sections.artifactIndex.artifacts.map((artifact) => artifact.id);
  report.sections.featureParity.items = [{
    ...report.sections.featureParity.items[0],
    webEvidence: {
      ...report.sections.featureParity.items[0].webEvidence,
      artifactIds: allArtifactIds
    }
  }];

  const validation = validateP6ParityReportV1(report);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes(
    "sections.featureParity.items[0].webEvidence.artifactIds must not bind every artifact generically"
  ));
});

function fixtureReport(pass = false): P6ParityReportV1 {
  const artifact = createP6ParityArtifactBinding({
    id: "feature-inventory",
    path: "artifacts/p6/feature-inventory.json",
    role: "feature_parity",
    bytes: new TextEncoder().encode("feature inventory")
  });

  return {
    contractVersion: 1,
    generatedAt: "2026-06-22T00:00:00.000Z",
    source: {
      baseCommit: "d16fb380c0ff82b9aca3af58b0335708e0b0ef73",
      headCommit: "d16fb380c0ff82b9aca3af58b0335708e0b0ef73",
      branch: "agent/codex/p6-a4-parity-tests"
    },
    sections: {
      featureParity: section("feature_parity", ["feature-checklist"], pass),
      visualParity: section("visual_parity", ["pixel-reference"], pass),
      interactionParity: section("interaction_parity", ["keyboard-flow"], pass),
      stateParity: section("state_parity", ["state-persistence"], pass),
      motionParity: section("motion_parity", ["frame-timing"], pass),
      browserRegression: section("browser_regression", ["viewport-matrix"], pass),
      desktopRuntimeProof: section("desktop_runtime_proof", ["electron-smoke"], pass),
      securityAudit: section("security_audit", ["csp-review"], pass),
      accessibilityReport: section("accessibility_report", ["axe-keyboard"], pass),
      artifactIndex: artifactIndex([artifact], ["feature-inventory"], pass)
    }
  };
}

function section<TId extends Exclude<P6ParitySectionId, "artifact_index">>(
  id: TId,
  itemIds: readonly string[],
  pass = false
): P6ParitySectionBase<TId> {
  const items = itemIds.map((itemId) => runtimeItem(itemId, pass));
  const status = pass ? "pass" : "fail";
  return {
    id,
    status,
    requiredEvidenceCount: 1,
    items,
    evidence: [{
      id: `${id}-evidence`,
      status,
      artifactIds: pass ? ["feature-inventory"] : [],
      summary: pass
        ? `${id} final integration evidence is hash-bound.`
        : `${id} fails closed until runtime evidence passes.`
    }],
    inventory: {
      itemCount: itemIds.length,
      itemIds
    }
  };
}

function artifactIndex(
  artifacts: P6ArtifactIndexReport["artifacts"],
  manifestArtifactIds: readonly string[],
  pass = false
): P6ArtifactIndexReport {
  const status = pass ? "pass" : "fail";
  const items = artifacts.map((artifact) => runtimeItem(artifact.id, pass, [artifact.id]));
  return {
    id: "artifact_index",
    status,
    requiredEvidenceCount: 1,
    items,
    evidence: [{
      id: "artifact-index-evidence",
      status,
      artifactIds: manifestArtifactIds,
      summary: status === "pass"
        ? "Artifact inventory is hash-bound for final integration evidence."
        : "Artifact inventory is hash-bound for final integration evidence."
    }],
    inventory: {
      itemCount: artifacts.length,
      itemIds: artifacts.map(({ id }) => id)
    },
    artifacts,
    manifests: [{
      id: "manifest",
      artifactIds: manifestArtifactIds,
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }]
  };
}

function runtimeItem(
  id: string,
  pass: boolean,
  artifactIds: readonly string[] = pass ? ["feature-inventory"] : []
): P6ParityRuntimeItemEvidence {
  return {
    id,
    required: true,
    status: pass ? "pass" : "fail",
    checks: [{
      id: "runtime-check",
      passed: pass,
      artifactIds,
      summary: "Runtime item check is derived from evidence."
    }],
    webEvidence: {
      artifactIds,
      summary: "Web evidence is item-specific."
    },
    desktopEvidence: {
      artifactIds,
      summary: "Desktop evidence is item-specific."
    },
    comparisonEvidence: {
      artifactIds,
      summary: "Comparison evidence is item-specific."
    },
    sharedSourceEvidence: {
      artifactIds: [],
      summary: "Shared source evidence is hash-checked."
    },
    failures: pass ? [] : ["runtime-check"]
  };
}
