const commonFactIds = new Set([
  "format",
  "dimensions",
  "duration",
  "layers",
  "assets",
  "replaceable",
  "unsupported"
]);

const formatFactIds = Object.freeze({
  svga: commonFactIds,
  lottie: commonFactIds,
  vap: new Set([...commonFactIds, "videoCodec", "audio"])
});

const formatInventoryGroups = Object.freeze({
  svga: new Set([
    "image_resources",
    "text_candidates",
    "sequence_frames",
    "audio_video_media",
    "unsupported_or_missing",
    "other_resources"
  ]),
  lottie: new Set([
    "image_resources",
    "text_candidates",
    "sequence_frames",
    "unsupported_or_missing",
    "other_resources"
  ]),
  vap: new Set([
    "vap_fusion_images",
    "vap_fusion_texts",
    "audio_video_media",
    "unsupported_or_missing",
    "other_resources"
  ])
});

const internalPhasePattern = /(?:hidden_0\.2_spike|source-side preview contract|preview candidate)/iu;

export function projectMultiFormatRightPanel(model = {}) {
  const format = model.detectedFormat;
  const source = model.rightPanel ?? {};
  const allowedFacts = formatFactIds[format] ?? commonFactIds;
  const facts = (source.facts ?? []).filter((fact) => allowedFacts.has(fact.id));
  const inventory = projectInventory(source.assetInventory, format);
  return {
    ...source,
    facts,
    assetInventory: inventory,
    unsupportedFeatures: (source.unsupportedFeatures ?? [])
      .filter(isOwnerVisibleUnsupportedFeature)
      .map((entry) => ({ ...entry, feature: ownerCopy(entry.feature), path: ownerCopy(entry.path) })),
    issues: (source.issues ?? [])
      .filter(isOwnerVisibleIssue)
      .map((issue) => ({ ...issue, message: ownerCopy(issue.message) }))
  };
}

export function containMotionMedia({ width, height }, { width: availableWidth, height: availableHeight }) {
  const mediaWidth = finitePositive(width);
  const mediaHeight = finitePositive(height);
  const stageWidth = finitePositive(availableWidth);
  const stageHeight = finitePositive(availableHeight);
  if (!mediaWidth || !mediaHeight || !stageWidth || !stageHeight) {
    return { width: 0, height: 0, scale: 0 };
  }
  const scale = Math.min(stageWidth / mediaWidth, stageHeight / mediaHeight);
  return {
    width: Math.max(1, Math.round(mediaWidth * scale)),
    height: Math.max(1, Math.round(mediaHeight * scale)),
    scale
  };
}

export function isOwnerVisibleIssue(issue) {
  return issue && !internalPhasePattern.test(`${issue.code ?? ""} ${issue.message ?? ""}`);
}

function isOwnerVisibleUnsupportedFeature(entry) {
  return entry && !internalPhasePattern.test(`${entry.feature ?? ""} ${entry.path ?? ""}`);
}

function projectInventory(inventory, format) {
  if (!inventory) return inventory;
  const allowedGroups = formatInventoryGroups[format] ?? new Set();
  const groups = (inventory.groups ?? []).flatMap((group) => {
    if (!allowedGroups.has(group.id) || group.status === "not_applicable") return [];
    const items = (group.items ?? []).filter((item) => (
      item.status !== "not_applicable"
      && item.source !== "capability"
      && !internalPhasePattern.test(`${item.label ?? ""} ${(item.detail ?? []).join(" ")}`)
    ));
    if (items.length === 0) return [];
    return [{
      ...group,
      count: items.length,
      replaceableCount: items.filter(({ replaceable }) => replaceable).length,
      items
    }];
  });
  const summary = {
    totalItems: groups.reduce((sum, group) => sum + group.count, 0),
    replaceableItems: groups.reduce((sum, group) => sum + group.replaceableCount, 0),
    imageCount: countGroups(groups, ["image_resources", "vap_fusion_images"]),
    textCount: countGroups(groups, ["text_candidates", "vap_fusion_texts"]),
    sequenceFrameCount: countGroups(groups, ["sequence_frames"]),
    audioVideoCount: countGroups(groups, ["audio_video_media"]),
    unsupportedOrMissingCount: countGroups(groups, ["unsupported_or_missing"])
  };
  return {
    ...inventory,
    groups,
    summary,
    capabilityMarkers: []
  };
}

function countGroups(groups, ids) {
  return groups
    .filter(({ id }) => ids.includes(id))
    .reduce((sum, group) => sum + group.count, 0);
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function ownerCopy(value) {
  return String(value ?? "")
    .replace(/preview candidate/giu, "file")
    .replace(/candidate/giu, "file");
}
