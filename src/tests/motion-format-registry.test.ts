import assert from "node:assert/strict";
import test from "node:test";

import {
  MULTIFORMAT_PREVIEW_WP1_GATE,
  MotionFormatProbeService,
  MotionFormatRegistry,
  createMultiFormatPreviewWp1Registry,
  type MotionFormatProbeSource
} from "../workbench/motion-format-registry.js";

const textEncoder = new TextEncoder();

test("WP1 registry is bounded to SVGA, Lottie JSON, and VAP candidates", () => {
  assert.deepEqual(
    createMultiFormatPreviewWp1Registry().entries.map(({ format }) => format),
    ["svga", "lottie", "vap"]
  );
});

test("WP1 probe requires the explicit 0.2 gate before reading a source", async () => {
  let reads = 0;
  const source = memorySource("/Users/designer/private/animation.json", lottieBytes(), {
    onRead: () => { reads += 1; }
  });
  const result = await service().probe(source, { gate: "0.1" });

  assert.equal(result.status, "unsupported");
  assert.equal(result.format, undefined);
  assert.equal(result.issues[0]?.code, "unsupported");
  assert.equal(result.issues[0]?.details?.reason, "gate_required");
  assert.equal(reads, 0);
  assertRedacted(result);
});

test("detects SVGA only when a format hint and zlib header agree", async () => {
  for (const [source, hintKind] of [
    [memorySource("effect.svga", new Uint8Array([0x78, 0x9c, 0x01])), "extension"],
    [memorySource("effect.bin", new Uint8Array([0x78, 0xda, 0x01]), {
      mediaType: "application/x-svga; charset=binary"
    }), "media_type"]
  ] as const) {
    const result = await service().probe(source, { gate: MULTIFORMAT_PREVIEW_WP1_GATE });

    assert.equal(result.status, "detected");
    assert.equal(result.format, "svga");
    assert.ok(result.evidence.some(({ kind }) => kind === hintKind));
    assert.ok(result.evidence.some(({ kind }) => kind === "header"));
  }
});

test("keeps extension-only and header-only SVGA evidence as candidates", async () => {
  for (const source of [
    memorySource("effect.svga", new Uint8Array([1, 2, 3])),
    memorySource("effect.bin", new Uint8Array([0x78, 0x9c, 0x01]))
  ]) {
    const result = await service().probe(source, { gate: MULTIFORMAT_PREVIEW_WP1_GATE });

    assert.equal(result.status, "candidate");
    assert.equal(result.format, "svga");
    assert.equal(result.issues[0]?.code, "parse_precondition");
  }
});

test("keeps invalid zlib CINFO SVGA headers as candidates", async () => {
  const result = await service().probe(
    memorySource("invalid-window.svga", new Uint8Array([0x88, 0x1c])),
    { gate: MULTIFORMAT_PREVIEW_WP1_GATE }
  );

  assert.equal(result.status, "candidate");
  assert.equal(result.format, "svga");
  assert.equal(result.issues[0]?.code, "parse_precondition");
  assert.equal(result.evidence.some(({ kind }) => kind === "header"), false);
});

test("detects Lottie from a bounded JSON shape with or without a json extension", async () => {
  for (const source of [
    memorySource("animation.json", lottieBytes()),
    memorySource("animation.data", lottieBytes(), { mediaType: "application/octet-stream" })
  ]) {
    const result = await service().probe(source, { gate: MULTIFORMAT_PREVIEW_WP1_GATE });

    assert.equal(result.status, "detected");
    assert.equal(result.format, "lottie");
    assert.ok(result.evidence.some(({ kind }) => kind === "json_shape"));
  }
});

test("does not mark generic or malformed JSON as detected Lottie", async () => {
  for (const bytes of [
    textEncoder.encode(JSON.stringify({ name: "ordinary config", layers: [] })),
    textEncoder.encode(JSON.stringify({
      v: "5.7.4",
      fr: 0,
      ip: 10,
      op: 10,
      w: 300,
      h: 300,
      layers: []
    })),
    textEncoder.encode("{\"v\":\"5.7.4\",\"layers\":[")
  ]) {
    const result = await service().probe(
      memorySource("config.json", bytes, { mediaType: "application/json" }),
      { gate: MULTIFORMAT_PREVIEW_WP1_GATE }
    );

    assert.equal(result.status, "candidate");
    assert.equal(result.format, "lottie");
    assert.equal(result.issues[0]?.code, "parse_precondition");
    assert.equal(result.evidence.some(({ kind }) => kind === "json_shape"), false);
  }
});

test("detects a VAP candidate only when minimal MP4 boxes include vapc", async () => {
  const bytes = concatBytes(
    mp4Box("ftyp", textEncoder.encode("isom\u0000\u0000\u0002\u0000isom")),
    mp4Box("vapc", textEncoder.encode("{\"info\":{\"v\":2}}"))
  );
  const result = await service().probe(
    memorySource("effect.mp4", bytes, { mediaType: "video/mp4" }),
    { gate: MULTIFORMAT_PREVIEW_WP1_GATE }
  );

  assert.equal(result.status, "detected");
  assert.equal(result.format, "vap");
  assert.ok(result.evidence.some(({ kind, detail }) => kind === "magic" && detail === "mp4_ftyp"));
  assert.ok(result.evidence.some(({ kind, detail }) => kind === "mp4_box" && detail === "vapc"));
});

test("keeps ordinary or malformed MP4 input as a VAP candidate with a precondition issue", async () => {
  const ordinaryMp4 = concatBytes(
    mp4Box("ftyp", textEncoder.encode("isom\u0000\u0000\u0002\u0000isom")),
    mp4Box("free", new Uint8Array([1, 2, 3]))
  );
  const headerOnlyVap = concatBytes(mp4Box("ftyp", new Uint8Array()), mp4Box("vapc", new Uint8Array()));
  const emptyVapc = concatBytes(
    mp4Box("ftyp", textEncoder.encode("isom\u0000\u0000\u0002\u0000isom")),
    mp4Box("vapc", new Uint8Array())
  );
  const extendedSizeVap = concatBytes(
    mp4ExtendedSizeBox("ftyp", textEncoder.encode("isom\u0000\u0000\u0002\u0000isom")),
    mp4Box("vapc", textEncoder.encode("{}"))
  );
  const sizeZeroVap = mp4SizeZeroBox("ftyp", textEncoder.encode("isom\u0000\u0000\u0002\u0000isom"));
  const declaredOverflow = new Uint8Array([0, 0, 0, 100, 0x66, 0x74, 0x79, 0x70]);
  const malformedMp4 = new Uint8Array([0, 0, 0, 4, 0x66, 0x74, 0x79, 0x70]);
  const damagedVap = concatBytes(
    mp4Box("ftyp", textEncoder.encode("isom\u0000\u0000\u0002\u0000isom")),
    mp4Box("vapc", textEncoder.encode("{}")),
    new Uint8Array([0])
  );

  for (const bytes of [
    ordinaryMp4,
    headerOnlyVap,
    emptyVapc,
    extendedSizeVap,
    sizeZeroVap,
    declaredOverflow,
    malformedMp4,
    damagedVap
  ]) {
    const result = await service().probe(
      memorySource("effect.mp4", bytes, { mediaType: "video/mp4" }),
      { gate: MULTIFORMAT_PREVIEW_WP1_GATE }
    );

    assert.equal(result.status, "candidate");
    assert.equal(result.format, "vap");
    assert.equal(result.issues[0]?.code, "parse_precondition");
  }
});

test("fails closed as ambiguous when extension, media type, and content identify different formats", async () => {
  const result = await service().probe(
    memorySource("effect.svga", lottieBytes(), { mediaType: "application/json" }),
    { gate: MULTIFORMAT_PREVIEW_WP1_GATE }
  );

  assert.equal(result.status, "ambiguous");
  assert.equal(result.format, undefined);
  assert.equal(result.issues[0]?.code, "ambiguous");
  assert.deepEqual(result.issues[0]?.details?.candidateFormats, ["lottie", "svga"]);
});

test("returns typed unsupported feedback without leaking local paths", async () => {
  const result = await service().probe(
    memorySource(
      "/Users/designer/Secret Campaign/not-motion.txt",
      textEncoder.encode("plain text"),
      { id: "C:\\Users\\designer\\Private\\not-motion.txt" }
    ),
    { gate: MULTIFORMAT_PREVIEW_WP1_GATE }
  );

  assert.equal(result.status, "unsupported");
  assert.equal(result.issues[0]?.code, "unsupported");
  assert.equal(result.issues[0]?.path, "[local path]");
  assert.equal(result.issues[0]?.details?.sourceName, "not-motion.txt");
  assertRedacted(result);
});

test("redacts source and error paths from parse-precondition feedback", async () => {
  const source: MotionFormatProbeSource = {
    id: "/Users/designer/private/broken.json",
    name: "/Users/designer/private/broken.json",
    sizeBytes: 12,
    mediaType: "application/json",
    async read() {
      throw new Error("Cannot read /Users/designer/private/broken.json");
    }
  };
  const result = await service().probe(source, { gate: MULTIFORMAT_PREVIEW_WP1_GATE });

  assert.equal(result.status, "candidate");
  assert.equal(result.issues[0]?.code, "parse_precondition");
  assert.match(String(result.issues[0]?.details?.cause), /\[local path\]/);
  assertRedacted(result);
});

test("returns missing_dependency when a hinted registry entry has no probe implementation", async () => {
  const registry = new MotionFormatRegistry([{
    format: "lottie",
    extensions: [".json"],
    mediaTypes: ["application/json"],
    missingDependency: "approved-lottie-shape-probe"
  }]);
  const result = await new MotionFormatProbeService(registry).probe(
    memorySource("animation.json", lottieBytes(), { mediaType: "application/json" }),
    { gate: MULTIFORMAT_PREVIEW_WP1_GATE }
  );

  assert.equal(result.status, "candidate");
  assert.equal(result.format, "lottie");
  assert.equal(result.issues[0]?.code, "missing_dependency");
  assert.equal(result.issues[0]?.details?.dependency, "approved-lottie-shape-probe");
});

test("uses bounded range reads and never falls back to a full read for large sources", async () => {
  const bytes = concatBytes(
    mp4Box("ftyp", textEncoder.encode("isom\u0000\u0000\u0002\u0000isom")),
    mp4Box("vapc", textEncoder.encode("{}"))
  );
  let fullReads = 0;
  const ranges: Array<[number, number]> = [];
  const source: MotionFormatProbeSource = {
    id: "large-vap",
    name: "large.mp4",
    sizeBytes: 5_000_000,
    mediaType: "video/mp4",
    async read() {
      fullReads += 1;
      return bytes;
    },
    async readRange(offset, length) {
      ranges.push([offset, length]);
      return bytes.slice(offset, offset + length);
    }
  };
  const result = await service().probe(source, { gate: MULTIFORMAT_PREVIEW_WP1_GATE });

  assert.equal(result.status, "detected");
  assert.equal(result.format, "vap");
  assert.equal(fullReads, 0);
  assert.deepEqual(ranges, [[0, 262_144]]);
});

test("uses range reads when available instead of trusting underreported size metadata", async () => {
  const bytes = concatBytes(
    mp4Box("ftyp", textEncoder.encode("isom\u0000\u0000\u0002\u0000isom")),
    mp4Box("vapc", textEncoder.encode("{}"))
  );
  let fullReads = 0;
  const ranges: Array<[number, number]> = [];
  const source: MotionFormatProbeSource = {
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
  const result = await service().probe(source, { gate: MULTIFORMAT_PREVIEW_WP1_GATE });

  assert.equal(result.status, "detected");
  assert.equal(result.format, "vap");
  assert.equal(fullReads, 0);
  assert.deepEqual(ranges, [[0, 262_144]]);
});

test("uses range reads when size metadata is unknown or NaN", async () => {
  const bytes = concatBytes(
    mp4Box("ftyp", textEncoder.encode("isom\u0000\u0000\u0002\u0000isom")),
    mp4Box("vapc", textEncoder.encode("{}"))
  );
  let fullReads = 0;
  const ranges: Array<[number, number]> = [];
  const source: MotionFormatProbeSource = {
    id: "unknown-size-vap",
    name: "unknown-size.mp4",
    sizeBytes: Number.NaN,
    mediaType: "video/mp4",
    async read() {
      fullReads += 1;
      return bytes;
    },
    async readRange(offset, length) {
      ranges.push([offset, length]);
      return bytes.slice(offset, offset + length);
    }
  };
  const result = await service().probe(source, { gate: MULTIFORMAT_PREVIEW_WP1_GATE });

  assert.equal(result.status, "detected");
  assert.equal(result.format, "vap");
  assert.equal(fullReads, 0);
  assert.deepEqual(ranges, [[0, 262_144]]);
});

test("large sources without range reads fail closed instead of loading the full asset", async () => {
  let reads = 0;
  const source: MotionFormatProbeSource = {
    id: "large-json",
    name: "large.json",
    sizeBytes: 5_000_000,
    mediaType: "application/json",
    async read() {
      reads += 1;
      return lottieBytes();
    }
  };
  const result = await service().probe(source, { gate: MULTIFORMAT_PREVIEW_WP1_GATE });

  assert.equal(result.status, "candidate");
  assert.equal(result.format, "lottie");
  assert.equal(result.issues[0]?.code, "parse_precondition");
  assert.equal(result.issues[0]?.details?.reason, "bounded_read_required");
  assert.equal(reads, 0);
});

function service(): MotionFormatProbeService {
  return new MotionFormatProbeService(createMultiFormatPreviewWp1Registry());
}

function lottieBytes(): Uint8Array {
  return textEncoder.encode(JSON.stringify({
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 60,
    w: 300,
    h: 300,
    layers: []
  }));
}

function memorySource(
  name: string,
  bytes: Uint8Array,
  options: {
    id?: string;
    mediaType?: string;
    onRead?: () => void;
  } = {}
): MotionFormatProbeSource {
  return {
    id: options.id ?? name,
    name,
    sizeBytes: bytes.byteLength,
    mediaType: options.mediaType,
    async read() {
      options.onRead?.();
      return new Uint8Array(bytes);
    }
  };
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

function mp4ExtendedSizeBox(type: string, payload: Uint8Array): Uint8Array {
  assert.equal(type.length, 4);
  const bytes = new Uint8Array(16 + payload.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 1);
  bytes.set(textEncoder.encode(type), 4);
  view.setUint32(8, 0);
  view.setUint32(12, bytes.byteLength);
  bytes.set(payload, 16);
  return bytes;
}

function mp4SizeZeroBox(type: string, payload: Uint8Array): Uint8Array {
  assert.equal(type.length, 4);
  const bytes = new Uint8Array(8 + payload.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0);
  bytes.set(textEncoder.encode(type), 4);
  bytes.set(payload, 8);
  return bytes;
}

function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function assertRedacted(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /\/Users\/designer|C:\\\\Users\\\\designer/);
}
