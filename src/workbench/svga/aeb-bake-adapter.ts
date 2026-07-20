import type {
  AebBakeExecutionAuthority,
  AebPackagePublicationAuthorityVerifier,
  AebPublishedSuccessorPackage
} from "../aeb-bake-contracts.js";
import { AebBakePipelineError } from "../aeb-bake-pipeline.js";
import { verifyAebPublishedSuccessorPackageIntegrity } from "../aeb-package-reinsertion.js";
import type { EmbeddedResourceHasher } from "../resource-hasher.js";

export interface SvgaAebBakeAdapterInput {
  sourceFormat: "aeb_physical_successor_package";
  outputFormat: "svga";
  packageId: string;
  jobId: string;
  sourceFingerprint: string;
  canvas: { width: number; height: number };
  fps: number;
  timeRange: { startFrame: number; endFrameExclusive: number };
  preservedNativeLayerIds: readonly string[];
  bakedLayerIds: readonly string[];
  frames: readonly {
    frameIndex: number;
    imageKey: string;
    relativePath: string;
    resourceId: string;
    canonicalResourceId: string;
    contentHash: string;
    width: number;
    height: number;
  }[];
  validation: {
    adapterNeutralManifestValidated: true;
    packageReinsertionValidated: true;
    standardsValidSvgaEncoded: false;
    realPreviewValidated: false;
    finalEncoderValidationRequired: true;
    runtimeValidatorRequired: true;
  };
}

export async function createSvgaAebBakeAdapterInput(
  published: AebPublishedSuccessorPackage,
  hasher: EmbeddedResourceHasher,
  publicationAuthority: AebPackagePublicationAuthorityVerifier,
  executionAuthority?: AebBakeExecutionAuthority
): Promise<SvgaAebBakeAdapterInput> {
  if (!isAdapterPackageShape(published)) {
    fail("PACKAGE_SHAPE_INVALID", "Reinserted AEB Package shape is invalid.");
  }
  if (!await verifyAebPublishedSuccessorPackageIntegrity(published, hasher, executionAuthority)) {
    fail("PACKAGE_INTEGRITY_INVALID", "Physical successor AEB Package or publication receipt is invalid.");
  }
  if (!publicationAuthority
    || !await publicationAuthority.verifyPublishedSuccessor(published, hasher)) {
    fail("PACKAGE_PUBLICATION_AUTHORITY_INVALID", "SVGA adapter entry requires current task-owned successor package authority.");
  }
  const bundle = published.bundle;
  if (!bundle.validation.packageReinsertionValidated
    || !bundle.validation.resourceClosureValidated
    || !bundle.validation.replaceableElementsPreserved
    || !bundle.validation.svgaAdapterInputReady
    || bundle.bakedSequences.length !== 1) {
    fail("PACKAGE_NOT_ADAPTER_READY", "Reinserted AEB Package has not completed the SVGA adapter-neutral boundary.");
  }
  const manifest = bundle.bakeManifest;
  const sequence = bundle.bakedSequences[0];
  if (manifest.frames.length !== manifest.resources.frameCount
    || manifest.frames.length !== manifest.job.timeRange.endFrameExclusive - manifest.job.timeRange.startFrame) {
    fail("MANIFEST_FRAME_CLOSURE_INVALID", "AEB Bake manifest frame inventory is incomplete.");
  }

  const knownResourceIds = new Set(manifest.frames.map((frame) => frame.resourceId));
  manifest.frames.forEach((frame, offset) => {
    if (frame.frameIndex !== manifest.job.timeRange.startFrame + offset
      || !knownResourceIds.has(frame.canonicalResourceId)
      || frame.width !== manifest.job.canvas.width
      || frame.height !== manifest.job.canvas.height) {
      fail("MANIFEST_FRAME_CLOSURE_INVALID", "AEB Bake manifest frame resources do not close over the job contract.");
    }
  });

  return {
    sourceFormat: "aeb_physical_successor_package",
    outputFormat: "svga",
    packageId: bundle.packageId,
    jobId: manifest.job.jobId,
    sourceFingerprint: manifest.job.source.sourceFingerprint,
    canvas: { ...manifest.job.canvas },
    fps: manifest.job.fps,
    timeRange: { ...manifest.job.timeRange },
    preservedNativeLayerIds: bundle.preservedNativeLayers.map((layer) => layer.layerId),
    bakedLayerIds: [...sequence.replacesLayerIds],
    frames: sequence.frames.map((frame) => ({
      frameIndex: frame.frameIndex,
      imageKey: `aeb_${frame.resourceId}`,
      relativePath: frame.relativePath,
      resourceId: frame.resourceId,
      canonicalResourceId: frame.canonicalResourceId,
      contentHash: frame.contentHash.value,
      width: frame.width,
      height: frame.height
    })),
    validation: {
      adapterNeutralManifestValidated: true,
      packageReinsertionValidated: true,
      standardsValidSvgaEncoded: false,
      realPreviewValidated: false,
      finalEncoderValidationRequired: true,
      runtimeValidatorRequired: true
    }
  };
}

function isAdapterPackageShape(value: unknown): value is AebPublishedSuccessorPackage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const published = value as Partial<AebPublishedSuccessorPackage>;
  const bundle = published.bundle;
  return Boolean(
    published.publicationReceipt
    && bundle
    && bundle.validation
    && bundle.bakeManifest
    && Array.isArray(bundle.bakedSequences)
    && Array.isArray(bundle.preservedNativeLayers)
    && bundle.resources
    && Array.isArray(bundle.resources.native)
    && Array.isArray(bundle.resources.bakedCanonicalResourceIds)
  );
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
