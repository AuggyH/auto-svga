import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const scriptPath = path.join(scriptDir, "run-aeb-ae26-isolated-panel-install.zsh");
const legacyName = "local.auto-svga.aeb.panel.dev";
const targetName = "local.auto-svga.aeb.panel.ae26.dev";
const stagingName = ".local.auto-svga.aeb.panel.ae26.dev.staging";
const backupName = ".local.auto-svga.aeb.panel.ae26.dev.rollback";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function treeDigest(root) {
  const files = [
    "README.md",
    "CSXS/manifest.xml",
    "index.html",
    "js/aeb-panel.js",
    "jsx/aeb-export-to-auto-svga.jsx"
  ];
  const values = [];
  for (const relativePath of files) {
    values.push(`${relativePath} ${sha256(await readFile(path.join(root, relativePath)))}`);
  }
  return sha256(values.sort().join("\n"));
}

async function createMirror(name) {
  const root = await mkdtemp(`/private/tmp/aeb-ae26-isolated-install-${name}-`);
  const sourceRoot = path.join(root, "source", "plugin-panel-dev");
  const isolatedSourceRoot = path.join(root, "source", "plugin-panel-ae26-isolated");
  const overlayManifest = path.join(root, "source", "manifest.xml");
  const targetParent = path.join(root, "cep-parent");
  const legacyPath = path.join(targetParent, legacyName);
  const targetPath = path.join(targetParent, targetName);
  const stagingPath = path.join(targetParent, stagingName);
  const backupPath = path.join(targetParent, backupName);
  const evidenceRoot = path.join(root, "evidence");

  await cp(path.join(repoRoot, "tools", "aeb", "plugin-panel-dev"), sourceRoot, { recursive: true });
  await mkdir(isolatedSourceRoot, { recursive: true });
  await cp(
    path.join(repoRoot, "tools", "aeb", "plugin-panel-ae26-isolated", "index.html"),
    path.join(isolatedSourceRoot, "index.html")
  );
  await cp(
    path.join(repoRoot, "tools", "aeb", "plugin-panel-ae26-isolated", "CSXS", "manifest.xml"),
    overlayManifest
  );
  await mkdir(targetParent, { recursive: true });
  await cp(sourceRoot, legacyPath, { recursive: true });

  return {
    root,
    sourceRoot,
    overlayManifest,
    targetParent,
    legacyPath,
    targetPath,
    stagingPath,
    backupPath,
    evidenceRoot,
    receiptPath: path.join(evidenceRoot, "reports", "isolated-panel-install-report.json")
  };
}

async function createStaleIsolatedTarget(mirror) {
  await cp(mirror.sourceRoot, mirror.targetPath, { recursive: true });
  await cp(mirror.overlayManifest, path.join(mirror.targetPath, "CSXS", "manifest.xml"));
  await cp(
    path.join(repoRoot, "tools", "aeb", "plugin-panel-ae26-isolated", "index.html"),
    path.join(mirror.targetPath, "index.html")
  );
  await writeFile(
    path.join(mirror.targetPath, "jsx", "aeb-export-to-auto-svga.jsx"),
    "stale isolated panel jsx\n"
  );
}

async function createCurrentIsolatedTarget(mirror) {
  await cp(mirror.sourceRoot, mirror.targetPath, { recursive: true });
  await cp(mirror.overlayManifest, path.join(mirror.targetPath, "CSXS", "manifest.xml"));
  await cp(
    path.join(repoRoot, "tools", "aeb", "plugin-panel-ae26-isolated", "index.html"),
    path.join(mirror.targetPath, "index.html")
  );
}

function argsFor(mirror, extras = []) {
  return [
    scriptPath,
    "--permit-id", "TEST-AEB-AE26-INSTALL",
    "--source-identity", "test-source",
    "--source-root", mirror.sourceRoot,
    "--overlay-manifest", mirror.overlayManifest,
    "--target-parent", mirror.targetParent,
    "--evidence-root", mirror.evidenceRoot,
    "--staging-path", mirror.stagingPath,
    "--test-mode",
    "--test-process-state", "owner-ae25-only",
    ...extras
  ];
}

async function runExpectFailure(args) {
  try {
    await execFileAsync("/bin/zsh", args, { env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin" } });
  } catch (error) {
    return error;
  }
  assert.fail("expected isolated installer to fail closed");
}

test("rejects source or AE 26.3 process drift before install writes", async () => {
  const sourceMirror = await createMirror("source-reject");
  try {
    await writeFile(path.join(sourceMirror.sourceRoot, "README.md"), "forged\n", { flag: "a" });
    const legacyBefore = await treeDigest(sourceMirror.legacyPath);
    const error = await runExpectFailure(argsFor(sourceMirror));
    assert.match(error.stderr, /AEB_AE26_INSTALL_FAIL\|hash_mismatch/);
    assert.equal(await treeDigest(sourceMirror.legacyPath), legacyBefore);
    assert.equal(existsSync(sourceMirror.targetPath), false);
    assert.equal(existsSync(sourceMirror.stagingPath), false);
    assert.equal(existsSync(sourceMirror.evidenceRoot), false);
  } finally {
    await rm(sourceMirror.root, { recursive: true, force: true });
  }

  const processMirror = await createMirror("process-reject");
  try {
    const args = argsFor(processMirror);
    args[args.indexOf("owner-ae25-only")] = "ae26-match";
    const legacyBefore = await treeDigest(processMirror.legacyPath);
    const error = await runExpectFailure(args);
    assert.match(error.stderr, /AEB_AE26_INSTALL_FAIL\|ae26_process_match_injected/);
    assert.equal(await treeDigest(processMirror.legacyPath), legacyBefore);
    assert.equal(existsSync(processMirror.targetPath), false);
    assert.equal(existsSync(processMirror.stagingPath), false);
    assert.equal(existsSync(processMirror.evidenceRoot), false);
  } finally {
    await rm(processMirror.root, { recursive: true, force: true });
  }
});

test("installs the AE 26.3 sibling while preserving the legacy panel byte-for-byte", async () => {
  const mirror = await createMirror("success");
  try {
    const legacyBefore = await treeDigest(mirror.legacyPath);
    const result = await execFileAsync("/bin/zsh", argsFor(mirror), {
      env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin" }
    });
    const receipt = JSON.parse(await readFile(mirror.receiptPath, "utf8"));
    const manifest = await readFile(path.join(mirror.targetPath, "CSXS", "manifest.xml"), "utf8");

    assert.match(result.stdout, /AEB_AE26_ISOLATED_INSTALL_SUCCESS/);
    assert.equal(await treeDigest(mirror.legacyPath), legacyBefore);
    assert.equal(existsSync(mirror.targetPath), true);
    assert.equal(existsSync(mirror.stagingPath), false);
    assert.match(manifest, /Version="\[26\.0,26\.99\]"/);
    assert.equal(receipt.status, "pass");
    assert.equal(receipt.isolatedPanel.installed, true);
    assert.equal(receipt.boundaries.legacyPanelMutationExecuted, false);
    assert.equal(receipt.boundaries.aeLaunched, false);
  } finally {
    await rm(mirror.root, { recursive: true, force: true });
  }
});

test("preserves the exact installed panel directory identity when every source byte already matches", async () => {
  const mirror = await createMirror("matching-target");
  try {
    await createCurrentIsolatedTarget(mirror);
    const before = await stat(mirror.targetPath);
    const legacyBefore = await treeDigest(mirror.legacyPath);
    const result = await execFileAsync("/bin/zsh", argsFor(mirror), {
      env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin" }
    });
    const after = await stat(mirror.targetPath);
    const receipt = JSON.parse(await readFile(mirror.receiptPath, "utf8"));

    assert.match(result.stdout, /AEB_AE26_ISOLATED_INSTALL_SUCCESS/);
    assert.equal(after.dev, before.dev);
    assert.equal(after.ino, before.ino);
    assert.equal(await treeDigest(mirror.legacyPath), legacyBefore);
    assert.equal(receipt.isolatedPanel.previousTargetPresent, true);
    assert.equal(receipt.isolatedPanel.replacementPerformed, false);
    assert.equal(receipt.isolatedPanel.targetIdentityPreserved, true);
    assert.equal(receipt.isolatedPanel.installAction, "preserved_matching_target");
  } finally {
    await rm(mirror.root, { recursive: true, force: true });
  }
});

test("atomically replaces an existing isolated target and removes the rollback tree", async () => {
  const mirror = await createMirror("replace-success");
  try {
    await createStaleIsolatedTarget(mirror);
    const staleDigest = await treeDigest(mirror.targetPath);
    const legacyBefore = await treeDigest(mirror.legacyPath);
    const result = await execFileAsync("/bin/zsh", argsFor(mirror), {
      env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin" }
    });
    const receipt = JSON.parse(await readFile(mirror.receiptPath, "utf8"));

    assert.match(result.stdout, /AEB_AE26_ISOLATED_INSTALL_SUCCESS/);
    assert.notEqual(await treeDigest(mirror.targetPath), staleDigest);
    assert.equal(await treeDigest(mirror.legacyPath), legacyBefore);
    assert.equal(existsSync(mirror.backupPath), false);
    assert.equal(existsSync(mirror.stagingPath), false);
    assert.equal(receipt.isolatedPanel.previousTargetPresent, true);
    assert.equal(receipt.isolatedPanel.replacementPerformed, true);
    assert.equal(receipt.isolatedPanel.targetIdentityPreserved, false);
    assert.equal(receipt.isolatedPanel.installAction, "replaced_target");
  } finally {
    await rm(mirror.root, { recursive: true, force: true });
  }
});

test("restores an existing isolated target byte-for-byte after a post-install failure", async () => {
  const mirror = await createMirror("replace-rollback");
  try {
    await createStaleIsolatedTarget(mirror);
    const staleDigest = await treeDigest(mirror.targetPath);
    const legacyBefore = await treeDigest(mirror.legacyPath);
    const error = await runExpectFailure(argsFor(mirror, ["--test-fail-phase", "after-install"]));

    assert.match(error.stderr, /AEB_AE26_INSTALL_FAIL\|injected_failure_after_install/);
    assert.match(error.stderr, /AEB_AE26_INSTALL_ROLLBACK\|isolated_target_restored=yes/);
    assert.equal(await treeDigest(mirror.targetPath), staleDigest);
    assert.equal(await treeDigest(mirror.legacyPath), legacyBefore);
    assert.equal(existsSync(mirror.backupPath), false);
    assert.equal(existsSync(mirror.stagingPath), false);
    assert.equal(existsSync(mirror.evidenceRoot), false);
  } finally {
    await rm(mirror.root, { recursive: true, force: true });
  }
});

test("rejects an unsafe existing isolated target before staging or backup writes", async () => {
  const mirror = await createMirror("replace-unsafe");
  try {
    await createStaleIsolatedTarget(mirror);
    await chmod(mirror.targetPath, 0o777);
    const staleDigest = await treeDigest(mirror.targetPath);
    const legacyBefore = await treeDigest(mirror.legacyPath);
    const error = await runExpectFailure(argsFor(mirror));

    assert.match(error.stderr, /AEB_AE26_INSTALL_FAIL\|existing_target_mode_invalid/);
    assert.equal(await treeDigest(mirror.targetPath), staleDigest);
    assert.equal(await treeDigest(mirror.legacyPath), legacyBefore);
    assert.equal(existsSync(mirror.backupPath), false);
    assert.equal(existsSync(mirror.stagingPath), false);
    assert.equal(existsSync(mirror.evidenceRoot), false);
  } finally {
    await rm(mirror.root, { recursive: true, force: true });
  }
});

test("removes only the new isolated target after a post-install failure", async () => {
  const mirror = await createMirror("rollback");
  try {
    const legacyBefore = await treeDigest(mirror.legacyPath);
    const error = await runExpectFailure(argsFor(mirror, ["--test-fail-phase", "after-install"]));
    assert.match(error.stderr, /AEB_AE26_INSTALL_FAIL\|injected_failure_after_install/);
    assert.match(
      error.stderr,
      /AEB_AE26_INSTALL_ROLLBACK\|isolated_target_restored=not_applicable\|isolated_target_absent=yes/
    );
    assert.equal(await treeDigest(mirror.legacyPath), legacyBefore);
    assert.equal(existsSync(mirror.targetPath), false);
    assert.equal(existsSync(mirror.stagingPath), false);
    assert.equal(existsSync(mirror.evidenceRoot), false);
  } finally {
    await rm(mirror.root, { recursive: true, force: true });
  }
});
