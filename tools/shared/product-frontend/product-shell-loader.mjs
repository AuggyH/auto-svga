export async function mountProductShell(options = {}) {
  if (document.querySelector("[data-product-shell='canonical']")) return;
  const mount = options.mount ?? document.querySelector("#productShellMount");
  if (!mount) {
    throw new Error("Product shell mount point is missing.");
  }
  const shellUrl = options.shellUrl ?? mount.dataset.productShellSrc ?? new URL("./product-shell.html", import.meta.url).href;
  const expectedSha256 = options.sha256 ?? mount.dataset.productShellSha256;
  const response = await fetch(shellUrl);
  if (!response.ok) {
    throw new Error(`Unable to load product shell: HTTP ${response.status}`);
  }
  const source = await response.text();
  if (expectedSha256) {
    const actualSha256 = await sha256Hex(source);
    if (actualSha256 !== expectedSha256) {
      throw new Error("Product shell source hash mismatch.");
    }
  }
  const template = document.createElement("template");
  template.innerHTML = source.trim();
  const shell = template.content.querySelector("[data-product-shell='canonical']");
  if (!shell) {
    throw new Error("Canonical product shell is missing from shell source.");
  }
  mount.replaceWith(template.content.cloneNode(true));
}

async function sha256Hex(value) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) return "";
  const bytes = new TextEncoder().encode(value);
  const digest = await cryptoApi.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
