export function createWebHostAdapter(environment = globalThis) {
  const storage = environment.localStorage ?? createMemoryStorage();
  const urlApi = environment.URL;
  const fetchApi = environment.fetch?.bind(environment);

  if (!fetchApi) {
    throw new Error("WebHostAdapter requires fetch.");
  }
  if (!urlApi?.createObjectURL || !urlApi?.revokeObjectURL) {
    throw new Error("WebHostAdapter requires object URL support.");
  }

  return Object.freeze({
    hostKind: "web",
    capabilities: Object.freeze({
      browserFileInput: true,
      browserDragDrop: true,
      latestArtifactHttpApi: true,
      browserObjectUrl: true,
      browserDownload: true,
      electronFileDialog: false,
      nativeSaveAs: false,
      editorIncubationDefaultVisible: false
    }),
    storage,
    urls: Object.freeze({
      createObjectURL: (value) => urlApi.createObjectURL(value),
      revokeObjectURL: (value) => urlApi.revokeObjectURL(value)
    }),
    http: Object.freeze({
      fetch: fetchApi
    }),
    environment: Object.freeze({
      userAgent: environment.navigator?.userAgent ?? "unknown",
      hasSecureContext: Boolean(environment.isSecureContext)
    })
  });
}

export function getProductHostAdapter(environment = globalThis) {
  return environment.autoSvgaHostAdapter ?? createWebHostAdapter(environment);
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
