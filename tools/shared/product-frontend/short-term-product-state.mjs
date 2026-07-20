export const RECENT_STORAGE_KEY = "auto-svga.short-term.recent-files.v1";
export const MAX_LAUNCH_RECENT_FILES = 5;
export const MAX_MENU_RECENT_FILES = 10;

const DEFAULT_PARENT = "本地文件";

export function createDemoRecentFiles() {
  return [
    createRecentFileRecord({ sourceId: "avatar-frame-basic", name: "avatar_frame_basic.svga", parent: "Frames", time: "今天 14:32", lastOpenedAt: 10 }),
    createRecentFileRecord({ sourceId: "festival-badge-preview", name: "festival_badge_preview.svga", parent: "Campaign", time: "今天 11:08", lastOpenedAt: 9 }),
    createRecentFileRecord({ sourceId: "vip-level-ring", name: "vip_level_ring.svga", parent: "VIP", time: "昨天 19:44", lastOpenedAt: 8, missing: true }),
    createRecentFileRecord({ sourceId: "gift-frame-gold", name: "gift_frame_gold.svga", parent: "Gifts", time: "昨天 16:21", lastOpenedAt: 7 }),
    createRecentFileRecord({ sourceId: "profile-aura-blue", name: "profile_aura_blue.svga", parent: "Profile", time: "周二", lastOpenedAt: 6 }),
    createRecentFileRecord({ sourceId: "shop-medal-entry", name: "shop_medal_entry.svga", parent: "Shop", time: "周一", lastOpenedAt: 5 }),
    createRecentFileRecord({ sourceId: "live-room-badge", name: "live_room_badge.svga", parent: "Live", time: "6月29日", lastOpenedAt: 4 }),
    createRecentFileRecord({ sourceId: "rank-top3-frame", name: "rank_top3_frame.svga", parent: "Rank", time: "6月28日", lastOpenedAt: 3 }),
    createRecentFileRecord({ sourceId: "summer-campaign", name: "summer_campaign.svga", parent: "Campaign", time: "6月27日", lastOpenedAt: 2 }),
    createRecentFileRecord({ sourceId: "creator-avatar-fx", name: "creator_avatar_fx.svga", parent: "Creator", time: "6月26日", lastOpenedAt: 1 })
  ];
}

export function createRecentFileRecord(input = {}, options = {}) {
  const filePath = stringOrEmpty(input.path ?? input.fullPath ?? input.filePath);
  const name = sanitizeDisplayPart(input.name) || basenameFromPath(filePath);
  if (!name) return undefined;
  const parent = sanitizeDisplayPart(input.parent) || parentNameFromPath(filePath) || DEFAULT_PARENT;
  const sourceId = sanitizeIdentifier(input.sourceId ?? input.id) || stableRecentId(name, parent);
  const lastOpenedAt = finiteNumber(input.lastOpenedAt) ?? finiteNumber(options.now) ?? Date.now();
  return {
    id: sourceId,
    sourceId,
    name,
    parent,
    time: sanitizeDisplayPart(input.time) || "刚刚",
    lastOpenedAt,
    missing: Boolean(input.missing)
  };
}

export function normalizeRecentFiles(files = []) {
  const records = [];
  const seen = new Set();
  for (const file of Array.isArray(files) ? files : []) {
    const record = createRecentFileRecord(file);
    if (!record) continue;
    const key = recentDedupeKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    records.push(record);
  }
  return records.slice(0, MAX_MENU_RECENT_FILES);
}

export function addRecentFile(files = [], input = {}, options = {}) {
  const nextRecord = createRecentFileRecord({
    ...input,
    time: options.time ?? "刚刚",
    lastOpenedAt: options.now ?? Date.now()
  }, options);
  if (!nextRecord) return normalizeRecentFiles(files);
  return [
    nextRecord,
    ...normalizeRecentFiles(files).filter((file) => recentDedupeKey(file) !== recentDedupeKey(nextRecord))
  ].slice(0, MAX_MENU_RECENT_FILES);
}

export function clearRecentFileRecords() {
  return [];
}

export function getLaunchRecentFiles(files = []) {
  return normalizeRecentFiles(files).slice(0, MAX_LAUNCH_RECENT_FILES);
}

export function getMenuRecentFiles(files = []) {
  return normalizeRecentFiles(files).slice(0, MAX_MENU_RECENT_FILES);
}

export function readRecentFilesFromStorage(storage, fallback = []) {
  if (!storage?.getItem) return normalizeRecentFiles(fallback);
  try {
    const raw = storage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return normalizeRecentFiles(fallback);
    const parsed = JSON.parse(raw);
    return normalizeRecentFiles(parsed);
  } catch {
    return normalizeRecentFiles(fallback);
  }
}

export function writeRecentFilesToStorage(storage, files = []) {
  if (!storage?.setItem) return;
  try {
    storage.setItem(RECENT_STORAGE_KEY, JSON.stringify(normalizeRecentFiles(files)));
  } catch {
    // Recent files are a convenience workflow; storage failures must not block SVGA preview.
  }
}

export function removeRecentFilesFromStorage(storage) {
  if (!storage?.removeItem) return;
  try {
    storage.removeItem(RECENT_STORAGE_KEY);
  } catch {
    // Keep host/renderer storage failures non-fatal for local file work.
  }
}

export function getRecentStatusCopy(status) {
  const statusCopy = {
    ready: "最近记录仅显示文件名和父级位置，不展示完整本地路径。",
    missing: "这个最近文件已缺失或不可访问。可以打开其他文件，或清除最近记录。",
    cleared: "最近记录已清除，源文件不会被删除。"
  };
  return statusCopy[status] || statusCopy.ready;
}

export function createShortTermCommandModel(input = {}) {
  const hasFile = Boolean(input.hasFile);
  const hasDirtyOutput = Boolean(input.dirtyKind);
  const saveBusy = input.saveStatus === "validating";
  const hasRecentFiles = normalizeRecentFiles(input.recentFiles).length > 0;
  const canUseFileActions = !input.isLoading;
  return Object.freeze({
    openSvga: command(true, ""),
    closeFile: command(hasFile, "请先打开 SVGA 文件"),
    clearRecent: command(hasRecentFiles, "暂无最近打开记录"),
    compare: command(hasFile, "请先打开 SVGA 文件"),
    playPause: command(hasFile, "请先打开 SVGA 文件"),
    replay: command(hasFile, "请先打开 SVGA 文件"),
    renameImageKey: command(hasFile && Boolean(input.selectedImageKey), "请选择一个可重命名的图片资源"),
    replacePreviewImage: command(hasFile && Boolean(input.selectedImageKey), "请选择一个可替换图片元素"),
    resetPreviewReplacement: command(hasFile && Boolean(input.hasRuntimeReplacement), "当前没有运行时替换预览"),
    checkOptimization: command(hasFile, "请先打开 SVGA 文件"),
    runOptimization: command(hasFile && Boolean(input.hasSafeOptimizationCandidates), "没有可安全执行的优化项"),
    showOptimizationComparison: command(Boolean(input.hasOptimizationOutput), "还没有优化输出"),
    overwriteSave: command(canUseFileActions && hasDirtyOutput && !saveBusy, hasDirtyOutput ? "正在验证保存输出" : "没有可保存的输出"),
    saveAs: command(canUseFileActions && hasDirtyOutput && !saveBusy, hasDirtyOutput ? "正在验证保存输出" : "没有可保存的输出")
  });
}

export function createShortTermMenuModel(input = {}) {
  const commands = createShortTermCommandModel(input);
  const recentCount = getMenuRecentFiles(input.recentFiles).length;
  return deepFreeze([
    menu("app", "Auto SVGA", [
      menuItem("about", "关于 Auto SVGA", command(true, "")),
      menuItem("settings", "设置...", command(true, "")),
      menuItem("hide", "隐藏 Auto SVGA", command(true, "")),
      menuItem("quit", "退出 Auto SVGA", command(true, ""))
    ]),
    menu("file", "File", [
      menuItem("openSvga", "打开 SVGA...", commands.openSvga, "Cmd+O"),
      menuItem("closeFile", "关闭文件", commands.closeFile),
      menuItem("recent", `最近打开 (${recentCount})`, command(recentCount > 0, "暂无最近打开记录")),
      menuItem("clearRecent", "清除最近记录", commands.clearRecent),
      menuItem("overwriteSave", "覆盖保存", commands.overwriteSave, "Cmd+S"),
      menuItem("saveAs", "另存为...", commands.saveAs, "Cmd+Shift+S")
    ]),
    menu("edit", "Edit", [
      menuItem("copy", "复制", command(true, ""), "Cmd+C"),
      menuItem("selectAll", "全选", command(true, ""), "Cmd+A"),
      menuItem("renameImageKey", "重命名 imageKey", commands.renameImageKey, "Cmd+R"),
      menuItem("cancelTransientState", "取消当前操作", command(true, ""), "Esc")
    ]),
    menu("view", "View", [
      menuItem("previewMode", "预览模式", command(true, "")),
      menuItem("editMode", "编辑模式", command(true, "")),
      menuItem("compare", "进入/退出对比", commands.compare)
    ]),
    menu("playback", "Playback", [
      menuItem("playPause", "播放/暂停", commands.playPause, "Space"),
      menuItem("replay", "重播", commands.replay)
    ]),
    menu("resource", "Resource", [
      menuItem("renameImageKey", "重命名 imageKey", commands.renameImageKey, "Cmd+R"),
      menuItem("replacePreviewImage", "替换预览图片", commands.replacePreviewImage),
      menuItem("resetPreviewReplacement", "重置预览替换", commands.resetPreviewReplacement)
    ]),
    menu("optimize", "Optimize", [
      menuItem("checkOptimization", "检查优化机会", commands.checkOptimization),
      menuItem("runOptimization", "执行安全优化", commands.runOptimization),
      menuItem("showOptimizationComparison", "显示优化对比", commands.showOptimizationComparison)
    ]),
    menu("window", "Window", [
      menuItem("minimize", "最小化", command(true, "")),
      menuItem("zoom", "缩放", command(true, "")),
      menuItem("bringAllToFront", "全部置于前台", command(true, ""))
    ]),
    menu("help", "Help", [
      menuItem("help", "Auto SVGA 帮助", command(true, "")),
      menuItem("knownLimitations", "已知限制", command(true, "")),
      menuItem("showLogs", "显示日志", command(true, ""))
    ])
  ]);
}

function command(enabled, disabledReason) {
  return Object.freeze({
    enabled: Boolean(enabled),
    disabledReason: enabled ? "" : disabledReason
  });
}

function menu(id, label, items) {
  return { id, label, items };
}

function menuItem(id, label, state, shortcut = "") {
  return {
    id,
    label,
    shortcut,
    enabled: state.enabled,
    disabledReason: state.disabledReason
  };
}

function deepFreeze(value) {
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return Object.freeze(value);
}

function recentDedupeKey(file) {
  return file.sourceId || `${file.parent}/${file.name}`;
}

function stableRecentId(name, parent) {
  return `${parent}/${name}`.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "recent-svga";
}

function basenameFromPath(filePath) {
  if (!filePath) return "";
  const parts = filePath.split(/[\\/]+/).filter(Boolean);
  return sanitizeDisplayPart(parts.at(-1));
}

function parentNameFromPath(filePath) {
  if (!filePath) return "";
  const parts = filePath.split(/[\\/]+/).filter(Boolean);
  if (parts.length < 2) return "";
  return sanitizeDisplayPart(parts.at(-2));
}

function sanitizeIdentifier(value) {
  return stringOrEmpty(value).replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
}

function sanitizeDisplayPart(value) {
  return stringOrEmpty(value).replace(/[\\/]+/g, " ").replace(/\s+/g, " ").trim();
}

function stringOrEmpty(value) {
  return typeof value === "string" ? value : "";
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
