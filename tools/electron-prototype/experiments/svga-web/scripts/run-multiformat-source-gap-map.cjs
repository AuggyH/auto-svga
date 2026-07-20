"use strict";

const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { mkdirSync, mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  PRODUCT_MILESTONE_ID,
  TASK_RUNTIME_FIXTURE_ALIASES,
  TASK_RUNTIME_ORACLE_PHASES,
  assertNoRawPathLeak,
  assertTaskRuntimeFixtureContract,
  createTaskRuntimeFixtureSet,
  sha256Text
} = require("./multiformat-task-runtime-fixtures.cjs");

const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "../../../..");
const proofRoot = process.env.AUTO_SVGA_SOURCE_GAP_MAP_ROOT && path.isAbsolute(process.env.AUTO_SVGA_SOURCE_GAP_MAP_ROOT)
  ? path.normalize(process.env.AUTO_SVGA_SOURCE_GAP_MAP_ROOT)
  : mkdtempSync(path.join(os.tmpdir(), "auto-svga-multiformat-source-gap-map-"));
const proofPath = path.join(proofRoot, "multiformat-source-gap-map.json");

const ROW_STATUS = Object.freeze({
  SOURCE_CLOSED: "source_closed",
  SOURCE_CLOSED_PENDING_REVIEW: "source_closed_pending_review",
  RUNTIME_QA_REQUIRED: "runtime_or_owner_material_qa_required"
});

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

function main() {
  mkdirSync(proofRoot, { recursive: true });
  const fixtureRoot = path.join(proofRoot, "fixtures");
  const fixtureSet = createTaskRuntimeFixtureSet({ root: fixtureRoot });
  const fixtureContract = assertTaskRuntimeFixtureContract({ root: fixtureRoot });
  const sourceGapMap = buildSourceGapMap({
    sourceHead: gitHead(),
    fixtureContract,
    sourceAssertions: readSourceAssertionEvidence()
  });
  validateSourceGapMap(sourceGapMap);
  assertNoRawPathLeak(sourceGapMap, Object.values(fixtureSet.files));
  writeFileSync(proofPath, `${JSON.stringify(sourceGapMap, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({
    proofPath,
    sha256: sha256File(proofPath),
    status: sourceGapMap.status
  })}\n`);
}

function buildSourceGapMap({ sourceHead, fixtureContract, sourceAssertions }) {
  const taskFixtureHash = sha256Text(JSON.stringify(fixtureContract.fixtureHashes));
  const requiredPhasesHash = sha256Text(TASK_RUNTIME_ORACLE_PHASES.join("|"));
  return {
    schemaVersion: 1,
    status: "passed",
    productMilestoneId: PRODUCT_MILESTONE_ID,
    sourceHead,
    pathRedacted: true,
    reportToken: "multiformat-source-gap-map",
    sourceAssertions,
    rows: [{
      id: "external_image_lottie_task_fixture_source_oracle",
      format: "lottie",
      status: ROW_STATUS.SOURCE_CLOSED,
      sourceEvidence: {
        alias: TASK_RUNTIME_FIXTURE_ALIASES.lottie,
        fixtureHash: taskFixtureHash,
        requiredPhasesHash,
        proves: [
          "open reaches playing",
          "OwnerRightPanelSnapshotV1 image/text targets are exact",
          "adjacent external image is inlined into prepared Lottie runtime payload",
          "image and text replacement reach prepared runtime payload",
          "target Reset restores source payload and preserves sibling state"
        ]
      },
      installedMatrixReadiness: {
        sourceSideClosed: true,
        requiresRuntimeOrOwnerMaterialQa: true,
        reason: "source fixture proves the model/oracle contract; installed QA must still bind real material and runtime pixels"
      }
    }, {
      id: "fusion_capable_vap_task_fixture_source_oracle",
      format: "vap",
      status: ROW_STATUS.SOURCE_CLOSED,
      sourceEvidence: {
        alias: TASK_RUNTIME_FIXTURE_ALIASES.vap,
        sidecarAlias: TASK_RUNTIME_FIXTURE_ALIASES.vapSidecar,
        fixtureHash: taskFixtureHash,
        requiredPhasesHash,
        proves: [
          "open reaches playing",
          "OwnerRightPanelSnapshotV1 fusion image/text targets are exact",
          "adjacent vapc source remains preserved and clean at source",
          "public resource ids resolve to canonical runtime fusion keys",
          "image/text replacement and target Reset restore source fusion parameters"
        ]
      },
      installedMatrixReadiness: {
        sourceSideClosed: true,
        requiresRuntimeOrOwnerMaterialQa: true,
        reason: "source fixture proves fusion authority; installed QA must still prove real VAP runtime pixels and owner material"
      }
    }, {
      id: "lottie_vap_cross_source_replacement_isolation",
      format: "lottie+vap",
      status: ROW_STATUS.SOURCE_CLOSED_PENDING_REVIEW,
      sourceEvidence: {
        testNames: [
          "0.2 accepted Lottie and VAP source reopen clears stale renderer replacement authority",
          "0.2 delayed Lottie and VAP Apply completion cannot cross a successful source reopen",
          "0.2 delayed Lottie and VAP image Apply completion cannot publish after source reopen"
        ],
        proves: [
          "new source Open clears stale runtime replacement maps",
          "new source Open clears visible textPreviewValues",
          "delayed text/image Apply completion from source A cannot remount or publish into source B"
        ]
      },
      installedMatrixReadiness: {
        sourceSideClosed: true,
        requiresRuntimeOrOwnerMaterialQa: false,
        reason: "source/controller isolation is covered; queued Code Re-review must approve before downstream Packaging/QA"
      }
    }, {
      id: "distinct_second_dpr_acceptance_artifact",
      format: "desktop-placement",
      status: ROW_STATUS.SOURCE_CLOSED_PENDING_REVIEW,
      sourceEvidence: {
        testNames: [
          "acceptance startup placement proof records distinct-DPR readiness for matrix gating"
        ],
        proves: [
          "accepted and rejected placement proof artifacts expose selected/primary scale factors",
          "distinctFromPrimary classifies the DPR row without foreground screenshots or CGWindow relays"
        ]
      },
      installedMatrixReadiness: {
        sourceSideClosed: true,
        requiresRuntimeOrOwnerMaterialQa: true,
        reason: "future rebuilt installed QA must observe the artifact on real display hardware"
      }
    }, {
      id: "real_external_image_lottie_owner_material",
      format: "lottie",
      status: ROW_STATUS.RUNTIME_QA_REQUIRED,
      sourceEvidence: {
        taskFixtureAlias: TASK_RUNTIME_FIXTURE_ALIASES.lottie,
        proves: [
          "task-owned external-image Lottie source flow is bounded and path-redacted"
        ]
      },
      installedMatrixReadiness: {
        sourceSideClosed: false,
        requiresRuntimeOrOwnerMaterialQa: true,
        reason: "real owner external-image Lottie material path/hash must be bound privately before installed acceptance"
      }
    }, {
      id: "real_fusion_capable_vap_owner_material",
      format: "vap",
      status: ROW_STATUS.RUNTIME_QA_REQUIRED,
      sourceEvidence: {
        taskFixtureAlias: TASK_RUNTIME_FIXTURE_ALIASES.vap,
        proves: [
          "task-owned fusion-capable VAP source flow is bounded and path-redacted"
        ]
      },
      installedMatrixReadiness: {
        sourceSideClosed: false,
        requiresRuntimeOrOwnerMaterialQa: true,
        reason: "real owner fusion-capable VAP material path/hash and runtime pixel proof remain private installed QA evidence"
      }
    }],
    boundaries: {
      sourceOnly: true,
      electronLaunched: false,
      foregroundUsed: false,
      installedAppTouched: false,
      ownerMaterialUsed: false,
      rawPathsPublished: false,
      qaRouted: false,
      packagingRouted: false,
      productAcceptanceClaim: false
    }
  };
}

function validateSourceGapMap(gapMap) {
  if (gapMap?.schemaVersion !== 1 || gapMap?.status !== "passed" || gapMap?.pathRedacted !== true) {
    throw new Error("source gap map header is invalid");
  }
  if (!Array.isArray(gapMap.rows) || gapMap.rows.length === 0) {
    throw new Error("source gap map rows are missing");
  }
  const ids = new Set();
  for (const row of gapMap.rows) {
    if (!row || typeof row.id !== "string" || !row.id.trim()) throw new Error("source gap map row id is invalid");
    if (ids.has(row.id)) throw new Error(`source gap map row id is duplicated: ${row.id}`);
    ids.add(row.id);
    if (!Object.values(ROW_STATUS).includes(row.status)) throw new Error(`source gap map row status is invalid: ${row.id}`);
    if (row.installedMatrixReadiness?.sourceSideClosed !== true && row.status !== ROW_STATUS.RUNTIME_QA_REQUIRED) {
      throw new Error(`source gap map row must be source-closed or runtime-required: ${row.id}`);
    }
    if (row.installedMatrixReadiness?.requiresRuntimeOrOwnerMaterialQa !== true && row.installedMatrixReadiness?.requiresRuntimeOrOwnerMaterialQa !== false) {
      throw new Error(`source gap map row QA readiness is invalid: ${row.id}`);
    }
  }
  for (const required of [
    "external_image_lottie_task_fixture_source_oracle",
    "fusion_capable_vap_task_fixture_source_oracle",
    "lottie_vap_cross_source_replacement_isolation",
    "distinct_second_dpr_acceptance_artifact",
    "real_external_image_lottie_owner_material",
    "real_fusion_capable_vap_owner_material"
  ]) {
    if (!ids.has(required)) throw new Error(`source gap map missing required row: ${required}`);
  }
}

function readSourceAssertionEvidence() {
  return {
    taskFixtureOracleScriptSha256: sha256File(path.join(__dirname, "run-multiformat-task-fixture-source-oracle.cjs")),
    taskFixtureTestSha256: sha256File(path.join(appRoot, "tests/multiformat-task-fixture-source-oracle.test.mjs")),
    openIsolationTestSha256: sha256File(path.join(appRoot, "tests/svga-web-experiment.test.mjs")),
    placementProofTestSha256: sha256File(path.join(appRoot, "tests/short-term-window-placement.test.mjs"))
  };
}

function gitHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

module.exports = {
  ROW_STATUS,
  buildSourceGapMap,
  validateSourceGapMap
};
