import { deflateSync, inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync
} from "node:fs";
import { access, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import protobuf from "protobufjs";
import { readJsonFile } from "../utils/fs.js";
import type { Exporter, ExportResult } from "./exporter.js";
import type { AvatarFrameProject } from "../types/project.js";
import { buildSvgaMap, type SvgaMap, type SvgaSpriteMap } from "../core/svga-map-builder.js";
import { normalizeFrameInterval } from "../core/frame-interval.js";
import {
  SVGA_FLOAT_SERIALIZATION_CONTRACT,
  SVGA_GENERATED_NATIVE_OUTPUT_AUTHORITY_CONTRACT,
  SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT,
  buildCanonicalSvgaFrame,
  inspectDecodedGeneratedNativeSubset,
  prepareSvgaFloatSprite,
  validateSvgaLayerFloatDomain
} from "../core/svga-float-serialization.js";

export interface SvgaExportValidation {
  exists: boolean;
  inflated: boolean;
  decoded: boolean;
  imageCount: number;
  spriteCount: number;
  frameCount: number;
  floatContractVersion: typeof SVGA_FLOAT_SERIALIZATION_CONTRACT.version;
  structureContractVersion: typeof SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT.version;
  authorityContractVersion: typeof SVGA_GENERATED_NATIVE_OUTPUT_AUTHORITY_CONTRACT.version;
  canonicalFloatValues: boolean;
  generatedNativeStructureValid: boolean;
  generatedNativeVocabularyValid: boolean;
  generatedNativeAuthorityValid: boolean;
  canonicalWireEncoding: boolean;
  allSpriteFrameCountsMatch: boolean;
  requiredFrameFieldsPresent: boolean;
  spriteFrameCounts: number[];
  totalFrameRecords: number;
}

export interface SvgaGeneratedNativeAuthorityResource {
  assetId: string;
  packagePath: string;
  width: number;
  height: number;
  sha256: string;
  bytes: Uint8Array;
}

export interface SvgaGeneratedNativeAuthorityInput {
  project: AvatarFrameProject;
  svgaMap: SvgaMap;
  resources: SvgaGeneratedNativeAuthorityResource[];
}

export interface SvgaExportResult extends ExportResult {
  format: "svga";
  outputPath: string;
  fileSizeBytes: number;
  validation: SvgaExportValidation;
  warnings: string[];
}

export type SvgaExportStage =
  | "read-map"
  | "validate-inputs"
  | "load-proto"
  | "validate-float"
  | "load-images"
  | "build-payload"
  | "verify-message"
  | "encode"
  | "validate-memory"
  | "write-readback";

export interface SvgaExporterOptions {
  onStage?: (stage: SvgaExportStage) => void;
}

export class SvgaExporter implements Exporter {
  constructor(
    private readonly protoPath = path.resolve("proto/svga.proto"),
    private readonly options: SvgaExporterOptions = {}
  ) {}

  async export(project: AvatarFrameProject, outputDir: string): Promise<SvgaExportResult> {
    let stage: SvgaExportStage = "read-map";
    const mark = (value: SvgaExportStage): void => {
      stage = value;
      this.options.onStage?.(value);
    };
    try {
      mark("read-map");
      const mapPath = path.join(outputDir, "svga-map.json");
      const svgaMap = await readJsonFile<SvgaMap>(mapPath);
      mark("validate-inputs");
      await validateExportInputs(project, svgaMap, outputDir);

      mark("load-proto");
      const root = await protobuf.load(this.protoPath);
      const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
      const orderedSprites = [...svgaMap.sprites].sort(compareSpriteStack);
      mark("validate-float");
      for (const sprite of orderedSprites) {
        if (!validateSvgaLayerFloatDomain(sprite, svgaMap.durationFrames).ok) {
          throw new Error(`Sprite ${sprite.spriteId} exceeds the svga_float32_v1 serialization domain.`);
        }
      }
      mark("load-images");
      const imageEntries = await loadImages(project, orderedSprites, outputDir);
      mark("build-payload");
      const moviePayload = buildGeneratedNativeMoviePayload(project, svgaMap, imageEntries.resources);
      mark("verify-message");
      const verificationError = MovieEntity.verify(moviePayload as { [k: string]: unknown });
      if (verificationError) {
        throw new Error(`MovieEntity verification failed: ${verificationError}`);
      }

      mark("encode");
      const encoded = MovieEntity.encode(MovieEntity.create(moviePayload as { [k: string]: unknown })).finish();
      const compressed = deflateSync(encoded);
      const outputPath = path.join(outputDir, `${project.projectId}.svga`);
      mark("validate-memory");
      assertSvgaValidation(
        validateCompressedSvga(compressed, MovieEntity, true, { project, svgaMap, resources: imageEntries.resources }),
        imageEntries.resources.length,
        orderedSprites.length,
        svgaMap.durationFrames
      );
      let validation: SvgaExportValidation;
      mark("write-readback");
      try {
        await writeFile(outputPath, compressed);
        validation = await validateSvgaOutput(outputPath, MovieEntity, { project, svgaMap, resources: imageEntries.resources });
        assertSvgaValidation(validation, imageEntries.resources.length, orderedSprites.length, svgaMap.durationFrames);
      } catch (error) {
        await rm(outputPath, { force: true });
        throw error;
      }

      return {
        format: "svga",
        outputPath,
        fileSizeBytes: (await stat(outputPath)).size,
        validation,
        warnings: ["Project easing values are currently linearized during SVGA protobuf export."]
      };
    } catch (error) {
      throw classifySvgaExportError(error, stage);
    }
  }
}

function classifySvgaExportError(error: unknown, stage: SvgaExportStage): Error & { code: string } {
  if (error instanceof Error && typeof (error as Error & { code?: unknown }).code === "string") {
    return error as Error & { code: string };
  }
  const wrapped = new Error(`SVGA export failed during ${stage}.`, { cause: error });
  return Object.assign(wrapped, { code: `aeb.svga_export_${stage.replaceAll("-", "_")}_failed` });
}

export async function validateSvgaBytes(
  compressed: Uint8Array,
  protoPath: string,
  authority?: SvgaGeneratedNativeAuthorityInput
): Promise<SvgaExportValidation> {
  const root = await protobuf.load(protoPath);
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  return validateCompressedSvga(compressed, MovieEntity, true, authority);
}

async function validateExportInputs(project: AvatarFrameProject, svgaMap: SvgaMap, outputDir: string): Promise<void> {
  if (project.schemaVersion !== "0.4.0" || svgaMap.schemaVersion !== "0.4.0") {
    throw new Error("SVGA export requires project.json and svga-map.json schemaVersion 0.4.0.");
  }

  if (svgaMap.durationFrames !== project.durationFrames || svgaMap.fps !== project.fps) {
    throw new Error("svga-map.json timeline does not match project.json.");
  }

  assertUniqueProjectIdentities(project);
  const expectedMap = normalizeJson(buildSvgaMap(project));
  if (!isDeepStrictEqual(svgaMap, expectedMap)) {
    throw new Error("svga-map.json does not exactly match project-derived sprite authority.");
  }

  for (const sprite of svgaMap.sprites) {
    assertSpriteTiming(sprite, svgaMap.fps, svgaMap.durationFrames);
    if (!sprite.exportAssetPath) {
      throw new Error(`Sprite ${sprite.spriteId} is missing exportAssetPath.`);
    }
    const assetPath = path.join(outputDir, sprite.exportAssetPath);
    await access(assetPath).catch(() => {
      throw new Error(`Sprite ${sprite.spriteId} export asset does not exist: ${sprite.exportAssetPath}`);
    });
  }
}

function assertSpriteTiming(sprite: SvgaSpriteMap, fps: number, durationFrames: number): void {
  if (sprite.visible !== undefined && typeof sprite.visible !== "boolean") {
    throw new Error(`Sprite ${sprite.spriteId} has invalid visibility authority.`);
  }
  const timing = sprite.sourceTiming;
  const range = sprite.visibleFrameRange;
  if (
    range
    && (!Number.isInteger(range.start)
      || !Number.isInteger(range.end)
      || range.start < 0
      || range.end < range.start
      || range.end >= durationFrames)
  ) {
    throw new Error(`Sprite ${sprite.spriteId} has invalid visible frame authority.`);
  }
  if (!timing) {
    return;
  }
  const normalizedInterval = normalizeFrameInterval({
    inPoint: timing.inPoint,
    outPoint: timing.outPoint,
    fps,
    durationFrames
  });
  if (!normalizedInterval.ok) {
    throw new Error(`Sprite ${sprite.spriteId} has invalid source timing authority.`);
  }
  if (
    timing.unit !== "seconds"
    || timing.frameBoundary !== "in_inclusive_out_exclusive"
    || timing.timeRemapEnabled !== false
    || timing.stretch !== 100
    || !Number.isFinite(timing.inPoint)
    || !Number.isFinite(timing.outPoint)
    || !Number.isFinite(timing.startTime)
    || !isDeepStrictEqual(timing.frameBoundaryContract, normalizedInterval.frameBoundaryContract)
    || timing.inPoint !== normalizedInterval.inPoint
    || timing.outPoint !== normalizedInterval.outPoint
    || !range
    || range.start !== normalizedInterval.activeFrameRange.start
    || range.end !== normalizedInterval.activeFrameRange.end
  ) {
    throw new Error(`Sprite ${sprite.spriteId} has invalid source timing authority.`);
  }
}

function assertUniqueProjectIdentities(project: AvatarFrameProject): void {
  assertUnique(project.assets.map((asset) => asset.id), "asset");
  assertUnique(project.layers.map((layer) => layer.id), "layer");
  assertUnique(project.animations.map((animation) => animation.id), "animation");
  assertUnique(project.animations.map((animation) => animation.targetLayerId), "animation target layer");

  const assetIds = new Set(project.assets.map((asset) => asset.id));
  const layerIds = new Set(project.layers.map((layer) => layer.id));
  if (project.layers.some((layer) => !assetIds.has(layer.assetId))) {
    throw new Error("project.json layer asset authority is incomplete.");
  }
  if (project.animations.some((animation) => !layerIds.has(animation.targetLayerId))) {
    throw new Error("project.json animation layer authority is incomplete.");
  }
}

function assertUnique(values: string[], identity: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`project.json contains duplicate ${identity} identity.`);
  }
}

function normalizeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function loadImages(
  project: AvatarFrameProject,
  sprites: SvgaSpriteMap[],
  outputDir: string
): Promise<{ resources: SvgaGeneratedNativeAuthorityResource[]; imageKeys: Map<string, string> }> {
  const resources: SvgaGeneratedNativeAuthorityResource[] = [];
  const imageKeys = new Map<string, string>();
  const uniquePaths = [...new Set(sprites.map((sprite) => sprite.exportAssetPath))];
  const assetsByPath = new Map(project.assets.map((asset) => [asset.path, asset]));

  uniquePaths.forEach((assetPath, index) => {
    imageKeys.set(assetPath, `img_${index}`);
  });

  for (const assetPath of uniquePaths) {
    const sprite = sprites.find((entry) => entry.exportAssetPath === assetPath);
    const asset = assetsByPath.get(assetPath);
    if (!sprite || !asset) continue;
    resources.push({
      assetId: asset.id,
      packagePath: assetPath,
      width: sprite.width,
      height: sprite.height,
      sha256: "",
      bytes: await readFile(path.join(outputDir, assetPath))
    });
  }

  return {
    resources: resources.map((resource) => ({ ...resource, sha256: sha256(Buffer.from(resource.bytes)) })),
    imageKeys
  };
}

function buildGeneratedNativeMoviePayload(
  project: AvatarFrameProject,
  svgaMap: SvgaMap,
  resources: SvgaGeneratedNativeAuthorityResource[]
): unknown {
  const orderedSprites = [...svgaMap.sprites].sort(compareSpriteStack);
  const resourceByPath = requireAuthorityResourceMap(project, svgaMap, resources);
  const imageKeys = new Map<string, string>();
  const images: Record<string, Buffer> = {};
  const uniquePaths = [...new Set(orderedSprites.map((sprite) => sprite.exportAssetPath))];
  uniquePaths.forEach((assetPath, index) => {
    const resource = resourceByPath.get(assetPath);
    if (!resource) throw new Error(`No resource found for sprite asset: ${assetPath}`);
    const key = `img_${index}`;
    imageKeys.set(assetPath, key);
    images[key] = Buffer.from(resource.bytes);
  });
  return {
    version: "2.0",
    params: {
      viewBoxWidth: svgaMap.canvas.width,
      viewBoxHeight: svgaMap.canvas.height,
      fps: svgaMap.fps,
      frames: svgaMap.durationFrames
    },
    images,
    sprites: orderedSprites.map((sprite) => buildSprite(sprite, imageKeys, svgaMap.durationFrames)),
    audios: []
  };
}

function buildSprite(sprite: SvgaSpriteMap, imageKeys: Map<string, string>, durationFrames: number): unknown {
  const imageKey = imageKeys.get(sprite.exportAssetPath);
  if (!imageKey) {
    throw new Error(`No imageKey found for sprite asset: ${sprite.exportAssetPath}`);
  }
  const prepared = prepareSvgaFloatSprite(sprite);
  return {
    imageKey,
    frames: Array.from({ length: durationFrames }, (_, frame) => buildFrame(prepared, frame))
  };
}

function buildFrame(sprite: ReturnType<typeof prepareSvgaFloatSprite>, frame: number): unknown {
  return buildCanonicalSvgaFrame(sprite, frame);
}

function compareSpriteStack(first: SvgaSpriteMap, second: SvgaSpriteMap): number {
  return first.zIndex - second.zIndex || compareIdentifiers(first.layerId, second.layerId);
}

function compareIdentifiers(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

async function validateSvgaOutput(
  outputPath: string,
  MovieEntity: protobuf.Type,
  authority: SvgaGeneratedNativeAuthorityInput
): Promise<SvgaExportValidation> {
  const exists = await access(outputPath).then(() => true, () => false);
  if (!exists) {
    return {
      exists: false,
      inflated: false,
      decoded: false,
      imageCount: 0,
      spriteCount: 0,
      frameCount: 0,
      floatContractVersion: SVGA_FLOAT_SERIALIZATION_CONTRACT.version,
      structureContractVersion: SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT.version,
      authorityContractVersion: SVGA_GENERATED_NATIVE_OUTPUT_AUTHORITY_CONTRACT.version,
      canonicalFloatValues: false,
      generatedNativeStructureValid: false,
      generatedNativeVocabularyValid: false,
      generatedNativeAuthorityValid: false,
      canonicalWireEncoding: false,
      allSpriteFrameCountsMatch: false,
      requiredFrameFieldsPresent: false,
      spriteFrameCounts: [],
      totalFrameRecords: 0
    };
  }

  return validateCompressedSvga(readBoundedRegularFileSync(outputPath, 50 * 1024 * 1024), MovieEntity, true, authority);
}

function validateCompressedSvga(
  compressed: Uint8Array,
  MovieEntity: protobuf.Type,
  exists: boolean,
  authority?: SvgaGeneratedNativeAuthorityInput
): SvgaExportValidation {
  let inflated: Buffer;
  let decodedObject: {
    params?: { frames?: number };
    images?: Record<string, Buffer>;
    sprites?: Array<{ frames?: unknown[] }>;
  } = {};
  let canonicalWireEncoding = false;
  try {
    inflated = inflateSync(compressed);
    const decoded = MovieEntity.decode(inflated) as protobuf.Message & {
      params?: { frames?: number };
      images?: Record<string, Uint8Array>;
      sprites?: Array<{ frames?: unknown[] }>;
    };
    decodedObject = MovieEntity.toObject(decoded, { bytes: Buffer }) as {
      params?: { frames?: number };
      images?: Record<string, Buffer>;
      sprites?: Array<{ frames?: unknown[] }>;
    };
  } catch {
    return {
      exists,
      inflated: false,
      decoded: false,
      imageCount: 0,
      spriteCount: 0,
      frameCount: 0,
      floatContractVersion: SVGA_FLOAT_SERIALIZATION_CONTRACT.version,
      structureContractVersion: SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT.version,
      authorityContractVersion: SVGA_GENERATED_NATIVE_OUTPUT_AUTHORITY_CONTRACT.version,
      canonicalFloatValues: false,
      generatedNativeStructureValid: false,
      generatedNativeVocabularyValid: false,
      generatedNativeAuthorityValid: false,
      canonicalWireEncoding: false,
      allSpriteFrameCountsMatch: false,
      requiredFrameFieldsPresent: false,
      spriteFrameCounts: [],
      totalFrameRecords: 0
    };
  }
  const generatedStructure = inspectDecodedGeneratedNativeSubset(decodedObject, inflated);
  const authorityResult = authority
    ? validateProjectDerivedGeneratedNativeAuthority({
      compressed,
      inflated,
      MovieEntity,
      decodedObject,
      authority
    })
    : { valid: false, canonicalWireEncoding: false };
  canonicalWireEncoding = authorityResult.canonicalWireEncoding;

  return {
    exists,
    inflated: inflated.length > 0,
    decoded: Boolean(decodedObject.params && decodedObject.images && decodedObject.sprites),
    imageCount: Object.keys(decodedObject.images ?? {}).length,
    spriteCount: decodedObject.sprites?.length ?? 0,
    frameCount: decodedObject.params?.frames ?? 0,
    floatContractVersion: SVGA_FLOAT_SERIALIZATION_CONTRACT.version,
    structureContractVersion: generatedStructure.structureContractVersion,
    authorityContractVersion: generatedStructure.authorityContractVersion,
    canonicalFloatValues: generatedStructure.canonicalFloatValues,
    generatedNativeStructureValid: generatedStructure.generatedNativeStructureValid,
    generatedNativeVocabularyValid: generatedStructure.generatedNativeVocabularyValid,
    generatedNativeAuthorityValid: authorityResult.valid,
    canonicalWireEncoding,
    allSpriteFrameCountsMatch: generatedStructure.allSpriteFrameCountsMatch,
    requiredFrameFieldsPresent: generatedStructure.requiredFrameFieldsPresent,
    spriteFrameCounts: generatedStructure.spriteFrameCounts,
    totalFrameRecords: generatedStructure.totalFrameRecords
  };
}

function assertSvgaValidation(
  validation: SvgaExportValidation,
  imageCount: number,
  spriteCount: number,
  frameCount: number
): void {
  if (
    validation.exists !== true
    || validation.inflated !== true
    || validation.decoded !== true
    || validation.imageCount !== imageCount
    || validation.spriteCount !== spriteCount
    || validation.frameCount !== frameCount
    || validation.floatContractVersion !== SVGA_FLOAT_SERIALIZATION_CONTRACT.version
    || validation.structureContractVersion !== SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT.version
    || validation.authorityContractVersion !== SVGA_GENERATED_NATIVE_OUTPUT_AUTHORITY_CONTRACT.version
    || validation.canonicalFloatValues !== true
    || validation.generatedNativeStructureValid !== true
    || validation.generatedNativeVocabularyValid !== true
    || validation.generatedNativeAuthorityValid !== true
    || validation.canonicalWireEncoding !== true
    || validation.allSpriteFrameCountsMatch !== true
    || validation.requiredFrameFieldsPresent !== true
    || validation.spriteFrameCounts.length !== spriteCount
    || validation.spriteFrameCounts.some((count) => count !== frameCount)
    || validation.totalFrameRecords !== spriteCount * frameCount
  ) {
    throw new Error("Generated SVGA failed canonical float32/generated-native authority validation.");
  }
}

function validateProjectDerivedGeneratedNativeAuthority(input: {
  compressed: Uint8Array;
  inflated: Uint8Array;
  MovieEntity: protobuf.Type;
  decodedObject: {
    params?: { frames?: number };
    images?: Record<string, Buffer>;
    sprites?: Array<{ frames?: unknown[] }>;
  };
  authority: SvgaGeneratedNativeAuthorityInput;
}): { valid: boolean; canonicalWireEncoding: boolean } {
  try {
    const expectedPayload = buildGeneratedNativeMoviePayload(
      input.authority.project,
      input.authority.svgaMap,
      input.authority.resources
    );
    const verificationError = input.MovieEntity.verify(expectedPayload as { [k: string]: unknown });
    if (verificationError) return { valid: false, canonicalWireEncoding: false };
    const expectedInflated = input.MovieEntity.encode(input.MovieEntity.create(expectedPayload as { [k: string]: unknown })).finish();
    const canonicalWireEncoding = Buffer.compare(Buffer.from(expectedInflated), Buffer.from(input.inflated)) === 0;
    if (!canonicalWireEncoding) return { valid: false, canonicalWireEncoding };
    const expectedCompressed = deflateSync(expectedInflated);
    if (sha256(expectedCompressed) !== sha256(Buffer.from(input.compressed))) {
      return { valid: false, canonicalWireEncoding };
    }
    return { valid: validateProjectMapResourceJoin(input.authority, input.decodedObject), canonicalWireEncoding };
  } catch {
    return { valid: false, canonicalWireEncoding: false };
  }
}

function requireAuthorityResourceMap(
  project: AvatarFrameProject,
  svgaMap: SvgaMap,
  resources: SvgaGeneratedNativeAuthorityResource[]
): Map<string, SvgaGeneratedNativeAuthorityResource> {
  const resourceMap = buildAuthorityResourceMap(project, svgaMap, resources);
  if (!resourceMap) {
    throw new Error("Generated native resource authority is incomplete.");
  }
  return resourceMap;
}

function buildAuthorityResourceMap(
  project: AvatarFrameProject,
  svgaMap: SvgaMap,
  resources: SvgaGeneratedNativeAuthorityResource[]
): Map<string, SvgaGeneratedNativeAuthorityResource> | null {
  const orderedSprites = [...svgaMap.sprites].sort(compareSpriteStack);
  const uniquePaths = [...new Set(orderedSprites.map((sprite) => sprite.exportAssetPath))];
  const expectedPathSet = new Set(uniquePaths);
  const projectAssetsByPath = new Map(project.assets.map((asset) => [asset.path, asset]));
  const projectAssetsById = new Map(project.assets.map((asset) => [asset.id, asset]));
  if (
    uniquePaths.length !== project.assets.length
    || projectAssetsByPath.size !== project.assets.length
    || projectAssetsById.size !== project.assets.length
    || resources.length !== uniquePaths.length
  ) {
    return null;
  }

  const resourcesByPath = new Map<string, SvgaGeneratedNativeAuthorityResource>();
  const resourcesById = new Map<string, SvgaGeneratedNativeAuthorityResource>();
  for (const resource of resources) {
    const projectAssetByPath = projectAssetsByPath.get(resource.packagePath);
    const projectAssetById = projectAssetsById.get(resource.assetId);
    if (
      typeof resource.assetId !== "string"
      || resource.assetId.length === 0
      || typeof resource.packagePath !== "string"
      || resource.packagePath.length === 0
      || resourcesByPath.has(resource.packagePath)
      || resourcesById.has(resource.assetId)
      || !expectedPathSet.has(resource.packagePath)
      || !projectAssetByPath
      || !projectAssetById
      || projectAssetByPath !== projectAssetById
      || projectAssetByPath.id !== resource.assetId
      || projectAssetByPath.path !== resource.packagePath
    ) {
      return null;
    }
    resourcesByPath.set(resource.packagePath, resource);
    resourcesById.set(resource.assetId, resource);
  }

  for (const assetPath of uniquePaths) {
    if (!resourcesByPath.has(assetPath)) return null;
  }
  return resourcesByPath;
}

function validateProjectMapResourceJoin(
  authority: SvgaGeneratedNativeAuthorityInput,
  decodedObject: {
    params?: { frames?: number };
    images?: Record<string, Buffer>;
    sprites?: Array<{ frames?: unknown[]; imageKey?: string }>;
  }
): boolean {
  if (authority.project.durationFrames !== authority.svgaMap.durationFrames) return false;
  if (authority.project.fps !== authority.svgaMap.fps) return false;
  const expectedMap = normalizeJson(buildSvgaMap(authority.project));
  if (!isDeepStrictEqual(authority.svgaMap, expectedMap)) return false;
  const resourcesByPath = buildAuthorityResourceMap(authority.project, authority.svgaMap, authority.resources);
  if (!resourcesByPath) return false;
  const projectAssetsByPath = new Map(authority.project.assets.map((asset) => [asset.path, asset]));
  if (projectAssetsByPath.size !== authority.project.assets.length) return false;
  const orderedSprites = [...authority.svgaMap.sprites].sort(compareSpriteStack);
  const uniquePaths = [...new Set(orderedSprites.map((sprite) => sprite.exportAssetPath))];
  if (uniquePaths.length !== authority.project.assets.length) return false;
  const images = decodedObject.images ?? {};
  if (Object.keys(images).length !== uniquePaths.length) return false;
  for (const [index, assetPath] of uniquePaths.entries()) {
    const imageKey = `img_${index}`;
    const resource = resourcesByPath.get(assetPath);
    const projectAsset = projectAssetsByPath.get(assetPath);
    const decodedBytes = images[imageKey];
    if (!resource || !projectAsset || !decodedBytes) return false;
    if (
      resource.assetId !== projectAsset.id
      || resource.packagePath !== projectAsset.path
      || resource.sha256 !== projectAsset.sha256
      || resource.width !== projectAsset.width
      || resource.height !== projectAsset.height
      || sha256(Buffer.from(resource.bytes)) !== projectAsset.sha256
      || sha256(decodedBytes) !== projectAsset.sha256
    ) return false;
  }
  const sprites = decodedObject.sprites ?? [];
  if (sprites.length !== orderedSprites.length) return false;
  for (const [index, sprite] of orderedSprites.entries()) {
    const expectedImageKey = `img_${uniquePaths.indexOf(sprite.exportAssetPath)}`;
    if ((sprites[index] as { imageKey?: string }).imageKey !== expectedImageKey) return false;
  }
  return true;
}

function readBoundedRegularFileSync(filePath: string, maxBytes: number): Buffer {
  const resolvedPath = path.resolve(filePath);
  const preStat = lstatSync(resolvedPath);
  if (preStat.isSymbolicLink() || !preStat.isFile() || preStat.nlink !== 1 || preStat.size <= 0 || preStat.size > maxBytes) {
    throw new Error("Generated SVGA file is not a bounded regular file.");
  }
  if (realpathSync(resolvedPath) !== resolvedPath) {
    throw new Error("Generated SVGA file path is an alias.");
  }
  let descriptor: number | undefined;
  try {
    descriptor = openSync(resolvedPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const openedStat = fstatSync(descriptor);
    if (openedStat.nlink !== 1 || openedStat.size !== preStat.size || openedStat.dev !== preStat.dev || openedStat.ino !== preStat.ino) {
      throw new Error("Generated SVGA file changed before read.");
    }
    const capacity = Math.min(openedStat.size + 1, maxBytes + 1);
    const buffer = Buffer.allocUnsafe(capacity);
    let bytesRead = 0;
    while (bytesRead < capacity) {
      const count = readSync(descriptor, buffer, bytesRead, capacity - bytesRead, bytesRead);
      if (count === 0) break;
      bytesRead += count;
    }
    const postStat = fstatSync(descriptor);
    const pathStat = lstatSync(resolvedPath);
    if (
      pathStat.isSymbolicLink()
      || pathStat.nlink !== 1
      || postStat.nlink !== 1
      || postStat.dev !== pathStat.dev
      || postStat.ino !== pathStat.ino
      || postStat.size !== openedStat.size
      || bytesRead !== postStat.size
      || bytesRead > maxBytes
    ) {
      throw new Error("Generated SVGA file changed during read.");
    }
    return Buffer.from(buffer.subarray(0, bytesRead));
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
