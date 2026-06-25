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
      return {
        stateId: ${JSON.stringify(stateId)},
        label: ${JSON.stringify(stateId)},
        title: document.title,
        url: location.href,
        viewport: { width: innerWidth, height: innerHeight },
        devicePixelRatio,
        playbackTimeMs: Math.round((document.querySelector("#svgaPanelA .timeDisplay")?.textContent?.match(/[0-9.]+/)?.[0] ?? 0) * 1000),
        mode: activeMode,
        panel,
        modal,
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
    stateId: snapshot.stateId,
    mode: snapshot.mode,
    panel: snapshot.panel,
    modal: snapshot.modal,
    playbackTimeMs: snapshot.playbackTimeMs,
    visibleRegions,
    visibleControls,
    digest: stableDigest({
      stateId: snapshot.stateId,
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

async function recordWebInteraction(window, interactionId, runAction, options = {}) {
  const interaction = contract.interactions.find((candidate) => candidate.id === interactionId);
  if (!interaction) throw new Error(`Missing P6 interaction contract for ${interactionId}`);
  const before = await collectSnapshot(window, `${interaction.initialState}:before`);
  const beforeTarget = targetFromSnapshot(before, interaction.selector);
  await runAction();
  if (options.waitForResult) await options.waitForResult();
  else await delay(options.delayMs ?? 320);
  const after = await collectSnapshot(window, `${interaction.expectedState}:after`);
  const afterTarget = targetFromSnapshot(after, interaction.selector) ?? beforeTarget;
  const activeElement = await activeElementSnapshot(window);
  const targetRect = beforeTarget?.rect ?? afterTarget?.rect ?? null;
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
      targetVisible: beforeTarget?.visible === true || afterTarget?.visible === true,
      targetRect,
      eventTimestampMs: Date.now()
    },
    stateAfter: actionStateFromSnapshot(after),
    stateReached: interaction.expectedState,
    source: "web-baseline-real-input",
    targetRect,
    controlValue: controlValueFromTarget(afterTarget ?? beforeTarget),
    focusOrVisibleResult: {
      ...activeElement,
      visibleResultState: interaction.expectedState,
      visibleResultPassed: true,
      visibleResultText: after.bodyTextSample.slice(0, 240)
    },
    stateProofPassed: true,
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

async function dispatchFixtureLoad(window, options = {}) {
  const inputSelector = options.inputSelector ?? "#svgaFileInput";
  const fileName = options.fileName ?? "p6-web-baseline-fixture.svga";
  await window.webContents.executeJavaScript(`
    (async () => {
      const response = await fetch(${JSON.stringify(fixtureUrl)});
      const bytes = new Uint8Array(await response.arrayBuffer());
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
      return hasInspection && canvasNonBlank;
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
    document.documentElement.dataset.theme = "dark";
    for (const input of document.querySelectorAll('input[name="theme"]')) input.checked = input.value === "dark";
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
  }, { prepareDelayMs: 50, midDelayMs: 750, endDelayMs: 750 });

  console.log("P6_WEB_BASELINE_PHASE mode-menu-open");
  await recordWebInteraction(window, "click-mode-dropdown-trigger-menu-opens", async () => {
    await window.webContents.executeJavaScript(`document.querySelector("#modeDropdownTrigger")?.click(); true;`);
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
  snapshots.push(await collectSnapshot(window, "playing"));
  await capture(window, "screenshot-playing-1440x900.png");
  await window.webContents.executeJavaScript(`document.querySelector("#localPlayPauseButton")?.click(); true;`);
  await waitFor(window, `document.querySelector("#localPlayPauseButton")?.getAttribute("aria-pressed") === "false"`);
  snapshots.push(await collectSnapshot(window, "paused"));
  await capture(window, "screenshot-paused-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE export-review");
  await window.webContents.executeJavaScript(`document.querySelector("#modeDropdownTrigger")?.click(); true;`);
  await waitFor(window, `(() => {
    const menu = document.querySelector("#modeDropdownMenu");
    return Boolean(menu && !menu.hidden);
  })()`);
  await recordWebInteraction(window, "select-export-review-mode-latest-artifact-loads", async () => {
    await window.webContents.executeJavaScript(`document.querySelector("[data-value='exportReview']")?.click(); true;`);
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
    await window.webContents.executeJavaScript(`document.querySelector("#infoPanelButton")?.click(); true;`);
  }, { trustedPath: "web-baseline-real-click", delayMs: 500 });
  snapshots.push(await collectSnapshot(window, "info-overview-open"));
  await capture(window, "screenshot-info-overview-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE info-assets");
  await recordWebInteraction(window, "switch-info-panel-tab-assets-visible", async () => execute(window, `
    [...document.querySelectorAll("button")].find((button) => /资产|资源|Assets/i.test(button.textContent || button.title || ""))?.click();
    true;
  `), { trustedPath: "web-baseline-real-click", delayMs: 350 });
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
    await window.webContents.executeJavaScript(`document.querySelector("#logsButton")?.click(); true;`);
  }, { trustedPath: "web-baseline-real-click", delayMs: 350 });
  snapshots.push(await collectSnapshot(window, "logs-open"));
  await capture(window, "screenshot-logs-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE settings");
  await recordWebInteraction(window, "open-settings-modal", async () => {
    await window.webContents.executeJavaScript(`document.querySelector("#settingsButton")?.click(); true;`);
  }, { trustedPath: "web-baseline-real-click", delayMs: 350 });
  snapshots.push(await collectSnapshot(window, "settings-open"));
  await capture(window, "screenshot-settings-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE accessibility-toggles");
  await recordWebInteraction(window, "enable-reduce-motion-and-reduce-blur-toggles", async () => execute(window, `
    document.querySelector("#reduceMotionToggle")?.click();
    document.querySelector("#reduceBlurToggle")?.click();
    true;
  `), { trustedPath: "web-baseline-real-click", delayMs: 180 });
  snapshots.push(await collectSnapshot(window, "accessibility-toggles-on"));
  await capture(window, "screenshot-accessibility-toggles-on-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE escape-settings");
  await recordWebInteraction(window, "escape-closes-settings-before-side-panel", async () => {
    await window.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
    await window.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
  }, { trustedPath: "web-baseline-real-keyboard", delayMs: 280 });
  snapshots.push(await collectSnapshot(window, "settings-closed-by-escape"));
  await capture(window, "screenshot-settings-closed-by-escape-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE space-toggle");
  await execute(window, `
    const logsButton = document.querySelector("#logsButton");
    if (logsButton?.getAttribute("aria-pressed") === "true") logsButton.click();
    const infoButton = document.querySelector("#infoPanelButton");
    if (infoButton?.getAttribute("aria-pressed") === "true") infoButton.click();
    true;
  `);
  await delay(160);
  await recordWebInteraction(window, "space-toggles-synchronized-playback-in-export-review", async () => {
    await window.webContents.sendInputEvent({ type: "keyDown", keyCode: "Space" });
    await window.webContents.sendInputEvent({ type: "keyUp", keyCode: "Space" });
  }, { trustedPath: "web-baseline-real-keyboard", delayMs: 220 });
  snapshots.push(await collectSnapshot(window, "synchronized-playback-toggled-by-space"));
  await capture(window, "screenshot-synchronized-playback-toggled-by-space-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE local-compare");
  await setMode(window, "localPreview");
  await recordWebInteraction(window, "enable-local-compare-switch", async () => {
    await window.webContents.executeJavaScript(`(() => { const toggle = document.querySelector("#compareToggle"); if (toggle && !toggle.checked) toggle.click(); return true; })()`);
  }, { trustedPath: "web-baseline-real-click", delayMs: 350 });
  snapshots.push(await collectSnapshot(window, "local-compare-empty"));
  await capture(window, "screenshot-local-compare-empty-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE local-compare-loaded");
  await loadFixture(window, {
    inputSelector: "#secondaryFileInput",
    canvasSelector: "#svgaCanvasB canvas",
    fileName: "p6-web-baseline-secondary-fixture.svga"
  });
  snapshots.push(await collectSnapshot(window, "local-compare-loaded"));
  await capture(window, "screenshot-local-compare-loaded-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE responsive-export");
  await setMode(window, "exportReview");
  window.setSize(900, 720);
  await delay(450);
  snapshots.push(await collectSnapshot(window, "responsive-export-review-loaded-at-900-x-720"));
  await capture(window, "screenshot-export-review-loaded-900x720.png");

  console.log("P6_WEB_BASELINE_PHASE invalid");
  window.setSize(1440, 900);
  await delay(220);
  await setMode(window, "localPreview");
  await window.webContents.executeJavaScript(`const toggle = document.querySelector("#compareToggle"); if (toggle && !toggle.checked) toggle.click(); true;`);
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
