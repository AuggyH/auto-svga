/*
  Auto SVGA AEB development panel action.

  Scope:
  - Reads active composition metadata.
  - Writes one redacted ae-export-package JSON into the operator-provided
    output folder.
  - Does not save, render, bake, relink, collect, install, call network, or
    claim target support.
*/

function aebParseJsonText(text) {
  var source;
  var index;

  source = String(text);
  index = 0;

  function fail() {
    throw new Error("AEB strict JSON parser rejected input.");
  }

  function skipWhitespace() {
    while (index < source.length && /[\t\n\r ]/.test(source.charAt(index))) index += 1;
  }

  function readLiteral(literal, value) {
    if (source.substr(index, literal.length) !== literal) fail();
    index += literal.length;
    return value;
  }

  function readString() {
    var result = "";
    var ch;
    var escaped;
    var hex;
    if (source.charAt(index) !== "\"") fail();
    index += 1;
    while (index < source.length) {
      ch = source.charAt(index);
      index += 1;
      if (ch === "\"") return result;
      if (ch === "\\") {
        if (index >= source.length) fail();
        escaped = source.charAt(index);
        index += 1;
        if (escaped === "\"" || escaped === "\\" || escaped === "/") result += escaped;
        else if (escaped === "b") result += "\b";
        else if (escaped === "f") result += "\f";
        else if (escaped === "n") result += "\n";
        else if (escaped === "r") result += "\r";
        else if (escaped === "t") result += "\t";
        else if (escaped === "u") {
          hex = source.substr(index, 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
          result += String.fromCharCode(parseInt(hex, 16));
          index += 4;
        } else fail();
      } else {
        if (ch < " ") fail();
        result += ch;
      }
    }
    fail();
  }

  function readNumber() {
    var start = index;
    var value;
    if (source.charAt(index) === "-") index += 1;
    if (source.charAt(index) === "0") index += 1;
    else {
      if (!/[1-9]/.test(source.charAt(index))) fail();
      while (/[0-9]/.test(source.charAt(index))) index += 1;
    }
    if (source.charAt(index) === ".") {
      index += 1;
      if (!/[0-9]/.test(source.charAt(index))) fail();
      while (/[0-9]/.test(source.charAt(index))) index += 1;
    }
    if (source.charAt(index) === "e" || source.charAt(index) === "E") {
      index += 1;
      if (source.charAt(index) === "+" || source.charAt(index) === "-") index += 1;
      if (!/[0-9]/.test(source.charAt(index))) fail();
      while (/[0-9]/.test(source.charAt(index))) index += 1;
    }
    value = Number(source.substring(start, index));
    if (!isFinite(value)) fail();
    return value;
  }

  function readArray() {
    var result = [];
    if (source.charAt(index) !== "[") fail();
    index += 1;
    skipWhitespace();
    if (source.charAt(index) === "]") {
      index += 1;
      return result;
    }
    while (index < source.length) {
      result.push(readValue());
      skipWhitespace();
      if (source.charAt(index) === "]") {
        index += 1;
        return result;
      }
      if (source.charAt(index) !== ",") fail();
      index += 1;
      skipWhitespace();
    }
    fail();
  }

  function readObject() {
    var result = {};
    var key;
    var keyIndex;
    var seenKeys = [];
    if (source.charAt(index) !== "{") fail();
    index += 1;
    skipWhitespace();
    if (source.charAt(index) === "}") {
      index += 1;
      return result;
    }
    while (index < source.length) {
      key = readString();
      if (key === "__proto__" || key === "constructor" || key === "prototype") fail();
      for (keyIndex = 0; keyIndex < seenKeys.length; keyIndex += 1) {
        if (seenKeys[keyIndex] === key) fail();
      }
      seenKeys.push(key);
      skipWhitespace();
      if (source.charAt(index) !== ":") fail();
      index += 1;
      result[key] = readValue();
      skipWhitespace();
      if (source.charAt(index) === "}") {
        index += 1;
        return result;
      }
      if (source.charAt(index) !== ",") fail();
      index += 1;
      skipWhitespace();
    }
    fail();
  }

  function readValue() {
    var ch;
    skipWhitespace();
    ch = source.charAt(index);
    if (ch === "\"") return readString();
    if (ch === "{") return readObject();
    if (ch === "[") return readArray();
    if (ch === "t") return readLiteral("true", true);
    if (ch === "f") return readLiteral("false", false);
    if (ch === "n") return readLiteral("null", null);
    if (ch === "-" || /[0-9]/.test(ch)) return readNumber();
    fail();
  }

  var value = readValue();
  skipWhitespace();
  if (index !== source.length) fail();
  return value;
}

function aebExportToAutoSvga(configText, explicitComp) {
  var AEB_PANEL_SCRIPT_VERSION = "aeb-panel-dev-export-action-v0";

  function escapeJsonString(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, "\\\"")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t");
  }

  function toJson(value) {
    var i;
    var parts;
    if (value === null) return "null";
    if (typeof value === "number") return isFinite(value) ? String(value) : "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string") return "\"" + escapeJsonString(value) + "\"";
    if (value instanceof Array) {
      parts = [];
      for (i = 0; i < value.length; i += 1) parts.push(toJson(value[i]));
      return "[" + parts.join(",") + "]";
    }
    parts = [];
    for (i in value) {
      if (value.hasOwnProperty(i) && typeof value[i] !== "undefined") {
        parts.push("\"" + escapeJsonString(i) + "\":" + toJson(value[i]));
      }
    }
    return "{" + parts.join(",") + "}";
  }

  function parseConfig(text) {
    return aebParseJsonText(text);
  }

  function assertConfigField(config, fieldName, expectedValue) {
    if (config[fieldName] !== expectedValue) {
      throw new Error(
        "AEB panel refuses unsupported milestone config: " +
        fieldName +
        " must be " +
        String(expectedValue) +
        "."
      );
    }
  }

  function validateMilestoneConfig(config) {
    if (!config || config.action !== "export_to_auto_svga") {
      throw new Error("AEB panel received an unsupported action.");
    }
    assertConfigField(config, "executionState", "not_executed");
    assertConfigField(config, "selectedTargetFormat", "svga");
    assertConfigField(config, "sourceCopyRequired", true);
    assertConfigField(config, "sourceMutationAllowed", false);
    assertConfigField(config, "renderOrBakeAllowed", false);
    assertConfigField(config, "encoderAllowed", false);
    assertConfigField(config, "targetSupportClaimAllowed", false);
    assertConfigField(config, "visualOrExportSuccessClaimAllowed", false);
  }

  function padNumber(value, width) {
    var text = String(value);
    while (text.length < width) text = "0" + text;
    return text;
  }

  function makeTimestamp() {
    var now = new Date();
    return [
      now.getFullYear(),
      padNumber(now.getMonth() + 1, 2),
      padNumber(now.getDate(), 2),
      "T",
      padNumber(now.getHours(), 2),
      padNumber(now.getMinutes(), 2),
      padNumber(now.getSeconds(), 2)
    ].join("");
  }

  function getPropertyByMatchName(group, matchName) {
    if (!group) return null;
    try {
      return group.property(matchName);
    } catch (err) {
      return null;
    }
  }

  function propertyHasKeys(property) {
    try {
      return property && property.numKeys && property.numKeys > 0;
    } catch (err) {
      return false;
    }
  }

  function propertyHasExpression(property) {
    try {
      return property && property.canSetExpression && property.expressionEnabled === true;
    } catch (err) {
      return false;
    }
  }

  function inferLayerType(layer) {
    try {
      if (layer.nullLayer) return "null";
      if (layer.threeDLayer === true) return "3d";
      if (layer.matchName === "ADBE Text Layer") return "text";
      if (layer.matchName === "ADBE Vector Layer") return "shape";
      if (layer.matchName === "ADBE Camera Layer") return "camera";
      if (layer.matchName === "ADBE Light Layer") return "light";
      if (layer.source) {
        if (layer.source instanceof CompItem) return "precomp";
        if (layer.source.hasVideo === false && layer.source.hasAudio === true) return "audio";
        return "footage";
      }
    } catch (err) {
      return "unknown";
    }
    return "unknown";
  }

  function countGroupProperties(group) {
    try {
      return group ? group.numProperties : 0;
    } catch (err) {
      return 0;
    }
  }

  function collectTransformFacts(layer) {
    var transform = getPropertyByMatchName(layer, "ADBE Transform Group");
    var fields = [];
    var keyed = [];
    var expressed = [];
    var candidates = [
      ["anchor", "ADBE Anchor Point"],
      ["position", "ADBE Position"],
      ["scale", "ADBE Scale"],
      ["rotation", "ADBE Rotate Z"],
      ["opacity", "ADBE Opacity"]
    ];
    var i;
    var property;
    for (i = 0; i < candidates.length; i += 1) {
      property = getPropertyByMatchName(transform, candidates[i][1]);
      if (property) {
        fields.push(candidates[i][0]);
        if (propertyHasKeys(property)) keyed.push(candidates[i][0]);
        if (propertyHasExpression(property)) expressed.push(candidates[i][0]);
      }
    }
    return {
      transformFieldsPresent: fields,
      keyedTransformFields: keyed,
      expressedTransformFields: expressed,
      expressionTextCollected: false
    };
  }

  function collectLayer(layer, index) {
    var layerId = "layer-" + padNumber(index, 4);
    var effects = getPropertyByMatchName(layer, "ADBE Effect Parade");
    var masks = getPropertyByMatchName(layer, "ADBE Mask Parade");
    var transformFacts = collectTransformFacts(layer);
    return {
      layerId: layerId,
      evidenceLevel: "aeb_panel_metadata_only",
      layerType: inferLayerType(layer),
      zOrder: index,
      enabled: layer.enabled === true,
      locked: layer.locked === true,
      shy: layer.shy === true,
      solo: layer.solo === true,
      threeDLayer: layer.threeDLayer === true,
      hasAudio: layer.hasAudio === true,
      audioEnabled: layer.audioEnabled === true,
      inPoint: layer.inPoint,
      outPoint: layer.outPoint,
      startTime: layer.startTime,
      stretch: layer.stretch,
      effectCount: countGroupProperties(effects),
      maskCount: countGroupProperties(masks),
      sourceAssetId: null,
      transformFieldsPresent: transformFacts.transformFieldsPresent,
      keyedTransformFields: transformFacts.keyedTransformFields,
      expressedTransformFields: transformFacts.expressedTransformFields,
      expressionTextCollected: false,
      rawLayerNameCollected: false
    };
  }

  function collectComp(comp) {
    var layers = [];
    var i;
    for (i = 1; i <= comp.numLayers; i += 1) {
      layers.push(collectLayer(comp.layer(i), i));
    }
    return {
      composition: {
        compositionId: "comp-active-0001",
        evidenceLevel: "aeb_panel_metadata_only",
        width: comp.width,
        height: comp.height,
        fps: comp.frameRate,
        durationFrames: Math.round(comp.duration * comp.frameRate),
        durationSeconds: comp.duration,
        layerCount: comp.numLayers,
        hasAlpha: true,
        rawCompNameCollected: false
      },
      layers: layers
    };
  }

  function makeOutputProfiles() {
    return [
      {
        targetFormat: "svga",
        priority: 1,
        targetFamily: "semantic_layers",
        supportStance: "active_schema_candidate",
        supportClaim: false
      },
      {
        targetFormat: "vap",
        priority: 2,
        targetFamily: "encoded_video",
        supportStance: "future_schema_candidate",
        supportClaim: false
      }
    ];
  }

  function sourceSafety() {
    return {
      forbiddenActions: {
        rendered: false,
        baked: false,
        collectedFiles: false,
        relinkedFootage: false,
        ranAeScript: true,
        installedPlugin: false,
        wroteImporterOutput: false,
        wroteEncoderOutput: false,
        acceptedThirdPartyUpdate: false
      }
    };
  }

  function buildPackage(comp) {
    var timestamp = makeTimestamp();
    var compFacts = collectComp(comp);
    return {
      schemaVersion: "aeb-wp2-script-output-v0",
      aeExportPackage: {
        packageIdentity: {
          packageId: "aeb-panel-runtime-active-comp",
          schemaVersion: "ae-export-package-wp1-draft",
          createdBy: "wp2_thin_script_prototype",
          createdAt: timestamp,
          bridgeScriptVersion: AEB_PANEL_SCRIPT_VERSION
        },
        redaction: {
          mode: "selector_only",
          absolutePathsAllowed: false,
          memberNamesAllowed: false,
          rawProductionMediaAllowed: false,
          externalVolumePathsAllowed: false
        },
        commonSource: {
          sourceSafety: sourceSafety(),
          environment: {
            evidenceLevel: "aeb_panel_metadata_only",
            os: { family: $.os, version: "runtime_redacted" },
            afterEffects: { majorVersion: app.version, language: $.locale },
            permissions: { scriptAccessObserved: true, reportOutputAllowed: true }
          },
          project: {
            sampleId: "runtime-active-comp-redacted",
            projectSelector: "Runtime/OperatorSelectedCopiedFolder",
            projectFile: app.project && app.project.file ? "redacted_project_file.aep" : "unsaved_project",
            activeComp: "Comp/active-redacted",
            renderQueue: { status: "not_executed" },
            evidenceLevel: "aeb_panel_metadata_only"
          },
          assets: [],
          features: []
        },
        semanticGraph: null,
        renderPlan: null,
        replaceableSlots: [],
        outputProfiles: makeOutputProfiles(),
        s3Report: {
          reportVersion: "aeb-panel-metadata-v0",
          reportCreatedAt: timestamp,
          sampleId: "runtime-active-comp-redacted",
          scanMode: "S3",
          scanStatus: "completed_metadata_only",
          evidenceLevel: "aeb_panel_metadata_only",
          sourceSelector: "Runtime/OperatorSelectedCopiedFolder",
          reportSelector: "Runtime/OperatorSelectedOutputFolder/ae-export-package.json",
          redaction: {
            mode: "selector_only",
            absolutePathsAllowed: false,
            memberNamesAllowed: false,
            rawProductionMediaAllowed: false
          },
          sourceSafety: sourceSafety(),
          environment: {
            evidenceLevel: "aeb_panel_metadata_only",
            osFamily: $.os,
            aeMajorVersion: app.version,
            pathLocale: $.locale
          },
          project: {
            evidenceLevel: "aeb_panel_metadata_only",
            projectSelector: "Runtime/OperatorSelectedCopiedFolder",
            projectOpenConfirmed: true,
            status: "completed_metadata_only"
          },
          composition: compFacts.composition,
          compositions: [compFacts.composition],
          layers: compFacts.layers,
          assets: [],
          features: [],
          renderQueue: { status: "not_executed" },
          limitations: [
            "panel_metadata_only",
            "no_assets_copied_by_panel_action",
            "target_support_is_not_claimed"
          ]
        },
        reports: [
          {
            reportId: "aeb-panel-boundary",
            severity: "warning",
            message: "Panel action is metadata-only until real pilot evidence proves copied-source safety."
          }
        ],
        hashBinding: {
          reportDigest: "runtime_digest_written_by_host_after_file_write"
        }
      }
    };
  }

  function writePackage(outputFolder, payload) {
    var folder = new Folder(outputFolder);
    var file;
    if (!folder.exists) folder.create();
    file = new File(folder.fsName + "/ae-export-package.json");
    file.encoding = "UTF-8";
    file.open("w");
    file.write(toJson(payload));
    file.close();
    return "AEB package written: ae-export-package.json";
  }

  var config = parseConfig(configText);
  var comp;
  validateMilestoneConfig(config);
  if (!app.project) throw new Error("AEB panel found no open project.");
  comp = explicitComp || app.project.activeItem;
  if (!(comp instanceof CompItem)) throw new Error("AEB panel requires an active composition.");
  return writePackage(config.outputFolder, buildPackage(comp));
}

function aebPrepareScratchForAutoSvga(configText, runtimeState) {
  var AEB_PANEL_SCRATCH_VERSION = "aeb-panel-dev-scratch-setup-action-v0";

  function escapeJsonString(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, "\\\"")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t");
  }

  function toJson(value) {
    var i;
    var parts;
    if (value === null) return "null";
    if (typeof value === "number") return isFinite(value) ? String(value) : "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string") return "\"" + escapeJsonString(value) + "\"";
    if (value instanceof Array) {
      parts = [];
      for (i = 0; i < value.length; i += 1) parts.push(toJson(value[i]));
      return "[" + parts.join(",") + "]";
    }
    parts = [];
    for (i in value) {
      if (value.hasOwnProperty(i) && typeof value[i] !== "undefined") {
        parts.push("\"" + escapeJsonString(i) + "\":" + toJson(value[i]));
      }
    }
    return "{" + parts.join(",") + "}";
  }

  function parseConfig(text) {
    return aebParseJsonText(text);
  }

  function assertConfigField(config, fieldName, expectedValue) {
    if (config[fieldName] !== expectedValue) {
      throw new Error(
        "AEB panel refuses unsupported scratch config: " +
        fieldName +
        " must be " +
        String(expectedValue) +
        "."
      );
    }
  }

  function assertScratchDimension(config, fieldName, expectedValue) {
    if (!config.scratchComp || config.scratchComp[fieldName] !== expectedValue) {
      throw new Error(
        "AEB panel refuses unsupported scratch config: scratchComp." +
        fieldName +
        " must be " +
        String(expectedValue) +
        "."
      );
    }
  }

  function normalizePathText(value) {
    return String(value || "")
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/");
  }

  function lowerPathText(value) {
    return normalizePathText(value).toLowerCase();
  }

  function pathStartsWithAny(value, prefixes) {
    var i;
    var normalized = normalizePathText(value);
    for (i = 0; i < prefixes.length; i += 1) {
      if (normalized.indexOf(prefixes[i]) === 0) return true;
    }
    return false;
  }

  function isAebTaskOwnedPilotReportsFolder(markerFolder) {
    var normalized = normalizePathText(markerFolder);
    var allowedPrefixes = [
      "/private/tmp/auto-svga-aeb-real-cep/",
      "/private/tmp/auto-svga-aeb-dev/",
      "/tmp/auto-svga-aeb-real-cep/",
      "/tmp/auto-svga-aeb-dev/"
    ];
    return pathStartsWithAny(normalized, allowedPrefixes) && /\/reports\/?$/.test(normalized);
  }

  function isInstallLikePath(markerFolder) {
    var normalized = lowerPathText(markerFolder);
    return (
      normalized.indexOf("/library/application support/adobe/cep/extensions") !== -1 ||
      normalized.indexOf("/adobe/cep/extensions") !== -1 ||
      normalized.indexOf("/adobe after effects") !== -1 ||
      normalized.indexOf("/scripts/scriptui panels") !== -1 ||
      normalized.indexOf("/scriptui panels") !== -1 ||
      normalized.indexOf("/plug-ins") !== -1 ||
      normalized.indexOf("/plugins") !== -1
    );
  }

  function isForbiddenUserOrSystemPath(markerFolder) {
    var normalized = lowerPathText(markerFolder);
    return (
      normalized.indexOf("..") !== -1 ||
      normalized.indexOf("\u0000") !== -1 ||
      normalized.indexOf("file://") === 0 ||
      normalized.indexOf("~/") === 0 ||
      normalized.indexOf("/users/") === 0 ||
      normalized.indexOf("/volumes/") === 0 ||
      normalized.indexOf("/applications/") === 0 ||
      normalized.indexOf("/library/") === 0 ||
      normalized.indexOf("/system/") === 0 ||
      normalized.indexOf("/documents/") !== -1 ||
      normalized.indexOf("/desktop/") !== -1 ||
      normalized.indexOf("/downloads/") !== -1
    );
  }

  function validateMarkerFolderPolicy(markerFolder) {
    if (
      !isAebTaskOwnedPilotReportsFolder(markerFolder) ||
      isInstallLikePath(markerFolder) ||
      isForbiddenUserOrSystemPath(markerFolder)
    ) {
      throw new Error("AEB panel scratch setup refuses unsafe markerFolder path.");
    }
  }

  function validateScratchConfig(config) {
    if (!config || config.action !== "prepare_panel_owned_scratch") {
      throw new Error("AEB panel received an unsupported scratch action.");
    }
    assertConfigField(config, "schemaVersion", AEB_PANEL_SCRATCH_VERSION);
    assertConfigField(config, "executionState", "not_executed");
    assertConfigField(config, "scratchProjectCreationAllowed", true);
    assertConfigField(config, "fileBackedProjectAllowed", false);
    assertConfigField(config, "nonEmptyProjectAllowed", false);
    assertConfigField(config, "productionProjectAllowed", false);
    assertConfigField(config, "sourceProjectMutationAllowed", false);
    assertConfigField(config, "saveOrOverwriteAllowed", false);
    assertConfigField(config, "renderOrBakeAllowed", false);
    assertConfigField(config, "relinkOrCollectAllowed", false);
    assertConfigField(config, "encoderAllowed", false);
    assertConfigField(config, "targetSupportClaimAllowed", false);
    assertConfigField(config, "visualOrExportSuccessClaimAllowed", false);
    assertScratchDimension(config, "width", 256);
    assertScratchDimension(config, "height", 256);
    assertScratchDimension(config, "fps", 30);
    assertScratchDimension(config, "durationSeconds", 1);
    assertScratchDimension(config, "layerCount", 0);
    if (!config.markerFolder) throw new Error("AEB panel scratch setup requires a marker folder.");
    validateMarkerFolderPolicy(config.markerFolder);
  }

  function hasExistingProjectContent(project) {
    if (!project) return false;
    if (project.file) return true;
    if (project.numItems && project.numItems > 0) return true;
    if (project.activeItem) return true;
    return false;
  }

  function ensureScratchProject(config) {
    var project;
    var comp;
    if (hasExistingProjectContent(app.project)) {
      throw new Error("AEB panel scratch setup refuses file-backed, non-empty, or ambiguous projects.");
    }
    if (!app.project) app.newProject();
    project = app.project;
    if (!project || !project.items || !project.items.addComp) {
      throw new Error("AEB panel scratch setup could not access an empty project.");
    }
    comp = project.items.addComp(
      "AEB_panel_owned_scratch",
      config.scratchComp.width,
      config.scratchComp.height,
      1,
      config.scratchComp.durationSeconds,
      config.scratchComp.fps
    );
    if (!(comp instanceof CompItem)) {
      throw new Error("AEB panel scratch setup failed to create a composition.");
    }
    if (comp.numLayers !== 0) {
      throw new Error("AEB panel scratch setup created a non-empty composition.");
    }
    return comp;
  }

  function writeScratchMarker(markerFolder, comp) {
    var folder = new Folder(markerFolder);
    var file;
    var marker;
    if (!folder.exists) folder.create();
    file = new File(folder.fsName + "/scratch-setup-marker.json");
    marker = {
      schemaVersion: "aeb-panel-owned-scratch-marker-v0",
      status: "pass",
      action: "prepare_panel_owned_scratch",
      executionState: "not_executed",
      evidenceLevel: "panel_owned_scratch_metadata_only",
      scratch: {
        projectFileBacked: false,
        compSelector: "AEB_panel_owned_scratch_redacted",
        width: comp.width,
        height: comp.height,
        fps: comp.frameRate,
        durationSeconds: comp.duration,
        layerCount: comp.numLayers
      },
      boundaries: {
        sourceProjectMutationExecuted: false,
        scratchProjectCreated: true,
        renderOrBakeExecuted: false,
        relinkOrCollectExecuted: false,
        saveOrOverwriteExecuted: false,
        encoderExecuted: false,
        targetSupportClaimAllowed: false,
        visualOrExportSuccessClaimAllowed: false
      },
      redaction: {
        absolutePathsAllowed: false,
        memberNamesAllowed: false,
        rawProductionMediaAllowed: false
      }
    };
    file.encoding = "UTF-8";
    file.open("w");
    file.write(toJson(marker));
    file.close();
    return "AEB scratch prepared: scratch-setup-marker.json";
  }

  var config = parseConfig(configText);
  var comp;
  validateScratchConfig(config);
  comp = ensureScratchProject(config);
  if (runtimeState && typeof runtimeState === "object") runtimeState.createdComp = comp;
  return writeScratchMarker(config.markerFolder, comp);
}

function aebConsumeSemanticPilotRequest() {
  return aebConsumeSemanticPilotRequestForProfile("legacy");
}

function aebConsumeSemanticPilotRequestAe26() {
  return aebConsumeSemanticPilotRequestForProfile("ae26-isolated");
}

function aebConsumeSemanticPilotRequestForProfile(profileName) {
  var isLegacyProfile = profileName === "legacy";
  var isAe26IsolatedProfile = profileName === "ae26-isolated";
  var REQUEST_SCHEMA = "aeb-panel-semantic-request-v1";
  var LEGACY_ACTION = "prepare-scratch-and-export-metadata";
  var FIXTURE_ACTION = "prepare-task-owned-fixture-and-export-native-subset-metadata";
  var FIXTURE_PACKAGE_SCRIPT_VERSION = "aeb-panel-dev-export-action-v0";
  var RECEIPT_SCHEMA = "aeb-panel-semantic-execution-receipt-v1";
  var SOURCE_IDENTITY = "aeb-panel-semantic-execution-bridge-v0";
  var PANEL_BUNDLE_ID;
  var PANEL_EXTENSION_ID;
  var PANEL_VERSION = "0.3.0";
  var TARGET_HOST_APP_ID = "AEFT";
  var TARGET_HOST_VERSION_MAJOR = 26;
  var TARGET_HOST_VERSION_MINOR = 3;
  var TARGET_HOST_VERSION_RULE = "app.version.leading_major_minor";
  var INBOX_PATH;
  var REQUEST_PATH;
  var MAX_REQUEST_BYTES = 64 * 1024;
  var MAX_REQUEST_TTL_MS = 10 * 60 * 1000;
  var FUTURE_SKEW_MS = 5000;

  if (!isLegacyProfile && !isAe26IsolatedProfile) {
    throw new Error("AEB semantic request rejects unknown panel profile.");
  }
  PANEL_BUNDLE_ID = isLegacyProfile
    ? "local.auto-svga.aeb.panel.dev"
    : "local.auto-svga.aeb.panel.ae26.dev";
  PANEL_EXTENSION_ID = isLegacyProfile
    ? "local.auto-svga.aeb.panel.dev.export"
    : "local.auto-svga.aeb.panel.ae26.dev.export";
  INBOX_PATH = isLegacyProfile
    ? "/private/tmp/auto-svga-aeb-dev/semantic-inbox"
    : "/private/tmp/auto-svga-aeb-dev/semantic-inbox-ae26";
  REQUEST_PATH = INBOX_PATH + "/request.json";

  function escapeJsonString(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, "\\\"")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t");
  }

  function toJson(value) {
    var i;
    var parts;
    if (value === null) return "null";
    if (typeof value === "number") return isFinite(value) ? String(value) : "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string") return "\"" + escapeJsonString(value) + "\"";
    if (value instanceof Array) {
      parts = [];
      for (i = 0; i < value.length; i += 1) parts.push(toJson(value[i]));
      return "[" + parts.join(",") + "]";
    }
    parts = [];
    for (i in value) {
      if (value.hasOwnProperty(i) && typeof value[i] !== "undefined") {
        parts.push("\"" + escapeJsonString(i) + "\":" + toJson(value[i]));
      }
    }
    return "{" + parts.join(",") + "}";
  }

  function parseJson(text) {
    return aebParseJsonText(text);
  }

  function normalizePathText(value) {
    return String(value || "").replace(/\\/g, "/").replace(/\/+/g, "/");
  }

  function assertExact(value, expected, fieldName) {
    if (value !== expected) {
      throw new Error("AEB semantic request rejects " + fieldName + ".");
    }
  }

  function assertStringPattern(value, pattern, fieldName) {
    if (typeof value !== "string" || !pattern.test(value)) {
      throw new Error("AEB semantic request rejects " + fieldName + ".");
    }
  }

  function assertFiniteNumber(value, fieldName) {
    if (typeof value !== "number" || !isFinite(value)) {
      throw new Error("AEB semantic request rejects " + fieldName + ".");
    }
  }

  function assertExactNumber(value, expected, fieldName) {
    assertFiniteNumber(value, fieldName);
    if (value !== expected) {
      throw new Error("AEB semantic request rejects " + fieldName + ".");
    }
  }

  function assertFalseBoundary(request, fieldName) {
    if (!request.boundaries || request.boundaries[fieldName] !== false) {
      throw new Error("AEB semantic request requires " + fieldName + "=false.");
    }
  }

  function normalizeAeHostVersion(value) {
    var raw = String(value || "");
    var match = /^([0-9]+)\.([0-9]+)/.exec(raw);
    var major;
    var minor;
    if (!match) {
      return {
        appId: TARGET_HOST_APP_ID,
        versionMajor: null,
        versionMinor: null,
        versionNormalized: "",
        versionRule: TARGET_HOST_VERSION_RULE,
        ambiguous: true
      };
    }
    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);
    return {
      appId: TARGET_HOST_APP_ID,
      versionMajor: major,
      versionMinor: minor,
      versionNormalized: String(major) + "." + String(minor),
      versionRule: TARGET_HOST_VERSION_RULE,
      ambiguous: !isFinite(major) || !isFinite(minor)
    };
  }

  function getCurrentHostIdentity() {
    return normalizeAeHostVersion(app && app.version);
  }

  function validateTargetHostOrIdle(request) {
    var currentHost = getCurrentHostIdentity();
    if (!request || typeof request !== "object") {
      throw new Error("AEB semantic request must be an object.");
    }
    assertExact(request.schemaVersion, REQUEST_SCHEMA, "schemaVersion");
    if (!request.targetHost || typeof request.targetHost !== "object") {
      throw new Error("AEB semantic request requires targetHost.");
    }
    assertExactKeys(request.targetHost, [
      "appId",
      "versionMajor",
      "versionMinor",
      "versionRule"
    ], "targetHost");
    assertExact(request.targetHost.appId, TARGET_HOST_APP_ID, "targetHost.appId");
    assertExact(request.targetHost.versionRule, TARGET_HOST_VERSION_RULE, "targetHost.versionRule");
    if (
      typeof request.targetHost.versionMajor !== "number" ||
      typeof request.targetHost.versionMinor !== "number" ||
      !isFinite(request.targetHost.versionMajor) ||
      !isFinite(request.targetHost.versionMinor)
    ) {
      throw new Error("AEB semantic request rejects ambiguous targetHost.");
    }
    if (currentHost.ambiguous) {
      throw new Error("AEB semantic request rejects ambiguous current host.");
    }
    if (
      request.targetHost.versionMajor !== TARGET_HOST_VERSION_MAJOR ||
      request.targetHost.versionMinor !== TARGET_HOST_VERSION_MINOR
    ) {
      throw new Error("AEB semantic request rejects unsupported target host.");
    }
    if (
      currentHost.versionMajor !== request.targetHost.versionMajor ||
      currentHost.versionMinor !== request.targetHost.versionMinor
    ) {
      return { matches: false, hostIdentity: currentHost };
    }
    return { matches: true, hostIdentity: currentHost };
  }

  function assertExactKeys(value, expectedKeys, fieldName) {
    var i;
    var key;
    var count = 0;
    var known;
    if (!value || typeof value !== "object") {
      throw new Error("AEB semantic request requires " + fieldName + ".");
    }
    for (key in value) {
      if (value.hasOwnProperty(key)) {
        known = false;
        for (i = 0; i < expectedKeys.length; i += 1) {
          if (expectedKeys[i] === key) known = true;
        }
        if (!known) {
          throw new Error("AEB semantic request rejects unknown " + fieldName + " field.");
        }
        count += 1;
      }
    }
    if (count !== expectedKeys.length) {
      throw new Error("AEB semantic request rejects incomplete " + fieldName + ".");
    }
  }

  function isInstallLikeOrUserPath(value) {
    var normalized = normalizePathText(value).toLowerCase();
    return (
      normalized.indexOf("..") !== -1 ||
      normalized.indexOf("\u0000") !== -1 ||
      normalized.indexOf("file://") === 0 ||
      normalized.indexOf("/users/") === 0 ||
      normalized.indexOf("/volumes/") === 0 ||
      normalized.indexOf("/applications/") === 0 ||
      normalized.indexOf("/library/") === 0 ||
      normalized.indexOf("/system/") === 0 ||
      normalized.indexOf("/documents/") !== -1 ||
      normalized.indexOf("/desktop/") !== -1 ||
      normalized.indexOf("/downloads/") !== -1 ||
      normalized.indexOf("/adobe/cep/extensions") !== -1 ||
      normalized.indexOf("/adobe after effects") !== -1 ||
      normalized.indexOf("/scriptui panels") !== -1 ||
      normalized.indexOf("/plug-ins") !== -1 ||
      normalized.indexOf("/plugins") !== -1
    );
  }

  function validateOutputRoot(outputRoot) {
    var normalized = normalizePathText(outputRoot);
    if (
      !/^\/private\/tmp\/auto-svga-aeb-dev\/[A-Za-z0-9][A-Za-z0-9._-]{0,79}\/ae-export-package\/?$/.test(normalized) ||
      isInstallLikeOrUserPath(normalized) ||
      normalized.indexOf("/semantic-inbox/") !== -1 ||
      normalized.indexOf("/semantic-inbox-ae26/") !== -1
    ) {
      throw new Error("AEB semantic request refuses unsafe outputRoot.");
    }
    return normalized.replace(/\/$/, "");
  }

  function assertNoAliasInExistingAncestors(folderPath) {
    var current = new Folder(folderPath);
    var parent;
    var guard = 0;
    while (current && guard < 24) {
      if (current.exists && current.alias === true) {
        throw new Error("AEB semantic request refuses symlink or alias paths.");
      }
      parent = current.parent;
      if (!parent || parent.fsName === current.fsName) break;
      current = parent;
      guard += 1;
    }
  }

  function readTextFile(file) {
    var text;
    if (!file.open("r")) throw new Error("AEB semantic request could not open request.json.");
    text = file.read();
    file.close();
    return text;
  }

  function writeTextFile(file, text) {
    file.encoding = "UTF-8";
    if (!file.open("w")) throw new Error("AEB semantic request could not open receipt output.");
    file.write(text);
    file.close();
  }

  function hasUnsafeProjectState(project) {
    if (!project) return false;
    if (project.file) return true;
    if (project.numItems && project.numItems > 0) return true;
    if (project.activeItem) return true;
    return false;
  }

  function validateFixtureTransform(value, fieldName) {
    assertExactKeys(value, ["x", "y", "scaleX", "scaleY", "rotation", "opacity"], fieldName);
    assertExactNumber(value.x, fieldName === "transform" ? 150 : value.x, fieldName + ".x");
    assertExactNumber(value.y, 150, fieldName + ".y");
    assertExactNumber(value.scaleX, 1, fieldName + ".scaleX");
    assertExactNumber(value.scaleY, 1, fieldName + ".scaleY");
    assertExactNumber(value.rotation, 0, fieldName + ".rotation");
    assertExactNumber(value.opacity, 1, fieldName + ".opacity");
  }

  function validateFixtureKeyframe(value, expectedFrame, expectedX, fieldName) {
    assertExactKeys(value, ["frame", "x", "y", "scaleX", "scaleY", "rotation", "opacity"], fieldName);
    assertExactNumber(value.frame, expectedFrame, fieldName + ".frame");
    assertExactNumber(value.x, expectedX, fieldName + ".x");
    assertExactNumber(value.y, 150, fieldName + ".y");
    assertExactNumber(value.scaleX, 1, fieldName + ".scaleX");
    assertExactNumber(value.scaleY, 1, fieldName + ".scaleY");
    assertExactNumber(value.rotation, 0, fieldName + ".rotation");
    assertExactNumber(value.opacity, 1, fieldName + ".opacity");
  }

  function validateAssetFixture(value) {
    if (!value || typeof value !== "object") {
      throw new Error("AEB semantic request requires assetFixture.");
    }
    assertExactKeys(value, [
      "anchor",
      "assetId",
      "height",
      "keyframes",
      "layerId",
      "packagePath",
      "transform",
      "width"
    ], "assetFixture");
    assertExact(value.assetId, "asset-task-fixture-0001", "assetFixture.assetId");
    assertExact(value.layerId, "layer-task-fixture-0001", "assetFixture.layerId");
    assertExact(value.packagePath, "assets/layer-0001.png", "assetFixture.packagePath");
    assertExactNumber(value.width, 120, "assetFixture.width");
    assertExactNumber(value.height, 80, "assetFixture.height");
    assertExactKeys(value.anchor, ["x", "y"], "assetFixture.anchor");
    assertExactNumber(value.anchor.x, 60, "assetFixture.anchor.x");
    assertExactNumber(value.anchor.y, 40, "assetFixture.anchor.y");
    validateFixtureTransform(value.transform, "transform");
    if (!(value.keyframes instanceof Array) || value.keyframes.length !== 2) {
      throw new Error("AEB semantic request rejects assetFixture.keyframes.");
    }
    validateFixtureKeyframe(value.keyframes[0], 0, 150, "assetFixture.keyframes[0]");
    validateFixtureKeyframe(value.keyframes[1], 119, 170, "assetFixture.keyframes[1]");
  }

  function validateInboxBeforeRead(inbox, requestFile) {
    var pendingFiles;
    if (inbox.alias === true || requestFile.alias === true) {
      throw new Error("AEB semantic request refuses symlink or alias inbox entries.");
    }
    assertNoAliasInExistingAncestors(INBOX_PATH);
    pendingFiles = inbox.getFiles("request*.json");
    if (pendingFiles.length !== 1 || pendingFiles[0].fsName !== requestFile.fsName) {
      throw new Error("AEB semantic inbox requires exactly one pending request.");
    }
    if (typeof requestFile.length !== "number" || requestFile.length <= 0 || requestFile.length > MAX_REQUEST_BYTES) {
      throw new Error("AEB semantic request rejects empty or oversized input.");
    }
  }

  function validateRequest(request, requestFile, inbox) {
    var now = new Date().getTime();
    var outputRoot;
    var consumedFile;
    var fixtureAction;
    if (!request || typeof request !== "object") {
      throw new Error("AEB semantic request must be an object.");
    }
    fixtureAction = request.action === FIXTURE_ACTION;
    assertExactKeys(request, [
      "schemaVersion",
      "action",
      fixtureAction ? "permitId" : null,
      "requestId",
      fixtureAction ? "sourceHead" : null,
      "oneTimeState",
      "executionState",
      "sourceIdentity",
      "panelIdentity",
      "targetHost",
      "createdAtEpochMs",
      "expiresAtEpochMs",
      "outputRoot",
      "boundaries",
      fixtureAction ? "assetFixture" : null
    ].filter(function keep(key) { return key !== null; }), "top-level");
    assertExact(request.schemaVersion, REQUEST_SCHEMA, "schemaVersion");
    if (request.action !== LEGACY_ACTION && request.action !== FIXTURE_ACTION) {
      throw new Error("AEB semantic request rejects action.");
    }
    if (fixtureAction) {
      assertStringPattern(request.permitId, /^ASV-APR-[0-9]{8}-[0-9]{3}$/, "permitId");
      assertStringPattern(request.sourceHead, /^[a-f0-9]{40}$/, "sourceHead");
      validateAssetFixture(request.assetFixture);
    }
    assertExact(request.oneTimeState, "pending", "oneTimeState");
    assertExact(request.executionState, "not_executed", "executionState");
    assertExact(request.sourceIdentity, SOURCE_IDENTITY, "sourceIdentity");
    if (!request.panelIdentity) throw new Error("AEB semantic request requires panelIdentity.");
    assertExactKeys(request.panelIdentity, ["bundleId", "extensionId", "version"], "panelIdentity");
    assertExact(request.panelIdentity.bundleId, PANEL_BUNDLE_ID, "panelIdentity.bundleId");
    assertExact(request.panelIdentity.extensionId, PANEL_EXTENSION_ID, "panelIdentity.extensionId");
    assertExact(request.panelIdentity.version, PANEL_VERSION, "panelIdentity.version");
    if (!/^aeb-semantic-[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(request.requestId || "")) {
      throw new Error("AEB semantic request rejects requestId.");
    }
    if (
      typeof request.createdAtEpochMs !== "number" ||
      typeof request.expiresAtEpochMs !== "number" ||
      !isFinite(request.createdAtEpochMs) ||
      !isFinite(request.expiresAtEpochMs) ||
      request.createdAtEpochMs > now + FUTURE_SKEW_MS ||
      request.expiresAtEpochMs <= now ||
      request.expiresAtEpochMs <= request.createdAtEpochMs ||
      request.expiresAtEpochMs - request.createdAtEpochMs > MAX_REQUEST_TTL_MS
    ) {
      throw new Error("AEB semantic request rejects stale or future timestamps.");
    }
    assertExactKeys(request.boundaries, [
      "sourceProjectMutationAllowed",
      "saveOrOverwriteAllowed",
      "renderOrBakeAllowed",
      "relinkOrCollectAllowed",
      "encoderAllowed",
      "networkOrCloudAllowed",
      "targetSupportClaimAllowed",
      "visualOrExportSuccessClaimAllowed"
    ], "boundaries");
    assertFalseBoundary(request, "sourceProjectMutationAllowed");
    assertFalseBoundary(request, "saveOrOverwriteAllowed");
    assertFalseBoundary(request, "renderOrBakeAllowed");
    assertFalseBoundary(request, "relinkOrCollectAllowed");
    assertFalseBoundary(request, "encoderAllowed");
    assertFalseBoundary(request, "networkOrCloudAllowed");
    assertFalseBoundary(request, "targetSupportClaimAllowed");
    assertFalseBoundary(request, "visualOrExportSuccessClaimAllowed");
    consumedFile = new File(INBOX_PATH + "/consumed-" + request.requestId + ".json");
    if (
      consumedFile.exists ||
      new File(INBOX_PATH + "/consumed-failed-" + request.requestId + ".json").exists
    ) {
      throw new Error("AEB semantic request refuses replayed requestId.");
    }
    outputRoot = validateOutputRoot(request.outputRoot);
    assertNoAliasInExistingAncestors(outputRoot);
    if (new Folder(outputRoot.replace(/\/ae-export-package$/, "/reports")).exists) {
      throw new Error("AEB semantic request refuses stale output state.");
    }
    if (!fixtureAction && new Folder(outputRoot).exists) {
      throw new Error("AEB semantic request refuses stale output state.");
    }
    if (!fixtureAction && hasUnsafeProjectState(app.project)) {
      throw new Error("AEB semantic request refuses file-backed, non-empty, or ambiguous projects.");
    }
    return {
      outputRoot: outputRoot,
      markerFolder: outputRoot.replace(/\/ae-export-package$/, "/reports"),
      consumedFileName: "consumed-" + request.requestId + ".json",
      fixtureAction: fixtureAction
    };
  }

  function makeScratchConfig(markerFolder) {
    return {
      schemaVersion: "aeb-panel-dev-scratch-setup-action-v0",
      action: "prepare_panel_owned_scratch",
      executionState: "not_executed",
      markerFolder: markerFolder,
      scratchComp: { width: 256, height: 256, fps: 30, durationSeconds: 1, layerCount: 0 },
      scratchProjectCreationAllowed: true,
      fileBackedProjectAllowed: false,
      nonEmptyProjectAllowed: false,
      productionProjectAllowed: false,
      sourceProjectMutationAllowed: false,
      saveOrOverwriteAllowed: false,
      renderOrBakeAllowed: false,
      relinkOrCollectAllowed: false,
      encoderAllowed: false,
      targetSupportClaimAllowed: false,
      visualOrExportSuccessClaimAllowed: false
    };
  }

  function makeExportConfig(outputRoot) {
    return {
      schemaVersion: "aeb-panel-dev-export-action-v0",
      action: "export_to_auto_svga",
      executionState: "not_executed",
      outputFolder: outputRoot,
      selectedTargetFormat: "svga",
      sourceCopyRequired: true,
      sourceMutationAllowed: false,
      renderOrBakeAllowed: false,
      encoderAllowed: false,
      targetSupportClaimAllowed: false,
      visualOrExportSuccessClaimAllowed: false
    };
  }

  function makeSemanticTimestamp() {
    var now = new Date();
    function pad(value) {
      return value < 10 ? "0" + String(value) : String(value);
    }
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      "T",
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds())
    ].join("");
  }

  function makeNativeFixturePackage(request, hostIdentity) {
    var fixture = request.assetFixture;
    var forbiddenActions = {
      rendered: false,
      baked: false,
      collectedFiles: false,
      relinkedFootage: false,
      ranAeScript: true,
      installedPlugin: false,
      wroteImporterOutput: false,
      wroteEncoderOutput: false,
      acceptedThirdPartyUpdate: false
    };
    return {
      schemaVersion: "aeb-wp2-script-output-v0",
      aeExportPackage: {
        packageIdentity: {
          packageId: request.requestId,
          schemaVersion: "ae-export-package-wp1-draft",
          createdBy: "wp2_thin_script_prototype",
          createdAt: makeSemanticTimestamp(),
          bridgeScriptVersion: FIXTURE_PACKAGE_SCRIPT_VERSION
        },
        redaction: {
          mode: "selector_only",
          absolutePathsAllowed: false,
          memberNamesAllowed: false,
          rawProductionMediaAllowed: false,
          externalVolumePathsAllowed: false
        },
        commonSource: {
          sourceSafety: { forbiddenActions: forbiddenActions },
          environment: {
            evidenceLevel: "aeb_panel_semantic_fixture",
            os: { family: $.os, version: "runtime_redacted" },
            afterEffects: { majorVersion: app.version, language: $.locale },
            permissions: { scriptAccessObserved: true, reportOutputAllowed: true }
          },
          project: {
            sampleId: "task-owned-ae26-fixture",
            projectSelector: "TaskOwned/AE26SemanticFixture",
            projectFile: "unsaved_project",
            activeComp: "semantic-fixture-request",
            renderQueue: { status: "not_executed" },
            evidenceLevel: "aeb_panel_semantic_fixture"
          },
          assets: [],
          features: []
        },
        semanticGraph: {
          schemaVersion: "aeb-semantic-graph-v0",
          targetFormat: "svga",
          nativeSubset: "image_transform_v0",
          sourceProof: {
            sampledTransforms: true,
            assetFilesExported: true,
            unsupportedFeaturesClassified: true,
            sourceProjectUnchanged: true
          },
          assets: [{
            assetId: fixture.assetId,
            type: "image",
            packagePath: fixture.packagePath,
            width: fixture.width,
            height: fixture.height,
            sha256: "b7970b1a9c9a313e9b9f912411dacfe61d6e196c102918f4c77f49883da06936",
            materialization: { status: "copied_hash_finalized", rawPathCollected: false }
          }],
          layers: [{
            layerId: fixture.layerId,
            type: "image",
            assetId: fixture.assetId,
            zIndex: 1,
            visible: true,
            anchor: fixture.anchor,
            transform: fixture.transform,
            keyframes: fixture.keyframes
          }],
          unsupportedLayers: [],
          limitations: ["semantic_graph_candidate_assets_materialized"]
        },
        renderPlan: null,
        replaceableSlots: [],
        outputProfiles: [
          { targetFormat: "svga", supportClaim: false },
          { targetFormat: "vap", supportClaim: false }
        ],
        s3Report: {
          scanStatus: "completed_metadata_only",
          sourceSafety: { forbiddenActions: forbiddenActions },
          composition: {
            width: 300,
            height: 300,
            fps: 24,
            durationFrames: 120
          },
          layers: [{
            layerId: fixture.layerId,
            sourceAssetId: fixture.assetId,
            layerType: "footage",
            enabled: true,
            effectCount: 0,
            maskCount: 0,
            hasAudio: false,
            expressedTransformFields: [],
            inPoint: 0,
            outPoint: 5,
            startTime: 0,
            stretch: 100
          }],
          renderQueue: { status: "not_executed" },
          environment: {
            aeMajorVersion: hostIdentity.versionNormalized,
            pathLocale: $.locale
          }
        },
        reports: [],
        hashBinding: { reportDigest: "runtime_digest_requires_host_readback" }
      }
    };
  }

  function validateFixturePackageRoot(outputRoot, request) {
    var outputFolder = new Folder(outputRoot);
    var assetsFolder = new Folder(outputRoot + "/assets");
    var fixtureFile = new File(outputRoot + "/" + request.assetFixture.packagePath);
    var finalizedFile = new File(outputRoot + "/ae-export-package.finalized.json");
    var draftFile = new File(outputRoot + "/ae-export-package.json");
    if (!outputFolder.exists || outputFolder.alias === true) {
      throw new Error("AEB semantic request requires the task-owned package root.");
    }
    if (!assetsFolder.exists || assetsFolder.alias === true || fixtureFile.alias === true) {
      throw new Error("AEB semantic request requires the task-owned fixture asset.");
    }
    if (!fixtureFile.exists || fixtureFile.length !== 811) {
      throw new Error("AEB semantic request rejects missing or drifted fixture asset.");
    }
    if (finalizedFile.exists || draftFile.exists) {
      throw new Error("AEB semantic request refuses stale package output.");
    }
  }

  function writeNativeFixturePackage(outputRoot, request, hostIdentity) {
    var file = new File(outputRoot + "/ae-export-package.finalized.json");
    validateFixturePackageRoot(outputRoot, request);
    writeTextFile(file, toJson(makeNativeFixturePackage(request, hostIdentity)));
    if (!file.exists || file.length <= 0) {
      throw new Error("AEB semantic request missing finalized package after write.");
    }
    return "AEB native fixture package finalized: ae-export-package.finalized.json";
  }

  function makeArtifactIdentity(relativePath) {
    return {
      relativePath: relativePath,
      hashAlgorithm: "sha256",
      sha256: null,
      hashAvailableInExtendScriptHost: false,
      localReadbackRequired: true
    };
  }

  function classifyFailureIssueCode(error, phases) {
    var message = String(error && error.message ? error.message : error || "");
    if (
      phases.scratchPrepared === "fail" &&
      /activeItem/i.test(message) &&
      /read.?only/i.test(message)
    ) {
      return "host_active_item_readonly";
    }
    if (phases.scratchPrepared === "fail") return "scratch_preparation_failed";
    if (phases.metadataPackageWritten === "fail") return "metadata_package_write_failed";
    return "semantic_execution_failed";
  }

  function buildReceipt(request, status, requestState, phases, issueCode, hostIdentity) {
    return {
      schemaVersion: RECEIPT_SCHEMA,
      status: status,
      action: request.action,
      requestId: request.requestId,
      requestState: requestState,
      hostActionState: status === "pass" ? "metadata_only_executed" : "metadata_only_failed_closed",
      issueCode: status === "pass" ? null : issueCode,
      sourceIdentity: SOURCE_IDENTITY,
      panelIdentity: {
        bundleId: PANEL_BUNDLE_ID,
        extensionId: PANEL_EXTENSION_ID,
        version: PANEL_VERSION
      },
      targetHost: {
        appId: request.targetHost.appId,
        versionMajor: request.targetHost.versionMajor,
        versionMinor: request.targetHost.versionMinor,
        versionRule: request.targetHost.versionRule
      },
      actualHost: {
        appId: hostIdentity.appId,
        versionMajor: hostIdentity.versionMajor,
        versionMinor: hostIdentity.versionMinor,
        versionNormalized: hostIdentity.versionNormalized,
        versionRule: hostIdentity.versionRule
      },
      phases: phases,
      artifacts: {
        scratchMarker: makeArtifactIdentity("reports/scratch-setup-marker.json"),
        metadataPackage: makeArtifactIdentity("ae-export-package/ae-export-package.json")
      },
      boundaries: {
        productionProjectRead: false,
        sourceProjectMutationExecuted: false,
        saveOrOverwriteExecuted: false,
        renderOrBakeExecuted: false,
        relinkOrCollectExecuted: false,
        encoderExecuted: false,
        networkOrCloudUsed: false,
        targetSupportClaimAllowed: false,
        visualOrExportSuccessClaimAllowed: false
      },
      redaction: {
        absolutePathsAllowed: false,
        rawProjectNamesAllowed: false,
        rawProductionMediaAllowed: false
      }
    };
  }

  function writeTemporaryReceipt(markerFolder, request, status, requestState, phases, issueCode, hostIdentity) {
    var folder = new Folder(markerFolder);
    var file;
    if (!folder.exists && !folder.create()) {
      throw new Error("AEB semantic request could not create task-owned receipt folder.");
    }
    file = new File(markerFolder + "/semantic-execution-receipt." + request.requestId + ".tmp");
    writeTextFile(file, toJson(buildReceipt(request, status, requestState, phases, issueCode, hostIdentity)));
    return file;
  }

  function finalizeConsumedRequest(requestFile, temporaryReceipt, consumedFileName) {
    if (!requestFile.rename(consumedFileName)) {
      throw new Error("AEB semantic request could not atomically mark request consumed.");
    }
    if (!temporaryReceipt.rename("semantic-execution-receipt.json")) {
      throw new Error("AEB semantic request could not finalize execution receipt.");
    }
  }

  var inbox = new Folder(INBOX_PATH);
  var requestFile = new File(REQUEST_PATH);
  var request;
  var validated;
  var markerFile;
  var packageFile;
  var temporaryReceipt;
  var phases;
  var scratchRuntime;
  var issueCode;
  var targetHostDecision;
  if (!inbox.exists || !requestFile.exists) return "AEB semantic inbox idle.";
  validateInboxBeforeRead(inbox, requestFile);
  request = parseJson(readTextFile(requestFile));
  targetHostDecision = validateTargetHostOrIdle(request);
  if (!targetHostDecision.matches) return "AEB semantic inbox idle.";
  validated = validateRequest(request, requestFile, inbox);
  validated.hostIdentity = targetHostDecision.hostIdentity;
  phases = {
    requestValidated: "pass",
    scratchPrepared: "not_run",
    metadataPackageWritten: "not_run",
    requestConsumed: "not_run"
  };
  try {
    if (validated.fixtureAction) {
      phases.scratchPrepared = "not_required";
    } else {
      phases.scratchPrepared = "running";
      scratchRuntime = {};
      aebPrepareScratchForAutoSvga(toJson(makeScratchConfig(validated.markerFolder)), scratchRuntime);
      if (!(scratchRuntime.createdComp instanceof CompItem)) {
        throw new Error("AEB semantic request could not bind the created scratch composition.");
      }
      markerFile = new File(validated.markerFolder + "/scratch-setup-marker.json");
      if (!markerFile.exists) throw new Error("AEB semantic request missing scratch marker after preparation.");
      phases.scratchPrepared = "pass";
    }
    phases.metadataPackageWritten = "running";
    if (validated.fixtureAction) {
      writeNativeFixturePackage(validated.outputRoot, request, validated.hostIdentity);
      packageFile = new File(validated.outputRoot + "/ae-export-package.finalized.json");
    } else {
      aebExportToAutoSvga(toJson(makeExportConfig(validated.outputRoot)), scratchRuntime.createdComp);
      packageFile = new File(validated.outputRoot + "/ae-export-package.json");
    }
    if (!packageFile.exists) throw new Error("AEB semantic request missing metadata package after export.");
    phases.metadataPackageWritten = "pass";
  } catch (error) {
    if (phases.scratchPrepared === "running") phases.scratchPrepared = "fail";
    if (phases.metadataPackageWritten === "running") phases.metadataPackageWritten = "fail";
    phases.requestConsumed = "failed_request_consumed";
    issueCode = classifyFailureIssueCode(error, phases);
    temporaryReceipt = writeTemporaryReceipt(
      validated.markerFolder,
      request,
      "fail",
      "consumed_failed",
      phases,
      issueCode,
      validated.hostIdentity
    );
    finalizeConsumedRequest(
      requestFile,
      temporaryReceipt,
      "consumed-failed-" + request.requestId + ".json"
    );
    throw new Error("AEB semantic request failed closed after validation.");
  }
  phases.requestConsumed = "pass";
  temporaryReceipt = writeTemporaryReceipt(
    validated.markerFolder,
    request,
    "pass",
    "consumed",
    phases,
    null,
    validated.hostIdentity
  );
  finalizeConsumedRequest(requestFile, temporaryReceipt, validated.consumedFileName);
  return "AEB semantic request consumed: " + request.requestId;
}
