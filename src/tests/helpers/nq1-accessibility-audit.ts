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
    check("shared_product_shell_visible", htmlSource.includes('<main class="shell">')),
    check("main_workspace_has_accessible_name", htmlSource.includes('id="workspace"') && htmlSource.includes('aria-label="Preview workspace"')),
    check("info_panel_has_accessible_name", htmlSource.includes('id="infoPanel"') && htmlSource.includes('aria-label="SVGA info panel"')),
    check("logs_panel_has_accessible_name", htmlSource.includes('id="logsPanel"') && htmlSource.includes('aria-label="Runtime logs panel"')),
    check("canvas_hosts_have_accessible_labels", htmlSource.includes('aria-label="SVGA player A canvas"') && htmlSource.includes('aria-label="SVGA player B canvas"')),
    check("sync_controls_have_accessible_name", htmlSource.includes('id="syncBar"') && htmlSource.includes('aria-label="Synchronized playback controls"')),
    check("primary_buttons_are_button_type", countMatches(htmlSource, /<button[^>]+type="button"/g) >= 5),
    check("file_input_accepts_svga_only_boundary", htmlSource.includes('accept=".svga,application/octet-stream"')),
    check("focus_visible_styles_present", /button:focus-visible[\s\S]*label:has\(input:focus-visible\)[\s\S]*resizeHandle:focus-visible/.test(cssSource)),
    check("disabled_buttons_have_visible_state", /button:disabled[\s\S]*opacity:\s*0\.48/.test(cssSource) || /button:disabled[\s\S]*opacity:\s*0\.5/.test(cssSource)),
    check("keyboard_escape_closes_top_layer", /event\.key === "Escape"[\s\S]*closeAssetPreview[\s\S]*closeSettings[\s\S]*closeDropdown/.test(rendererSource)),
    check("keyboard_space_toggles_playback", /event\.code !== "Space"[\s\S]*toggleSyncPlayback[\s\S]*toggleSlot\(players\.a\)/.test(rendererSource)),
    check("keyboard_ignores_text_inputs", rendererSource.includes('["input", "select", "textarea"].includes(tagName)')),
    check("file_input_change_loads_svga", /svgaFileInput\.addEventListener\("change"[\s\S]*handleDroppedFile/.test(rendererSource)),
    check("drag_drop_loads_supported_files", /addEventListener\("dragover"[\s\S]*addEventListener\("drop"[\s\S]*handleDroppedFile/.test(rendererSource)),
    check("error_state_uses_visible_error_box", /function showError[\s\S]*errorBox\.hidden = false[\s\S]*errorBox\.textContent/.test(rendererSource)),
    check("error_text_is_normalized_for_bilingual_copy", rendererSource.includes('String(message).split(" / ")[0]')),
    check("resource_preview_buttons_are_button_type", countMatches(rendererSource, /<button[^>]+type="button"[^>]+data-preview-image-key=/g) >= 2),
    check("decorative_resource_thumbnail_has_empty_alt", rendererSource.includes('alt=""')),
    check("electron_entry_installs_host_adapter", rendererSource.includes("autoSvgaHostAdapter") && rendererSource.includes("editorIncubationDefaultVisible: false"))
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
