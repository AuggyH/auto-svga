"use strict";

const { createHash } = require("node:crypto");
const {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} = require("node:fs");
const path = require("node:path");

const PRODUCT_MILESTONE_ID = "0.2-multiformat-preview";
const TASK_RUNTIME_FIXTURE_SCHEMA_VERSION = 1;

const TASK_RUNTIME_FIXTURE_ALIASES = Object.freeze({
  lottie: "TASK-LOTTIE-EXTERNAL-A",
  lottieImage: "TASK-LOTTIE-EXTERNAL-A-IMAGE",
  vap: "TASK-VAP-FUSION-A",
  vapSidecar: "TASK-VAP-FUSION-A-SIDECAR",
  replacementPng: "TASK-REPLACEMENT-A"
});

const TASK_RUNTIME_ORACLE_PHASES = Object.freeze([
  "fixture_identity_bound",
  "lottie_external_opened",
  "lottie_runtime_prepared",
  "lottie_playback_state_changed",
  "lottie_image_replacement_applied",
  "lottie_text_replacement_applied",
  "lottie_target_reset_restored",
  "vap_fusion_opened",
  "vap_runtime_prepared",
  "vap_playback_state_changed",
  "vap_image_replacement_applied",
  "vap_text_replacement_applied",
  "vap_target_reset_restored",
  "cleanup_completed",
  "redacted_evidence_written"
]);

const AVATAR_PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAFgAI/1C1Z4QAAAABJRU5ErkJggg==",
  "base64"
);
const REPLACEMENT_PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR42mP8z8AABQMBgF7gywAAAABJRU5ErkJggg==",
  "base64"
);
const textEncoder = new TextEncoder();

function createTaskRuntimeFixtureSet(options = {}) {
  const root = absoluteDirectoryTarget(options.root);
  const lottieDirectory = path.join(root, "external-lottie");
  const lottieImageDirectory = path.join(lottieDirectory, "images");
  const vapDirectory = path.join(root, "fusion-vap");
  mkdirSync(lottieImageDirectory, { recursive: true });
  mkdirSync(vapDirectory, { recursive: true });

  const lottiePath = path.join(lottieDirectory, "external-image-lottie.json");
  const lottieImagePath = path.join(lottieImageDirectory, "avatar.png");
  const vapPath = path.join(vapDirectory, "fusion-vap.mp4");
  const vapSidecarPath = path.join(vapDirectory, "fusion-vap.json");
  const replacementPath = path.join(root, "replacement.png");

  writeFileSync(lottieImagePath, AVATAR_PNG_BYTES, { mode: 0o600 });
  writeFileSync(lottiePath, `${JSON.stringify(createExternalImageLottieDocument())}\n`, { mode: 0o600 });
  writeFileSync(vapPath, createSyntheticVapMp4WithoutEmbeddedVapcBytes(), { mode: 0o600 });
  writeFileSync(vapSidecarPath, `${JSON.stringify(createFusionVapcDocument())}\n`, { mode: 0o600 });
  writeFileSync(replacementPath, REPLACEMENT_PNG_BYTES, { mode: 0o600 });

  const files = {
    lottiePath,
    lottieImagePath,
    vapPath,
    vapSidecarPath,
    replacementPath
  };
  return {
    root,
    files,
    evidence: readTaskRuntimeFixtureContract({ root })
  };
}

function readTaskRuntimeFixtureContract(options = {}) {
  const root = absoluteDirectoryTarget(options.root);
  const files = {
    lottie: path.join(root, "external-lottie", "external-image-lottie.json"),
    lottieImage: path.join(root, "external-lottie", "images", "avatar.png"),
    vap: path.join(root, "fusion-vap", "fusion-vap.mp4"),
    vapSidecar: path.join(root, "fusion-vap", "fusion-vap.json"),
    replacementPng: path.join(root, "replacement.png")
  };
  const findings = [];
  const fileEvidence = {};
  for (const [key, filePath] of Object.entries(files)) {
    const record = readRegularFileEvidence({ key, filePath });
    fileEvidence[key] = record.evidence;
    findings.push(...record.findings);
  }
  findings.push(...validateLottieFixtureShape(files.lottie));
  findings.push(...validateVapSidecarFixtureShape(files.vapSidecar));

  return {
    schemaVersion: TASK_RUNTIME_FIXTURE_SCHEMA_VERSION,
    status: findings.length === 0 ? "passed" : "failed",
    productMilestoneId: PRODUCT_MILESTONE_ID,
    pathRedacted: true,
    aliases: { ...TASK_RUNTIME_FIXTURE_ALIASES },
    fixtureHashes: {
      lottieJson: fileEvidence.lottie?.sha256,
      lottieImage: fileEvidence.lottieImage?.sha256,
      vapMp4: fileEvidence.vap?.sha256,
      vapSidecar: fileEvidence.vapSidecar?.sha256,
      replacementPng: fileEvidence.replacementPng?.sha256
    },
    fixtures: {
      lottie: {
        alias: TASK_RUNTIME_FIXTURE_ALIASES.lottie,
        format: "lottie",
        sha256: fileEvidence.lottie?.sha256,
        byteLength: fileEvidence.lottie?.byteLength,
        externalImage: {
          alias: TASK_RUNTIME_FIXTURE_ALIASES.lottieImage,
          assetId: "avatar",
          relativeResource: "images/avatar.png",
          sha256: fileEvidence.lottieImage?.sha256,
          byteLength: fileEvidence.lottieImage?.byteLength
        },
        expectedTargets: [
          { kind: "image", publicTargetId: "avatar", runtimeTargetId: "avatar" },
          { kind: "text", publicTargetId: "text:2", runtimeTargetId: "text:2" }
        ]
      },
      vap: {
        alias: TASK_RUNTIME_FIXTURE_ALIASES.vap,
        format: "vap",
        sha256: fileEvidence.vap?.sha256,
        byteLength: fileEvidence.vap?.byteLength,
        sidecar: {
          alias: TASK_RUNTIME_FIXTURE_ALIASES.vapSidecar,
          sha256: fileEvidence.vapSidecar?.sha256,
          byteLength: fileEvidence.vapSidecar?.byteLength,
          source: "adjacent_json"
        },
        expectedFusionTargets: [
          {
            kind: "image",
            publicTargetId: "vap_fusion_avatar",
            runtimeTargetId: "avatar",
            srcId: "avatar",
            srcTag: "avatar"
          },
          {
            kind: "text",
            publicTargetId: "vap_fusion_title",
            runtimeTargetId: "title",
            srcId: "title",
            srcTag: "title"
          }
        ]
      },
      replacementPng: {
        alias: TASK_RUNTIME_FIXTURE_ALIASES.replacementPng,
        format: "png",
        sha256: fileEvidence.replacementPng?.sha256,
        byteLength: fileEvidence.replacementPng?.byteLength
      }
    },
    oracleContract: {
      sourceOnly: true,
      electronLaunched: false,
      foregroundUsed: false,
      requiredPhases: [...TASK_RUNTIME_ORACLE_PHASES],
      requiredRuntimeSignals: {
        lottie: [
          "runtime prepared with lottie-web SVG script",
          "adjacent image inlined as data URI",
          "image replacement uses the public asset id",
          "text replacement uses the accepted text target",
          "target reset restores the task fixture source state"
        ],
        vap: [
          "runtime prepared with video-animation-player script",
          "adjacent vapc source is preserved",
          "fusion image and text public ids resolve to canonical srcTag keys",
          "replacement runtime values use canonical keys",
          "target reset restores source fusion parameters"
        ]
      }
    },
    findings
  };
}

function assertTaskRuntimeFixtureContract(options = {}) {
  const evidence = readTaskRuntimeFixtureContract(options);
  if (evidence.status !== "passed") {
    const codes = evidence.findings.map(({ code }) => code).join(",");
    throw new Error(`task runtime fixture contract failed: ${codes}`);
  }
  return evidence;
}

function assertNoRawPathLeak(value, rawPaths = []) {
  const serialized = JSON.stringify(value);
  for (const rawPath of rawPaths) {
    if (rawPath && serialized.includes(rawPath)) {
      throw new Error("Task runtime evidence leaked a raw local path.");
    }
  }
  if (/\/Users\/huangtengxin|\\\\Users\\\\huangtengxin/u.test(serialized)) {
    throw new Error("Task runtime evidence leaked an owner path.");
  }
}

function createExternalImageLottieDocument() {
  return {
    v: "5.13.0",
    fr: 30,
    ip: 0,
    op: 60,
    w: 200,
    h: 120,
    nm: "Task-owned external-image Lottie",
    ddd: 0,
    assets: [{ id: "avatar", u: "images/", p: "avatar.png", w: 1, h: 1, e: 0 }],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 2,
        nm: "External avatar",
        refId: "avatar",
        ip: 0,
        op: 60,
        st: 0,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: {
            a: 1,
            k: [
              lottiePositionKeyframe(0, [40, 60, 0], [160, 60, 0]),
              lottiePositionKeyframe(30, [160, 60, 0], [40, 60, 0]),
              { t: 60, s: [40, 60, 0] }
            ]
          },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] }
        }
      },
      {
        ddd: 0,
        ind: 2,
        ty: 5,
        nm: "Title",
        ip: 0,
        op: 60,
        st: 0,
        ks: staticLottieTransform([100, 105, 0], [100, 100, 100]),
        t: {
          d: { k: [{ s: { f: "Arial-Regular", fc: [1, 1, 1], s: 18, t: "Task title", j: 0, tr: 0, lh: 22, ls: 0 } }] },
          p: {},
          m: { g: 1, a: { a: 0, k: [0, 0] } },
          a: []
        }
      }
    ]
  };
}

function createFusionVapcDocument(overrides = {}) {
  return {
    info: {
      v: 2,
      f: 60,
      w: 120,
      h: 80,
      videoW: 120,
      videoH: 160,
      fps: 30,
      isVapx: true,
      aFrame: { x: 0, y: 80, w: 120, h: 80 },
      rgbFrame: { x: 0, y: 0, w: 120, h: 80 }
    },
    src: [
      { srcId: "avatar", srcTag: "avatar", srcType: "image", w: 24, h: 24, fitType: "cover" },
      { srcId: "title", srcTag: "title", srcType: "text", w: 80, h: 24, color: "#ffffff" }
    ],
    frame: [{
      i: 0,
      obj: [
        { srcId: "avatar", z: 1, frame: { x: 8, y: 8, w: 24, h: 24 }, mFrame: { x: 0, y: 0, w: 24, h: 24 }, mt: 0 },
        { srcId: "title", z: 2, frame: { x: 36, y: 16, w: 80, h: 24 }, mFrame: { x: 0, y: 0, w: 80, h: 24 }, mt: 0 }
      ]
    }],
    ...overrides
  };
}

function createSyntheticVapMp4WithoutEmbeddedVapcBytes() {
  return concatBytes(
    ftypBox(),
    moovBox(),
    mp4Box("free", new Uint8Array([1, 2, 3, 4]))
  );
}

function readRegularFileEvidence({ key, filePath }) {
  const findings = [];
  if (!existsSync(filePath)) {
    return {
      evidence: undefined,
      findings: [finding(`${key}_missing`, "required task fixture file is missing")]
    };
  }
  const stat = lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    findings.push(finding(`${key}_malformed`, "required task fixture file is not a regular nonempty file"));
    return { evidence: undefined, findings };
  }
  return {
    evidence: {
      sha256: sha256File(filePath),
      byteLength: stat.size
    },
    findings
  };
}

function validateLottieFixtureShape(filePath) {
  try {
    const value = JSON.parse(readFileSync(filePath, "utf8"));
    const findings = [];
    if (Object.prototype.hasOwnProperty.call(value, "fonts")) {
      findings.push(finding("lottie_fixture_fonts_deferred", "task Lottie fixture must not rely on deferred font resources"));
    }
    if (!Array.isArray(value.assets) || value.assets.length !== 1) {
      findings.push(finding("lottie_external_asset_missing", "task Lottie fixture must contain exactly one external image asset"));
    } else {
      const asset = value.assets[0];
      if (asset?.id !== "avatar" || asset?.u !== "images/" || asset?.p !== "avatar.png" || asset?.e !== 0) {
        findings.push(finding("lottie_external_asset_malformed", "task Lottie fixture image asset contract drifted"));
      }
    }
    if (!Array.isArray(value.layers) || value.layers.filter((layer) => layer?.ty === 2).length !== 1 || value.layers.filter((layer) => layer?.ty === 5).length !== 1) {
      findings.push(finding("lottie_layer_contract_drift", "task Lottie fixture must contain one image layer and one text layer"));
    }
    return findings;
  } catch {
    return [finding("lottie_fixture_json_invalid", "task Lottie fixture JSON is invalid")];
  }
}

function validateVapSidecarFixtureShape(filePath) {
  try {
    const value = JSON.parse(readFileSync(filePath, "utf8"));
    const src = Array.isArray(value.src) ? value.src : [];
    const frame = Array.isArray(value.frame) ? value.frame : [];
    const targets = src.map((entry) => `${entry?.srcType}:${entry?.srcId}:${entry?.srcTag}`).sort();
    const findings = [];
    if (targets.join("|") !== "image:avatar:avatar|text:title:title") {
      findings.push(finding("vap_fusion_target_contract_drift", "task VAP sidecar must expose deterministic avatar image and title text fusion identities"));
    }
    if (frame.length !== 1 || !Array.isArray(frame[0]?.obj) || frame[0].obj.length !== 2) {
      findings.push(finding("vap_fusion_frame_contract_drift", "task VAP sidecar must bind both fusion targets at one deterministic frame"));
    }
    return findings;
  } catch {
    return [finding("vap_sidecar_json_invalid", "task VAP sidecar JSON is invalid")];
  }
}

function staticLottieTransform(position, scale) {
  return {
    o: { a: 0, k: 100 },
    r: { a: 0, k: 0 },
    p: { a: 0, k: position },
    a: { a: 0, k: [0, 0, 0] },
    s: { a: 0, k: scale }
  };
}

function lottiePositionKeyframe(time, start, end) {
  return {
    t: time,
    s: start,
    e: end,
    i: { x: [0.667], y: [1] },
    o: { x: [0.333], y: [0] }
  };
}

function ftypBox() {
  return mp4Box("ftyp", concatBytes(
    textEncoder.encode("isom"),
    u32(512),
    textEncoder.encode("isom"),
    textEncoder.encode("mp42")
  ));
}

function moovBox() {
  return mp4Box("moov", concatBytes(mvhdBox(), trackBox()));
}

function trackBox() {
  return mp4Box("trak", mp4Box("mdia", concatBytes(
    hdlrBox("vide"),
    mp4Box("minf", mp4Box("stbl", stsdBox("avc1")))
  )));
}

function mvhdBox() {
  const payload = new Uint8Array(20);
  const view = new DataView(payload.buffer);
  view.setUint32(12, 1_000);
  view.setUint32(16, 2_000);
  return mp4Box("mvhd", payload);
}

function hdlrBox(handler) {
  if (handler.length !== 4) throw new Error("MP4 handler must be a four-character code.");
  const payload = new Uint8Array(12);
  payload.set(textEncoder.encode(handler), 8);
  return mp4Box("hdlr", payload);
}

function stsdBox(sampleEntry) {
  if (sampleEntry.length !== 4) throw new Error("MP4 sample entry must be a four-character code.");
  const payload = new Uint8Array(16);
  const view = new DataView(payload.buffer);
  view.setUint32(4, 1);
  view.setUint32(8, 8);
  payload.set(textEncoder.encode(sampleEntry), 12);
  return mp4Box("stsd", payload);
}

function mp4Box(type, payload) {
  if (type.length !== 4) throw new Error("MP4 box type must be a four-character code.");
  const bytes = new Uint8Array(8 + payload.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.byteLength);
  bytes.set(textEncoder.encode(type), 4);
  bytes.set(payload, 8);
  return bytes;
}

function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function concatBytes(...parts) {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
}

function absoluteDirectoryTarget(value) {
  if (typeof value !== "string" || !path.isAbsolute(value) || value.includes("\0")) {
    throw new Error("Task runtime fixture root must be an absolute path.");
  }
  return path.normalize(value);
}

function finding(code, message) {
  return { code, message, pathRedacted: true };
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

module.exports = {
  PRODUCT_MILESTONE_ID,
  TASK_RUNTIME_FIXTURE_ALIASES,
  TASK_RUNTIME_FIXTURE_SCHEMA_VERSION,
  TASK_RUNTIME_ORACLE_PHASES,
  assertNoRawPathLeak,
  assertTaskRuntimeFixtureContract,
  createExternalImageLottieDocument,
  createFusionVapcDocument,
  createSyntheticVapMp4WithoutEmbeddedVapcBytes,
  createTaskRuntimeFixtureSet,
  readTaskRuntimeFixtureContract,
  sha256Text
};
