import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prototypeRoot = path.resolve(experimentRoot, "../..");
const runtimeRoot = path.join(experimentRoot, ".runtime");
const expectedVendorHashes = new Map([
  ["svga-web-2.4.4.js", "6235bc9802e76dd517343123ec730d25e02c4d476b66b81ef26befe7881f3c50"]
]);

await verifyVendorAssets();
await rm(runtimeRoot, { recursive: true, force: true });
await mkdir(runtimeRoot, { recursive: true });
await cp(path.join(prototypeRoot, ".runtime/dist"), path.join(runtimeRoot, "dist"), { recursive: true });
await cp(path.join(prototypeRoot, ".runtime/tools"), path.join(runtimeRoot, "tools"), { recursive: true });
await cp(path.join(prototypeRoot, ".runtime/fixture"), path.join(runtimeRoot, "fixture"), { recursive: true });
await cp(path.join(prototypeRoot, ".runtime/proto"), path.join(runtimeRoot, "proto"), { recursive: true });
await writeFile(path.join(runtimeRoot, "manifest.json"), JSON.stringify({
  runtime: "svga-web-strict-csp-spike",
  sourceRuntime: path.relative(experimentRoot, path.join(prototypeRoot, ".runtime")),
  vendor: "svga-web@2.4.4",
  strictCsp: true
}, null, 2));

console.log("svga-web strict-CSP experiment runtime prepared");

async function verifyVendorAssets() {
  for (const [name, expectedHash] of expectedVendorHashes) {
    const bytes = await readFile(path.join(experimentRoot, "vendor", name));
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== expectedHash) throw new Error(`Vendor checksum mismatch: ${name}`);
    const source = bytes.toString("utf8");
    if (source.includes("eval(") || source.includes("Function(")) {
      throw new Error(`Vendor is not strict-CSP compatible: ${name}`);
    }
  }
}
