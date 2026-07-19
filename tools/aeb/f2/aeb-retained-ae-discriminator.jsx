(function runAebRetainedAeDiscriminator(root) {
  "use strict";

  var REQUEST_ENV = "AUTO_SVGA_AEB_RETAINED_REQUEST";
  var REQUEST_SCHEMA = "aeb-retained-ae-jsx-request-v1";
  var PLAN_SCHEMA = "aeb-retained-ae-discriminator-plan-v1";
  var CHECKPOINT_SCHEMA = "aeb-retained-ae-checkpoint-publication-v1";
  var APPROVAL_SCHEMA = "aeb-retained-ae-checkpoint-approval-v1";
  var RESULT_SCHEMA = "aeb-retained-ae-discriminator-result-v1";
  var CHECKPOINT_RELATIVE_PATH = "checkpoint/checkpoint.aep";
  var OUTPUT_TEMPLATE = "PNG Sequence with Alpha";
  var appOpenCountAfterCheckpoint = 0;
  var projectCreated = false;
  var renderItem = null;
  var fixtureComp = null;
  var requestFile = null;
  var approvalFile = null;
  var partialOutputFile = null;

  function fail(code) {
    throw new Error(code);
  }

  function exactKeys(value, keys, code) {
    var actual = [];
    var expected = keys.slice(0);
    var key;
    if (!value || typeof value !== "object" || value instanceof Array) fail(code);
    for (key in value) {
      if (value.hasOwnProperty(key)) actual.push(key);
    }
    actual.sort();
    expected.sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code);
  }

  function canonicalValue(value) {
    var keys;
    var output;
    var index;
    if (value instanceof Array) {
      output = [];
      for (index = 0; index < value.length; index += 1) output.push(canonicalValue(value[index]));
      return output;
    }
    if (value && typeof value === "object") {
      keys = [];
      for (index in value) {
        if (value.hasOwnProperty(index)) keys.push(index);
      }
      keys.sort();
      output = {};
      for (index = 0; index < keys.length; index += 1) output[keys[index]] = canonicalValue(value[keys[index]]);
      return output;
    }
    return value;
  }

  function canonicalJson(value) {
    return JSON.stringify(canonicalValue(value));
  }

  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  function sha256(text) {
    var maxWord = Math.pow(2, 32);
    var words = [];
    var asciiBitLength = text.length * 8;
    var hash = [];
    var constants = [];
    var primeCounter = 0;
    var candidate = 2;
    var isPrime;
    var divisor;
    var index;
    var charIndex;
    var j;
    var w;
    var oldHash;
    var a;
    var e;
    var temp1;
    var temp2;
    var result = "";
    var hex;
    while (primeCounter < 64) {
      isPrime = true;
      for (divisor = 2; divisor * divisor <= candidate; divisor += 1) {
        if (candidate % divisor === 0) {
          isPrime = false;
          break;
        }
      }
      if (isPrime) {
        if (primeCounter < 8) hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        constants[primeCounter] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
        primeCounter += 1;
      }
      candidate += 1;
    }
    text += "\x80";
    while (text.length % 64 !== 56) text += "\x00";
    for (charIndex = 0; charIndex < text.length; charIndex += 1) {
      j = text.charCodeAt(charIndex);
      if (j >> 8) fail("NON_ASCII_HASH_INPUT");
      words[charIndex >> 2] |= j << (((3 - charIndex) % 4) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for (j = 0; j < words.length;) {
      w = words.slice(j, j += 16);
      oldHash = hash.slice(0);
      hash = hash.slice(0, 8);
      for (index = 0; index < 64; index += 1) {
        if (index >= 16) {
          a = w[index - 15];
          e = w[index - 2];
          w[index] = (w[index - 16]
            + (rightRotate(a, 7) ^ rightRotate(a, 18) ^ (a >>> 3))
            + w[index - 7]
            + (rightRotate(e, 17) ^ rightRotate(e, 19) ^ (e >>> 10))) | 0;
        }
        a = hash[0];
        e = hash[4];
        temp1 = (hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + constants[index]
          + w[index]) | 0;
        temp2 = ((rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]))) | 0;
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
        hash.pop();
      }
      for (index = 0; index < 8; index += 1) hash[index] = (hash[index] + oldHash[index]) | 0;
    }
    for (index = 0; index < 8; index += 1) {
      for (j = 3; j + 1; j -= 1) {
        hex = (hash[index] >> (j * 8)) & 255;
        result += (hex < 16 ? "0" : "") + hex.toString(16);
      }
    }
    return result;
  }

  function withHash(value, field) {
    var unsigned = {};
    var key;
    for (key in value) {
      if (value.hasOwnProperty(key) && key !== field) unsigned[key] = value[key];
    }
    unsigned[field] = sha256(canonicalJson(unsigned));
    return unsigned;
  }

  function resolveTaskFile(rootPath, relativePath) {
    var normalized = String(relativePath || "").replace(/\\/g, "/");
    if (!/^(control|checkpoint|output|result)\/[A-Za-z0-9._\[\]-]+$/.test(normalized)
        || normalized.indexOf("..") >= 0) fail("TASK_PATH_INVALID");
    return new File(rootPath + "/" + normalized);
  }

  function readJsonBounded(file, maxBytes, code) {
    var beforeLength;
    var text;
    if (!file || file.alias === true || !file.exists) fail(code);
    beforeLength = Number(file.length);
    if (beforeLength <= 0 || beforeLength > maxBytes || !file.open("r")) fail(code);
    try {
      file.encoding = "UTF-8";
      text = file.read(maxBytes + 1);
    } finally {
      file.close();
    }
    file.refresh();
    if (text.length > maxBytes || Number(file.length) !== beforeLength) fail(code);
    try {
      return JSON.parse(text);
    } catch (error) {
      fail(code);
    }
  }

  function writeJsonOnce(file, value, maxBytes, code) {
    var text = canonicalJson(value);
    var temporary;
    var temporaryPath;
    if (!file || file.alias === true || file.exists || text.length <= 0 || text.length > maxBytes) fail(code);
    temporaryPath = file.fsName + ".partial";
    temporary = new File(temporaryPath);
    if (temporary.alias === true || temporary.exists || !temporary.open("w")) fail(code);
    try {
      temporary.encoding = "UTF-8";
      temporary.write(text);
    } finally {
      temporary.close();
    }
    try {
      temporary.refresh();
      file.refresh();
      if (!temporary.exists || Number(temporary.length) !== text.length || file.exists) fail(code);
      if (!temporary.rename(file.name)) fail(code);
      file.refresh();
      temporary = new File(temporaryPath);
      temporary.refresh();
      if (!file.exists || temporary.exists || Number(file.length) !== text.length) fail(code);
    } finally {
      temporary = new File(temporaryPath);
      temporary.refresh();
      if (temporary.exists) temporary.remove();
    }
  }

  function validateRequest(value) {
    exactKeys(value, ["schemaVersion", "plan", "paths"], "REQUEST_FIELDS_INVALID");
    exactKeys(value.paths, ["checkpoint", "checkpointPublication", "approval", "result", "output"], "REQUEST_PATH_FIELDS_INVALID");
    if (value.schemaVersion !== REQUEST_SCHEMA
        || !value.plan
        || value.plan.schemaVersion !== PLAN_SCHEMA
        || value.plan.mode !== "runtime_discriminator_planned"
        || value.plan.phase !== "planned"
        || !value.plan.authorityContext
        || (value.plan.authorityContext.kind !== "discriminator_only"
          && value.plan.authorityContext.kind !== "f2_bake")
        || value.paths.checkpoint !== CHECKPOINT_RELATIVE_PATH
        || value.paths.checkpointPublication !== "checkpoint/publication.json"
        || value.paths.approval !== "control/approval.json"
        || value.paths.result !== "result/result.json"
        || value.paths.output !== "output/frame-0000.png"
        || value.plan.fixture.kind !== "scratch_only_2d_rgba"
        || value.plan.fixture.width !== 4
        || value.plan.fixture.height !== 4
        || value.plan.fixture.fps !== 1
        || value.plan.fixture.frameCount !== 1
        || value.plan.fixture.alphaMode !== "straight"
        || value.plan.fixture.outputRelativePath !== value.paths.output
        || value.plan.authorityClaims.runtimeDiscriminatorOnly !== true
        || value.plan.authorityClaims.actualAeBakeAuthorityMinted !== false
        || value.plan.authorityClaims.packageAuthorityMinted !== false
        || value.plan.authorityClaims.adapterAuthorityMinted !== false) fail("REQUEST_INVALID");
    return value;
  }

  function createFixture(plan) {
    var solid;
    var masks;
    var mask;
    var shape;
    var effects;
    var fill;
    if (app.project && app.project.numItems > 0) fail("EXISTING_PROJECT_FORBIDDEN");
    if (!app.project) app.newProject();
    projectCreated = true;
    fixtureComp = app.project.items.addComp(
      plan.fixture.compositionName,
      plan.fixture.width,
      plan.fixture.height,
      1,
      plan.fixture.frameCount / plan.fixture.fps,
      plan.fixture.fps
    );
    solid = fixtureComp.layers.addSolid([1, 0, 0], plan.fixture.marker, 2, 2, 1, 1);
    solid.property("ADBE Transform Group").property("ADBE Position").setValue([2, 2]);
    solid.property("ADBE Transform Group").property("ADBE Opacity").expression = "value";
    masks = solid.property("ADBE Mask Parade");
    mask = masks.addProperty("ADBE Mask Atom");
    mask.maskMode = MaskMode.ADD;
    shape = new Shape();
    shape.vertices = [[0, 0], [2, 0], [2, 2], [0, 2]];
    shape.inTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
    shape.outTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
    shape.closed = true;
    mask.property("ADBE Mask Shape").setValue(shape);
    effects = solid.property("ADBE Effect Parade");
    fill = effects.addProperty("ADBE Fill");
    if (!fill) fail("FIXTURE_EFFECT_CREATE_FAILED");
    return fixtureComp;
  }

  function inspectExpressions(property, facts) {
    var index;
    if (!property) return;
    if (property.canSetExpression && property.expressionEnabled) facts.expressionCount += 1;
    if (property.numProperties) {
      for (index = 1; index <= property.numProperties; index += 1) inspectExpressions(property.property(index), facts);
    }
  }

  function scanFixture(comp) {
    var facts = {
      twoDOnly: true,
      effectMatchNames: [],
      maskModes: [],
      expressionCount: 0,
      audio: false,
      threeD: false,
      camera: false,
      thirdPartyPlugins: false
    };
    var layer;
    var effects;
    var masks;
    var index;
    var effect;
    for (index = 1; index <= comp.numLayers; index += 1) {
      layer = comp.layer(index);
      if (layer.threeDLayer === true || layer instanceof CameraLayer || layer instanceof LightLayer) fail("FIXTURE_3D_FORBIDDEN");
      effects = layer.property("ADBE Effect Parade");
      if (effects) {
        for (effect = 1; effect <= effects.numProperties; effect += 1) {
          if (String(effects.property(effect).matchName).indexOf("ADBE ") !== 0) fail("FIXTURE_PLUGIN_FORBIDDEN");
          facts.effectMatchNames.push(String(effects.property(effect).matchName));
        }
      }
      masks = layer.property("ADBE Mask Parade");
      if (masks) {
        for (effect = 1; effect <= masks.numProperties; effect += 1) {
          if (masks.property(effect).maskMode !== MaskMode.ADD) fail("FIXTURE_MASK_FORBIDDEN");
          facts.maskModes.push("add");
        }
      }
      inspectExpressions(layer, facts);
    }
    facts.effectMatchNames.sort();
    facts.maskModes.sort();
    return facts;
  }

  function validateApproval(approval, plan, publication) {
    var now = new Date().getTime();
    var expectedKeys = [
      "schemaVersion", "taskId", "executionId", "planHash", "phase", "token", "tokenSha256",
      "issuedAtMs", "expiresAtMs", "process", "checkpoint", "checkpointPublication", "jsxSha256",
      "composition", "marker", "budgets", "approvalHash"
    ];
    exactKeys(approval, expectedKeys, "APPROVAL_FIELDS_INVALID");
    exactKeys(approval.process, [
      "pid", "startIdentity", "executablePath", "executableSha256", "bundleId", "version", "build",
      "teamId", "cdHash", "codeResourcesSha256"
    ], "APPROVAL_PROCESS_FIELDS_INVALID");
    exactKeys(approval.checkpoint, [
      "relativePath", "sha256", "byteCount", "device", "inode", "linkCount", "identityDigest"
    ], "APPROVAL_CHECKPOINT_FIELDS_INVALID");
    exactKeys(approval.checkpointPublication, [
      "relativePath", "sha256", "byteCount", "device", "inode", "linkCount", "identityDigest"
    ], "APPROVAL_PUBLICATION_FIELDS_INVALID");
    exactKeys(approval.composition, ["id", "name"], "APPROVAL_COMPOSITION_FIELDS_INVALID");
    if (approval.schemaVersion !== APPROVAL_SCHEMA
        || approval.phase !== "checkpoint_approved"
        || approval.taskId !== plan.taskId
        || approval.executionId !== plan.executionId
        || approval.planHash !== plan.planHash
        || approval.tokenSha256 !== plan.approvalTokenSha256
        || sha256(approval.token) !== plan.approvalTokenSha256
        || approval.issuedAtMs < plan.createdAtMs
        || approval.issuedAtMs > now
        || approval.expiresAtMs !== Math.min(plan.expiresAtMs, plan.createdAtMs + plan.budgets.approvalWaitMs)
        || now > approval.expiresAtMs
        || approval.jsxSha256 !== plan.jsx.sha256
        || approval.marker !== plan.fixture.marker
        || String(approval.composition.id) !== String(publication.composition.id)
        || approval.composition.name !== publication.composition.name
        || approval.checkpoint.relativePath !== CHECKPOINT_RELATIVE_PATH
        || approval.checkpoint.linkCount !== 1
        || approval.checkpointPublication.relativePath !== "checkpoint/publication.json"
        || approval.checkpointPublication.linkCount !== 1
        || canonicalJson(approval.budgets) !== canonicalJson(plan.budgets)
        || approval.approvalHash !== sha256(canonicalJson(removeField(approval, "approvalHash")))) fail("APPROVAL_INVALID");
    return approval;
  }

  function removeField(value, field) {
    var output = {};
    var key;
    for (key in value) {
      if (value.hasOwnProperty(key) && key !== field) output[key] = value[key];
    }
    return output;
  }

  function waitForApproval(file, plan, publication) {
    var now;
    var approval;
    var approvalDeadline = Math.min(plan.expiresAtMs, plan.createdAtMs + plan.budgets.approvalWaitMs);
    while (true) {
      now = new Date().getTime();
      if (now > approvalDeadline) fail("APPROVAL_WAIT_TIMEOUT");
      file.refresh();
      if (file.exists) {
        approval = readJsonBounded(file, plan.budgets.maxExchangeBytes, "APPROVAL_READ_FAILED");
        if (!file.remove()) fail("APPROVAL_CONSUME_FAILED");
        return validateApproval(approval, plan, publication);
      }
      $.sleep(25);
    }
  }

  function renderFixture(plan, approval, facts, outputFile) {
    var outputModule;
    var result;
    renderItem = app.project.renderQueue.items.add(fixtureComp);
    renderItem.timeSpanStart = 0;
    renderItem.timeSpanDuration = 1 / plan.fixture.fps;
    outputModule = renderItem.outputModule(1);
    outputModule.applyTemplate(OUTPUT_TEMPLATE);
    outputModule.file = new File(outputFile.parent.fsName + "/frame-[####].png");
    app.project.renderQueue.render();
    outputFile.refresh();
    if (renderItem.status !== RQItemStatus.DONE || !outputFile.exists || Number(outputFile.length) <= 0) {
      fail("RENDER_OUTPUT_MISSING");
    }
    result = {
      schemaVersion: RESULT_SCHEMA,
      taskId: plan.taskId,
      executionId: plan.executionId,
      planHash: plan.planHash,
      phase: "transaction_completed",
      tokenSha256: approval.tokenSha256,
      process: { pid: approval.process.pid, startIdentity: approval.process.startIdentity },
      marker: plan.fixture.marker,
      authorityContext: plan.authorityContext,
      composition: { id: String(fixtureComp.id), name: fixtureComp.name },
      scanFacts: facts,
      renderQueue: {
        itemId: plan.fixture.marker + "-rq-" + String(renderItem.index),
        rqindex: renderItem.index,
        outputModuleTemplate: OUTPUT_TEMPLATE,
        renderStatus: "done"
      },
      output: { files: [{
        relativePath: plan.fixture.outputRelativePath,
        frameIndex: plan.authorityContext.kind === "f2_bake"
          ? plan.authorityContext.frame.frameIndex
          : 0
      }] },
      rollback: {
        renderQueueItemRemoved: true,
        temporaryItemsRemoved: true,
        projectClosedWithoutSave: true
      },
      continuation: {
        appOpenCountAfterCheckpoint: appOpenCountAfterCheckpoint,
        approvalConsumedOnce: true,
        closeRequested: true
      },
      unexpectedResidue: []
    };
    renderItem.remove();
    renderItem = null;
    fixtureComp.remove();
    fixtureComp = null;
    app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    projectCreated = false;
    return withHash(result, "resultHash");
  }

  function cleanupFailure() {
    try {
      if (renderItem) renderItem.remove();
    } catch (ignoredRenderItem) {}
    try {
      if (fixtureComp) fixtureComp.remove();
    } catch (ignoredComp) {}
    try {
      if (app.project) app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    } catch (ignoredProject) {}
    try {
      if (requestFile && requestFile.exists) requestFile.remove();
    } catch (ignoredRequest) {}
    try {
      if (approvalFile && approvalFile.exists) approvalFile.remove();
    } catch (ignoredApproval) {}
    try {
      if (partialOutputFile && partialOutputFile.exists) partialOutputFile.remove();
    } catch (ignoredOutput) {}
    projectCreated = false;
  }

  function run() {
    var requestPath = $.getenv(REQUEST_ENV);
    var request;
    var plan;
    var runRoot;
    var checkpointFile;
    var publicationFile;
    var resultFile;
    var publication;
    var approval;
    var facts;
    var result;
    if (!requestPath) return;
    requestFile = new File(requestPath);
    request = validateRequest(readJsonBounded(requestFile, 65536, "REQUEST_READ_FAILED"));
    plan = request.plan;
    runRoot = requestFile.parent.parent.fsName;
    checkpointFile = resolveTaskFile(runRoot, request.paths.checkpoint);
    publicationFile = resolveTaskFile(runRoot, request.paths.checkpointPublication);
    approvalFile = resolveTaskFile(runRoot, request.paths.approval);
    resultFile = resolveTaskFile(runRoot, request.paths.result);
    partialOutputFile = resolveTaskFile(runRoot, request.paths.output);
    if (checkpointFile.exists || publicationFile.exists || approvalFile.exists
        || resultFile.exists || partialOutputFile.exists) fail("TASK_DESTINATION_EXISTS");
    if (!requestFile.remove()) fail("REQUEST_CONSUME_FAILED");
    createFixture(plan);
    app.project.save(checkpointFile);
    checkpointFile.refresh();
    if (!checkpointFile.exists || Number(checkpointFile.length) <= 0 || !app.project.file
        || app.project.file.fsName !== checkpointFile.fsName) fail("CHECKPOINT_SAVE_FAILED");
    publication = withHash({
      schemaVersion: CHECKPOINT_SCHEMA,
      taskId: plan.taskId,
      executionId: plan.executionId,
      planHash: plan.planHash,
      phase: "checkpoint_published",
      marker: plan.fixture.marker,
      composition: { id: String(fixtureComp.id), name: fixtureComp.name },
      checkpointRelativePath: CHECKPOINT_RELATIVE_PATH,
      checkpointSaveCompleted: true,
      appOpenCountAfterCheckpoint: appOpenCountAfterCheckpoint,
      authorityContext: plan.authorityContext
    }, "publicationHash");
    writeJsonOnce(publicationFile, publication, plan.budgets.maxExchangeBytes, "CHECKPOINT_PUBLICATION_FAILED");
    approval = waitForApproval(approvalFile, plan, publication);
    facts = scanFixture(fixtureComp);
    result = renderFixture(plan, approval, facts, partialOutputFile);
    writeJsonOnce(resultFile, result, plan.budgets.maxExchangeBytes, "RESULT_PUBLICATION_FAILED");
  }

  try {
    run();
  } catch (error) {
    var safeErrorCode = String(error && error.message ? error.message : "UNKNOWN");
    cleanupFailure();
    if (!/^[A-Z0-9_]+$/.test(safeErrorCode)) safeErrorCode = "HOST_ERROR";
    $.writeln("AEB_RETAINED_AE_DISCRIMINATOR_FAILED:" + safeErrorCode);
  } finally {
    if (projectCreated) cleanupFailure();
    if ($.getenv(REQUEST_ENV)) app.quit();
  }

  root.$ = root.$ || {};
  root.$._autoSvgaAebRetainedAeDiscriminator = {
    requestSchema: REQUEST_SCHEMA,
    planSchema: PLAN_SCHEMA,
    checkpointSchema: CHECKPOINT_SCHEMA,
    approvalSchema: APPROVAL_SCHEMA,
    resultSchema: RESULT_SCHEMA,
    appOpenCountAfterCheckpoint: appOpenCountAfterCheckpoint
  };
}(this));
