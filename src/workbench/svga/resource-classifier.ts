import type {
  MotionDimensions,
  MotionResourceRole
} from "../contracts.js";
import type {
  SvgaImageInspection,
  SvgaSpriteInspection
} from "./types.js";

export interface SvgaResourceClassificationInput {
  images: ReadonlyArray<SvgaImageInspection & { dimensions?: MotionDimensions }>;
  sprites: readonly SvgaSpriteInspection[];
}

export interface SvgaResourceClassification {
  role: MotionResourceRole;
  evidence: readonly string[];
}

export function classifySvgaResources(
  input: SvgaResourceClassificationInput
): ReadonlyMap<string, SvgaResourceClassification> {
  const matteKeys = new Set(
    input.sprites.map(({ matteKey }) => matteKey).filter(Boolean)
  );
  const referencedKeys = new Set(
    input.sprites.map(({ imageKey }) => imageKey).filter(Boolean)
  );
  const sequenceKeys = findSequenceKeys(input.images);

  return new Map(input.images.map((image) => {
    const { imageKey } = image;
    if (matteKeys.has(imageKey)) {
      return [imageKey, classification("mask_or_matte", "referenced_by_matteKey")];
    }
    if (hasMaskOrMatteToken(imageKey)) {
      return [imageKey, classification("mask_or_matte", "mask_or_matte_name_token")];
    }
    if (isBakedSweepName(imageKey)) {
      return [imageKey, classification("baked_sweep_frame", "baked_sweep_name_pattern")];
    }
    if (sequenceKeys.has(imageKey)) {
      return [imageKey, classification("sequence_frame", "continuous_numbered_group")];
    }
    if (referencedKeys.has(imageKey)) {
      return [imageKey, classification("static_image", "referenced_by_sprite")];
    }
    return [imageKey, classification("unknown", "insufficient_evidence")];
  }));
}

function findSequenceKeys(
  images: SvgaResourceClassificationInput["images"]
): ReadonlySet<string> {
  const groups = new Map<string, Array<{ imageKey: string; frame: number }>>();
  for (const image of images) {
    const match = /^(.*?)(\d+)$/.exec(image.imageKey);
    if (!match || match[1].length === 0 || !image.dimensions) {
      continue;
    }
    const dimensions = `${image.dimensions.width}x${image.dimensions.height}`;
    const groupKey = `${match[1]}\u0000${dimensions}`;
    const group = groups.get(groupKey) ?? [];
    group.push({ imageKey: image.imageKey, frame: Number(match[2]) });
    groups.set(groupKey, group);
  }

  const sequenceKeys = new Set<string>();
  for (const group of groups.values()) {
    const sorted = [...group].sort((left, right) => left.frame - right.frame);
    let segment = [sorted[0]];
    for (let index = 1; index < sorted.length; index += 1) {
      const current = sorted[index];
      const previous = sorted[index - 1];
      if (current.frame === previous.frame + 1) {
        segment.push(current);
      } else {
        addSequenceSegment(sequenceKeys, segment);
        segment = [current];
      }
    }
    addSequenceSegment(sequenceKeys, segment);
  }
  return sequenceKeys;
}

function addSequenceSegment(
  sequenceKeys: Set<string>,
  segment: readonly { imageKey: string }[]
): void {
  if (segment.length < 3) {
    return;
  }
  segment.forEach(({ imageKey }) => sequenceKeys.add(imageKey));
}

function hasMaskOrMatteToken(imageKey: string): boolean {
  return /(?:^|[_.-])(?:mask|matte)(?=$|[_.-]|\d)/i.test(imageKey);
}

function isBakedSweepName(imageKey: string): boolean {
  if (!/(?:^|[_.-])sweep(?:$|[_.-]|\d)/i.test(imageKey)) {
    return false;
  }
  return /(?:baked|masked|core|soft|light)/i.test(imageKey)
    || /\d+$/.test(imageKey);
}

function classification(
  role: MotionResourceRole,
  evidence: string
): SvgaResourceClassification {
  return { role, evidence: [evidence] };
}
