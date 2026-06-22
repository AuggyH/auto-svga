const { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } = require("node:fs");
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

async function captureMotionFrames(window) {
  for (const motion of contract.motions ?? []) {
    await delay(80);
    await capture(window, `web-motion-${motion.id}-start.png`);
    await delay(220);
    await capture(window, `web-motion-${motion.id}-mid.png`);
    await delay(220);
    await capture(window, `web-motion-${motion.id}-end.png`);
  }
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
      const panel = document.querySelector("#infoPanel:not([hidden])") ? "info"
        : document.querySelector("#logsPanel:not([hidden])") ? "logs"
          : "none";
      const modal = document.querySelector("#settingsModal:not([hidden]), #assetPreviewModal:not([hidden])")?.id ?? "none";
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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  console.log("P6_WEB_BASELINE_PHASE load-url");
  await window.loadURL(url);
  await waitFor(window, `document.readyState === "complete" && Boolean(document.querySelector("#svgaFileInput"))`);
  await delay(800);

  console.log("P6_WEB_BASELINE_PHASE local-empty");
  const snapshots = [];
  snapshots.push(await collectSnapshot(window, "local-empty"));
  await capture(window, "screenshot-local-empty-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE mode-menu-open");
  await window.webContents.executeJavaScript(`document.querySelector("#modeDropdownTrigger")?.click(); true;`);
  await waitFor(window, `(() => {
    const menu = document.querySelector("#modeDropdownMenu");
    return Boolean(menu && !menu.hidden);
  })()`);
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
  await setMode(window, "exportReview");
  await loadReferenceGif(window);
  snapshots.push(await collectSnapshot(window, "export-review-loaded"));
  await capture(window, "screenshot-export-review-loaded-1440x900.png");
  snapshots.push(await collectSnapshot(window, "latest-artifact-loaded"));
  await capture(window, "screenshot-latest-artifact-loaded-1440x900.png");
  snapshots.push(await collectSnapshot(window, "reference-media-loaded"));
  await capture(window, "screenshot-reference-media-loaded-1440x900.png");
  await captureMotionFrames(window);

  console.log("P6_WEB_BASELINE_PHASE info-overview");
  await window.webContents.executeJavaScript(`document.querySelector("#infoPanelButton")?.click(); true;`);
  await delay(500);
  snapshots.push(await collectSnapshot(window, "info-overview-open"));
  await capture(window, "screenshot-info-overview-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE info-assets");
  await window.webContents.executeJavaScript(`
    [...document.querySelectorAll("button")].find((button) => /资产|资源|Assets/i.test(button.textContent || button.title || ""))?.click();
    true;
  `);
  await delay(350);
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
  await window.webContents.executeJavaScript(`document.querySelector("#logsButton")?.click(); true;`);
  await delay(350);
  snapshots.push(await collectSnapshot(window, "logs-open"));
  await capture(window, "screenshot-logs-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE settings");
  await window.webContents.executeJavaScript(`document.querySelector("#settingsButton")?.click(); true;`);
  await delay(350);
  snapshots.push(await collectSnapshot(window, "settings-open"));
  await capture(window, "screenshot-settings-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE accessibility-toggles");
  await window.webContents.executeJavaScript(`
    document.querySelector("#reduceMotionToggle")?.click();
    document.querySelector("#reduceBlurToggle")?.click();
    true;
  `);
  await delay(180);
  snapshots.push(await collectSnapshot(window, "accessibility-toggles-on"));
  await capture(window, "screenshot-accessibility-toggles-on-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE escape-settings");
  await window.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
  await window.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
  await delay(280);
  snapshots.push(await collectSnapshot(window, "settings-closed-by-escape"));
  await capture(window, "screenshot-settings-closed-by-escape-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE space-toggle");
  await window.webContents.sendInputEvent({ type: "keyDown", keyCode: "Space" });
  await window.webContents.sendInputEvent({ type: "keyUp", keyCode: "Space" });
  await delay(220);
  snapshots.push(await collectSnapshot(window, "synchronized-playback-toggled-by-space"));
  await capture(window, "screenshot-synchronized-playback-toggled-by-space-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE local-compare");
  await setMode(window, "localPreview");
  await window.webContents.executeJavaScript(`const toggle = document.querySelector("#compareToggle"); if (toggle && !toggle.checked) toggle.click(); true;`);
  await delay(350);
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
  await invalidLoad(window);
  snapshots.push(await collectSnapshot(window, "invalid-error-state"));
  await capture(window, "screenshot-invalid-1440x900.png");

  console.log("P6_WEB_BASELINE_PHASE recovered-from-invalid");
  window.setSize(1440, 900);
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
  writeFileSync(path.join(outRoot, "interaction-trace.json"), JSON.stringify({
    schemaVersion: 1,
    actionTrace: (contract.interactions ?? []).map((interaction) => {
      const snapshot = snapshots.find((candidate) => (
        candidate.stateId === interaction.expectedState
        || (interaction.expectedState === "synchronized-playback-toggled-by-space" && candidate.stateId === "space-sync-toggle")
      ));
      const selectorId = interaction.selector?.startsWith("#") ? interaction.selector.slice(1) : null;
      const dataValue = interaction.selector?.match(/^\\[data-value=['"]?([^'"]+)['"]?\\]$/)?.[1] ?? null;
      const dataTab = interaction.selector?.match(/data-tab=['"]?([^'"]+)['"]?/)?.[1] ?? null;
      const target = snapshot?.controls.find((control) => control.id === selectorId)
        ?? snapshot?.controls.find((control) => dataValue && control.dataValue === dataValue)
        ?? snapshot?.controls.find((control) => dataTab && control.dataTab === dataTab)
        ?? snapshot?.regions.find((region) => region.selector === interaction.selector);
      return {
        id: interaction.id,
        kind: interaction.trigger,
        selector: interaction.selector,
        initialState: interaction.initialState,
        expectedState: interaction.expectedState,
        stateReached: snapshot?.stateId ?? null,
        source: "web-baseline-input",
        targetRect: target?.rect ?? null,
        controlValue: target ? {
          visible: target.visible === true,
          disabled: target.disabled === true,
          checked: target.checked === true
        } : null
      };
    }),
    steps: snapshots.map((snapshot) => ({
      stateId: snapshot.stateId,
      regionVisibleCount: snapshot.regions.filter((region) => region.visible).length,
      visibleControlCount: snapshot.controls.filter((control) => control.visible).length
    })),
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
