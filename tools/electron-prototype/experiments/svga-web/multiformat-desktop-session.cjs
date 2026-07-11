"use strict";

const { createHash } = require("node:crypto");
const { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID = "0.2-multiformat-preview";
const MULTIFORMAT_DESKTOP_GATE = "0.2-owner-visible-multiformat-preview-wp5";
const MULTIFORMAT_MAX_DROPPED_BYTES = 50 * 1024 * 1024;
const MULTIFORMAT_MAX_RANGE_BYTES = 262_144;
const MULTIFORMAT_OPEN_TERMINAL_DEADLINE_MS = 15_000;

const allowedExtensions = new Set([".svga", ".json", ".mp4"]);
const mediaTypes = new Map([
  [".json", "application/json"],
  [".mp4", "video/mp4"],
  [".svga", "application/octet-stream"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"]
]);

function createMultiFormatDesktopPreviewSession(options) {
  return new MultiFormatDesktopPreviewSession(options);
}

class MultiFormatDesktopPreviewSession {
  constructor(options) {
    this.repoRoot = options.repoRoot;
    this.sessionRoot = options.sessionRoot;
    this.sourceStore = options.sourceStore;
    this.modulesPromise = undefined;
    this.sessionPromise = undefined;
    this.requestSequence = 0;
    this.objectUrlSequence = 0;
    this.openTimeoutMs = Number.isFinite(Number(options.openTimeoutMs))
      ? Math.max(100, Math.trunc(Number(options.openTimeoutMs)))
      : MULTIFORMAT_OPEN_TERMINAL_DEADLINE_MS;
    this.lifecycle = {
      lottieLoads: 0,
      lottieDestroys: 0,
      vapLoads: 0,
      vapDestroys: 0,
      objectUrlsCreated: 0,
      objectUrlsRevoked: 0
    };
  }

  async openLocalFilePath(filePath, source) {
    const normalizedPath = normalizeLocalPath(filePath);
    validateSupportedPath(normalizedPath);
    const requestId = this.nextRequestId(source);
    const displayName = path.basename(normalizedPath);
    const sourceId = this.rememberSource(normalizedPath);
    let model;
    try {
      model = await this.openWithTerminalDeadline(
        (async () => {
          const session = await this.ensureSession();
          return session.openLocalCandidate({
            gate: MULTIFORMAT_DESKTOP_GATE,
            requestId,
            source,
            localPath: normalizedPath,
            displayName
          });
        })(),
        {
          requestId,
          source,
          displayName,
          localPath: normalizedPath
        }
      );
    } catch (error) {
      model = createOpenFailureModel({
        requestId,
        source,
        displayName,
        localPath: normalizedPath,
        reason: "desktop_open_failed",
        message: "The 0.2 preview host could not open this local candidate.",
        cause: error
      });
    }
    return this.publicResult(model, sourceId);
  }

  async openDroppedFile(input) {
    const displayName = safeDisplayName(input?.displayName ?? input?.name ?? "dropped-motion-asset");
    validateSupportedPath(displayName);
    const bytes = droppedBytes(input);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const dropRoot = path.join(this.sessionRoot, "multiformat-drops");
    mkdirSync(dropRoot, { recursive: true });
    const filePath = path.join(dropRoot, `${hash.slice(0, 16)}-${displayName}`);
    writeFileSync(filePath, bytes);
    return this.openLocalFilePath(filePath, "dragDrop");
  }

  async control(input) {
    const session = await this.ensureSession();
    switch (input?.action) {
      case "play":
        return this.publicResult(await session.play());
      case "pause":
        return this.publicResult(session.pause());
      case "recover":
        return this.publicResult(await session.recoverPlayback());
      case "seek":
        return this.publicResult(session.seek(Number(input.timeMs) || 0));
      case "loop":
        return this.publicResult(session.setLoop(input.loop !== false));
      case "dispose":
        return this.publicResult(session.dispose());
      case "model":
      default:
        return this.publicResult(session.getModel());
    }
  }

  async applyReplacement(input) {
    const session = await this.ensureSession();
    return this.publicResult(await session.applyReplacement({
      gate: MULTIFORMAT_DESKTOP_GATE,
      requestId: this.nextRequestId("replacement"),
      targetId: String(input?.targetId ?? ""),
      kind: input?.kind === "text" ? "text" : "image",
      value: String(input?.value ?? "")
    }));
  }

  async resetReplacement() {
    const session = await this.ensureSession();
    return this.publicResult(await session.resetReplacement({
      gate: MULTIFORMAT_DESKTOP_GATE,
      requestId: this.nextRequestId("reset")
    }));
  }

  rememberSource(filePath) {
    const sourceId = createHash("sha256").update(filePath).digest("hex").slice(0, 24);
    this.sourceStore?.set(sourceId, filePath);
    return sourceId;
  }

  async ensureSession() {
    if (!this.sessionPromise) {
      this.sessionPromise = this.createSession();
    }
    return this.sessionPromise;
  }

  async createSession() {
    const modules = await this.loadModules();
    const host = this.createHost();
    return modules.createOwnerVisibleMultiFormatPreviewCandidate({
      host,
      lottieTarget: { container: { role: "desktop-source-contract-lottie-target" } },
      lottieRendererLoader: createHeadlessLottieRendererLoader(this.lifecycle),
      vapTarget: { role: "desktop-source-contract-vap-target" },
      vapHostReadiness: {
        webglAvailable: true,
        h264Mp4DecodeAvailable: true,
        localObjectUrlAvailable: true,
        cspAllowsBlobMedia: true,
        gpuCompositingAvailable: true
      },
      vapRuntimeLoader: createHeadlessVapRuntimeLoader(this.lifecycle),
      svgaAdapter: new modules.SvgaFormatAdapter(
        new modules.NodeProtobufSvgaInspector(path.join(this.repoRoot, "proto/svga.proto")),
        new modules.FastPngAlphaAnalyzer(),
        new modules.Sha256ResourceHasher()
      ),
      svgaPlaybackAdapter: createHeadlessPlaybackAdapter("svga"),
      svgaPlaybackTarget: { role: "desktop-source-contract-svga-target" }
    });
  }

  async openWithTerminalDeadline(openPromise, context) {
    let timeout;
    const timeoutPromise = new Promise((resolve) => {
      timeout = setTimeout(() => {
        this.disposePendingSession();
        resolve(createOpenFailureModel({
          ...context,
          reason: "desktop_open_deadline_exceeded",
          message: "The 0.2 preview host did not reach a terminal open state within the bounded deadline."
        }));
      }, this.openTimeoutMs);
    });
    try {
      const model = await Promise.race([openPromise, timeoutPromise]);
      if (model && typeof model === "object" && typeof model.status === "string") return model;
      return createOpenFailureModel({
        ...context,
        reason: "desktop_open_model_missing",
        message: "The 0.2 preview host finished without a visible terminal model."
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  disposePendingSession() {
    const pendingSession = this.sessionPromise;
    this.sessionPromise = undefined;
    pendingSession?.then((session) => {
      try {
        session?.dispose?.();
      } catch {}
    }).catch(() => {});
  }

  async loadModules() {
    if (!this.modulesPromise) {
      const moduleUrl = (relativePath) => pathToFileURL(path.join(this.repoRoot, relativePath)).href;
      this.modulesPromise = Promise.all([
        import(moduleUrl("dist/workbench/multiformat-owner-preview-candidate.js")),
        import(moduleUrl("dist/workbench/svga/format-adapter.js")),
        import(moduleUrl("dist/workbench/svga/node-protobuf-inspector.js")),
        import(moduleUrl("dist/hosts/fast-png-alpha-analyzer.js")),
        import(moduleUrl("dist/hosts/sha256-resource-hasher.js"))
      ]).then(([ownerPreview, svgaFormat, svgaInspector, alphaAnalyzer, resourceHasher]) => ({
        createOwnerVisibleMultiFormatPreviewCandidate: ownerPreview.createOwnerVisibleMultiFormatPreviewCandidate,
        SvgaFormatAdapter: svgaFormat.SvgaFormatAdapter,
        NodeProtobufSvgaInspector: svgaInspector.NodeProtobufSvgaInspector,
        FastPngAlphaAnalyzer: alphaAnalyzer.FastPngAlphaAnalyzer,
        Sha256ResourceHasher: resourceHasher.Sha256ResourceHasher
      }));
    }
    return this.modulesPromise;
  }

  createHost() {
    const owner = this;
    return {
      async statLocalFile(localPath) {
        const filePath = normalizeLocalPath(localPath);
        const stat = statSync(filePath);
        if (!stat.isFile()) throw new Error("Local motion source is not a file.");
        return {
          sizeBytes: stat.size,
          displayName: path.basename(filePath),
          mediaType: mediaTypeFromPath(filePath)
        };
      },
      async readLocalFileRange(localPath, offset, length) {
        const filePath = normalizeLocalPath(localPath);
        const safeOffset = Math.max(0, Math.trunc(Number(offset) || 0));
        const safeLength = Math.max(0, Math.min(Math.trunc(Number(length) || 0), MULTIFORMAT_MAX_RANGE_BYTES));
        const buffer = Buffer.alloc(safeLength);
        const fd = openSync(filePath, "r");
        try {
          const bytesRead = require("node:fs").readSync(fd, buffer, 0, safeLength, safeOffset);
          return new Uint8Array(buffer.subarray(0, bytesRead));
        } finally {
          closeSync(fd);
        }
      },
      async readAdjacentResource(input) {
        const sourcePath = normalizeLocalPath(input?.sourceLocalPath);
        const resourcePath = resolveAdjacentResource(sourcePath, String(input?.relativePath ?? ""));
        const stat = statSync(resourcePath);
        if (!stat.isFile()) throw new Error("Adjacent Lottie resource is not a file.");
        const maxBytes = Math.max(0, Math.min(Number(input?.maxBytes) || 0, 5 * 1024 * 1024));
        if (stat.size > maxBytes) throw new Error("Adjacent Lottie resource exceeds the bounded read limit.");
        const bytes = readFileSync(resourcePath);
        return {
          bytes: new Uint8Array(bytes),
          sizeBytes: stat.size,
          mediaType: mediaTypeFromPath(resourcePath)
        };
      },
      async createLocalObjectUrl(input) {
        const filePath = normalizeLocalPath(input?.localPath);
        if (!existsSync(filePath)) throw new Error("Local VAP source is unavailable.");
        owner.lifecycle.objectUrlsCreated += 1;
        const token = createHash("sha256")
          .update(`${filePath}:${owner.objectUrlSequence += 1}`)
          .digest("hex")
          .slice(0, 24);
        let revoked = false;
        return {
          objectUrl: `blob:auto-svga-wp6/${token}`,
          revoke() {
            if (revoked) return;
            revoked = true;
            owner.lifecycle.objectUrlsRevoked += 1;
          }
        };
      }
    };
  }

  nextRequestId(prefix) {
    this.requestSequence += 1;
    return `${prefix || "request"}:${this.requestSequence}`;
  }

  publicResult(model, sourceId = "") {
    return {
      status: "opened",
      model,
      sourceId,
      pathRedacted: true,
      lifecycle: { ...this.lifecycle },
      visualEvidence: {
        lottieDomPlaybackVerified: false,
        vapVisualPlaybackVerified: false,
        note: "Desktop WP6 integrates the formal 0.2 shell and source-side runtime contracts; real-material visual success still requires CR/QA/Packaging evidence."
      }
    };
  }
}

function createHeadlessLottieRendererLoader(lifecycle) {
  return async () => ({
    loadAnimation(options) {
      lifecycle.lottieLoads += 1;
      const listeners = new Map();
      return {
        loop: options.loop,
        play() {},
        pause() {},
        destroy() {
          lifecycle.lottieDestroys += 1;
        },
        goToAndStop() {},
        setLoop(loop) {
          this.loop = loop;
        },
        addEventListener(name, handler) {
          listeners.set(name, handler);
        },
        removeEventListener(name, handler) {
          if (listeners.get(name) === handler) listeners.delete(name);
        }
      };
    }
  });
}

function createHeadlessVapRuntimeLoader(lifecycle) {
  return async () => function createHeadlessVapRuntime(config) {
    lifecycle.vapLoads += 1;
    return {
      on() {
        return this;
      },
      destroy() {
        lifecycle.vapDestroys += 1;
      },
      pause() {},
      play() {
        return this;
      },
      setTime() {},
      config
    };
  };
}

function createHeadlessPlaybackAdapter(format) {
  return {
    format,
    createSession() {
      let state = {
        status: "idle",
        currentTimeMs: 0,
        loop: true
      };
      return {
        async load(_source, context) {
          context?.cancellation?.throwIfCancelled();
          state = { ...state, status: "ready", currentTimeMs: 0 };
          return { issues: [] };
        },
        async play() {
          state = { ...state, status: "playing" };
        },
        pause() {
          if (state.status !== "disposed") state = { ...state, status: "paused" };
        },
        seek(timeMs) {
          if (state.status !== "disposed") state = { ...state, status: "paused", currentTimeMs: Math.max(0, Number(timeMs) || 0) };
        },
        async replay() {
          state = { ...state, status: "playing", currentTimeMs: 0 };
        },
        setLoop(loop) {
          state = { ...state, loop };
        },
        getState() {
          return { ...state };
        },
        dispose() {
          state = { ...state, status: "disposed" };
        }
      };
    }
  };
}

function droppedBytes(input) {
  if (input?.bytesBase64) {
    const bytes = Buffer.from(String(input.bytesBase64), "base64");
    validateDroppedSize(bytes);
    return bytes;
  }
  if (Array.isArray(input?.bytes)) {
    const bytes = Buffer.from(input.bytes);
    validateDroppedSize(bytes);
    return bytes;
  }
  if (input?.bytes instanceof Uint8Array) {
    const bytes = Buffer.from(input.bytes);
    validateDroppedSize(bytes);
    return bytes;
  }
  throw new Error("Dropped multi-format file payload is missing.");
}

function validateDroppedSize(bytes) {
  if (bytes.byteLength <= 0 || bytes.byteLength > MULTIFORMAT_MAX_DROPPED_BYTES) {
    throw new Error("Dropped multi-format file is outside the WP6 local preview limit.");
  }
}

function normalizeLocalPath(value) {
  const filePath = path.resolve(String(value ?? ""));
  if (!filePath || filePath.includes("\0")) throw new Error("Invalid local motion source path.");
  return filePath;
}

function safeDisplayName(value) {
  const base = path.basename(String(value).replace(/[/\\]/g, "")).slice(0, 160);
  return base || "motion-asset";
}

function validateSupportedPath(value) {
  const extension = path.extname(String(value)).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    throw new Error("Only local SVGA, Lottie JSON, and VAP/MP4 candidates are accepted in the 0.2 preview mode.");
  }
}

function resolveAdjacentResource(sourceLocalPath, relativePath) {
  if (!relativePath || relativePath.includes("\0")) throw new Error("Adjacent resource path is invalid.");
  if (/^[a-z][a-z0-9+.-]*:/iu.test(relativePath) || path.isAbsolute(relativePath)) {
    throw new Error("Adjacent Lottie resources must use deterministic relative paths.");
  }
  const sourceDir = path.dirname(sourceLocalPath);
  const resolved = path.resolve(sourceDir, relativePath);
  if (resolved !== sourceDir && !resolved.startsWith(`${sourceDir}${path.sep}`)) {
    throw new Error("Adjacent Lottie resource path escapes the source directory.");
  }
  return resolved;
}

function mediaTypeFromPath(filePath) {
  return mediaTypes.get(path.extname(String(filePath)).toLowerCase()) ?? "application/octet-stream";
}

function createOpenFailureModel(input) {
  const detectedFormat = formatFromPath(input.localPath);
  const displayName = safeDisplayName(input.displayName);
  const issue = {
    code: "playback_failure",
    severity: "error",
    message: input.message,
    path: displayName,
    details: {
      reason: input.reason,
      detectedFormat,
      cause: input.cause ? "redacted open failure" : undefined
    }
  };
  return {
    schemaVersion: 1,
    source: "owner-visible-0.2-multiformat-preview-candidate",
    productMode: "0.2-multiformat-preview-candidate",
    productVersion: "0.2.0-alpha.2",
    status: "failed",
    requestId: input.requestId,
    openedFrom: input.source,
    displayName,
    ...(detectedFormat ? { detectedFormat } : {}),
    pathRedacted: true,
    rendererHasFullPath: false,
    visibleIn01: false,
    supportClaim: false,
    saveExportSupported: false,
    packageReadiness: {
      productVersion: "0.2.0-alpha.2",
      channel: "internal-candidate",
      packagePromotionAllowed: false,
      localStableReplacementAllowed: false,
      supportClaim: false,
      requiredBeforePromotion: ["code_review", "qa_acceptance", "packaging_gate"]
    },
    commands: {
      openFile: true,
      dragDrop: true,
      play: false,
      pause: false,
      seek: false,
      loop: false,
      recover: false,
      replace: false,
      resetReplacement: false,
      save: false,
      export: false
    },
    canvas: {
      status: "failed",
      ...(detectedFormat ? { format: detectedFormat } : {}),
      playback: { status: "error", currentTimeMs: 0, loop: false },
      emptyCopy: "The 0.2 preview candidate reached a path-redacted terminal failure."
    },
    rightPanel: {
      facts: [{
        id: "mode",
        label: "Mode",
        value: "0.2.0-alpha.2",
        status: "fail"
      }],
      assetInventory: emptyAssetInventory(detectedFormat),
      layers: [],
      assets: [],
      lottieTexts: [],
      vapFusionImages: [],
      vapFusionTexts: [],
      unsupportedFeatures: [],
      issues: [issue]
    },
    replacement: {
      status: "idle",
      revision: 0,
      dirty: false,
      resetEnabled: false,
      playerAction: "none",
      active: []
    }
  };
}

function emptyAssetInventory(format) {
  const groups = [
    "image_resources",
    "text_candidates",
    "vap_fusion_images",
    "vap_fusion_texts",
    "sequence_frames",
    "audio_video_media",
    "other_resources",
    "unsupported_or_missing"
  ].map((id) => ({
    id,
    label: id.replace(/_/g, " "),
    count: 0,
    replaceableCount: 0,
    status: "empty",
    items: []
  }));
  return {
    schemaVersion: 1,
    format,
    pathRedacted: true,
    groups,
    summary: {
      totalItems: 0,
      replaceableItems: 0,
      imageCount: 0,
      textCount: 0,
      sequenceFrameCount: 0,
      audioVideoCount: 0,
      unsupportedOrMissingCount: 0
    },
    capabilityMarkers: []
  };
}

function formatFromPath(filePath) {
  const extension = path.extname(String(filePath)).toLowerCase();
  if (extension === ".json") return "lottie";
  if (extension === ".mp4") return "vap";
  if (extension === ".svga") return "svga";
  return undefined;
}

module.exports = {
  MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID,
  MULTIFORMAT_OPEN_TERMINAL_DEADLINE_MS,
  createMultiFormatDesktopPreviewSession
};
