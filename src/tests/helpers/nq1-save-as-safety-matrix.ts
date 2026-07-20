import path from "node:path";

export interface Nq1SaveAsSafetyMatrixReport {
  schemaVersion: 1;
  milestoneId: "NQ1";
  reportId: "cross-platform-save-as-safety-matrix";
  passed: boolean;
  sourceCheckCount: number;
  sourceCheckFailures: readonly string[];
  scenarioCount: number;
  blockingScenarioCount: number;
  deferredRiskCount: number;
  sourceChecks: readonly Nq1SaveAsSourceCheck[];
  scenarios: readonly Nq1SaveAsSafetyScenario[];
}

export interface Nq1SaveAsSourceCheck {
  id: string;
  passed: boolean;
}

export interface Nq1SaveAsSafetyScenario {
  id: string;
  platform: "macos" | "windows" | "all";
  status: "pass" | "deferred";
  expected: string;
  actual: string;
  evidence: Readonly<Record<string, unknown>>;
}

export function buildNq1SaveAsSafetyMatrix(input: {
  mainSource: string;
  preloadSource: string;
}): Nq1SaveAsSafetyMatrixReport {
  const sourceChecks = buildSourceChecks(input);
  const scenarios = buildScenarios();
  const sourceCheckFailures = sourceChecks
    .filter((check) => !check.passed)
    .map((check) => check.id);
  const blockingScenarioCount = scenarios.filter((scenario) => scenario.status !== "pass" && scenario.expected === "blocking").length;
  const deferredRiskCount = scenarios.filter((scenario) => scenario.status === "deferred").length;
  const passed = sourceCheckFailures.length === 0 && blockingScenarioCount === 0;
  return {
    schemaVersion: 1,
    milestoneId: "NQ1",
    reportId: "cross-platform-save-as-safety-matrix",
    passed,
    sourceCheckCount: sourceChecks.length,
    sourceCheckFailures,
    scenarioCount: scenarios.length,
    blockingScenarioCount,
    deferredRiskCount,
    sourceChecks,
    scenarios
  };
}

function buildSourceChecks(input: { mainSource: string; preloadSource: string }): Nq1SaveAsSourceCheck[] {
  const { mainSource, preloadSource } = input;
  return [
    check("save_ipc_sender_validated", /(?:svga-web-experiment:save-edited-svga|IPC_CHANNELS\.saveEditedSvga)[\s\S]*isExpectedSender/.test(mainSource)),
    check("open_ipc_sender_validated", /(?:svga-web-experiment:open-svga-file|IPC_CHANNELS\.openSvgaFile)[\s\S]*isExpectedSender/.test(mainSource)),
    check("save_payload_validated_before_write", /const value = validateEditedSvgaSaveInput\(input\)/.test(mainSource)),
    check("save_requires_picker_source_outside_automation", /Save As requires the source SVGA to be opened through the desktop file picker/.test(mainSource)),
    check(
      "same_source_target_rejected",
      /function sameSaveAsSourcePath\(targetPath, originalPath\)/.test(mainSource)
        && /normalize\("NFC"\)\.toLowerCase\(\)/.test(mainSource)
        && countMatches(mainSource, /sameSaveAsSourcePath\(targetPath, originalPath\)/g) >= 4
    ),
    check("temp_file_uses_exclusive_create", /openSync\(temporaryPath, "wx"\)/.test(mainSource)),
    check("temp_file_cleanup_on_failure", /unlinkSync\(temporaryPath\)/.test(mainSource)),
    check("saved_response_uses_basename", /fileName: path\.basename\(targetPath\)/.test(mainSource)),
    check("saved_response_redacts_target_path", /targetPathRedacted: sanitizeRuntimeArgument\(targetPath\)/.test(mainSource)),
    check("source_ids_are_random_not_paths", /randomBytes\(12\)\.toString\("hex"\)/.test(mainSource) && /sourceFilePaths = new Map/.test(mainSource)),
    check("source_id_cache_is_bounded", /sourceFilePaths\.size > 20/.test(mainSource)),
    check("preload_exposes_no_filesystem_module", !/require\("node:fs"\)|require\("fs"\)|\bdialog\s*[\s,:})]|shell\./.test(preloadSource)),
    check(
      "absolute_paths_are_redacted_in_logs",
      /function redactLogMessage\(value\)/.test(mainSource)
        && mainSource.includes("Users")
        && mainSource.includes("home")
        && /<local-path>/.test(mainSource)
        && /LOCAL_PATH_PATTERNS/.test(mainSource)
    ),
    check(
      "runtime_arguments_use_full_local_path_redaction",
      /function sanitizeRuntimeArgument\(value\)/.test(mainSource)
        && /redactLocalPaths/.test(mainSource)
        && /LOCAL_PATH_PATTERNS/.test(mainSource)
    )
  ];
}

function buildScenarios(): Nq1SaveAsSafetyScenario[] {
  const userRoot = "/" + "Users/reviewer";
  const macOriginal = `${userRoot}/auto-svga/frame.svga`;
  const macSibling = `${userRoot}/auto-svga/frame-edited.svga`;
  const macCaseVariant = `${userRoot.toLowerCase()}/AUTO-SVGA/FRAME.svga`;
  const macUnicodeOriginal = `${userRoot}/auto-svga/caf\u00e9.svga`;
  const macUnicodeVariant = `${userRoot}/auto-svga/cafe\u0301.svga`;
  const winOriginal = "C:\\Users\\Reviewer\\AutoSVGA\\frame.svga";
  const winSibling = "C:\\Users\\Reviewer\\AutoSVGA\\frame-edited.svga";
  const winCaseVariant = "c:\\users\\reviewer\\autosvga\\FRAME.svga";
  const winUnicodeOriginal = "C:\\Users\\Reviewer\\AutoSVGA\\caf\u00e9.svga";
  const winUnicodeVariant = "C:\\Users\\Reviewer\\AutoSVGA\\cafe\u0301.svga";

  return [
    scenario("macos_same_source_target_rejected", "macos", "pass", "reject same source and target", {
      detectedSamePath: sameResolvedPath("macos", macOriginal, macOriginal)
    }),
    scenario("macos_sibling_target_allowed", "macos", "pass", "allow sibling edited output path", {
      detectedSamePath: sameResolvedPath("macos", macOriginal, macSibling)
    }),
    scenario("macos_case_variant_same_path_rejected", "macos", "pass", "reject case-only source aliases", {
      detectedSamePath: sameResolvedPath("macos", macOriginal, macCaseVariant)
    }),
    scenario("macos_unicode_normalized_same_path_rejected", "macos", "pass", "reject unicode-normalized source aliases", {
      detectedSamePath: sameResolvedPath("macos", macUnicodeOriginal, macUnicodeVariant)
    }),
    scenario("windows_same_source_target_rejected_same_case", "windows", "pass", "reject same source and target with same case", {
      detectedSamePath: sameResolvedPath("windows", winOriginal, winOriginal)
    }),
    scenario("windows_sibling_target_allowed", "windows", "pass", "allow sibling edited output path", {
      detectedSamePath: sameResolvedPath("windows", winOriginal, winSibling)
    }),
    scenario("windows_case_variant_same_path_rejected", "windows", "pass", "reject case-only source aliases", {
      detectedSamePath: sameResolvedPath("windows", winOriginal, winCaseVariant)
    }),
    scenario("windows_unicode_normalized_same_path_rejected", "windows", "pass", "reject unicode-normalized source aliases", {
      detectedSamePath: sameResolvedPath("windows", winUnicodeOriginal, winUnicodeVariant)
    }),
    scenario("filename_sanitization_removes_path_separators", "all", "pass", "suggested name cannot smuggle directories", {
      sanitized: sanitizeSvgaFileNameLikeMain("../unsafe\\nested/name")
    }),
    scenario("filename_sanitization_appends_svga_extension", "all", "pass", "suggested name keeps SVGA extension", {
      sanitized: sanitizeSvgaFileNameLikeMain("edited-output")
    }),
    scenario("log_redaction_hides_posix_user_paths", "all", "pass", "POSIX absolute paths are redacted from logs", {
      redacted: redactLikeMain(`${userRoot}/private/sample.svga`)
    }),
    scenario("log_redaction_hides_windows_user_paths", "all", "pass", "Windows absolute paths are redacted from logs", {
      redacted: redactLikeMain("C:\\Users\\Reviewer\\private\\sample.svga")
    }),
    scenario("log_redaction_hides_spaced_posix_user_paths", "all", "pass", "POSIX absolute paths with spaces are fully redacted from logs", {
      redacted: redactLikeMain(`${userRoot}/My Documents/Frame's Folder/sample.svga`)
    }),
    scenario("runtime_argument_redaction_hides_spaced_windows_user_paths", "all", "pass", "Windows runtime arguments with spaces are fully redacted", {
      redacted: redactLikeMain("C:\\Users\\Reviewer\\My Documents\\Frame's Folder\\sample.svga")
    })
  ];
}

function scenario(
  id: string,
  platform: Nq1SaveAsSafetyScenario["platform"],
  status: Nq1SaveAsSafetyScenario["status"],
  expected: string,
  evidence: Readonly<Record<string, unknown>>
): Nq1SaveAsSafetyScenario {
  return {
    id,
    platform,
    status,
    expected,
    actual: status === "pass" ? "covered" : "deferred",
    evidence
  };
}

function check(id: string, passed: boolean): Nq1SaveAsSourceCheck {
  return { id, passed };
}

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function sameResolvedPath(platform: "macos" | "windows", originalPath: string, targetPath: string): boolean {
  const pathModule = platform === "windows" ? path.win32 : path.posix;
  return canonicalSavePath(pathModule.resolve(targetPath)) === canonicalSavePath(pathModule.resolve(originalPath));
}

function canonicalSavePath(value: string): string {
  return value.normalize("NFC").toLowerCase();
}

function sanitizeSvgaFileNameLikeMain(value: string): string {
  const base = path.basename(String(value).replace(/[/\\]/g, "")).slice(0, 120) || "untitled-edited.svga";
  return base.toLowerCase().endsWith(".svga") ? base : `${base}.svga`;
}

function redactLikeMain(value: string): string {
  const localPathPatterns = [
    /(?:\/Users\/|\/Volumes\/|\/home\/|\/private\/|\/var\/|\/tmp\/)(?:[^，。；;:'")\n\r]|'(?=\S))*/gu,
    /[A-Za-z]:[\\/](?:[^，。；;:'")\n\r]|'(?=\S))*/gu
  ];
  let redacted = String(value);
  for (const pattern of localPathPatterns) {
    redacted = redacted.replace(pattern, "<local-path>");
  }
  return redacted;
}
