import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  buildZipPrivacyAudit,
  collectP6ParityNonPass,
  validateOwnerVisibleHandoffBinding,
  validateFinalPackagingGate,
  validateManifestPayloadHashes,
  validateWorkerRegistryFinal,
  validateZipEntriesIndexed
} from "./p6/build-p6-owner-handoff.mjs";

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

  assert.match(source, /const milestoneId = "P6-R1"/);
  assert.match(source, /review\/P6-R1-\$\{headShort\}/);
  assert.match(source, /P6-R1-\$\{headShort\}-review-upload\.zip/);
  assert.match(source, /sidecarName/);
  assert.match(source, /assertFinalPackagingGate\(\{ headCommit, canonicalManifest \}\)/);
  assert.match(source, /finalPackagingGate/);
  assert.match(source, /macosAppZip:\s*\{/);
  assert.match(source, /sha256:\s*appZipIdentity\.sha256/);
  assert.match(source, /entryCount:\s*appZipEntries\.length/);
  assert.match(source, /productionApproved:\s*false/);
  assert.match(source, /workerRegistryFinal/);
  assert.match(source, /worker-registry-final\.json/);
  assert.match(source, /writeUploadArtifactIndex/);
  assert.match(source, /includedInPacket:\s*true/);
  assert.match(source, /validateManifestPayloadHashes/);
  assert.match(source, /validateZipEntriesIndexed/);
  assert.match(source, /mandatoryCompanions:\s*\[appZipName, sidecarName\]/);
  assert.match(source, /actualZipEntryCount/);
  assert.match(source, /scannedEntryCount/);
  assert.match(source, /scannedTextEntryCount/);
  assert.match(source, /scannedBinaryEntryCount/);
  assert.match(source, /selfReferentialExclusions/);
  assert.match(source, /buildPrivacyAudit\(\{ stagingRoot: uploadStagingRoot, appZipPath, reviewZipPath, expectedHeadShort: headShort \}\)/);
});

test("P6 final packaging gate blocks stale packet or parity report heads", () => {
  const headCommit = "a".repeat(40);
  const parityReport = {
    source: { headCommit: "b".repeat(40) },
    sections: {}
  };
  const gate = validateFinalPackagingGate({
    headCommit,
    canonicalManifest: { reviewedHeadCommit: headCommit },
    parityReport
  });

  assert.equal(gate.passed, false);
  assert.equal(gate.errors.some((error) => error.includes("P6 parity report head")), true);
});

test("WP5 final packaging gate blocks stale App proof and package manifests", () => {
  const headCommit = "a".repeat(40);
  const staleHead = "b".repeat(40);
  const gate = validateFinalPackagingGate({
    headCommit,
    canonicalManifest: { reviewedHeadCommit: headCommit },
    parityReport: { source: { headCommit }, sections: {} },
    appProof: {
      normalVisibleStartup: {
        headCommit: staleHead,
        runtimeIdentity: { headCommit: staleHead }
      }
    },
    internalTrialManifest: { buildCommit: staleHead },
    macosPackageProof: { buildCommit: staleHead }
  });

  assert.equal(gate.passed, false);
  assert.equal(gate.errors.some((error) => error.includes("normal App proof")), true);
  assert.equal(gate.errors.some((error) => error.includes("internal trial manifest")), true);
  assert.equal(gate.errors.some((error) => error.includes("macOS package proof")), true);
});

test("P6 final packaging gate records non-passing parity evidence without judging parity", () => {
  const report = {
    source: { headCommit: "a".repeat(40) },
    sections: {
      visual: {
        status: "partial",
        evidence: [{ id: "screenshot", status: "pass" }],
        items: [
          { id: "motion", status: "fail", failures: ["drift"] },
          { id: "optional-note", status: "not_run", required: false, failures: ["ignored"] }
        ]
      },
      archive: {
        status: "pass",
        evidence: [{ id: "zip", status: "pass" }],
        items: []
      }
    }
  };
  const nonPass = collectP6ParityNonPass(report);
  const gate = validateFinalPackagingGate({
    headCommit: "a".repeat(40),
    canonicalManifest: { reviewedHeadCommit: "a".repeat(40) },
    parityReport: report
  });

  assert.deepEqual(nonPass, ["visual:partial", "visual.motion:fail:drift"]);
  assert.equal(gate.passed, true);
  assert.equal(gate.parityJudgment, "not_evaluated_by_A5");
  assert.deepEqual(gate.errors, []);
});

test("WP5 owner-visible manifest requires same-head review and App material binding", () => {
  const headCommit = "a".repeat(40);
  const result = validateOwnerVisibleHandoffBinding({
    headCommit,
    reviewZipName: "P6-R1-aaaaaaa-review-upload.zip",
    appZipName: "Auto-SVGA-macOS-internal-aaaaaaa.zip",
    sidecarName: "P6-R1-owner-upload-sidecar-aaaaaaa.json",
    manifest: {
      milestoneId: "P6-R1",
      reviewedHeadCommit: "b".repeat(40),
      companionRequired: true,
      mandatoryCompanions: ["Auto-SVGA-macOS-internal-aaaaaaa.zip"],
      ownerReviewZip: {
        fileName: "P6-stale-review-upload.zip",
        sha256: "c".repeat(64)
      },
      macosAppZip: {
        fileName: "Auto-SVGA-macOS-internal-aaaaaaa.zip",
        sha256: "d".repeat(64)
      },
      privacyAudit: { passed: true, findingCount: 0 },
      entries: [
        { path: "REVIEW_PACKET.md", sha256: "e".repeat(64) }
      ]
    }
  });

  assert.equal(result.passed, false);
  assert.equal(result.errors.some((error) => error.includes("reviewed head")), true);
  assert.equal(result.errors.some((error) => error.includes("owner review ZIP")), true);
  assert.equal(result.errors.some((error) => error.includes("App ZIP entry")), true);
  assert.equal(result.errors.some((error) => error.includes("sidecar")), true);
});

test("P6 final packaging gate passes only when packet and parity are bound to a clean passing head", () => {
  const headCommit = "a".repeat(40);
  const gate = validateFinalPackagingGate({
    headCommit,
    canonicalManifest: { reviewedHeadCommit: headCommit },
    parityReport: {
      source: { headCommit },
      sections: {
        visual: {
          status: "pass",
          evidence: [{ id: "screenshot", status: "pass" }],
          items: [{ id: "motion", status: "pass", failures: [] }]
        }
      }
    }
  });

  assert.equal(gate.passed, true);
  assert.equal(gate.parityJudgment, "not_evaluated_by_A5");
  assert.deepEqual(gate.errors, []);
});

test("P6-R1 owner-visible manifest accepts Review ZIP, App ZIP, and sidecar companions only when all are indexed", () => {
  const headCommit = "a".repeat(40);
  const reviewZipName = "P6-R1-aaaaaaa-review-upload.zip";
  const appZipName = "Auto-SVGA-macOS-internal-aaaaaaa.zip";
  const sidecarName = "P6-R1-owner-upload-sidecar-aaaaaaa.json";
  const result = validateOwnerVisibleHandoffBinding({
    headCommit,
    reviewZipName,
    appZipName,
    sidecarName,
    manifest: {
      milestoneId: "P6-R1",
      reviewedHeadCommit: headCommit,
      companionRequired: true,
      mandatoryCompanions: [appZipName, sidecarName],
      ownerReviewZip: {
        fileName: reviewZipName,
        sizeBytes: 101,
        sha256: "b".repeat(64)
      },
      macosAppZip: {
        fileName: appZipName,
        sizeBytes: 202,
        sha256: "c".repeat(64)
      },
      ownerUploadSidecar: {
        fileName: sidecarName,
        sizeBytes: 303,
        sha256: "d".repeat(64)
      },
      privacyAudit: { passed: true, findingCount: 0 },
      humanReviewRequiredCount: 8,
      entries: [
        { path: reviewZipName, sizeBytes: 101, sha256: "b".repeat(64), humanReviewRequired: true },
        { path: appZipName, sizeBytes: 202, sha256: "c".repeat(64), humanReviewRequired: true },
        { path: sidecarName, sizeBytes: 303, sha256: "d".repeat(64), humanReviewRequired: true },
        { path: "REVIEW_PACKET.md", sizeBytes: 1, sha256: "e".repeat(64), humanReviewRequired: true },
        { path: "FINAL_RESPONSE.txt", sizeBytes: 1, sha256: "f".repeat(64), humanReviewRequired: true },
        { path: "bundle-privacy-audit.json", sizeBytes: 1, sha256: "1".repeat(64), humanReviewRequired: true },
        { path: "worker-registry-final.json", sizeBytes: 1, sha256: "2".repeat(64), humanReviewRequired: true },
        { path: "owner-upload-post-seal-verification.json", sizeBytes: 1, sha256: "3".repeat(64), humanReviewRequired: true }
      ]
    }
  });

  assert.equal(result.passed, true, result.errors.join("; "));
});

test("P6-R1 owner-visible handoff rejects contradictory packet and incomplete upload post-seal binding", () => {
  const headCommit = "a".repeat(40);
  const reviewZipName = "P6-R1-aaaaaaa-review-upload.zip";
  const appZipName = "Auto-SVGA-macOS-internal-aaaaaaa.zip";
  const sidecarName = "P6-R1-owner-upload-sidecar-aaaaaaa.json";
  const manifest = {
    milestoneId: "P6-R1",
    reviewedHeadCommit: headCommit,
    companionRequired: true,
    mandatoryCompanions: [appZipName, sidecarName],
    ownerReviewZip: { fileName: reviewZipName, sha256: "b".repeat(64) },
    macosAppZip: { fileName: appZipName, sha256: "c".repeat(64) },
    ownerUploadSidecar: { fileName: sidecarName, sha256: "d".repeat(64) },
    privacyAudit: { passed: true, findingCount: 0 },
    humanReviewRequiredCount: 8,
    entries: [
      { path: reviewZipName, sha256: "b".repeat(64), humanReviewRequired: true },
      { path: appZipName, sha256: "c".repeat(64), humanReviewRequired: true },
      { path: sidecarName, sha256: "d".repeat(64), humanReviewRequired: true },
      { path: "REVIEW_PACKET.md", sha256: "e".repeat(64), humanReviewRequired: true },
      { path: "FINAL_RESPONSE.txt", sha256: "f".repeat(64), humanReviewRequired: true },
      { path: "bundle-privacy-audit.json", sha256: "1".repeat(64), humanReviewRequired: true },
      { path: "worker-registry-final.json", sha256: "2".repeat(64), humanReviewRequired: true },
      { path: "owner-upload-post-seal-verification.json", sha256: "3".repeat(64), humanReviewRequired: true }
    ]
  };
  const result = validateOwnerVisibleHandoffBinding({
    headCommit,
    reviewZipName,
    appZipName,
    sidecarName,
    manifest,
    reviewPacketText: [
      "companionRequired: false",
      "mandatoryCompanions: []",
      "- fullP6Regression: `failed`",
      "- productOwnerHumanGateReachable: `false`"
    ].join("\n"),
    finalResponseText: `[Review ZIP](${reviewZipName})\n[App ZIP](${appZipName})\n`,
    sidecar: {
      companionRequired: true,
      mandatoryCompanions: [appZipName, sidecarName],
      ownerReviewZip: { fileName: reviewZipName },
      macosAppZip: { fileName: appZipName }
    },
    postSealVerification: {
      reviewedHeadCommit: headCommit,
      passed: true,
      reviewZip: { fileName: reviewZipName, sizeBytes: 1, sha256: "b".repeat(64) },
      macosAppZip: { fileName: appZipName, sizeBytes: 1, sha256: "c".repeat(64) }
    }
  });

  assert.equal(result.passed, false);
  assert.equal(result.errors.some((error) => error.includes("companionRequired false")), true);
  assert.equal(result.errors.some((error) => error.includes("empty mandatoryCompanions")), true);
  assert.equal(result.errors.some((error) => error.includes("fullP6Regression")), true);
  assert.equal(result.errors.some((error) => error.includes("Product Owner Human Gate")), true);
  assert.equal(result.errors.some((error) => error.includes("FINAL_RESPONSE.txt missing upload artifact")), true);
  assert.equal(result.errors.some((error) => error.includes("owner post-seal sidecar fileName mismatch")), true);
});

test("P6-R1 owner-visible handoff rejects App ZIP identity mismatch across manifest sidecar and post-seal", () => {
  const headCommit = "a".repeat(40);
  const reviewZipName = "P6-R1-aaaaaaa-review-upload.zip";
  const appZipName = "Auto-SVGA-macOS-internal-aaaaaaa.zip";
  const sidecarName = "P6-R1-owner-upload-sidecar-aaaaaaa.json";
  const manifest = {
    milestoneId: "P6-R1",
    reviewedHeadCommit: headCommit,
    companionRequired: true,
    mandatoryCompanions: [appZipName, sidecarName],
    ownerReviewZip: { fileName: reviewZipName, sizeBytes: 101, sha256: "b".repeat(64) },
    macosAppZip: { fileName: appZipName, sizeBytes: 202, sha256: "c".repeat(64) },
    ownerUploadSidecar: { fileName: sidecarName, sizeBytes: 303, sha256: "d".repeat(64) },
    privacyAudit: { passed: true, findingCount: 0 },
    humanReviewRequiredCount: 8,
    entries: [
      { path: reviewZipName, sizeBytes: 101, sha256: "b".repeat(64), humanReviewRequired: true },
      { path: appZipName, sizeBytes: 202, sha256: "c".repeat(64), humanReviewRequired: true },
      { path: sidecarName, sizeBytes: 303, sha256: "d".repeat(64), humanReviewRequired: true },
      { path: "REVIEW_PACKET.md", sizeBytes: 1, sha256: "e".repeat(64), humanReviewRequired: true },
      { path: "FINAL_RESPONSE.txt", sizeBytes: 1, sha256: "f".repeat(64), humanReviewRequired: true },
      { path: "bundle-privacy-audit.json", sizeBytes: 1, sha256: "1".repeat(64), humanReviewRequired: true },
      { path: "worker-registry-final.json", sizeBytes: 1, sha256: "2".repeat(64), humanReviewRequired: true },
      { path: "owner-upload-post-seal-verification.json", sizeBytes: 1, sha256: "3".repeat(64), humanReviewRequired: true }
    ]
  };
  const result = validateOwnerVisibleHandoffBinding({
    headCommit,
    reviewZipName,
    appZipName,
    sidecarName,
    manifest,
    reviewPacketText: `Owner Upload Set:\n- ${reviewZipName}\n- ${appZipName}\n- ${sidecarName}\ncompanionRequired: true\n`,
    finalResponseText: `[Review](${reviewZipName})\n[App](${appZipName})\n[Sidecar](${sidecarName})\n`,
    sidecar: {
      reviewedHeadCommit: headCommit,
      companionRequired: true,
      mandatoryCompanions: [appZipName, sidecarName],
      ownerReviewZip: { fileName: reviewZipName, sizeBytes: 101, sha256: "b".repeat(64) },
      macosAppZip: { fileName: appZipName, sizeBytes: 202, sha256: "9".repeat(64) },
      privacyAudit: { passed: true, findingCount: 0 }
    },
    postSealVerification: {
      reviewedHeadCommit: headCommit,
      passed: true,
      reviewZip: { fileName: reviewZipName, sizeBytes: 101, sha256: "b".repeat(64) },
      macosAppZip: { fileName: appZipName, sizeBytes: 202, sha256: "8".repeat(64) },
      ownerUploadSidecar: { fileName: sidecarName, sizeBytes: 303, sha256: "d".repeat(64) },
      assertions: {
        noMacosxMetadata: true,
        sameFinalHead: true
      }
    }
  });

  assert.equal(result.passed, false);
  assert.equal(result.errors.some((error) => error.includes("owner sidecar App ZIP sha256 mismatch")), true);
  assert.equal(result.errors.some((error) => error.includes("owner post-seal App ZIP sha256 mismatch")), true);
});

test("P6 package privacy audit rejects stale review root references", async () => {
  await withTempDir(async (root) => {
    const staleLegacyReviewRoot = ["review", "P6-deadbee", "REVIEW_PACKET.md"].join("/");
    const staleP6R1ReviewRoot = ["review", "P6-R1-deadbee", "REVIEW_PACKET.md"].join("/");
    const reviewZipPath = await writeZip(root, "P6-abcdef0-review-upload.zip", {
      "FINAL_RESPONSE.txt": `[Old](${staleLegacyReviewRoot})\n[Wrong head](${staleP6R1ReviewRoot})\n`
    });
    const appZipPath = await writeZip(root, "Auto-SVGA-macOS-internal-abcdef0.zip", {
      "Auto SVGA.app/Contents/Info.plist": "<plist><dict></dict></plist>\n"
    });

    const audit = buildZipPrivacyAudit({ reviewZipPath, appZipPath, expectedHeadShort: "abcdef0" });

    assert.equal(audit.passed, false);
    assert.equal(audit.findings.filter((finding) => finding.ruleId === "STALE_REVIEW_ROOT_REFERENCE").length, 2);
  });
});

test("P6 package privacy audit allows source-template review roots inside REVIEW_PACKET patch text", async () => {
  await withTempDir(async (root) => {
    const reviewZipPath = await writeZip(root, "P6-R1-abcdef0-review-upload.zip", {
      "REVIEW_PACKET.md": [
        "```diff",
        "+    `- review/P6-R1-${headShort}/`,",
        "+  const visibleRoot = path.join(repoRoot, `review/P6-R1-${headShort}`);",
        "+    const staleP6R1ReviewRoot = [\"review\", \"P6-R1-deadbee\", \"REVIEW_PACKET.md\"].join(\"/\");",
        "+      \"FINAL_RESPONSE.txt\": \"[Current](review/P6-R1-abcdef0/REVIEW_PACKET.md)\\n\"",
        "```",
        ""
      ].join("\n"),
      "FINAL_RESPONSE.txt": "[Current](review/P6-R1-abcdef0/REVIEW_PACKET.md)\n"
    });
    const appZipPath = await writeZip(root, "Auto-SVGA-macOS-internal-abcdef0.zip", {
      "Auto SVGA.app/Contents/Info.plist": "<plist><dict></dict></plist>\n"
    });

    const audit = buildZipPrivacyAudit({ reviewZipPath, appZipPath, expectedHeadShort: "abcdef0" });

    assert.equal(audit.passed, true, JSON.stringify(audit.findings));
  });
});

test("P6 package privacy audit allows owner-handoff privacy test fixtures inside changes.patch", async () => {
  await withTempDir(async (root) => {
    const reviewZipPath = await writeZip(root, "P6-R1-abcdef0-review-upload.zip", {
      "changes.patch": [
        "diff --git a/tools/p6-owner-handoff-package.test.mjs b/tools/p6-owner-handoff-package.test.mjs",
        "--- a/tools/p6-owner-handoff-package.test.mjs",
        "+++ b/tools/p6-owner-handoff-package.test.mjs",
        "@@",
        "+    const staleLegacyReviewRoot = [\"review\", \"P6-deadbee\", \"REVIEW_PACKET.md\"].join(\"/\");",
        "+    const staleP6R1ReviewRoot = [\"review\", \"P6-R1-deadbee\", \"REVIEW_PACKET.md\"].join(\"/\");",
        "+      \"FINAL_RESPONSE.txt\": \"[Current](review/P6-R1-abcdef0/REVIEW_PACKET.md)\\n\"",
        ""
      ].join("\n"),
      "FINAL_RESPONSE.txt": "[Current](review/P6-R1-abcdef0/REVIEW_PACKET.md)\n"
    });
    const appZipPath = await writeZip(root, "Auto-SVGA-macOS-internal-abcdef0.zip", {
      "Auto SVGA.app/Contents/Info.plist": "<plist><dict></dict></plist>\n"
    });

    const audit = buildZipPrivacyAudit({ reviewZipPath, appZipPath, expectedHeadShort: "abcdef0" });

    assert.equal(audit.passed, true, JSON.stringify(audit.findings));
  });
});

test("P6 package privacy audit still rejects stale review roots in non-test patch files", async () => {
  await withTempDir(async (root) => {
    const reviewZipPath = await writeZip(root, "P6-R1-abcdef0-review-upload.zip", {
      "changes.patch": [
        "diff --git a/docs/example.md b/docs/example.md",
        "--- a/docs/example.md",
        "+++ b/docs/example.md",
        "@@",
        "+See review/P6-R1-deadbee/REVIEW_PACKET.md",
        ""
      ].join("\n"),
      "FINAL_RESPONSE.txt": "[Current](review/P6-R1-abcdef0/REVIEW_PACKET.md)\n"
    });
    const appZipPath = await writeZip(root, "Auto-SVGA-macOS-internal-abcdef0.zip", {
      "Auto SVGA.app/Contents/Info.plist": "<plist><dict></dict></plist>\n"
    });

    const audit = buildZipPrivacyAudit({ reviewZipPath, appZipPath, expectedHeadShort: "abcdef0" });

    assert.equal(audit.passed, false);
    assert.equal(audit.findings.some((finding) => finding.ruleId === "STALE_REVIEW_ROOT_REFERENCE"), true);
  });
});

test("P6 final worker registry artifact requires generated final-head binding", () => {
  const trackedRegistrySha256 = "b".repeat(64);
  const trackedRegistry = {
    schemaVersion: 3,
    currentRepairRound: 6,
    finalHeadBinding: {
      source: "ignored_generated_artifact",
      path: ".artifacts/product/P6/worker-registry-final.json",
      trackedRegistryDoesNotClaimFinalHead: true,
      actualFinalHeadCommitMustEqualGitHead: true
    }
  };

  const result = validateWorkerRegistryFinal({
    headCommit: "a".repeat(40),
    trackedRegistrySha256,
    trackedRegistry
  });

  assert.equal(result.passed, true);
  assert.equal(result.trackedRegistrySha256, trackedRegistrySha256);
  assert.equal(result.generatedRegistryPath, ".artifacts/product/P6/worker-registry-final.json");
});

test("P6 final worker registry artifact rejects tracked final head claims", () => {
  const result = validateWorkerRegistryFinal({
    headCommit: "a".repeat(40),
    trackedRegistrySha256: "b".repeat(64),
    trackedRegistry: {
      finalHeadBinding: {
        source: "ignored_generated_artifact",
        path: ".artifacts/product/P6/worker-registry-final.json",
        trackedRegistryDoesNotClaimFinalHead: true,
        actualFinalHeadCommitMustEqualGitHead: true
      },
      terminalHandoffReady: true
    }
  });

  assert.equal(result.passed, false);
  assert.equal(result.errors.some((error) => error.includes("terminalHandoffReady")), true);
});

test("P6 owner Review ZIP index check rejects unindexed entries", () => {
  const result = validateZipEntriesIndexed({
    entries: ["FINAL_RESPONSE.txt", "MANIFEST.json", "extra.txt"],
    manifestEntries: [{ path: "FINAL_RESPONSE.txt" }]
  });

  assert.equal(result.passed, false);
  assert.deepEqual(result.unindexedEntries, ["extra.txt"]);
  assert.deepEqual(result.missingIndexedEntries, []);
});

test("P6-R1 manifest payload hash check rejects stale file hashes", async () => {
  await withTempDir(async (root) => {
    await writeFile(join(root, "REVIEW_PACKET.md"), "current packet\n");
    const result = await validateManifestPayloadHashes({
      root,
      manifest: {
        entries: [{
          path: "REVIEW_PACKET.md",
          sizeBytes: 1,
          sha256: "0".repeat(64)
        }]
      }
    });

    assert.equal(result.passed, false);
    assert.equal(result.errors.some((error) => error.includes("size mismatch")), true);
    assert.equal(result.errors.some((error) => error.includes("sha256 mismatch")), true);
  });
});
