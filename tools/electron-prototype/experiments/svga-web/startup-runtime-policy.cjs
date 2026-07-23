const path = require("node:path");

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

function productMilestonePathSegment(value) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value === "."
    || value === ".."
    || !/^[A-Za-z0-9._-]+$/u.test(value)
  ) {
    throw startupPolicyError("startup_policy_invalid_product_milestone");
  }
  return value;
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
  const milestoneSegment = productMilestonePathSegment(input.productMilestoneId);
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
      ownerRuntimeRoot,
      productArtifactRoot: ownerRuntimeRoot,
      productEvidenceEnabled: false,
      visibleStartupProofEnabled: false,
      autoSvgaOverrides
    };
  }

  return {
    outputMode: "development-proof",
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
  AUTO_SVGA_STARTUP_POLICY_OWNER_RUNTIME_ESCAPE: "startup_policy_owner_runtime_escape"
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
  "startup_policy_owner_runtime_escape"
]);

function safeBootstrapErrorClass(error) {
  const errorClass = error instanceof Error ? error.name : undefined;
  return safeBootstrapErrorClasses.has(errorClass) ? errorClass : "Error";
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
  if (underlyingReason.startsWith("startup_policy_")) return underlyingReason;
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
  return {
    source: input.source,
    acceptanceLaunch: input.acceptanceLaunch === true,
    reason: input.acceptanceLaunch === true
      ? safeAcceptanceBootstrapReason(acceptanceReason, input.error)
      : underlyingBootstrapReason(input.error),
    errorClass: safeBootstrapErrorClass(input.error),
    ...(errorCode ? { errorCode } : {}),
    ...(errorSyscall ? { errorSyscall } : {})
  };
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

module.exports = {
  autoSvgaEnvironmentOverrideNames,
  describeFatalBootstrapError,
  describeFinderEquivalentLaunchEvidence,
  resolveStartupRuntimePolicy,
  safeBootstrapErrorClass
};
