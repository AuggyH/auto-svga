import assert from "node:assert/strict";
import test from "node:test";

import {
  VAP_COMPATIBILITY_MAX_DIMENSION,
  VAP_INSPECTION_READINESS_GATE,
  VapFormatAdapter,
  VapInspectionService,
  type VapInspectionSource
} from "../workbench/vap-inspection.js";

const textEncoder = new TextEncoder();

test("VAP inspection requires the explicit hidden 0.2 gate before reading", async () => {
  let reads = 0;
  const result = await service().inspect(memorySource("effect.mp4", validVapBytes(), {
    onRead: () => { reads += 1; }
  }), { gate: "0.1" });

  assert.equal(result.value, undefined);
  assert.equal(result.issues[0]?.code, "unsupported");
  assert.equal(result.issues[0]?.details?.reason, "gate_required");
  assert.equal(reads, 0);
});

test("VAP adapter reuses the WP1 registry and normalizes vapc dimensions timing and container facts", async () => {
  const adapter = new VapFormatAdapter();
  const source = memorySource("/Users/designer/private/effect.mp4", validVapBytes(), {
    mediaType: "video/mp4"
  });
  const probe = await adapter.probe(source);
  const result = await adapter.parse(source);

  assert.equal(probe.format, "vap");
  assert.equal(probe.confidence, 1);
  assert.equal(result.issues.length, 0);
  assert.equal(result.value?.format, "vap");
  assert.equal(result.value?.name, "effect.mp4");
  assert.equal(result.value?.dimensions?.width, 720);
  assert.equal(result.value?.dimensions?.height, 405);
  assert.deepEqual(result.value?.timing, { fps: 30, frameCount: 60, durationMs: 2000 });
  assert.equal(vapMetadata(result).container.videoCodec, "avc1");
  assert.equal(vapMetadata(result).container.audioPresent, false);
  assert.equal(vapMetadata(result).container.videoPresent, true);
  assert.equal(vapMetadata(result).playbackReadiness.runtimeIntegrated, false);
  assertRedacted(result);
});

test("normalizes VAP image and text fusion elements with placement metadata", async () => {
  const result = await service().inspect(
    memorySource("fusion.mp4", validVapBytes({
      src: [
        { srcId: 1, srcType: "image", srcTag: "avatar", w: 120, h: 120, fitType: "centerCrop" },
        { srcId: 2, srcType: "text", srcTag: "nickname", color: "#ffffff", style: "bold" }
      ],
      frame: [{
        i: 0,
        obj: [
          { srcId: 1, z: 3, frame: { x: 10, y: 20, w: 120, h: 120 }, mFrame: { x: 0, y: 0, w: 120, h: 120 }, mt: 0 },
          { srcId: 2, z: 4, frame: { x: 160, y: 20, w: 200, h: 40 }, mFrame: { x: 0, y: 0, w: 200, h: 40 }, mt: 0 }
        ]
      }]
    })),
    { gate: VAP_INSPECTION_READINESS_GATE, providedFusionTags: ["avatar", "nickname"] }
  );

  assert.equal(result.issues.length, 0);
  assert.equal(result.value?.resources.length, 2);
  assert.equal(result.value?.layers.length, 2);
  assert.deepEqual(result.value?.resources.map(({ kind }) => kind), ["image", "unknown"]);
  assert.deepEqual(result.value?.layers.map(({ kind }) => kind), ["vap_fusion_image", "vap_fusion_text"]);
  assert.deepEqual(result.value?.layers.map(({ replaceable }) => replaceable), [true, true]);
  assert.equal(result.value?.resources[0]?.metadata?.srcTag, "avatar");
  assert.deepEqual(result.value?.resources[0]?.dimensions, { width: 120, height: 120 });
  assert.equal(result.value?.layers[0]?.metadata?.placementCount, 1);
  assert.deepEqual(result.value?.layers[0]?.metadata?.zValues, [3]);
  assert.equal(vapMetadata(result).fusion.imageSourceCount, 1);
  assert.equal(vapMetadata(result).fusion.textSourceCount, 1);
  assert.equal(vapMetadata(result).fusion.placementCount, 2);
  assert.equal(vapMetadata(result).fusion.missingReplacementCount, 0);
});

test("reports missing fusion runtime data without reading or committing external assets", async () => {
  const result = await service().inspect(
    memorySource("missing-fusion-assets.mp4", validVapBytes({
      src: [
        { srcId: "avatar", srcType: "image", srcTag: "user_avatar" },
        { srcId: "name", srcType: "text", srcTag: "user_name" }
      ]
    })),
    { gate: VAP_INSPECTION_READINESS_GATE }
  );

  assert.ok(result.value);
  assert.deepEqual(result.issues.map(({ code }) => code), ["missing_resource", "missing_resource"]);
  assert.deepEqual(
    result.issues.map(({ details }) => details?.reason),
    ["fusion_replacement_required", "fusion_replacement_required"]
  );
  assert.equal(vapMetadata(result).fusion.missingReplacementCount, 2);
});

test("fails closed for ambiguous or dangling VAP fusion structure", async () => {
  for (const [document, code, reason] of [
    [{
      src: [
        { srcId: "dup", srcType: "image", srcTag: "avatar_a" },
        { srcId: "dup", srcType: "image", srcTag: "avatar_b" }
      ]
    }, "ambiguous", "ambiguous_fusion_source_id"],
    [{
      frame: [{ i: 0, obj: [{ srcId: "missing", z: 1 }] }]
    }, "parse_precondition", "missing_fusion_source"]
  ] as const) {
    const result = await service().inspect(
      memorySource("ambiguous-fusion.mp4", validVapBytes(document)),
      { gate: VAP_INSPECTION_READINESS_GATE }
    );

    assert.equal(result.value, undefined);
    assert.ok(result.issues.some((issue) =>
      issue.code === code && issue.details?.reason === reason
    ));
  }
});

test("fails closed for ordinary MP4 false positives and corrupt vapc states", async () => {
  for (const [bytes, reason] of [
    [ordinaryMp4Bytes(), "embedded_vapc_box_required"],
    [concatBytes(ftypBox(), mp4Box("vapc", new Uint8Array())), "vapc_payload_required"],
    [concatBytes(ftypBox(), mp4Box("vapc", textEncoder.encode("{"))), "valid_vapc_json_required"],
    [concatBytes(ftypBox(), mp4Box("vapc", textEncoder.encode("{}"))), "vapc_info_required"],
    [concatBytes(ftypBox(), mp4Box("vapc", vapcPayload({ info: vapInfo() }))), "video_track_required"],
    [concatBytes(ftypBox(), mp4Box("vapc", textEncoder.encode("{}")), new Uint8Array([0])), "valid_mp4_boxes_required"]
  ] as const) {
    const result = await service().inspect(
      memorySource("bad.mp4", bytes),
      { gate: VAP_INSPECTION_READINESS_GATE }
    );

    assert.equal(result.value, undefined);
    assert.equal(result.issues[0]?.details?.reason, reason);
  }
});

test("retains VAP readiness facts when a bounded prefix clips trailing media data after vapc", async () => {
  const bytes = concatBytes(
    validVapBytes(),
    declaredSizeBox("mdat", new Uint8Array([1, 2, 3, 4]), 2_000_000)
  );
  const result = await service().inspect(
    memorySource("bounded-prefix.mp4", bytes, {
      sizeBytes: 3_000_000,
      readRange: true
    }),
    { gate: VAP_INSPECTION_READINESS_GATE }
  );

  assert.ok(result.value);
  assert.equal(result.value.format, "vap");
  assert.equal(vapMetadata(result).container.videoCodec, "avc1");
  assert.equal(vapMetadata(result).container.videoPresent, true);
  assert.equal(vapMetadata(result).container.boundedSampleTruncated, true);
  assert.equal(vapMetadata(result).container.clippedTrailingMediaData?.boxType, "mdat");
  assert.notEqual(result.issues[0]?.details?.reason, "valid_mp4_boxes_required");
});

test("fails closed for malformed MP4 boxes including overflow and ambiguous vapc", async () => {
  const declaredOverflow = new Uint8Array([0, 0, 0, 100, 0x66, 0x74, 0x79, 0x70]);
  const sizeZero = mp4SizeZeroBox("ftyp", textEncoder.encode("isom\u0000\u0000\u0002\u0000isom"));
  const ambiguous = concatBytes(
    ftypBox(),
    mp4Box("vapc", vapcPayload({ info: vapInfo() })),
    mp4Box("vapc", vapcPayload({ info: vapInfo() }))
  );
  const clippedMdatBeforeVapc = concatBytes(
    ftypBox(),
    declaredSizeBox("mdat", new Uint8Array([1, 2, 3, 4]), 2_000_000),
    mp4Box("vapc", vapcPayload({ info: vapInfo() }))
  );
  const clippedVapc = concatBytes(
    ftypBox(),
    moovBox(),
    declaredSizeBox("vapc", vapcPayload({ info: vapInfo() }).slice(0, 12), 2_000)
  );

  for (const [bytes, code] of [
    [declaredOverflow, "parse_precondition"],
    [sizeZero, "parse_precondition"],
    [ambiguous, "ambiguous"],
    [clippedMdatBeforeVapc, "parse_precondition"],
    [clippedVapc, "parse_precondition"]
  ] as const) {
    const result = await service().inspect(
      memorySource("malformed.mp4", bytes),
      { gate: VAP_INSPECTION_READINESS_GATE }
    );

    assert.equal(result.value, undefined);
    assert.equal(result.issues[0]?.code, code);
  }
});

test("reports audio presence and non-H264 readiness risks", async () => {
  const audio = await service().inspect(
    memorySource("audio.mp4", validVapBytes(undefined, {
      audio: true
    })),
    { gate: VAP_INSPECTION_READINESS_GATE }
  );
  const h265 = await service().inspect(
    memorySource("h265.mp4", validVapBytes(undefined, {
      videoCodec: "hvc1"
    })),
    { gate: VAP_INSPECTION_READINESS_GATE }
  );

  assert.equal(vapMetadata(audio).container.audioPresent, true);
  assert.equal(h265.value?.format, "vap");
  assert.equal(vapMetadata(h265).container.videoCodec, "hvc1");
  assert.ok(h265.issues.some(({ code, details }) =>
    code === "unsupported_feature" && details?.feature === "non_h264_video_codec"
  ));
});

test("flags dimensions over the 1504 VAP compatibility limit without claiming playback support", async () => {
  const result = await service().inspect(
    memorySource("oversize.mp4", validVapBytes({
      info: {
        ...vapInfo(),
        w: VAP_COMPATIBILITY_MAX_DIMENSION + 1,
        h: 900,
        videoW: 1600,
        videoH: 900
      }
    })),
    { gate: VAP_INSPECTION_READINESS_GATE }
  );

  assert.ok(result.value);
  assert.equal(result.value.dimensions?.width, VAP_COMPATIBILITY_MAX_DIMENSION + 1);
  assert.ok(result.issues.some(({ code, details }) =>
    code === "capability" && details?.reason === "vap_dimensions_over_1504"
  ));
  assert.equal(vapMetadata(result).playbackReadiness.dependencyApproved, false);
});

test("uses bounded range reads when available and does not trust underreported size metadata", async () => {
  const bytes = validVapBytes();
  let fullReads = 0;
  const ranges: Array<[number, number]> = [];
  const source: VapInspectionSource = {
    id: "underreported-vap",
    name: "underreported.mp4",
    sizeBytes: 1,
    mediaType: "video/mp4",
    async read() {
      fullReads += 1;
      return concatBytes(bytes, new Uint8Array(300_000));
    },
    async readRange(offset, length) {
      ranges.push([offset, length]);
      return bytes.slice(offset, offset + length);
    }
  };
  const result = await service().inspect(source, { gate: VAP_INSPECTION_READINESS_GATE });

  assert.ok(result.value);
  assert.equal(fullReads, 0);
  assert.deepEqual(ranges, [[0, 262_144]]);
});

test("uses bounded range reads when size metadata is unavailable", async () => {
  const bytes = validVapBytes();
  let fullReads = 0;
  const ranges: Array<[number, number]> = [];
  const source: VapInspectionSource = {
    id: "unknown-size-vap",
    name: "unknown-size.mp4",
    sizeBytes: Number.NaN,
    mediaType: "video/mp4",
    async read() {
      fullReads += 1;
      return concatBytes(bytes, new Uint8Array(300_000));
    },
    async readRange(offset, length) {
      ranges.push([offset, length]);
      return bytes.slice(offset, offset + length);
    }
  };
  const result = await service().inspect(source, { gate: VAP_INSPECTION_READINESS_GATE });

  assert.ok(result.value);
  assert.equal(result.value.format, "vap");
  assert.equal(result.value.sizeBytes, bytes.byteLength);
  assert.equal(fullReads, 0);
  assert.deepEqual(ranges, [[0, 262_144]]);
});

test("large VAP sources without range reads fail closed instead of loading full media", async () => {
  let reads = 0;
  const source: VapInspectionSource = {
    id: "large-vap",
    name: "large.mp4",
    sizeBytes: 5_000_000,
    mediaType: "video/mp4",
    async read() {
      reads += 1;
      return validVapBytes();
    }
  };
  const result = await service().inspect(source, { gate: VAP_INSPECTION_READINESS_GATE });

  assert.equal(result.value, undefined);
  assert.equal(result.issues[0]?.code, "parse_precondition");
  assert.equal(result.issues[0]?.details?.reason, "bounded_read_required");
  assert.equal(reads, 0);
});

function service(): VapInspectionService {
  return new VapInspectionService();
}

function validVapBytes(
  vapcOverrides: Record<string, unknown> | undefined = undefined,
  mp4Options: { videoCodec?: string; audio?: boolean } = {}
): Uint8Array {
  return concatBytes(
    ftypBox(),
    moovBox(mp4Options),
    mp4Box("vapc", vapcPayload({
      info: vapInfo(),
      ...vapcOverrides
    }))
  );
}

function ordinaryMp4Bytes(): Uint8Array {
  return concatBytes(
    ftypBox(),
    moovBox(),
    mp4Box("free", new Uint8Array([1, 2, 3]))
  );
}

function vapInfo(): Record<string, unknown> {
  return {
    v: 2,
    f: 60,
    w: 720,
    h: 405,
    videoW: 720,
    videoH: 810,
    fps: 30,
    isVapx: false,
    aFrame: { x: 0, y: 405, w: 720, h: 405 },
    rgbFrame: { x: 0, y: 0, w: 720, h: 405 }
  };
}

function vapcPayload(document: Record<string, unknown>): Uint8Array {
  return textEncoder.encode(JSON.stringify(document));
}

function ftypBox(): Uint8Array {
  return mp4Box("ftyp", concatBytes(
    textEncoder.encode("isom"),
    u32(512),
    textEncoder.encode("isom"),
    textEncoder.encode("mp42")
  ));
}

function moovBox(options: { videoCodec?: string; audio?: boolean } = {}): Uint8Array {
  const tracks = [trackBox("vide", options.videoCodec ?? "avc1")];
  if (options.audio) tracks.push(trackBox("soun", "mp4a"));
  return mp4Box("moov", concatBytes(
    mvhdBox(1_000, 2_000),
    ...tracks
  ));
}

function trackBox(handler: "vide" | "soun", sampleEntry: string): Uint8Array {
  return mp4Box("trak", mp4Box("mdia", concatBytes(
    hdlrBox(handler),
    mp4Box("minf", mp4Box("stbl", stsdBox(sampleEntry)))
  )));
}

function mvhdBox(timescale: number, duration: number): Uint8Array {
  const payload = new Uint8Array(20);
  const view = new DataView(payload.buffer);
  view.setUint32(12, timescale);
  view.setUint32(16, duration);
  return mp4Box("mvhd", payload);
}

function hdlrBox(handler: string): Uint8Array {
  assert.equal(handler.length, 4);
  const payload = new Uint8Array(12);
  payload.set(textEncoder.encode(handler), 8);
  return mp4Box("hdlr", payload);
}

function stsdBox(sampleEntry: string): Uint8Array {
  assert.equal(sampleEntry.length, 4);
  const payload = new Uint8Array(16);
  const view = new DataView(payload.buffer);
  view.setUint32(4, 1);
  view.setUint32(8, 8);
  payload.set(textEncoder.encode(sampleEntry), 12);
  return mp4Box("stsd", payload);
}

function mp4Box(type: string, payload: Uint8Array): Uint8Array {
  assert.equal(type.length, 4);
  const bytes = new Uint8Array(8 + payload.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.byteLength);
  bytes.set(textEncoder.encode(type), 4);
  bytes.set(payload, 8);
  return bytes;
}

function mp4SizeZeroBox(type: string, payload: Uint8Array): Uint8Array {
  assert.equal(type.length, 4);
  const bytes = new Uint8Array(8 + payload.byteLength);
  bytes.set(textEncoder.encode(type), 4);
  bytes.set(payload, 8);
  return bytes;
}

function declaredSizeBox(type: string, payload: Uint8Array, declaredSize: number): Uint8Array {
  assert.equal(type.length, 4);
  assert.ok(declaredSize >= 8);
  const bytes = new Uint8Array(8 + payload.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, declaredSize);
  bytes.set(textEncoder.encode(type), 4);
  bytes.set(payload, 8);
  return bytes;
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function memorySource(
  name: string,
  bytes: Uint8Array,
  options: {
    id?: string;
    mediaType?: string;
    sizeBytes?: number;
    onRead?: () => void;
    readRange?: boolean;
  } = {}
): VapInspectionSource {
  return {
    id: options.id ?? name,
    name,
    sizeBytes: options.sizeBytes ?? bytes.byteLength,
    mediaType: options.mediaType,
    async read() {
      options.onRead?.();
      return new Uint8Array(bytes);
    },
    readRange: options.readRange
      ? async (offset, length) => bytes.slice(offset, offset + length)
      : undefined
  };
}

function vapMetadata(result: Awaited<ReturnType<VapInspectionService["inspect"]>>): Record<string, any> {
  const metadata = result.value?.metadata?.vap;
  assert.ok(metadata && typeof metadata === "object" && !Array.isArray(metadata));
  return metadata as Record<string, any>;
}

function assertRedacted(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /\/Users\/designer|C:\\\\Users\\\\designer/);
}
