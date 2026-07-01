import {
  addRecentFile,
  clearRecentFileRecords,
  createDemoRecentFiles,
  createShortTermCommandModel,
  getLaunchRecentFiles,
  getMenuRecentFiles,
  getRecentStatusCopy,
  readRecentFilesFromStorage,
  writeRecentFilesToStorage
} from "./short-term-product-state.mjs";

function getInitialRecentFiles() {
  return readRecentFilesFromStorage(getRecentStorage(), createDemoRecentFiles());
}

function getRecentStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

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
  recentFiles: getInitialRecentFiles(),
  recentStatus: "ready",
  pendingTimer: undefined
};

const views = new Map(Array.from(document.querySelectorAll("[data-view]"), (node) => [node.dataset.view, node]));
const saveBanner = document.querySelector("#asvSaveBanner");
const textModal = document.querySelector("#asvTextModal");
const textInput = document.querySelector("#asvTextInput");
const launchRecentList = document.querySelector("#asvLaunchRecentList");
const fileRecentList = document.querySelector("#asvFileRecentList");
const recentStatus = document.querySelector("#asvRecentStatus");
const launchClearRecent = document.querySelector("#asvLaunchClearRecent");
const menuClearRecent = document.querySelector("#asvMenuClearRecent");

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

function startLoading(sample = "normal", openedFile = undefined) {
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
  state.recentStatus = "ready";
  textModal.hidden = true;
  setView("loading");
  state.pendingTimer = window.setTimeout(() => {
    if (sample === "invalid") {
      state.hasFile = false;
      setView("load-failed");
    } else {
      state.hasFile = true;
      rememberRecentFile(openedFile ?? {
        sourceId: "avatar-frame-basic",
        name: "avatar_frame_basic.svga",
        parent: "Frames"
      });
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

function openRecentFile(recentId) {
  const recentFile = state.recentFiles.find((file) => file.id === recentId);
  if (!recentFile) return;
  if (recentFile.missing) {
    state.hasFile = false;
    state.dirtyKind = null;
    state.saveStatus = "idle";
    state.playbackError = false;
    state.imageReplaced = false;
    state.textApplied = false;
    state.recentStatus = "missing";
    setView("launch");
    return;
  }
  startLoading("normal", recentFile);
}

function clearRecentFiles() {
  if (state.recentFiles.length === 0) return;
  state.recentFiles = clearRecentFileRecords();
  state.recentStatus = "cleared";
  writeRecentFilesToStorage(getRecentStorage(), state.recentFiles);
  render();
}

function rememberRecentFile(file) {
  state.recentFiles = addRecentFile(state.recentFiles, file);
  writeRecentFilesToStorage(getRecentStorage(), state.recentFiles);
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

function action(name, detail = {}) {
  switch (name) {
    case "open":
      startLoading("normal");
      break;
    case "open-recent":
      openRecentFile(detail.recentId);
      break;
    case "clear-recent":
      clearRecentFiles();
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

function createRecentButton(file, context) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = "open-recent";
  button.dataset.recentId = file.id;
  button.textContent = file.name;
  if (context === "menu") {
    button.setAttribute("role", "menuitem");
  }
  if (file.missing) {
    button.classList.add("isMissing");
    button.title = "文件不可访问，可清除记录或打开其他文件";
  }
  return button;
}

function renderLaunchRecentFiles() {
  launchRecentList.replaceChildren();
  const visibleFiles = getLaunchRecentFiles(state.recentFiles);
  for (const file of visibleFiles) {
    const item = document.createElement("li");
    item.classList.toggle("isMissing", Boolean(file.missing));
    const button = createRecentButton(file, "launch");
    const meta = document.createElement("span");
    meta.className = "asvRecentMeta";
    meta.textContent = `${file.time} · ${file.parent}`;
    item.append(button, meta);
    launchRecentList.append(item);
  }

  if (state.recentFiles.length === 0) {
    const item = document.createElement("li");
    item.className = "asvRecentEmpty";
    item.textContent = "暂无最近打开记录";
    launchRecentList.append(item);
  }

  recentStatus.textContent = getRecentStatusCopy(state.recentStatus);
  launchClearRecent.disabled = state.recentFiles.length === 0;
}

function renderMenuRecentFiles() {
  fileRecentList.replaceChildren();
  const visibleFiles = getMenuRecentFiles(state.recentFiles);
  for (const file of visibleFiles) {
    const button = createRecentButton(file, "menu");
    button.textContent = `${file.name} — ${file.parent}`;
    fileRecentList.append(button);
  }

  if (state.recentFiles.length === 0) {
    const empty = document.createElement("p");
    empty.className = "asvMenuEmpty";
    empty.setAttribute("role", "none");
    empty.textContent = "No Recent Files";
    fileRecentList.append(empty);
  }

  menuClearRecent.disabled = state.recentFiles.length === 0;
}

function renderRecentFiles() {
  renderLaunchRecentFiles();
  renderMenuRecentFiles();
}

function render() {
  document.body.dataset.asvView = state.view;
  document.body.dataset.asvMode = state.mode;
  renderRecentFiles();
  renderCommandAvailability();

  document.querySelectorAll("[data-needs-file]").forEach((button) => {
    button.disabled = !state.hasFile;
    button.title = state.hasFile ? "" : "请先打开 SVGA 文件";
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
    ? "已批量应用 2 项可安全执行优化，需复核和暂不支持项未进入批量；生成优化字节，等待明确保存。"
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

function renderCommandAvailability() {
  const commands = createShortTermCommandModel({
    hasFile: state.hasFile,
    selectedImageKey: state.hasFile ? state.imageKey : "",
    hasRuntimeReplacement: state.imageReplaced || state.textApplied,
    dirtyKind: state.dirtyKind,
    saveStatus: state.saveStatus,
    recentFiles: state.recentFiles,
    hasSafeOptimizationCandidates: state.hasFile,
    hasOptimizationOutput: state.dirtyKind === "optimization",
    isLoading: state.view === "loading"
  });
  applyCommandToActions(["clear-recent"], commands.clearRecent);
  applyCommandToActions(["compare"], commands.compare);
  applyCommandToActions(["toggle-play"], commands.playPause);
  applyCommandToActions(["replay"], commands.replay);
  applyCommandToActions(["rename"], commands.renameImageKey);
  applyCommandToActions(["replace-image"], commands.replacePreviewImage);
  applyCommandToActions(["run-optimization", "run-all-optimizations"], commands.runOptimization);
  applyCommandToActions(["save-overwrite"], commands.overwriteSave);
  applyCommandToActions(["save-as"], commands.saveAs);
}

function applyCommandToActions(actions, commandState) {
  const selector = actions.map((actionName) => `[data-action='${actionName}']`).join(", ");
  document.querySelectorAll(selector).forEach((button) => {
    button.disabled = !commandState.enabled;
    button.title = commandState.disabledReason;
  });
}

document.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  const tabTarget = event.target.closest("[data-tab]");
  if (actionTarget) action(actionTarget.dataset.action, actionTarget.dataset);
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
