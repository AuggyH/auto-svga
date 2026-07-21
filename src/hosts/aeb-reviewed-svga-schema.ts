import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import protobuf from "protobufjs";
import { AebBakePipelineError } from "../workbench/aeb-bake-pipeline.js";

export const AEB_REVIEWED_SVGA_PROTO_FILE_SHA256 = "d7905e99444ba4e361fd4fef685d51e6fb6137b4f052b56216ca59ed81964f19" as const;

const MAX_REVIEWED_PROTO_BYTES = 128 * 1024;
const reviewedProtoPath = fileURLToPath(new URL("../../proto/svga.proto", import.meta.url));

const REVIEWED_SVGA_DESCRIPTOR = {
  nested: {
    com: {
      nested: {
        opensource: {
          nested: {
            svga: {
              nested: {
                MovieParams: {
                  fields: {
                    viewBoxWidth: { type: "float", id: 1 },
                    viewBoxHeight: { type: "float", id: 2 },
                    fps: { type: "int32", id: 3 },
                    frames: { type: "int32", id: 4 }
                  }
                },
                SpriteEntity: {
                  fields: {
                    imageKey: { type: "string", id: 1 },
                    frames: { rule: "repeated", type: "FrameEntity", id: 2 },
                    matteKey: { type: "string", id: 3 }
                  }
                },
                AudioEntity: {
                  fields: {
                    audioKey: { type: "string", id: 1 },
                    startFrame: { type: "int32", id: 2 },
                    endFrame: { type: "int32", id: 3 },
                    startTime: { type: "int32", id: 4 },
                    totalTime: { type: "int32", id: 5 }
                  }
                },
                Layout: {
                  fields: {
                    x: { type: "float", id: 1 },
                    y: { type: "float", id: 2 },
                    width: { type: "float", id: 3 },
                    height: { type: "float", id: 4 }
                  }
                },
                Transform: {
                  fields: {
                    a: { type: "float", id: 1 },
                    b: { type: "float", id: 2 },
                    c: { type: "float", id: 3 },
                    d: { type: "float", id: 4 },
                    tx: { type: "float", id: 5 },
                    ty: { type: "float", id: 6 }
                  }
                },
                FrameEntity: {
                  fields: {
                    alpha: { type: "float", id: 1 },
                    layout: { type: "Layout", id: 2 },
                    transform: { type: "Transform", id: 3 },
                    clipPath: { type: "string", id: 4 }
                  }
                },
                MovieEntity: {
                  fields: {
                    version: { type: "string", id: 1 },
                    params: { type: "MovieParams", id: 2 },
                    images: { keyType: "string", type: "bytes", id: 3 },
                    sprites: { rule: "repeated", type: "SpriteEntity", id: 4 },
                    audios: { rule: "repeated", type: "AudioEntity", id: 5 }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
} as const;

export const AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256 = "2f1d15330ba51ef8b90d374bc2321d377dac368185459e9fd724a28504d4af7a" as const;

export interface AebReviewedSvgaSchemaBinding {
  protoFileSha256: typeof AEB_REVIEWED_SVGA_PROTO_FILE_SHA256;
  descriptorSha256: typeof AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256;
}

export interface AebReviewedSvgaSchemaAuthority extends AebReviewedSvgaSchemaBinding {
  encoderMovieEntity: protobuf.Type;
  reopenMovieEntity: protobuf.Type;
}

export interface AebReviewedSvgaSchemaProbeHooks {
  afterRead?(): Promise<void> | void;
}

export interface AebReviewedSvgaSchemaProbeResult extends AebReviewedSvgaSchemaBinding {
  valid: boolean;
  code?: string;
}

export async function loadAebReviewedSvgaSchemaAuthority(): Promise<AebReviewedSvgaSchemaAuthority> {
  const bytes = await readPinnedReviewedProto(reviewedProtoPath);
  const encoderRoot = protobuf.parse(bytes.toString("utf8")).root.resolveAll();
  const reopenRoot = createReviewedDescriptorRoot();
  const encoderMovieEntity = encoderRoot.lookupType("com.opensource.svga.MovieEntity");
  const reopenMovieEntity = reopenRoot.lookupType("com.opensource.svga.MovieEntity");
  return {
    protoFileSha256: AEB_REVIEWED_SVGA_PROTO_FILE_SHA256,
    descriptorSha256: AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256,
    encoderMovieEntity,
    reopenMovieEntity
  };
}

export async function runAebReviewedSvgaSchemaSourceProbe(
  candidatePath: string,
  hooks: AebReviewedSvgaSchemaProbeHooks = {}
): Promise<AebReviewedSvgaSchemaProbeResult> {
  try {
    const bytes = await readPinnedReviewedProto(candidatePath, hooks);
    const encoder = protobuf.parse(bytes.toString("utf8")).root
      .lookupType("com.opensource.svga.MovieEntity");
    const reopen = createReviewedDescriptorRoot()
      .lookupType("com.opensource.svga.MovieEntity");
    if (encoder.fields.images?.id !== reopen.fields.images?.id
      || encoder.fields.sprites?.id !== reopen.fields.sprites?.id
      || encoder.fields.audios?.id !== reopen.fields.audios?.id) {
      fail("SVGA_SCHEMA_DESCRIPTOR_MISMATCH", "SVGA schema field authority does not match the reviewed descriptor.");
    }
    return {
      valid: true,
      protoFileSha256: AEB_REVIEWED_SVGA_PROTO_FILE_SHA256,
      descriptorSha256: AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256
    };
  } catch (error) {
    return {
      valid: false,
      protoFileSha256: AEB_REVIEWED_SVGA_PROTO_FILE_SHA256,
      descriptorSha256: AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256,
      code: error instanceof AebBakePipelineError ? error.code : "SVGA_SCHEMA_AUTHORITY_INVALID"
    };
  }
}

export function verifyAebReviewedSvgaDescriptorSourceProbe(candidate: unknown): boolean {
  return sha256(Buffer.from(canonicalJson(candidate))) === AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256;
}

function createReviewedDescriptorRoot(): protobuf.Root {
  if (!verifyAebReviewedSvgaDescriptorSourceProbe(REVIEWED_SVGA_DESCRIPTOR)) {
    fail("SVGA_SCHEMA_DESCRIPTOR_HASH_MISMATCH", "Fixed SVGA descriptor does not match its reviewed hash.");
  }
  return protobuf.Root.fromJSON(REVIEWED_SVGA_DESCRIPTOR as protobuf.INamespace);
}

async function readPinnedReviewedProto(
  candidatePath: string,
  hooks: AebReviewedSvgaSchemaProbeHooks = {}
): Promise<Buffer> {
  const handle = await open(candidatePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()
      || before.nlink !== 1n
      || before.size <= 0n
      || before.size > BigInt(MAX_REVIEWED_PROTO_BYTES)) {
      fail("SVGA_SCHEMA_FILE_IDENTITY_INVALID", "Reviewed SVGA schema is not a bounded exclusive regular file.");
    }
    const bytes = await readBounded(handle, MAX_REVIEWED_PROTO_BYTES);
    await hooks.afterRead?.();
    const after = await handle.stat({ bigint: true });
    const current = await lstat(candidatePath, { bigint: true });
    if (!sameIdentity(before, after)
      || !sameIdentity(after, current)
      || BigInt(bytes.byteLength) !== after.size) {
      fail("SVGA_SCHEMA_FILE_CHANGED", "Reviewed SVGA schema identity or bytes changed while authority was established.");
    }
    if (sha256(bytes) !== AEB_REVIEWED_SVGA_PROTO_FILE_SHA256) {
      fail("SVGA_SCHEMA_FILE_HASH_MISMATCH", "SVGA schema bytes do not match the reviewed canonical file.");
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

async function readBounded(handle: import("node:fs/promises").FileHandle, maxBytes: number): Promise<Buffer> {
  const buffer = Buffer.alloc(maxBytes + 1);
  let offset = 0;
  while (offset < buffer.byteLength) {
    const { bytesRead } = await handle.read(buffer, offset, buffer.byteLength - offset, offset);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  if (offset <= 0 || offset > maxBytes) {
    fail("SVGA_SCHEMA_FILE_BUDGET_EXCEEDED", "Reviewed SVGA schema exceeds its bounded read budget.");
  }
  return buffer.subarray(0, offset);
}

function sameIdentity(
  left: import("node:fs").BigIntStats,
  right: import("node:fs").BigIntStats
): boolean {
  return left.isFile()
    && right.isFile()
    && left.dev === right.dev
    && left.ino === right.ino
    && left.nlink === 1n
    && right.nlink === 1n
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
