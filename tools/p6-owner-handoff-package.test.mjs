import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { buildZipPrivacyAudit } from "./p6/build-p6-owner-handoff.mjs";

async function withTempDir(callback) {
  const directory = await mkdtemp(join(tmpdir(), "auto-svga-p6-package-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function writeZip(folder, name, entries) {
  const source = join(folder, `${name}-source`);
  await mkdir(source, { recursive: true });
  for (const [entryName, content] of Object.entries(entries)) {
    const filePath = join(source, entryName);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
  const zipPath = join(folder, name);
  execFileSync("zip", ["-q", "-X", zipPath, "-r", "."], {
    cwd: source,
    env: { ...process.env, COPYFILE_DISABLE: "1" }
  });
  return zipPath;
}

function pngWithText(keyword, value) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data = Buffer.alloc(0)) => Buffer.concat([
    Buffer.from([
      (data.length >>> 24) & 0xff,
      (data.length >>> 16) & 0xff,
      (data.length >>> 8) & 0xff,
      data.length & 0xff
    ]),
    Buffer.from(type, "ascii"),
    data,
    Buffer.alloc(4)
  ]);
  return Buffer.concat([
    signature,
    chunk("IHDR", Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
    chunk("tEXt", Buffer.from(`${keyword}\0${value}`, "latin1")),
    chunk("IEND")
  ]);
}

test("P6 package privacy audit scans Review ZIP and App ZIP entry names, text, binary strings, and PNG metadata", async () => {
  await withTempDir(async (root) => {
    const reviewZipPath = await writeZip(root, "P6-abcdef0-review-upload.zip", {
      "REVIEW_PACKET.md": "# Review\nNo private paths.\n",
      "FINAL_RESPONSE.txt": "[Review](REVIEW_PACKET.md)\n",
      "bundle-privacy-audit.json": "{}\n",
      "reports/result.json": "{\"status\":\"human_required\"}\n"
    });
    const appZipPath = await writeZip(root, "Auto-SVGA-macOS-internal-abcdef0.zip", {
      "Auto SVGA.app/Contents/Info.plist": "<plist><dict></dict></plist>\n",
      "Auto SVGA.app/Contents/Resources/clean.png": pngWithText("Comment", "clean metadata only"),
      "Auto SVGA.app/Contents/Frameworks/Electron Framework.framework/Electron Framework": Buffer.concat([
        Buffer.from([0]),
        Buffer.from("AUTO_SVGA_BINARY_MARKER_WITH_SAFE_TEXT"),
        Buffer.from([0])
      ])
    });

    const audit = buildZipPrivacyAudit({ reviewZipPath, appZipPath });

    assert.equal(audit.passed, true);
    assert.equal(audit.findings.length, 0);
    assert.equal(audit.zipAudits.length, 2);
    assert.ok(audit.actualZipEntryCount >= 7);
    assert.equal(audit.actualZipEntryCount, audit.zipAudits.reduce((total, zipAudit) => total + zipAudit.actualZipEntryCount, 0));
    assert.equal(audit.scannedEntryCount, audit.actualZipEntryCount);
    assert.ok(audit.scannedTextEntryCount >= 3);
    assert.ok(audit.scannedBinaryEntryCount >= 2);
    assert.deepEqual(audit.selfReferentialExclusions, [
      {
        zipRole: "review",
        entry: "bundle-privacy-audit.json",
        reason: "self-referential audit content is regenerated after ZIP assembly"
      }
    ]);
  });
});

test("P6 package privacy audit rejects forbidden ZIP metadata and local path content", async () => {
  await withTempDir(async (root) => {
    const localPath = ["", "Users", "private-user", "Desktop", "asset.svga"].join("/");
    const reviewZipPath = await writeZip(root, "P6-abcdef0-review-upload.zip", {
      "REVIEW_PACKET.md": `leaked ${localPath}\n`,
      ".DS_Store": "metadata"
    });
    const appZipPath = await writeZip(root, "Auto-SVGA-macOS-internal-abcdef0.zip", {
      "__MACOSX/._Auto SVGA": "metadata",
      "Auto SVGA.app/Contents/MacOS/Auto SVGA": Buffer.from(`binary marker ${localPath}`)
    });

    const audit = buildZipPrivacyAudit({ reviewZipPath, appZipPath });
    const ruleIds = new Set(audit.findings.map((finding) => finding.ruleId));

    assert.equal(audit.passed, false);
    assert.equal(ruleIds.has("FORBIDDEN_ZIP_METADATA"), true);
    assert.equal(ruleIds.has("MACOS_USERS_PATH"), true);
    assert.ok(audit.findings.some((finding) => finding.entry.includes(".DS_Store")));
    assert.ok(audit.findings.some((finding) => finding.entry.includes("__MACOSX")));
  });
});

test("P6 owner handoff builder records App ZIP manifest hash and entry counts", async () => {
  const source = await readFile(new URL("./p6/build-p6-owner-handoff.mjs", import.meta.url), "utf8");

  assert.match(source, /macosAppZip:\s*\{/);
  assert.match(source, /sha256:\s*appZipIdentity\.sha256/);
  assert.match(source, /entryCount:\s*appZipEntries\.length/);
  assert.match(source, /actualZipEntryCount/);
  assert.match(source, /scannedEntryCount/);
  assert.match(source, /scannedTextEntryCount/);
  assert.match(source, /scannedBinaryEntryCount/);
  assert.match(source, /selfReferentialExclusions/);
  assert.match(source, /buildPrivacyAudit\(\{ stagingRoot: uploadStagingRoot, appZipPath, reviewZipPath \}\)/);
});
