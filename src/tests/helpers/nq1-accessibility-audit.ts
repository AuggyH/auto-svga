export interface Nq1AccessibilityAuditReport {
  schemaVersion: 1;
  milestoneId: "NQ1";
  reportId: "accessibility-keyboard-error-semantics-audit";
  passed: boolean;
  sourceCheckCount: number;
  sourceCheckFailures: readonly string[];
  advisoryCount: number;
  sourceChecks: readonly Nq1AccessibilitySourceCheck[];
  advisories: readonly Nq1AccessibilityAdvisory[];
}

export interface Nq1AccessibilitySourceCheck {
  id: string;
  passed: boolean;
}

export interface Nq1AccessibilityAdvisory {
  id: string;
  severity: "manual_review" | "minor";
  message: string;
}

export function buildNq1AccessibilityAuditReport(input: {
  htmlSource: string;
  rendererSource: string;
  cssSource: string;
}): Nq1AccessibilityAuditReport {
  const sourceChecks = buildSourceChecks(input);
  const sourceCheckFailures = sourceChecks
    .filter((check) => !check.passed)
    .map((check) => check.id);
  const advisories = buildAdvisories(input);
  return {
    schemaVersion: 1,
    milestoneId: "NQ1",
    reportId: "accessibility-keyboard-error-semantics-audit",
    passed: sourceCheckFailures.length === 0,
    sourceCheckCount: sourceChecks.length,
    sourceCheckFailures,
    advisoryCount: advisories.length,
    sourceChecks,
    advisories
  };
}

function buildSourceChecks(input: {
  htmlSource: string;
  rendererSource: string;
  cssSource: string;
}): Nq1AccessibilitySourceCheck[] {
  const { htmlSource, rendererSource, cssSource } = input;
  return [
    check("document_language_is_chinese", htmlSource.includes('<html lang="zh-CN"')),
    check("viewport_meta_present", htmlSource.includes('name="viewport"')),
    check("internal_prototype_warning_visible", htmlSource.includes("内部原型 · 非生产版本 · 仅供内部测试")),
    check("main_workspace_has_accessible_name", htmlSource.includes('<section class="workspace" aria-label="SVGA preview workspace">')),
    check("player_region_uses_labelledby", htmlSource.includes('class="playerPane" aria-labelledby="playerTitle"')),
    check("report_region_uses_labelledby", htmlSource.includes('class="reportPane" aria-labelledby="reportTitle"')),
    check("canvas_has_accessible_label", htmlSource.includes('aria-label="SVGA player output"')),
    check("file_information_has_accessible_label", htmlSource.includes('aria-label="Loaded SVGA file information"')),
    check("primary_buttons_are_button_type", countMatches(htmlSource, /<button[^>]+type="button"/g) >= 5),
    check("file_input_accepts_svga_only_boundary", htmlSource.includes('accept=".svga,application/octet-stream"')),
    check("focus_visible_styles_present", /button:focus-visible[\s\S]*\.fileButton:focus-within[\s\S]*summary:focus-visible[\s\S]*var\(--focus-ring\)/.test(cssSource)),
    check("disabled_buttons_have_visible_state", /button:disabled[\s\S]*opacity:\s*0\.48/.test(cssSource)),
    check("keyboard_open_shortcut_present", /metaKey \|\| event\.ctrlKey[\s\S]*key === "o"/.test(rendererSource)),
    check("keyboard_undo_redo_shortcuts_present", /key === "z"[\s\S]*undoEditHistory/.test(rendererSource) && /key === "y"[\s\S]*redoEditHistory/.test(rendererSource)),
    check("keyboard_space_toggles_playback", /event\.code === "Space"[\s\S]*playButton[\s\S]*pauseButton/.test(rendererSource)),
    check("keyboard_r_replays", /key === "r"[\s\S]*replayButton\.click/.test(rendererSource)),
    check("keyboard_ignores_text_inputs", rendererSource.includes("event.target instanceof HTMLInputElement")),
    check("error_state_has_retry_action", /function showError[\s\S]*data-error-select-button[\s\S]*重新选择 SVGA 文件/.test(rendererSource)),
    check("error_state_has_folded_technical_details", /function showError[\s\S]*<details class="errorDetails">[\s\S]*<summary>查看技术细节<\/summary>[\s\S]*<code>/.test(rendererSource)),
    check("error_detail_is_escaped", rendererSource.includes("escapeHtml(detail || message)")),
    check("resource_list_has_accessible_label", rendererSource.includes('role="listbox" aria-label="图像资源列表"')),
    check("edit_action_buttons_are_button_type", countMatches(rendererSource, /<button type="button" data-edit-action=/g) >= 6),
    check("decorative_resource_thumbnail_has_empty_alt", rendererSource.includes('alt=""'))
  ];
}

function buildAdvisories(input: { rendererSource: string }): Nq1AccessibilityAdvisory[] {
  const advisories: Nq1AccessibilityAdvisory[] = [
    {
      id: "axe_and_screen_reader_not_run",
      severity: "manual_review",
      message: "This audit is source-level only; axe, VoiceOver/NVDA, real keyboard traversal, and reduced-motion checks remain manual."
    }
  ];
  if (!/role="option"/.test(input.rendererSource)) {
    advisories.push({
      id: "resource_list_items_without_explicit_option_role",
      severity: "minor",
      message: "Resource items are native buttons inside a labelled listbox; keyboard activation is available, but explicit option semantics should be reviewed before production."
    });
  }
  return advisories;
}

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function check(id: string, passed: boolean): Nq1AccessibilitySourceCheck {
  return { id, passed };
}
