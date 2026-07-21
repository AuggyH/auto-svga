"use strict";

const { createHash, randomBytes } = require("node:crypto");
const {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const AEB_NATIVE_PREVIEW_PRODUCT_MILESTONE_ID = "0.3.0-alpha.1";
const AEB_NATIVE_SUBSET = "image_transform_v0";
const AEB_MAX_PACKAGE_JSON_BYTES = 2 * 1024 * 1024;
const AEB_MAX_PACKAGE_FILE_BYTES = 10 * 1024 * 1024;
const AEB_MAX_PACKAGE_BYTES = 25 * 1024 * 1024;
const AEB_MAX_PACKAGE_FILES = 128;
const AEB_MAX_GENERATED_SVGA_BYTES = 50 * 1024 * 1024;
const AEB_MAX_NATIVE_SPRITE_FRAMES = 100_000;

function createAebNativePreviewSession(options) {
  return new AebNativePreviewSession(options);
}

class AebNativePreviewSession {
  constructor(options) {
    this.repoRoot = path.resolve(options.repoRoot);
    this.sessionRoot = path.resolve(options.sessionRoot);
    this.previewSession = options.previewSession;
    this.fileReadHooks = options.fileReadHooks;
    this.packageTreeObserver = options.packageTreeObserver;
    this.previewFailureObserver = options.previewFailureObserver;
    this.intakeFailureObserver = options.intakeFailureObserver;
    this.exporterFactory = options.exporterFactory;
    this.modulesPromise = undefined;
    this.openGeneration = 0;
    this.openQueue = Promise.resolve();
    this.activeSaveOutput = undefined;
  }

  openPackagePath(inputPath, source = "fileButton") {
    const generation = ++this.openGeneration;
    this.invalidateSaveOutput();
    const operation = this.openQueue.then(() => this.openPackagePathForGeneration(inputPath, source, generation));
    this.openQueue = operation.catch(() => {});
    return operation;
  }

  async openPackagePathForGeneration(inputPath, source, generation) {
    let resolved;
    let snapshotBefore;
    let intakePhase = "resolve-package-input";
    try {
      resolved = resolvePackageInput(inputPath);
      intakePhase = "read-package-json";
      const packageBytes = readBoundedPackageJson(resolved.packagePath, this.fileReadHooks);
      const document = JSON.parse(packageBytes.toString("utf8"));
      intakePhase = "load-native-modules";
      const { normalizeFrameInterval, validateSvgaLayerFloatDomain } = await this.loadModules();
      intakePhase = "timing-preflight";
      const timingPreflight = prevalidateNativeTiming(document, normalizeFrameInterval, validateSvgaLayerFloatDomain);
      if (timingPreflight.errors.length > 0) {
        return failureResult({
          displayName: resolved.displayName,
          packageSha256: sha256(packageBytes),
          treeSha256: null,
          compatibility: emptyCompatibility(),
          issues: timingPreflight.errors
        });
      }
      intakePhase = "snapshot-package-tree";
      snapshotBefore = snapshotPackageTree(resolved.packageRoot, this.fileReadHooks);
      if (typeof this.packageTreeObserver === "function") {
        this.packageTreeObserver({
          phase: "aeb-native-preview-session-pre-conversion",
          packageRoot: resolved.packageRoot,
          source,
          generation,
          snapshot: snapshotBefore
        });
      }
      const packageRelativePath = path.relative(resolved.packageRoot, resolved.packagePath).split(path.sep).join("/");
      const snapshotPackage = snapshotBefore.entries.find((entry) => entry.relative === packageRelativePath);
      if (!snapshotPackage || snapshotPackage.sha256 !== sha256(packageBytes)) {
        throw codedError("aeb.package_json_snapshot_drift", "AEB package JSON 在预检与整包快照之间发生变化。");
      }
      intakePhase = "validate-package-authority";
      const validation = await validatePackage({
        document,
        packageBytes,
        packageRoot: resolved.packageRoot,
        fileReadHooks: this.fileReadHooks,
        timingPreflight
      });
      if (validation.errors.length > 0 || validation.compatibility.outputAllowed !== true) {
        return failureResult({
          displayName: resolved.displayName,
          packageSha256: sha256(packageBytes),
          treeSha256: snapshotBefore.sha256,
          compatibility: validation.compatibility,
          ownerModel: validation.ownerModel,
          issues: validation.errors.length > 0 ? validation.errors : validation.compatibility.outputIssues
        });
      }
      this.assertCurrentGeneration(generation);

      intakePhase = "materialize-and-encode";
      const output = await this.materializeAndEncode({
        packageBytes,
        packageRoot: resolved.packageRoot,
        packageDocument: validation.packageDocument,
        packageValue: validation.packageValue,
        project: validation.project,
        svgaMap: validation.svgaMap,
        assets: validation.assets,
        setIntakePhase(phase) {
          intakePhase = phase;
        }
      });
      if (!this.isCurrentGeneration(generation)) {
        rmSync(output.outputRoot, { recursive: true, force: true });
        return staleGenerationFailure(resolved, packageBytes, snapshotBefore, validation.compatibility, validation.ownerModel);
      }
      const snapshotAfter = snapshotPackageTree(resolved.packageRoot, this.fileReadHooks);
      if (snapshotAfter.sha256 !== snapshotBefore.sha256) {
        rmSync(output.outputRoot, { recursive: true, force: true });
        return failureResult({
          displayName: resolved.displayName,
          packageSha256: sha256(packageBytes),
          treeSha256: snapshotAfter.sha256,
          compatibility: validation.compatibility,
          ownerModel: validation.ownerModel,
          issues: [issue("aeb.package_mutated_during_conversion", "blocked", "AEB 包在转换期间发生变化，未进入 Preview。")]
        });
      }

      intakePhase = "validate-preview-path";
      const previewPathIdentity = inspectGeneratedSvgaPreviewPath(output.svgaPath, output.outputRoot);
      let previewResult;
      try {
        intakePhase = "open-shared-preview";
        previewResult = await this.previewSession.openLocalFilePath(output.svgaPath, "fileButton");
      } catch (error) {
        this.recordPreviewFailure({
          phase: "shared-preview-open-threw",
          pathIdentity: previewPathIdentity,
          errorName: normalizePreviewErrorName(error?.name),
          errorCode: normalizePreviewErrorCode(error?.code)
        });
        rmSync(output.outputRoot, { recursive: true, force: true });
        throw codedError("aeb.preview_reopen_failed", "生成的 SVGA 未能进入 Preview，任务输出已回滚。");
      }
      if (!this.isCurrentGeneration(generation)) {
        await this.rollbackPreviewOutput(output.outputRoot);
        return staleGenerationFailure(resolved, packageBytes, snapshotAfter, validation.compatibility, validation.ownerModel);
      }
      intakePhase = "validate-preview-acceptance";
      const previewAcceptance = await this.validatePreviewAcceptance(previewResult, output);
      if (!previewAcceptance.accepted) {
        this.recordPreviewFailure({
          phase: "shared-preview-open-returned-failed-model",
          pathIdentity: previewPathIdentity,
          previewStatus: normalizePreviewStatus(previewResult?.model?.status),
          previewIssueCode: normalizePreviewIssueCode(previewResult?.model?.rightPanel?.issues?.[0]?.code)
        });
        await this.rollbackPreviewOutput(output.outputRoot);
        return failureResult({
          displayName: resolved.displayName,
          packageSha256: sha256(packageBytes),
          treeSha256: snapshotAfter.sha256,
          compatibility: validation.compatibility,
          ownerModel: validation.ownerModel,
          issues: [issue(previewAcceptance.code, "blocked", previewAcceptance.message)]
        });
      }
      if (!this.isCurrentGeneration(generation)) {
        await this.rollbackPreviewOutput(output.outputRoot);
        return staleGenerationFailure(resolved, packageBytes, snapshotAfter, validation.compatibility, validation.ownerModel);
      }
      intakePhase = "publish-preview-authority";
      const model = augmentPreviewModel(previewResult.model, {
        displayName: `${resolved.displayName} · Native SVGA`,
        compatibility: validation.compatibility,
        packageId: validation.packageValue.packageIdentity.packageId,
        project: validation.project,
        ownerModel: validation.ownerModel,
        output
      });
      const packageSha256 = sha256(packageBytes);
      const aebOutput = this.createSaveOutput({
        generation,
        packageSha256,
        output
      });
      return {
        ...previewResult,
        status: "opened",
        model,
        pathRedacted: true,
        aeb: {
          schemaVersion: "auto-svga-aeb-native-preview-v1",
          productMilestoneId: AEB_NATIVE_PREVIEW_PRODUCT_MILESTONE_ID,
          source,
          package: {
            fileName: path.basename(resolved.packagePath),
            packageId: validation.packageValue.packageIdentity.packageId,
            sha256: packageSha256,
            treeSha256Before: snapshotBefore.sha256,
            treeSha256After: snapshotAfter.sha256,
            sourceImmutable: snapshotBefore.sha256 === snapshotAfter.sha256,
            pathRedacted: true
          },
          compatibility: validation.compatibility,
          ownerModel: validation.ownerModel,
          project: {
            projectId: validation.project.projectId,
            sha256: output.projectSha256,
            mapSha256: output.mapSha256,
            assetSetSha256: output.assetSetSha256
          },
          generatedSvga: {
            fileName: path.basename(output.svgaPath),
            sha256: output.svgaSha256,
            sizeBytes: output.svgaBytes.byteLength,
            validation: output.exportValidation
          },
          preview: {
            reopened: model?.status !== "failed",
            playbackLoadPrepared: model?.status !== "failed",
            directPixelsRequired: true
          },
          boundaries: aebBoundaries()
        },
        aebOutput
      };
    } catch (error) {
      this.recordIntakeFailure({
        phase: normalizeIntakePhase(intakePhase),
        errorName: normalizePreviewErrorName(error?.name),
        errorCode: normalizeIntakeErrorCode(error?.code)
      });
      return failureResult({
        displayName: resolved?.displayName ?? "AEB 导出包",
        packageSha256: null,
        treeSha256: snapshotBefore?.sha256 ?? null,
        compatibility: emptyCompatibility(),
        issues: [issue(
          typeof error?.code === "string" && error.code.startsWith("aeb.")
            ? error.code
            : "aeb.package_intake_failed",
          "blocked",
          safeIssueMessage(error)
        )]
      });
    }
  }

  async prepareRuntimePreview(input) {
    return this.previewSession.prepareRuntimePreview({ ...input, format: "svga" });
  }

  async control(input) {
    if (input?.action === "dispose") {
      this.openGeneration += 1;
      this.invalidateSaveOutput();
    }
    return this.previewSession.control(input);
  }

  resolveSaveOutput(input) {
    const allowedKeys = ["command", "generatedSvgaSha256", "packageSha256", "saveToken"];
    if (
      !isRecord(input)
      || Object.keys(input).sort().join("\n") !== allowedKeys.sort().join("\n")
      || input.command !== "saveAs"
      || !/^[a-f0-9]{48}$/u.test(input.saveToken || "")
      || !isSha256(input.packageSha256)
      || !isSha256(input.generatedSvgaSha256)
    ) throw codedError("aeb.save_authority_invalid", "AEB Save As 请求未绑定当前主机输出。 ");
    const active = this.activeSaveOutput;
    if (
      !active
      || active.generation !== this.openGeneration
      || active.saveToken !== input.saveToken
      || active.packageSha256 !== input.packageSha256
      || active.generatedSvgaSha256 !== input.generatedSvgaSha256
    ) throw codedError("aeb.save_authority_invalid", "AEB Save As 请求未绑定当前主机输出。 ");
    return {
      bytes: Buffer.from(active.bytes),
      sha256: active.generatedSvgaSha256,
      suggestedName: active.suggestedName,
      packageSha256: active.packageSha256,
      generation: active.generation
    };
  }

  readActiveGeneratedIdentity() {
    const active = this.activeSaveOutput;
    if (!active || active.generation !== this.openGeneration) {
      throw codedError("aeb.generated_identity_unavailable", "当前 AEB 生成身份不可用。");
    }
    const projectBytes = readBoundedRegularFile(path.join(active.outputRoot, "project.json"), {
      maxBytes: AEB_MAX_PACKAGE_JSON_BYTES,
      purpose: "generated-project",
      codePrefix: "aeb.generated_project"
    });
    const mapBytes = readBoundedRegularFile(path.join(active.outputRoot, "svga-map.json"), {
      maxBytes: AEB_MAX_PACKAGE_JSON_BYTES,
      purpose: "generated-map",
      codePrefix: "aeb.generated_map"
    });
    const assetSetBytes = readBoundedRegularFile(path.join(active.outputRoot, "asset-set.json"), {
      maxBytes: AEB_MAX_PACKAGE_JSON_BYTES,
      purpose: "generated-asset-set",
      codePrefix: "aeb.generated_asset_set"
    });
    let project;
    let map;
    let assetSet;
    try {
      project = JSON.parse(projectBytes.toString("utf8"));
      map = JSON.parse(mapBytes.toString("utf8"));
      assetSet = JSON.parse(assetSetBytes.toString("utf8"));
    } catch {
      throw codedError("aeb.generated_identity_invalid", "AEB 生成身份文件无法解析。");
    }
    if (
      project?.projectId !== active.projectId
      || map?.projectId !== active.projectId
      || !Array.isArray(assetSet)
      || sha256(projectBytes) !== active.projectSha256
      || sha256(mapBytes) !== active.mapSha256
      || sha256(assetSetBytes) !== active.assetSetSha256
    ) {
      throw codedError("aeb.generated_identity_mismatch", "AEB 生成身份与当前主机输出不一致。");
    }
    return {
      summary: {
        projectId: active.projectId,
        projectSha256: active.projectSha256,
        mapSha256: active.mapSha256,
        assetSetSha256: active.assetSetSha256
      },
      files: {
        projectBytes,
        mapBytes,
        assetSetBytes
      }
    };
  }

  async validatePreviewAcceptance(previewResult, output) {
    if (
      !isRecord(previewResult)
      || !isRecord(previewResult.model)
      || !isAcceptedPreviewStatus(previewResult.model.status)
      || previewResult.model.detectedFormat !== "svga"
      || !/^[a-f0-9]{24}$/u.test(previewResult.sourceId || "")
    ) {
      return {
        accepted: false,
        code: "aeb.preview_initial_state_rejected",
        message: "生成的 SVGA 未达到可进入 Preview 的精确初始状态。"
      };
    }
    let prepared;
    try {
      prepared = await this.previewSession.prepareRuntimePreview({
        sourceId: previewResult.sourceId,
        format: "svga",
        requestId: previewResult.model.requestId
      });
    } catch {
      prepared = undefined;
    }
    if (prepared?.status !== "prepared" || prepared?.format !== "svga" || typeof prepared?.svgaBase64 !== "string") {
      return {
        accepted: false,
        code: "aeb.preview_runtime_prepare_failed",
        message: "生成的 SVGA 未建立可挂载的 Preview runtime contract。"
      };
    }
    const preparedBytes = Buffer.from(prepared.svgaBase64, "base64");
    if (preparedBytes.byteLength !== output.svgaBytes.byteLength || sha256(preparedBytes) !== output.svgaSha256) {
      return {
        accepted: false,
        code: "aeb.preview_runtime_bytes_mismatch",
        message: "Preview runtime bytes 与主机生成的 SVGA 不一致。"
      };
    }
    return { accepted: true };
  }

  async rollbackPreviewOutput(outputRoot) {
    rmSync(outputRoot, { recursive: true, force: true });
    try {
      await this.previewSession.control({ action: "dispose" });
    } catch {}
  }

  recordPreviewFailure(value) {
    if (typeof this.previewFailureObserver !== "function") return;
    try {
      this.previewFailureObserver({
        schema: "auto-svga-aeb-preview-reopen-diagnostic-v1",
        ...value,
        pathRedacted: true
      });
    } catch {}
  }

  recordIntakeFailure(value) {
    if (typeof this.intakeFailureObserver !== "function") return;
    try {
      this.intakeFailureObserver({
        schema: "auto-svga-aeb-package-intake-diagnostic-v1",
        ...value,
        pathRedacted: true
      });
    } catch {}
  }

  createSaveOutput({ generation, packageSha256, output }) {
    const saveToken = randomBytes(24).toString("hex");
    this.activeSaveOutput = {
      generation,
      saveToken,
      packageSha256,
      generatedSvgaSha256: output.svgaSha256,
      suggestedName: path.basename(output.svgaPath),
      bytes: Buffer.from(output.svgaBytes),
      outputRoot: output.outputRoot,
      projectId: output.projectId,
      projectSha256: output.projectSha256,
      mapSha256: output.mapSha256,
      assetSetSha256: output.assetSetSha256
    };
    return {
      saveToken,
      packageSha256,
      generatedSvgaSha256: output.svgaSha256,
      sizeBytes: output.svgaBytes.byteLength,
      suggestedName: path.basename(output.svgaPath),
      saveAsAllowed: true,
      overwriteAllowed: false
    };
  }

  invalidateSaveOutput() {
    this.activeSaveOutput = undefined;
  }

  assertCurrentGeneration(generation) {
    if (!this.isCurrentGeneration(generation)) throw codedError("aeb.open_generation_stale", "AEB 打开请求已被更新请求替代。");
  }

  isCurrentGeneration(generation) {
    return generation === this.openGeneration;
  }

  async materializeAndEncode({ packageBytes, packageRoot, packageDocument, packageValue, project, svgaMap, assets, setIntakePhase }) {
    const orderedAssets = [...assets].sort((first, second) => compareIdentifiers(first.assetId, second.assetId));
    const binding = createHash("sha256")
      .update(packageBytes)
      .update(stableStringify(orderedAssets.map((asset) => ({ id: asset.assetId, sha256: asset.sha256 }))))
      .digest("hex");
    const aebRoot = path.join(this.sessionRoot, "aeb-native-preview");
    const outputRoot = path.join(aebRoot, binding.slice(0, 24));
    assertInside(outputRoot, this.sessionRoot, "aeb.output_outside_session");
    setIntakePhase("materialize-prepare-output");
    rmSync(outputRoot, { recursive: true, force: true });
    try {
      mkdirSync(path.join(outputRoot, "assets"), { recursive: true });

      setIntakePhase("materialize-write-assets");
      for (const asset of orderedAssets) {
        const target = path.join(outputRoot, asset.packagePath);
        assertInside(target, outputRoot, "aeb.asset_output_escape");
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, asset.bytes);
      }
      const projectBytes = Buffer.from(`${JSON.stringify(project, null, 2)}\n`);
      const mapBytes = Buffer.from(`${JSON.stringify(svgaMap, null, 2)}\n`);
      const assetSetBytes = Buffer.from(stableStringify(orderedAssets.map((asset) => ({ id: asset.assetId, sha256: asset.sha256 }))));
      setIntakePhase("materialize-write-authority-records");
      writeFileSync(path.join(outputRoot, "project.json"), projectBytes);
      writeFileSync(path.join(outputRoot, "svga-map.json"), mapBytes);
      writeFileSync(path.join(outputRoot, "asset-set.json"), assetSetBytes);

      const exporterOptions = {
        onStage(stage) {
          setIntakePhase(`materialize-export-${stage}`);
        }
      };
      const exporter = this.exporterFactory
        ? this.exporterFactory(exporterOptions)
        : new (await this.loadModules()).SvgaExporter(path.join(this.repoRoot, "proto/svga.proto"), exporterOptions);
      setIntakePhase("materialize-export-svga");
      const exportResult = await exporter.export(project, outputRoot);
      if (typeof exportResult.outputPath !== "string" || exportResult.outputPath.length === 0) {
        throw codedError("aeb.generated_svga_output_path_invalid", "生成的 SVGA 缺少受控输出路径。");
      }
      const generatedSvgaPath = path.resolve(exportResult.outputPath);
      assertInside(generatedSvgaPath, outputRoot, "aeb.generated_svga_output_escape");
      setIntakePhase("materialize-read-generated-svga");
      const svgaBytes = readBoundedRegularFile(generatedSvgaPath, {
        maxBytes: AEB_MAX_GENERATED_SVGA_BYTES,
        purpose: "generated-svga",
        codePrefix: "aeb.generated_svga",
        fileReadHooks: this.fileReadHooks
      });
      if (svgaBytes.byteLength === 0) {
        throw codedError("aeb.generated_svga_empty", "生成的 SVGA 不能为空。");
      }
      setIntakePhase("materialize-validate-generated-svga");
      const independentValidation = await (await this.loadModules()).validateSvgaBytes(
        svgaBytes,
        path.join(this.repoRoot, "proto/svga.proto"),
        {
          project,
          svgaMap,
          resources: assets.map((asset) => ({
            assetId: asset.assetId,
            packagePath: asset.packagePath,
            width: asset.width,
            height: asset.height,
            sha256: asset.sha256,
            bytes: asset.bytes
          }))
        }
      );
      const structureInvalid = independentValidation.structureContractVersion !== "svga_generated_native_frame_v2"
        || independentValidation.authorityContractVersion !== "aeb_generated_native_output_authority_v1"
        || independentValidation.generatedNativeStructureValid !== true
        || independentValidation.generatedNativeVocabularyValid !== true
        || independentValidation.allSpriteFrameCountsMatch !== true
        || independentValidation.requiredFrameFieldsPresent !== true
        || !Array.isArray(independentValidation.spriteFrameCounts)
        || independentValidation.spriteFrameCounts.length !== project.layers.length
        || independentValidation.spriteFrameCounts.some((count) => count !== project.durationFrames)
        || independentValidation.totalFrameRecords !== project.layers.length * project.durationFrames;
      if (structureInvalid) {
        throw codedError("aeb.native_svga_structure_validation_failed", "生成的原生子集 SVGA 未通过独立 FrameEntity 结构与时间线校验。");
      }
      if (
        independentValidation.exists !== true
        || independentValidation.inflated !== true
        || independentValidation.decoded !== true
        || independentValidation.floatContractVersion !== "svga_float32_v1"
        || independentValidation.canonicalFloatValues !== true
      ) {
        throw codedError("aeb.native_svga_float_validation_failed", "生成的原生子集 SVGA 未通过独立 float32/inflate/decode/count 校验。");
      }
      if (
        independentValidation.imageCount !== assets.length
        || independentValidation.spriteCount !== project.layers.length
        || independentValidation.frameCount !== project.durationFrames
        || independentValidation.generatedNativeAuthorityValid !== true
        || independentValidation.canonicalWireEncoding !== true
      ) {
        throw codedError("aeb.native_svga_authority_validation_failed", "生成的原生子集 SVGA 未通过项目派生 authority 校验。");
      }
      return {
        outputRoot,
        svgaPath: generatedSvgaPath,
        svgaBytes,
        svgaSha256: sha256(svgaBytes),
        projectId: project.projectId,
        projectSha256: sha256(projectBytes),
        mapSha256: sha256(mapBytes),
        assetSetSha256: sha256(assetSetBytes),
        exportValidation: independentValidation,
        packageDocumentSchema: packageDocument.schemaVersion,
        packageId: packageValue.packageIdentity.packageId
      };
    } catch (error) {
      rmSync(outputRoot, { recursive: true, force: true });
      throw error;
    }
  }

  async loadModules() {
    if (!this.modulesPromise) {
      this.modulesPromise = Promise.all([
        import(pathToFileURL(path.join(this.repoRoot, "dist/exporters/svga-exporter.js")).href),
        import(pathToFileURL(path.join(this.repoRoot, "dist/core/frame-interval.js")).href),
        import(pathToFileURL(path.join(this.repoRoot, "dist/core/svga-float-serialization.js")).href)
      ]).then(([exporter, frameInterval, floatSerialization]) => ({
        SvgaExporter: exporter.SvgaExporter,
        normalizeFrameInterval: frameInterval.normalizeFrameInterval,
        validateSvgaBytes: exporter.validateSvgaBytes,
        validateSvgaLayerFloatDomain: floatSerialization.validateSvgaLayerFloatDomain
      }));
    }
    return this.modulesPromise;
  }
}

const previewErrorNames = new Set(["Error", "RangeError", "TypeError"]);
const previewErrorCodes = new Set([
  "EACCES",
  "EINVAL",
  "EIO",
  "ENOENT",
  "ENOTDIR",
  "EPERM",
  "ERR_INVALID_ARG_TYPE",
  "ERR_INVALID_PACKAGE_CONFIG",
  "ERR_INVALID_URL_SCHEME",
  "ERR_MODULE_NOT_FOUND",
  "MODULE_NOT_FOUND"
]);
const intakeErrorCodes = new Set([
  ...previewErrorCodes,
  "aeb.generated_svga_alias",
  "aeb.generated_svga_changed_after_stat",
  "aeb.generated_svga_close_failed",
  "aeb.generated_svga_empty",
  "aeb.generated_svga_identity_changed",
  "aeb.generated_svga_output_escape",
  "aeb.generated_svga_output_path_invalid",
  "aeb.generated_svga_read_failed",
  "aeb.native_svga_authority_validation_failed",
  "aeb.native_svga_float_validation_failed",
  "aeb.native_svga_structure_validation_failed",
  "aeb.svga_export_build_payload_failed",
  "aeb.svga_export_encode_failed",
  "aeb.svga_export_load_images_failed",
  "aeb.svga_export_load_proto_failed",
  "aeb.svga_export_read_map_failed",
  "aeb.svga_export_validate_float_failed",
  "aeb.svga_export_validate_inputs_failed",
  "aeb.svga_export_validate_memory_failed",
  "aeb.svga_export_verify_message_failed",
  "aeb.svga_export_write_readback_failed"
]);
const previewIssueCodes = new Set([
  "ambiguous",
  "missing_dependency",
  "missing_resource",
  "parse_precondition",
  "playback_failure",
  "svga_parse_failed",
  "svga_probe_failed",
  "unsupported_feature"
]);
const previewStatuses = new Set(["failed", "playbackBlocked", "playbackFailed"]);
const intakePhases = new Set([
  "load-native-modules",
  "materialize-and-encode",
  "materialize-export-svga",
  "materialize-export-build-payload",
  "materialize-export-encode",
  "materialize-export-load-images",
  "materialize-export-load-proto",
  "materialize-export-read-map",
  "materialize-export-validate-float",
  "materialize-export-validate-inputs",
  "materialize-export-validate-memory",
  "materialize-export-verify-message",
  "materialize-export-write-readback",
  "materialize-prepare-output",
  "materialize-read-generated-svga",
  "materialize-validate-generated-svga",
  "materialize-write-assets",
  "materialize-write-authority-records",
  "open-shared-preview",
  "publish-preview-authority",
  "read-package-json",
  "resolve-package-input",
  "snapshot-package-tree",
  "timing-preflight",
  "validate-package-authority",
  "validate-preview-acceptance",
  "validate-preview-path"
]);

function inspectGeneratedSvgaPreviewPath(filePath, outputRoot) {
  try {
    if (typeof filePath !== "string" || path.extname(filePath).toLowerCase() !== ".svga") {
      throw codedError("aeb.generated_svga_preview_path_invalid", "生成的 Preview 文件必须使用 .svga 扩展名。");
    }
    const resolvedPath = path.resolve(filePath);
    assertInside(resolvedPath, outputRoot, "aeb.generated_svga_preview_path_invalid");
    const stat = lstatSync(resolvedPath);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1 || realpathSync(resolvedPath) !== resolvedPath) {
      throw codedError("aeb.generated_svga_preview_path_invalid", "生成的 Preview 文件身份无效。");
    }
    return {
      basename: path.basename(resolvedPath),
      extension: ".svga",
      exists: true,
      regularFile: true,
      linkCount: 1,
      sizeBytes: stat.size
    };
  } catch (error) {
    if (error?.code === "aeb.generated_svga_preview_path_invalid") throw error;
    throw codedError("aeb.generated_svga_preview_path_invalid", "生成的 Preview 文件在打开前不可用。");
  }
}

function normalizePreviewErrorName(value) {
  return previewErrorNames.has(value) ? value : "UnclassifiedError";
}

function normalizePreviewErrorCode(value) {
  return previewErrorCodes.has(value) ? value : "unclassified";
}

function normalizeIntakeErrorCode(value) {
  return intakeErrorCodes.has(value) ? value : "unclassified";
}

function normalizePreviewIssueCode(value) {
  return previewIssueCodes.has(value) ? value : "unclassified";
}

function normalizePreviewStatus(value) {
  return previewStatuses.has(value) ? value : "failed";
}

function normalizeIntakePhase(value) {
  return intakePhases.has(value) ? value : "unclassified";
}

function resolvePackageInput(inputPath) {
  if (typeof inputPath !== "string" || inputPath.length === 0 || inputPath.includes("\0")) {
    throw codedError("aeb.package_path_invalid", "请选择本地 AEB 导出包文件或文件夹。");
  }
  const resolvedInput = path.resolve(inputPath);
  const inputStat = lstatSync(resolvedInput);
  if (inputStat.isSymbolicLink()) throw codedError("aeb.package_symlink", "AEB 包路径不能是符号链接。");
  let packageRoot;
  let packagePath;
  if (inputStat.isDirectory()) {
    packageRoot = resolvedInput;
    const finalized = path.join(packageRoot, "ae-export-package.finalized.json");
    const candidate = path.join(packageRoot, "ae-export-package.json");
    packagePath = existsSync(finalized) ? finalized : candidate;
  } else if (inputStat.isFile()) {
    packagePath = resolvedInput;
    packageRoot = path.dirname(resolvedInput);
  } else {
    throw codedError("aeb.package_input_type", "AEB 包入口必须是文件或文件夹。");
  }
  if (!/^(?:ae-export-package|ae-export-package\.finalized)\.json$/u.test(path.basename(packagePath))) {
    throw codedError("aeb.package_file_name", "AEB 包入口必须是 ae-export-package.json 或 ae-export-package.finalized.json。");
  }
  if (!existsSync(packagePath) || !lstatSync(packagePath).isFile()) {
    throw codedError("aeb.package_file_missing", "AEB 包缺少可读取的 package JSON。");
  }
  if (realpathSync(packageRoot) !== packageRoot) {
    throw codedError("aeb.package_alias_root", "AEB 包目录不能通过别名或符号链接访问。");
  }
  return { packageRoot, packagePath, displayName: path.basename(packageRoot) };
}

function snapshotPackageTree(packageRoot, fileReadHooks) {
  const entries = [];
  let totalBytes = 0;
  const visit = (directory, relativeRoot = "") => {
    for (const name of readdirSync(directory).sort()) {
      const absolute = path.join(directory, name);
      const relative = path.posix.join(relativeRoot, name);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) throw codedError("aeb.package_tree_symlink", "AEB 包内不能包含符号链接。");
      if (stat.isDirectory()) {
        visit(absolute, relative);
        continue;
      }
      if (!stat.isFile()) throw codedError("aeb.package_tree_entry_type", "AEB 包内包含不支持的文件类型。");
      if (stat.size <= 0 || stat.size > AEB_MAX_PACKAGE_FILE_BYTES) {
        throw codedError("aeb.package_file_bound", "AEB 包文件超出允许的大小范围。");
      }
      const bytes = readBoundedRegularFile(absolute, {
        maxBytes: AEB_MAX_PACKAGE_FILE_BYTES,
        purpose: "snapshot",
        codePrefix: "aeb.package_file",
        fileReadHooks
      });
      totalBytes += bytes.byteLength;
      entries.push({ relative, sizeBytes: bytes.byteLength, sha256: sha256(bytes) });
      if (entries.length > AEB_MAX_PACKAGE_FILES || totalBytes > AEB_MAX_PACKAGE_BYTES) {
        throw codedError("aeb.package_tree_bound", "AEB 包超出文件数量或总大小限制。");
      }
    }
  };
  visit(packageRoot);
  return { entries, fileCount: entries.length, totalBytes, sha256: sha256(Buffer.from(stableStringify(entries))) };
}

function readBoundedPackageJson(packagePath, fileReadHooks) {
  return readBoundedRegularFile(packagePath, {
    maxBytes: AEB_MAX_PACKAGE_JSON_BYTES,
    purpose: "package-json",
    codePrefix: "aeb.package_json",
    fileReadHooks
  });
}

function readBoundedRegularFile(filePath, options) {
  const resolvedPath = path.resolve(filePath);
  let descriptor;
  let primaryError;
  try {
    const preStat = lstatSync(resolvedPath);
    assertBoundedRegularStat(preStat, options.maxBytes, `${options.codePrefix}_bound`);
    if (realpathSync(resolvedPath) !== resolvedPath) {
      throw codedError(`${options.codePrefix}_alias`, "AEB 文件不能通过别名或符号链接访问。");
    }
    descriptor = openSync(resolvedPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const openedStat = fstatSync(descriptor);
    assertBoundedRegularStat(openedStat, options.maxBytes, `${options.codePrefix}_bound`);
    if (!sameFileIdentity(preStat, openedStat) || preStat.size !== openedStat.size) {
      throw codedError(`${options.codePrefix}_identity_changed`, "AEB 文件在打开前发生变化。");
    }
    const readCapacity = Math.min(openedStat.size + 1, options.maxBytes + 1);
    options.fileReadHooks?.afterOpen?.({
      filePath: resolvedPath,
      purpose: options.purpose,
      maxBytes: options.maxBytes,
      openedSize: openedStat.size,
      readCapacity
    });

    const buffer = Buffer.allocUnsafe(readCapacity);
    let bytesRead = 0;
    while (bytesRead < buffer.byteLength) {
      const count = readSync(descriptor, buffer, bytesRead, buffer.byteLength - bytesRead, bytesRead);
      if (count === 0) break;
      bytesRead += count;
    }
    const postStat = fstatSync(descriptor);
    let pathStat;
    try {
      pathStat = lstatSync(resolvedPath);
    } catch {
      throw codedError(`${options.codePrefix}_identity_changed`, "AEB 文件路径在读取期间发生变化。");
    }
    if (
      pathStat.isSymbolicLink()
      || !sameFileIdentity(postStat, pathStat)
      || realpathSync(resolvedPath) !== resolvedPath
    ) {
      throw codedError(`${options.codePrefix}_identity_changed`, "AEB 文件路径在读取期间发生变化。");
    }
    if (
      bytesRead > options.maxBytes
      || postStat.size !== openedStat.size
      || bytesRead !== postStat.size
      || postStat.mtimeMs !== openedStat.mtimeMs
      || postStat.ctimeMs !== openedStat.ctimeMs
    ) {
      throw codedError(`${options.codePrefix}_changed_after_stat`, "AEB 文件在读取期间改变或超出大小限制。");
    }
    return Buffer.from(buffer.subarray(0, bytesRead));
  } catch (error) {
    primaryError = normalizeBoundedReadError(error, `${options.codePrefix}_read_failed`);
    throw primaryError;
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        if (!primaryError) {
          throw codedError(`${options.codePrefix}_close_failed`, "AEB 文件读取句柄无法安全关闭。");
        }
      }
    }
  }
}

function normalizeBoundedReadError(error, fallbackCode) {
  return typeof error?.code === "string" && error.code.startsWith("aeb.")
    ? error
    : codedError(fallbackCode, "AEB 文件读取失败。");
}

function assertBoundedRegularStat(stat, maxBytes, code) {
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1 || stat.size <= 0 || stat.size > maxBytes) {
    throw codedError(code, "AEB 文件不可读或超出大小限制。");
  }
}

function sameFileIdentity(first, second) {
  return first.dev === second.dev && first.ino === second.ino;
}

function prevalidateNativeTiming(document, normalizeFrameInterval, validateSvgaLayerFloatDomain) {
  const errors = [];
  const packageValue = document?.schemaVersion === "aeb-wp2-script-output-v0"
    ? document.aeExportPackage
    : document;
  const pkg = isRecord(packageValue) ? packageValue : {};
  const composition = validateComposition(pkg.s3Report?.composition, errors);
  const authority = normalizeCompatibilityAuthority(pkg, errors);
  const nativeLayerIdentities = normalizeSemanticNativeLayerIdentities(pkg.semanticGraph?.layers, errors);
  const timingByLayerId = validateNativeTimingAuthority(
    nativeLayerIdentities,
    authority.hostById,
    composition,
    normalizeFrameInterval,
    errors
  );
  if (
    Number.isInteger(composition?.durationFrames)
    && nativeLayerIdentities.length * composition.durationFrames > AEB_MAX_NATIVE_SPRITE_FRAMES
  ) {
    errors.push(issue("aeb.native_expansion_bound", "blocked", "AEB native-subset 的图层帧展开规模超出受控上限。"));
  } else if (Number.isInteger(composition?.durationFrames)) {
    for (const { value, layerId } of nativeLayerIdentities) {
      const timing = timingByLayerId.get(layerId);
      if (!timing) continue;
      if (!validTransform(value?.transform) || !validAnchor(value?.anchor)) {
        errors.push(issue(
          "aeb.layer_contract_invalid",
          "blocked",
          "AEB 图片图层缺少可序列化的 transform/anchor。"
        ));
        continue;
      }
      const floatDomain = validateSvgaLayerFloatDomain({
        transform: value.transform,
        anchor: value.anchor,
        keyframes: timing.keyframes,
        width: 1,
        height: 1,
        fallbackOpacityMultiplier: 1,
        visible: value.visible,
        visibleFrameRange: timing.activeFrameRange
      }, composition.durationFrames);
      if (!floatDomain.ok) {
        errors.push(issue(
          "aeb.svga_float_serialization_invalid",
          "blocked",
          `AEB native layer ${layerId} 超出版本化 SVGA float32 序列化域。`
        ));
      }
    }
  }
  return { errors, composition, authority, nativeLayerIdentities, timingByLayerId };
}

async function validatePackage({ document, packageRoot, fileReadHooks, timingPreflight }) {
  const errors = [];
  const packageValue = document?.schemaVersion === "aeb-wp2-script-output-v0"
    ? document.aeExportPackage
    : document;
  if (!isRecord(packageValue)) errors.push(issue("aeb.package_shape", "blocked", "AEB 包缺少 aeExportPackage 根对象。"));
  const pkg = isRecord(packageValue) ? packageValue : {};
  const requiredGroups = ["packageIdentity", "redaction", "commonSource", "semanticGraph", "renderPlan", "replaceableSlots", "outputProfiles", "s3Report", "reports", "hashBinding"];
  for (const group of requiredGroups) {
    if (!(group in pkg)) errors.push(issue("aeb.package_group_missing", "blocked", `AEB 包缺少 ${group}。`));
  }
  if (!exactSafeIdentifier(pkg.packageIdentity?.packageId)) {
    errors.push(issue("aeb.package_identity_invalid", "blocked", "AEB 包缺少可原样绑定的安全 packageId。"));
  }
  if (pkg.packageIdentity?.createdBy !== "wp2_thin_script_prototype") {
    errors.push(issue("aeb.package_creator_invalid", "blocked", "AEB 包必须来自已绑定的 WP2 thin-script package contract。"));
  }
  if (
    pkg.redaction?.mode !== "selector_only"
    || pkg.redaction?.absolutePathsAllowed !== false
    || pkg.redaction?.memberNamesAllowed !== false
    || pkg.redaction?.rawProductionMediaAllowed !== false
    || pkg.redaction?.externalVolumePathsAllowed !== false
  ) errors.push(issue("aeb.redaction_policy", "blocked", "AEB 包未满足 selector-only 脱敏策略。"));
  for (const finding of findRawPaths(pkg)) errors.push(issue("aeb.raw_path", "blocked", `AEB 包包含未脱敏的本地路径字段 ${finding.pointer}。`));
  validateForbiddenActions(pkg, errors);
  validateForbiddenActionRecord(pkg.s3Report?.sourceSafety?.forbiddenActions, errors, "s3Report.sourceSafety");
  validateProfiles(pkg, errors);
  if (pkg.renderPlan !== null) errors.push(issue("aeb.render_plan_forbidden", "blocked", "当前 native-subset 入口不接受 render/bake 计划。"));
  if (!Array.isArray(pkg.replaceableSlots) || pkg.replaceableSlots.length !== 0) {
    errors.push(issue("aeb.replaceable_slots_unsupported", "blocked", "当前 native-subset 入口不接受 replaceableSlots 声明。"));
  }
  if (pkg.s3Report?.scanStatus !== "completed_metadata_only" || pkg.s3Report?.renderQueue?.status !== "not_executed") {
    errors.push(issue("aeb.metadata_only_required", "blocked", "AEB 包必须来自未执行 Render Queue 的 metadata-only 扫描。"));
  }

  const graph = pkg.semanticGraph;
  if (
    graph?.schemaVersion !== "aeb-semantic-graph-v0"
    || graph?.targetFormat !== "svga"
    || graph?.nativeSubset !== AEB_NATIVE_SUBSET
  ) errors.push(issue("aeb.semantic_graph_schema", "blocked", "当前入口只接受 SVGA image_transform_v0 semanticGraph。"));
  for (const field of ["sampledTransforms", "assetFilesExported", "unsupportedFeaturesClassified", "sourceProjectUnchanged"]) {
    if (graph?.sourceProof?.[field] !== true) errors.push(issue("aeb.source_proof_incomplete", "blocked", `semanticGraph.sourceProof.${field} 未确认。`));
  }
  if (!Array.isArray(graph?.limitations) || !graph.limitations.includes("semantic_graph_candidate_assets_materialized")) {
    errors.push(issue("aeb.materialized_limitation_missing", "blocked", "AEB semanticGraph 未声明 package-local asset materialization 边界。"));
  }

  const composition = timingPreflight.composition;
  const assets = await validateAssets(graph?.assets, packageRoot, errors, fileReadHooks);
  const layers = validateLayers(timingPreflight.nativeLayerIdentities, assets, composition, timingPreflight.timingByLayerId, errors);
  if (
    Number.isInteger(composition?.durationFrames)
    && layers.length * composition.durationFrames > AEB_MAX_NATIVE_SPRITE_FRAMES
  ) {
    errors.push(issue("aeb.native_expansion_bound", "blocked", "AEB native-subset 的图层帧展开规模超出受控上限。"));
  }
  const compatibility = classifyCompatibility(timingPreflight.authority, layers, errors);
  const project = buildProject(pkg, composition, assets, layers);
  const svgaMap = buildSvgaMap(project);
  const ownerModel = errors.length === 0
    ? buildAebOwnerModel({ compatibility, assets, layers, authority: timingPreflight.authority })
    : emptyOwnerModel(compatibility);
  return { errors, packageDocument: document, packageValue: pkg, compatibility, ownerModel, project, svgaMap, assets };
}

function validateForbiddenActions(pkg, errors) {
  validateForbiddenActionRecord(pkg.commonSource?.sourceSafety?.forbiddenActions, errors, "commonSource.sourceSafety");
}

function validateForbiddenActionRecord(actions, errors, scope) {
  const requiredFalse = ["rendered", "baked", "collectedFiles", "relinkedFootage", "installedPlugin", "wroteImporterOutput", "wroteEncoderOutput", "acceptedThirdPartyUpdate"];
  if (!isRecord(actions)) {
    errors.push(issue("aeb.forbidden_actions_missing", "blocked", `AEB 包缺少 ${scope}.forbiddenActions。`));
    return;
  }
  for (const field of requiredFalse) {
    if (actions[field] !== false) errors.push(issue("aeb.forbidden_action_enabled", "blocked", `AEB 包启用了禁止动作 ${field}。`));
  }
  if (actions.ranAeScript !== true) errors.push(issue("aeb.host_scan_unproven", "blocked", "AEB 包未记录真实 host scan。"));
}

function validateProfiles(pkg, errors) {
  const profiles = Array.isArray(pkg.outputProfiles) ? pkg.outputProfiles : [];
  for (const format of ["svga", "vap"]) {
    if (!profiles.some((profile) => profile?.targetFormat === format && profile?.supportClaim === false)) {
      errors.push(issue("aeb.output_profile_missing", "blocked", `AEB 包缺少不预先声明支持的 ${format} profile。`));
    }
  }
}

function validateComposition(value, errors) {
  const composition = {
    width: boundedNumber(value?.width, 1, 4096),
    height: boundedNumber(value?.height, 1, 4096),
    fps: boundedNumber(value?.fps, 1, 120),
    durationFrames: boundedInteger(value?.durationFrames, 1, 10_000)
  };
  if (Object.values(composition).some((entry) => entry === null)) {
    errors.push(issue("aeb.composition_invalid", "blocked", "AEB composition 的画布、FPS 或帧数无效。"));
  } else if (!Number.isInteger(composition.fps)) {
    errors.push(issue("aeb.composition_fps_unsupported", "blocked", "当前 SVGA adapter 只接受可原样写入 int32 协议字段的整数 FPS。"));
  }
  return composition;
}

async function validateAssets(values, packageRoot, errors, fileReadHooks) {
  const assets = [];
  const input = Array.isArray(values) ? values : [];
  const seenAssetIds = new Set();
  if (input.length === 0 || input.length > 256) errors.push(issue("aeb.assets_invalid", "blocked", "AEB native-subset 必须包含 1-256 个图片资源。"));
  const png = await import("fast-png");
  for (const value of input) {
    const assetId = exactSafeIdentifier(value?.assetId);
    const packagePath = safePackagePath(value?.packagePath);
    const width = boundedInteger(value?.width, 1, 4096);
    const height = boundedInteger(value?.height, 1, 4096);
    if (!assetId || !packagePath || value?.type !== "image" || !width || !height || !isSha256(value?.sha256)) {
      errors.push(issue("aeb.asset_contract_invalid", "blocked", "AEB 图片资源缺少安全 ID、相对路径、尺寸或 SHA-256。"));
      continue;
    }
    if (seenAssetIds.has(assetId)) {
      errors.push(issue("aeb.asset_id_duplicate", "blocked", `AEB 图片资源 ID ${assetId} 重复。`));
      continue;
    }
    seenAssetIds.add(assetId);
    if (value?.materialization?.status !== "copied_hash_finalized" || value?.materialization?.rawPathCollected !== false) {
      errors.push(issue("aeb.asset_not_finalized", "blocked", `AEB 图片资源 ${assetId} 未完成 package-local hash finalization。`));
      continue;
    }
    const filePath = path.join(packageRoot, packagePath);
    assertInside(filePath, packageRoot, "aeb.asset_path_escape");
    if (!existsSync(filePath) || lstatSync(filePath).isSymbolicLink() || !lstatSync(filePath).isFile()) {
      errors.push(issue("aeb.asset_file_missing", "blocked", `AEB 图片资源 ${assetId} 不存在或是符号链接。`));
      continue;
    }
    let bytes;
    try {
      bytes = readBoundedRegularFile(filePath, {
        maxBytes: AEB_MAX_PACKAGE_FILE_BYTES,
        purpose: "asset",
        codePrefix: "aeb.asset",
        fileReadHooks
      });
    } catch (error) {
      if (typeof error?.code === "string" && error.code.startsWith("aeb.asset")) throw error;
      throw codedError("aeb.asset_read_failed", "AEB 图片资源读取失败。");
    }
    if (sha256(bytes) !== value.sha256) {
      errors.push(issue("aeb.asset_hash_mismatch", "blocked", `AEB 图片资源 ${assetId} 与包内 SHA-256 不一致。`));
      continue;
    }
    try {
      const decoded = png.decode(bytes);
      if (decoded.width !== width || decoded.height !== height) throw new Error("dimension mismatch");
    } catch {
      errors.push(issue("aeb.asset_png_decode_failed", "blocked", `AEB 图片资源 ${assetId} 无法按声明尺寸完整解码。`));
      continue;
    }
    assets.push({ assetId, packagePath, width, height, sha256: value.sha256, bytes });
  }
  return assets;
}

function validateLayers(nativeLayerIdentities, assets, composition, timingByLayerId, errors) {
  const layers = [];
  const assetIds = new Set(assets.map((asset) => asset.assetId));
  for (const identity of nativeLayerIdentities) {
    const { value, layerId, assetId } = identity;
    const timing = timingByLayerId.get(layerId);
    const zIndex = boundedExactInteger(value?.zIndex, -100_000, 100_000);
    const visible = value?.visible === undefined
      ? true
      : typeof value.visible === "boolean"
        ? value.visible
        : null;
    if (
      !layerId
      || value?.type !== "image"
      || !assetIds.has(assetId)
      || zIndex === null
      || visible === null
      || !validTransform(value?.transform)
      || !validAnchor(value?.anchor)
      || !timing
    ) {
      errors.push(issue("aeb.layer_contract_invalid", "blocked", "AEB 图片图层缺少安全 ID、资源绑定、transform/anchor 或首末帧。"));
      continue;
    }
    layers.push({
      layerId,
      assetId,
      zIndex,
      visible,
      sourceTiming: timing.sourceTiming,
      activeFrameRange: timing.activeFrameRange,
      anchor: normalizeAnchor(value.anchor),
      transform: normalizeTransform(value.transform),
      keyframes: timing.keyframes
    });
  }
  return layers;
}

function classifyCompatibility(authority, nativeLayers, errors) {
  const decisions = [];
  const nativeIds = new Set(nativeLayers.map((layer) => layer.layerId));
  const { normalizedSemanticLayers, normalizedHostLayers, semanticById, hostById } = authority;

  for (const layer of nativeLayers) {
    if (semanticById.has(layer.layerId)) {
      errors.push(issue("aeb.native_host_authority_ambiguous", "blocked", `AEB native layer ${layer.layerId} 同时被声明为 unsupported。`));
      continue;
    }
    const hostLayer = hostById.get(layer.layerId);
    if (!hostLayer) {
      errors.push(issue("aeb.native_host_record_missing", "blocked", `AEB native layer ${layer.layerId} 缺少唯一 host authority record。`));
      continue;
    }
    if (hostLayer.sourceAssetId !== layer.assetId) {
      errors.push(issue("aeb.native_host_identity_mismatch", "blocked", `AEB native layer ${layer.layerId} 的 host asset identity 不匹配。`));
      continue;
    }
    decisions.push(classifyNativeHostLayer(layer.layerId, hostLayer));
  }

  for (const layer of normalizedSemanticLayers) {
    if (nativeIds.has(layer.layerId)) continue;
    const hostLayer = hostById.get(layer.layerId);
    if (hostLayer && !sameCompatibilityAuthority(layer, hostLayer)) {
      errors.push(issue("aeb.compatibility_layer_ambiguous", "blocked", `AEB compatibility layer ${layer.layerId} 与 host authority 冲突。`));
      continue;
    }
    decisions.push(classifyUnsupportedLayer(layer.layerId, hostLayer ?? layer));
  }
  for (const layer of normalizedHostLayers) {
    if (nativeIds.has(layer.layerId) || semanticById.has(layer.layerId)) continue;
    decisions.push(classifyUnsupportedLayer(layer.layerId, layer));
  }
  const counts = { native: 0, bake_required: 0, blocked: 0, suggestion_only: 0 };
  for (const decision of decisions) counts[decision.outcome] += 1;
  const blockingIssues = decisions
    .filter((decision) => decision.outcome === "blocked" || decision.outcome === "bake_required")
    .map((decision) => issue(`aeb.compatibility_${decision.outcome}`, decision.outcome, `${decision.layerId}: ${decision.reason}`));
  const outputIssues = decisions
    .filter((decision) => decision.outcome !== "native")
    .map((decision) => issue(`aeb.compatibility_${decision.outcome}`, decision.outcome, `${decision.layerId}: ${decision.reason}`));
  return {
    schemaVersion: "auto-svga-aeb-compatibility-v1",
    counts,
    decisions,
    blockingCount: counts.blocked + counts.bake_required,
    blockingIssues,
    outputIssues,
    outputAllowed: counts.native > 0 && counts.blocked === 0 && counts.bake_required === 0 && counts.suggestion_only === 0,
    renderOrBakeExecuted: false,
    supportClaimAllowed: false
  };
}

function normalizeCompatibilityAuthority(pkg, errors) {
  const semanticLayers = pkg.semanticGraph?.unsupportedLayers;
  const s3Layers = pkg.s3Report?.layers;
  if (!Array.isArray(semanticLayers) || !Array.isArray(s3Layers)) {
    errors.push(issue("aeb.compatibility_layers_invalid", "blocked", "AEB compatibility layer records 必须是数组。"));
  }
  const normalizedSemanticLayers = normalizeCompatibilityLayers(
    Array.isArray(semanticLayers) ? semanticLayers : [],
    errors,
    "aeb.compatibility_layer_ambiguous"
  );
  const normalizedHostLayers = normalizeCompatibilityLayers(
    Array.isArray(s3Layers) ? s3Layers : [],
    errors,
    "aeb.native_host_record_duplicate"
  );
  return {
    normalizedSemanticLayers,
    normalizedHostLayers,
    semanticById: new Map(normalizedSemanticLayers.map((layer) => [layer.layerId, layer])),
    hostById: new Map(normalizedHostLayers.map((layer) => [layer.layerId, layer]))
  };
}

function normalizeSemanticNativeLayerIdentities(values, errors) {
  const input = Array.isArray(values) ? values : [];
  const identities = [];
  const seenLayerIds = new Set();
  if (input.length === 0 || input.length > 256) {
    errors.push(issue("aeb.layers_invalid", "blocked", "AEB native-subset 必须包含 1-256 个图片图层。"));
  }
  for (const value of input) {
    const layerId = exactSafeIdentifier(value?.layerId);
    const assetId = exactSafeIdentifier(value?.assetId);
    if (!layerId || !assetId) {
      errors.push(issue("aeb.layer_contract_invalid", "blocked", "AEB 图片图层缺少安全 layerId 或 assetId。"));
      continue;
    }
    if (seenLayerIds.has(layerId)) {
      errors.push(issue("aeb.layer_id_duplicate", "blocked", `AEB 图片图层 ID ${layerId} 重复。`));
      continue;
    }
    seenLayerIds.add(layerId);
    identities.push({ value, layerId, assetId });
  }
  return identities;
}

function validateNativeTimingAuthority(nativeLayerIdentities, hostById, composition, normalizeFrameInterval, errors) {
  const timingByLayerId = new Map();
  if (!composition || Object.values(composition).some((entry) => entry === null)) return timingByLayerId;
  for (const { value, layerId, assetId } of nativeLayerIdentities) {
    const hostLayer = hostById.get(layerId);
    if (!hostLayer) {
      errors.push(issue("aeb.native_host_record_missing", "blocked", `AEB native layer ${layerId} 缺少唯一 host authority record。`));
      continue;
    }
    if (hostLayer.sourceAssetId !== assetId) {
      errors.push(issue("aeb.native_host_identity_mismatch", "blocked", `AEB native layer ${layerId} 的 host asset identity 不匹配。`));
      continue;
    }
    const timing = normalizeNativeTiming(hostLayer, composition, normalizeFrameInterval);
    if (timing.code) {
      errors.push(issue(timing.code, "blocked", timing.message));
      continue;
    }
    const keyframes = normalizeKeyframes(value?.keyframes, composition.durationFrames, timing.value.activeFrameRange);
    if (!keyframes.ok) {
      const rangeMismatch = keyframes.reason === "active_range_mismatch";
      errors.push(issue(
        rangeMismatch ? "aeb.native_keyframe_range_mismatch" : "aeb.layer_contract_invalid",
        "blocked",
        rangeMismatch
          ? `AEB native layer ${layerId} 的关键帧必须精确覆盖活动帧区间。`
          : "AEB 图片图层缺少安全 ID、资源绑定、transform/anchor 或首末帧。"
      ));
      continue;
    }
    timingByLayerId.set(layerId, { ...timing.value, keyframes: keyframes.value });
  }
  return timingByLayerId;
}

function normalizeNativeTiming(layer, composition, normalizeFrameInterval) {
  if (
    !exactFiniteNumber(layer.inPoint)
    || !exactFiniteNumber(layer.outPoint)
    || !exactFiniteNumber(layer.startTime)
    || !exactFiniteNumber(layer.stretch)
  ) {
    return { code: "aeb.native_host_timing_invalid", message: `AEB native layer ${layer.layerId} 缺少秒单位 in/out/start/stretch timing authority。` };
  }
  if (layer.stretch !== 100 || layer.timeRemapEnabled === true) {
    return { code: "aeb.native_host_time_mapping_unsupported", message: `AEB native layer ${layer.layerId} 使用 stretch 或 time-remap，超出当前原生子集。` };
  }
  const interval = normalizeFrameInterval({
    inPoint: layer.inPoint,
    outPoint: layer.outPoint,
    fps: composition.fps,
    durationFrames: composition.durationFrames
  });
  if (!interval.ok) {
    const code = interval.reason === "no_sample"
      ? "aeb.native_host_timing_no_sample"
      : "aeb.native_host_timing_invalid";
    const message = interval.reason === "no_sample"
      ? `AEB native layer ${layer.layerId} 的 in/out timing 不包含任何 composition sample frame。`
      : `AEB native layer ${layer.layerId} 的 in/out timing 超出 composition 时间轴。`;
    return { code, message };
  }
  return {
    value: {
      sourceTiming: {
        unit: "seconds",
        frameBoundary: "in_inclusive_out_exclusive",
        frameBoundaryContract: interval.frameBoundaryContract,
        inPoint: interval.inPoint,
        outPoint: interval.outPoint,
        startTime: layer.startTime,
        stretch: layer.stretch,
        timeRemapEnabled: false
      },
      activeFrameRange: interval.activeFrameRange
    }
  };
}

function normalizeCompatibilityLayers(values, errors, duplicateCode) {
  const normalized = [];
  const seen = new Set();
  for (const value of values) {
    const layer = normalizeCompatibilityLayer(value);
    if (!layer) {
      errors.push(issue("aeb.compatibility_layer_invalid", "blocked", "AEB compatibility layer record 类型或字段无效。"));
      continue;
    }
    if (seen.has(layer.layerId)) {
      errors.push(issue(duplicateCode, "blocked", `AEB compatibility layer ${layer.layerId} 存在重复 authority record。`));
      continue;
    }
    seen.add(layer.layerId);
    normalized.push(layer);
  }
  return normalized;
}

function classifyNativeHostLayer(layerId, layer) {
  if (layer.enabled !== true) {
    return { layerId, outcome: "blocked", reason: "Semantic-native 图层必须由启用的 host layer authority 证明。" };
  }
  if (layer.hasAudio || layer.expressedTransformFields.length > 0 || ["text", "camera", "light", "3d"].includes(layer.layerType)) {
    return { layerId, outcome: "blocked", reason: "Host authority 报告音频、表达式、文字、相机、灯光或 3D，不能按 native 输出。" };
  }
  if (layer.layerType === "precomp" || layer.effectCount > 0 || layer.maskCount > 0) {
    return { layerId, outcome: "bake_required", reason: "Host authority 报告预合成、效果或蒙版，需要独立 bake 门禁。" };
  }
  if (layer.layerType !== "footage") {
    return { layerId, outcome: "blocked", reason: "Host layer type 不属于 image_transform_v0 native authority。" };
  }
  return {
    layerId,
    outcome: "native",
    reason: "Semantic image layer 与唯一 native-safe host authority record 一致。"
  };
}

function classifyUnsupportedLayer(layerId, layer) {
  if (layer.enabled === false) return { layerId, outcome: "suggestion_only", reason: "源图层已禁用，仅作为建议上下文。" };
  if (layer.hasAudio || layer.expressedTransformFields.length > 0 || ["text", "camera", "light", "3d"].includes(layer.layerType)) {
    return { layerId, outcome: "blocked", reason: "当前原生子集无法安全表示音频、表达式、文字、相机、灯光或 3D。" };
  }
  if (layer.layerType === "precomp" || layer.effectCount > 0 || layer.maskCount > 0) {
    return { layerId, outcome: "bake_required", reason: "预合成、效果或蒙版需要独立 bake 门禁，当前未执行。" };
  }
  return { layerId, outcome: "blocked", reason: "图层不在 image_transform_v0 的结构化支持范围内。" };
}

function normalizeCompatibilityLayer(value) {
  if (!isRecord(value)) return null;
  const layerId = exactSafeIdentifier(value.layerId);
  const layerType = exactSafeIdentifier(value.layerType ?? value.type)?.toLowerCase();
  const effectCount = boundedExactInteger(value.effectCount, 0, 10_000);
  const maskCount = boundedExactInteger(value.maskCount, 0, 10_000);
  const expressedTransformFields = safeIdentifierArray(value.expressedTransformFields, true);
  const sourceAssetId = value.sourceAssetId === undefined ? undefined : exactSafeIdentifier(value.sourceAssetId);
  if (
    !layerId
    || !layerType
    || typeof value.enabled !== "boolean"
    || typeof value.hasAudio !== "boolean"
    || effectCount === null
    || maskCount === null
    || expressedTransformFields === null
    || (value.sourceAssetId !== undefined && !sourceAssetId)
  ) return null;
  for (const field of ["locked", "shy", "solo", "audioEnabled"]) {
    if (field in value && typeof value[field] !== "boolean") return null;
  }
  for (const field of ["transformFieldsPresent", "keyedTransformFields"]) {
    if (field in value && safeIdentifierArray(value[field], false) === null) return null;
  }
  for (const field of ["index", "inPoint", "outPoint", "startTime", "stretch"]) {
    if (field in value && !exactFiniteNumber(value[field])) return null;
  }
  if ("timeRemapEnabled" in value && typeof value.timeRemapEnabled !== "boolean") return null;
  return {
    layerId,
    layerType,
    enabled: value.enabled,
    hasAudio: value.hasAudio,
    effectCount,
    maskCount,
    expressedTransformFields,
    sourceAssetId,
    inPoint: value.inPoint,
    outPoint: value.outPoint,
    startTime: value.startTime,
    stretch: value.stretch,
    timeRemapEnabled: value.timeRemapEnabled ?? false
  };
}

function sameCompatibilityAuthority(first, second) {
  return first.layerType === second.layerType
    && first.enabled === second.enabled
    && first.hasAudio === second.hasAudio
    && first.effectCount === second.effectCount
    && first.maskCount === second.maskCount
    && stableStringify(first.expressedTransformFields) === stableStringify(second.expressedTransformFields);
}

function safeIdentifierArray(value, required) {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || value.length > 64) return null;
  const normalized = value.map((entry) => exactSafeIdentifier(entry));
  return normalized.every(Boolean) ? normalized : null;
}

function buildProject(pkg, composition, assets, layers) {
  const projectId = `${safeIdentifier(pkg.packageIdentity?.packageId) || "aeb-package"}-wp5am-native-subset`;
  const orderedAssets = [...assets].sort((first, second) => compareIdentifiers(first.assetId, second.assetId));
  const orderedLayers = [...layers].sort(compareLayerStack);
  return {
    schemaVersion: "0.4.0",
    version: "0.4.0",
    projectId,
    assetType: "avatar_frame",
    canvas: { width: composition.width, height: composition.height },
    fps: composition.fps,
    durationFrames: composition.durationFrames,
    loop: true,
    assets: orderedAssets.map((asset) => ({
      id: asset.assetId,
      type: "image",
      path: asset.packagePath,
      width: asset.width,
      height: asset.height,
      sha256: asset.sha256,
      generated: false
    })),
    layers: orderedLayers.map((layer) => ({
      id: layer.layerId,
      type: "image",
      assetId: layer.assetId,
      zIndex: layer.zIndex,
      visible: layer.visible,
      blendMode: "normal",
      fallbackBlendMode: "normal",
      fallbackOpacityMultiplier: 1,
      sourceTiming: layer.sourceTiming,
      activeFrameRange: layer.activeFrameRange,
      anchor: layer.anchor,
      transform: layer.transform
    })),
    animations: orderedLayers.map((layer) => ({
      id: `aeb_sampled_transform_${layer.layerId}`,
      templateId: "breathing_glow",
      targetLayerId: layer.layerId,
      keyframes: layer.keyframes,
      easing: "linear"
    })),
    export: {
      format: "intermediate-json",
      exporter: "json-exporter",
      svgaExporter: {
        status: "stub",
        notes: "AEB native subset project is encoded only after package validation."
      }
    }
  };
}

function buildSvgaMap(project) {
  const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]));
  const animationMap = new Map(project.animations.map((animation) => [animation.targetLayerId, animation]));
  const orderedLayers = [...project.layers].sort(compareLayerStack);
  return {
    schemaVersion: "0.4.0",
    version: "0.1.0",
    projectId: project.projectId,
    coordinateConvention: {
      transformXY: "layer.transform.x/y is the layer anchor position in canvas coordinates.",
      anchorXY: "layer.anchor.x/y is the anchor position in the layer local coordinate system.",
      rotationAndScale: "rotation and scale are applied around anchor."
    },
    canvas: project.canvas,
    fps: project.fps,
    durationFrames: project.durationFrames,
    runtimeMaskUsed: false,
    bakedSweepSprites: [],
    sprites: orderedLayers.map((layer) => {
      const asset = assetMap.get(layer.assetId);
      return {
        spriteId: `sprite_${layer.id}`,
        layerId: layer.id,
        assetPath: asset.path,
        exportAssetPath: asset.path,
        width: asset.width,
        height: asset.height,
        zIndex: layer.zIndex,
        anchor: layer.anchor,
        transform: layer.transform,
        keyframes: animationMap.get(layer.id)?.keyframes ?? [],
        blendMode: "normal",
        fallbackBlendMode: "normal",
        fallbackOpacityMultiplier: 1,
        visible: layer.visible,
        sourceTiming: layer.sourceTiming,
        visibleFrameRange: layer.activeFrameRange,
        maskStrategy: "none",
        replaceable: false
      };
    })
  };
}

function compareLayerStack(first, second) {
  return first.zIndex - second.zIndex || compareIdentifiers(first.layerId ?? first.id, second.layerId ?? second.id);
}

function compareIdentifiers(first, second) {
  return first < second ? -1 : first > second ? 1 : 0;
}

function buildAebOwnerModel({ compatibility, assets, layers, authority }) {
  const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));
  const layerById = new Map(layers.map((layer) => [layer.layerId, layer]));
  const hostById = authority?.hostById instanceof Map ? authority.hostById : new Map();
  return {
    schemaVersion: "auto-svga-aeb-owner-model-v1",
    pathRedacted: true,
    readOnly: true,
    compatibility: ownerCompatibilitySummary(compatibility),
    authority: {
      schemaVersion: "auto-svga-aeb-owner-authority-v1",
      resourceCount: assets.length,
      layerCount: compatibility.decisions.length,
      resources: assets.map((asset) => ({
        assetId: asset.assetId,
        sha256: asset.sha256,
        sizeBytes: asset.bytes.byteLength,
        width: asset.width,
        height: asset.height,
        hashVerified: true,
        pathRedacted: true
      })),
      layers: compatibility.decisions.map((decision) => {
        const layer = layerById.get(decision.layerId);
        const hostLayer = hostById.get(decision.layerId);
        const assetId = layer?.assetId ?? hostLayer?.sourceAssetId ?? null;
        return {
          layerId: decision.layerId,
          assetId,
          outcome: decision.outcome,
          reason: decision.reason,
          hostAuthorityBound: Boolean(hostLayer),
          resourceAuthorityBound: Boolean(assetId && assetById.has(assetId)),
          zIndex: layer?.zIndex ?? null,
          visible: layer?.visible ?? null,
          activeFrameRange: layer ? { ...layer.activeFrameRange } : null
        };
      })
    }
  };
}

function ownerCompatibilitySummary(compatibility) {
  return {
    schemaVersion: compatibility.schemaVersion,
    counts: { ...compatibility.counts },
    decisions: compatibility.decisions.map((decision) => ({
      layerId: decision.layerId,
      outcome: decision.outcome,
      reason: decision.reason
    })),
    blockingCount: compatibility.blockingCount,
    outputAllowed: compatibility.outputAllowed
  };
}

function emptyOwnerModel(compatibility) {
  return {
    schemaVersion: "auto-svga-aeb-owner-model-v1",
    pathRedacted: true,
    readOnly: true,
    compatibility: ownerCompatibilitySummary(compatibility),
    authority: {
      schemaVersion: "auto-svga-aeb-owner-authority-v1",
      resourceCount: 0,
      layerCount: 0,
      resources: [],
      layers: []
    }
  };
}

function ownerModelAssets(ownerModel) {
  return ownerModel.authority.resources.map((resource) => ({
    id: resource.assetId,
    name: resource.assetId,
    kind: "image",
    dimensions: `${resource.width} × ${resource.height}`,
    sizeBytes: resource.sizeBytes,
    resolutionStatus: "package hash verified",
    replaceable: false
  }));
}

function compatibilityDecisionIssues(compatibility) {
  return compatibility.decisions.map((decision) => ({
    code: `aeb.compatibility_${decision.outcome}`,
    severity: decision.outcome === "native" ? "info" : decision.outcome === "suggestion_only" ? "warning" : "error",
    message: `${decision.layerId}: ${decision.reason}`
  }));
}

function mergeOwnerIssues(primaryIssues, compatibility) {
  const combined = [...primaryIssues, ...compatibilityDecisionIssues(compatibility)];
  const seen = new Set();
  return combined.filter((entry) => {
    const key = `${entry.code}\u0000${entry.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function augmentPreviewModel(model, context) {
  if (!model || typeof model !== "object") return model;
  const compatibility = context.compatibility;
  const ownerModel = context.ownerModel;
  const facts = [
    { label: "AEB package", value: context.packageId },
    { label: "Compatibility", value: `${compatibility.counts.native} native · ${compatibility.counts.bake_required} bake · ${compatibility.counts.blocked} blocked · ${compatibility.counts.suggestion_only} suggestion` },
    { label: "Assets", value: `${ownerModel.authority.resourceCount} hash-bound · read-only` },
    { label: "Layers", value: `${ownerModel.authority.layerCount} classified` },
    { label: "Project binding", value: context.project.projectId },
    { label: "Generated SVGA", value: `${context.output.svgaBytes.byteLength} B · inflate/decode pass` }
  ];
  const issues = compatibilityDecisionIssues(compatibility);
  const packageAssets = ownerModelAssets(ownerModel);
  return {
    ...model,
    displayName: context.displayName,
    rightPanel: {
      ...(model.rightPanel ?? {}),
      facts: [...facts, ...(model.rightPanel?.facts ?? [])],
      assets: packageAssets,
      issues: [...issues, ...(model.rightPanel?.issues ?? [])]
    }
  };
}

function failureResult({ displayName, packageSha256, treeSha256, compatibility, ownerModel = emptyOwnerModel(compatibility), issues }) {
  const primaryIssues = issues.length > 0 ? issues : [issue("aeb.package_blocked", "blocked", "AEB 包未通过兼容性门禁。")];
  const normalizedIssues = mergeOwnerIssues(primaryIssues, compatibility);
  return {
    status: "opened",
    sourceId: "",
    pathRedacted: true,
    model: {
      status: "failed",
      detectedFormat: "svga",
      displayName,
      canvas: { playback: { durationMs: 0, currentTimeMs: 0 } },
      commands: { play: false, pause: false, recover: false, seek: false, loop: false, replace: false, resetReplacement: false },
      rightPanel: {
        facts: [
          { label: "AEB package", value: packageSha256 ? "hash bound" : "unreadable" },
          { label: "Compatibility", value: `${compatibility.counts.native} native · ${compatibility.counts.bake_required} bake · ${compatibility.counts.blocked} blocked · ${compatibility.counts.suggestion_only} suggestion` },
          { label: "Assets", value: `${ownerModel.authority.resourceCount} hash-bound · read-only` },
          { label: "Layers", value: `${ownerModel.authority.layerCount} classified` }
        ],
        assets: ownerModelAssets(ownerModel),
        issues: normalizedIssues
      }
    },
    aeb: {
      schemaVersion: "auto-svga-aeb-native-preview-v1",
      productMilestoneId: AEB_NATIVE_PREVIEW_PRODUCT_MILESTONE_ID,
      package: { sha256: packageSha256, treeSha256Before: treeSha256, pathRedacted: true },
      compatibility,
      ownerModel,
      generatedSvga: null,
      preview: { reopened: false, playbackLoadPrepared: false, directPixelsRequired: true },
      boundaries: aebBoundaries()
    },
    aebOutput: null
  };
}

function staleGenerationFailure(resolved, packageBytes, snapshot, compatibility, ownerModel) {
  return failureResult({
    displayName: resolved?.displayName ?? "AEB 导出包",
    packageSha256: packageBytes ? sha256(packageBytes) : null,
    treeSha256: snapshot?.sha256 ?? null,
    compatibility,
    ownerModel,
    issues: [issue("aeb.open_generation_stale", "blocked", "AEB 打开请求已被更新请求替代，未保留输出或 Preview 状态。")]
  });
}

function aebBoundaries() {
  return {
    packageSourceMutationAllowed: false,
    renderOrBakeExecuted: false,
    externalRequestAllowed: false,
    supportClaimAllowed: false,
    productOwnerAcceptanceClaimed: false,
    releaseClaimed: false
  };
}

function emptyCompatibility() {
  return {
    schemaVersion: "auto-svga-aeb-compatibility-v1",
    counts: { native: 0, bake_required: 0, blocked: 1, suggestion_only: 0 },
    decisions: [],
    blockingCount: 1,
    blockingIssues: [],
    outputIssues: [],
    outputAllowed: false,
    renderOrBakeExecuted: false,
    supportClaimAllowed: false
  };
}

function normalizeKeyframes(values, durationFrames, activeFrameRange) {
  if (
    !Array.isArray(values)
    || !Number.isInteger(durationFrames)
    || durationFrames < 1
    || !isRecord(activeFrameRange)
    || !Number.isInteger(activeFrameRange.start)
    || !Number.isInteger(activeFrameRange.end)
    || activeFrameRange.start < 0
    || activeFrameRange.end < activeFrameRange.start
    || activeFrameRange.end >= durationFrames
  ) return { ok: false, reason: "invalid" };
  const expectedCountMinimum = activeFrameRange.start === activeFrameRange.end ? 1 : 2;
  if (values.length < expectedCountMinimum) return { ok: false, reason: "active_range_mismatch" };
  const keyframes = [];
  let previousFrame = -1;
  for (const value of values) {
    if (
      !isRecord(value)
      || typeof value.frame !== "number"
      || !Number.isInteger(value.frame)
      || value.frame < 0
      || value.frame >= durationFrames
      || value.frame <= previousFrame
      || !validTransform(value)
    ) return { ok: false, reason: "invalid" };
    previousFrame = value.frame;
    keyframes.push({ frame: value.frame, ...normalizeTransform(value) });
  }
  if (
    keyframes.some((keyframe) => keyframe.frame < activeFrameRange.start || keyframe.frame > activeFrameRange.end)
    || keyframes[0].frame !== activeFrameRange.start
    || keyframes[keyframes.length - 1].frame !== activeFrameRange.end
  ) return { ok: false, reason: "active_range_mismatch" };
  return { ok: true, value: keyframes };
}

function normalizeTransform(value) {
  return {
    x: Number(value.x),
    y: Number(value.y),
    scaleX: Number(value.scaleX),
    scaleY: Number(value.scaleY),
    rotation: Number(value.rotation),
    opacity: Number(value.opacity)
  };
}

function normalizeAnchor(value) {
  return { x: Number(value.x), y: Number(value.y) };
}

function validTransform(value) {
  return isRecord(value)
    && ["x", "y", "scaleX", "scaleY", "rotation", "opacity"].every((field) => exactFiniteNumber(value[field]))
    && value.opacity >= 0
    && value.opacity <= 1;
}

function validAnchor(value) {
  return isRecord(value) && exactFiniteNumber(value.x) && exactFiniteNumber(value.y);
}

function safePackagePath(value) {
  if (typeof value !== "string" || value.length === 0 || path.isAbsolute(value) || value.includes("\\") || value.split("/").includes("..")) return "";
  const normalized = path.posix.normalize(value);
  return normalized === "." || normalized.startsWith("../") || normalized !== value ? "" : normalized;
}

function safeIdentifier(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  return normalized;
}

function exactSafeIdentifier(value) {
  return typeof value === "string" && value === safeIdentifier(value) ? value : "";
}

function boundedNumber(value, minimum, maximum) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function boundedInteger(value, minimum, maximum) {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function isAcceptedPreviewStatus(status) {
  return status === "previewReady" || status === "playing" || status === "paused";
}

function boundedExactInteger(value, minimum, maximum) {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum ? value : null;
}

function exactFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function findRawPaths(value, pointer = "$", output = []) {
  if (typeof value === "string") {
    if (/^\/(?:Users|Volumes|Applications|private|var|tmp)\//u.test(value) || /^[A-Za-z]:[\\/]/u.test(value) || /^file:\/\//iu.test(value)) output.push({ pointer });
    return output;
  }
  if (Array.isArray(value)) value.forEach((entry, index) => findRawPaths(entry, `${pointer}[${index}]`, output));
  else if (isRecord(value)) Object.entries(value).forEach(([key, entry]) => findRawPaths(entry, `${pointer}.${key}`, output));
  return output;
}

function assertInside(candidate, container, code) {
  const relative = path.relative(path.resolve(container), path.resolve(candidate));
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw codedError(code, "AEB 路径超出受控边界。");
}

function issue(code, severity, message) {
  return { code, severity, message };
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function safeIssueMessage(error) {
  const code = typeof error?.code === "string" && error.code.startsWith("aeb.") ? error.code : "aeb.package_intake_failed";
  const known = {
    "aeb.package_path_invalid": "请选择本地 AEB 导出包文件或文件夹。",
    "aeb.package_symlink": "AEB 包路径不能是符号链接。",
    "aeb.package_alias_root": "AEB 包目录不能通过别名或符号链接访问。",
    "aeb.package_tree_symlink": "AEB 包内不能包含符号链接。",
    "aeb.asset_path_escape": "AEB 资源路径超出包目录。",
    "aeb.native_svga_structure_validation_failed": "生成的原生子集 SVGA 缺少完整帧结构或时间线。",
    "aeb.native_svga_authority_validation_failed": "生成的原生子集 SVGA 未通过项目派生 authority 校验。",
    "aeb.native_svga_validation_failed": "生成的原生子集 SVGA 未通过验证。"
  };
  return known[code] ?? "AEB 包未通过结构化 intake；未生成输出，也未修改 Preview。";
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

module.exports = {
  AEB_NATIVE_PREVIEW_PRODUCT_MILESTONE_ID,
  createAebNativePreviewSession
};
