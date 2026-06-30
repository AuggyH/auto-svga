import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  buildBundlePrivacyAudit,
  extractDesktopSmokeResultFromText,
  inspectZipEntries,
  sanitizeReviewText,
  validateManifestPayloadHashes
} from "./complete-review-package.mjs";

test("complete review ZIP inspection rejects Finder metadata, duplicates, and path traversal", () => {
  const inspection = inspectZipEntries([
    "MANIFEST.json",
    "app/Auto SVGA.app/Contents/Info.plist",
    "app/Auto SVGA.app/Contents/Info.plist",
    "__MACOSX/app/._Info.plist",
    "app/.DS_Store",
    "../escape.txt"
  ]);
  assert.equal(inspection.passed, false);
  assert.deepEqual(inspection.duplicateEntries, ["app/Auto SVGA.app/Contents/Info.plist"]);
  assert.ok(inspection.forbiddenMetadataEntries.includes("__MACOSX/app/._Info.plist"));
  assert.ok(inspection.forbiddenMetadataEntries.includes("app/.DS_Store"));
  assert.ok(inspection.pathTraversalEntries.includes("../escape.txt"));
});

test("manifest verification covers every payload except MANIFEST.json", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "svga-workbench-manifest-"));
  try {
    await writeFile(path.join(root, "README.md"), "hello\n");
    await writeFile(path.join(root, "MANIFEST.json"), "{}\n");
    const manifest = {
      entries: [
        {
          path: "README.md",
          sizeBytes: 6,
          sha256: "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"
        }
      ]
    };
    assert.deepEqual(await validateManifestPayloadHashes({ root, manifest }), { passed: true, errors: [] });
    const bad = await validateManifestPayloadHashes({ root, manifest: { entries: [] } });
    assert.equal(bad.passed, false);
    assert.ok(bad.errors.includes("manifest missing README.md"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("privacy audit rejects local absolute paths in outward-facing payloads", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "svga-workbench-privacy-"));
  try {
    await writeFile(path.join(root, "README.md"), "local path /Users/example/Documents/Auto_SVGA/file.txt\n");
    const audit = await buildBundlePrivacyAudit(root, {
      expectedHeadShort: "abc1234",
      appZipName: "Auto-SVGA-macOS-internal-abc1234.zip"
    });
    assert.equal(audit.passed, false);
    assert.ok(audit.findings.some((finding) => finding.ruleId === "MACOS_USERS_PATH"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("UI audit text sanitizer removes repo-local paths before packaging", async () => {
  const text = `See /Users/${os.userInfo().username}/Documents/Auto_SVGA/.artifacts/ui-audit/file.png`;
  const sanitized = sanitizeReviewText(text);
  assert.doesNotMatch(sanitized, /\/Users\//);
  assert.doesNotMatch(sanitized, new RegExp(os.userInfo().username));
  assert.match(sanitized, /<redacted-local-path>/);
});

test("desktop smoke result extraction is fail-closed", () => {
  const result = extractDesktopSmokeResultFromText([
    "unrelated log",
    "AUTO_SVGA_WEB_EXPERIMENT_SMOKE {\"passed\":true,\"replacementResetProof\":{\"passed\":true}}"
  ].join("\n"));
  assert.equal(result.passed, true);
  assert.equal(result.replacementResetProof.passed, true);
  assert.throws(() => extractDesktopSmokeResultFromText("desktop smoke finished without payload"), /desktop smoke result line missing/);
});

test("review packet template keeps complete handoff sections", async () => {
  const source = await readFile(new URL("./complete-review-package.mjs", import.meta.url), "utf8");
  for (const requiredSection of [
    "## Feature Completion Matrix",
    "## Changes Since a4681d7",
    "## Self-Contained Evidence",
    "## Validation Summary",
    "## App ZIP / Signing / Installer Status",
    "## Changed Files Summary",
    "## Security / Privacy Summary",
    "## Knowledge And Docs Updated",
    "## Blockers Requiring Product Owner Or External Credentials",
    "## Nonblocking Backlog",
    "## Known Risks",
    "## Required Human Decision",
    "Recommended next human decision",
    "UPLOAD_CHANGELOG_SINCE_A4681D7.md",
    "temporary Product Owner addition",
    "Product Owner acceptance and production release are not claimed",
    "asset-intelligence-report.json",
    "optimization-report.json",
    "replacement-editing-report.json",
    "replacement-reset-proof.json",
    "sequence-repair-status-report.json",
    "packaged-app-runtime-proof.json",
    "packaged normal runtime proof"
  ]) {
    assert.match(source, new RegExp(requiredSection.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
