export async function inspectShortTermSvga({ bytes, name, reportToken }) {
  return postBytes(`/api/short-term-product-inspection-model?name=${encodeURIComponent(name)}`, bytes, reportToken);
}

export async function optimizeShortTermSvga({ bytes, name, reportToken }) {
  return postBytes(`/api/short-term-product-optimization-workflow?name=${encodeURIComponent(name)}`, bytes, reportToken);
}

export async function renameShortTermImageKey({
  bytes,
  name,
  fromImageKey,
  toImageKey,
  reportToken
}) {
  return postBytes(
    `/api/short-term-product-image-key-rename?name=${encodeURIComponent(name)}&from=${encodeURIComponent(fromImageKey)}&to=${encodeURIComponent(toImageKey)}`,
    bytes,
    reportToken
  );
}

export async function replaceShortTermImageAsset({ payload, reportToken }) {
  return postJson("/api/short-term-product-image-replacement-workflow", payload, reportToken);
}

export async function probeInvalidShortTermInspection({ reportToken }) {
  return fetch("/api/short-term-product-inspection-model?name=invalid.svga", {
    method: "POST",
    headers: authHeaders(reportToken),
    body: new Uint8Array([0, 1, 2, 3, 4])
  });
}

async function postBytes(url, bytes, reportToken) {
  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(reportToken),
    body: bytes
  });
  return readJsonResponse(response);
}

async function postJson(url, payload, reportToken) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(reportToken),
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(payload)
  });
  return readJsonResponse(response);
}

function authHeaders(reportToken) {
  return reportToken ? { "x-auto-svga-prototype-token": reportToken } : {};
}

async function readJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败 (${response.status})`);
  return payload;
}
