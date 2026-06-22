import { FILL_MODE, Parser as SvgaWebParser, Player as SvgaWebPlayer } from "/vendor/svga-web-2.4.4.js";

function createElectronProductHostAdapter(environment = globalThis) {
  const bridge = environment.autoSvgaElectronHost;
  const reportToken = bridge?.reportToken ?? "";
  const fetchApi = environment.fetch?.bind(environment);
  const urlApi = environment.URL;
  const storage = environment.localStorage ?? createMemoryStorage();

  if (!fetchApi) throw new Error("Electron host adapter requires fetch.");
  if (!urlApi?.createObjectURL || !urlApi?.revokeObjectURL) {
    throw new Error("Electron host adapter requires object URL support.");
  }

  return Object.freeze({
    hostKind: "electron",
    capabilities: Object.freeze({
      browserFileInput: true,
      browserDragDrop: true,
      latestArtifactHttpApi: false,
      browserObjectUrl: true,
      browserDownload: false,
      electronFileDialog: Boolean(bridge?.openSvgaFile),
      nativeSaveAs: Boolean(bridge?.saveEditedSvga),
      editorIncubationDefaultVisible: false
    }),
    storage,
    urls: Object.freeze({
      createObjectURL: (value) => urlApi.createObjectURL(value),
      revokeObjectURL: (value) => urlApi.revokeObjectURL(value)
    }),
    http: Object.freeze({
      fetch(input, init = {}) {
        const requestUrl = new URL(typeof input === "string" ? input : input.url, environment.location.origin);
        if (requestUrl.pathname === "/api/latest-artifact") {
          return Promise.resolve(jsonResponse({
            latestWithSvga: null,
            latestAny: null,
            artifacts: [],
            warnings: ["Electron 默认产品页不自动扫描 Web Preview 产物。"]
          }));
        }
        if (requestUrl.pathname !== "/api/avatar-frame-inspection-report" || !reportToken) {
          return fetchApi(input, init);
        }
        const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
        headers.set("x-auto-svga-prototype-token", reportToken);
        return fetchApi(input, { ...init, headers });
      }
    }),
    environment: Object.freeze({
      productMilestoneId: bridge?.productMilestoneId ?? "P6",
      localOnly: bridge?.localOnly === true,
      telemetry: bridge?.telemetry ?? "disabled"
    })
  });
}

function installSvgaWebCompatibility() {
  globalThis.SVGA = Object.freeze({
    Parser: CompatibleSvgaParser,
    Player: CompatibleSvgaPlayer
  });
}

class CompatibleSvgaParser {
  constructor() {
    this.parser = new SvgaWebParser();
  }

  load(source, resolve, reject) {
    fetch(source)
      .then((response) => {
        if (!response.ok) throw new Error(`SVGA fetch failed (${response.status})`);
        return response.arrayBuffer();
      })
      .then((bytes) => this.parser.do(bytes))
      .then(resolve, reject);
  }
}

class CompatibleSvgaPlayer {
  constructor(target) {
    this.root = typeof target === "string" ? document.querySelector(target) : target;
    if (!this.root) throw new Error("SVGA target element not found.");
    this.canvas = ensureCanvas(this.root);
    this.player = new SvgaWebPlayer(this.canvas);
    this.videoItem = undefined;
    this.ready = Promise.resolve();
    this.loop = true;
  }

  set loops(value) {
    this.loop = value === 0 || value === true;
    this.player.set({ loop: this.loop, fillMode: FILL_MODE.FORWARDS, noExecutionDelay: false });
  }

  get loops() {
    return this.loop ? 0 : 1;
  }

  set clearsAfterStop(_value) {
    // svga-web clears explicitly through clear(); shared product keeps this legacy flag.
  }

  setContentMode(_value) {
    // svga-web renders into the canvas; sizing is handled by shared product CSS/layout.
  }

  setVideoItem(videoItem) {
    this.videoItem = videoItem;
    this.ready = this.player.mount(videoItem);
  }

  startAnimation() {
    this.ready.then(() => {
      this.player.set({ loop: this.loop, fillMode: FILL_MODE.FORWARDS, noExecutionDelay: false });
      this.player.start();
    }).catch((error) => console.error(error));
  }

  pauseAnimation() {
    this.player.pause();
  }

  stepToFrame(frame, playAfter = false) {
    this.ready.then(() => {
      drawFrame(this.player, this.videoItem, frame);
      if (playAfter) this.startAnimation();
    }).catch((error) => console.error(error));
  }

  clear() {
    this.player.clear();
  }

  onFinished(callback) {
    this.player.$on("end", callback);
  }
}

function ensureCanvas(root) {
  if (root instanceof HTMLCanvasElement) return root;
  let canvas = root.querySelector("canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    root.append(canvas);
  }
  return canvas;
}

function drawFrame(player, videoItem, frame) {
  if (!videoItem || !player.renderer?.drawFrame) return;
  const safeFrame = Math.max(0, Math.min((videoItem.frames ?? 1) - 1, Number(frame) || 0));
  player.animator.stop();
  player.currentFrame = safeFrame;
  player.renderer.drawFrame(videoItem.images, videoItem.sprites, videoItem.dynamicElements, safeFrame);
}

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    }
  };
}

installSvgaWebCompatibility();
globalThis.autoSvgaHostAdapter = createElectronProductHostAdapter();

await import("/tools/shared/product-frontend/product-app.mjs");
