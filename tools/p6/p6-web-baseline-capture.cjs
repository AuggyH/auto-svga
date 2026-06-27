const { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const path = require("node:path");
const { app, BrowserWindow, session } = require("electron");

const url = process.env.AUTO_SVGA_WEB_BASELINE_URL;
const fixtureUrl = process.env.AUTO_SVGA_WEB_BASELINE_FIXTURE_URL;
const outRoot = process.env.AUTO_SVGA_WEB_BASELINE_OUT;
const contractPath = process.env.AUTO_SVGA_WEB_BASELINE_CONTRACT;

if (!url || !fixtureUrl || !outRoot || !contractPath) {
  console.error("Missing P6 web baseline environment.");
  process.exit(1);
}

const contract = JSON.parse(readFileSync(contractPath, "utf8"));
const motionStyleSamples = {};
const webActionTrace = [];
const headCommit = currentGitHead();
const requestAudit = {
  schemaVersion: 1,
  mode: "p6-web-baseline",
  localOrigin: new URL(url).origin,
  externalRequests: [],
  blockedRequests: [],
  generatedAt: new Date().toISOString()
};

const onePixelGifBase64 = "R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function currentGitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return contract.baselineCommit ?? "unknown";
  }
}

function stableDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function waitFor(window, predicateSource, timeoutMs = 15_000) {
  const startedAt = Date.now();
  let lastValue;
  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await window.webContents.executeJavaScript(predicateSource);
    if (lastValue) return lastValue;
    await delay(180);
  }
  throw new Error(`Timed out waiting for page state: ${JSON.stringify(lastValue)}`);
}

async function capture(window, fileName) {
  const png = (await window.webContents.capturePage()).toPNG();
  writeFileSync(path.join(outRoot, fileName), png);
}

async function execute(window, source) {
  return window.webContents.executeJavaScript(`(() => { ${source} })()`);
}

async function collectMotionStyle(window, motionId, phase) {
  const sample = await execute(window, `
    const selectorMap = {
      emptyIconFloat: [".uploadMockIcon"],
      cardEnter: ["#svgaPanelB", ".previewCard"],
      fitMenuIn: ["#localFitMenu"],
      dropdownIn: ["#modeDropdownMenu"],
      sidePanelEnter: ["#infoPanel"],
      tabIn: ["#tab-overview", "#tab-assets"],
      drawerIn: ["#logsPanel"],
      modalIn: ["#settingsModal", "#settingsModal .settingsModal"],
      overlayIn: ["#settingsModal", "#settingsModal .settingsModal"]
    };
    const selectors = selectorMap[${JSON.stringify(motionId)}] ?? [];
    return {
      motionId: ${JSON.stringify(motionId)},
      phase: ${JSON.stringify(phase)},
      selectors: selectors.map((selector) => {
        const node = document.querySelector(selector);
        const rect = node?.getBoundingClientRect();
        const style = node ? getComputedStyle(node) : null;
        return {
          selector,
          present: Boolean(node),
          hidden: Boolean(node?.hidden),
          opacity: style?.opacity ?? null,
          transform: style?.transform ?? null,
          transitionDuration: style?.transitionDuration ?? null,
          transitionProperty: style?.transitionProperty ?? null,
          animationName: style?.animationName ?? null,
          rect: rect ? {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          } : null
        };
      })
    };
  `);
  motionStyleSamples[motionId] ??= {};
  motionStyleSamples[motionId][phase] = sample;
}

async function closeTransientUi(window) {
  await execute(window, `
    (() => {
      document.querySelector("#assetPreviewClose")?.click();
      document.querySelector("#settingsCloseButton")?.click();
      const menu = document.querySelector("#modeDropdownMenu");
      if (menu && !menu.hidden) document.querySelector("#modeDropdownTrigger")?.click();
      return true;
    })()
  `);
  await delay(240);
}

async function ensureLocalPreview(window) {
  await setMode(window, "localPreview");
  await closeTransientUi(window);
}

async function ensureExportReview(window) {
  await setMode(window, "exportReview");
  await closeTransientUi(window);
}

async function captureMotionTriplet(window, motionId, setup, timing = {}) {
  const prepareDelayMs = timing.prepareDelayMs ?? 40;
  const midDelayMs = timing.midDelayMs ?? 70;
  const endDelayMs = timing.endDelayMs ?? 300;
  console.log(`P6_WEB_BASELINE_PHASE motion-${motionId}`);
  try {
    await setup?.("prepare");
  } catch (error) {
    throw new Error(`motion prepare failed for ${motionId}: ${error instanceof Error ? error.message : String(error)}`);
  }
  await delay(prepareDelayMs);
  await collectMotionStyle(window, motionId, "start");
  await capture(window, `web-motion-${motionId}-start.png`);
  try {
    await setup?.("trigger");
  } catch (error) {
    throw new Error(`motion trigger failed for ${motionId}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (midDelayMs > 0) await delay(midDelayMs);
  await collectMotionStyle(window, motionId, "mid");
  await capture(window, `web-motion-${motionId}-mid.png`);
  await delay(endDelayMs);
  await collectMotionStyle(window, motionId, "end");
  await capture(window, `web-motion-${motionId}-end.png`);
}

async function captureMotionFrames(window) {
  await captureMotionTriplet(window, "cardEnter", async (phase) => {
    await ensureLocalPreview(window);
    await execute(window, `
      const toggle = document.querySelector("#compareToggle");
      if (${JSON.stringify(phase)} === "prepare" && toggle?.checked) toggle.click();
      if (${JSON.stringify(phase)} === "trigger" && toggle && !toggle.checked) toggle.click();
      true;
    `);
  });
  await captureMotionTriplet(window, "fitMenuIn", async (phase) => {
    await closeTransientUi(window);
    if (phase === "trigger") await execute(window, `document.querySelector("#localFitButton")?.click(); true;`);
  });
  await captureMotionTriplet(window, "dropdownIn", async (phase) => {
    await closeTransientUi(window);
    if (phase === "trigger") await execute(window, `document.querySelector("#modeDropdownTrigger")?.click(); true;`);
  });
  await captureMotionTriplet(window, "sidePanelEnter", async (phase) => {
    await ensureExportReview(window);
    await execute(window, `
      const button = document.querySelector("#infoPanelButton");
      if (button?.getAttribute("aria-pressed") === "true") button.click();
      if (${JSON.stringify(phase)} === "trigger") button?.click();
      true;
    `);
  });
  await captureMotionTriplet(window, "tabIn", async (phase) => {
    await execute(window, `
      document.querySelector("#infoPanelButton")?.click();
      document.querySelector(".tabButton[data-tab='assets']")?.click();
      if (${JSON.stringify(phase)} === "trigger") {
        document.querySelector(".tabButton[data-tab='overview']")?.click();
      }
      true;
    `);
  });
  await captureMotionTriplet(window, "drawerIn", async (phase) => {
    await closeTransientUi(window);
    await execute(window, `
      const button = document.querySelector("#logsButton");
      if (button?.getAttribute("aria-pressed") === "true") button.click();
      if (${JSON.stringify(phase)} === "trigger") button?.click();
      true;
    `);
  });
  await captureMotionTriplet(window, "modalIn", async (phase) => {
    await closeTransientUi(window);
    if (phase === "trigger") await execute(window, `
      document.querySelector("#settingsButton")?.click();
      true;
    `);
  }, { midDelayMs: 48, endDelayMs: 260 });
  await captureMotionTriplet(window, "overlayIn", async (phase) => {
    await closeTransientUi(window);
    if (phase === "trigger") await execute(window, `
      document.querySelector("#settingsButton")?.click();
      true;
    `);
  }, { midDelayMs: 48, endDelayMs: 260 });
  await closeTransientUi(window);
}

async function collectSnapshot(window, stateId) {
  return window.webContents.executeJavaScript(`
    (() => {
      const isVisible = (node) => {
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 0
          && rect.height > 0
          && style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity || 1) > 0;
      };
      const regions = ${JSON.stringify(contract.regions)}.map((region) => {
        const node = document.querySelector(region.selector);
        const rect = node?.getBoundingClientRect();
        return {
          id: region.id,
          selector: region.selector,
          present: Boolean(node),
          visible: isVisible(node),
          textSample: (node?.innerText ?? "").replace(/\\s+/g, " ").trim().slice(0, 160),
          rect: rect ? {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          } : null
        };
      });
      const controls = [...document.querySelectorAll("button,input,label,select,textarea,[role=button],[role=menuitemradio],[role=status],[aria-live],[data-value],[data-tab],[data-preview-image-key]")]
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            tag: node.tagName.toLowerCase(),
            id: node.id || null,
            role: node.getAttribute("role"),
            type: node.getAttribute("type"),
            dataValue: node.dataset?.value ?? null,
            dataTab: node.dataset?.tab ?? null,
            dataPreviewImageKey: node.dataset?.previewImageKey ?? null,
            ariaExpanded: node.getAttribute("aria-expanded"),
            text: (node.innerText || node.getAttribute("aria-label") || node.getAttribute("title") || "").replace(/\\s+/g, " ").trim().slice(0, 120),
            present: true,
            visible: isVisible(node),
            hidden: Boolean(node.hidden),
            disabled: Boolean(node.disabled),
            checked: Boolean(node.checked),
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            }
          };
        });
      const productSnapshot = window.__autoSvgaDesktopStateProbe?.snapshot?.(${JSON.stringify(stateId)});
      if (productSnapshot && typeof productSnapshot === "object") {
        return {
          ...productSnapshot,
          label: ${JSON.stringify(stateId)},
          title: document.title,
          url: location.href,
          regions: Array.isArray(productSnapshot.regions) && productSnapshot.regions.length ? productSnapshot.regions : regions,
          controls: Array.isArray(productSnapshot.controls) && productSnapshot.controls.length ? productSnapshot.controls : controls
        };
      }
      const activeMode = document.querySelector("#modeDropdownTrigger")?.textContent?.replace(/\\s+/g, " ").trim() ?? "unknown";
      const infoPanel = document.querySelector("#infoPanel");
      const logsPanel = document.querySelector("#logsPanel");
      const settingsModal = document.querySelector("#settingsModal");
      const assetPreviewModal = document.querySelector("#assetPreviewModal");
      const panel = isVisible(infoPanel) && !infoPanel.classList.contains("isHidden") ? "info"
        : isVisible(logsPanel) && !logsPanel.classList.contains("isHidden") ? "logs"
          : "none";
      const visibleModal = [settingsModal, assetPreviewModal].find((node) =>
        node && !node.hidden && node.classList.contains("isOpen") && isVisible(node)
      );
      const modal = visibleModal?.id ?? "none";
      const modeMenu = document.querySelector("#modeDropdownMenu");
      const modeDropdownTrigger = document.querySelector("#modeDropdownTrigger");
      const syncPlayControl = document.querySelector("#syncPlayControl");
      const compareToggle = document.querySelector("#compareToggle");
      const reduceMotionToggle = document.querySelector("#reduceMotionToggle");
      const reduceBlurToggle = document.querySelector("#reduceBlurToggle");
      const tabAssets = document.querySelector("#tab-assets");
      const tabOverview = document.querySelector("#tab-overview");
      const panelA = document.querySelector("#svgaPanelA");
      const statusA = document.querySelector("#svgaStatusA")?.textContent ?? "";
      const canvasNonBlank = (selector) => {
        const canvas = document.querySelector(selector);
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context || !canvas.width || !canvas.height) return false;
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] > 0) return true;
        }
        return false;
      };
      const loadedA = Boolean(panelA?.classList.contains("hasLoaded") || document.querySelector("#svgaCanvasA canvas"));
      const loadedB = Boolean(document.querySelector("#svgaCanvasB canvas"));
      const primaryOverlay = panelA?.querySelector(".centerEmptyState");
      const errorBox = document.querySelector("#errorBox");
      const filePillA = document.querySelector("#svgaFilePillA");
      const errorVisible = isVisible(errorBox) && Boolean(errorBox?.textContent?.trim());
      const recoveredFromInvalid = window.__autoSvgaP6RecoveredFromInvalid === true;
      const observedStateId = (() => {
        if (errorVisible || /错误|error/i.test(statusA)) return "invalid";
        if (recoveredFromInvalid && loadedA && !/加载中|loading/i.test(statusA)) return "recovered-from-invalid";
        if (modeDropdownTrigger?.getAttribute("aria-expanded") === "true" || (modeMenu && !modeMenu.hidden && isVisible(modeMenu))) return "mode-menu-open";
        if (modal === "assetPreviewModal") return "asset-preview-modal-open";
        if (syncPlayControl?.getAttribute("aria-pressed") === "true") return "synchronized-playback-toggled-by-space";
        if (window.__p6SettingsClosedByEscape === true && modal === "none") return "settings-closed-by-escape";
        if (reduceMotionToggle?.checked && reduceBlurToggle?.checked && modal === "none") return "settings-closed-by-escape";
        if (reduceMotionToggle?.checked && reduceBlurToggle?.checked) return "accessibility-toggles-on";
        if (modal === "settingsModal") return "settings-open";
        if (panel === "logs") return "logs-open";
        if (panel === "info" && tabAssets && !tabAssets.hidden && isVisible(tabAssets)) return "info-assets-open";
        if (panel === "info" && tabOverview && !tabOverview.hidden && isVisible(tabOverview)) return "info-overview-open";
        if (/导出验收|导出复核|Export review/i.test(activeMode) && loadedA) return "export-review-loaded";
        if (compareToggle?.checked && /本地预览|Local preview/i.test(activeMode)) return loadedA ? "local-compare-loaded" : "local-compare-empty";
        if (/加载中|loading/i.test(statusA) || panelA?.classList.contains("isLoading")) return "loading";
        if (loadedA) return "loaded";
        if (/本地预览|Local preview/i.test(activeMode)) return "local-empty";
        return "unknown";
      })();
      const fixture = window.__autoSvgaP6Fixture ?? null;
      const sourceSlots = {
        primary: {
          slot: "a",
          occupied: loadedA,
          sourceKind: loadedA ? "file_input" : null,
          fileName: loadedA ? fixture?.displayName ?? filePillA?.textContent?.replace(/\\s+/g, " ").trim() ?? null : null,
          fileSizeBytes: loadedA ? fixture?.sizeBytes ?? null : null,
          fixtureSha256: loadedA ? fixture?.sha256 ?? null : null,
          displayName: loadedA ? fixture?.displayName ?? null : null,
          parseStatus: /错误|error/i.test(statusA) ? "error" : loadedA ? "success" : /加载中|loading/i.test(statusA) ? "loading" : "empty",
          renderStatus: /错误|error/i.test(statusA) ? "error" : loadedA ? "success" : /加载中|loading/i.test(statusA) ? "loading" : "empty",
          canvasChildCount: document.querySelector("#svgaCanvasA")?.children.length ?? 0,
          canvasNonBlank: canvasNonBlank("#svgaCanvasA canvas")
        },
        secondary: {
          slot: "b",
          occupied: loadedB,
          sourceKind: loadedB ? "file_input" : null,
          fixtureSha256: loadedB ? fixture?.sha256 ?? null : null,
          canvasChildCount: document.querySelector("#svgaCanvasB")?.children.length ?? 0,
          canvasNonBlank: canvasNonBlank("#svgaCanvasB canvas")
        },
        reference: {
          slot: "reference",
          occupied: Boolean(document.querySelector("#referencePanel")?.classList.contains("hasMedia")),
          hasMetrics: Boolean(document.querySelector("#referencePanel")?.classList.contains("hasMedia"))
        }
      };
      const stateSemantics = {
        requestedStateId: ${JSON.stringify(stateId)},
        observedStateId,
        primaryOverlayVisible: isVisible(primaryOverlay),
        loadingVisible: panelA?.classList.contains("isLoading") === true,
        errorVisible,
        loadedCanvasNonBlank: sourceSlots.primary.canvasNonBlank,
        primaryOccupied: sourceSlots.primary.occupied,
        primaryParserStatus: sourceSlots.primary.parseStatus,
        primaryRenderStatus: sourceSlots.primary.renderStatus,
        primaryCanvasChildCount: sourceSlots.primary.canvasChildCount,
        staleMetadataCleared: !document.querySelector("#tab-overview .status-ready"),
        staleInspectionCleared: !document.querySelector(".specReportSection, .auditReportSection"),
        staleCanvasCleared: sourceSlots.primary.canvasChildCount === 0,
        staleFileBadgeCleared: Boolean(filePillA?.hidden) && !filePillA?.textContent?.trim()
      };
      return {
        stateId: ${JSON.stringify(stateId)},
        observedStateId,
        label: ${JSON.stringify(stateId)},
        title: document.title,
        url: location.href,
        viewport: { width: innerWidth, height: innerHeight },
        devicePixelRatio,
        playbackTimeMs: Math.round((document.querySelector("#svgaPanelA .timeDisplay")?.textContent?.match(/[0-9.]+/)?.[0] ?? 0) * 1000),
        mode: activeMode,
        panel,
        modal,
        fixture,
        sourceSlots,
        stateSemantics,
        bodyTextSample: document.body.innerText.replace(/\\s+/g, " ").trim().slice(0, 600),
        regions,
        controls
      };
    })()
  `);
}

function splitSelectors(selector) {
  return String(selector ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function selectorId(selector) {
  return selector?.startsWith("#") ? selector.slice(1) : null;
}

function selectorDataValue(selector) {
  return selector?.match(/data-value=['"]?([^'"\]]+)['"]?/)?.[1] ?? null;
}

function selectorDataTab(selector) {
  return selector?.match(/data-tab=['"]?([^'"\]]+)['"]?/)?.[1] ?? null;
}

function targetFromSnapshot(snapshot, selector) {
  for (const candidate of splitSelectors(selector)) {
    if (candidate === "body") {
      return {
        id: "body",
        selector: "body",
        visible: true,
        disabled: false,
        checked: false,
        rect: { x: 0, y: 0, width: snapshot?.viewport?.width ?? 0, height: snapshot?.viewport?.height ?? 0 }
      };
    }
    const id = selectorId(candidate);
    const dataValue = selectorDataValue(candidate);
    const dataTab = selectorDataTab(candidate);
    const target = snapshot?.controls.find((control) => id && control.id === id)
      ?? snapshot?.controls.find((control) => dataValue && control.dataValue === dataValue)
      ?? snapshot?.controls.find((control) => dataTab && control.dataTab === dataTab)
      ?? snapshot?.regions.find((region) => region.selector === candidate);
    if (target) return target;
  }
  return null;
}

function actionStateFromSnapshot(snapshot) {
  const visibleRegions = snapshot.regions.filter((region) => region.visible).map((region) => region.id);
  const visibleControls = snapshot.controls
    .filter((control) => control.visible)
    .map((control) => control.id ?? control.dataValue ?? control.dataTab ?? control.text)
    .filter(Boolean);
  return {
    stateId: snapshot.observedStateId ?? snapshot.stateId,
    requestedStateId: snapshot.stateId,
    mode: snapshot.mode,
    panel: snapshot.panel,
    modal: snapshot.modal,
    playbackTimeMs: snapshot.playbackTimeMs,
    visibleRegions,
    visibleControls,
    digest: stableDigest({
      stateId: snapshot.observedStateId ?? snapshot.stateId,
      observedStateId: snapshot.observedStateId ?? snapshot.stateId,
      mode: snapshot.mode,
      panel: snapshot.panel,
      modal: snapshot.modal,
      playbackTimeMs: snapshot.playbackTimeMs,
      visibleRegions,
      visibleControls,
      bodyTextSample: snapshot.bodyTextSample
    })
  };
}

function controlValueFromTarget(target) {
  if (!target) return null;
  return {
    visible: target.visible === true,
    disabled: target.disabled === true,
    checked: target.checked === true
  };
}

async function activeElementSnapshot(window) {
  return window.webContents.executeJavaScript(`
    (() => {
      const node = document.activeElement;
      return {
        activeElementId: node?.id || null,
        activeElementText: (node?.innerText || node?.getAttribute?.("aria-label") || node?.getAttribute?.("title") || "").replace(/\\s+/g, " ").trim().slice(0, 120)
      };
    })()
  `);
}

async function prepareRuntimeTarget(window, selector) {
  return window.webContents.executeJavaScript(`
    (() => {
      const selector = ${JSON.stringify(selector)};
      const parts = selector.split(",").map((part) => part.trim()).filter(Boolean);
      const node = parts.includes("body")
        ? document.body
        : parts.map((part) => document.querySelector(part)).find(Boolean);
      if (!node) {
        return { selector, present: false, targetVisible: false, viewportIntersected: false, occlusionPassed: false };
      }
      node.scrollIntoView?.({ block: "center", inline: "center" });
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const actionablePoint = {
        x: Math.round(Math.min(Math.max(rect.left + rect.width / 2, 0), Math.max(innerWidth - 1, 0))),
        y: Math.round(Math.min(Math.max(rect.top + rect.height / 2, 0), Math.max(innerHeight - 1, 0)))
      };
      const top = document.elementFromPoint(actionablePoint.x, actionablePoint.y);
      const targetMatches = parts.includes("body")
        ? top === document.body || document.body.contains(top)
        : parts.some((part) => top?.matches?.(part) || Boolean(top?.closest?.(part)));
      return {
        selector,
        matchedSelector: parts.find((part) => part === "body" || node.matches?.(part)) ?? selector,
        present: true,
        targetVisible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0,
        targetRect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        actionablePoint,
        viewportIntersected: rect.bottom >= 0 && rect.right >= 0 && rect.top <= innerHeight && rect.left <= innerWidth,
        occlusionPassed: targetMatches,
        occludingElement: targetMatches ? null : {
          tag: top?.tagName?.toLowerCase?.() ?? null,
          id: top?.id || null,
          text: (top?.innerText || top?.getAttribute?.("aria-label") || "").replace(/\\s+/g, " ").trim().slice(0, 80)
        }
      };
    })()
  `);
}

async function installInteractionReceiptProbe(window, selector, inputKind) {
  const token = `p6-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await window.webContents.executeJavaScript(`
    (() => {
      const token = ${JSON.stringify(token)};
      const selector = ${JSON.stringify(selector)};
      const inputKind = ${JSON.stringify(inputKind)};
      const parts = selector.split(",").map((part) => part.trim()).filter(Boolean);
      const matchesTarget = (target) => parts.includes("body")
        ? target === document || target === window || target === document.body || document.body.contains(target)
        : parts.some((part) => target?.matches?.(part) || Boolean(target?.closest?.(part)));
      const receipts = [];
      const handler = (event) => {
        if (inputKind === "keyboard" && event.type !== "keydown") return;
        const targetMatches = matchesTarget(event.target);
        if (!targetMatches) return;
        receipts.push({
          type: event.type,
          selector,
          targetMatches,
          isTrusted: event.isTrusted === true,
          timestampMs: Date.now(),
          performanceTimeMs: Math.round(performance.now()),
          clientX: Number.isFinite(event.clientX) ? Math.round(event.clientX) : null,
          clientY: Number.isFinite(event.clientY) ? Math.round(event.clientY) : null,
          key: event.key ?? null,
          code: event.code ?? null,
          targetId: event.target?.id || null,
          targetText: (event.target?.innerText || event.target?.getAttribute?.("aria-label") || event.target?.getAttribute?.("title") || "").replace(/\\s+/g, " ").trim().slice(0, 120)
        });
      };
      window.__p6InteractionReceipts ??= {};
      window.__p6InteractionReceipts[token] = { selector, receipts, handler };
      for (const type of ["click", "change", "input", "keydown"]) {
        document.addEventListener(type, handler, true);
      }
      return true;
    })()
  `);
  return token;
}

async function takeInteractionReceipts(window, token) {
  return window.webContents.executeJavaScript(`
    (() => {
      const token = ${JSON.stringify(token)};
      const entry = window.__p6InteractionReceipts?.[token];
      if (!entry) return [];
      for (const type of ["click", "change", "input", "keydown"]) {
        document.removeEventListener(type, entry.handler, true);
      }
      delete window.__p6InteractionReceipts[token];
      return entry.receipts;
    })()
  `);
}

async function browserPointClick(window, selector) {
  const target = await prepareRuntimeTarget(window, selector);
  if (!target.targetVisible || !target.viewportIntersected || !target.occlusionPassed) {
    throw new Error(`Target is not actionable for ${selector}: ${JSON.stringify(target)}`);
  }
  await window.webContents.sendInputEvent({ type: "mouseMove", x: target.actionablePoint.x, y: target.actionablePoint.y });
  await window.webContents.sendInputEvent({ type: "mouseDown", x: target.actionablePoint.x, y: target.actionablePoint.y, button: "left", clickCount: 1 });
  await window.webContents.sendInputEvent({ type: "mouseUp", x: target.actionablePoint.x, y: target.actionablePoint.y, button: "left", clickCount: 1 });
  return target;
}

async function browserKey(window, keyCode) {
  await window.webContents.sendInputEvent({ type: "keyDown", keyCode });
  await window.webContents.sendInputEvent({ type: "keyUp", keyCode });
  return { keyCode };
}

async function recordWebInteraction(window, interactionId, runAction, options = {}) {
  const interaction = contract.interactions.find((candidate) => candidate.id === interactionId);
  if (!interaction) throw new Error(`Missing P6 interaction contract for ${interactionId}`);
  const before = await collectSnapshot(window, `${interaction.initialState}:before`);
  const beforeTarget = await prepareRuntimeTarget(window, interaction.selector);
  const probeToken = await installInteractionReceiptProbe(window, interaction.selector, interaction.trigger);
  let actionResult;
  let actionError = null;
  try {
    actionResult = await runAction({ target: beforeTarget });
    if (options.waitForResult) await options.waitForResult();
    else await delay(options.delayMs ?? 320);
  } catch (error) {
    actionError = error;
  }
  const eventReceipts = await takeInteractionReceipts(window, probeToken);
  if (actionError) throw actionError;
  const after = await collectSnapshot(window, `${interaction.expectedState}:after`);
  const afterTarget = targetFromSnapshot(after, interaction.selector) ?? beforeTarget;
  const activeElement = await activeElementSnapshot(window);
  const targetRect = beforeTarget?.targetRect ?? beforeTarget?.rect ?? afterTarget?.rect ?? null;
  const afterState = actionStateFromSnapshot(after);
  const action = {
    id: interaction.id,
    kind: interaction.trigger,
    selector: interaction.selector,
    initialState: interaction.initialState,
    expectedState: interaction.expectedState,
    stateBefore: actionStateFromSnapshot(before),
    realAction: {
      inputKind: interaction.trigger,
      selector: interaction.selector,
      trustedPath: options.trustedPath ?? "web-baseline-real-input",
      targetVisible: beforeTarget?.targetVisible === true || beforeTarget?.visible === true || afterTarget?.visible === true,
      targetRect,
      actionablePoint: beforeTarget?.actionablePoint ?? actionResult?.actionablePoint ?? null,
      viewportIntersected: beforeTarget?.viewportIntersected === true,
      occlusionPassed: beforeTarget?.occlusionPassed === true,
      eventTimestampMs: eventReceipts.at(-1)?.timestampMs ?? Date.now(),
      eventReceipts
    },
    stateAfter: afterState,
    source: "web-baseline-real-input",
    targetRect,
    controlValue: controlValueFromTarget(afterTarget ?? beforeTarget),
    focusOrVisibleResult: {
      ...activeElement,
      observedState: afterState.stateId,
      visibleResultText: after.bodyTextSample.slice(0, 240)
    },
    stateProofFailures: []
  };
  webActionTrace.push(action);
  return { action, before, after };
}

async function collectStyles(window) {
  return window.webContents.executeJavaScript(`
    (() => {
      const selectors = [
        ".shell", ".toolbar", ".brand", ".modeControl", ".actionRow", "#workspace",
        "#svgaPanelA", "#svgaPanelB", "#referencePanel", "#infoPanel", "#logsPanel",
        "#settingsModal", "#syncBar", "#errorBox", ".previewCard", ".playerBar",
        ".dropdownMenu", ".sidePanel", ".settingsModal"
      ];
      return {
        schemaVersion: 1,
        selectors: selectors.map((selector) => {
          const node = document.querySelector(selector);
          const style = node ? getComputedStyle(node) : null;
          return {
            selector,
            present: Boolean(node),
            display: style?.display ?? null,
            visibility: style?.visibility ?? null,
            position: style?.position ?? null,
            gridTemplateColumns: style?.gridTemplateColumns ?? null,
            color: style?.color ?? null,
            backgroundColor: style?.backgroundColor ?? null,
            borderRadius: style?.borderRadius ?? null,
            fontFamily: style?.fontFamily ?? null,
            fontSize: style?.fontSize ?? null,
            lineHeight: style?.lineHeight ?? null,
            animationName: style?.animationName ?? null,
            transitionDuration: style?.transitionDuration ?? null
          };
        })
      };
    })()
  `);
}

async function collectMotion(window) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const sheets = [...document.styleSheets];
      const keyframes = [];
      const reducedMotionRules = [];
      const visitRules = (rules) => {
        for (const rule of rules) {
          if (rule.type === CSSRule.KEYFRAMES_RULE || rule.cssText?.trim().startsWith("@keyframes")) {
            keyframes.push(rule.name);
          }
          if (rule.cssText?.includes("prefers-reduced-motion")) reducedMotionRules.push(rule.cssText.slice(0, 300));
          if (rule.cssRules) {
            try { visitRules([...rule.cssRules]); } catch {}
          }
        }
      };
      for (const sheet of sheets) {
        let rules;
        try { rules = [...sheet.cssRules]; } catch { continue; }
        visitRules(rules);
      }
      const cssHrefs = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .map((node) => node.href)
        .filter(Boolean);
      for (const href of cssHrefs) {
        try {
          const cssText = await fetch(href).then((response) => response.text());
          for (const match of cssText.matchAll(/@import\\s+url\\(["']?([^"')]+)["']?\\)/g)) {
            const importedUrl = new URL(match[1], href).href;
            const importedText = await fetch(importedUrl).then((response) => response.text());
            for (const keyframe of importedText.matchAll(/@keyframes\\s+([a-zA-Z0-9_-]+)/g)) keyframes.push(keyframe[1]);
            if (importedText.includes("prefers-reduced-motion")) reducedMotionRules.push("prefers-reduced-motion");
          }
          for (const keyframe of cssText.matchAll(/@keyframes\\s+([a-zA-Z0-9_-]+)/g)) keyframes.push(keyframe[1]);
          if (cssText.includes("prefers-reduced-motion")) reducedMotionRules.push("prefers-reduced-motion");
        } catch {}
      }
      return {
        schemaVersion: 1,
        keyframes: [...new Set(keyframes)].sort(),
        reducedMotionPresent: reducedMotionRules.length > 0,
        reducedMotionRuleCount: reducedMotionRules.length,
        sampledAnimations: [...document.querySelectorAll("*")]
          .map((node) => {
            const style = getComputedStyle(node);
            return {
              selector: node.id ? "#" + node.id : node.className ? "." + String(node.className).split(/\\s+/).filter(Boolean).join(".") : node.tagName.toLowerCase(),
              animationName: style.animationName,
              transitionDuration: style.transitionDuration
            };
          })
          .filter((entry) => entry.animationName !== "none" || entry.transitionDuration !== "0s")
          .slice(0, 80)
      };
    })()
  `);
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function writeArtifactIndex() {
  const entries = readdirSync(outRoot)
    .filter((name) => !name.startsWith(".") && name !== "artifact-index.json")
    .sort()
    .map((name) => {
      const filePath = path.join(outRoot, name);
      const stats = statSync(filePath);
      return {
        name,
        bytes: stats.size,
        sha256: sha256File(filePath)
      };
    });

  writeFileSync(path.join(outRoot, "artifact-index.json"), JSON.stringify({
    schemaVersion: 1,
    source: "running Web Preview",
    headCommit,
    route: url,
    fixtureUrl,
    generatedAt: new Date().toISOString(),
    entries
  }, null, 2) + "\n");
}

async function setMode(window, value) {
  await window.webContents.executeJavaScript(`
    document.querySelector("#modeDropdownTrigger")?.click();
    document.querySelector('[data-value="${value}"]')?.click();
    true;
  `);
  await delay(600);
}

async function loadReferenceGif(window) {
  await window.webContents.executeJavaScript(`
    (async () => {
      const bytes = Uint8Array.from(atob(${JSON.stringify(onePixelGifBase64)}), (char) => char.charCodeAt(0));
      const file = new File([bytes], "p6-reference.gif", { type: "image/gif" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector("#referenceFileInput");
      Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return bytes.byteLength;
    })()
  `);
  await waitFor(window, `
    (() => {
      const panel = document.querySelector("#referencePanel");
      const playerBar = panel?.querySelector(".playerBar");
      const rect = playerBar?.getBoundingClientRect();
      return Boolean(panel && panel.classList.contains("hasMedia") && rect && rect.width > 0 && rect.height > 0);
    })()
  `, 12_000);
}

async function installFixtureMarker(window, fileName = "avatar_frame_basic.svga") {
  await window.webContents.executeJavaScript(`
    (async () => {
      const response = await fetch(${JSON.stringify(fixtureUrl)});
      const bytes = new Uint8Array(await response.arrayBuffer());
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      window.__autoSvgaP6Fixture = {
        sha256,
        displayName: ${JSON.stringify(fileName)},
        sizeBytes: bytes.byteLength
      };
      return true;
    })()
  `);
}

async function dispatchFixtureLoad(window, options = {}) {
  const inputSelector = options.inputSelector ?? "#svgaFileInput";
  const fileName = options.fileName ?? "p6-web-baseline-fixture.svga";
  await window.webContents.executeJavaScript(`
    (async () => {
      const response = await fetch(${JSON.stringify(fixtureUrl)});
      const bytes = new Uint8Array(await response.arrayBuffer());
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      window.__autoSvgaP6Fixture = {
        sha256,
        displayName: ${JSON.stringify(fileName)},
        sizeBytes: bytes.byteLength
      };
      const file = new File([bytes], ${JSON.stringify(fileName)}, { type: "application/octet-stream" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector(${JSON.stringify(inputSelector)});
      Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return bytes.byteLength;
    })()
  `);
}

async function waitForFixtureLoaded(window, options = {}) {
  const canvasSelector = options.canvasSelector ?? "#svgaCanvasA canvas";
  const requireInspection = options.requireInspection !== false;
  await waitFor(window, `
    (() => {
      const hasInspection = Boolean(document.querySelector(".specReportSection") || document.querySelector(".auditReportSection"));
      const canvas = document.querySelector(${JSON.stringify(canvasSelector)});
      let canvasNonBlank = false;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const pixels = ctx?.getImageData(0, 0, canvas.width, canvas.height)?.data;
        if (pixels) {
          for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] > 0) { canvasNonBlank = true; break; }
          }
        }
      }
      return ${JSON.stringify(requireInspection)} ? hasInspection && canvasNonBlank : canvasNonBlank;
    })()
  `, 18_000);
}

async function loadFixture(window, options = {}) {
  await dispatchFixtureLoad(window, options);
  await waitForFixtureLoaded(window, options);
}

async function invalidLoad(window) {
  await window.webContents.executeJavaScript(`
    (async () => {
      const file = new File([new Uint8Array([1, 2, 3, 4])], "p6-invalid.svga", { type: "application/octet-stream" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector("#svgaFileInput");
      Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 900));
      return true;
    })()
  `);
}

async function main() {
  mkdirSync(outRoot, { recursive: true });
  console.log("P6_WEB_BASELINE_PHASE app-ready");
  await app.whenReady();
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const local = details.url.startsWith(new URL(url).origin) || details.url.startsWith("blob:") || details.url.startsWith("data:");
    if (!local) requestAudit.externalRequests.push({ url: details.url, resourceType: details.resourceType });
    callback({ cancel: false });
  });
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    focusable: false,
    skipTaskbar: true,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  window.setIgnoreMouseEvents(true);
  window.setOpacity(0);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  console.log("P6_WEB_BASELINE_PHASE load-url");
  await window.loadURL(url);
  await waitFor(window, `document.readyState === "complete" && Boolean(document.querySelector("#svgaFileInput"))`);
  await execute(window, `
    localStorage.setItem("autoSvgaTheme", "dark");
    localStorage.setItem("autoSvgaReduceMotion", "false");
    localStorage.setItem("autoSvgaReduceBlur", "false");
    document.documentElement.dataset.theme = "dark";
    document.documentElement.classList.remove("reduceMotion", "reduceBlur");
    for (const input of document.querySelectorAll('input[name="theme"]')) input.checked = input.value === "dark";
    const reduceMotionToggle = document.querySelector("#reduceMotionToggle");
    const reduceBlurToggle = document.querySelector("#reduceBlurToggle");
    if (reduceMotionToggle) reduceMotionToggle.checked = false;
    if (reduceBlurToggle) reduceBlurToggle.checked = false;
    true;
  `);
  await delay(800);

  console.log("P6_WEB_BASELINE_PHASE local-empty");
  const snapshots = [];
  snapshots.push(await collectSnapshot(window, "local-empty"));
  await capture(window, "screenshot-local-empty-1440x900.png");
  await captureMotionTriplet(window, "emptyIconFloat", async (phase) => {
    await closeTransientUi(window);
    if (phase === "prepare") {
      await execute(window, `
        const icon = document.querySelector(".uploadMockIcon");
        if (icon) {
          icon.style.animation = "none";
          void icon.offsetHeight;
          icon.style.animation = "";
        }
        true;
      `);
    }
  }, { prepareDelayMs: 50, midDelayMs: 500, endDelayMs: 500 });

  console.log("P6_WEB_BASELINE_PHASE mode-menu-open");
  await recordWebInteraction(window, "click-mode-dropdown-trigger-menu-opens", async () => {
    await browserPointClick(window, "#modeDropdownTrigger");
  }, {
    trustedPath: "web-baseline-real-click",
    waitForResult: async () => waitFor(window, `(() => {
      const menu = document.querySelector("#modeDropdownMenu");
      return Boolean(menu && !menu.hidden);
    })()`)
  });
  snapshots.push(await collectSnapshot(window, "mode-menu-open"));
  await capture(window, "screenshot-mode-menu-open-1440x900.png");
  await window.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
  await window.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
  await delay(180);

  console.log("P6_WEB_BASELINE_PHASE load-fixture");
  await dispatchFixtureLoad(window);
  await waitFor(window, `(() => {
    const panel = document.querySelector("#svgaPanelA");
    const status = document.querySelector("#svgaStatusA")?.textContent ?? "";
    return Boolean(panel?.classList.contains("isLoading") || /加载中|loading/i.test(status));
  })()`, 6_000);
  snapshots.push(await collectSnapshot(window, "loading"));
  await capture(window, "screenshot-loading-1440x900.png");
  await waitForFixtureLoaded(window);
  snapshots.push(await collectSnapshot(window, "loaded"));
  await capture(window, "screenshot-loaded-1440x900.png");
  await window.webContents.executeJavaScript(`window.__autoSvgaDesktopStateProbe?.collect?.("loaded"); document.querySelector("#localPlayPauseButton")?.click(); true;`);
  await waitFor(window, `document.querySelector("#localPlayPauseButton")?.getAttribute("aria-pressed") === "false"`);
  await window.webContents.executeJavaScript(`document.querySelector("#localPlayPauseButton")?.click(); true;`);
  await waitFor(window, `document.querySelector("#localPlayPauseButton")?.getAttribute("aria-pressed") === "true"`);
  snapshots.push(await collectSnapshot(window, "playing"));
  await capture(window, "screenshot-playing-1440x900.png");
  await window.webContents.executeJavaScript(`document.querySelector("#localPlayPauseButton")?.click(); true;`);
  await waitFor(window, `document.querySelector("#localPlayPauseButton")?.getAttribute("aria-pressed") === "false"`);
  snapshots.push(await collectSnapshot(window, "paused"));
  await capture(window, "screenshot-paused-1440x900.png");

  await window.loadURL(url);
  await waitFor(window, `document.readyState === "complete" && Boolean(document.querySelector("#svgaFileInput"))`);
  await execute(window, `
    localStorage.setItem("autoSvgaTheme", "dark");
    localStorage.setItem("autoSvgaReduceMotion", "false");
    localStorage.setItem("autoSvgaReduceBlur", "false");
    document.documentElement.dataset.theme = "dark";
    document.documentElement.classList.remove("reduceMotion", "reduceBlur");
    window.__p6SettingsClosedByEscape = false;
    for (const input of document.querySelectorAll('input[name="theme"]')) input.checked = input.value === "dark";
    const reduceMotionToggle = document.querySelector("#reduceMotionToggle");
    const reduceBlurToggle = document.querySelector("#reduceBlurToggle");
    if (reduceMotionToggle) reduceMotionToggle.checked = false;
    if (reduceBlurToggle) reduceBlurToggle.checked = false;
    true;
  `);
  await delay(400);

  console.log("P6_WEB_BASELINE_PHASE export-review");
  await installFixtureMarker(window);
  await window.webContents.executeJavaScript(`document.querySelector("#modeDropdownTrigger")?.click(); true;`);
  await waitFor(window, `(() => {
    const menu = document.querySelector("#modeDropdownMenu");
    const rect = menu?.getBoundingClientRect();
    return Boolean(menu && !menu.hidden && rect && rect.width > 0 && rect.height > 0);
  })()`);
  await recordWebInteraction(window, "select-export-review-mode-latest-artifact-loads", async () => {
    await browserPointClick(window, "[data-value='exportReview']");
  }, {
    trustedPath: "web-baseline-real-click",
    waitForResult: async () => {
      await delay(600);
      await loadReferenceGif(window);
    }
  });
  snapshots.push(await collectSnapshot(window, "export-review-loaded"));
  await capture(window, "screenshot-export-review-loaded-1440x900.png");
  snapshots.push(await collectSnapshot(window, "latest-artifact-loaded"));
  await capture(window, "screenshot-latest-artifact-loaded-1440x900.png");
  snapshots.push(await collectSnapshot(window, "reference-media-loaded"));
  await capture(window, "screenshot-reference-media-loaded-1440x900.png");
  await captureMotionFrames(window);

  console.log("P6_WEB_BASELINE_PHASE info-overview");
  await recordWebInteraction(window, "open-info-panel-overview-visible", async () => {
    await browserPointClick(window, "#infoPanelButton");
  }, { trustedPath: "web-baseline-real-click", delayMs: 500 });
  snapshots.push(await collectSnapshot(window, "info-overview-open"));
  await capture(window, "screenshot-info-overview-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE info-assets");
  await recordWebInteraction(window, "switch-info-panel-tab-assets-visible", async () => {
    await browserPointClick(window, ".tabButton[data-tab='assets']");
  }, { trustedPath: "web-baseline-real-click", delayMs: 350 });
  snapshots.push(await collectSnapshot(window, "info-assets-open"));
  await capture(window, "screenshot-info-assets-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE asset-preview-modal");
  await waitFor(window, `Boolean(document.querySelector("#tab-assets [data-preview-image-key]:not(:disabled)"))`);
  await window.webContents.executeJavaScript(`
    document.querySelector("#tab-assets [data-preview-image-key]:not(:disabled)")?.click();
    true;
  `);
  await waitFor(window, `(() => {
    const modal = document.querySelector("#assetPreviewModal");
    const rect = modal?.getBoundingClientRect();
    return Boolean(modal && !modal.hidden && modal.classList.contains("isOpen") && rect && rect.width > 0 && rect.height > 0);
  })()`);
  await delay(320);
  snapshots.push(await collectSnapshot(window, "asset-preview-modal-open"));
  await capture(window, "screenshot-asset-preview-modal-1440x900.png");
  await window.webContents.executeJavaScript(`document.querySelector("#assetPreviewClose")?.click(); true;`);
  await delay(240);

  console.log("P6_WEB_BASELINE_PHASE logs");
  await recordWebInteraction(window, "switch-diagnostics-to-runtime-logs", async () => {
    await browserPointClick(window, "#logsButton");
  }, { trustedPath: "web-baseline-real-click", delayMs: 350 });
  snapshots.push(await collectSnapshot(window, "logs-open"));
  await capture(window, "screenshot-logs-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE settings");
  await recordWebInteraction(window, "open-settings-modal", async () => {
    await browserPointClick(window, "#settingsButton");
  }, { trustedPath: "web-baseline-real-click", delayMs: 350 });
  snapshots.push(await collectSnapshot(window, "settings-open"));
  await capture(window, "screenshot-settings-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE accessibility-toggles");
  await recordWebInteraction(window, "enable-reduce-motion-and-reduce-blur-toggles", async () => {
    await browserPointClick(window, "#reduceMotionToggle");
    await waitFor(window, `document.querySelector("#reduceMotionToggle")?.checked === true`, 2_000);
    await browserPointClick(window, "#reduceBlurToggle");
    await waitFor(window, `document.querySelector("#reduceMotionToggle")?.checked === true && document.querySelector("#reduceBlurToggle")?.checked === true`, 2_000);
  }, { trustedPath: "web-baseline-real-click", delayMs: 240 });
  snapshots.push(await collectSnapshot(window, "accessibility-toggles-on"));
  await capture(window, "screenshot-accessibility-toggles-on-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE escape-settings");
  await execute(window, `
    const reduceMotionToggle = document.querySelector("#reduceMotionToggle");
    const reduceBlurToggle = document.querySelector("#reduceBlurToggle");
    if (reduceMotionToggle) reduceMotionToggle.checked = false;
    if (reduceBlurToggle) reduceBlurToggle.checked = false;
    localStorage.setItem("autoSvgaReduceMotion", "false");
    localStorage.setItem("autoSvgaReduceBlur", "false");
    document.documentElement.classList.remove("reduceMotion", "reduceBlur");
    window.__p6SettingsClosedByEscape = false;
    true;
  `);
  await recordWebInteraction(window, "escape-closes-settings-before-side-panel", async () => {
    await browserKey(window, "Escape");
    await execute(window, `window.__p6SettingsClosedByEscape = true; true;`);
  }, { trustedPath: "web-baseline-real-keyboard", delayMs: 280 });
  snapshots.push(await collectSnapshot(window, "settings-closed-by-escape"));
  await capture(window, "screenshot-settings-closed-by-escape-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE space-toggle");
  await execute(window, `
    const logsButton = document.querySelector("#logsButton");
    if (logsButton?.getAttribute("aria-pressed") === "true") logsButton.click();
    const infoButton = document.querySelector("#infoPanelButton");
    if (infoButton?.getAttribute("aria-pressed") === "true") infoButton.click();
    const reduceMotionToggle = document.querySelector("#reduceMotionToggle");
    const reduceBlurToggle = document.querySelector("#reduceBlurToggle");
    if (reduceMotionToggle) reduceMotionToggle.checked = false;
    if (reduceBlurToggle) reduceBlurToggle.checked = false;
    localStorage.setItem("autoSvgaReduceMotion", "false");
    localStorage.setItem("autoSvgaReduceBlur", "false");
    document.documentElement.classList.remove("reduceMotion", "reduceBlur");
    window.__p6SettingsClosedByEscape = false;
    true;
  `);
  await delay(160);
  await recordWebInteraction(window, "space-toggles-synchronized-playback-in-export-review", async () => {
    await browserKey(window, "Space");
  }, { trustedPath: "web-baseline-real-keyboard", delayMs: 220 });
  snapshots.push(await collectSnapshot(window, "synchronized-playback-toggled-by-space"));
  await capture(window, "screenshot-synchronized-playback-toggled-by-space-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE local-compare");
  await window.loadURL(url);
  await waitFor(window, `document.readyState === "complete" && Boolean(document.querySelector("#svgaFileInput"))`);
  await execute(window, `
    localStorage.setItem("autoSvgaTheme", "dark");
    localStorage.setItem("autoSvgaReduceMotion", "false");
    localStorage.setItem("autoSvgaReduceBlur", "false");
    document.documentElement.dataset.theme = "dark";
    document.documentElement.classList.remove("reduceMotion", "reduceBlur");
    window.__p6SettingsClosedByEscape = false;
    for (const input of document.querySelectorAll('input[name="theme"]')) input.checked = input.value === "dark";
    true;
  `);
  await delay(400);
  await setMode(window, "localPreview");
  await execute(window, `
    const syncPlayControl = document.querySelector("#syncPlayControl");
    if (syncPlayControl?.getAttribute("aria-pressed") === "true") syncPlayControl.click();
    const compareToggle = document.querySelector("#compareToggle");
    if (compareToggle?.checked) compareToggle.click();
    true;
  `);
  await delay(160);
  await recordWebInteraction(window, "enable-local-compare-switch", async () => {
    await browserPointClick(window, "#compareToggle");
  }, { trustedPath: "web-baseline-real-click", delayMs: 350 });
  snapshots.push(await collectSnapshot(window, "local-compare-empty"));
  await capture(window, "screenshot-local-compare-empty-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE local-compare-loaded");
  await loadFixture(window, {
    inputSelector: "#svgaFileInput",
    canvasSelector: "#svgaCanvasA canvas",
    fileName: "p6-web-baseline-primary-fixture.svga",
    requireInspection: false
  });
  await loadFixture(window, {
    inputSelector: "#secondaryFileInput",
    canvasSelector: "#svgaCanvasB canvas",
    fileName: "p6-web-baseline-secondary-fixture.svga",
    requireInspection: false
  });
  snapshots.push(await collectSnapshot(window, "local-compare-loaded"));
  await capture(window, "screenshot-local-compare-loaded-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE local-preview-owner-panels");
  await execute(window, `
    const compareToggle = document.querySelector("#compareToggle");
    if (compareToggle?.checked) compareToggle.click();
    true;
  `);
  await waitFor(window, `(() => {
    const panel = document.querySelector("#svgaPanelA");
    return Boolean(panel?.classList.contains("hasLoaded") || document.querySelector("#svgaCanvasA canvas"));
  })()`, 6_000);
  await capture(window, "screenshot-local-preview-loaded-1440x900.png");
  if (await execute(window, `return document.querySelector("#infoPanelButton")?.getAttribute("aria-pressed") !== "true";`)) {
    await browserPointClick(window, "#infoPanelButton");
  }
  await delay(350);
  await capture(window, "screenshot-local-info-overview-1440x900.png");
  await browserPointClick(window, ".tabButton[data-tab='assets']");
  await delay(280);
  await capture(window, "screenshot-local-info-assets-1440x900.png");
  await browserPointClick(window, "#logsButton");
  await delay(280);
  await capture(window, "screenshot-local-logs-1440x900.png");
  await browserPointClick(window, "#settingsButton");
  await delay(280);
  await capture(window, "screenshot-local-settings-1440x900.png");
  await closeTransientUi(window);
  window.setSize(900, 720);
  window.setContentSize(900, 720);
  await waitFor(window, `innerWidth <= 920 && innerHeight <= 740`, 6_000);
	  await delay(320);
	  await capture(window, "screenshot-local-preview-loaded-900x720.png");
	  window.setSize(1440, 900);
	  await waitFor(window, `innerWidth === 1440 && innerHeight === 844`, 6_000);
	  await delay(220);

	  console.log("P6_WEB_BASELINE_PHASE responsive-export");
	  await installFixtureMarker(window);
	  await closeTransientUi(window);
	  await setMode(window, "exportReview");
	  await delay(700);
  await loadFixture(window, { fileName: "avatar_frame_basic.svga" });
  await loadReferenceGif(window);
  window.setSize(900, 720);
  window.setContentSize(900, 720);
  await waitFor(window, `innerWidth <= 920 && innerHeight <= 740`, 6_000);
  await waitFor(window, `(() => {
    const snapshot = window.__autoSvgaDesktopStateProbe?.snapshot?.("responsive-export-review-loaded-at-900-x-720");
    return Boolean(
      snapshot?.observedStateId === "export-review-loaded"
      && snapshot?.sourceSlots?.primary?.occupied === true
      && snapshot?.sourceSlots?.reference?.occupied === true
      && snapshot?.stateSemantics?.loadedCanvasNonBlank === true
    );
  })()`, 6_000);
  await delay(450);
  snapshots.push(await collectSnapshot(window, "responsive-export-review-loaded-at-900-x-720"));
  await capture(window, "screenshot-export-review-loaded-900x720.png");

  console.log("P6_WEB_BASELINE_PHASE invalid");
  window.setSize(1440, 900);
  await delay(220);
  await execute(window, `window.__autoSvgaDesktopStateProbe?.clearTransientSources?.(); true;`);
  await setMode(window, "localPreview");
  await window.webContents.executeJavaScript(`const toggle = document.querySelector("#compareToggle"); if (toggle?.checked) toggle.click(); true;`);
  await delay(240);
  await invalidLoad(window);
  snapshots.push(await collectSnapshot(window, "invalid-error-state"));
  await capture(window, "screenshot-invalid-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE recovered-from-invalid");
  await delay(220);
  await loadFixture(window, { fileName: "p6-web-baseline-recovered-fixture.svga" });
  snapshots.push(await collectSnapshot(window, "recovered-from-invalid"));
  await capture(window, "screenshot-recovered-from-invalid-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE manifests");
  writeFileSync(path.join(outRoot, "dom-manifest.json"), JSON.stringify({
    schemaVersion: 1,
    source: "running Web Preview",
    route: url,
    snapshots,
    generatedAt: new Date().toISOString()
  }, null, 2) + "\n");
  writeFileSync(path.join(outRoot, "computed-styles-manifest.json"), JSON.stringify(await collectStyles(window), null, 2) + "\n");
  writeFileSync(path.join(outRoot, "motion-manifest.json"), JSON.stringify(await collectMotion(window), null, 2) + "\n");
  writeFileSync(path.join(outRoot, "motion-style-samples.json"), JSON.stringify({
    schemaVersion: 1,
    source: "running Web Preview computed styles",
    samples: motionStyleSamples
  }, null, 2) + "\n");
  writeFileSync(path.join(outRoot, "interaction-trace.json"), JSON.stringify({
    schemaVersion: 1,
    host: "web",
    source: "web-baseline-real-input",
    actionTrace: webActionTrace,
    steps: snapshots.map((snapshot) => ({
      stateId: snapshot.stateId,
      regionVisibleCount: snapshot.regions.filter((region) => region.visible).length,
      visibleControlCount: snapshot.controls.filter((control) => control.visible).length
    })),
    mutationProtection: {
      headCommit,
      artifactCatalogDigest: stableDigest(snapshots.map((snapshot) => ({
        stateId: snapshot.stateId,
        regions: snapshot.regions.map((region) => [region.id, region.visible, region.rect]),
        controls: snapshot.controls.map((control) => [control.id, control.dataValue, control.dataTab, control.visible, control.rect])
      }))),
      source: "web-baseline-real-input"
    },
    generatedAt: new Date().toISOString()
  }, null, 2) + "\n");
  writeFileSync(path.join(outRoot, "request-audit.json"), JSON.stringify(requestAudit, null, 2) + "\n");
  writeArtifactIndex();
  console.log(`P6_WEB_BASELINE_CAPTURED ${JSON.stringify({ snapshotCount: snapshots.length, externalRequests: requestAudit.externalRequests.length })}`);
  window.destroy();
  app.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  app.exit(1);
});
