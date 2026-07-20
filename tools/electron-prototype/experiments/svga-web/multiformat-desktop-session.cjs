"use strict";

const { createHash } = require("node:crypto");
const {
  closeSync,
  constants: fsConstants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  realpathSync,
  statSync,
  writeFileSync
} = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID = "0.2-multiformat-preview";
const MULTIFORMAT_DESKTOP_GATE = "0.2-owner-visible-multiformat-preview-wp5";
const MULTIFORMAT_MAX_DROPPED_BYTES = 50 * 1024 * 1024;
const MULTIFORMAT_MAX_RANGE_BYTES = 262_144;
const MULTIFORMAT_MAX_RUNTIME_JSON_BYTES = 5 * 1024 * 1024;
const MULTIFORMAT_MAX_REPLACEMENT_IMAGE_BYTES = 10 * 1024 * 1024;
const MULTIFORMAT_OPEN_TERMINAL_DEADLINE_MS = 15_000;

const allowedExtensions = new Set([".svga", ".json", ".mp4", ".aep"]);
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
    this.latestOpenRequestId = "";
    this.objectUrlSequence = 0;
    this.activeSourceId = "";
    this.activeSourceBinding = undefined;
    this.pendingOpenSourceBinding = undefined;
    this.sourceBindings = new Map();
    this.svgaReplacementPreview = undefined;
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
    this.latestOpenRequestId = requestId;
    const displayName = path.basename(normalizedPath);
    if (isAepPath(normalizedPath)) {
      validateAepHandoffSource(normalizedPath);
      this.disposePendingSession();
      this.clearActiveSourceAuthority();
      return this.aepHandoffResult(createAepHandoffModel({
        requestId,
        source: ownerOpenSource(source),
        displayName
      }));
    }
    let sourceBinding;
    let model;
    let stagedSession;
    try {
      sourceBinding = this.rememberSource(normalizedPath, requestId);
      this.pendingOpenSourceBinding = sourceBinding;
      stagedSession = await this.createSession(sourceBinding);
      model = await this.openWithTerminalDeadline(
        stagedSession.openLocalCandidate({
          gate: MULTIFORMAT_DESKTOP_GATE,
          requestId,
          source: ownerOpenSource(source),
          localPath: normalizedPath,
          displayName
        }),
        {
          requestId,
          source,
          displayName,
          localPath: normalizedPath
        },
        () => stagedSession?.dispose?.()
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
    } finally {
      if (this.pendingOpenSourceBinding?.requestId === requestId) {
        this.pendingOpenSourceBinding = undefined;
      }
    }
    const currentOpen = this.latestOpenRequestId === requestId;
    const acceptedOpen = currentOpen
      && model?.requestId === requestId
      && sourceBinding
      && isAcceptedMultiFormatOpenModel(model);
    if (acceptedOpen) {
      const previousSessionPromise = this.sessionPromise;
      const previousBinding = this.activeSourceBinding;
      this.sessionPromise = Promise.resolve(stagedSession);
      this.activeSourceId = sourceBinding.sourceId;
      this.activeSourceBinding = sourceBinding;
      this.svgaReplacementPreview = undefined;
      if (previousBinding && previousBinding !== sourceBinding) this.discardSourceBinding(previousBinding);
      if (previousSessionPromise) {
        previousSessionPromise.then((previousSession) => {
          if (previousSession !== stagedSession) previousSession?.dispose?.();
        }).catch(() => {});
      }
    } else {
      try {
        stagedSession?.dispose?.();
      } catch {}
      this.discardSourceBinding(sourceBinding);
    }
    return this.publicResult(
      model,
      acceptedOpen ? sourceBinding.sourceId : "",
      acceptedOpen ? normalizedPath : "",
      { inheritActiveSource: false }
    );
  }

  async openDroppedFile(input) {
    const displayName = safeDisplayName(input?.displayName ?? input?.name ?? "dropped-motion-asset");
    validateSupportedPath(displayName);
    if (isAepPath(displayName)) {
      const requestId = this.nextRequestId("dragDrop");
      this.disposePendingSession();
      this.clearActiveSourceAuthority();
      return this.aepHandoffResult(createAepHandoffModel({ requestId, source: "dragDrop", displayName }));
    }
    const bytes = droppedBytes(input);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const dropRoot = path.join(this.sessionRoot, "multiformat-drops");
    mkdirSync(dropRoot, { recursive: true });
    const filePath = path.join(dropRoot, `${hash.slice(0, 16)}-${displayName}`);
    writeFileSync(filePath, bytes);
    return this.openLocalFilePath(filePath, "dragDrop");
  }

  async prepareRuntimePreview(input) {
    const sourceId = String(input?.sourceId ?? "");
    const format = input?.format === "svga" || input?.format === "lottie" || input?.format === "vap" ? input.format : "";
    if (!/^[a-f0-9]{24}$/iu.test(sourceId) || !format) {
      return runtimePreviewFailure({
        format,
        code: "parse_precondition",
        message: "Owner-visible multi-format runtime preview open input is incomplete.",
        reason: "runtime_preview_input_invalid"
      });
    }
    const binding = this.activeSourceBindingForRequest(sourceId);
    if (!binding) {
      return runtimePreviewFailure({
        format,
        code: "missing_resource",
        message: "Owner-visible multi-format runtime preview source is no longer available.",
        reason: "runtime_preview_source_missing"
      });
    }
    const replacements = normalizeRuntimePreviewReplacements(input?.replacements);
    try {
      if (format === "lottie") {
        return this.prepareLottieRuntimePreview(binding, replacements);
      }
      if (format === "svga") {
        return this.prepareSvgaRuntimePreview(binding, replacements);
      }
      return await this.prepareVapRuntimePreview(binding, replacements);
    } catch (error) {
      return runtimePreviewFailure({
        format,
        code: "playback_failure",
        message: "Owner-visible multi-format runtime preview could not prepare a local playback payload.",
        reason: "runtime_preview_prepare_failed",
        cause: error
      });
    }
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
        this.svgaReplacementPreview = undefined;
        return this.publicResult(session.dispose());
      case "model":
      default:
        return this.publicResult(session.getModel());
    }
  }

  async resolveReplacementSelection(input) {
    const session = await this.ensureSession();
    return session.resolveReplacementSelection({
      targetId: String(input?.targetId ?? ""),
      kind: input?.kind === "text" ? "text" : "image"
    });
  }

  async applyReplacement(input) {
    const session = await this.ensureSession();
    const kind = input?.kind === "text" ? "text" : "image";
    const value = String(input?.value ?? "");
    const result = await session.applyReplacement({
      gate: MULTIFORMAT_DESKTOP_GATE,
      requestId: this.nextRequestId("replacement"),
      targetId: String(input?.targetId ?? ""),
      kind,
      value
    });
    const publicResult = this.publicResult(result);
    const lastAction = publicResult?.model?.replacement?.lastAction;
    const acceptedRuntimeTargetId = typeof lastAction?.runtimeTargetId === "string"
      ? lastAction.runtimeTargetId.trim()
      : "";
    if (
      lastAction?.type === "applyReplacement"
      && lastAction.status === "accepted"
      && acceptedRuntimeTargetId
      && value
    ) {
      return {
        ...publicResult,
        replacementRuntimeValue: {
          kind,
          targetId: acceptedRuntimeTargetId,
          value
        }
      };
    }
    return publicResult;
  }

  async resetReplacement(input = {}) {
    const session = await this.ensureSession();
    return this.publicResult(await session.resetReplacement({
      gate: MULTIFORMAT_DESKTOP_GATE,
      requestId: this.nextRequestId("reset"),
      ...(typeof input.targetId === "string" ? { targetId: input.targetId } : {}),
      ...(input.kind === "image" || input.kind === "text" ? { kind: input.kind } : {})
    }));
  }

  rememberSource(filePath, requestId) {
    const binding = createSourceBinding(filePath, requestId, MULTIFORMAT_MAX_DROPPED_BYTES);
    const sourceId = binding.sourceId;
    this.sourceStore?.set(sourceId, filePath);
    this.sourceBindings.set(sourceId, binding);
    return binding;
  }

  discardSourceBinding(binding) {
    if (!binding) return;
    if (this.sourceBindings.get(binding.sourceId) === binding) this.sourceBindings.delete(binding.sourceId);
    if (this.sourceStore?.get?.(binding.sourceId) === binding.filePath) this.sourceStore.delete?.(binding.sourceId);
  }

  revokeActiveSourceAuthority() {
    this.svgaReplacementPreview = undefined;
    this.activeSourceId = "";
    this.activeSourceBinding = undefined;
  }

  clearActiveSourceAuthority() {
    if (this.activeSourceBinding) this.discardSourceBinding(this.activeSourceBinding);
    this.revokeActiveSourceAuthority();
  }

  async ensureSession() {
    if (!this.sessionPromise) {
      this.sessionPromise = this.createSession();
    }
    return this.sessionPromise;
  }

  async createSession(sourceBinding) {
    const modules = await this.loadModules();
    const host = this.createHost(sourceBinding);
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
      svgaPlaybackTarget: { role: "desktop-source-contract-svga-target" },
      svgaReplacementController: this.createSvgaReplacementController(modules)
    });
  }

  createSvgaReplacementController(modules) {
    return {
      applyImage: async (input) => this.applySvgaImageReplacement(modules, input),
      reset: async (input) => this.resetSvgaImageReplacement(modules, input)
    };
  }

  async applySvgaImageReplacement(modules, input) {
    let binding;
    try {
      binding = this.activeSvgaSourceBinding(input?.workspaceModel);
    } catch {
      return rejectedSvgaReplacement(
        "svga_replacement_source_changed",
        "SVGA replacement source changed after Open; reopen the file before replacing an image."
      );
    }
    if (!binding) {
      return rejectedSvgaReplacement(
        "svga_replacement_source_stale",
        "SVGA replacement requires the active source and workspace generation."
      );
    }
    const targetId = String(input?.targetId ?? "").trim();
    if (!targetId) {
      return rejectedSvgaReplacement(
        "svga_replacement_target_invalid",
        "SVGA replacement requires one canonical imageKey."
      );
    }

    let replacementBytes;
    try {
      replacementBytes = decodeRuntimePngDataUri(input?.value);
    } catch {
      return rejectedSvgaReplacement(
        "svga_replacement_image_invalid",
        "SVGA replacement requires one bounded inline PNG image."
      );
    }

    let preview = this.svgaReplacementPreview;
    let currentSourceBytes;
    try {
      currentSourceBytes = readBoundedFileBuffer(binding.filePath, MULTIFORMAT_MAX_DROPPED_BYTES);
    } catch {
      return rejectedSvgaReplacement(
        "svga_replacement_source_unavailable",
        "SVGA replacement source is no longer readable within the bounded input contract."
      );
    }
    const currentSourceSha256 = sha256Bytes(currentSourceBytes);
    if (currentSourceSha256 !== binding.sha256) {
      return rejectedSvgaReplacement(
        "svga_replacement_source_changed",
        "SVGA replacement source changed after Open; reopen the file before replacing an image."
      );
    }
    if (preview && (
      preview.sourceId !== binding.sourceId
      || preview.filePath !== binding.filePath
      || preview.session.model.sourceSha256 !== currentSourceSha256
    )) {
      return rejectedSvgaReplacement(
        "svga_replacement_source_changed",
        "SVGA replacement source changed after Open; reopen the file before replacing an image."
      );
    }
    if (!preview) {
      preview = {
        sourceId: binding.sourceId,
        filePath: binding.filePath,
        session: modules.createShortTermImageReplacementPreviewSession(currentSourceBytes, {
          sourceName: path.basename(binding.filePath)
        })
      };
    }
    const activeTargetId = preview.session.model.activeReplacement?.imageKey;
    if (preview.session.model.dirty && activeTargetId && activeTargetId !== targetId) {
      return rejectedSvgaReplacement(
        "svga_single_replacement_target_required",
        "Reset the active SVGA image replacement before replacing another imageKey."
      );
    }

    const applied = await modules.applyShortTermImageReplacementPreview(
      preview.session,
      { imageKey: targetId, pngBytes: replacementBytes },
      { protoPath: path.join(this.repoRoot, "proto/svga.proto") }
    );
    if (this.activeSourceId !== binding.sourceId) {
      return rejectedSvgaReplacement(
        "svga_replacement_source_stale",
        "SVGA replacement source changed while the replacement was being prepared."
      );
    }
    try {
      verifySourceBinding(binding, MULTIFORMAT_MAX_DROPPED_BYTES);
    } catch {
      return rejectedSvgaReplacement(
        "svga_replacement_source_changed",
        "SVGA replacement source changed while the replacement was being prepared."
      );
    }
    let postApplySourceSha256;
    try {
      postApplySourceSha256 = sha256Bytes(readBoundedFileBuffer(binding.filePath, MULTIFORMAT_MAX_DROPPED_BYTES));
    } catch {
      return rejectedSvgaReplacement(
        "svga_replacement_source_unavailable",
        "SVGA replacement source became unreadable while the replacement was being prepared."
      );
    }
    if (postApplySourceSha256 !== currentSourceSha256 || postApplySourceSha256 !== binding.sha256) {
      return rejectedSvgaReplacement(
        "svga_replacement_source_changed",
        "SVGA replacement source changed while the replacement was being prepared."
      );
    }
    if (!applied.accepted) {
      return rejectedSvgaReplacement(
        applied.workflow?.diagnostic?.code || "svga_replacement_rejected",
        applied.workflow?.diagnostic?.message || "SVGA replacement did not pass validation."
      );
    }

    this.svgaReplacementPreview = {
      ...preview,
      session: applied.session
    };
    return {
      accepted: true,
      message: applied.session.model.lastAction.message,
      playerAction: "remountPreview",
      playback: input.workspaceModel?.playback
    };
  }

  async resetSvgaImageReplacement(modules, input) {
    let binding;
    try {
      binding = this.activeSvgaSourceBinding(input?.workspaceModel);
    } catch {
      return rejectedSvgaReplacement(
        "svga_replacement_source_changed",
        "SVGA replacement source changed after Open; reopen the file before Reset."
      );
    }
    const preview = this.svgaReplacementPreview;
    if (!binding || !preview || preview.sourceId !== binding.sourceId || preview.session.model.dirty !== true) {
      return rejectedSvgaReplacement(
        "svga_replacement_reset_not_needed",
        "SVGA replacement Reset requires the active replaced imageKey."
      );
    }
    let currentSourceSha256;
    try {
      currentSourceSha256 = sha256Bytes(readBoundedFileBuffer(binding.filePath, MULTIFORMAT_MAX_DROPPED_BYTES));
    } catch {
      return rejectedSvgaReplacement(
        "svga_replacement_source_unavailable",
        "SVGA replacement source is no longer readable within the bounded input contract."
      );
    }
    if (currentSourceSha256 !== preview.session.model.sourceSha256 || currentSourceSha256 !== binding.sha256) {
      return rejectedSvgaReplacement(
        "svga_replacement_source_changed",
        "SVGA replacement source changed after Open; reopen the file before Reset."
      );
    }
    this.svgaReplacementPreview = {
      ...preview,
      session: modules.resetShortTermImageReplacementPreview(preview.session)
    };
    return {
      accepted: true,
      message: this.svgaReplacementPreview.session.model.lastAction.message,
      playerAction: "remountSource",
      playback: input.workspaceModel?.playback
    };
  }

  activeSvgaSourceBinding(workspaceModel) {
    if (workspaceModel?.detectedFormat !== "svga" || !/^[a-f0-9]{24}$/iu.test(this.activeSourceId)) return undefined;
    if (this.sourceStore?.get(this.activeSourceId) !== this.activeSourceBinding?.filePath) return undefined;
    verifySourceBinding(this.activeSourceBinding, MULTIFORMAT_MAX_DROPPED_BYTES);
    return this.activeSourceBinding;
  }

  activeSourceBindingForRequest(sourceId) {
    if (!/^[a-f0-9]{24}$/iu.test(sourceId) || sourceId !== this.activeSourceId) return undefined;
    const binding = this.sourceBindings.get(sourceId);
    if (!binding || this.activeSourceBinding?.sourceId !== sourceId) return undefined;
    if (this.sourceStore?.get(sourceId) !== binding.filePath) return undefined;
    try {
      verifySourceBinding(binding, MULTIFORMAT_MAX_DROPPED_BYTES);
      return binding;
    } catch {
      return undefined;
    }
  }

  async openWithTerminalDeadline(openPromise, context, onTimeout) {
    let timeout;
    const timeoutPromise = new Promise((resolve) => {
      timeout = setTimeout(() => {
        try {
          onTimeout?.();
        } catch {}
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

  prepareLottieRuntimePreview(binding, replacements) {
    const filePath = binding.filePath;
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      return runtimePreviewFailure({
        format: "lottie",
        code: "missing_resource",
        message: "Lottie runtime preview requires a readable local JSON file.",
        reason: "lottie_source_file_required"
      });
    }
    if (stat.size <= 0 || stat.size > MULTIFORMAT_MAX_RUNTIME_JSON_BYTES) {
      return runtimePreviewFailure({
        format: "lottie",
        code: "parse_precondition",
        message: "Lottie runtime preview requires a bounded local JSON file.",
        reason: "bounded_lottie_json_required"
      });
    }
    let animationData;
    try {
      animationData = JSON.parse(readFileSync(filePath, "utf8"));
    } catch (error) {
      return runtimePreviewFailure({
        format: "lottie",
        code: "parse_precondition",
        message: "Lottie runtime preview requires valid JSON animation data.",
        reason: "valid_lottie_json_required",
        cause: error
      });
    }
    if (!animationData || typeof animationData !== "object" || Array.isArray(animationData)) {
      return runtimePreviewFailure({
        format: "lottie",
        code: "parse_precondition",
        message: "Lottie runtime preview requires object animation data.",
        reason: "lottie_animation_object_required"
      });
    }

    const cloned = JSON.parse(JSON.stringify(animationData));
    const expressionResult = normalizeLottieRuntimeExpressions(cloned);
    if (expressionResult.status === "failed") {
      return runtimePreviewFailure({
        format: "lottie",
        code: "unsupported_feature",
        message: "Lottie runtime preview cannot safely execute this animation expression under strict CSP.",
        reason: expressionResult.reason
      });
    }
    const inlineResult = inlineLottieRuntimeImageAssets(cloned, binding, replacements.image);
    if (inlineResult.status === "failed") return inlineResult;
    applyLottieRuntimeTextReplacements(cloned, replacements.text);
    return {
      status: "prepared",
      format: "lottie",
      pathRedacted: true,
      rendererHasFullPath: false,
      runtimeScripts: ["/runtime-node-modules/lottie-web/build/player/lottie_svg.js"],
      animationData: cloned,
      expressionNormalization: {
        safeLoopOutProperties: expressionResult.normalizedCount,
        sourceEvaluationAllowed: false
      },
      dimensions: {
        width: Number(cloned.w) || undefined,
        height: Number(cloned.h) || undefined
      },
      playback: {
        fps: Number(cloned.fr) || undefined,
        durationMs: Number.isFinite(Number(cloned.op) - Number(cloned.ip)) && Number(cloned.fr) > 0
          ? Math.round(((Number(cloned.op) - Number(cloned.ip)) / Number(cloned.fr)) * 1000)
          : undefined
      }
    };
  }

  prepareSvgaRuntimePreview(binding, replacements) {
    const filePath = binding.filePath;
    const sourceId = binding.sourceId;
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      return runtimePreviewFailure({
        format: "svga",
        code: "missing_resource",
        message: "SVGA runtime preview requires a readable local SVGA file.",
        reason: "svga_source_file_required"
      });
    }
    if (stat.size <= 0 || stat.size > MULTIFORMAT_MAX_DROPPED_BYTES) {
      return runtimePreviewFailure({
        format: "svga",
        code: "parse_precondition",
        message: "SVGA runtime preview requires a bounded local SVGA file.",
        reason: "bounded_svga_required"
      });
    }
    let bytes;
    let replacementPreviewActive = false;
    try {
      const preview = this.svgaReplacementPreview;
      const activeTargetId = preview?.session.model.activeReplacement?.imageKey;
      replacementPreviewActive = Boolean(
        preview
        && preview.sourceId === sourceId
        && preview.filePath === filePath
        && preview.session.model.dirty === true
        && activeTargetId
        && replacements.activeImageTargetIds.has(activeTargetId)
      );
      bytes = replacementPreviewActive
        ? Buffer.from(preview.session.previewBytes)
        : readBoundedFileBuffer(filePath, MULTIFORMAT_MAX_DROPPED_BYTES);
      if (!replacementPreviewActive && sha256Bytes(bytes) !== binding.sha256) {
        throw new Error("SVGA source changed after Open.");
      }
    } catch {
      return runtimePreviewFailure({
        format: "svga",
        code: "parse_precondition",
        message: "SVGA runtime preview source changed outside the bounded read limit.",
        reason: "bounded_svga_read_required"
      });
    }
    return {
      status: "prepared",
      format: "svga",
      pathRedacted: true,
      rendererHasFullPath: false,
      runtimeScripts: ["/vendor/svga-web-2.4.4.js"],
      svgaBase64: Buffer.from(bytes).toString("base64"),
      mediaType: mediaTypeFromPath(filePath),
      replacementPreview: {
        active: replacementPreviewActive,
        revision: this.svgaReplacementPreview?.sourceId === sourceId
          ? this.svgaReplacementPreview.session.model.revision
          : 0,
        sourceUnchanged: this.svgaReplacementPreview?.sourceId === sourceId
          ? this.svgaReplacementPreview.session.model.sourceUnchanged
          : true
      }
    };
  }

  async prepareVapRuntimePreview(binding, replacements) {
    const filePath = binding.filePath;
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      return runtimePreviewFailure({
        format: "vap",
        code: "missing_resource",
        message: "VAP runtime preview requires a readable local MP4 file.",
        reason: "vap_source_file_required"
      });
    }
    if (stat.size <= 0 || stat.size > MULTIFORMAT_MAX_DROPPED_BYTES) {
      return runtimePreviewFailure({
        format: "vap",
        code: "parse_precondition",
        message: "VAP runtime preview requires a bounded local MP4 file.",
        reason: "bounded_vap_mp4_required"
      });
    }
    const modules = await this.loadModules();
    const bytes = readBoundedFileBuffer(filePath, MULTIFORMAT_MAX_DROPPED_BYTES);
    if (sha256Bytes(bytes) !== binding.sha256) {
      return runtimePreviewFailure({
        format: "vap",
        code: "parse_precondition",
        message: "VAP runtime preview source changed after Open.",
        reason: "vap_source_identity_changed"
      });
    }
    const adjacentVapc = readAdjacentVapcJsonForFile(filePath, MULTIFORMAT_MAX_RANGE_BYTES, binding.adjacentVapc);
    const source = runtimePreviewSource(filePath, bytes, adjacentVapc);
    const fusionParams = vapFusionParamsFromReplacements(replacements);
    const inspection = await new modules.VapInspectionService().inspect(source, {
      gate: modules.VAP_INSPECTION_READINESS_GATE,
      providedFusionTags: Object.keys(fusionParams)
    });
    if (!inspection.value) {
      return runtimePreviewFailure({
        format: "vap",
        code: inspection.issues[0]?.code ?? "parse_precondition",
        message: inspection.issues[0]?.message ?? "VAP runtime preview requires successful vapc inspection.",
        reason: "vap_inspection_required"
      });
    }
    const vapConfig = runtimeCompatibleVapConfig(inspection.value.metadata?.vap?.config);
    if (!vapConfig) {
      return runtimePreviewFailure({
        format: "vap",
        code: "parse_precondition",
        message: "VAP runtime preview requires extracted vapc JSON configuration.",
        reason: "vapc_config_required"
      });
    }
    return {
      status: "prepared",
      format: "vap",
      pathRedacted: true,
      rendererHasFullPath: false,
      runtimeScripts: ["/runtime-node-modules/video-animation-player/dist/vap.js"],
      mp4Base64: Buffer.from(bytes).toString("base64"),
      mediaType: mediaTypeFromPath(filePath),
      vapConfig,
      fusionParams,
      dimensions: inspection.value.dimensions,
      playback: {
        fps: inspection.value.timing.fps,
        durationMs: inspection.value.timing.durationMs
      }
    };
  }

  async loadModules() {
    if (!this.modulesPromise) {
      const moduleUrl = (relativePath) => pathToFileURL(path.join(this.repoRoot, relativePath)).href;
      this.modulesPromise = Promise.all([
        import(moduleUrl("dist/workbench/multiformat-owner-preview-candidate.js")),
        import(moduleUrl("dist/workbench/svga/format-adapter.js")),
        import(moduleUrl("dist/workbench/svga/node-protobuf-inspector.js")),
        import(moduleUrl("dist/hosts/fast-png-alpha-analyzer.js")),
        import(moduleUrl("dist/hosts/sha256-resource-hasher.js")),
        import(moduleUrl("dist/workbench/vap-inspection.js")),
        import(moduleUrl("dist/workbench/short-term-image-replacement-preview-session.js"))
      ]).then(([ownerPreview, svgaFormat, svgaInspector, alphaAnalyzer, resourceHasher, vapInspection, svgaReplacement]) => ({
        createOwnerVisibleMultiFormatPreviewCandidate: ownerPreview.createOwnerVisibleMultiFormatPreviewCandidate,
        SvgaFormatAdapter: svgaFormat.SvgaFormatAdapter,
        NodeProtobufSvgaInspector: svgaInspector.NodeProtobufSvgaInspector,
        FastPngAlphaAnalyzer: alphaAnalyzer.FastPngAlphaAnalyzer,
        Sha256ResourceHasher: resourceHasher.Sha256ResourceHasher,
        VapInspectionService: vapInspection.VapInspectionService,
        VAP_INSPECTION_READINESS_GATE: vapInspection.VAP_INSPECTION_READINESS_GATE,
        createShortTermImageReplacementPreviewSession: svgaReplacement.createShortTermImageReplacementPreviewSession,
        applyShortTermImageReplacementPreview: svgaReplacement.applyShortTermImageReplacementPreview,
        resetShortTermImageReplacementPreview: svgaReplacement.resetShortTermImageReplacementPreview
      }));
    }
    return this.modulesPromise;
  }

  createHost(sessionSourceBinding) {
    const owner = this;
    return {
      async statLocalFile(localPath) {
        const filePath = normalizeLocalPath(localPath);
        owner.assertBoundSource(filePath, sessionSourceBinding);
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
        owner.assertBoundSource(filePath, sessionSourceBinding);
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
      async readLocalFile(input) {
        const filePath = normalizeLocalPath(input?.localPath);
        owner.assertBoundSource(filePath, sessionSourceBinding);
        const maxBytes = Math.max(0, Math.min(Number(input?.maxBytes) || 0, MULTIFORMAT_MAX_DROPPED_BYTES));
        const stat = statSync(filePath);
        if (!stat.isFile()) throw new Error("Local motion source is not a file.");
        if (stat.size <= 0 || stat.size > maxBytes) {
          throw new Error("Local motion source is outside the bounded full-read limit.");
        }
        const bytes = readBoundedFileBuffer(filePath, maxBytes);
        if (bytes.byteLength <= 0 || bytes.byteLength > maxBytes) {
          throw new Error("Local motion source changed outside the bounded full-read limit.");
        }
        return new Uint8Array(bytes);
      },
      async readAdjacentResource(input) {
        const sourcePath = normalizeLocalPath(input?.sourceLocalPath);
        const maxBytes = Math.max(0, Math.min(Number(input?.maxBytes) || 0, 5 * 1024 * 1024));
        const sourceBinding = owner.boundSourceForLocalPath(sourcePath, sessionSourceBinding);
        if (!sourceBinding) throw new Error("Adjacent resource source is not the active opened candidate.");
        const relativePath = normalizeRuntimeRelativePath(String(input?.relativePath ?? ""));
        const existingBinding = sourceBinding.adjacentResources.get(relativePath);
        const read = readRootBoundedAdjacentResource(
          sourcePath,
          relativePath,
          maxBytes,
          existingBinding
        );
        sourceBinding.adjacentResources.set(relativePath, read.binding);
        return {
          bytes: new Uint8Array(read.bytes),
          sizeBytes: read.bytes.byteLength,
          mediaType: read.mediaType
        };
      },
      async readAdjacentVapcJson(input) {
        const sourcePath = normalizeLocalPath(input?.localPath);
        const maxBytes = Math.max(0, Math.min(Number(input?.maxBytes) || 0, MULTIFORMAT_MAX_RANGE_BYTES));
        const sourceBinding = owner.boundSourceForLocalPath(sourcePath, sessionSourceBinding);
        if (!sourceBinding) throw new Error("Adjacent VAP config source is not the active opened candidate.");
        return readAdjacentVapcJsonForFile(sourcePath, maxBytes, sourceBinding.adjacentVapc);
      },
      async createLocalObjectUrl(input) {
        const filePath = normalizeLocalPath(input?.localPath);
        owner.assertBoundSource(filePath, sessionSourceBinding);
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

  publicResult(model, sourceId = "", sourcePath = "", options = {}) {
    if (sourceId) {
      this.svgaReplacementPreview = undefined;
      this.activeSourceId = sourceId;
      this.activeSourceBinding = this.sourceBindings.get(sourceId);
    }
    const publicSourceId = sourceId || (options.inheritActiveSource === false ? "" : this.activeSourceId);
    const ownerRightPanelSnapshotEnvelope = withOwnerSnapshotSourceId(
      model?.ownerRightPanelSnapshotEnvelope,
      publicSourceId
    );
    const publicModel = ownerRightPanelSnapshotEnvelope
      ? { ...model, ownerRightPanelSnapshotEnvelope }
      : model;
    const svgaSource = sourceId && sourcePath && model?.detectedFormat === "svga"
      ? publicSvgaSource(this.sourceBindings.get(sourceId) ?? sourcePath)
      : undefined;
    return {
      status: "opened",
      model: publicModel,
      sourceId: publicSourceId,
      ...(ownerRightPanelSnapshotEnvelope ? { ownerRightPanelSnapshotEnvelope } : {}),
      ...(svgaSource ? { svgaSource } : {}),
      pathRedacted: true,
      lifecycle: { ...this.lifecycle },
      visualEvidence: {
        lottieDomPlaybackVerified: false,
        vapVisualPlaybackVerified: false,
        note: "Desktop WP6 integrates the formal 0.2 shell and source-side runtime contracts; real-material visual success still requires CR/QA/Packaging evidence."
      }
    };
  }

  boundSourceForLocalPath(filePath, sessionSourceBinding) {
    const normalizedPath = normalizeLocalPath(filePath);
    const candidates = [sessionSourceBinding, this.pendingOpenSourceBinding, this.activeSourceBinding].filter(Boolean);
    return candidates.find((binding) => binding.filePath === normalizedPath);
  }

  assertBoundSource(filePath, sessionSourceBinding) {
    const binding = this.boundSourceForLocalPath(filePath, sessionSourceBinding);
    if (!binding) throw new Error("Local motion source is not bound to the current open generation.");
    verifySourceBinding(binding, MULTIFORMAT_MAX_DROPPED_BYTES);
    return binding;
  }

  aepHandoffResult(model) {
    return {
      status: "handoffRequired",
      outcome: "aepHandoff",
      model,
      sourceId: "",
      sourceAuthority: false,
      recentAuthority: false,
      previewAuthority: false,
      saveAuthority: false,
      pathRedacted: true,
      lifecycle: { ...this.lifecycle }
    };
  }
}

function withOwnerSnapshotSourceId(envelope, sourceId) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return undefined;
  if (envelope.schemaVersion !== 1 || envelope.pathRedacted !== true) return undefined;
  if (typeof envelope.snapshotJson !== "string" || typeof envelope.snapshotSha256 !== "string") return undefined;
  if (!Number.isSafeInteger(envelope.snapshotByteLength) || envelope.snapshotByteLength <= 0) return undefined;
  return {
    schemaVersion: 1,
    sourceId: typeof sourceId === "string" && /^[A-Za-z0-9._:-]{0,128}$/u.test(sourceId) ? sourceId : "",
    snapshotJson: envelope.snapshotJson,
    snapshotByteLength: envelope.snapshotByteLength,
    snapshotSha256: envelope.snapshotSha256,
    pathRedacted: true
  };
}

function publicSvgaSource(bindingOrPath) {
  try {
    const filePath = typeof bindingOrPath === "string" ? bindingOrPath : bindingOrPath.filePath;
    const bytes = readBoundedFileBuffer(filePath, MULTIFORMAT_MAX_DROPPED_BYTES);
    if (typeof bindingOrPath !== "string" && sha256Bytes(bytes) !== bindingOrPath.sha256) return undefined;
    return {
      displayName: path.basename(filePath),
      bytes: new Uint8Array(bytes),
      pathRedacted: true
    };
  } catch {
    return undefined;
  }
}

function normalizeLottieRuntimeExpressions(documentValue) {
  const compositionStart = documentValue?.ip;
  const compositionEnd = documentValue?.op;
  if (!Number.isFinite(compositionStart) || !Number.isFinite(compositionEnd) || compositionEnd <= compositionStart) {
    return { status: "failed", reason: "valid_lottie_composition_timing_required" };
  }
  let normalizedCount = 0;
  let failureReason;
  const visit = (value) => {
    if (failureReason || !value || typeof value !== "object") return;
    if (!Array.isArray(value) && typeof value.x === "string") {
      const result = normalizeSafeNoArgumentLoopOutProperty(value, compositionStart, compositionEnd);
      if (result.status === "failed") {
        failureReason = result.reason;
        return;
      }
      normalizedCount += 1;
    }
    for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child);
  };
  visit(documentValue);
  return failureReason
    ? { status: "failed", reason: failureReason }
    : { status: "ok", normalizedCount };
}

function normalizeSafeNoArgumentLoopOutProperty(property, compositionStart, compositionEnd) {
  const expression = String(property.x ?? "");
  const safeExpression = /^\s*(?:var\s+\$bm_rt\s*;\s*)?\$bm_rt\s*=\s*loopOut\s*\(\s*\)\s*;?\s*$/u;
  if (!safeExpression.test(expression)) {
    return { status: "failed", reason: "unsupported_lottie_expression" };
  }
  const keyframes = property.a === 1 && Array.isArray(property.k) ? property.k : undefined;
  if (!keyframes || keyframes.length < 2 || keyframes.length > 2048) {
    return { status: "failed", reason: "safe_loop_out_keyframes_required" };
  }
  let vectorLength;
  let previousTime = -Infinity;
  for (const keyframe of keyframes) {
    if (!isRecord(keyframe) || !Number.isFinite(keyframe.t) || keyframe.t <= previousTime) {
      return { status: "failed", reason: "safe_loop_out_keyframes_required" };
    }
    if (!Array.isArray(keyframe.s) || keyframe.s.length === 0 || keyframe.s.some((entry) => !Number.isFinite(entry))) {
      return { status: "failed", reason: "safe_loop_out_numeric_vectors_required" };
    }
    vectorLength ??= keyframe.s.length;
    if (keyframe.s.length !== vectorLength) {
      return { status: "failed", reason: "safe_loop_out_numeric_vectors_required" };
    }
    if (!isValidSafeLoopOutKeyframeMetadata(keyframe, vectorLength)) {
      return { status: "failed", reason: "safe_loop_out_keyframe_metadata_required" };
    }
    previousTime = keyframe.t;
  }
  const firstTime = keyframes[0].t;
  const lastTime = keyframes.at(-1).t;
  const cycleFrames = lastTime - firstTime;
  if (firstTime < compositionStart || lastTime > compositionEnd || cycleFrames <= 0) {
    return { status: "failed", reason: "safe_loop_out_timing_required" };
  }
  const sourceKeyframes = keyframes.map((keyframe) => JSON.parse(JSON.stringify(keyframe)));
  const expanded = sourceKeyframes.map((keyframe) => JSON.parse(JSON.stringify(keyframe)));
  for (let offset = cycleFrames; firstTime + offset <= compositionEnd; offset += cycleFrames) {
    for (let index = 1; index < sourceKeyframes.length; index += 1) {
      const repeatedTime = sourceKeyframes[index].t + offset;
      if (repeatedTime > compositionEnd) continue;
      const repeated = JSON.parse(JSON.stringify(sourceKeyframes[index]));
      repeated.t = repeatedTime;
      expanded.push(repeated);
      if (expanded.length > 4096) {
        return { status: "failed", reason: "safe_loop_out_expansion_bound_exceeded" };
      }
    }
  }
  property.k = expanded;
  delete property.x;
  return { status: "ok" };
}

function isValidSafeLoopOutKeyframeMetadata(keyframe, vectorLength) {
  const allowedFields = new Set(["t", "s", "e", "i", "o", "h", "to", "ti"]);
  if (Object.keys(keyframe).some((field) => !allowedFields.has(field))) return false;

  if (hasOwn(keyframe, "e") && !isFiniteVector(keyframe.e, vectorLength)) return false;
  if (hasOwn(keyframe, "h") && keyframe.h !== 0 && keyframe.h !== 1) return false;

  const hasInEasing = hasOwn(keyframe, "i");
  const hasOutEasing = hasOwn(keyframe, "o");
  if (hasInEasing !== hasOutEasing) return false;
  if (hasInEasing && (
    !isValidLottieEasingRecord(keyframe.i, vectorLength)
    || !isValidLottieEasingRecord(keyframe.o, vectorLength)
  )) return false;

  const hasOutTangent = hasOwn(keyframe, "to");
  const hasInTangent = hasOwn(keyframe, "ti");
  if (hasOutTangent !== hasInTangent) return false;
  if (hasOutTangent && (
    !isFiniteVector(keyframe.to, vectorLength)
    || !isFiniteVector(keyframe.ti, vectorLength)
  )) return false;

  return true;
}

function isValidLottieEasingRecord(value, vectorLength) {
  if (!isRecord(value)) return false;
  const fields = Object.keys(value);
  if (fields.length !== 2 || !hasOwn(value, "x") || !hasOwn(value, "y")) return false;
  return isValidLottieEasingComponent(value.x, vectorLength)
    && isValidLottieEasingComponent(value.y, vectorLength);
}

function isValidLottieEasingComponent(value, vectorLength) {
  if (Number.isFinite(value)) return true;
  return Array.isArray(value)
    && (value.length === 1 || value.length === vectorLength)
    && value.every((entry) => Number.isFinite(entry));
}

function isFiniteVector(value, vectorLength) {
  return Array.isArray(value)
    && value.length === vectorLength
    && value.every((entry) => Number.isFinite(entry));
}

function hasOwn(value, field) {
  return Object.prototype.hasOwnProperty.call(value, field);
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
          const source = _source && typeof _source === "object" ? _source : {};
          state = { ...state, status: "ready", currentTimeMs: 0 };
          return {
            value: {
              format,
              name: typeof source.name === "string" && source.name ? source.name : `${format} source`,
              sizeBytes: Number.isFinite(Number(source.sizeBytes)) ? Number(source.sizeBytes) : 0,
              timing: {},
              resources: [],
              layers: []
            },
            issues: []
          };
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

function normalizeRuntimePreviewReplacements(value) {
  const records = Array.isArray(value?.active)
    ? value.active
    : Array.isArray(value)
      ? value
      : [];
  const runtimeValues = Array.isArray(value?.runtimeValues) ? value.runtimeValues : [];
  const image = new Map();
  const text = new Map();
  const activeImageTargetIds = new Set();
  const activeTextTargetIds = new Set();
  for (const record of records) {
    const targetId = String(record?.targetId ?? "").trim();
    const kind = record?.kind === "text" ? "text" : record?.kind === "image" ? "image" : "";
    const valuePreview = typeof record?.valuePreview === "string" ? record.valuePreview : "";
    if (!targetId || !kind) continue;
    if (kind === "image") activeImageTargetIds.add(targetId);
    if (kind === "text") activeTextTargetIds.add(targetId);
    if (!valuePreview) continue;
    if (kind === "image" && isSafeRuntimeImageValue(valuePreview)) image.set(targetId, valuePreview);
    if (kind === "text" && valuePreview.length <= 4000) text.set(targetId, valuePreview);
  }
  for (const record of runtimeValues) {
    const targetId = String(record?.targetId ?? "").trim();
    const kind = record?.kind === "text" ? "text" : record?.kind === "image" ? "image" : "";
    const runtimeValue = typeof record?.value === "string" ? record.value : "";
    if (!targetId || !kind || !runtimeValue) continue;
    if (kind === "image" && isSafeRuntimeImageValue(runtimeValue)) image.set(targetId, runtimeValue);
    if (kind === "text" && runtimeValue.length <= 4000) text.set(targetId, runtimeValue);
  }
  return { image, text, activeImageTargetIds, activeTextTargetIds };
}

function inlineLottieRuntimeImageAssets(documentValue, sourceBinding, imageReplacements) {
  if (!Array.isArray(documentValue?.assets)) return { status: "ok" };
  for (const asset of documentValue.assets) {
    if (!isRecord(asset) || Array.isArray(asset.layers)) continue;
    const id = stringValue(asset.id);
    const replacement = id ? imageReplacements.get(id) : undefined;
    if (replacement) {
      asset.p = replacement;
      asset.u = "";
      asset.e = 1;
      continue;
    }
    if (typeof asset.p === "string" && isSafeRuntimeImageValue(asset.p)) {
      asset.u = "";
      asset.e = 1;
      continue;
    }
    if (asset.p === undefined && asset.u === undefined) continue;
    const rawPath = typeof asset.p === "string" ? asset.p.trim() : "";
    const rawDirectory = typeof asset.u === "string" ? asset.u.trim() : "";
    const candidate = normalizeLottieRuntimeImageReference(rawDirectory, rawPath);
    if (!isDeterministicRuntimeRelativePath(candidate)) {
      return runtimePreviewFailure({
        format: "lottie",
        code: "asset_reference_precondition",
        message: "Lottie runtime preview only accepts deterministic relative image resources.",
        reason: "unsafe_lottie_image_reference"
      });
    }
    try {
      const normalized = normalizeRuntimeRelativePath(candidate);
      const existingBinding = sourceBinding.adjacentResources.get(normalized);
      const read = readRootBoundedAdjacentResource(
        sourceBinding.filePath,
        normalized,
        5 * 1024 * 1024,
        existingBinding
      );
      sourceBinding.adjacentResources.set(normalized, read.binding);
      const mediaType = read.mediaType;
      if (!mediaType.startsWith("image/")) {
        return runtimePreviewFailure({
          format: "lottie",
          code: "unsupported_feature",
          message: "Lottie runtime preview supports PNG, JPEG, and WebP adjacent image resources only.",
          reason: "unsupported_adjacent_image_type"
        });
      }
      asset.p = `data:${mediaType};base64,${read.bytes.toString("base64")}`;
      asset.u = "";
      asset.e = 1;
    } catch (error) {
      return runtimePreviewFailure({
        format: "lottie",
        code: "missing_resource",
        message: "Lottie runtime preview could not read an adjacent image resource.",
        reason: "adjacent_image_read_failed",
        cause: error
      });
    }
  }
  return { status: "ok" };
}

function applyLottieRuntimeTextReplacements(documentValue, textReplacements) {
  const visitLayers = (layers) => {
    if (!Array.isArray(layers)) return;
    layers.forEach((layer, index) => {
      if (!isRecord(layer)) return;
      const id = stringValue(layer.ind) || `layer_${index}`;
      const replacement = textReplacements.get(`text:${id}`) ?? textReplacements.get(id);
      if (layer.ty === 5 && replacement !== undefined) setLottieTextLayerValue(layer, replacement);
    });
  };
  visitLayers(documentValue.layers);
  if (Array.isArray(documentValue.assets)) {
    documentValue.assets.forEach((asset) => {
      if (isRecord(asset)) visitLayers(asset.layers);
    });
  }
}

function setLottieTextLayerValue(layer, value) {
  if (!isRecord(layer.t)) layer.t = {};
  if (!isRecord(layer.t.d)) layer.t.d = {};
  if (!Array.isArray(layer.t.d.k) || layer.t.d.k.length === 0) layer.t.d.k = [{ s: { t: "" } }];
  const first = layer.t.d.k[0];
  if (!isRecord(first.s)) first.s = {};
  first.s.t = value;
}

function vapFusionParamsFromReplacements(replacements) {
  const params = {};
  for (const [tag, value] of replacements.image.entries()) params[tag] = value;
  for (const [tag, value] of replacements.text.entries()) params[tag] = value;
  return params;
}

function runtimeCompatibleVapConfig(config) {
  if (!isRecord(config)) return undefined;
  const clone = JSON.parse(JSON.stringify(config));
  if (isRecord(clone.info)) {
    clone.info.aFrame = runtimeVapRect(clone.info.aFrame);
    clone.info.rgbFrame = runtimeVapRect(clone.info.rgbFrame);
  }
  if (Array.isArray(clone.src)) {
    clone.src = clone.src.map((entry) => {
      if (!isRecord(entry)) return entry;
      if (entry.srcType === "image") entry.srcType = "img";
      if (entry.srcType === "text") entry.srcType = "txt";
      return entry;
    });
  }
  if (Array.isArray(clone.frame)) {
    clone.frame = clone.frame.map((frame) => {
      if (!isRecord(frame) || !Array.isArray(frame.obj)) return frame;
      frame.obj = frame.obj.map((entry) => {
        if (!isRecord(entry)) return entry;
        entry.frame = runtimeVapRect(entry.frame);
        entry.mFrame = runtimeVapRect(entry.mFrame);
        return entry;
      });
      return frame;
    });
  }
  return clone;
}

function runtimeVapRect(value) {
  if (Array.isArray(value)) return value.map((item) => Number(item) || 0).slice(0, 4);
  if (isRecord(value)) return [value.x, value.y, value.w, value.h].map((item) => Number(item) || 0);
  return value;
}

function runtimePreviewSource(filePath, bytes, adjacentVapc) {
  const byteView = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    id: filePath,
    name: path.basename(filePath),
    sizeBytes: byteView.byteLength,
    mediaType: mediaTypeFromPath(filePath),
    vapcJsonBytes: adjacentVapc?.bytes,
    vapcJsonName: adjacentVapc?.displayName,
    async read() {
      return byteView;
    },
    async readRange(offset, length) {
      const start = Math.max(0, Math.trunc(Number(offset) || 0));
      const end = Math.min(byteView.byteLength, start + Math.max(0, Math.trunc(Number(length) || 0)));
      return byteView.slice(start, end);
    }
  };
}

function readBoundedFileBuffer(filePath, maxBytes) {
  const limit = Math.max(0, Math.trunc(Number(maxBytes) || 0));
  const fd = openSync(filePath, "r");
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size <= 0 || stat.size > limit) {
      throw new Error("File is outside the bounded read limit.");
    }
    const chunks = [];
    const scratch = Buffer.allocUnsafe(Math.min(64 * 1024, limit + 1));
    let totalBytes = 0;
    while (totalBytes <= limit) {
      const remaining = limit + 1 - totalBytes;
      const bytesRead = readSync(fd, scratch, 0, Math.min(scratch.byteLength, remaining), null);
      if (bytesRead === 0) break;
      chunks.push(Buffer.from(scratch.subarray(0, bytesRead)));
      totalBytes += bytesRead;
    }
    if (totalBytes <= 0 || totalBytes > limit || totalBytes !== stat.size) {
      throw new Error("File changed outside the bounded read limit.");
    }
    return Buffer.concat(chunks, totalBytes);
  } finally {
    closeSync(fd);
  }
}

function readRootBoundedAdjacentResource(sourceLocalPath, relativePath, maxBytes, expectedBinding) {
  const limit = Math.max(0, Math.trunc(Number(maxBytes) || 0));
  if (limit <= 0) throw new Error("Adjacent resource read limit is invalid.");
  const resolvedResource = resolveAdjacentResource(sourceLocalPath, relativePath);
  const { resourcePath, rootPath } = resolvedResource;
  const ancestorIdentitiesBefore = ancestorDirectoryIdentities(rootPath, resourcePath);
  const fd = openSync(resourcePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const before = fstatSync(fd);
    const pathBefore = statSync(resourcePath);
    if (
      !before.isFile()
      || before.size <= 0
      || before.size > limit
      || before.nlink !== 1
      || !sameFileIdentity(before, pathBefore)
    ) {
      throw new Error("Adjacent resource is outside the bounded regular-file contract.");
    }
    const chunks = [];
    const scratch = Buffer.allocUnsafe(Math.min(64 * 1024, limit + 1));
    let totalBytes = 0;
    while (totalBytes <= limit) {
      const remaining = limit + 1 - totalBytes;
      const bytesRead = readSync(fd, scratch, 0, Math.min(scratch.byteLength, remaining), null);
      if (bytesRead === 0) break;
      chunks.push(Buffer.from(scratch.subarray(0, bytesRead)));
      totalBytes += bytesRead;
    }
    const after = fstatSync(fd);
    const pathAfter = statSync(resourcePath);
    const resolvedAfterRead = resolveAdjacentResource(sourceLocalPath, relativePath);
    const ancestorIdentitiesAfter = ancestorDirectoryIdentities(resolvedAfterRead.rootPath, resourcePath);
    if (
      totalBytes <= 0
      || totalBytes > limit
      || totalBytes !== before.size
      || !sameFileIdentity(before, after)
      || !sameFileIdentity(before, pathAfter)
      || after.size !== before.size
      || !sameIdentityList(ancestorIdentitiesBefore, ancestorIdentitiesAfter)
    ) {
      throw new Error("Adjacent resource changed during the bounded read.");
    }
    const bytes = Buffer.concat(chunks, totalBytes);
    const binding = {
      filePath: resourcePath,
      relativePath,
      dev: before.dev,
      ino: before.ino,
      nlink: before.nlink,
      size: before.size,
      sha256: sha256Bytes(bytes),
      ancestors: ancestorIdentitiesBefore
    };
    if (expectedBinding && !sameAdjacentResourceBinding(expectedBinding, binding)) {
      throw new Error("Adjacent resource identity changed after Open.");
    }
    return {
      bytes,
      mediaType: mediaTypeFromPath(resourcePath),
      binding
    };
  } finally {
    closeSync(fd);
  }
}

function createSourceBinding(filePath, requestId, maxBytes) {
  const normalizedPath = normalizeLocalPath(filePath);
  assertExactPathSegments(path.dirname(normalizedPath), path.basename(normalizedPath));
  const fd = openSync(normalizedPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const before = fstatSync(fd);
    const pathBefore = statSync(normalizedPath);
    if (!before.isFile() || before.size <= 0 || before.size > maxBytes || !sameFileIdentity(before, pathBefore)) {
      throw new Error("Source is outside the bounded regular-file contract.");
    }
    const bytes = readBoundedDescriptorBuffer(fd, before.size, maxBytes);
    const after = fstatSync(fd);
    const pathAfter = statSync(normalizedPath);
    if (!sameFileIdentity(before, after) || !sameFileIdentity(before, pathAfter) || after.size !== before.size) {
      throw new Error("Source identity changed during Open.");
    }
    const sourceSha256 = sha256Bytes(bytes);
    const parent = directoryIdentity(path.dirname(normalizedPath));
    const adjacentVapc = bindAdjacentVapcForSource(normalizedPath);
    const identityHash = createHash("sha256")
      .update(JSON.stringify({
        filePath: normalizedPath,
        requestId,
        dev: before.dev,
        ino: before.ino,
        nlink: before.nlink,
        size: before.size,
        sha256: sourceSha256,
        parentDev: parent.dev,
        parentIno: parent.ino,
        parentRealPath: parent.realPath,
        adjacentVapcSha256: adjacentVapc?.sha256 ?? ""
      }))
      .digest("hex");
    return {
      sourceId: createHash("sha256").update(`${requestId}:${identityHash}`).digest("hex").slice(0, 24),
      requestId,
      filePath: normalizedPath,
      type: "file",
      dev: before.dev,
      ino: before.ino,
      nlink: before.nlink,
      size: before.size,
      sha256: sourceSha256,
      parent,
      adjacentVapc,
      adjacentResources: new Map()
    };
  } finally {
    closeSync(fd);
  }
}

function verifySourceBinding(binding, maxBytes) {
  const current = createSourceBinding(binding.filePath, binding.requestId, maxBytes);
  if (
    current.dev !== binding.dev
    || current.ino !== binding.ino
    || current.type !== binding.type
    || current.nlink !== binding.nlink
    || current.size !== binding.size
    || current.sha256 !== binding.sha256
    || current.parent.dev !== binding.parent.dev
    || current.parent.ino !== binding.parent.ino
    || current.parent.realPath !== binding.parent.realPath
    || !sameOptionalAdjacentBinding(current.adjacentVapc, binding.adjacentVapc)
  ) {
    throw new Error("Source identity changed after Open.");
  }
  return true;
}

function bindAdjacentVapcForSource(filePath) {
  if (path.extname(filePath).toLowerCase() !== ".mp4") return undefined;
  const sidecarPath = findAdjacentVapcJsonPath(filePath);
  if (!sidecarPath) return undefined;
  return readBoundedFileBinding(sidecarPath, MULTIFORMAT_MAX_RANGE_BYTES);
}

function readBoundedFileBinding(filePath, maxBytes) {
  const normalizedPath = normalizeLocalPath(filePath);
  assertExactPathSegments(path.dirname(normalizedPath), path.basename(normalizedPath));
  const ancestors = ancestorDirectoryIdentities(path.dirname(normalizedPath), normalizedPath);
  const fd = openSync(normalizedPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const before = fstatSync(fd);
    const pathBefore = statSync(normalizedPath);
    if (!before.isFile() || before.size <= 0 || before.size > maxBytes || !sameFileIdentity(before, pathBefore)) {
      throw new Error("Bound file is outside the regular-file contract.");
    }
    const bytes = readBoundedDescriptorBuffer(fd, before.size, maxBytes);
    const after = fstatSync(fd);
    const pathAfter = statSync(normalizedPath);
    if (!sameFileIdentity(before, after) || !sameFileIdentity(before, pathAfter) || after.size !== before.size) {
      throw new Error("Bound file identity changed during read.");
    }
    return {
      filePath: normalizedPath,
      dev: before.dev,
      ino: before.ino,
      nlink: before.nlink,
      size: before.size,
      sha256: sha256Bytes(bytes),
      ancestors
    };
  } finally {
    closeSync(fd);
  }
}

function readBoundedDescriptorBuffer(fd, expectedSize, maxBytes) {
  const limit = Math.max(0, Math.trunc(Number(maxBytes) || 0));
  const chunks = [];
  const scratch = Buffer.allocUnsafe(Math.min(64 * 1024, limit + 1));
  let totalBytes = 0;
  while (totalBytes <= limit) {
    const remaining = limit + 1 - totalBytes;
    const bytesRead = readSync(fd, scratch, 0, Math.min(scratch.byteLength, remaining), null);
    if (bytesRead === 0) break;
    chunks.push(Buffer.from(scratch.subarray(0, bytesRead)));
    totalBytes += bytesRead;
  }
  if (totalBytes <= 0 || totalBytes > limit || totalBytes !== expectedSize) {
    throw new Error("File changed outside the bounded read limit.");
  }
  return Buffer.concat(chunks, totalBytes);
}

function directoryIdentity(directoryPath) {
  const stat = statSync(directoryPath);
  if (!stat.isDirectory()) throw new Error("Expected a source directory.");
  return { filePath: directoryPath, realPath: realpathSync(directoryPath), dev: stat.dev, ino: stat.ino };
}

function ancestorDirectoryIdentities(sourceDirectory, resourcePath) {
  const relative = path.relative(sourceDirectory, resourcePath).split(path.sep).filter(Boolean);
  const identities = [directoryIdentity(sourceDirectory)];
  let cursor = sourceDirectory;
  for (let index = 0; index < relative.length - 1; index += 1) {
    cursor = path.join(cursor, relative[index]);
    identities.push(directoryIdentity(cursor));
  }
  return identities;
}

function sameIdentityList(left, right) {
  return left.length === right.length && left.every((item, index) =>
    item.dev === right[index].dev
    && item.ino === right[index].ino
    && item.filePath === right[index].filePath
    && item.realPath === right[index].realPath
  );
}

function sameAdjacentResourceBinding(left, right) {
  return left.filePath === right.filePath
    && left.relativePath === right.relativePath
    && left.dev === right.dev
    && left.ino === right.ino
    && left.nlink === right.nlink
    && left.size === right.size
    && left.sha256 === right.sha256
    && sameIdentityList(left.ancestors, right.ancestors);
}

function sameOptionalAdjacentBinding(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.filePath === right.filePath
    && left.dev === right.dev
    && left.ino === right.ino
    && left.nlink === right.nlink
    && left.size === right.size
    && left.sha256 === right.sha256
    && sameIdentityList(left.ancestors, right.ancestors);
}

function assertExactPathSegments(rootDirectory, leafName) {
  const entries = new Set(readdirSync(rootDirectory));
  if (!entries.has(leafName)) {
    throw new Error("Path segment must match the filesystem entry exactly.");
  }
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function decodeRuntimePngDataUri(value) {
  const match = /^data:image\/png;base64,([a-z0-9+/]+={0,2})$/iu.exec(String(value ?? "").trim());
  if (!match) throw new Error("Replacement image must be an inline PNG.");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.byteLength <= 0 || bytes.byteLength > MULTIFORMAT_MAX_REPLACEMENT_IMAGE_BYTES) {
    throw new Error("Replacement image is outside the bounded input contract.");
  }
  return new Uint8Array(bytes);
}

function rejectedSvgaReplacement(code, message) {
  return {
    accepted: false,
    message,
    playerAction: "keepCurrentPreview",
    diagnostic: { code, message }
  };
}

function readAdjacentVapcJsonForFile(filePath, maxBytes = MULTIFORMAT_MAX_RANGE_BYTES, expectedBinding) {
  if (path.extname(filePath).toLowerCase() !== ".mp4") return undefined;
  const sidecarPath = findAdjacentVapcJsonPath(filePath);
  if (!sidecarPath) return undefined;
  const binding = readBoundedFileBinding(sidecarPath, maxBytes);
  if (expectedBinding && !sameOptionalAdjacentBinding(binding, expectedBinding)) {
    throw new Error("Adjacent VAP config identity changed after Open.");
  }
  return {
    bytes: new Uint8Array(readBoundedFileBuffer(sidecarPath, maxBytes)),
    displayName: path.basename(sidecarPath)
  };
}

function findAdjacentVapcJsonPath(filePath) {
  const directory = path.dirname(filePath);
  const basename = path.basename(filePath, path.extname(filePath));
  const candidates = [
    path.join(directory, `${basename}.json`),
    path.join(directory, "vapc.json")
  ];
  return candidates.find((candidate) => {
    try {
      return existsSync(candidate) && statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
}

function runtimePreviewFailure(input) {
  return {
    status: "failed",
    format: input.format || undefined,
    pathRedacted: true,
    rendererHasFullPath: false,
    issue: {
      code: input.code || "playback_failure",
      severity: "error",
      message: input.message,
      path: "[local path]",
      details: {
        reason: input.reason,
        cause: input.cause ? "redacted runtime preview failure" : undefined
      }
    }
  };
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
    throw new Error("Only local SVGA, Lottie JSON, VAP/MP4, and After Effects AEP handoff candidates are accepted.");
  }
}

function isAepPath(value) {
  return path.extname(String(value)).toLowerCase() === ".aep";
}

function validateAepHandoffSource(filePath) {
  const stat = lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("After Effects AEB handoff requires a regular task-owned AEP copy.");
  }
}

function resolveAdjacentResource(sourceLocalPath, relativePath) {
  if (!relativePath || relativePath.includes("\0")) throw new Error("Adjacent resource path is invalid.");
  if (/^[a-z][a-z0-9+.-]*:/iu.test(relativePath) || path.isAbsolute(relativePath)) {
    throw new Error("Adjacent Lottie resources must use deterministic relative paths.");
  }
  const sourceDir = path.dirname(sourceLocalPath);
  const packageRootAlias = relativePath.startsWith("@lottie-root/i/");
  if (packageRootAlias && path.basename(sourceDir) !== "a") {
    throw new Error("Lottie package-root image aliases require the canonical a/i directory layout.");
  }
  const rootPath = packageRootAlias ? path.dirname(sourceDir) : sourceDir;
  const rootRelativePath = packageRootAlias ? relativePath.slice("@lottie-root/".length) : relativePath;
  const resolved = path.resolve(rootPath, rootRelativePath);
  if (resolved !== rootPath && !resolved.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error("Adjacent Lottie resource path escapes the source directory.");
  }
  const sourceRoot = realpathSync(rootPath);
  const relativeSegments = path.relative(rootPath, resolved).split(path.sep).filter(Boolean);
  let cursor = rootPath;
  for (const segment of relativeSegments) {
    assertExactPathSegments(cursor, segment);
    cursor = path.join(cursor, segment);
    if (lstatSync(cursor).isSymbolicLink()) {
      throw new Error("Adjacent Lottie resources cannot use symbolic-link aliases.");
    }
  }
  const resolvedRealPath = realpathSync(resolved);
  if (resolvedRealPath !== sourceRoot && !resolvedRealPath.startsWith(`${sourceRoot}${path.sep}`)) {
    throw new Error("Adjacent Lottie resource real path escapes the source directory.");
  }
  return { resourcePath: resolved, rootPath };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function isSafeRuntimeImageValue(value) {
  return typeof value === "string"
    && (/^data:image\/(?:png|jpeg|jpg|webp);base64,[a-z0-9+/=]+$/iu.test(value) || value.startsWith("blob:"));
}

function normalizeLottieRuntimeImageReference(rawDirectory, rawPath) {
  if (!isDeterministicRuntimeRelativePath(rawPath)) return "";
  const directory = rawDirectory.replace(/[\\/]+$/u, "");
  if (directory === "/i") return `@lottie-root/i/${rawPath}`;
  if (directory === "@lottie-root" || directory.startsWith("@lottie-root/")) return "";
  return directory ? `${directory}/${rawPath}` : rawPath;
}

function isDeterministicRuntimeRelativePath(value) {
  if (!value || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value) || /^[\\/]/u.test(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
    return false;
  }
  const parts = value.split(/[\\/]+/u);
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

function normalizeRuntimeRelativePath(value) {
  return value.split(/[\\/]+/u).filter(Boolean).join("/");
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

function createAepHandoffModel(input) {
  const displayName = safeDisplayName(input.displayName);
  const issue = {
    code: "aeb.aep_handoff_required",
    severity: "warning",
    message: "请在 After Effects 26.3 中使用 Auto SVGA AEB Dev 26.3 处理任务副本，再打开 finalized AEB package。",
    path: displayName,
    details: {
      reason: "aeb_ae26_handoff_required",
      requiredHost: "After Effects 26.3",
      requiredPanel: "Auto SVGA AEB Dev 26.3",
      acceptedPackageEntry: "ae-export-package.finalized.json",
      sourceMutationAllowed: false,
      ae25Allowed: false
    }
  };
  return {
    schemaVersion: 1,
    source: "owner-visible-aeb-project-handoff",
    productMode: "0.2-multiformat-preview-candidate",
    productVersion: "0.2.0-alpha.2",
    status: "handoffRequired",
    requestId: input.requestId,
    openedFrom: input.source,
    displayName,
    detectedFormat: "aep",
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
      status: "handoffRequired",
      format: "aep",
      playback: { status: "unavailable", currentTimeMs: 0, loop: false },
      emptyCopy: "After Effects 项目需要通过受控 AEB package handoff 进入 Preview。"
    },
    rightPanel: {
      facts: [{
        id: "aeb-handoff",
        label: "AEB Handoff",
        value: "AE 26.3 -> finalized package -> Auto SVGA",
        status: "warning"
      }],
      assetInventory: emptyAssetInventory("aep"),
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
    },
    aebHandoff: {
      schemaVersion: "auto-svga-aeb-client-handoff-v1",
      pathRedacted: true,
      sourceReadOnly: true,
      requiredHost: "After Effects 26.3",
      requiredPanel: "Auto SVGA AEB Dev 26.3",
      acceptedPackageEntry: "ae-export-package.finalized.json"
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
  if (extension === ".aep") return "aep";
  if (extension === ".json") return "lottie";
  if (extension === ".mp4") return "vap";
  if (extension === ".svga") return "svga";
  return undefined;
}

function isAcceptedMultiFormatOpenModel(model) {
  return model?.status === "previewReady"
    || model?.status === "playing"
    || model?.status === "paused";
}

function ownerOpenSource(source) {
  return source === "dragDrop"
    || source === "menuOpen"
    || source === "fileOpenEvent"
    || source === "fileButton"
    ? source
    : source === "recentFile"
      ? "menuOpen"
      : "fileButton";
}

module.exports = {
  MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID,
  MULTIFORMAT_OPEN_TERMINAL_DEADLINE_MS,
  createMultiFormatDesktopPreviewSession,
  isAcceptedMultiFormatOpenModel
};
