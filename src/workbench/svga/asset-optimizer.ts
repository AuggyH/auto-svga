import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
import protobuf from "protobufjs";
import { SvgaImageResourceEditor } from "./image-resource-editor.js";

export const SVGA_IMAGE_OPTIMIZATION_REPORT_SCHEMA_VERSION = 1;

export type SvgaImageOptimizationActionType =
  | "deduplicate_encoded_image"
  | "remove_unreferenced_image";

export interface SvgaImageOptimizationAction {
  type: SvgaImageOptimizationActionType;
  resourceKey: string;
  originalSha256: string;
  originalSizeBytes: number;
  originalUsageCount: number;
  canonicalResourceKey?: string;
}

export interface SvgaImageOptimizationRedirect {
  fromResourceKey: string;
  toResourceKey: string;
  originalSha256: string;
  usageCountBefore: number;
}

export interface SvgaImageOptimizationInvariantCheck {
  code: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  evidenceHash?: string;
  comparisonDigest?: string;
  limitation: string;
}

export interface SvgaImageOptimizationReport {
  schemaVersion: typeof SVGA_IMAGE_OPTIMIZATION_REPORT_SCHEMA_VERSION;
  optimizationId: "svga-safe-image-optimizer-v1";
  sourceSha256: string;
  sourceSha256AfterOptimization: string;
  optimizedSha256: string;
  originalImageCount: number;
  optimizedImageCount: number;
  removedResourceKeys: readonly string[];
  redirectedResourceReferences: readonly SvgaImageOptimizationRedirect[];
  actions: readonly SvgaImageOptimizationAction[];
  estimatedFileSizeSavingsBytes: number;
  changedFields: readonly string[];
  invariantChecks: readonly SvgaImageOptimizationInvariantCheck[];
  decodePassed: boolean;
  sourceUnchanged: boolean;
  saveAsRequired: boolean;
  passed: boolean;
}

export interface SvgaImageOptimizationResult {
  optimizedBytes: Uint8Array;
  report: SvgaImageOptimizationReport;
}

export interface SvgaImageOptimizationOptions {
  protoPath?: string;
  sourceName?: string;
}

export class SvgaImageOptimizationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {}
  ) {
    super(message);
    this.name = "SvgaImageOptimizationError";
  }
}

interface KnownMoviePayload {
  version?: string;
  params?: {
    viewBoxWidth?: number;
    viewBoxHeight?: number;
    fps?: number;
    frames?: number;
  };
  images?: Record<string, Uint8Array>;
  sprites?: Array<{
    imageKey?: string;
    frames?: unknown[];
    matteKey?: string;
  }>;
  audios?: unknown[];
}

interface ImageResourceFacts {
  resourceKey: string;
  bytes: Uint8Array;
  sha256: string;
  sizeBytes: number;
  usageCount: number;
}

export async function optimizeSvgaImageResources(
  sourceBytes: Uint8Array,
  options: SvgaImageOptimizationOptions = {}
): Promise<SvgaImageOptimizationResult> {
  const protoPath = options.protoPath ?? defaultProtoPath();
  await new SvgaImageResourceEditor(protoPath).createSession(
    sourceBytes,
    options.sourceName ?? "untitled.svga"
  );

  const MovieEntity = await loadMovieEntity(protoPath);
  const payload = decodeMovie(MovieEntity, sourceBytes);
  const images = normalizeImages(payload.images);
  const sprites = payload.sprites ?? [];
  const facts = imageFacts(images, sprites);
  const redirects = duplicateRedirects(facts);
  const redirectMap = new Map(redirects.map(({ fromResourceKey, toResourceKey }) => [
    fromResourceKey,
    toResourceKey
  ]));
  const optimizedSprites = sprites.map((sprite) => ({
    ...sprite,
    imageKey: redirectResourceKey(sprite.imageKey, redirectMap),
    matteKey: redirectResourceKey(sprite.matteKey, redirectMap)
  }));
  const usageAfterRedirect = usageCounts(Object.keys(images), optimizedSprites);
  const removedResourceKeys = Object.keys(images)
    .filter((resourceKey) => (usageAfterRedirect.get(resourceKey) ?? 0) === 0)
    .sort();

  const actions = actionsForPlan(redirects, removedResourceKeys, facts);
  if (actions.length === 0) {
    throw new SvgaImageOptimizationError(
      "optimization_not_applicable",
      "No mechanically safe SVGA image optimization candidates were found."
    );
  }

  const optimizedImages = Object.fromEntries(
    Object.entries(images).filter(([resourceKey]) => !removedResourceKeys.includes(resourceKey))
  );
  const optimizedPayload: KnownMoviePayload = {
    ...payload,
    images: optimizedImages,
    sprites: optimizedSprites
  };
  const verificationError = MovieEntity.verify(optimizedPayload);
  if (verificationError) {
    throw new SvgaImageOptimizationError(
      "svga_optimization_verify_failed",
      `Optimized SVGA verification failed: ${verificationError}`
    );
  }

  const optimizedBytes = deflateSync(MovieEntity.encode(MovieEntity.create(optimizedPayload)).finish());
  const optimizedDecoded = decodeMovie(MovieEntity, optimizedBytes);
  const report = buildOptimizationReport({
    sourceBytes,
    optimizedBytes,
    originalPayload: payload,
    optimizedPayload: optimizedDecoded,
    facts,
    redirects,
    removedResourceKeys
  });
  if (!report.passed) {
    throw new SvgaImageOptimizationError(
      "svga_optimization_invariant_failed",
      "Optimized SVGA failed safety invariant checks.",
      {
        failedChecks: report.invariantChecks
          .filter(({ passed }) => !passed)
          .map(({ code }) => code)
      }
    );
  }

  return {
    optimizedBytes,
    report
  };
}

function buildOptimizationReport(input: {
  sourceBytes: Uint8Array;
  optimizedBytes: Uint8Array;
  originalPayload: KnownMoviePayload;
  optimizedPayload: KnownMoviePayload;
  facts: readonly ImageResourceFacts[];
  redirects: readonly SvgaImageOptimizationRedirect[];
  removedResourceKeys: readonly string[];
}): SvgaImageOptimizationReport {
  const originalImages = normalizeImages(input.originalPayload.images);
  const optimizedImages = normalizeImages(input.optimizedPayload.images);
  const actions = actionsForPlan(input.redirects, input.removedResourceKeys, input.facts);
  const sourceSha256 = sha256(input.sourceBytes);
  const sourceSha256AfterOptimization = sha256(input.sourceBytes);
  const optimizedImageKeys = new Set(Object.keys(optimizedImages));
  const checks = [
    checkEqual("movie_version", input.originalPayload.version ?? "", input.optimizedPayload.version ?? "", "MovieEntity.version must not change."),
    checkDigest("movie_params", input.originalPayload.params ?? {}, input.optimizedPayload.params ?? {}, "Movie params must not change."),
    checkEqual("sprite_count", input.originalPayload.sprites?.length ?? 0, input.optimizedPayload.sprites?.length ?? 0, "Sprite count must not change."),
    checkDigest("sprite_non_reference_fields", spritesWithoutResourceReferences(input.originalPayload.sprites), spritesWithoutResourceReferences(input.optimizedPayload.sprites), "Only sprite imageKey and matteKey references may change."),
    checkDigest("audio_entries", input.originalPayload.audios ?? [], input.optimizedPayload.audios ?? [], "Audio entries must not change."),
    checkEqual("removed_resources_absent", input.removedResourceKeys, input.removedResourceKeys.filter((key) => !optimizedImageKeys.has(key)), "Removed image resources must be absent from the exported SVGA."),
    checkEqual("image_references_closed", [], danglingReferences(input.optimizedPayload.sprites, optimizedImageKeys), "Every imageKey and matteKey reference must resolve to a remaining image resource."),
    checkEqual("redirected_hash_equivalence", [], redirectHashMismatches(input.redirects, input.facts), "Deduplicated resources may only redirect to byte-identical encoded images."),
    checkEqual("removed_resources_unreferenced_after_redirect", [], stillReferencedRemovedKeys(input.removedResourceKeys, input.optimizedPayload.sprites), "Removed image resources must have zero references after duplicate redirects."),
    checkEqual("kept_image_hashes", keptHashes(originalImages, input.removedResourceKeys), keptHashes(optimizedImages, []), "Every kept image resource must preserve its encoded bytes."),
    checkEqual("original_source_sha256_immutability", sourceSha256, sourceSha256AfterOptimization, "Source bytes are immutable input and must never be written in place.")
  ];
  const passed = actions.length > 0 && checks.every(({ passed: checkPassed }) => checkPassed);
  return {
    schemaVersion: SVGA_IMAGE_OPTIMIZATION_REPORT_SCHEMA_VERSION,
    optimizationId: "svga-safe-image-optimizer-v1",
    sourceSha256,
    sourceSha256AfterOptimization,
    optimizedSha256: sha256(input.optimizedBytes),
    originalImageCount: Object.keys(originalImages).length,
    optimizedImageCount: Object.keys(optimizedImages).length,
    removedResourceKeys: input.removedResourceKeys,
    redirectedResourceReferences: input.redirects,
    actions,
    estimatedFileSizeSavingsBytes: input.removedResourceKeys.reduce((total, resourceKey) => (
      total + (input.facts.find((fact) => fact.resourceKey === resourceKey)?.sizeBytes ?? 0)
    ), 0),
    changedFields: [
      ...input.removedResourceKeys.map((resourceKey) => `images.${resourceKey}`),
      ...input.redirects.map(({ fromResourceKey, toResourceKey }) => `sprite_references.${fromResourceKey}->${toResourceKey}`),
      "zlib_bytes",
      "protobuf_serialization"
    ],
    invariantChecks: checks,
    decodePassed: true,
    sourceUnchanged: sourceSha256 === sourceSha256AfterOptimization,
    saveAsRequired: true,
    passed
  };
}

function duplicateRedirects(facts: readonly ImageResourceFacts[]): SvgaImageOptimizationRedirect[] {
  const groups = new Map<string, ImageResourceFacts[]>();
  for (const fact of facts) {
    const group = groups.get(fact.sha256) ?? [];
    group.push(fact);
    groups.set(fact.sha256, group);
  }

  return [...groups.values()].flatMap((group) => {
    if (group.length < 2) return [];
    const sorted = [...group].sort((left, right) => (
      Number(right.usageCount > 0) - Number(left.usageCount > 0)
      || left.resourceKey.localeCompare(right.resourceKey)
    ));
    const canonical = sorted[0];
    return sorted
      .slice(1)
      .filter(({ usageCount }) => usageCount > 0)
      .map((duplicate) => ({
        fromResourceKey: duplicate.resourceKey,
        toResourceKey: canonical.resourceKey,
        originalSha256: duplicate.sha256,
        usageCountBefore: duplicate.usageCount
      }));
  }).sort((left, right) => left.fromResourceKey.localeCompare(right.fromResourceKey));
}

function imageFacts(
  images: Readonly<Record<string, Uint8Array>>,
  sprites: KnownMoviePayload["sprites"]
): ImageResourceFacts[] {
  const usage = usageCounts(Object.keys(images), sprites);
  return Object.entries(images)
    .map(([resourceKey, bytes]) => ({
      resourceKey,
      bytes,
      sha256: sha256(bytes),
      sizeBytes: bytes.byteLength,
      usageCount: usage.get(resourceKey) ?? 0
    }))
    .sort((left, right) => left.resourceKey.localeCompare(right.resourceKey));
}

function actionForRedirect(
  redirect: SvgaImageOptimizationRedirect,
  facts: readonly ImageResourceFacts[]
): SvgaImageOptimizationAction {
  const fact = requireFact(redirect.fromResourceKey, facts);
  return {
    type: "deduplicate_encoded_image",
    resourceKey: redirect.fromResourceKey,
    canonicalResourceKey: redirect.toResourceKey,
    originalSha256: fact.sha256,
    originalSizeBytes: fact.sizeBytes,
    originalUsageCount: fact.usageCount
  };
}

function actionsForPlan(
  redirects: readonly SvgaImageOptimizationRedirect[],
  removedResourceKeys: readonly string[],
  facts: readonly ImageResourceFacts[]
): SvgaImageOptimizationAction[] {
  const redirectedKeys = new Set(redirects.map(({ fromResourceKey }) => fromResourceKey));
  return [
    ...redirects.map((redirect) => actionForRedirect(redirect, facts)),
    ...removedResourceKeys
      .filter((resourceKey) => !redirectedKeys.has(resourceKey))
      .map((resourceKey) => actionForRemoval(resourceKey, facts))
  ];
}

function actionForRemoval(
  resourceKey: string,
  facts: readonly ImageResourceFacts[]
): SvgaImageOptimizationAction {
  const fact = requireFact(resourceKey, facts);
  return {
    type: "remove_unreferenced_image",
    resourceKey,
    originalSha256: fact.sha256,
    originalSizeBytes: fact.sizeBytes,
    originalUsageCount: fact.usageCount
  };
}

function requireFact(resourceKey: string, facts: readonly ImageResourceFacts[]): ImageResourceFacts {
  const fact = facts.find((candidate) => candidate.resourceKey === resourceKey);
  if (!fact) {
    throw new SvgaImageOptimizationError("resource_fact_missing", "SVGA optimization resource fact is missing.", {
      resourceKey
    });
  }
  return fact;
}

function redirectResourceKey(
  resourceKey: string | undefined,
  redirects: ReadonlyMap<string, string>
): string | undefined {
  return resourceKey ? redirects.get(resourceKey) ?? resourceKey : resourceKey;
}

function usageCounts(
  resourceKeys: readonly string[],
  sprites: KnownMoviePayload["sprites"]
): Map<string, number> {
  const counts = new Map(resourceKeys.map((resourceKey) => [resourceKey, 0]));
  for (const sprite of sprites ?? []) {
    incrementUsage(counts, sprite.imageKey);
    incrementUsage(counts, sprite.matteKey);
  }
  return counts;
}

function incrementUsage(counts: Map<string, number>, resourceKey: string | undefined): void {
  if (!resourceKey || !counts.has(resourceKey)) return;
  counts.set(resourceKey, (counts.get(resourceKey) ?? 0) + 1);
}

function danglingReferences(
  sprites: KnownMoviePayload["sprites"],
  imageKeys: ReadonlySet<string>
): string[] {
  return [...new Set((sprites ?? []).flatMap((sprite) => [
    sprite.imageKey,
    sprite.matteKey
  ]).filter((resourceKey): resourceKey is string => (
    typeof resourceKey === "string" && resourceKey.length > 0 && !imageKeys.has(resourceKey)
  )))].sort();
}

function redirectHashMismatches(
  redirects: readonly SvgaImageOptimizationRedirect[],
  facts: readonly ImageResourceFacts[]
): string[] {
  return redirects.flatMap((redirect) => {
    const from = facts.find(({ resourceKey }) => resourceKey === redirect.fromResourceKey);
    const to = facts.find(({ resourceKey }) => resourceKey === redirect.toResourceKey);
    return from && to && from.sha256 === to.sha256 ? [] : [redirect.fromResourceKey];
  }).sort();
}

function stillReferencedRemovedKeys(
  removedResourceKeys: readonly string[],
  sprites: KnownMoviePayload["sprites"]
): string[] {
  const removed = new Set(removedResourceKeys);
  return [...new Set((sprites ?? []).flatMap((sprite) => [
    sprite.imageKey,
    sprite.matteKey
  ]).filter((resourceKey): resourceKey is string => (
    typeof resourceKey === "string" && resourceKey.length > 0 && removed.has(resourceKey)
  )))].sort();
}

function keptHashes(
  images: Readonly<Record<string, Uint8Array>>,
  removedResourceKeys: readonly string[]
): Readonly<Record<string, string>> {
  const removed = new Set(removedResourceKeys);
  return Object.fromEntries(Object.entries(images)
    .filter(([resourceKey]) => !removed.has(resourceKey))
    .map(([resourceKey, bytes]) => [resourceKey, sha256(bytes)])
    .sort(([left], [right]) => left.localeCompare(right)));
}

function spritesWithoutResourceReferences(sprites: KnownMoviePayload["sprites"]): unknown {
  return (sprites ?? []).map(({ imageKey: _imageKey, matteKey: _matteKey, ...sprite }) => sprite);
}

function checkEqual(
  code: string,
  expected: unknown,
  actual: unknown,
  limitation: string
): SvgaImageOptimizationInvariantCheck {
  const passed = stableStringify(expected) === stableStringify(actual);
  return {
    code,
    passed,
    expected,
    actual,
    evidenceHash: digest({ code, expected, actual }),
    limitation
  };
}

function checkDigest(
  code: string,
  expectedValue: unknown,
  actualValue: unknown,
  limitation: string
): SvgaImageOptimizationInvariantCheck {
  const expectedDigest = digest(expectedValue);
  const actualDigest = digest(actualValue);
  return {
    code,
    passed: expectedDigest === actualDigest,
    expected: { canonicalDigest: expectedDigest },
    actual: { canonicalDigest: actualDigest },
    comparisonDigest: digest({ code, expectedDigest, actualDigest }),
    limitation
  };
}

async function loadMovieEntity(protoPath: string): Promise<protobuf.Type> {
  const root = await protobuf.load(protoPath);
  return root.lookupType("com.opensource.svga.MovieEntity");
}

function decodeMovie(MovieEntity: protobuf.Type, bytes: Uint8Array): KnownMoviePayload {
  try {
    const decoded = MovieEntity.decode(inflateSync(bytes));
    const payload = MovieEntity.toObject(decoded, {
      bytes: Buffer,
      defaults: true
    }) as KnownMoviePayload;
    if (!payload.params || !payload.images || !payload.sprites) {
      throw new Error("SVGA MovieEntity is missing params, images, or sprites.");
    }
    return {
      ...payload,
      images: normalizeImages(payload.images)
    };
  } catch (error) {
    if (error instanceof SvgaImageOptimizationError) throw error;
    throw new SvgaImageOptimizationError(
      "svga_decode_failed",
      "SVGA could not be inflated and decoded.",
      { reason: error instanceof Error ? error.message : String(error) }
    );
  }
}

function normalizeImages(images: KnownMoviePayload["images"]): Record<string, Uint8Array> {
  return Object.fromEntries(
    Object.entries(images ?? {}).map(([key, value]) => [key, toUint8Array(value)])
  );
}

function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value.slice();
  }
  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }
  throw new SvgaImageOptimizationError("svga_invalid_image_bytes", "SVGA image bytes are not readable.");
}

function defaultProtoPath(): string {
  return fileURLToPath(new URL("../../../proto/svga.proto", import.meta.url));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object" && !(value instanceof Uint8Array)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortObject(item)])
    );
  }
  return value;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
