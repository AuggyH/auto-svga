const state = {
  view: "launch",
  tab: "overview",
  mode: "preview",
  hasFile: false,
  dirty: false,
  playing: false,
  playbackError: false,
  imageReplaced: false,
  textApplied: false,
  noReplaceable: false
};

const views = {
  launch: document.querySelector("#launch"),
  loading: document.querySelector("#loading"),
  loadFailed: document.querySelector("#loadFailed"),
  workbench: document.querySelector("#workbench"),
  optimizationCompare: document.querySelector("#optimizationCompare"),
  compare: document.querySelector("#compare"),
  editReserved: document.querySelector("#editReserved")
};

function showView(view) {
  state.view = view;
  for (const [name, node] of Object.entries(views)) {
    const active = name === view;
    node.hidden = !active;
    node.classList.toggle("isActive", active);
  }
  document.body.dataset.view = view;
  render();
}

function openSample(noReplaceable = false) {
  state.noReplaceable = noReplaceable;
  state.hasFile = false;
  state.dirty = false;
  showView("loading");
  window.setTimeout(() => {
    state.hasFile = true;
    state.mode = "preview";
    state.tab = "overview";
    showView("workbench");
  }, 250);
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("isSelected", button.dataset.tab === tab);
  });
  document.querySelectorAll(".tabPanel").forEach((panel) => {
    const active = panel.id === `tab-${tab}`;
    panel.hidden = !active;
    panel.classList.toggle("isActive", active);
  });
  render();
}

function save(kind) {
  if (!state.dirty) return;
  const banner = document.querySelector("#saveBanner");
  banner.hidden = false;
  banner.innerHTML = `
    <section class="panel">
      <span class="badge">${kind === "saveAs" ? "另存为" : "覆盖保存"}</span>
      <h2>正在验证保存输出</h2>
      <p>写入明确输出 -> inflate/decode 检查 -> 重新打开验证。</p>
      <button type="button" data-action="save-success" class="primary">验证通过</button>
      <button type="button" data-action="save-failure">显示失败</button>
    </section>
  `;
  document.querySelectorAll("[data-save]").forEach((button) => {
    button.disabled = true;
  });
}

function updateSaveComplete() {
  state.dirty = false;
  const banner = document.querySelector("#saveBanner");
  banner.innerHTML = `
    <section class="panel">
      <span class="badge success">保存完成</span>
      <h2>已保存并通过验证</h2>
      <p>输出重新打开成功，当前状态已恢复为干净。</p>
      <button type="button" data-action="dismiss-save" class="primary">继续预览</button>
    </section>
  `;
  render();
}

function updateSaveFailed() {
  const banner = document.querySelector("#saveBanner");
  banner.innerHTML = `
    <section class="panel">
      <span class="badge danger">保存失败</span>
      <h2>保存输出未通过验证</h2>
      <p>源文件修改状态明确。可重试、另存为或返回预览。</p>
      <button type="button" data-action="save-as">另存为...</button>
      <button type="button" data-action="dismiss-save" class="primary">返回预览</button>
    </section>
  `;
  render();
}

function render() {
  document.body.dataset.mode = state.mode;
  document.querySelector("#identity").textContent = identityText();
  document.querySelector("#playButton").textContent = state.playing ? "暂停" : "播放";
  document.querySelector("#playbackStatus").textContent = state.playbackError ? "播放异常" : state.playing ? "播放中" : "播放就绪";
  document.querySelector("#previewNote").textContent = state.playbackError ? "播放失败。可重播或重新打开文件恢复。" : "预览模式保持激活。";
  document.querySelector("#runtimeImage").hidden = !state.imageReplaced;
  document.querySelector("#runtimeText").hidden = !state.textApplied;
  document.querySelector("#replaceableContent").hidden = state.noReplaceable;
  document.querySelector("#noReplaceableContent").hidden = !state.noReplaceable;

  document.querySelectorAll("[data-needs-file]").forEach((button) => {
    button.disabled = !state.hasFile;
  });
  document.querySelectorAll("[data-save]").forEach((button) => {
    button.disabled = !state.dirty;
  });
  document.querySelectorAll(".segmented button").forEach((button) => {
    const selected = button.dataset.action === `${state.mode}-mode`;
    button.classList.toggle("isSelected", selected);
  });
}

function identityText() {
  if (state.view === "loading") return "正在载入本地 SVGA...";
  if (state.view === "loadFailed") return "载入失败 - 源文件未修改";
  if (state.view === "optimizationCompare") return "优化对比 - 输出待保存";
  if (state.view === "compare") return "普通对比模式";
  if (state.view === "editReserved") return "avatar_frame_basic.svga - 编辑模式保留态";
  if (state.hasFile && state.noReplaceable) return "no_replaceable_sample.svga - 无可替换元素";
  if (state.hasFile) return "avatar_frame_basic.svga - 812 KB - 30 FPS";
  return "未打开文件";
}

function handleAction(action) {
  switch (action) {
    case "open":
      openSample(false);
      break;
    case "open-empty":
      openSample(true);
      break;
    case "fail-load":
      state.hasFile = false;
      showView("loadFailed");
      break;
    case "compare":
      if (state.hasFile) showView("compare");
      break;
    case "run-optimization":
      if (state.hasFile) {
        state.dirty = true;
        state.tab = "optimization";
        showView("optimizationCompare");
      }
      break;
    case "preview-mode":
      state.mode = "preview";
      if (state.hasFile) showView("workbench");
      break;
    case "edit-mode":
      if (state.hasFile) {
        state.mode = "edit";
        showView("editReserved");
      }
      break;
    case "back-preview":
      state.mode = "preview";
      if (state.hasFile) showView("workbench");
      break;
    case "toggle-play":
      state.playing = !state.playing;
      state.playbackError = false;
      render();
      break;
    case "playback-error":
      if (state.hasFile) {
        state.playbackError = true;
        state.playing = false;
        showView("workbench");
      }
      break;
    case "rename":
      if (state.hasFile && !state.noReplaceable) {
        setTab("replaceable");
        document.querySelector("#imageKeyLabel").textContent = "profile_frame_hero";
        state.dirty = true;
      }
      break;
    case "replace-image":
      if (state.hasFile && !state.noReplaceable) {
        setTab("replaceable");
        state.imageReplaced = true;
      }
      break;
    case "edit-text":
      if (state.hasFile && !state.noReplaceable) {
        document.querySelector("#textModal").hidden = false;
      }
      break;
    case "close-text":
      document.querySelector("#textModal").hidden = true;
      break;
    case "apply-text":
      state.textApplied = true;
      document.querySelector("#textModal").hidden = true;
      render();
      break;
    case "save-overwrite":
      save("overwrite");
      break;
    case "save-as":
      save("saveAs");
      break;
    case "save-success":
      updateSaveComplete();
      break;
    case "save-failure":
      updateSaveFailed();
      break;
    case "dismiss-save":
      document.querySelector("#saveBanner").hidden = true;
      render();
      break;
  }
}

document.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  const tabTarget = event.target.closest("[data-tab]");
  if (actionTarget) handleAction(actionTarget.dataset.action);
  if (tabTarget) setTab(tabTarget.dataset.tab);
});

document.addEventListener("keydown", (event) => {
  const command = event.metaKey || event.ctrlKey;
  if (command && event.key.toLowerCase() === "o") {
    event.preventDefault();
    openSample(false);
  }
  if (command && event.key.toLowerCase() === "r") {
    event.preventDefault();
    handleAction("rename");
  }
  if (event.key === " " && !event.target.matches("input, textarea")) {
    event.preventDefault();
    handleAction("toggle-play");
  }
  if (event.key === "Escape") {
    document.querySelector("#textModal").hidden = true;
    if (state.view === "compare" || state.view === "optimizationCompare") {
      handleAction("back-preview");
    }
  }
});

render();
