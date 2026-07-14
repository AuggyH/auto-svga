"use strict";

const ACCEPTANCE_DISPLAY_ARGUMENT = "--auto-svga-acceptance-display-id=";
const ACCEPTANCE_ARGUMENT_PREFIX = "--auto-svga-acceptance-";
const ACCEPTANCE_EXECUTION_ENV = "AUTO_SVGA_ACCEPTANCE_EXECUTION_ID";
const MAX_DISPLAY_ID = 0xffffffff;

function normalizePositiveInteger(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function normalizeRect(value, fallback) {
  const source = value && typeof value === "object" ? value : {};
  return {
    x: Number.isFinite(source.x) ? Math.round(source.x) : fallback.x,
    y: Number.isFinite(source.y) ? Math.round(source.y) : fallback.y,
    width: normalizePositiveInteger(source.width, fallback.width),
    height: normalizePositiveInteger(source.height, fallback.height)
  };
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function clampSizeToWorkArea(size, workArea, minimumSize) {
  const fallbackSize = normalizeRect(size, { x: 0, y: 0, width: 640, height: 640 });
  const area = normalizeRect(workArea, { x: 0, y: 0, width: fallbackSize.width, height: fallbackSize.height });
  const minimum = normalizeRect(minimumSize, { x: 0, y: 0, width: 1, height: 1 });
  const minWidth = Math.min(minimum.width, area.width);
  const minHeight = Math.min(minimum.height, area.height);

  return {
    width: clamp(fallbackSize.width, minWidth, area.width),
    height: clamp(fallbackSize.height, minHeight, area.height)
  };
}

function preserveWindowSizeAcrossDisplay({ currentBounds, preservedSize, workArea, minimumSize }) {
  const area = normalizeRect(workArea, { x: 0, y: 0, width: 640, height: 640 });
  const bounds = normalizeRect(currentBounds, {
    x: area.x,
    y: area.y,
    width: preservedSize?.width ?? 640,
    height: preservedSize?.height ?? 640
  });
  const size = clampSizeToWorkArea(preservedSize ?? bounds, area, minimumSize);
  const maxX = area.x + area.width - size.width;
  const maxY = area.y + area.height - size.height;

  return {
    x: clamp(bounds.x, area.x, maxX),
    y: clamp(bounds.y, area.y, maxY),
    width: size.width,
    height: size.height
  };
}

function sameWindowBounds(a, b) {
  return Boolean(a && b)
    && Math.round(a.x) === Math.round(b.x)
    && Math.round(a.y) === Math.round(b.y)
    && Math.round(a.width) === Math.round(b.width)
    && Math.round(a.height) === Math.round(b.height);
}

function strictRect(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const fields = [value.x, value.y, value.width, value.height];
  if (!fields.every(Number.isFinite)) return undefined;
  const rect = {
    x: Math.round(value.x),
    y: Math.round(value.y),
    width: Math.round(value.width),
    height: Math.round(value.height)
  };
  if (rect.width <= 0 || rect.height <= 0) return undefined;
  return rect;
}

function boundedDisplayId(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_DISPLAY_ID
    ? value
    : undefined;
}

function normalizeDisplay(value) {
  const id = boundedDisplayId(value?.id);
  const workArea = strictRect(value?.workArea);
  return id === undefined || !workArea ? undefined : { id, workArea };
}

function minimumFitsWorkArea(minimumSize, workArea) {
  const minimum = strictRect({ x: 0, y: 0, ...minimumSize });
  const area = strictRect(workArea);
  return Boolean(minimum && area && area.width >= minimum.width && area.height >= minimum.height);
}

function isWindowContainedInWorkArea(bounds, workArea) {
  const rect = strictRect(bounds);
  const area = strictRect(workArea);
  if (!rect || !area) return false;
  return rect.x >= area.x
    && rect.y >= area.y
    && rect.x + rect.width <= area.x + area.width
    && rect.y + rect.height <= area.y + area.height;
}

function centeredBounds(size, workArea, minimumSize) {
  if (!minimumFitsWorkArea(minimumSize, workArea)) return undefined;
  const area = strictRect(workArea);
  const fitted = clampSizeToWorkArea(size, area, minimumSize);
  return {
    x: Math.round(area.x + (area.width - fitted.width) / 2),
    y: Math.round(area.y + (area.height - fitted.height) / 2),
    width: fitted.width,
    height: fitted.height
  };
}

function normalizeWindowPlacementRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.source !== "owner-normal-window") return undefined;
  const bounds = strictRect(value.bounds);
  if (!bounds) return undefined;
  if (value.displayId !== undefined && boundedDisplayId(value.displayId) === undefined) return undefined;
  if (value.savedAt !== undefined && (typeof value.savedAt !== "string" || !Number.isFinite(Date.parse(value.savedAt)))) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    source: "owner-normal-window",
    bounds,
    ...(value.displayId === undefined ? {} : { displayId: value.displayId }),
    ...(value.savedAt === undefined ? {} : { savedAt: value.savedAt })
  };
}

function intersectionArea(bounds, workArea) {
  const rect = strictRect(bounds);
  const area = strictRect(workArea);
  if (!rect || !area) return 0;
  const width = Math.max(0, Math.min(rect.x + rect.width, area.x + area.width) - Math.max(rect.x, area.x));
  const height = Math.max(0, Math.min(rect.y + rect.height, area.y + area.height) - Math.max(rect.y, area.y));
  return width * height;
}

function onlineDisplays(displays) {
  return Array.isArray(displays) ? displays.map(normalizeDisplay).filter(Boolean) : [];
}

function primaryOnlineDisplay(displays, primaryDisplay) {
  const primary = normalizeDisplay(primaryDisplay);
  if (!primary) return undefined;
  const matches = displays.filter((display) => display.id === primary.id);
  return matches.length === 1 ? matches[0] : undefined;
}

function selectDisplayForPlacement(bounds, displays) {
  return displays
    .map((display) => ({ display, area: intersectionArea(bounds, display.workArea) }))
    .filter((entry) => entry.area > 0)
    .sort((a, b) => b.area - a.area || a.display.id - b.display.id)[0]?.display;
}

function resolveNormalLaunchPlacement({ storedPlacement, displays, primaryDisplay, defaultSize, minimumSize }) {
  const online = onlineDisplays(displays);
  const primary = primaryOnlineDisplay(online, primaryDisplay);
  if (!primary || !minimumFitsWorkArea(minimumSize, primary.workArea)) {
    return { status: "rejected", reason: "primary_display_too_small", persist: false };
  }

  const fallback = (reason) => ({
    status: "primaryFallback",
    reason,
    displayId: primary.id,
    bounds: centeredBounds(defaultSize, primary.workArea, minimumSize),
    persist: true
  });

  if (storedPlacement === undefined) return fallback("placement_missing");
  const placement = normalizeWindowPlacementRecord(storedPlacement);
  if (!placement) return fallback("placement_malformed");
  const display = selectDisplayForPlacement(placement.bounds, online);
  if (!display) return fallback("placement_offline");
  if (!minimumFitsWorkArea(minimumSize, display.workArea)) return fallback("placement_display_too_small");

  const bounds = preserveWindowSizeAcrossDisplay({
    currentBounds: placement.bounds,
    preservedSize: placement.bounds,
    workArea: display.workArea,
    minimumSize
  });
  if (!isWindowContainedInWorkArea(bounds, display.workArea)) return fallback("placement_out_of_bounds");
  return {
    status: "restored",
    reason: "placement_valid",
    displayId: display.id,
    bounds,
    persist: true
  };
}

function parseAcceptanceDisplayRequest({ argv, environment, internalCandidate }) {
  const args = Array.isArray(argv) ? argv.filter((value) => typeof value === "string") : [];
  const displayArguments = args.filter((argument) => argument.startsWith(ACCEPTANCE_DISPLAY_ARGUMENT));
  const forbiddenArguments = args.filter((argument) =>
    argument.startsWith(ACCEPTANCE_ARGUMENT_PREFIX)
    && !argument.startsWith(ACCEPTANCE_DISPLAY_ARGUMENT)
  );
  const rawExecutionId = environment?.[ACCEPTANCE_EXECUTION_ENV];
  const hasExecutionBinding = rawExecutionId !== undefined;

  if (displayArguments.length === 0 && !hasExecutionBinding && forbiddenArguments.length === 0) {
    return { status: "absent" };
  }
  if (forbiddenArguments.length > 0) return { status: "rejected", reason: "acceptance_argument_forbidden" };
  if (displayArguments.length === 0) return { status: "rejected", reason: "acceptance_display_missing" };
  if (displayArguments.length !== 1) return { status: "rejected", reason: "acceptance_display_duplicate" };
  if (!internalCandidate) return { status: "rejected", reason: "acceptance_channel_forbidden" };
  if (!hasExecutionBinding || rawExecutionId === "") return { status: "rejected", reason: "acceptance_execution_unbound" };
  if (typeof rawExecutionId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(rawExecutionId)) {
    return { status: "rejected", reason: "acceptance_execution_malformed" };
  }

  const rawDisplayId = displayArguments[0].slice(ACCEPTANCE_DISPLAY_ARGUMENT.length);
  if (!/^\d{1,10}$/u.test(rawDisplayId)) return { status: "rejected", reason: "acceptance_display_malformed" };
  const displayId = Number(rawDisplayId);
  if (boundedDisplayId(displayId) === undefined) return { status: "rejected", reason: "acceptance_display_malformed" };
  return {
    status: "accepted",
    displayId,
    executionId: rawExecutionId
  };
}

function resolveAcceptanceLaunchPlacement({ request, displays, defaultSize, minimumSize }) {
  if (request?.status !== "accepted") return { status: "rejected", reason: "acceptance_request_invalid", persist: false };
  const matches = onlineDisplays(displays).filter((display) => display.id === request.displayId);
  if (matches.length === 0) return { status: "rejected", reason: "acceptance_display_unknown", persist: false };
  if (matches.length !== 1) return { status: "rejected", reason: "acceptance_display_ambiguous", persist: false };
  const display = matches[0];
  const bounds = centeredBounds(defaultSize, display.workArea, minimumSize);
  if (!bounds) return { status: "rejected", reason: "acceptance_display_too_small", persist: false };
  return {
    status: "accepted",
    displayId: display.id,
    executionId: request.executionId,
    bounds,
    persist: false
  };
}

function windowPlacementRecordFromBounds({ bounds, displayId, windowState, launchMode, savedAt, workArea }) {
  if (launchMode !== "normal") return { status: "ignored", reason: "placement_not_normal_launch" };
  if (windowState?.minimized || windowState?.fullscreen || windowState?.maximized) {
    return { status: "ignored", reason: "placement_not_normal_window" };
  }
  const normalizedBounds = strictRect(bounds);
  const normalizedDisplayId = boundedDisplayId(displayId);
  if (!normalizedBounds || normalizedDisplayId === undefined) {
    return { status: "rejected", reason: "placement_malformed" };
  }
  if (workArea !== undefined && !isWindowContainedInWorkArea(normalizedBounds, workArea)) {
    return { status: "rejected", reason: "placement_out_of_bounds" };
  }
  if (typeof savedAt !== "string" || !Number.isFinite(Date.parse(savedAt))) {
    return { status: "rejected", reason: "placement_timestamp_malformed" };
  }
  return {
    status: "accepted",
    record: {
      schemaVersion: 1,
      source: "owner-normal-window",
      displayId: normalizedDisplayId,
      bounds: normalizedBounds,
      savedAt
    }
  };
}

module.exports = {
  isWindowContainedInWorkArea,
  normalizeWindowPlacementRecord,
  parseAcceptanceDisplayRequest,
  clampSizeToWorkArea,
  preserveWindowSizeAcrossDisplay,
  resolveAcceptanceLaunchPlacement,
  resolveNormalLaunchPlacement,
  selectDisplayForPlacement,
  sameWindowBounds,
  windowPlacementRecordFromBounds
};
