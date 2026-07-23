const { createHash } = require("node:crypto");
const path = require("node:path");

const formalStartupProductMilestoneIds = Object.freeze([
  "0.2-multiformat-preview",
  "0.3.0-alpha.1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P6-R1",
  "aeb",
  "short-term"
]);

const startupRegisteredSinkIds = Object.freeze([
  "fatal-console",
  "placement-summary-console",
  "early-phase-jsonl",
  "early-failure-proof",
  "loaded-placement-accepted",
  "loaded-placement-rejected",
  "normal-visible-startup",
  "normal-runtime-proof",
  "normal-smoke-parity",
  "normal-proof-summary-console",
  "product-artifact-index",
  "multi-format-runtime-trace",
  "renderer-probe",
  "blocked-external-requests"
]);

const startupEarlyRegisteredSinkIds = Object.freeze([
  "early-environment-fatal-console",
  "early-fatal-placement-summary-console",
  "early-fatal-console",
  "loaded-placement-summary-console",
  "loaded-fatal-console",
  "early-phase-jsonl",
  "early-failure-proof"
]);

const startupSchemaFieldSets = Object.freeze({
  "fatal-diagnostic": Object.freeze([
    "source", "acceptanceLaunch", "reason", "errorClass", "errorCode", "errorSyscall"
  ]),
  "placement-summary": Object.freeze(["status", "reason", "fileName"]),
  "acceptance-phase": Object.freeze([
    "schemaVersion", "proofId", "phase", "phaseSequence", "executionId", "requestedDisplayId",
    "runtimeInstanceId", "pid", "platform", "arch", "generatedAt", "privacy", "reason",
    "placementMode", "resolvedDisplayId"
  ]),
  "acceptance-failure": Object.freeze([
    "schemaVersion", "proofId", "status", "phase", "placementMode", "reason", "executionId",
    "requestedDisplayId", "runtimeInstanceId", "productIdentity", "privacy", "errorClass",
    "generatedAt", "passed"
  ]),
  "placement-accepted": Object.freeze([
    "schemaVersion", "proofId", "status", "placementMode", "executionId", "requestedDisplayId",
    "resolvedDisplayId", "mainDisplayId", "windowBounds", "selectedDisplay", "primaryDisplay",
    "displayScale", "containment", "disjointFromPrimary", "runtimeInstanceId", "productIdentity",
    "privacy", "generatedAt", "digest", "passed"
  ]),
  "placement-rejected": Object.freeze([
    "schemaVersion", "proofId", "status", "placementMode", "reason", "executionId",
    "requestedDisplayId", "resolvedDisplayId", "mainDisplayId", "windowBounds", "selectedDisplay",
    "primaryDisplay", "displayScale", "containment", "disjointFromPrimary", "runtimeInstanceId",
    "productIdentity", "privacy", "generatedAt", "digest", "passed"
  ]),
  "runtime-identity": Object.freeze([
    "schemaVersion", "milestoneId", "headCommit", "entryCommand", "actualLaunchCommand",
    "actualArgvSanitized", "executableBasename", "pathRedactionsApplied", "environmentOverrides",
    "mainEntry", "preloadEntry", "rendererEntry", "rendererUrl", "windowTitle", "documentTitle",
    "productIdentity", "mode", "processId", "runtimeInstanceId", "player", "csp", "security",
    "hostRuntime", "fixtureLabel", "fixtureSha256", "fixtureSizeBytes", "fixtureSourcePath",
    "fixtureArtifactPath", "indexHtmlSha256", "rendererJsSha256", "stylesCssSha256", "preloadSha256",
    "mainSha256", "loadingPipelineIdentity", "cleanupPipelineIdentity", "externalRequests", "generatedAt"
  ]),
  "normal-visible-startup": Object.freeze([
    "schemaVersion", "milestoneId", "headCommit", "runtimeIdentity", "actualLaunchCommand",
    "actualArgvSanitized", "executableBasename", "pathRedactionsApplied", "environmentOverrides",
    "proofOutputMode", "rendererUrl", "rendererQuery", "processId", "runtimeInstanceId", "windowShown",
    "normalVisibleStartup", "finderEquivalentLaunchCompatible", "finderEquivalentLaunchEvidenceReason",
    "noProofMode", "noSmokeMode", "noProofArguments", "bridgeLocalOnly", "localOnly",
    "externalRequests", "hostOpenTargets", "hostMenuActions", "processLifecycle", "tempCleanup", "passed"
  ]),
  "normal-runtime-proof": Object.freeze([
    "schemaVersion", "milestoneId", "headCommit", "runtimeIdentity", "actualLaunchCommand",
    "actualArgvSanitized", "executableBasename", "pathRedactionsApplied", "environmentOverrides",
    "rendererUrl", "rendererQuery", "processId", "runtimeInstanceId", "windowShown",
    "automationMechanism", "fileOpenMechanism", "fixture", "fixtureLabel", "fixtureSha256",
    "fixtureSizeBytes", "fixtureSourcePath", "fixtureArtifactPath", "screenshotHash", "processExitCode",
    "externalRequests", "normalMode", "hostOpen", "menuOpen", "primaryBridge", "playback",
    "canvasNonBlank", "inspectionReport", "auditPanel", "recentFiles", "recentMissingRecovery",
    "shortTermRecentProof", "shortTermSave", "shortTermSaveProof", "localOnly", "cspAccepted",
    "noCspViolation", "passed", "generatedAt"
  ]),
  "normal-smoke-parity": Object.freeze([
    "schemaVersion", "milestoneId", "headCommit", "normalMode", "smokeMode", "normalProcessId",
    "smokeProcessId", "normalRuntimeInstanceId", "smokeRuntimeInstanceId", "passed", "checks",
    "allowedDifferences", "generatedAt"
  ]),
  "normal-proof-summary": Object.freeze([
    "milestoneId", "passed", "windowShown", "localOnly", "noCspViolation"
  ]),
  "product-artifact-index": Object.freeze([
    "milestoneId", "title", "productIdentity", "headCommit", "generatedAt", "humanReviewRequired", "artifacts"
  ]),
  "product-artifact-record": Object.freeze([
    "scenario", "mode", "source", "viewport", "path", "mime", "sizeBytes", "sha256", "headCommit",
    "rendererEntry", "rendererSha256", "fixture", "inputKind", "fixtureLabel", "fixtureSha256",
    "fixtureSizeBytes", "fixtureSourcePath", "fixtureArtifactPath", "expectedInvalid", "expectedErrorClass",
    "generatedAt", "humanReviewRequired"
  ]),
  "runtime-trace": Object.freeze([
    "schemaVersion", "phase", "timestampMs", "eventId", "requestId", "format", "sourceId",
    "productMilestoneId", "modelStatus", "issueCode", "formalRuntimeMode", "bridgeReady",
    "actionAccepted", "queueDepth"
  ]),
  "renderer-probe": Object.freeze(["rendererQuery", "primaryBridge", "localOnly", "externalRequests"]),
  "external-request": Object.freeze(["category"])
});

const startupEarlySchemaFieldSets = Object.freeze({
  "fatal-diagnostic": Object.freeze([
    "source", "acceptanceLaunch", "reason", "errorClass", "errorCode", "errorSyscall"
  ]),
  "placement-summary": Object.freeze(["status", "reason", "fileName"]),
  "acceptance-phase": Object.freeze([
    "schemaVersion", "proofId", "phase", "phaseSequence", "executionId", "requestedDisplayId",
    "runtimeInstanceId", "pid", "platform", "arch", "generatedAt", "privacy", "reason",
    "placementMode", "resolvedDisplayId"
  ]),
  "acceptance-failure": Object.freeze([
    "schemaVersion", "proofId", "status", "phase", "placementMode", "reason", "executionId",
    "requestedDisplayId", "runtimeInstanceId", "productIdentity", "privacy", "errorClass",
    "generatedAt", "passed"
  ])
});

const startupPolicyErrorCodeByReason = Object.freeze({
  startup_policy_invalid_product_milestone: "AUTO_SVGA_STARTUP_POLICY_INVALID_PRODUCT_MILESTONE",
  startup_policy_invalid_owner_user_data_root: "AUTO_SVGA_STARTUP_POLICY_INVALID_OWNER_USER_DATA_ROOT",
  startup_policy_invalid_repository_root: "AUTO_SVGA_STARTUP_POLICY_INVALID_REPOSITORY_ROOT",
  startup_policy_invalid_product_artifact_root: "AUTO_SVGA_STARTUP_POLICY_INVALID_PRODUCT_ARTIFACT_ROOT",
  startup_policy_owner_runtime_escape: "AUTO_SVGA_STARTUP_POLICY_OWNER_RUNTIME_ESCAPE"
});

function startupPolicyError(reason) {
  const error = new Error(reason);
  error.code = startupPolicyErrorCodeByReason[reason];
  return error;
}

function autoSvgaEnvironmentOverrideNames(environment = {}) {
  return Object.keys(environment)
    .filter((name) => name.startsWith("AUTO_SVGA_") && typeof environment[name] === "string")
    .sort();
}

const safeStartupProductMilestoneIds = new Set(formalStartupProductMilestoneIds);

function requireStartupProductMilestoneId(value) {
  if (!safeStartupProductMilestoneIds.has(value)) {
    throw startupPolicyError("startup_policy_invalid_product_milestone");
  }
  return value;
}

function resolveStartupProductIdentity(input = {}) {
  const environment = input.environment ?? {};
  const hasEnvironmentMilestone = Object.prototype.hasOwnProperty.call(
    environment,
    "AUTO_SVGA_PRODUCT_MILESTONE"
  );
  const environmentMilestoneId = hasEnvironmentMilestone
    ? requireStartupProductMilestoneId(environment.AUTO_SVGA_PRODUCT_MILESTONE)
    : undefined;
  const packagedRuntimeBuildInfo = input.appIsPackaged === true
    && typeof input.readPackagedRuntimeBuildInfo === "function"
    ? input.readPackagedRuntimeBuildInfo()
    : undefined;
  const packagedMilestoneId = environmentMilestoneId === undefined
    && packagedRuntimeBuildInfo?.productMilestoneId !== undefined
    ? requireStartupProductMilestoneId(packagedRuntimeBuildInfo.productMilestoneId)
    : undefined;
  return Object.freeze({
    productMilestoneId: environmentMilestoneId ?? packagedMilestoneId ?? "short-term",
    packagedRuntimeBuildInfo
  });
}

function absoluteStartupRoot(value, reason) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.includes("\0")
    || !path.isAbsolute(value)
  ) {
    throw startupPolicyError(reason);
  }
  return path.normalize(value);
}

function resolveStartupRuntimePolicy(input) {
  const environment = input.environment ?? {};
  const milestoneSegment = requireStartupProductMilestoneId(input.productMilestoneId);
  const ownerUserDataRoot = absoluteStartupRoot(
    input.ownerUserDataRoot,
    "startup_policy_invalid_owner_user_data_root"
  );
  const repositoryRoot = absoluteStartupRoot(
    input.repoRoot,
    "startup_policy_invalid_repository_root"
  );
  const ownerRuntimeBase = path.join(ownerUserDataRoot, "runtime");
  const ownerRuntimeRoot = path.join(ownerRuntimeBase, milestoneSegment);
  if (path.dirname(ownerRuntimeRoot) !== ownerRuntimeBase) {
    throw startupPolicyError("startup_policy_owner_runtime_escape");
  }
  const developmentProofRoot = path.join(repositoryRoot, ".artifacts/product", milestoneSegment);
  const hasExplicitProofRoot = Object.prototype.hasOwnProperty.call(
    environment,
    "AUTO_SVGA_PRODUCT_ARTIFACTS"
  );
  const explicitProofRoot = hasExplicitProofRoot
    ? absoluteStartupRoot(
        environment.AUTO_SVGA_PRODUCT_ARTIFACTS,
        "startup_policy_invalid_product_artifact_root"
      )
    : undefined;
  const autoSvgaOverrides = autoSvgaEnvironmentOverrideNames(environment);

  if (explicitProofRoot) {
    return {
      outputMode: "explicit-proof",
      productMilestoneId: milestoneSegment,
      ownerRuntimeRoot,
      productArtifactRoot: explicitProofRoot,
      productEvidenceEnabled: true,
      visibleStartupProofEnabled: input.normalVisibleStartupMode === true && input.acceptanceLaunch === true,
      autoSvgaOverrides
    };
  }

  if (input.appIsPackaged === true && input.normalVisibleStartupMode === true) {
    return {
      outputMode: "owner-runtime",
      productMilestoneId: milestoneSegment,
      ownerRuntimeRoot,
      productArtifactRoot: ownerRuntimeRoot,
      productEvidenceEnabled: false,
      visibleStartupProofEnabled: false,
      autoSvgaOverrides
    };
  }

  return {
    outputMode: "development-proof",
    productMilestoneId: milestoneSegment,
    ownerRuntimeRoot,
    productArtifactRoot: developmentProofRoot,
    productEvidenceEnabled: true,
    visibleStartupProofEnabled: false,
    autoSvgaOverrides
  };
}

function errorStringField(error, field, pattern) {
  const value = error && typeof error === "object" ? error[field] : undefined;
  return typeof value === "string" && pattern.test(value) ? value : undefined;
}

const safeBootstrapErrorClasses = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "URIError",
  "EvalError",
  "AggregateError"
]);

const safeBootstrapReasonByErrorCode = Object.freeze({
  EACCES: "bootstrap_eacces",
  EBUSY: "bootstrap_ebusy",
  EEXIST: "bootstrap_eexist",
  EINVAL: "bootstrap_einval",
  EISDIR: "bootstrap_eisdir",
  ELOOP: "bootstrap_eloop",
  EMFILE: "bootstrap_emfile",
  ENAMETOOLONG: "bootstrap_enametoolong",
  ENFILE: "bootstrap_enfile",
  ENOENT: "bootstrap_enoent",
  ENOSPC: "bootstrap_enospc",
  ENOTDIR: "bootstrap_enotdir",
  EPERM: "bootstrap_eperm",
  EROFS: "bootstrap_erofs",
  AUTO_SVGA_STARTUP_POLICY_INVALID_PRODUCT_MILESTONE: "startup_policy_invalid_product_milestone",
  AUTO_SVGA_STARTUP_POLICY_INVALID_OWNER_USER_DATA_ROOT: "startup_policy_invalid_owner_user_data_root",
  AUTO_SVGA_STARTUP_POLICY_INVALID_REPOSITORY_ROOT: "startup_policy_invalid_repository_root",
  AUTO_SVGA_STARTUP_POLICY_INVALID_PRODUCT_ARTIFACT_ROOT: "startup_policy_invalid_product_artifact_root",
  AUTO_SVGA_STARTUP_POLICY_OWNER_RUNTIME_ESCAPE: "startup_policy_owner_runtime_escape",
  AUTO_SVGA_STARTUP_SERIALIZATION_AUTHORITY_MISMATCH: "startup_serialization_authority_mismatch",
  AUTO_SVGA_STARTUP_SERIALIZATION_SCHEMA_INVALID: "startup_serialization_schema_invalid",
  AUTO_SVGA_STARTUP_SERIALIZATION_FIELD_SET_INVALID: "startup_serialization_field_set_invalid"
});

const safeBootstrapErrorSyscalls = new Set([
  "access",
  "chmod",
  "close",
  "copyfile",
  "fsync",
  "lstat",
  "mkdir",
  "open",
  "read",
  "readdir",
  "readlink",
  "realpath",
  "rename",
  "rmdir",
  "stat",
  "unlink",
  "write"
]);

const safeAcceptanceBootstrapReasons = new Set([
  "acceptance_argument_forbidden",
  "acceptance_artifact_root_invalid",
  "acceptance_artifact_root_missing",
  "acceptance_bootstrap_artifact_write_failed",
  "acceptance_bootstrap_phase_exists",
  "acceptance_bootstrap_phase_write_failed",
  "acceptance_channel_forbidden",
  "acceptance_display_ambiguous",
  "acceptance_display_duplicate",
  "acceptance_display_malformed",
  "acceptance_display_mismatch",
  "acceptance_display_missing",
  "acceptance_display_set_changed",
  "acceptance_display_set_invalid",
  "acceptance_display_too_small",
  "acceptance_display_unknown",
  "acceptance_execution_malformed",
  "acceptance_execution_unbound",
  "acceptance_launch_not_requested",
  "acceptance_placement_malformed",
  "acceptance_placement_not_active",
  "acceptance_placement_proof_exists",
  "acceptance_placement_proof_failed",
  "acceptance_placement_proof_module_unavailable",
  "acceptance_placement_proof_write_failed",
  "acceptance_primary_overlap",
  "acceptance_request_invalid",
  "acceptance_runtime_instance_missing",
  "acceptance_startup_bootstrap_failed",
  "acceptance_startup_entrypoint_exception",
  "acceptance_startup_entrypoint_rejection",
  "acceptance_window_bounds_drift",
  "acceptance_window_not_contained",
  "display_identity_ambiguous",
  "startup_policy_invalid_product_milestone",
  "startup_policy_invalid_owner_user_data_root",
  "startup_policy_invalid_repository_root",
  "startup_policy_invalid_product_artifact_root",
  "startup_policy_owner_runtime_escape",
  "startup_serialization_authority_mismatch",
  "startup_serialization_schema_invalid",
  "startup_serialization_field_set_invalid"
]);

const safeBootstrapSources = new Set([
  "app_ready_rejection",
  "bootstrap_source_unknown",
  "uncaught_exception",
  "unhandled_rejection"
]);

const startupAcceptanceBootstrapPhases = Object.freeze([
  "app_ready_create_window_begin",
  "app_ready_create_window_failed",
  "app_ready_handler_register_begin",
  "app_ready_handler_registered",
  "bootstrap_failure_artifact_begin",
  "bootstrap_failure_artifact_rejected",
  "bootstrap_failure_artifact_written",
  "browser_window_construct_begin",
  "browser_window_constructed",
  "electron_require_begin",
  "electron_required",
  "entrypoint_loaded",
  "local_requires_begin",
  "local_requires_complete",
  "placement_proof_module_require_begin",
  "placement_proof_module_required",
  "placement_proof_publish_begin",
  "placement_proof_published",
  "placement_proof_rejected",
  "placement_resolve_begin",
  "placement_resolved",
  "placement_revalidate_begin",
  "placement_revalidate_rejected",
  "placement_revalidated",
  "renderer_load_begin",
  "renderer_load_completed",
  "server_import_begin",
  "server_imported",
  "server_started"
]);

const acceptanceExecutionIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

const startupFatalDiagnosticTaxonomy = Object.freeze({
  sources: Object.freeze([...safeBootstrapSources].sort()),
  errorClasses: Object.freeze([...safeBootstrapErrorClasses].sort()),
  reasonByErrorCode: Object.freeze({ ...safeBootstrapReasonByErrorCode }),
  errorSyscalls: Object.freeze([...safeBootstrapErrorSyscalls].sort()),
  acceptanceReasons: Object.freeze([...safeAcceptanceBootstrapReasons].sort()),
  acceptanceExecutionIdPattern: acceptanceExecutionIdPattern.source,
  productMilestoneIds: Object.freeze([...safeStartupProductMilestoneIds].sort())
});

const startupEarlySerializationAuthority = Object.freeze({
  schemaVersion: 1,
  acceptanceExecutionIdPattern: acceptanceExecutionIdPattern.source,
  productMilestoneIds: Object.freeze([...formalStartupProductMilestoneIds]),
  registeredSinkIds: Object.freeze([...startupEarlyRegisteredSinkIds]),
  schemaIds: Object.freeze(Object.keys(startupEarlySchemaFieldSets)),
  schemaFieldSetsSha256: createHash("sha256")
    .update(JSON.stringify(startupEarlySchemaFieldSets))
    .digest("hex"),
  sources: Object.freeze([...safeBootstrapSources].sort()),
  errorClasses: Object.freeze([...safeBootstrapErrorClasses].sort()),
  reasonByErrorCode: Object.freeze({ ...safeBootstrapReasonByErrorCode }),
  errorSyscalls: Object.freeze([...safeBootstrapErrorSyscalls].sort()),
  acceptanceReasons: Object.freeze([...safeAcceptanceBootstrapReasons].sort()),
  phases: Object.freeze([...startupAcceptanceBootstrapPhases])
});

const startupSerializationAuthority = Object.freeze({
  schemaVersion: 1,
  acceptanceExecutionIdPattern: acceptanceExecutionIdPattern.source,
  productMilestoneIds: formalStartupProductMilestoneIds,
  registeredSinkIds: startupRegisteredSinkIds,
  schemaIds: Object.freeze(Object.keys(startupSchemaFieldSets)),
  schemaFieldSetsSha256: createHash("sha256").update(JSON.stringify(startupSchemaFieldSets)).digest("hex")
});

function assertStartupEarlySerializationAuthorityParity(value) {
  if (JSON.stringify(value) !== JSON.stringify(startupEarlySerializationAuthority)) {
    const error = new Error("startup_serialization_authority_mismatch");
    error.code = "AUTO_SVGA_STARTUP_SERIALIZATION_AUTHORITY_MISMATCH";
    throw error;
  }
  return true;
}

function assertStartupSerializationAuthorityParity(value) {
  if (JSON.stringify(value) !== JSON.stringify(startupSerializationAuthority)) {
    const error = new Error("startup_serialization_authority_mismatch");
    error.code = "AUTO_SVGA_STARTUP_SERIALIZATION_AUTHORITY_MISMATCH";
    throw error;
  }
  return true;
}

function finalizeStartupRecord(schemaId, value) {
  const fields = startupSchemaFieldSets[schemaId];
  if (!fields || !value || typeof value !== "object" || Array.isArray(value)) {
    const error = new Error("startup_serialization_schema_invalid");
    error.code = "AUTO_SVGA_STARTUP_SERIALIZATION_SCHEMA_INVALID";
    throw error;
  }
  const unknownFields = Object.keys(value).filter((field) => !fields.includes(field));
  if (unknownFields.length > 0) {
    const error = new Error("startup_serialization_field_set_invalid");
    error.code = "AUTO_SVGA_STARTUP_SERIALIZATION_FIELD_SET_INVALID";
    throw error;
  }
  return Object.fromEntries(fields.filter((field) => value[field] !== undefined).map((field) => [field, value[field]]));
}

function serializeStartupRecord(schemaId, value, space = 0) {
  const record = finalizeStartupRecord(schemaId, value);
  return `${JSON.stringify(record, null, space)}\n`;
}

function assertStartupFatalDiagnosticTaxonomyParity(value) {
  if (JSON.stringify(value) !== JSON.stringify(startupFatalDiagnosticTaxonomy)) {
    const error = new Error("startup_fatal_diagnostic_taxonomy_mismatch");
    error.code = "AUTO_SVGA_STARTUP_FATAL_DIAGNOSTIC_TAXONOMY_MISMATCH";
    throw error;
  }
  return true;
}

function safeBootstrapErrorClass(error) {
  const errorClass = error instanceof Error ? error.name : undefined;
  return safeBootstrapErrorClasses.has(errorClass) ? errorClass : "Error";
}

function safeBootstrapSource(value) {
  return safeBootstrapSources.has(value) ? value : "bootstrap_source_unknown";
}

function safeAcceptanceExecutionId(value) {
  return typeof value === "string" && acceptanceExecutionIdPattern.test(value)
    ? value
    : undefined;
}

function safeStartupProductMilestoneId(value) {
  return safeStartupProductMilestoneIds.has(value) ? value : undefined;
}

function safeBootstrapErrorCode(error) {
  const code = errorStringField(error, "code", /^[A-Z][A-Z0-9_]{0,63}$/u);
  return code && Object.prototype.hasOwnProperty.call(safeBootstrapReasonByErrorCode, code)
    ? code
    : undefined;
}

function safeBootstrapErrorSyscall(error) {
  const syscall = errorStringField(error, "syscall", /^[A-Za-z][A-Za-z0-9_]{0,31}$/u);
  return syscall && safeBootstrapErrorSyscalls.has(syscall) ? syscall : undefined;
}

function safeAcceptanceBootstrapReason(value, error) {
  const underlyingReason = underlyingBootstrapReason(error);
  if (underlyingReason.startsWith("startup_")) return underlyingReason;
  return safeAcceptanceBootstrapReasons.has(value)
    ? value
    : "acceptance_startup_bootstrap_failed";
}

function underlyingBootstrapReason(error) {
  const code = safeBootstrapErrorCode(error);
  if (code) return safeBootstrapReasonByErrorCode[code];
  const reasonByClass = {
    Error: "error",
    TypeError: "type_error",
    RangeError: "range_error",
    SyntaxError: "syntax_error",
    ReferenceError: "reference_error",
    URIError: "uri_error",
    EvalError: "eval_error",
    AggregateError: "aggregate_error"
  };
  return `bootstrap_${reasonByClass[safeBootstrapErrorClass(error)]}`;
}

function describeFatalBootstrapError(input) {
  const acceptanceReason = input.acceptanceProofResult?.proof?.reason
    ?? input.acceptanceProofResult?.reason;
  const errorCode = safeBootstrapErrorCode(input.error);
  const errorSyscall = safeBootstrapErrorSyscall(input.error);
  return finalizeStartupRecord("fatal-diagnostic", {
    source: safeBootstrapSource(input.source),
    acceptanceLaunch: input.acceptanceLaunch === true,
    reason: input.acceptanceLaunch === true
      ? safeAcceptanceBootstrapReason(acceptanceReason, input.error)
      : underlyingBootstrapReason(input.error),
    errorClass: safeBootstrapErrorClass(input.error),
    ...(errorCode ? { errorCode } : {}),
    ...(errorSyscall ? { errorSyscall } : {})
  });
}

function buildStartupPlacementSummary(input = {}) {
  const rawReason = input.reason ?? input.proof?.reason;
  const status = input.status === "written" ? "written" : "rejected";
  const fileName = input.fileName === "acceptance-startup-placement-proof.json"
    ? input.fileName
    : undefined;
  return finalizeStartupRecord("placement-summary", {
    status,
    ...(rawReason ? { reason: safeAcceptanceBootstrapReason(rawReason) } : {}),
    ...(fileName ? { fileName } : {})
  });
}

function buildNormalProofSummary(input = {}) {
  return finalizeStartupRecord("normal-proof-summary", {
    milestoneId: requireStartupProductMilestoneId(input.milestoneId),
    passed: input.passed === true,
    windowShown: input.windowShown === true,
    localOnly: input.localOnly === true,
    noCspViolation: input.noCspViolation === true
  });
}

function describeFinderEquivalentLaunchEvidence(input) {
  const hasAcceptanceArgument = (input.argv ?? [])
    .some((argument) => String(argument).startsWith("--auto-svga-acceptance-"));
  if (
    input.acceptanceLaunch === true
    || hasAcceptanceArgument
    || autoSvgaEnvironmentOverrideNames(input.environment).length > 0
  ) {
    return {
      compatible: false,
      reason: "explicit_acceptance_or_auto_svga_overrides"
    };
  }
  return {
    compatible: false,
    reason: "requires_external_no_env_finder_observation"
  };
}

const startupLaunchCommands = new Set([
  "npm run desktop:dev",
  "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:dev",
  "open -n <Auto SVGA.app>",
  "packaged Auto SVGA.app"
]);

const startupArgumentTokens = new Set([
  "--smoke",
  "--product-smoke",
  "--p2-normal-proof",
  "--audit-player=svga-web",
  "--audit-player=svgaplayerweb"
]);

const startupEnvironmentOverrideNames = new Set([
  "AUTO_SVGA_ACCEPTANCE_EXECUTION_ID",
  "AUTO_SVGA_ACTUAL_LAUNCH_COMMAND",
  "AUTO_SVGA_MULTIFORMAT_TRACE_RUN_ID",
  "AUTO_SVGA_P2_NORMAL_PROOF",
  "AUTO_SVGA_PRODUCT_ARTIFACTS",
  "AUTO_SVGA_PRODUCT_MILESTONE",
  "AUTO_SVGA_PRODUCT_SMOKE",
  "AUTO_SVGA_SMOKE"
]);

const startupRuntimeModes = new Set(["normal", "normal-visible", "smoke"]);
const startupOutputModes = new Set(["development-proof", "explicit-proof", "owner-runtime"]);
const startupExternalRequestCategories = new Set([
  "external_request_blocked",
  "renderer_probe_failed",
  "renderer_probe_unavailable"
]);
const startupFinderEvidenceReasons = new Set([
  "explicit_acceptance_or_auto_svga_overrides",
  "requires_external_no_env_finder_observation"
]);
const startupTracePhases = new Set([
  "main_started",
  "open_file_received",
  "open_file_rejected_mode",
  "open_file_duplicate_suppressed",
  "open_file_queued",
  "flush_attempt",
  "flush_deferred",
  "flush_started",
  "dispatch_started",
  "renderer_authorization_result",
  "renderer_begin_result",
  "session_open_completed",
  "renderer_complete_result",
  "dispatch_failed",
  "renderer_load_completed",
  "renderer_action_bridge_ready"
]);
const startupTraceFormats = new Set(["lottie", "svga", "vap"]);
const startupTraceModelStatuses = new Set(["empty", "error", "loaded", "loading", "paused", "playing"]);
const startupTraceIssueCodes = new Set([
  "dispatch_failed",
  "invalid_bytes",
  "missing_resource",
  "parse_precondition",
  "unsupported_format"
]);
const startupHostOpenTargets = Object.freeze(["primary-svga", "secondary-svga", "reference-media"]);
const startupHostMenuActions = Object.freeze([
  "open-primary-svga", "open-secondary-svga", "open-reference-media", "clear-current-file",
  "save-replacement-as", "save-optimized-copy", "undo-replacement-preview", "redo-replacement-preview",
  "reset-replacement-preview", "cut", "copy", "paste", "select-all", "show-resources", "show-layers",
  "replace-selected-resource", "copy-current-resource-key", "show-diagnostics", "toggle-logs", "open-settings",
  "primary-play-pause", "primary-replay", "primary-loop-toggle", "compare-toggle", "sync-play-pause",
  "sync-replay", "theme-system", "theme-light", "theme-dark", "preview-background-checkerboard",
  "preview-background-light", "preview-background-dark", "preview-background-transparent", "fit-primary-contain",
  "fit-primary-original", "fit-primary-width", "fit-secondary-contain", "fit-secondary-original",
  "fit-secondary-width", "fit-reference-contain", "fit-reference-original", "fit-reference-width", "quit"
]);

const productArtifactScenarios = new Set([
  "desktop-empty", "desktop-loading", "desktop-loaded", "desktop-inspection", "desktop-invalid",
  "desktop-playing", "desktop-paused", "desktop-latest-artifact-loaded", "desktop-reference-media-loaded",
  "desktop-local-compare-loaded", "desktop-responsive-local-compare-at-900-x-720",
  "desktop-responsive-local-compare-at-minimum-size", "desktop-responsive-local-preview-at-900-x-720",
  "short-term-launch", "short-term-preview-overview", "short-term-preview-optimization",
  "short-term-preview-replaceable", "short-term-sequence-thumbnails", "short-term-optimization-result",
  "short-term-rename-dirty", "short-term-replacement-dirty", "short-term-replacement-reset",
  "short-term-runtime-text-applied", "short-term-general-compare", "short-term-edit-reserved",
  "short-term-preview-minimum", "short-term-settings-dialog", "short-term-appearance-dark",
  "short-term-appearance-light", "short-term-preview-overview-wide", "short-term-drag-decision-supported",
  "short-term-drag-decision-unsupported", "short-term-save-failed", "short-term-load-failed",
  "short-term-playback-failed", "desktop-local-info-overview-open", "desktop-local-info-assets-open",
  "desktop-local-source-resources-open", "desktop-local-source-layers-open",
  "desktop-local-inspector-actions-open", "desktop-local-logs-hidden-default", "desktop-local-minimum-size",
  "desktop-info-diagnostics-open", "desktop-local-info-diagnostics-open", "desktop-local-logs-open",
  "desktop-local-settings-open", "desktop-recovered-from-invalid", "desktop-sequence-review-proof",
  "desktop-sequence-repair-preview-proof", "desktop-sequence-no-write-simulation-proof",
  "desktop-sequence-bounded-repair-prototype-proof", "desktop-sequence-prototype-rendered-boundary-proof",
  "desktop-sequence-noop-round-trip-proof", "desktop-sequence-product-repair-proof",
  "desktop-replacement-preview-proof", "desktop-replacement-undo-redo-proof",
  "desktop-multi-replacement-proof", "desktop-optimized-reopen-proof", "actual-normal-loaded", "smoke-loaded",
  "desktop-1280x800", "desktop-1440x900", "desktop-responsive-export-review-loaded-at-900-x-720",
  "p3-original-loaded", "p3-resource-list", "p3-replacement-selected", "p3-replacement-preview",
  "p3-dirty-state", "p3-reset-to-original", "p3-export-success", "p3-reopened-export",
  "p3-invalid-png-state", "p3-original-edited-comparison", "p4-multi-resource-original",
  "p4-multi-resource-list", "p4-first-replacement", "p4-two-replacements", "p4-undo-second-replacement",
  "p4-redo-second-replacement", "p4-reset-selected", "p4-undo-reset-selected", "p4-reset-all",
  "p4-undo-reset-all", "p4-dirty-two-edits", "p4-save-point-clean", "p4-post-save-new-edit",
  "p4-reopened-multi-resource-export", "p4-invalid-second-png", "p4-multi-resource-comparison",
  "p5-batch-entry", "p5-batch-files-selected", "p5-mapping-exact-matches",
  "p5-mapping-unmatched-conflict", "p5-mapping-manual-resolution", "p5-mapping-ready-to-apply",
  "p5-batch-preview", "p5-batch-dirty-state", "p5-batch-undo", "p5-batch-redo",
  "p5-batch-export-success", "p5-batch-reopened-export", "p5-corrupt-png-state",
  "p5-dimension-warning", "p5-batch-original-edited-comparison", "desktop-mode-menu-open",
  "desktop-info-overview-open", "desktop-info-assets-open", "desktop-logs-open", "desktop-settings-open",
  "desktop-accessibility-toggles-on", "desktop-settings-closed-by-escape",
  "desktop-synchronized-playback-toggled-by-space", "desktop-local-compare-empty",
  "desktop-asset-preview-modal-open", "desktop-interaction-trace-source", "normal-runtime-proof",
  "normal-smoke-parity", "normal-visible-startup", "owner-usability-smoke", "p3-resource-edit-report",
  "p3-round-trip-report", "p3-thumbnail-evidence", "p4-canonical-multi-resource-fixture",
  "p4-edit-history-report", "p4-multi-resource-edit-report", "p4-multi-resource-round-trip-report",
  "p4-thumbnail-evidence", "p5-batch-edit-history-report", "p5-batch-mapping-report",
  "p5-batch-round-trip-report", "p5-bundle-privacy-audit", "p5-canonical-batch-fixture",
  "p5-live-runtime-proof", "p5-mapping-ui-render-proof", "p5-product-evidence-summary",
  "p5-reviewer-b-product-categories", "p5-thumbnail-evidence", "p5-ui-flow-proof", "runtime-identity",
  "short-term-design-interaction-proof", "short-term-empty-state-proof", "short-term-load-failure-proof",
  "short-term-menu-state-proof", "short-term-open-flow-proof", "short-term-optimization-proof",
  "short-term-recent-proof", "short-term-rename-proof", "short-term-replaceable-classification-proof",
  "short-term-replacement-proof", "short-term-right-surface-navigation-proof",
  "short-term-runtime-text-boundary-proof", "short-term-save-proof", "short-term-spec-comparison-proof",
  "short-term-thumbnail-proof", "workbench-region-map"
]);

for (const motionId of ["cardEnter", "drawerIn", "dropdownIn", "emptyIconFloat", "fitMenuIn", "modalIn", "overlayIn", "sidePanelEnter", "tabIn"]) {
  for (const phase of ["start", "mid", "end"]) productArtifactScenarios.add(`desktop-motion-${motionId}-${phase}`);
}

const productJsonArtifactFileByScenario = Object.freeze({
  "desktop-interaction-trace-source": "desktop-interaction-trace.source.json",
  "normal-runtime-proof": "normal-runtime-proof.json",
  "normal-smoke-parity": "normal-smoke-parity.json",
  "normal-visible-startup": "normal-visible-startup.json",
  "owner-usability-smoke": "owner-usability-smoke.json",
  "p3-resource-edit-report": "resource-edit-report.json",
  "p3-round-trip-report": "round-trip-report.json",
  "p3-thumbnail-evidence": "thumbnail-evidence.json",
  "p4-canonical-multi-resource-fixture": "canonical-multi-resource-fixture.json",
  "p4-edit-history-report": "edit-history-report.json",
  "p4-multi-resource-edit-report": "multi-resource-edit-report.json",
  "p4-multi-resource-round-trip-report": "multi-resource-round-trip-report.json",
  "p4-thumbnail-evidence": "thumbnail-evidence.json",
  "p5-batch-edit-history-report": "batch-edit-history-report.json",
  "p5-batch-mapping-report": "batch-mapping-report.json",
  "p5-batch-round-trip-report": "batch-round-trip-report.json",
  "p5-bundle-privacy-audit": "bundle-privacy-audit.json",
  "p5-canonical-batch-fixture": "canonical-batch-fixture.json",
  "p5-live-runtime-proof": "p5-live-runtime-proof.json",
  "p5-mapping-ui-render-proof": "p5-mapping-ui-render-proof.json",
  "p5-product-evidence-summary": "p5-product-evidence-summary.json",
  "p5-reviewer-b-product-categories": "reviewer-b-product-categories.json",
  "p5-thumbnail-evidence": "thumbnail-evidence.json",
  "p5-ui-flow-proof": "p5-ui-flow-proof.json",
  "runtime-identity": "runtime-identity.json",
  "short-term-design-interaction-proof": "short-term-design-interaction-proof.json",
  "short-term-empty-state-proof": "short-term-empty-state-proof.json",
  "short-term-load-failure-proof": "short-term-load-failure-proof.json",
  "short-term-menu-state-proof": "short-term-menu-state-proof.json",
  "short-term-open-flow-proof": "short-term-open-flow-proof.json",
  "short-term-optimization-proof": "short-term-optimization-proof.json",
  "short-term-recent-proof": "short-term-recent-proof.json",
  "short-term-rename-proof": "short-term-rename-proof.json",
  "short-term-replaceable-classification-proof": "short-term-replaceable-classification-proof.json",
  "short-term-replacement-proof": "short-term-replacement-proof.json",
  "short-term-right-surface-navigation-proof": "short-term-right-surface-navigation-proof.json",
  "short-term-runtime-text-boundary-proof": "short-term-runtime-text-boundary-proof.json",
  "short-term-save-proof": "short-term-save-proof.json",
  "short-term-spec-comparison-proof": "short-term-spec-comparison-proof.json",
  "short-term-thumbnail-proof": "short-term-thumbnail-proof.json",
  "workbench-region-map": "workbench-region-map.json"
});

const productScreenshotArtifactFileByScenario = Object.freeze({
  "p3-original-loaded": "original-loaded.png", "p3-resource-list": "resource-list.png",
  "p3-replacement-selected": "replacement-selected.png", "p3-replacement-preview": "replacement-preview.png",
  "p3-dirty-state": "dirty-state.png", "p3-reset-to-original": "reset-to-original.png",
  "p3-export-success": "export-success.png", "p3-reopened-export": "reopened-export.png",
  "p3-invalid-png-state": "invalid-png-state.png", "p3-original-edited-comparison": "original-edited-comparison.png",
  "p4-multi-resource-original": "multi-resource-original.png", "p4-multi-resource-list": "multi-resource-list.png",
  "p4-first-replacement": "first-replacement.png", "p4-two-replacements": "two-replacements.png",
  "p4-undo-second-replacement": "undo-second-replacement.png",
  "p4-redo-second-replacement": "redo-second-replacement.png", "p4-reset-selected": "reset-selected.png",
  "p4-undo-reset-selected": "undo-reset-selected.png", "p4-reset-all": "reset-all.png",
  "p4-undo-reset-all": "undo-reset-all.png", "p4-dirty-two-edits": "dirty-two-edits.png",
  "p4-save-point-clean": "save-point-clean.png", "p4-post-save-new-edit": "post-save-new-edit.png",
  "p4-reopened-multi-resource-export": "reopened-multi-resource-export.png",
  "p4-invalid-second-png": "invalid-second-png.png", "p4-multi-resource-comparison": "multi-resource-comparison.png",
  "p5-batch-entry": "batch-entry.png", "p5-batch-files-selected": "batch-files-selected.png",
  "p5-mapping-exact-matches": "mapping-exact-matches.png",
  "p5-mapping-unmatched-conflict": "mapping-unmatched-conflict.png",
  "p5-mapping-manual-resolution": "mapping-manual-resolution.png",
  "p5-mapping-ready-to-apply": "mapping-ready-to-apply.png", "p5-batch-preview": "batch-preview.png",
  "p5-batch-dirty-state": "batch-dirty-state.png", "p5-batch-undo": "batch-undo.png",
  "p5-batch-redo": "batch-redo.png", "p5-batch-export-success": "batch-export-success.png",
  "p5-batch-reopened-export": "batch-reopened-export.png", "p5-corrupt-png-state": "corrupt-png-state.png",
  "p5-dimension-warning": "dimension-warning.png",
  "p5-batch-original-edited-comparison": "batch-original-edited-comparison.png"
});

function safeProductArtifactScenario(value) {
  return productArtifactScenarios.has(value) ? value : undefined;
}

function productArtifactFileNameForScenario(value) {
  const scenario = safeProductArtifactScenario(value);
  if (!scenario) return undefined;
  return productJsonArtifactFileByScenario[scenario]
    ?? productScreenshotArtifactFileByScenario[scenario]
    ?? `${scenario}.png`;
}

function safeHeadCommit(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/u.test(value) ? value : undefined;
}

function safeSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : undefined;
}

function safeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function safeGeneratedAt(value) {
  if (typeof value !== "string") return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? value : undefined;
}

function safeLaunchArguments(argv = []) {
  const safe = [];
  const executable = path.basename(typeof argv[0] === "string" ? argv[0] : "");
  if (["Auto SVGA", "Electron", "electron", "node"].includes(executable)) safe.push(executable);
  else safe.push("unknown-executable");
  for (const argument of argv.slice(1)) {
    if (startupArgumentTokens.has(argument)) safe.push(argument);
    const displayMatch = /^--auto-svga-acceptance-display-id=(?:0|[1-9]\d*)$/u.exec(argument);
    if (displayMatch && Number(displayMatch[0].split("=")[1]) <= 0xffffffff) safe.push(displayMatch[0]);
  }
  return safe;
}

function safeExecutableBasename(argv = []) {
  return safeLaunchArguments(argv)[0];
}

function safeLaunchEnvironmentOverrides(environment = {}) {
  const result = {};
  let unknownSeen = false;
  for (const name of autoSvgaEnvironmentOverrideNames(environment)) {
    if (startupEnvironmentOverrideNames.has(name)) result[name] = "<redacted>";
    else unknownSeen = true;
  }
  if (unknownSeen) result.AUTO_SVGA_UNKNOWN_OVERRIDE = "<redacted>";
  return result;
}

function safeActualLaunchCommand(value, fallback) {
  if (startupLaunchCommands.has(value)) return value;
  return startupLaunchCommands.has(fallback) ? fallback : "open -n <Auto SVGA.app>";
}

function safeExternalRequestCategories(values = []) {
  const categories = new Set();
  for (const value of values) {
    categories.add(startupExternalRequestCategories.has(value) ? value : "external_request_blocked");
  }
  return [...categories].sort();
}

function buildStartupLaunchContext(input = {}) {
  return {
    actualLaunchCommand: safeActualLaunchCommand(input.actualLaunchCommand, input.defaultActualLaunchCommand),
    actualArgvSanitized: safeLaunchArguments(input.argv),
    executableBasename: safeExecutableBasename(input.argv),
    pathRedactionsApplied: true,
    environmentOverrides: safeLaunchEnvironmentOverrides(input.environment)
  };
}

function safeFixtureMetadata(value = {}) {
  const fixtureLabel = value.fixtureLabel === "repository-avatar-frame-basic.svga"
    ? value.fixtureLabel
    : undefined;
  const fixtureSourcePath = value.fixtureSourcePath === "examples/avatar_frame_basic/output/avatar_frame_basic.svga"
    ? value.fixtureSourcePath
    : undefined;
  const fixtureArtifactPath = value.fixtureArtifactPath === "tools/electron-prototype/experiments/svga-web/.runtime/fixture/avatar-frame-smoke.svga"
    ? value.fixtureArtifactPath
    : undefined;
  return {
    ...(fixtureLabel ? { fixtureLabel } : {}),
    ...(safeSha256(value.fixtureSha256) ? { fixtureSha256: value.fixtureSha256 } : {}),
    ...(safeNonNegativeInteger(value.fixtureSizeBytes) !== undefined ? { fixtureSizeBytes: value.fixtureSizeBytes } : {}),
    ...(fixtureSourcePath ? { fixtureSourcePath } : {}),
    ...(fixtureArtifactPath ? { fixtureArtifactPath } : {})
  };
}

function buildStartupRuntimeIdentity(input = {}) {
  const milestoneId = requireStartupProductMilestoneId(input.milestoneId);
  const mode = startupRuntimeModes.has(input.mode) ? input.mode : "normal";
  const launch = buildStartupLaunchContext(input.launchContext);
  const finderReason = startupFinderEvidenceReasons.has(input.finderEquivalentLaunchEvidenceReason)
    ? input.finderEquivalentLaunchEvidenceReason
    : "requires_external_no_env_finder_observation";
  const runtimeInstanceId = safeAcceptanceExecutionId(input.runtimeInstanceId);
  const generatedAt = safeGeneratedAt(input.generatedAt);
  return finalizeStartupRecord("runtime-identity", {
    schemaVersion: 1,
    milestoneId,
    ...(safeHeadCommit(input.headCommit) ? { headCommit: input.headCommit } : {}),
    entryCommand: "npm run desktop:dev",
    ...launch,
    mainEntry: "tools/electron-prototype/experiments/svga-web/main.cjs",
    preloadEntry: "tools/electron-prototype/experiments/svga-web/preload.cjs",
    rendererEntry: input.rendererEntry === "web/desktop-product-entry.mjs"
      ? "tools/electron-prototype/experiments/svga-web/web/desktop-product-entry.mjs"
      : "tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs",
    rendererUrl: "local-renderer",
    windowTitle: "auto-svga",
    documentTitle: "Auto SVGA — Desktop Preview",
    productIdentity: "auto-svga",
    mode,
    ...(safeNonNegativeInteger(input.processId) !== undefined ? { processId: input.processId } : {}),
    ...(runtimeInstanceId ? { runtimeInstanceId } : {}),
    player: "svga-web@2.4.4",
    csp: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    security: {
      contentSecurityPolicy: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      remoteNavigationAllowed: false,
      newWindowsAllowed: false,
      permissionsDenied: true,
      telemetryEnabled: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      arbitraryFileServing: false,
      persistedAbsolutePaths: false
    },
    hostRuntime: {
      normalVisibleStartup: input.normalVisibleStartup === true,
      finderEquivalentLaunchCompatible: false,
      finderEquivalentLaunchEvidenceReason: finderReason,
      fileOpenTargets: startupHostOpenTargets,
      menuActions: startupHostMenuActions,
      sessionRootRedacted: "<owner-runtime>",
      tempCleanupOnExit: true
    },
    ...safeFixtureMetadata(input.fixtureMetadata),
    ...(safeSha256(input.indexHtmlSha256) ? { indexHtmlSha256: input.indexHtmlSha256 } : {}),
    ...(safeSha256(input.rendererJsSha256) ? { rendererJsSha256: input.rendererJsSha256 } : {}),
    ...(safeSha256(input.stylesCssSha256) ? { stylesCssSha256: input.stylesCssSha256 } : {}),
    ...(safeSha256(input.preloadSha256) ? { preloadSha256: input.preloadSha256 } : {}),
    ...(safeSha256(input.mainSha256) ? { mainSha256: input.mainSha256 } : {}),
    loadingPipelineIdentity: "loadSvgaFile -> loadSvgaBytes -> Parser.do -> Player.mount -> inspection report",
    cleanupPipelineIdentity: "cleanupPlayer -> clearCanvas -> reset active player/parser/video/status",
    externalRequests: safeExternalRequestCategories(input.externalRequests),
    ...(generatedAt ? { generatedAt } : {})
  });
}

function buildRendererProbeEvidence(input = {}) {
  return finalizeStartupRecord("renderer-probe", {
    rendererQuery: input.rendererQuery === "" ? "" : "renderer_query_redacted",
    primaryBridge: input.primaryBridge === true,
    localOnly: input.localOnly === true,
    externalRequests: safeExternalRequestCategories(input.externalRequests)
  });
}

function buildNormalVisibleStartupProof(input = {}) {
  const milestoneId = requireStartupProductMilestoneId(input.milestoneId);
  const runtimeIdentity = buildStartupRuntimeIdentity({ ...input.runtimeIdentityInput, milestoneId, mode: "normal-visible" });
  const rendererProbe = buildRendererProbeEvidence(input.rendererProbe);
  const proofOutputMode = startupOutputModes.has(input.proofOutputMode) ? input.proofOutputMode : "development-proof";
  const runtimeInstanceId = safeAcceptanceExecutionId(input.runtimeInstanceId);
  const finderReason = startupFinderEvidenceReasons.has(input.finderEquivalentLaunchEvidenceReason)
    ? input.finderEquivalentLaunchEvidenceReason
    : "requires_external_no_env_finder_observation";
  const noProofArguments = !runtimeIdentity.actualArgvSanitized.includes("--p2-normal-proof")
    && !runtimeIdentity.actualArgvSanitized.includes("--smoke")
    && !runtimeIdentity.actualArgvSanitized.includes("--product-smoke");
  const value = {
    schemaVersion: 1,
    milestoneId,
    ...(safeHeadCommit(input.headCommit) ? { headCommit: input.headCommit } : {}),
    runtimeIdentity,
    actualLaunchCommand: runtimeIdentity.actualLaunchCommand,
    actualArgvSanitized: runtimeIdentity.actualArgvSanitized,
    executableBasename: runtimeIdentity.executableBasename,
    pathRedactionsApplied: true,
    environmentOverrides: runtimeIdentity.environmentOverrides,
    proofOutputMode,
    rendererUrl: "local-renderer",
    rendererQuery: rendererProbe.rendererQuery,
    ...(safeNonNegativeInteger(input.processId) !== undefined ? { processId: input.processId } : {}),
    ...(runtimeInstanceId ? { runtimeInstanceId } : {}),
    windowShown: input.windowShown === true,
    normalVisibleStartup: true,
    finderEquivalentLaunchCompatible: false,
    finderEquivalentLaunchEvidenceReason: finderReason,
    noProofMode: true,
    noSmokeMode: true,
    noProofArguments,
    bridgeLocalOnly: rendererProbe.primaryBridge,
    localOnly: rendererProbe.localOnly && rendererProbe.externalRequests.length === 0,
    externalRequests: rendererProbe.externalRequests,
    hostOpenTargets: startupHostOpenTargets,
    hostMenuActions: startupHostMenuActions,
    processLifecycle: {
      windowAllClosedCleanup: true,
      quitMenuInstalled: true,
      expectedExit: "window-all-closed -> cleanupRuntime -> app.quit",
      orphanProcessPolicy: "no background child processes are spawned by the normal visible app"
    },
    tempCleanup: {
      sessionRoot: "<owner-runtime>",
      cleanupRuntimeInstalled: true,
      tempRemovedOnExit: true
    }
  };
  value.passed = value.windowShown === true
    && value.rendererQuery === ""
    && value.proofOutputMode === "explicit-proof"
    && value.noProofArguments === true
    && value.bridgeLocalOnly === true
    && value.localOnly === true
    && value.externalRequests.length === 0;
  return finalizeStartupRecord("normal-visible-startup", value);
}

function buildNormalRuntimeProof(input = {}) {
  const milestoneId = requireStartupProductMilestoneId(input.milestoneId);
  const runtimeIdentity = buildStartupRuntimeIdentity({ ...input.runtimeIdentityInput, milestoneId, mode: "normal" });
  const result = input.result && typeof input.result === "object" ? input.result : {};
  const value = {
    schemaVersion: 1,
    milestoneId,
    ...(safeHeadCommit(input.headCommit) ? { headCommit: input.headCommit } : {}),
    runtimeIdentity,
    actualLaunchCommand: runtimeIdentity.actualLaunchCommand,
    actualArgvSanitized: runtimeIdentity.actualArgvSanitized,
    executableBasename: runtimeIdentity.executableBasename,
    pathRedactionsApplied: true,
    environmentOverrides: runtimeIdentity.environmentOverrides,
    rendererUrl: "local-renderer",
    rendererQuery: result.rendererQuery === "" ? "" : "renderer_query_redacted",
    ...(safeNonNegativeInteger(input.processId) !== undefined ? { processId: input.processId } : {}),
    ...(safeAcceptanceExecutionId(input.runtimeInstanceId) ? { runtimeInstanceId: input.runtimeInstanceId } : {}),
    windowShown: false,
    automationMechanism: "host bridge button click in canonical renderer",
    fileOpenMechanism: "macOS File > Open SVGA menu item -> short-term host dialog IPC",
    fixture: "repository-avatar-frame-basic.svga",
    ...safeFixtureMetadata(input.fixtureMetadata),
    ...(safeSha256(input.screenshotHash) ? { screenshotHash: input.screenshotHash } : { screenshotHash: null }),
    processExitCode: input.passed === true ? 0 : 1,
    externalRequests: [],
    normalMode: result.normalMode === true,
    hostOpen: result.hostOpen === true,
    menuOpen: result.menuOpen === true,
    primaryBridge: result.primaryBridge === true,
    playback: result.playback === true,
    canvasNonBlank: result.canvasNonBlank === true,
    inspectionReport: result.inspectionReport === true,
    auditPanel: result.auditPanel === true,
    recentFiles: result.recentFiles === true,
    recentMissingRecovery: result.recentMissingRecovery === true,
    shortTermSave: result.shortTermSave === true,
    localOnly: result.localOnly === true,
    cspAccepted: result.cspAccepted === true,
    noCspViolation: result.noCspViolation === true,
    passed: input.passed === true,
    ...(safeGeneratedAt(input.generatedAt) ? { generatedAt: input.generatedAt } : {})
  };
  return finalizeStartupRecord("normal-runtime-proof", value);
}

function buildNormalSmokeParity(input = {}) {
  const milestoneId = requireStartupProductMilestoneId(input.milestoneId);
  const normalIdentity = input.normalIdentity ?? {};
  const smokeIdentity = input.smokeIdentity ?? {};
  const checks = {};
  for (const key of [
    "mainEntry", "preloadEntry", "rendererEntry", "indexHtmlSha256", "rendererJsSha256", "stylesCssSha256",
    "preloadSha256", "mainSha256", "productIdentity", "player", "csp", "loadingPipelineIdentity",
    "cleanupPipelineIdentity"
  ]) checks[key] = normalIdentity[key] === smokeIdentity[key];
  checks.separateProcessId = normalIdentity.processId !== smokeIdentity.processId;
  checks.separateRuntimeInstanceId = normalIdentity.runtimeInstanceId !== smokeIdentity.runtimeInstanceId;
  const value = {
    schemaVersion: 1,
    milestoneId,
    ...(safeHeadCommit(input.headCommit) ? { headCommit: input.headCommit } : {}),
    normalMode: startupRuntimeModes.has(normalIdentity.mode) ? normalIdentity.mode : "normal",
    smokeMode: startupRuntimeModes.has(smokeIdentity.mode) ? smokeIdentity.mode : "smoke",
    ...(safeNonNegativeInteger(normalIdentity.processId) !== undefined ? { normalProcessId: normalIdentity.processId } : {}),
    ...(safeNonNegativeInteger(smokeIdentity.processId) !== undefined ? { smokeProcessId: smokeIdentity.processId } : {}),
    ...(safeAcceptanceExecutionId(normalIdentity.runtimeInstanceId) ? { normalRuntimeInstanceId: normalIdentity.runtimeInstanceId } : {}),
    ...(safeAcceptanceExecutionId(smokeIdentity.runtimeInstanceId) ? { smokeRuntimeInstanceId: smokeIdentity.runtimeInstanceId } : {}),
    passed: Object.values(checks).every(Boolean),
    checks,
    allowedDifferences: [
      "mode", "rendererUrl query parameters", "test-only automation trigger", "deterministic fixture selection",
      "screenshot capture", "process cleanup"
    ],
    ...(safeGeneratedAt(input.generatedAt) ? { generatedAt: input.generatedAt } : {})
  };
  return finalizeStartupRecord("normal-smoke-parity", value);
}

function sanitizeProductArtifactRecord(artifact, milestoneId, indexHeadCommit) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return undefined;
  const scenario = safeProductArtifactScenario(artifact.scenario);
  const fileName = productArtifactFileNameForScenario(scenario);
  const expectedPath = fileName ? `.artifacts/product/${milestoneId}/${fileName}` : undefined;
  const sha256 = safeSha256(artifact.sha256);
  const sizeBytes = safeNonNegativeInteger(artifact.sizeBytes);
  if (!scenario || artifact.path !== expectedPath || !sha256 || sizeBytes === undefined) return undefined;
  const mode = artifact.mode === "normal" ? "normal" : "smoke";
  const viewport = artifact.viewport && typeof artifact.viewport === "object"
    ? {
        width: safeNonNegativeInteger(artifact.viewport.width) ?? null,
        height: safeNonNegativeInteger(artifact.viewport.height) ?? null
      }
    : { width: null, height: null };
  const rendererEntry = ["short-term", "0.2-multiformat-preview"].includes(milestoneId)
    ? "tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs"
    : "tools/electron-prototype/experiments/svga-web/web/desktop-product-entry.mjs";
  const generatedAt = safeGeneratedAt(artifact.generatedAt);
  const emptyFixture = ["desktop-empty", "normal-visible-startup", "short-term-launch"].includes(scenario);
  const invalidFixture = scenario === "desktop-invalid";
  const fixtureMetadata = emptyFixture
    ? {
        fixture: null,
        inputKind: "none",
        fixtureLabel: null,
        fixtureSha256: null,
        fixtureSizeBytes: null,
        fixtureSourcePath: null,
        fixtureArtifactPath: null
      }
    : invalidFixture
      ? {
          fixture: "broken.svga",
          inputKind: "expected-invalid",
          fixtureLabel: "broken.svga",
          ...(safeSha256(artifact.fixtureSha256) ? { fixtureSha256: artifact.fixtureSha256 } : {}),
          ...(safeNonNegativeInteger(artifact.fixtureSizeBytes) !== undefined ? { fixtureSizeBytes: artifact.fixtureSizeBytes } : {}),
          fixtureSourcePath: "generated-invalid-fixture:broken.svga",
          fixtureArtifactPath: `.artifacts/product/${milestoneId}/invalid-fixture.svga`,
          expectedInvalid: true,
          expectedErrorClass: "invalid_svga_bytes"
        }
      : {
          fixture: scenario.startsWith("p3-") ? "synthetic-avatar-frame.svga" : "repository-avatar-frame-basic.svga",
          inputKind: scenario.startsWith("p3-")
            ? "p3-editing-smoke"
            : scenario === "desktop-loading" ? "valid-loading" : "valid",
          fixtureLabel: "repository-avatar-frame-basic.svga",
          ...(safeSha256(artifact.fixtureSha256) ? { fixtureSha256: artifact.fixtureSha256 } : {}),
          ...(safeNonNegativeInteger(artifact.fixtureSizeBytes) !== undefined ? { fixtureSizeBytes: artifact.fixtureSizeBytes } : {}),
          fixtureSourcePath: "examples/avatar_frame_basic/output/avatar_frame_basic.svga",
          fixtureArtifactPath: "tools/electron-prototype/experiments/svga-web/.runtime/fixture/avatar-frame-smoke.svga"
        };
  return finalizeStartupRecord("product-artifact-record", {
    scenario,
    mode,
    source: "desktop",
    viewport,
    path: expectedPath,
    mime: fileName.endsWith(".png") ? "image/png" : "application/json",
    sizeBytes,
    sha256,
    ...(safeHeadCommit(indexHeadCommit) ? { headCommit: indexHeadCommit } : {}),
    rendererEntry,
    ...(safeSha256(artifact.rendererSha256) ? { rendererSha256: artifact.rendererSha256 } : {}),
    ...fixtureMetadata,
    ...(generatedAt ? { generatedAt } : {}),
    humanReviewRequired: true
  });
}

function sanitizeProductArtifactIndex(input = {}) {
  const milestoneId = requireStartupProductMilestoneId(input.milestoneId);
  const titleByMilestone = {
    "0.2-multiformat-preview": "Auto SVGA 0.2 Multi-format Preview Candidate",
    "short-term": "Short-term SVGA Preview, Inspection, Replacement, And Optimization",
    P2: "Desktop Product Shell And Web Preview Parity",
    P3: "Basic Image Resource Replacement And Save As",
    P4: "Multi-Resource Editing, Undo/Redo And Export Integrity",
    P5: "Batch PNG Mapping And Live Product Evidence"
  };
  return finalizeStartupRecord("product-artifact-index", {
    milestoneId,
    title: titleByMilestone[milestoneId] ?? "Auto SVGA Product Milestone",
    productIdentity: "auto-svga",
    ...(safeHeadCommit(input.headCommit) ? { headCommit: input.headCommit } : {}),
    ...(safeGeneratedAt(input.generatedAt) ? { generatedAt: input.generatedAt } : {}),
    humanReviewRequired: true,
    artifacts: Array.isArray(input.artifacts)
      ? input.artifacts
          .map((artifact) => sanitizeProductArtifactRecord(artifact, milestoneId, input.headCommit))
          .filter(Boolean)
      : []
  });
}

function sanitizeRuntimeTraceEntry(input = {}, timestampMs = 0) {
  const productMilestoneId = requireStartupProductMilestoneId(input.productMilestoneId);
  if (!startupTracePhases.has(input.phase)) return undefined;
  const entry = {
    schemaVersion: 1,
    phase: input.phase,
    timestampMs: safeNonNegativeInteger(timestampMs) ?? 0,
    productMilestoneId
  };
  if (typeof input.eventId === "string" && /^fileOpenEvent:[1-9]\d{0,11}$/u.test(input.eventId)) entry.eventId = input.eventId;
  if (
    typeof input.requestId === "string"
    && /^(?:dragDrop|fileButton|fileOpenEvent|recentFile|replacement|reset):[1-9]\d{0,11}$/u.test(input.requestId)
  ) entry.requestId = input.requestId;
  if (startupTraceFormats.has(input.format)) entry.format = input.format;
  if (typeof input.sourceId === "string" && /^[a-f0-9]{16,64}$/u.test(input.sourceId)) entry.sourceId = input.sourceId;
  if (startupTraceModelStatuses.has(input.modelStatus)) entry.modelStatus = input.modelStatus;
  if (startupTraceIssueCodes.has(input.issueCode)) entry.issueCode = input.issueCode;
  for (const key of ["formalRuntimeMode", "bridgeReady", "actionAccepted"]) {
    if (typeof input[key] === "boolean") entry[key] = input[key];
  }
  if (Number.isInteger(input.queueDepth) && input.queueDepth >= 0 && input.queueDepth <= 1000) {
    entry.queueDepth = input.queueDepth;
  }
  return finalizeStartupRecord("runtime-trace", entry);
}

module.exports = {
  assertStartupEarlySerializationAuthorityParity,
  assertStartupFatalDiagnosticTaxonomyParity,
  assertStartupSerializationAuthorityParity,
  autoSvgaEnvironmentOverrideNames,
  buildNormalRuntimeProof,
  buildNormalProofSummary,
  buildNormalSmokeParity,
  buildNormalVisibleStartupProof,
  buildRendererProbeEvidence,
  buildStartupPlacementSummary,
  buildStartupLaunchContext,
  buildStartupRuntimeIdentity,
  describeFatalBootstrapError,
  describeFinderEquivalentLaunchEvidence,
  finalizeStartupRecord,
  productArtifactFileNameForScenario,
  requireStartupProductMilestoneId,
  resolveStartupProductIdentity,
  resolveStartupRuntimePolicy,
  safeAcceptanceBootstrapReason,
  safeAcceptanceExecutionId,
  safeBootstrapErrorClass,
  safeExternalRequestCategories,
  safeProductArtifactScenario,
  safeStartupProductMilestoneId,
  sanitizeProductArtifactIndex,
  sanitizeRuntimeTraceEntry,
  serializeStartupRecord,
  startupEarlySerializationAuthority,
  startupFatalDiagnosticTaxonomy,
  startupSerializationAuthority
};
