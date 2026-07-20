(function autoSvgaAebDevPanel() {
  "use strict";

  var EXPORT_SCHEMA = "aeb-panel-dev-export-action-v0";
  var SCRATCH_SCHEMA = "aeb-panel-dev-scratch-setup-action-v0";
  var SEMANTIC_IDLE_RESULT = "AEB semantic inbox idle.";
  var AE26_ISOLATED_EXTENSION_ID = "local.auto-svga.aeb.panel.ae26.dev.export";
  var LEGACY_EXTENSION_ID = "local.auto-svga.aeb.panel.dev.export";
  var AE26_PROFILE = "ae26-isolated";
  var LEGACY_PROFILE = "legacy";
  var BOOTSTRAP_KEY = "__AUTO_SVGA_AEB_PANEL_BOOTSTRAP__";
  var CEP_BRIDGE_WAIT_INTERVAL_MS = 50;
  var CEP_BRIDGE_WAIT_LIMIT = 100;
  var semanticDispatchAttempted = false;
  var semanticBridgeWaitAttempts = 0;

  function status(message) {
    var node = document.getElementById("aeb-status");
    if (node) node.textContent = String(message);
  }

  function readOutputFolder() {
    var output = document.getElementById("aeb-output-folder");
    return output ? output.value : "";
  }

  function deriveScratchMarkerFolder(outputFolder) {
    var normalized = String(outputFolder || "");
    if (/[/\\]ae-export-package[/\\]?$/.test(normalized)) {
      return normalized.replace(/[/\\]ae-export-package[/\\]?$/, "/reports");
    }
    return normalized ? normalized + "/reports" : "";
  }

  function makeExportConfig() {
    var outputFolder = readOutputFolder();
    return {
      schemaVersion: EXPORT_SCHEMA,
      action: "export_to_auto_svga",
      executionState: "not_executed",
      outputFolder: outputFolder,
      selectedTargetFormat: "svga",
      sourceCopyRequired: true,
      sourceMutationAllowed: false,
      renderOrBakeAllowed: false,
      encoderAllowed: false,
      targetSupportClaimAllowed: false,
      visualOrExportSuccessClaimAllowed: false
    };
  }

  function makeScratchConfig() {
    var outputFolder = readOutputFolder();
    return {
      schemaVersion: SCRATCH_SCHEMA,
      action: "prepare_panel_owned_scratch",
      executionState: "not_executed",
      markerFolder: deriveScratchMarkerFolder(outputFolder),
      scratchComp: {
        width: 256,
        height: 256,
        fps: 30,
        durationSeconds: 1,
        layerCount: 0
      },
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

  function callExtendScript(functionName, payload) {
    if (typeof window.__adobe_cep__ === "undefined") {
      status("CEP host unavailable. Use the mock host test outside AE.");
      return;
    }
    var script = functionName + "(" + JSON.stringify(JSON.stringify(payload)) + ")";
    window.__adobe_cep__.evalScript(script, function onResult(result) {
      status(result || "No result returned.");
    });
  }

  function traceSemanticDispatch(profile, entrypoint, reason, detail) {
    if (typeof window === "undefined") return;
    window.__AUTO_SVGA_AEB_LAST_SEMANTIC_DISPATCH__ = {
      profile: profile,
      entrypoint: entrypoint,
      reason: reason,
      detail: detail || null
    };
  }

  function extensionRootPath() {
    if (
      typeof window === "undefined" ||
      typeof window.__adobe_cep__ === "undefined" ||
      typeof window.__adobe_cep__.getSystemPath !== "function"
    ) {
      return "";
    }
    try {
      return String(window.__adobe_cep__.getSystemPath("extension") || "");
    } catch (error) {
      return "";
    }
  }

  function semanticEvalScript(entrypoint, forceReload, boundRoot) {
    var root = typeof boundRoot === "string" ? boundRoot : extensionRootPath();
    var jsxPath = root ? root.replace(/\\/g, "/").replace(/\/$/, "") + "/jsx/aeb-export-to-auto-svga.jsx" : "";
    if (!jsxPath) return entrypoint;
    return [
      "(function(){",
      forceReload ? "" : "if (typeof " + entrypoint.replace(/\(\)$/, "") + " !== 'function') {",
      "$.evalFile(new File(" + JSON.stringify(jsxPath) + "));",
      forceReload ? "" : "}",
      "return " + entrypoint + ";",
      "}())"
    ].join("");
  }

  function isRetryableJsxLoadFailure(result) {
    return typeof result === "string" &&
      /^EvalScript error(?:\.|:).*\bERR_FILE_NOT_FOUND\b/.test(result);
  }

  function evaluateSemanticEntrypoint(entrypoint, callback) {
    var initialRoot = extensionRootPath();
    if (!initialRoot) {
      traceSemanticDispatch(semanticProfile(), entrypoint, "wait_for_extension_root");
      setTimeout(function evaluateAfterExtensionRootWait() {
        window.__adobe_cep__.evalScript(semanticEvalScript(entrypoint, true), callback);
      }, 50);
      return;
    }
    window.__adobe_cep__.evalScript(
      semanticEvalScript(entrypoint, false, initialRoot),
      function onInitialSemanticResult(result) {
        if (!isRetryableJsxLoadFailure(result)) {
          callback(result);
          return;
        }
        traceSemanticDispatch(semanticProfile(), entrypoint, "retry_after_jsx_file_not_found");
        setTimeout(function retrySemanticEntrypoint() {
          window.__adobe_cep__.evalScript(semanticEvalScript(entrypoint, true), callback);
        }, 50);
      }
    );
  }

  function normalizeProfile(value) {
    if (value === AE26_PROFILE || value === LEGACY_PROFILE) return value;
    return "";
  }

  function bootstrapProfile() {
    var bootstrap;
    if (typeof window === "undefined") return "";
    bootstrap = window[BOOTSTRAP_KEY];
    if (!bootstrap || typeof bootstrap !== "object") return "";
    if (
      bootstrap.source === "plugin-panel-ae26-isolated/index.html" &&
      bootstrap.extensionId === AE26_ISOLATED_EXTENSION_ID &&
      bootstrap.profile === AE26_PROFILE
    ) {
      return AE26_PROFILE;
    }
    return "";
  }

  function currentExtensionId() {
    if (
      typeof window === "undefined" ||
      typeof window.__adobe_cep__ === "undefined" ||
      typeof window.__adobe_cep__.getExtensionId !== "function"
    ) {
      return "";
    }
    try {
      return String(window.__adobe_cep__.getExtensionId() || "");
    } catch (error) {
      return "";
    }
  }

  function runtimeExtensionProfile() {
    var extensionId = currentExtensionId();
    if (extensionId === AE26_ISOLATED_EXTENSION_ID) return AE26_PROFILE;
    return "";
  }

  function readHostEnvironmentAttribute(text, names) {
    var i;
    var pattern;
    var match;
    for (i = 0; i < names.length; i += 1) {
      pattern = new RegExp(names[i] + "=[\\\"']([^\\\"']+)[\\\"']");
      match = pattern.exec(text);
      if (match) return match[1];
    }
    return "";
  }

  function parseHostEnvironmentText(text) {
    var source = String(text || "");
    if (!source) return null;
    return {
      appName: readHostEnvironmentAttribute(source, ["appName", "appId", "app"]),
      appVersion: readHostEnvironmentAttribute(source, ["appVersion", "version"])
    };
  }

  function readHostEnvironment() {
    var raw;
    if (
      typeof window === "undefined" ||
      typeof window.__adobe_cep__ === "undefined" ||
      typeof window.__adobe_cep__.getHostEnvironment !== "function"
    ) {
      return null;
    }
    try {
      raw = window.__adobe_cep__.getHostEnvironment();
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw);
        } catch (parseError) {
          return parseHostEnvironmentText(raw);
        }
      }
      if (raw && typeof raw === "object") return raw;
    } catch (error) {
      return null;
    }
    return null;
  }

  function hostEnvironmentProfile() {
    var extensionId = currentExtensionId();
    var environment;
    var appName;
    var appVersion;
    if (extensionId !== LEGACY_EXTENSION_ID) return "";
    environment = readHostEnvironment();
    if (!environment) return "";
    appName = String(environment.appName || environment.appId || "");
    appVersion = String(environment.appVersion || environment.version || "");
    if (appName === "AEFT" && /^26\.3(\.|$)/.test(appVersion)) return AE26_PROFILE;
    return "";
  }

  function semanticProfile() {
    return normalizeProfile(bootstrapProfile()) ||
      normalizeProfile(runtimeExtensionProfile()) ||
      normalizeProfile(hostEnvironmentProfile()) ||
      LEGACY_PROFILE;
  }

  function consumeSemanticPilotRequest() {
    var entrypoint = "aebConsumeSemanticPilotRequest()";
    var profile;
    if (typeof window.__adobe_cep__ === "undefined") {
      if (semanticBridgeWaitAttempts >= CEP_BRIDGE_WAIT_LIMIT) {
        traceSemanticDispatch(bootstrapProfile(), entrypoint, "cep_bridge_unavailable");
        status("CEP host unavailable.");
        return;
      }
      semanticBridgeWaitAttempts += 1;
      traceSemanticDispatch(bootstrapProfile(), entrypoint, "wait_for_cep_bridge", {
        attempt: semanticBridgeWaitAttempts,
        limit: CEP_BRIDGE_WAIT_LIMIT
      });
      setTimeout(consumeSemanticPilotRequest, CEP_BRIDGE_WAIT_INTERVAL_MS);
      return;
    }
    if (semanticDispatchAttempted) return;
    semanticDispatchAttempted = true;
    profile = semanticProfile();
    if (profile === AE26_PROFILE) {
      entrypoint = "aebConsumeSemanticPilotRequestAe26()";
      traceSemanticDispatch(profile, entrypoint, "source_or_runtime_profile");
      evaluateSemanticEntrypoint(
        entrypoint,
        function onSemanticResult(result) {
          if (result && result !== SEMANTIC_IDLE_RESULT) status(result);
        }
      );
      return;
    }
    entrypoint = "aebConsumeSemanticPilotRequestAe26()";
    traceSemanticDispatch(AE26_PROFILE, entrypoint, "probe_before_legacy_default");
    evaluateSemanticEntrypoint(
      entrypoint,
      function onSemanticResult(result) {
        if (result && result !== SEMANTIC_IDLE_RESULT) {
          status(result);
          return;
        }
        entrypoint = "aebConsumeSemanticPilotRequest()";
        traceSemanticDispatch(profile, entrypoint, "legacy_default_after_ae26_idle");
        evaluateSemanticEntrypoint(
          entrypoint,
          function onLegacySemanticResult(legacyResult) {
            if (legacyResult && legacyResult !== SEMANTIC_IDLE_RESULT) status(legacyResult);
          }
        );
      }
    );
  }

  function bind() {
    var scratchButton = document.getElementById("aeb-scratch-prepare-button");
    var button = document.getElementById("aeb-export-button");
    consumeSemanticPilotRequest();
    if (scratchButton) {
      scratchButton.addEventListener("click", function onScratchPrepareClick() {
        var config = makeScratchConfig();
        status("Preparing permitted scratch state in After Effects.");
        callExtendScript("aebPrepareScratchForAutoSvga", config);
      });
    }
    if (!button) return;
    button.addEventListener("click", function onExportClick() {
      var config = makeExportConfig();
      status("Export requested. Waiting for After Effects metadata scan.");
      callExtendScript("aebExportToAutoSvga", config);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
}());
