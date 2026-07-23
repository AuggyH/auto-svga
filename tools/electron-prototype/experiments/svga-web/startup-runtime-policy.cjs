const path = require("node:path");

function autoSvgaEnvironmentOverrideNames(environment = {}) {
  return Object.keys(environment)
    .filter((name) => name.startsWith("AUTO_SVGA_") && typeof environment[name] === "string")
    .sort();
}

function productMilestonePathSegment(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]+$/u.test(value)
    ? value
    : "default";
}

function resolveStartupRuntimePolicy(input) {
  const environment = input.environment ?? {};
  const milestoneSegment = productMilestonePathSegment(input.productMilestoneId);
  const ownerRuntimeRoot = path.join(input.ownerUserDataRoot, "runtime", milestoneSegment);
  const developmentProofRoot = path.join(input.repoRoot, ".artifacts/product", milestoneSegment);
  const explicitRootValue = environment.AUTO_SVGA_PRODUCT_ARTIFACTS;
  const explicitProofRoot = typeof explicitRootValue === "string" && explicitRootValue.length > 0
    ? path.resolve(explicitRootValue)
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

function underlyingBootstrapReason(error) {
  const code = errorStringField(error, "code", /^[A-Z0-9_]+$/u);
  if (code) return `bootstrap_${code.toLowerCase()}`;
  const errorClass = error instanceof Error && typeof error.name === "string"
    ? error.name
    : "Error";
  const normalizedClass = errorClass
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replace(/[^A-Za-z0-9_]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .toLowerCase();
  return `bootstrap_${normalizedClass || "error"}`;
}

function describeFatalBootstrapError(input) {
  const acceptanceReason = input.acceptanceProofResult?.proof?.reason
    ?? input.acceptanceProofResult?.reason;
  const errorClass = input.error instanceof Error && typeof input.error.name === "string"
    ? input.error.name
    : "Error";
  const errorCode = errorStringField(input.error, "code", /^[A-Z0-9_]+$/u);
  const errorSyscall = errorStringField(input.error, "syscall", /^[A-Za-z0-9_]+$/u);
  return {
    source: input.source,
    acceptanceLaunch: input.acceptanceLaunch === true,
    reason: input.acceptanceLaunch === true && typeof acceptanceReason === "string"
      ? acceptanceReason
      : underlyingBootstrapReason(input.error),
    errorClass,
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
  resolveStartupRuntimePolicy
};
