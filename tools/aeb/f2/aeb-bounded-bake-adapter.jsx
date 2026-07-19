(function installAebF2BoundedBakeAdapter(root) {
  "use strict";

  var PLAN_SCHEMA = "aeb-ae-bake-execution-plan-v2";
  var REQUEST_SCHEMA = "aeb-ae-controlled-comp-scan-request-v2";
  var OUTPUT_SCHEMA = "aeb-ae-controlled-comp-scan-output-v2";
  var REQUEST_ENV = "AUTO_SVGA_AEB_F2_SCAN_REQUEST";
  var RESULT_ENV = "AUTO_SVGA_AEB_F2_SCAN_RESULT";

  function fail(code, message) {
    throw new Error(code + ":" + message);
  }

  function readJsonFile(filePath) {
    var file = new File(filePath);
    var text;
    if (!file.exists || !file.open("r")) fail("AE_SCAN_REQUEST_MISSING", "Controlled scan request is unavailable.");
    try {
      text = file.read();
    } finally {
      file.close();
    }
    return JSON.parse(text);
  }

  function writeJsonFileOnce(filePath, value) {
    var file = new File(filePath);
    if (file.exists) fail("AE_SCAN_RESULT_EXISTS", "Controlled scan result destination must be absent.");
    if (!file.open("w")) fail("AE_SCAN_RESULT_WRITE_FAILED", "Controlled scan result cannot be written.");
    try {
      file.encoding = "UTF-8";
      file.write(JSON.stringify(value));
    } finally {
      file.close();
    }
  }

  function isAdobeBuiltInEffect(effect) {
    return effect && typeof effect.matchName === "string" && effect.matchName.indexOf("ADBE ") === 0;
  }

  function inspectExpressions(property, facts) {
    var index;
    if (!property) return;
    if (property.canSetExpression && property.expressionEnabled) {
      if (property.expressionError && property.expressionError.length > 0) {
        fail("AE_EXPRESSION_ERROR", "Controlled expression has a host evaluation error.");
      }
      facts.expressionCount += 1;
    }
    if (property.numProperties) {
      for (index = 1; index <= property.numProperties; index += 1) {
        inspectExpressions(property.property(index), facts);
      }
    }
  }

  function inspectLayer(layer, depth, facts) {
    var effects;
    var masks;
    var index;
    var effect;
    var mask;
    if (layer instanceof CameraLayer || layer instanceof LightLayer || layer.threeDLayer === true) {
      fail("AE_UNSUPPORTED_3D_CAMERA", "3D layers, cameras, and lights are blocked in F2.");
    }
    if (layer.audioEnabled === true || (layer.source && layer.source.hasAudio === true)) {
      fail("AE_UNSUPPORTED_AUDIO", "Audio is blocked in F2.");
    }
    effects = layer.property("ADBE Effect Parade");
    if (effects) {
      for (index = 1; index <= effects.numProperties; index += 1) {
        effect = effects.property(index);
        if (!isAdobeBuiltInEffect(effect)) {
          fail("AE_UNSUPPORTED_PLUGIN", "Third-party or unknown effects are blocked in F2.");
        }
        facts.effectMatchNames.push(effect.matchName);
      }
    }
    masks = layer.property("ADBE Mask Parade");
    if (masks) {
      for (index = 1; index <= masks.numProperties; index += 1) {
        mask = masks.property(index);
        if (mask.maskMode !== MaskMode.ADD) {
          fail("AE_UNSUPPORTED_MASK_MODE", "Only additive masks are supported in F2.");
        }
        facts.maskModes.push("add");
      }
    }
    inspectExpressions(layer, facts);
    if (layer.source instanceof CompItem) {
      if (depth >= 1) {
        fail("AE_UNSUPPORTED_PRECOMP_DEPTH", "Only one nested precomp level is supported in F2.");
      }
      facts.precompDepth = Math.max(facts.precompDepth, depth + 1);
      inspectComposition(layer.source, depth + 1, facts);
    }
  }

  function inspectComposition(comp, depth, facts) {
    var index;
    if (!(comp instanceof CompItem)) fail("AE_COMPOSITION_INVALID", "Bounded Bake target must be a composition.");
    for (index = 1; index <= comp.numLayers; index += 1) inspectLayer(comp.layer(index), depth, facts);
  }

  function findComposition(compositionId, compositionName) {
    var index;
    var item;
    for (index = 1; index <= app.project.numItems; index += 1) {
      item = app.project.item(index);
      if (item instanceof CompItem && String(item.id) === compositionId && item.name === compositionName) return item;
    }
    fail("AE_COMPOSITION_BINDING_MISMATCH", "Approved composition identity is not present in the scratch project.");
  }

  function findTargetLayer(comp, binding) {
    var index;
    var layer;
    for (index = 1; index <= comp.numLayers; index += 1) {
      layer = comp.layer(index);
      if (String(layer.id) === binding.aeLayerId && layer.name === binding.name) return layer;
    }
    fail("AE_TARGET_LAYER_BINDING_MISMATCH", "Approved target layer identity is not present in the composition.");
  }

  function sameJson(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function buildSchedule(requestJson) {
    var request = typeof requestJson === "string" ? JSON.parse(requestJson) : requestJson;
    var plan = request.plan;
    var facts = {
      twoDOnly: true,
      precompDepth: 0,
      effectMatchNames: [],
      maskModes: [],
      expressionCount: 0,
      expressionSampling: "ae_rasterized",
      audio: false,
      threeD: false,
      camera: false,
      thirdPartyPlugins: false,
      unknownHostCapabilities: false
    };
    var comp;
    var index;
    var renderItem;
    var expectedScratchRelativePath;
    var normalizedScratchPath;
    if (!request || request.schemaVersion !== REQUEST_SCHEMA || !plan || plan.schemaVersion !== PLAN_SCHEMA) {
      fail("AE_EXECUTION_PLAN_SCHEMA_UNSUPPORTED", "Unsupported bounded Bake scan request or plan schema.");
    }
    if (request.executionId !== plan.executionId || request.planHash !== plan.planHash
        || request.producerSourceHash !== plan.host.producerSourceHash) {
      fail("AE_SCAN_REQUEST_BINDING_MISMATCH", "Controlled scan request is not bound to the execution plan and producer source.");
    }
    expectedScratchRelativePath = plan.output.workDirectory + "/scratch-project.aep";
    normalizedScratchPath = String(request.scratchProjectPath || "").replace(/\\/g, "/");
    if (!request.scratchProjectBefore
        || request.scratchProjectBefore.schemaVersion !== "aeb-ae-scratch-project-binding-v1"
        || request.scratchProjectBefore.taskId !== plan.job.task.taskId
        || request.scratchProjectBefore.taskRootName !== plan.taskRootName
        || request.scratchProjectBefore.relativePath !== expectedScratchRelativePath
        || request.scratchProjectBefore.contentHash !== plan.sourceFiles.projectContentHash
        || normalizedScratchPath.slice(-(expectedScratchRelativePath.length + 1)) !== "/" + expectedScratchRelativePath) {
      fail("AE_SCRATCH_PROJECT_BINDING_MISMATCH", "Controlled scan request is not bound to the approved task-owned scratch project.");
    }
    if (plan.host.applicationId !== "com.adobe.AfterEffects.application"
        || String(app.version) !== plan.host.version
        || String(app.buildName || app.buildNumber) !== plan.host.build) {
      fail("AE_HOST_BINDING_MISMATCH", "Scratch host version and build do not match the plan.");
    }
    if (plan.taskRootName !== plan.job.task.taskId || plan.job.alphaMode !== "straight"
        || plan.job.safety.sourceProjectMutationAllowed !== false) {
      fail("AE_TASK_BINDING_MISMATCH", "Task root, source safety, or straight-alpha contract is invalid.");
    }
    if (app.project && (app.project.file !== null || app.project.numItems > 0)) {
      fail("AE_EXISTING_PROJECT_FORBIDDEN", "Controlled scanner refuses to replace a non-empty host project.");
    }
    app.open(new File(request.scratchProjectPath));
    try {
      comp = findComposition(plan.composition.id, plan.composition.name);
      for (index = 0; index < plan.composition.targetLayers.length; index += 1) {
        inspectLayer(findTargetLayer(comp, plan.composition.targetLayers[index]), 0, facts);
      }
      facts.effectMatchNames.sort();
      facts.maskModes.sort();
      if (!sameJson(facts, plan.controlledFeatures)) {
        fail("AE_CONTROLLED_FEATURE_DRIFT", "Actual controlled feature inventory differs from the approved plan.");
      }
      renderItem = app.project.renderQueue.items.add(comp);
      app.project.save(new File(request.scratchProjectPath));
      return {
        schemaVersion: OUTPUT_SCHEMA,
        executionId: plan.executionId,
        planHash: plan.planHash,
        producerSourceHash: plan.host.producerSourceHash,
        host: {
          applicationId: plan.host.applicationId,
          version: plan.host.version,
          build: plan.host.build
        },
        composition: { id: plan.composition.id, name: plan.composition.name },
        targetLayers: plan.composition.targetLayers,
        controlledFeatures: facts,
        scratchProjectBefore: request.scratchProjectBefore,
        renderQueueIndex: renderItem.index,
        temporaryRenderItemsCreated: 1
      };
    } finally {
      if (app.project) app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    }
  }

  function runFromEnvironment() {
    var requestPath = $.getenv(REQUEST_ENV);
    var resultPath = $.getenv(RESULT_ENV);
    var result;
    if (!requestPath && !resultPath) return;
    if (!requestPath || !resultPath) fail("AE_SCAN_ENVIRONMENT_INVALID", "Controlled scan environment is incomplete.");
    result = buildSchedule(readJsonFile(requestPath));
    writeJsonFileOnce(resultPath, result);
  }

  root.$ = root.$ || {};
  root.$._autoSvgaAebF2 = {
    planSchema: PLAN_SCHEMA,
    requestSchema: REQUEST_SCHEMA,
    outputSchema: OUTPUT_SCHEMA,
    buildSchedule: buildSchedule
  };
  runFromEnvironment();
}(this));
