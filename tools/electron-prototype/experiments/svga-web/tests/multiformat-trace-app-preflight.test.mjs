import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  assertTraceAppPreflight,
  traceBundleIdentifier,
  traceHelperBundleIdentifier,
  traceMarkerFile,
  traceRunId
} from "../scripts/multiformat-trace-app-preflight.mjs";

test("trace app preflight fails when main and helper bundle ids use different prefixes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "auto-svga-trace-preflight-"));
  try {
    const app = await createFixtureApp(root, {
      mainBundleIdentifier: traceBundleIdentifier,
      helperBundleIdentifier: "local.auto-svga.internal-prototype.helper"
    });

    const result = await assertTraceAppPreflight(app);

    assert.equal(result.passed, false);
    assert.ok(result.findings.some((finding) => finding.includes("local.auto-svga.internal-prototype.helper")));
    assert.ok(result.findings.some((finding) => finding.includes(traceHelperBundleIdentifier)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trace app preflight accepts consistent main/helper ids and matching asar integrity", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "auto-svga-trace-preflight-"));
  try {
    const app = await createFixtureApp(root, {
      mainBundleIdentifier: traceBundleIdentifier,
      helperBundleIdentifier: traceHelperBundleIdentifier
    });

    const result = await assertTraceAppPreflight(app);

    assert.equal(result.passed, true);
    assert.deepEqual(result.findings, []);
    assert.equal(result.marker, traceRunId);
    assert.equal(result.helperBundleIdentifiers.length, 4);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function createFixtureApp(root, options) {
  const app = path.join(root, "Trace.app");
  const contents = path.join(app, "Contents");
  const resources = path.join(contents, "Resources");
  const macos = path.join(contents, "MacOS");
  const frameworks = path.join(contents, "Frameworks");
  const executableName = "Auto SVGA";
  const asarPath = path.join(resources, "app.asar");
  const asarBytes = createFixtureAsar();
  const asarHeaderHash = createHash("sha256").update(asarBytes.header).digest("hex");

  await mkdir(resources, { recursive: true });
  await mkdir(macos, { recursive: true });
  await mkdir(frameworks, { recursive: true });
  await writeFile(path.join(macos, executableName), "");
  await chmod(path.join(macos, executableName), 0o755);
  await writeFile(asarPath, asarBytes.buffer);
  await writeFile(path.join(resources, traceMarkerFile), `${traceRunId}\n`);
  await writeFile(path.join(contents, "Info.plist"), plist({
    bundleIdentifier: options.mainBundleIdentifier,
    executableName,
    displayName: "Trace",
    asarHeaderHash
  }));

  for (const suffix of ["", " (GPU)", " (Plugin)", " (Renderer)"]) {
    const helperName = `Auto SVGA Helper${suffix}`;
    const helperContents = path.join(frameworks, `${helperName}.app`, "Contents");
    await mkdir(path.join(helperContents, "MacOS"), { recursive: true });
    await writeFile(path.join(helperContents, "MacOS", helperName), "");
    await chmod(path.join(helperContents, "MacOS", helperName), 0o755);
    await writeFile(path.join(helperContents, "Info.plist"), plist({
      bundleIdentifier: options.helperBundleIdentifier,
      executableName: helperName,
      displayName: helperName,
      asarHeaderHash
    }));
  }

  return app;
}

function createFixtureAsar() {
  const header = Buffer.from(JSON.stringify({ files: { "index.js": { size: 0, offset: "0" } } }), "utf8");
  const buffer = Buffer.alloc(16 + header.length);
  buffer.writeUInt32LE(4, 0);
  buffer.writeUInt32LE(4, 4);
  buffer.writeUInt32LE(header.length + 4, 8);
  buffer.writeUInt32LE(header.length, 12);
  header.copy(buffer, 16);
  return { buffer, header };
}

function plist({ bundleIdentifier, executableName, displayName, asarHeaderHash }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>${bundleIdentifier}</string>
  <key>CFBundleExecutable</key>
  <string>${executableName}</string>
  <key>CFBundleName</key>
  <string>${displayName}</string>
  <key>CFBundleDisplayName</key>
  <string>${displayName}</string>
  <key>ElectronAsarIntegrity</key>
  <dict>
    <key>Resources/app.asar</key>
    <dict>
      <key>algorithm</key>
      <string>SHA256</string>
      <key>hash</key>
      <string>${asarHeaderHash}</string>
    </dict>
  </dict>
</dict>
</plist>
`;
}
