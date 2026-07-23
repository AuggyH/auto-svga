const path = require("node:path");

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
    throw new Error("startup_policy_invalid_product_milestone");
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
    throw new Error(reason);
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
    throw new Error("startup_policy_owner_runtime_escape");
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

function safeBootstrapErrorClass(error) {
  const errorClass = error instanceof Error ? error.name : undefined;
  return safeBootstrapErrorClasses.has(errorClass) ? errorClass : "Error";
}

function safeAcceptanceBootstrapReason(value) {
  return typeof value === "string" && /^acceptance_[a-z0-9_]{1,95}$/u.test(value)
    ? value
    : "acceptance_startup_bootstrap_failed";
}

function underlyingBootstrapReason(error) {
  const code = errorStringField(error, "code", /^[A-Z][A-Z0-9_]{0,63}$/u);
  if (code) return `bootstrap_${code.toLowerCase()}`;
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
  const errorCode = errorStringField(input.error, "code", /^[A-Z][A-Z0-9_]{0,63}$/u);
  const errorSyscall = errorStringField(input.error, "syscall", /^[A-Za-z][A-Za-z0-9_]{0,31}$/u);
  return {
    source: input.source,
    acceptanceLaunch: input.acceptanceLaunch === true,
    reason: input.acceptanceLaunch === true
      ? safeAcceptanceBootstrapReason(acceptanceReason)
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
