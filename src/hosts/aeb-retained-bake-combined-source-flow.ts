import { createHash } from "node:crypto";
import type {
  AebFormatNeutralIr,
  AebPublishedSuccessorPackage
} from "../workbench/aeb-bake-contracts.js";
import { AebBakePipelineError, buildAebBakeManifest } from "../workbench/aeb-bake-pipeline.js";
import { reinsertAebBakePackage } from "../workbench/aeb-package-reinsertion.js";
import type {
  AebRetainedBakeAuthorityChainReceipt,
  CreateAebRetainedBakeAuthorityChainInput
} from "../workbench/aeb-retained-bake-authority-chain.js";
import { createAebRetainedBakeAuthorityChain } from "../workbench/aeb-retained-bake-authority-chain.js";
import { createSvgaAebBakeAdapterInput } from "../workbench/svga/aeb-bake-adapter.js";
import type { EmbeddedResourceHasher } from "../workbench/resource-hasher.js";
import { NodeAebBakePackagePublisher } from "./aeb-node-bake-package-publisher.js";
import {
  NodeAebBakeResourceReader,
  NodeAebTaskRootAuthority,
  type AebBoundedTaskFile
} from "./aeb-node-bake-resource-reader.js";
import type { AebBoundedAeBakeExecutionResult } from "./aeb-node-bounded-ae-bake-executor.js";
import {
  NodeAebRetainedBakeSvgaFragmentPublisher,
  type AebRetainedBakeSvgaFragmentSourceProbe
} from "./aeb-node-retained-bake-svga-fragment-publisher.js";
import {
  NodeAebRetainedBakeFullCompositionPublisher,
  type AebRetainedBakeFullCompositionResult
} from "./aeb-retained-bake-full-composition-publisher.js";
import {
  createAebRetainedBakeSvgaFragmentOracleReport,
  type AebRetainedBakeSvgaFragmentOracleReport
} from "./aeb-retained-bake-svga-fragment-oracle.js";

export const AEB_RETAINED_BAKE_COMBINED_SOURCE_FLOW_SCHEMA_VERSION =
  "aeb-retained-bake-combined-source-flow-v2" as const;

export interface AebRetainedBakeCombinedSourceFlowInput {
  execution: AebBoundedAeBakeExecutionResult;
  sourceIr: AebFormatNeutralIr;
  successorFileName: string;
  hasher: EmbeddedResourceHasher;
}

export interface AebRetainedBakeCombinedSourceFlowReport {
  schemaVersion: typeof AEB_RETAINED_BAKE_COMBINED_SOURCE_FLOW_SCHEMA_VERSION;
  authorityState: "source_validated_combined_bake_host_session_ready";
  taskId: string;
  executionId: string;
  jobId: string;
  packageId: string;
  sourceFingerprint: string;
  planHash: string;
  chainHash: string;
  manifestId: string;
  packageBundleId: string;
  classification: {
    nativeLayerIds: readonly string[];
    bakeRequiredLayerIds: readonly string[];
    blockedLayerIds: readonly string[];
    preservedReplaceableElementIds: readonly string[];
  };
  package: {
    sourceProjectContentHash: string;
    sourceProjectIdentityDigest: string;
    sourcePackageContentHash: string;
    successorPackageRelativePath: string;
    successorPackageContentHash: string;
    sourceProjectUnchanged: true;
    sourcePackageUnchanged: true;
    physicalSuccessorReopened: true;
    f1ReinsertionValidated: true;
  };
  fragment: {
    relativePath: string;
    encodedBytes: number;
    contentHash: string;
    identityDigest: string;
    sourceProbeHash: string;
    oracleReportHash: string;
    standardsValidSvgaFragment: true;
    nativeMergeRequired: true;
    fullCompositionEncoded: false;
  };
  fullComposition: AebRetainedBakeFullCompositionResult;
  authority: {
    actualBakeAuthorityMinted: false;
    runtimeProved: false;
    realPreviewValidated: false;
    saveAsBytesAuthorized: false;
    installedQaAccepted: false;
    productOwnerAccepted: false;
  };
  evidence: {
    sourceProbe: AebRetainedBakeSvgaFragmentSourceProbe;
    oracle: AebRetainedBakeSvgaFragmentOracleReport;
  };
  reportHash: string;
}

interface VerifiedReportState {
  chainInput: CreateAebRetainedBakeAuthorityChainInput;
  packagePublisher: NodeAebBakePackagePublisher;
  fragmentPublisher: NodeAebRetainedBakeSvgaFragmentPublisher;
  fullCompositionPublisher: NodeAebRetainedBakeFullCompositionPublisher;
}

export class NodeAebRetainedBakeCombinedSourceFlow {
  private readonly verifiedReports = new WeakMap<AebRetainedBakeCombinedSourceFlowReport, VerifiedReportState>();

  constructor(private readonly authority: NodeAebTaskRootAuthority) {}

  async run(
    input: AebRetainedBakeCombinedSourceFlowInput
  ): Promise<AebRetainedBakeCombinedSourceFlowReport> {
    validateExecutionBoundary(this.authority, input);
    const { execution, hasher } = input;
    const { plan } = execution;
    const reader = new NodeAebBakeResourceReader(this.authority);
    let packagePublisher: NodeAebBakePackagePublisher | undefined;
    let published: AebPublishedSuccessorPackage | undefined;
    let fragmentPublisher: NodeAebRetainedBakeSvgaFragmentPublisher | undefined;
    let sourceProbe: AebRetainedBakeSvgaFragmentSourceProbe | undefined;
    let fullCompositionPublisher: NodeAebRetainedBakeFullCompositionPublisher | undefined;
    let fullComposition: AebRetainedBakeFullCompositionResult | undefined;
    let chainInput: CreateAebRetainedBakeAuthorityChainInput | undefined;
    let chainReceipt: AebRetainedBakeAuthorityChainReceipt | undefined;
    try {
      const manifest = await buildAebBakeManifest({
        job: plan.job,
        planner: plan.planner,
        taskReceipt: plan.taskReceipt,
        frames: execution.frames,
        executionReceipt: execution.executionReceipt,
        executionAuthority: execution.executionAuthority,
        reader,
        hasher
      });
      const bundle = await reinsertAebBakePackage(
        input.sourceIr,
        manifest,
        hasher,
        execution.executionAuthority
      );
      packagePublisher = new NodeAebBakePackagePublisher(
        this.authority,
        {},
        execution.executionAuthority
      );
      published = await packagePublisher.publish({
        bundle,
        sourcePackageRelativePath: plan.sourceFiles.packageRelativePath,
        expectedSourcePackageHash: plan.sourceFiles.packageContentHash,
        successorFileName: input.successorFileName,
        maxSourcePackageBytes: plan.sourceFiles.packageMaxBytes,
        maxSuccessorPackageBytes: plan.job.budgets.maxPackageBytes,
        hasher
      });
      const adapterInput = await createSvgaAebBakeAdapterInput(
        published,
        hasher,
        packagePublisher,
        execution.executionAuthority
      );
      chainInput = {
        plan,
        producerReceipt: execution.producerReceipt,
        cleanupReceipt: execution.cleanupReceipt,
        executionReceipt: execution.executionReceipt,
        executionAuthority: execution.executionAuthority,
        manifest,
        published,
        publicationAuthority: packagePublisher,
        adapterInput,
        hasher
      };
      validateClassificationBoundary(chainInput);
      chainReceipt = await createAebRetainedBakeAuthorityChain(chainInput);
      fragmentPublisher = new NodeAebRetainedBakeSvgaFragmentPublisher(this.authority);
      sourceProbe = await fragmentPublisher.publishSourceProbe({ chainReceipt, chainInput });
      const oracle = await createAebRetainedBakeSvgaFragmentOracleReport(
        this.authority,
        { chainReceipt, chainInput },
        sourceProbe
      );
      if (!await fragmentPublisher.verifySourceProbe(sourceProbe, { chainReceipt, chainInput })) {
        fail(
          "AE_RETAINED_COMBINED_FINAL_REBIND_FAILED",
          "Combined retained Bake source flow could not rebind its physical output after validation."
        );
      }
      fullCompositionPublisher = new NodeAebRetainedBakeFullCompositionPublisher(this.authority);
      fullComposition = await fullCompositionPublisher.publish({
        chainReceipt,
        chainInput,
        sourceIr: input.sourceIr
      });
      const sourceProject = await verifySourceProject(this.authority, chainInput);
      const report = createReport(
        chainReceipt,
        chainInput,
        sourceProject,
        sourceProbe,
        oracle,
        fullComposition
      );
      this.verifiedReports.set(report, {
        chainInput,
        packagePublisher,
        fragmentPublisher,
        fullCompositionPublisher
      });
      return report;
    } catch (error) {
      let rollbackFailed = false;
      if (fullComposition && fullCompositionPublisher) {
        rollbackFailed = !await fullCompositionPublisher.revoke(fullComposition);
      }
      if (sourceProbe && fragmentPublisher && chainInput && chainReceipt) {
        rollbackFailed = !await fragmentPublisher.revokeSourceProbe(
          sourceProbe,
          { chainReceipt, chainInput }
        ) || rollbackFailed;
      }
      if (published && packagePublisher) {
        rollbackFailed = !await packagePublisher.revokePublishedSuccessor(published) || rollbackFailed;
      }
      if (rollbackFailed) {
        fail(
          "AE_RETAINED_COMBINED_ROLLBACK_FAILED",
          "Combined retained Bake source flow could not prove removal of its task-owned partial outputs."
        );
      }
      throw error;
    }
  }

  async verify(report: AebRetainedBakeCombinedSourceFlowReport): Promise<boolean> {
    try {
      const state = this.verifiedReports.get(report);
      if (!state) return false;
      const { chainInput, packagePublisher, fragmentPublisher, fullCompositionPublisher } = state;
      const chainReceipt = await createAebRetainedBakeAuthorityChain(chainInput);
      if (!await packagePublisher.verifyPublishedSuccessor(chainInput.published, chainInput.hasher)
        || !await fragmentPublisher.verifySourceProbe(
          report.evidence.sourceProbe,
          { chainReceipt, chainInput }
        )
        || !await fullCompositionPublisher.verify(report.fullComposition)) {
        return false;
      }
      const oracle = await createAebRetainedBakeSvgaFragmentOracleReport(
        this.authority,
        { chainReceipt, chainInput },
        report.evidence.sourceProbe
      );
      const sourceProject = await verifySourceProject(this.authority, chainInput);
      return sameJson(
        report,
        createReport(
          chainReceipt,
          chainInput,
          sourceProject,
          report.evidence.sourceProbe,
          oracle,
          report.fullComposition
        )
      );
    } catch {
      return false;
    }
  }
}

async function verifySourceProject(
  authority: NodeAebTaskRootAuthority,
  input: CreateAebRetainedBakeAuthorityChainInput
): Promise<AebBoundedTaskFile> {
  const sourceProject = await authority.readBoundedTaskFile(
    input.plan.sourceFiles.projectRelativePath,
    input.plan.sourceFiles.projectMaxBytes,
    "SOURCE_PROJECT"
  );
  if (sha256Bytes(sourceProject.bytes) !== input.plan.sourceFiles.projectContentHash
    || sourceProject.identityDigest !== input.producerReceipt.source.project.postIdentityDigest) {
    fail(
      "AE_RETAINED_COMBINED_SOURCE_PROJECT_CHANGED",
      "Combined retained Bake source flow detected source-project drift at its final boundary."
    );
  }
  return sourceProject;
}

function createReport(
  chainReceipt: AebRetainedBakeAuthorityChainReceipt,
  chainInput: CreateAebRetainedBakeAuthorityChainInput,
  sourceProject: AebBoundedTaskFile,
  sourceProbe: AebRetainedBakeSvgaFragmentSourceProbe,
  oracle: AebRetainedBakeSvgaFragmentOracleReport,
  fullComposition: AebRetainedBakeFullCompositionResult
): AebRetainedBakeCombinedSourceFlowReport {
  const classification = classificationFor(chainInput);
  const unsigned: Omit<AebRetainedBakeCombinedSourceFlowReport, "reportHash"> = {
    schemaVersion: AEB_RETAINED_BAKE_COMBINED_SOURCE_FLOW_SCHEMA_VERSION,
    authorityState: "source_validated_combined_bake_host_session_ready",
    taskId: chainReceipt.taskId,
    executionId: chainReceipt.executionId,
    jobId: chainReceipt.jobId,
    packageId: chainReceipt.packageId,
    sourceFingerprint: chainReceipt.sourceFingerprint,
    planHash: chainReceipt.planHash,
    chainHash: chainReceipt.chainHash,
    manifestId: chainReceipt.manifestId,
    packageBundleId: chainReceipt.packageBundleId,
    classification,
    package: {
      sourceProjectContentHash: chainInput.plan.sourceFiles.projectContentHash,
      sourceProjectIdentityDigest: sourceProject.identityDigest,
      sourcePackageContentHash: oracle.sourcePackage.contentHash,
      successorPackageRelativePath: oracle.successorPackage.relativePath,
      successorPackageContentHash: oracle.successorPackage.contentHash,
      sourceProjectUnchanged: true,
      sourcePackageUnchanged: true,
      physicalSuccessorReopened: true,
      f1ReinsertionValidated: true
    },
    fragment: {
      relativePath: oracle.fragment.relativePath,
      encodedBytes: oracle.fragment.encodedBytes,
      contentHash: oracle.fragment.contentHash,
      identityDigest: oracle.fragment.identityDigest,
      sourceProbeHash: oracle.sourceProbeHash,
      oracleReportHash: oracle.reportHash,
      standardsValidSvgaFragment: true,
      nativeMergeRequired: true,
      fullCompositionEncoded: false
    },
    fullComposition,
    authority: {
      actualBakeAuthorityMinted: false,
      runtimeProved: false,
      realPreviewValidated: false,
      saveAsBytesAuthorized: false,
      installedQaAccepted: false,
      productOwnerAccepted: false
    },
    evidence: { sourceProbe, oracle }
  };
  return { ...unsigned, reportHash: sha256Canonical(unsigned) };
}

function validateExecutionBoundary(
  authority: NodeAebTaskRootAuthority,
  input: AebRetainedBakeCombinedSourceFlowInput
): void {
  const { execution, sourceIr } = input;
  const plan = execution.plan;
  const plannerOutcomes = new Map(plan.planner.decisions.map((item) => [item.layerId, item.outcome]));
  const protectedIds = sourceIr.layers.flatMap((layer) => layer.replaceableElementIds);
  if (authority.taskId !== plan.job.task.taskId
    || sourceIr.packageId !== plan.job.packageId
    || !sameJson(sourceIr.source, plan.job.source)
    || sourceIr.layers.length !== plan.planner.decisions.length
    || sourceIr.layers.some((layer) => plannerOutcomes.get(layer.layerId) !== layer.plannerOutcome)
    || sourceIr.layers.some((layer) => layer.plannerOutcome === "bake_required"
      && layer.replaceableElementIds.length > 0)
    || protectedIds.length === 0
    || new Set(protectedIds).size !== protectedIds.length
    || plan.job.target.replaceableElementIds.length !== 0
    || execution.producerReceipt.source.project.unchanged !== true
    || execution.producerReceipt.source.project.preIdentityDigest
      !== execution.producerReceipt.source.project.postIdentityDigest
    || execution.producerReceipt.source.package.unchanged !== true
    || execution.producerReceipt.source.package.preIdentityDigest
      !== execution.producerReceipt.source.package.postIdentityDigest) {
    fail(
      "AE_RETAINED_COMBINED_EXECUTION_INPUT_INVALID",
      "Combined retained Bake source flow requires exact classification, replaceable protection, and source immutability."
    );
  }
}

function validateClassificationBoundary(input: CreateAebRetainedBakeAuthorityChainInput): void {
  const classification = classificationFor(input);
  const nativePackageLayerIds = input.published.bundle.preservedNativeLayers
    .map((layer) => layer.layerId)
    .sort(compareCodeUnits);
  const bakedPackageLayerIds = (input.published.bundle.bakedSequences[0]?.replacesLayerIds ?? [])
    .slice()
    .sort(compareCodeUnits);
  const protectedIds = input.published.bundle.preservedNativeLayers
    .flatMap((layer) => layer.replaceableElementIds)
    .sort(compareCodeUnits);
  if (!sameJson(classification.nativeLayerIds, nativePackageLayerIds)
    || !sameJson(classification.bakeRequiredLayerIds, bakedPackageLayerIds)
    || !sameJson(classification.preservedReplaceableElementIds, protectedIds)
    || classification.preservedReplaceableElementIds.length === 0
    || input.published.bundle.validation.replaceableElementsPreserved !== true
    || input.published.bundle.validation.packageReinsertionValidated !== true
    || input.published.publicationReceipt.sourcePackage.unchanged !== true
    || input.published.publicationReceipt.sourcePackage.preIdentityDigest
      !== input.published.publicationReceipt.sourcePackage.postIdentityDigest) {
    fail(
      "AE_RETAINED_COMBINED_CLASSIFICATION_INVALID",
      "Combined retained Bake source flow rejected a stale classification or package reinsertion."
    );
  }
}

function classificationFor(
  input: CreateAebRetainedBakeAuthorityChainInput
): AebRetainedBakeCombinedSourceFlowReport["classification"] {
  const decisions = input.plan.planner.decisions.slice()
    .sort((left, right) => compareCodeUnits(left.layerId, right.layerId));
  return {
    nativeLayerIds: decisions.filter((item) => item.outcome === "native").map((item) => item.layerId),
    bakeRequiredLayerIds: decisions.filter((item) => item.outcome === "bake_required").map((item) => item.layerId),
    blockedLayerIds: decisions.filter((item) => item.outcome === "blocked").map((item) => item.layerId),
    preservedReplaceableElementIds: input.published.bundle.preservedNativeLayers
      .flatMap((layer) => layer.replaceableElementIds)
      .sort(compareCodeUnits)
  };
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
