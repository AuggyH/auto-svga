import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { snapshotBoundedPackageTree } from "./run-aeb-0.3-native-preview-product-proof.mjs";
import {
  prepareAePackageHandoff,
  snapshotAePackageTree
} from "./aeb-ae-package-handoff.cjs";

test("AE package handoff copies an immutable package tree from AE dev root into fresh D001 package root", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-handoff-positive-"));
  try {
    const roots = await createHandoffRoots(root);
    const sourcePackageRoot = await writeSourcePackage(roots);
    const sourceBefore = snapshotAePackageTree(sourcePackageRoot, { sourceRoot: roots.devRoot });
    const proofTree = snapshotBoundedPackageTree(sourcePackageRoot);
    const finalizedBytes = await readFile(path.join(sourcePackageRoot, "ae-export-package.finalized.json"));
    assert.equal(proofTree.sha256, sourceBefore.sha256);
    assert.deepEqual(proofTree.entries, sourceBefore.entries.map(({ relative, sizeBytes, sha256 }) => ({ relative, sizeBytes, sha256 })));
    const result = prepareAePackageHandoff({
      sourcePackageRoot,
      targetPackageRoot: roots.targetPackageRoot,
      expectedPackageSha256: sha256(finalizedBytes),
      expectedTreeSha256: sourceBefore.sha256,
      expectedFileCount: sourceBefore.fileCount,
      expectedTotalBytes: sourceBefore.totalBytes,
      devRoot: roots.devRoot,
      taskRoot: roots.taskRoot
    });

    const targetTree = snapshotAePackageTree(roots.targetPackageRoot, { sourceRoot: roots.taskRoot });
    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
    assert.equal(result.packageSha256, sha256(finalizedBytes));
    assert.equal(result.sourceBeforeSha256, sourceBefore.sha256);
    assert.equal(result.sourceAfterSha256, sourceBefore.sha256);
    assert.equal(result.targetSha256, sourceBefore.sha256);
    assert.equal(targetTree.sha256, sourceBefore.sha256);
    assert.equal(manifest.schema, "auto-svga-aeb-ae-package-handoff-v1");
    assert.equal(manifest.sourceImmutable, true);
    assert.equal(manifest.targetExactCopy, true);
    assert.deepEqual(manifest.tree, {
      sha256: sourceBefore.sha256,
      fileCount: sourceBefore.fileCount,
      totalBytes: sourceBefore.totalBytes
    });
    assert.doesNotMatch(JSON.stringify(manifest), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("AE package handoff rejects old root, stale target, symlink, hardlink, and tree identity drift", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-handoff-reject-"));
  try {
    const roots = await createHandoffRoots(root);
    const sourcePackageRoot = await writeSourcePackage(roots);
    const sourceBefore = snapshotAePackageTree(sourcePackageRoot, { sourceRoot: roots.devRoot });
    const finalizedBytes = await readFile(path.join(sourcePackageRoot, "ae-export-package.finalized.json"));
    const baseInput = {
      sourcePackageRoot,
      targetPackageRoot: roots.targetPackageRoot,
      expectedPackageSha256: sha256(finalizedBytes),
      expectedTreeSha256: sourceBefore.sha256,
      expectedFileCount: sourceBefore.fileCount,
      expectedTotalBytes: sourceBefore.totalBytes,
      devRoot: roots.devRoot,
      taskRoot: roots.taskRoot
    };

    assert.throws(() => prepareAePackageHandoff({
      ...baseInput,
      sourcePackageRoot: path.join(root, "old-root", "ae-export-package")
    }), { code: "aeb.package_handoff_source_out_of_root" });

    await symlink(sourcePackageRoot, roots.targetPackageRoot);
    assert.throws(() => prepareAePackageHandoff(baseInput), { code: "aeb.package_handoff_target_stale" });
    await rm(roots.targetPackageRoot, { force: true });

    await symlink("../ae-export-package.finalized.json", path.join(sourcePackageRoot, "assets", "alias.json"));
    assert.throws(() => snapshotAePackageTree(sourcePackageRoot, { sourceRoot: roots.devRoot }), {
      code: "aeb.package_handoff_source_symlink"
    });
    await rm(path.join(sourcePackageRoot, "assets", "alias.json"), { force: true });

    await link(
      path.join(sourcePackageRoot, "ae-export-package.finalized.json"),
      path.join(sourcePackageRoot, "assets", "hardlink.json")
    );
    assert.throws(() => snapshotAePackageTree(sourcePackageRoot, { sourceRoot: roots.devRoot }), {
      code: "aeb.package_handoff_source_link"
    });
    await rm(path.join(sourcePackageRoot, "assets", "hardlink.json"), { force: true });

    assert.throws(() => prepareAePackageHandoff({
      ...baseInput,
      afterSourceSnapshot() {
        writeFileSync(path.join(sourcePackageRoot, "extra.json"), "{}\n");
      }
    }), { code: "aeb.package_handoff_source_mutated" });
    await rm(path.join(sourcePackageRoot, "extra.json"), { force: true });

    assert.throws(() => prepareAePackageHandoff({
      ...baseInput,
      afterSourceSnapshot() {
        const replacement = path.join(roots.devRoot, "replacement", "ae-export-package");
        mkdirSync(path.dirname(replacement), { recursive: true, mode: 0o700 });
        cpSync(sourcePackageRoot, replacement, { recursive: true });
        rmSync(sourcePackageRoot, { recursive: true, force: true });
        renameSync(replacement, sourcePackageRoot);
      }
    }), { code: "aeb.package_handoff_source_identity_changed" });
    await rm(sourcePackageRoot, { recursive: true, force: true });
    await writeSourcePackage(roots);

    assert.throws(() => prepareAePackageHandoff({
      ...baseInput,
      afterSourceSnapshot() {
        const swapped = `${roots.taskRoot}-swapped`;
        renameSync(roots.taskRoot, swapped);
        mkdirSync(roots.taskRoot, { recursive: true, mode: 0o700 });
      }
    }), { code: "aeb.package_handoff_task_root_changed" });
    await rm(roots.taskRoot, { recursive: true, force: true });
    renameSync(`${roots.taskRoot}-swapped`, roots.taskRoot);

    assert.throws(() => prepareAePackageHandoff({
      ...baseInput,
      afterTargetEntryWrite({ index }) {
        if (index === 2) throw new Error("injected target write failure");
      }
    }), /injected target write failure/u);
    assert.equal(existsSync(roots.targetPackageRoot), false);
    assert.equal(existsSync(`${roots.targetPackageRoot}.handoff-manifest.json`), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function createHandoffRoots(root) {
  const devRoot = path.join(root, "auto-svga-aeb-dev");
  const taskRoot = path.join(root, "auto-svga-aeb-d001-8594bcfa");
  const targetPackageRoot = path.join(taskRoot, "product-package-test-001");
  await mkdir(devRoot, { recursive: true, mode: 0o700 });
  await mkdir(taskRoot, { recursive: true, mode: 0o700 });
  return { devRoot, taskRoot, targetPackageRoot };
}

async function writeSourcePackage({ devRoot }) {
  const sourcePackageRoot = path.join(devRoot, "request-001", "ae-export-package");
  await mkdir(path.join(sourcePackageRoot, "assets"), { recursive: true });
  await writeFile(path.join(sourcePackageRoot, "ae-export-package.finalized.json"), `${JSON.stringify({
    schemaVersion: "aeb-wp2-script-output-v0",
    aeExportPackage: { packageIdentity: { packageId: "task-owned-fixture" } }
  }, null, 2)}\n`);
  await writeFile(path.join(sourcePackageRoot, "assets", "layer-0001.png"), Buffer.from("fixture-png-bytes"));
  return sourcePackageRoot;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
