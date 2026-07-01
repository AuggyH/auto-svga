const state = {
  view: "launch",
  tab: "overview",
  mode: "preview",
  hasFile: false,
  sample: "normal",
  dirtyKind: null,
  saveStatus: "idle",
  playing: false,
  playbackError: false,
  imageReplaced: false,
  textApplied: false,
  imageKey: "profile_frame_highlight",
  optimizationMode: "single",
  pendingTimer: undefined
};

const views = new Map(Array.from(document.querySelectorAll("[data-view]"), (node) => [node.dataset.view, node]));
const saveBanner = document.querySelector("#asvSaveBanner");
const textModal = document.querySelector("#asvTextModal");
const textInput = document.querySelector("#asvTextInput");

function clearPendingTimer() {
  if (state.pendingTimer) {
    window.clearTimeout(state.pendingTimer);
    state.pendingTimer = undefined;
  }
}

function setView(view) {
  state.view = view;
  for (const [name, node] of views) {
    const active = name === view;
    node.hidden = !active;
    node.classList.toggle("isActive", active);
  }
  render();
}

function startLoading(sample = "normal") {
  clearPendingTimer();
  state.sample = sample;
  state.hasFile = false;
  state.dirtyKind = null;
  state.saveStatus = "idle";
  state.mode = "preview";
  state.playbackError = false;
  state.imageReplaced = false;
  state.textApplied = false;
  state.optimizationMode = "single";
  textModal.hidden = true;
  setView("loading");
  state.pendingTimer = window.setTimeout(() => {
    if (sample === "invalid") {
      state.hasFile = false;
      setView("load-failed");
    } else {
      state.hasFile = true;
      state.tab = "overview";
      setView("workbench");
    }
  }, 360);
}

function setTab(tab) {
  state.tab = tab;
  state.mode = "preview";
  if (state.hasFile) setView("workbench");
  render();
}

function startOptimizationCompare(mode = "single") {
  if (!state.hasFile) return;
  state.tab = "optimization";
  state.dirtyKind = "optimization";
  state.optimizationMode = mode;
  setView("optimization-compare");
}

function setMode(mode) {
  state.mode = mode;
  if (!state.hasFile) {
    setView("launch");
    return;
  }
  setView(mode === "edit" ? "edit" : "workbench");
}

function startSave(kind) {
  if (!state.dirtyKind || state.saveStatus === "validating") return;
  state.saveStatus = "validating";
  saveBanner.hidden = false;
  saveBanner.innerHTML = `
    <section class="asvPanel">
      <span class="asvBadge">${kind === "saveAs" ? "另存为" : "覆盖保存"}</span>
      <h2>正在验证保存输出</h2>
      <p>写入明确输出 -> inflate/decode 检查 -> 重新打开验证。</p>
      <div class="asvActionRow">
        <button type="button" data-action="save-failure">显示失败</button>
        <button class="asvPrimary" type="button" data-action="save-success">验证通过</button>
      </div>
    </section>
  `;
  render();
}

function finishSave() {
  state.saveStatus = "complete";
  state.dirtyKind = null;
  saveBanner.hidden = false;
  saveBanner.innerHTML = `
    <section class="asvPanel">
      <span class="asvBadge asvSuccess">保存完成</span>
      <h2>已保存并通过验证</h2>
      <p>输出重新打开成功，当前状态已恢复为干净。</p>
      <button class="asvPrimary" type="button" data-action="dismiss-save">继续预览</button>
    </section>
  `;
  render();
}

function failSave() {
  state.saveStatus = "failed";
  saveBanner.hidden = false;
  saveBanner.innerHTML = `
    <section class="asvPanel">
      <span class="asvBadge asvDanger">保存失败</span>
      <h2>保存输出未通过验证</h2>
      <p>源文件修改状态明确。可重试、另存为或返回预览。</p>
      <div class="asvActionRow">
        <button type="button" data-action="save-as">另存为...</button>
        <button class="asvPrimary" type="button" data-action="dismiss-save">返回预览</button>
      </div>
    </section>
  `;
  render();
}

function action(name) {
  switch (name) {
    case "open":
      startLoading("normal");
      break;
    case "open-invalid":
    case "fail-load":
      startLoading("invalid");
      break;
    case "compare":
      if (state.hasFile) setView("compare");
      break;
    case "back-preview":
      setMode("preview");
      break;
    case "mode-preview":
      setMode("preview");
      break;
    case "mode-edit":
      setMode("edit");
      break;
    case "toggle-play":
      if (!state.hasFile) return;
      state.playing = !state.playing;
      state.playbackError = false;
      render();
      break;
    case "replay":
      if (!state.hasFile) return;
      state.playing = true;
      state.playbackError = false;
      render();
      break;
    case "playback-error":
      if (!state.hasFile) return;
      state.playing = false;
      state.playbackError = true;
      setView("workbench");
      break;
    case "tab-optimization":
      setTab("optimization");
      break;
    case "run-optimization":
      startOptimizationCompare("single");
      break;
    case "run-all-optimizations":
      startOptimizationCompare("batch");
      break;
    case "rename":
      if (!state.hasFile || state.sample === "empty") return;
      state.imageKey = "profile_frame_hero";
      state.dirtyKind = "rename";
      setTab("replaceable");
      break;
    case "replace-image":
      if (!state.hasFile || state.sample === "empty") return;
      state.imageReplaced = true;
      setTab("replaceable");
      break;
    case "edit-text":
      if (!state.hasFile || state.sample === "empty") return;
      textModal.hidden = false;
      textInput.focus();
      break;
    case "close-text":
      textModal.hidden = true;
      break;
    case "apply-text":
      state.textApplied = true;
      document.querySelector("#asvRuntimeText").textContent = textInput.value.trim() || "SVGA VIP";
      textModal.hidden = true;
      render();
      break;
    case "save-overwrite":
      startSave("overwrite");
      break;
    case "save-as":
      startSave("saveAs");
      break;
    case "save-success":
      finishSave();
      break;
    case "save-failure":
      failSave();
      break;
    case "dismiss-save":
      saveBanner.hidden = true;
      state.saveStatus = "idle";
      render();
      break;
  }
}

function render() {
  document.body.dataset.asvView = state.view;
  document.body.dataset.asvMode = state.mode;

  document.querySelectorAll("[data-needs-file]").forEach((button) => {
    button.disabled = !state.hasFile;
    button.title = state.hasFile ? "" : "请先打开 SVGA 文件";
  });
  document.querySelectorAll("[data-save-action]").forEach((button) => {
    button.disabled = !state.dirtyKind || state.saveStatus === "validating";
    button.title = state.dirtyKind ? "有待保存输出" : "没有可保存的输出";
  });
  document.querySelectorAll("[data-action='mode-preview'], [data-action='mode-edit']").forEach((button) => {
    button.classList.toggle("isSelected", button.dataset.action === `mode-${state.mode}`);
  });
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("isSelected", button.dataset.tab === state.tab);
    button.setAttribute("aria-selected", button.dataset.tab === state.tab ? "true" : "false");
  });
  document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
    const active = panel.dataset.tabPanel === state.tab;
    panel.hidden = !active;
    panel.classList.toggle("isActive", active);
  });

  document.querySelector("#asvPlayButton").textContent = state.playbackError ? "重试播放" : state.playing ? "暂停" : "播放";

  document.querySelector("#asvOptimizationMetric").textContent = state.optimizationMode === "batch" ? "-108 KB" : "-76 KB";
  document.querySelector("#asvOptimizationSummary").textContent = state.optimizationMode === "batch"
    ? "已批量应用透明边界裁剪和未引用资源清理，生成优化字节，等待明确保存。"
    : "已应用透明边界裁剪，生成优化字节，等待明确保存。";

  document.querySelector("#asvImageKey").textContent = state.imageKey;
  document.querySelector("#asvImageStatus").textContent = state.imageReplaced
    ? "运行时图片已替换，可重置。当前不产生可保存输出。"
    : "自动命名资源已排除。";
  document.querySelector("#asvTextStatus").textContent = state.textApplied
    ? "运行时文本已应用。源 SVGA 字节不修改。"
    : "运行时动态文本预览，不写入 SVGA 字节。";
  document.querySelector("#asvRuntimeImage").hidden = !state.imageReplaced;
  document.querySelector("#asvRuntimeText").hidden = !state.textApplied;
}

document.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  const tabTarget = event.target.closest("[data-tab]");
  if (actionTarget) action(actionTarget.dataset.action);
  if (tabTarget) setTab(tabTarget.dataset.tab);
});

document.addEventListener("keydown", (event) => {
  const command = event.metaKey || event.ctrlKey;
  const isTextInput = event.target.matches("input, textarea, [contenteditable='true']");
  if (command && event.key.toLowerCase() === "o") {
    event.preventDefault();
    startLoading("normal");
  }
  if (command && event.key.toLowerCase() === "r") {
    event.preventDefault();
    action("rename");
  }
  if (command && event.key.toLowerCase() === "s") {
    event.preventDefault();
    action(event.shiftKey ? "save-as" : "save-overwrite");
  }
  if (event.key === " " && !isTextInput) {
    event.preventDefault();
    action("toggle-play");
  }
  if (event.key === "Escape") {
    textModal.hidden = true;
    if (state.view === "compare" || state.view === "optimization-compare") action("back-preview");
  }
});

render();
