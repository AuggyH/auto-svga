import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import protobuf from "protobufjs";
import { decodeRgbaPng } from "../../utils/png-reader.js";
import { createTransparentImage, encodeRgbaPng } from "../../utils/png-writer.js";
import { SvgaImageResourceEditor, type SvgaRoundTripReport } from "./image-resource-editor.js";

export interface SvgaSequenceFrameRepairOptions {
  protoPath?: string;
  sourceName?: string;
  headCommit?: string;
  maxNearEmptyPixels?: number;
  maxNearEmptyRatio?: number;
  minNeighborPixelRatio?: number;
  minTerminalPreviousPixelRatio?: number;
}

export interface SvgaSequenceFrameAlphaProof {
  resourceKey: string;
  spriteIndex: number;
  frameIndex: number;
  usageCount: number;
  width: number;
  height: number;
  beforeSha256: string;
  afterSha256: string;
  beforeNonTransparentPixelCount: number;
  afterNonTransparentPixelCount: number;
  beforeNonTransparentRatio: number;
  afterNonTransparentRatio: number;
  beforeAlphaBounds: PixelBounds | null;
  afterAlphaBounds: PixelBounds | null;
  visibleFrameIndices: readonly number[];
  maxTimelineAlpha: number;
  timelineAlphaDigest: string;
  changed: boolean;
  changeReason: "near_empty_speck_to_transparent" | "unchanged";
  passed: boolean;
}

export interface SvgaSequenceFrameRepairReport {
  schemaVersion: 1;
  repairId: "svga-sequence-frame-anti-flicker-v1";
  status: "repaired";
  sourceSha256: string;
  sourceSha256AfterRepair: string;
  editedSha256: string;
  headCommit: string;
  sequenceGroup: {
    groupId: string;
    detectionMethod: "continuous_numeric_resource_keys";
    resourceKeys: readonly string[];
    resourceKeyCount: number;
    repairedResourceKey: string;
    targetVisibleFrames: readonly number[];
    fullAffectedFrameVisibilityAlphaProof: readonly SvgaSequenceFrameAlphaProof[];
  };
  selectedRepair: {
    resourceKey: string;
    reason: "near_empty_visible_speck_frame";
    selectionRule: RepairSelectionRule;
    replacement: "same_dimensions_transparent_png";
    beforeNonTransparentPixelCount: number;
    afterNonTransparentPixelCount: number;
    beforeNonTransparentRatio: number;
    afterNonTransparentRatio: number;
    beforeSha256: string;
    afterSha256: string;
  };
  roundTripReport: SvgaRoundTripReport;
  invariantSummary: {
    sourceUnchanged: boolean;
    roundTripPassed: boolean;
    imageResourceKeySetStable: boolean;
    spriteTimelineStable: boolean;
    untouchedResourceHashesStable: boolean;
    onlySelectedResourceChanged: boolean;
    replacementDimensionsMatchOriginal: boolean;
    sequenceVisibilityWindowsDisjoint: boolean;
  };
  productSaveAsEnabled: true;
  repairSuccessClaimed: true;
  manualVisualConfirmationRequired: false;
  failureClosed: true;
  unsafeCasePolicy: readonly string[];
  passed: boolean;
}

export interface SvgaSequenceFrameRepairResult {
  editedBytes: Uint8Array;
  transparentReplacementPng: Uint8Array;
  report: SvgaSequenceFrameRepairReport;
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
    frames?: Array<{ alpha?: number } & Record<string, unknown>>;
    matteKey?: string;
  }>;
  audios?: unknown[];
}

type SpritePayload = NonNullable<KnownMoviePayload["sprites"]>[number];

interface DecodedMovie {
  payload: KnownMoviePayload;
}

interface PixelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ResourceProofInput {
  resourceKey: string;
  numericIndex: number;
  frameIndex: number;
  spriteIndex: number;
  width: number;
  height: number;
  usageCount: number;
  beforeBytes: Uint8Array;
  afterBytes: Uint8Array;
  visibleFrameIndices: readonly number[];
  maxTimelineAlpha: number;
  timelineAlphaDigest: string;
}

interface ImageFacts {
  width: number;
  height: number;
  nonTransparentPixelCount: number;
  nonTransparentRatio: number;
  alphaBounds: PixelBounds | null;
}

interface SequenceVisibilityOverlapSummary {
  overlapFrameCount: number;
  overlapFrameSamples: Array<{ frameIndex: number; resourceKeys: string[] }>;
  overlappingResourceKeys: string[];
}

interface SequenceGroupDetectionDetails extends Record<string, unknown> {
  imageResourceCount: number;
  numericImageResourceCount: number;
  skippedNonNumericResourceCount: number;
  skippedReferenceMismatchCount: number;
  skippedMatteReferenceCount: number;
  skippedNoVisibleFramesCount: number;
  groupCandidateCount: number;
  longestContinuousSegmentLength: number;
  minimumSequenceGroupSize: number;
  groupCandidateSamples: Array<{
    groupId: string;
    resourceKeyCount: number;
    longestContinuousSegmentLength: number;
    resourceKeySamples: string[];
  }>;
}

type RepairSelectionRule = "interior_near_empty_speck" | "terminal_tail_near_empty_speck";

interface RepairTarget extends ResourceProofInput {
  index: number;
  facts: ImageFacts;
  selectionRule: RepairSelectionRule;
}

const defaultMaxNearEmptyPixels = 16;
const defaultMaxNearEmptyRatio = 0.0002;
const defaultMinNeighborPixelRatio = 0.005;
const defaultMinTerminalPreviousPixelRatio = 0.002;
const minimumSequenceGroupSize = 8;

export class SvgaSequenceFrameRepairError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {}
  ) {
    super(message);
    this.name = "SvgaSequenceFrameRepairError";
  }
}

export async function repairSvgaSequenceFrameFlicker(
  sourceBytes: Uint8Array,
  options: SvgaSequenceFrameRepairOptions = {}
): Promise<SvgaSequenceFrameRepairResult> {
  const protoPath = options.protoPath ?? defaultProtoPath();
  const decoded = await decodeMovie(sourceBytes, protoPath);
  const images = normalizeImages(decoded.payload.images);
  const sprites = decoded.payload.sprites ?? [];
  const sourceSha256 = sha256(sourceBytes);
  const group = selectSequenceGroup(images, sprites);
  const target = selectRepairTarget(group, options);
  const transparentReplacementPng = new Uint8Array(encodeRgbaPng(createTransparentImage(target.width, target.height)));
  const editor = new SvgaImageResourceEditor(protoPath);
  const result = await editor.replaceImages(sourceBytes, [{
    resourceKey: target.resourceKey,
    pngBytes: transparentReplacementPng
  }], options.sourceName ?? "sequence-repair.svga", {
    milestoneId: "P3",
    headCommit: options.headCommit
  });
  const editedDecoded = await decodeMovie(result.editedBytes, protoPath);
  const editedImages = normalizeImages(editedDecoded.payload.images);
  const proof = buildAlphaProof(group, target.resourceKey, editedImages);
  const invariantSummary = {
    sourceUnchanged: sha256(sourceBytes) === sourceSha256,
    roundTripPassed: result.roundTripReport.passed === true,
    imageResourceKeySetStable: sortedKeys(images).join("\n") === sortedKeys(editedImages).join("\n"),
    spriteTimelineStable: digest(spriteTimelineDigestInput(sprites)) === digest(spriteTimelineDigestInput(editedDecoded.payload.sprites ?? [])),
    untouchedResourceHashesStable: proof
      .filter(({ changed }) => !changed)
      .every(({ beforeSha256, afterSha256 }) => beforeSha256 === afterSha256),
    onlySelectedResourceChanged: proof
      .filter(({ beforeSha256, afterSha256 }) => beforeSha256 !== afterSha256)
      .every(({ resourceKey }) => resourceKey === target.resourceKey),
    replacementDimensionsMatchOriginal: proof.find(({ resourceKey }) => resourceKey === target.resourceKey)?.width === target.width
      && proof.find(({ resourceKey }) => resourceKey === target.resourceKey)?.height === target.height,
    sequenceVisibilityWindowsDisjoint: sequenceVisibilityWindowsDisjoint(group.items)
  };
  const selectedProof = proof.find(({ resourceKey }) => resourceKey === target.resourceKey);
  const passed = Boolean(
    selectedProof
    && selectedProof.beforeNonTransparentPixelCount === target.facts.nonTransparentPixelCount
    && selectedProof.afterNonTransparentPixelCount === 0
    && proof.every(({ passed: itemPassed }) => itemPassed)
    && Object.values(invariantSummary).every(Boolean)
  );
  if (!passed || !selectedProof) {
    throw new SvgaSequenceFrameRepairError(
      "sequence_repair_invariant_failed",
      "Sequence frame repair failed fail-closed invariant checks.",
      { invariantSummary, repairedResourceKey: target.resourceKey }
    );
  }

  return {
    editedBytes: result.editedBytes,
    transparentReplacementPng,
    report: {
      schemaVersion: 1,
      repairId: "svga-sequence-frame-anti-flicker-v1",
      status: "repaired",
      sourceSha256,
      sourceSha256AfterRepair: sha256(sourceBytes),
      editedSha256: sha256(result.editedBytes),
      headCommit: options.headCommit ?? "",
      sequenceGroup: {
        groupId: group.groupId,
        detectionMethod: "continuous_numeric_resource_keys",
        resourceKeys: group.items.map(({ resourceKey }) => resourceKey),
        resourceKeyCount: group.items.length,
        repairedResourceKey: target.resourceKey,
        targetVisibleFrames: target.visibleFrameIndices,
        fullAffectedFrameVisibilityAlphaProof: proof
      },
      selectedRepair: {
        resourceKey: target.resourceKey,
        reason: "near_empty_visible_speck_frame",
        selectionRule: target.selectionRule,
        replacement: "same_dimensions_transparent_png",
        beforeNonTransparentPixelCount: selectedProof.beforeNonTransparentPixelCount,
        afterNonTransparentPixelCount: selectedProof.afterNonTransparentPixelCount,
        beforeNonTransparentRatio: selectedProof.beforeNonTransparentRatio,
        afterNonTransparentRatio: selectedProof.afterNonTransparentRatio,
        beforeSha256: selectedProof.beforeSha256,
        afterSha256: selectedProof.afterSha256
      },
      roundTripReport: result.roundTripReport,
      invariantSummary,
      productSaveAsEnabled: true,
      repairSuccessClaimed: true,
      manualVisualConfirmationRequired: false,
      failureClosed: true,
      unsafeCasePolicy: [
        "reject when no continuous numeric sequence group is detected",
        "reject when there is no near-empty visible speck frame",
        "reject when there is more than one near-empty visible speck frame",
        "reject when sequence resources share visible timeline frames",
        "reject when the target is the first frame in its sequence group",
        "reject when the target is the last frame unless it is a terminal-tail near-empty speck with two visible predecessor frames",
        "reject when neighboring frames do not have visible alpha content",
        "reject when any non-target resource hash changes",
        "reject when any sprite timeline, alpha, layout, transform, shape, audio, image key, or resource key invariant changes",
        "reject when the repaired SVGA cannot inflate, decode, reopen, and render"
      ],
      passed
    }
  };
}

function selectSequenceGroup(
  images: Readonly<Record<string, Uint8Array>>,
  sprites: readonly SpritePayload[]
) {
  const spriteRefs = spriteReferences(sprites);
  const groups = new Map<string, ResourceProofInput[]>();
  const detectionDetails: SequenceGroupDetectionDetails = {
    imageResourceCount: Object.keys(images).length,
    numericImageResourceCount: 0,
    skippedNonNumericResourceCount: 0,
    skippedReferenceMismatchCount: 0,
    skippedMatteReferenceCount: 0,
    skippedNoVisibleFramesCount: 0,
    groupCandidateCount: 0,
    longestContinuousSegmentLength: 0,
    minimumSequenceGroupSize,
    groupCandidateSamples: []
  };
  for (const [resourceKey, bytes] of Object.entries(images)) {
    const match = /^(.*?)(\d+)$/.exec(resourceKey);
    const refs = spriteRefs.get(resourceKey) ?? [];
    if (!match) {
      detectionDetails.skippedNonNumericResourceCount += 1;
      continue;
    }
    detectionDetails.numericImageResourceCount += 1;
    if (refs.length !== 1 || refs[0].imageKey !== resourceKey) {
      detectionDetails.skippedReferenceMismatchCount += 1;
      continue;
    }
    if (refs[0].matteKey) {
      detectionDetails.skippedMatteReferenceCount += 1;
      continue;
    }
    const facts = imageFacts(bytes);
    const sprite = sprites[refs[0].spriteIndex];
    const visibleFrameIndices = visibleFrames(sprite?.frames ?? []);
    if (visibleFrameIndices.length === 0) {
      detectionDetails.skippedNoVisibleFramesCount += 1;
      continue;
    }
    const groupId = `${match[1]}:${facts.width}x${facts.height}`;
    const group = groups.get(groupId) ?? [];
    group.push({
      resourceKey,
      numericIndex: Number(match[2]),
      frameIndex: Number(match[2]),
      spriteIndex: refs[0].spriteIndex,
      width: facts.width,
      height: facts.height,
      usageCount: refs.length,
      beforeBytes: bytes,
      afterBytes: bytes,
      visibleFrameIndices,
      maxTimelineAlpha: maxAlpha(sprite?.frames ?? []),
      timelineAlphaDigest: digest((sprite?.frames ?? []).map((frame) => Number(frame.alpha ?? 0)))
    });
    groups.set(groupId, group);
  }
  const groupCandidates = [...groups.entries()]
    .map(([groupId, items]) => {
      const sortedItems = [...items].sort((left, right) => left.numericIndex - right.numericIndex);
      return {
        groupId,
        sourceItems: sortedItems,
        items: continuousSegment(sortedItems)
      };
    });
  detectionDetails.groupCandidateCount = groupCandidates.length;
  detectionDetails.longestContinuousSegmentLength = groupCandidates.reduce(
    (longest, { items }) => Math.max(longest, items.length),
    0
  );
  detectionDetails.groupCandidateSamples = groupCandidates
    .map(({ groupId, sourceItems, items }) => ({
      groupId,
      resourceKeyCount: sourceItems.length,
      longestContinuousSegmentLength: items.length,
      resourceKeySamples: items.map(({ resourceKey }) => resourceKey).slice(0, 12)
    }))
    .sort((left, right) => (
      right.longestContinuousSegmentLength - left.longestContinuousSegmentLength
      || right.resourceKeyCount - left.resourceKeyCount
    ))
    .slice(0, 8);
  const candidates = groupCandidates
    .filter(({ items }) => items.length >= minimumSequenceGroupSize)
    .sort((left, right) => right.items.length - left.items.length);
  if (candidates.length === 0) {
    throw new SvgaSequenceFrameRepairError(
      "sequence_group_not_detected",
      "No continuous numeric PNG sequence group with visible timeline frames was detected.",
      detectionDetails
    );
  }
  return candidates[0];
}

function selectRepairTarget(
  group: ReturnType<typeof selectSequenceGroup>,
  options: SvgaSequenceFrameRepairOptions
) {
  const maxPixels = options.maxNearEmptyPixels ?? defaultMaxNearEmptyPixels;
  const maxRatio = options.maxNearEmptyRatio ?? defaultMaxNearEmptyRatio;
  const minNeighborRatio = options.minNeighborPixelRatio ?? defaultMinNeighborPixelRatio;
  const minTerminalPreviousRatio = options.minTerminalPreviousPixelRatio ?? defaultMinTerminalPreviousPixelRatio;
  const overlapSummary = sequenceVisibilityOverlapSummary(group.items);
  if (overlapSummary) {
    throw new SvgaSequenceFrameRepairError(
      "sequence_group_visibility_overlap_detected",
      "Sequence repair requires sequence resources to have non-overlapping visible timeline frames.",
      { groupId: group.groupId, ...overlapSummary }
    );
  }
  const itemsWithFacts = group.items.map((item, index) => ({
    ...item,
    index,
    facts: imageFacts(item.beforeBytes)
  }));
  const candidates = itemsWithFacts.filter(({ facts }) => (
    facts.nonTransparentPixelCount > 0
    && facts.nonTransparentPixelCount <= maxPixels
    && facts.nonTransparentRatio <= maxRatio
  ));
  if (candidates.length === 0) {
    throw new SvgaSequenceFrameRepairError(
      "sequence_near_empty_candidate_not_found",
      "No near-empty visible speck frame was detected in the sequence group.",
      {
        groupId: group.groupId,
        resourceKeyCount: group.items.length,
        maxPixels,
        maxRatio,
        smallestNonTransparentPixelCount: itemsWithFacts.reduce(
          (smallest, { facts }) => Math.min(smallest, facts.nonTransparentPixelCount),
          Number.POSITIVE_INFINITY
        ),
        resourcePixelSamples: itemsWithFacts
          .map(({ resourceKey, facts }) => ({
            resourceKey,
            nonTransparentPixelCount: facts.nonTransparentPixelCount,
            nonTransparentRatio: facts.nonTransparentRatio
          }))
          .sort((left, right) => (
            left.nonTransparentPixelCount - right.nonTransparentPixelCount
            || left.resourceKey.localeCompare(right.resourceKey)
          ))
          .slice(0, 12)
      }
    );
  }
  if (candidates.length > 1) {
    throw new SvgaSequenceFrameRepairError(
      "sequence_near_empty_candidate_not_unique",
      "Sequence repair refuses multiple near-empty visible speck frame candidates.",
      {
        candidateCount: candidates.length,
        candidateResourceKeys: candidates.map(({ resourceKey }) => resourceKey),
        maxPixels,
        maxRatio
      }
    );
  }
  const target = candidates[0];
  if (target.index <= 0) {
    throw new SvgaSequenceFrameRepairError(
      "sequence_near_empty_candidate_on_boundary",
      "Sequence repair refuses leading boundary frames because previous visual continuity cannot be proven.",
      { resourceKey: target.resourceKey }
    );
  }
  if (target.index >= group.items.length - 1) {
    return selectTerminalTailRepairTarget(group.items, target, {
      minNeighborRatio,
      minTerminalPreviousRatio
    });
  }
  const beforeNeighbor = imageFacts(group.items[target.index - 1].beforeBytes);
  const afterNeighbor = imageFacts(group.items[target.index + 1].beforeBytes);
  if (beforeNeighbor.nonTransparentRatio < minNeighborRatio || afterNeighbor.nonTransparentRatio < minNeighborRatio) {
    throw new SvgaSequenceFrameRepairError(
      "sequence_neighbor_visibility_insufficient",
      "Sequence repair requires visible neighboring frames around the near-empty speck frame.",
      {
        resourceKey: target.resourceKey,
        beforeNeighborRatio: beforeNeighbor.nonTransparentRatio,
        afterNeighborRatio: afterNeighbor.nonTransparentRatio,
        minNeighborRatio
      }
    );
  }
  return {
    ...target,
    selectionRule: "interior_near_empty_speck" as const
  };
}

function selectTerminalTailRepairTarget(
  groupItems: readonly ResourceProofInput[],
  target: Omit<RepairTarget, "selectionRule">,
  thresholds: { minNeighborRatio: number; minTerminalPreviousRatio: number }
): RepairTarget {
  const previous = imageFacts(groupItems[target.index - 1].beforeBytes);
  const previous2 = imageFacts(groupItems[target.index - 2].beforeBytes);
  if (
    previous.nonTransparentRatio < thresholds.minTerminalPreviousRatio
    || previous2.nonTransparentRatio < thresholds.minNeighborRatio
  ) {
    throw new SvgaSequenceFrameRepairError(
      "sequence_terminal_tail_context_insufficient",
      "Sequence repair refuses terminal near-empty specks unless two predecessor frames prove visible tail continuity.",
      {
        resourceKey: target.resourceKey,
        previousNeighborRatio: previous.nonTransparentRatio,
        secondPreviousNeighborRatio: previous2.nonTransparentRatio,
        minTerminalPreviousRatio: thresholds.minTerminalPreviousRatio,
        minNeighborRatio: thresholds.minNeighborRatio
      }
    );
  }
  return {
    ...target,
    selectionRule: "terminal_tail_near_empty_speck"
  };
}

function buildAlphaProof(
  group: ReturnType<typeof selectSequenceGroup>,
  repairedResourceKey: string,
  editedImages: Readonly<Record<string, Uint8Array>>
): SvgaSequenceFrameAlphaProof[] {
  return group.items.map((item) => {
    const afterBytes = editedImages[item.resourceKey];
    if (!afterBytes) {
      throw new SvgaSequenceFrameRepairError(
        "sequence_repaired_resource_missing",
        "A sequence resource is missing after repair.",
        { resourceKey: item.resourceKey }
      );
    }
    const before = imageFacts(item.beforeBytes);
    const after = imageFacts(afterBytes);
    const changed = sha256(item.beforeBytes) !== sha256(afterBytes);
    const expectedChanged = item.resourceKey === repairedResourceKey;
    const passed = before.width === after.width
      && before.height === after.height
      && changed === expectedChanged
      && (!expectedChanged || after.nonTransparentPixelCount === 0)
      && (expectedChanged || before.nonTransparentPixelCount === after.nonTransparentPixelCount);
    return {
      resourceKey: item.resourceKey,
      spriteIndex: item.spriteIndex,
      frameIndex: item.frameIndex,
      usageCount: item.usageCount,
      width: item.width,
      height: item.height,
      beforeSha256: sha256(item.beforeBytes),
      afterSha256: sha256(afterBytes),
      beforeNonTransparentPixelCount: before.nonTransparentPixelCount,
      afterNonTransparentPixelCount: after.nonTransparentPixelCount,
      beforeNonTransparentRatio: before.nonTransparentRatio,
      afterNonTransparentRatio: after.nonTransparentRatio,
      beforeAlphaBounds: before.alphaBounds,
      afterAlphaBounds: after.alphaBounds,
      visibleFrameIndices: item.visibleFrameIndices,
      maxTimelineAlpha: item.maxTimelineAlpha,
      timelineAlphaDigest: item.timelineAlphaDigest,
      changed,
      changeReason: expectedChanged ? "near_empty_speck_to_transparent" : "unchanged",
      passed
    };
  });
}

function imageFacts(bytes: Uint8Array): ImageFacts {
  const image = decodeRgbaPng(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  let nonTransparentPixelCount = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.pixels[(y * image.width + x) * 4 + 3];
      if (alpha <= 0) continue;
      nonTransparentPixelCount += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const totalPixels = image.width * image.height;
  return {
    width: image.width,
    height: image.height,
    nonTransparentPixelCount,
    nonTransparentRatio: totalPixels > 0 ? nonTransparentPixelCount / totalPixels : 0,
    alphaBounds: nonTransparentPixelCount > 0
      ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
      : null
  };
}

function spriteReferences(sprites: readonly SpritePayload[]) {
  const references = new Map<string, Array<{ spriteIndex: number; imageKey?: string; matteKey?: string }>>();
  sprites.forEach((sprite, spriteIndex) => {
    for (const key of [sprite.imageKey, sprite.matteKey]) {
      if (!key) continue;
      const list = references.get(key) ?? [];
      list.push({ spriteIndex, imageKey: sprite.imageKey, matteKey: sprite.matteKey });
      references.set(key, list);
    }
  });
  return references;
}

function visibleFrames(frames: readonly ({ alpha?: number } & Record<string, unknown>)[]): number[] {
  return frames
    .map((frame, index) => Number(frame.alpha ?? 0) > 0.001 ? index : -1)
    .filter((index) => index >= 0);
}

function sequenceVisibilityWindowsDisjoint(items: readonly ResourceProofInput[]): boolean {
  return !sequenceVisibilityOverlapSummary(items);
}

function sequenceVisibilityOverlapSummary(items: readonly ResourceProofInput[]): SequenceVisibilityOverlapSummary | null {
  const frameOwners = new Map<number, Set<string>>();
  for (const item of items) {
    if (item.visibleFrameIndices.length === 0) {
      return {
        overlapFrameCount: 1,
        overlapFrameSamples: [{ frameIndex: -1, resourceKeys: [item.resourceKey] }],
        overlappingResourceKeys: [item.resourceKey]
      };
    }
    for (const frameIndex of item.visibleFrameIndices) {
      const owners = frameOwners.get(frameIndex) ?? new Set<string>();
      owners.add(item.resourceKey);
      frameOwners.set(frameIndex, owners);
    }
  }
  const overlapFrameSamples = [...frameOwners.entries()]
    .filter(([, owners]) => owners.size > 1)
    .sort(([left], [right]) => left - right)
    .map(([frameIndex, owners]) => ({
      frameIndex,
      resourceKeys: [...owners].sort()
    }));
  if (overlapFrameSamples.length === 0) return null;
  return {
    overlapFrameCount: overlapFrameSamples.length,
    overlapFrameSamples: overlapFrameSamples.slice(0, 12),
    overlappingResourceKeys: [...new Set(overlapFrameSamples.flatMap(({ resourceKeys }) => resourceKeys))].sort()
  };
}

function maxAlpha(frames: readonly ({ alpha?: number } & Record<string, unknown>)[]): number {
  return frames.reduce((maximum, frame) => Math.max(maximum, Number(frame.alpha ?? 0)), 0);
}

function continuousSegment(items: ResourceProofInput[]): ResourceProofInput[] {
  let best: ResourceProofInput[] = [];
  let current: ResourceProofInput[] = [];
  for (const item of items) {
    const previous = current[current.length - 1];
    if (previous && item.numericIndex !== previous.numericIndex + 1) {
      if (current.length > best.length) best = current;
      current = [];
    }
    current.push(item);
  }
  return current.length > best.length ? current : best;
}

async function decodeMovie(bytes: Uint8Array, protoPath: string): Promise<DecodedMovie> {
  try {
    const root = await protobuf.load(protoPath);
    const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
    const decoded = MovieEntity.decode(inflateSync(bytes));
    return {
      payload: MovieEntity.toObject(decoded, {
        bytes: Buffer,
        defaults: true
      }) as KnownMoviePayload
    };
  } catch (error) {
    throw new SvgaSequenceFrameRepairError(
      "sequence_repair_decode_failed",
      "SVGA could not be inflated and decoded for sequence repair.",
      { reason: error instanceof Error ? error.message : String(error) }
    );
  }
}

function normalizeImages(images: KnownMoviePayload["images"]): Record<string, Uint8Array> {
  return Object.fromEntries(
    Object.entries(images ?? {}).map(([key, value]) => [key, asUint8Array(value)])
  );
}

function asUint8Array(value: Uint8Array): Uint8Array {
  return value instanceof Uint8Array
    ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    : new Uint8Array(value);
}

function spriteTimelineDigestInput(sprites: readonly SpritePayload[]) {
  return sprites.map((sprite) => ({
    imageKey: sprite.imageKey ?? "",
    matteKey: sprite.matteKey ?? "",
    frames: sprite.frames ?? []
  }));
}

function sortedKeys(value: Readonly<Record<string, unknown>>): string[] {
  return Object.keys(value).sort();
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function defaultProtoPath(): string {
  return fileURLToPath(new URL("../../../proto/svga.proto", import.meta.url));
}
