import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const canonicalFixtureFileName = "canonical-fixture.svga";
export const invalidFixtureFileName = "invalid-fixture.svga";

export async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

export async function ensureCanonicalFixture({ repoRoot, artifactRoot, headCommit }) {
  await mkdir(artifactRoot, { recursive: true });
  const candidates = [
    {
      label: "repository-avatar-frame-basic.svga",
      path: path.join(repoRoot, "examples/avatar_frame_basic/output/avatar_frame_basic.svga"),
      selectionReason: "same approved repository-owned fixture bytes as Web baseline"
    }
  ];
  const failures = [];
  for (const candidate of candidates) {
    if (!existsSync(candidate.path)) {
      failures.push({ label: candidate.label, path: candidate.path, reason: "missing" });
      continue;
    }
    const bytes = await readFile(candidate.path);
    if (bytes.byteLength <= 0) {
      failures.push({ label: candidate.label, path: candidate.path, reason: "empty" });
      continue;
    }
    const artifactPath = path.join(artifactRoot, canonicalFixtureFileName);
    await writeFile(artifactPath, bytes);
    const size = await stat(artifactPath);
    const manifest = {
      schemaVersion: 1,
      milestoneId: "P2",
      headCommit,
      label: candidate.label,
      sourcePath: path.relative(repoRoot, candidate.path),
      artifactPath: path.relative(repoRoot, artifactPath),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      sizeBytes: size.size,
      selectionReason: candidate.selectionReason,
      approvedSyntheticOrRepositoryFixture: true,
      failedCandidates: failures,
      generatedAt: new Date().toISOString()
    };
    await writeFile(path.join(artifactRoot, "canonical-fixture.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  }
  throw new Error(`No approved P2 canonical fixture available: ${JSON.stringify(failures)}`);
}

export async function ensureInvalidFixture({ repoRoot, artifactRoot, headCommit }) {
  await mkdir(artifactRoot, { recursive: true });
  const bytes = new Uint8Array([1, 2, 3]);
  const artifactPath = path.join(artifactRoot, invalidFixtureFileName);
  await writeFile(artifactPath, bytes);
  const manifest = {
    schemaVersion: 1,
    milestoneId: "P2",
    headCommit,
    label: "broken.svga",
    sourcePath: "generated-invalid-fixture:broken.svga",
    artifactPath: path.relative(repoRoot, artifactPath),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sizeBytes: bytes.byteLength,
    approvedSyntheticOrRepositoryFixture: true,
    expectedInvalid: true,
    expectedErrorClass: "invalid_svga_bytes",
    generatedAt: new Date().toISOString()
  };
  await writeFile(path.join(artifactRoot, "invalid-fixture.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export async function readInvalidFixture({ repoRoot, artifactRoot }) {
  const manifest = JSON.parse(await readFile(path.join(artifactRoot, "invalid-fixture.json"), "utf8"));
  const artifactPath = path.resolve(repoRoot, manifest.artifactPath);
  const actualHash = await sha256File(artifactPath);
  if (actualHash !== manifest.sha256) {
    throw new Error("Invalid fixture bytes changed after manifest generation.");
  }
  return {
    ...manifest,
    absoluteArtifactPath: artifactPath
  };
}

export async function readCanonicalFixture({ repoRoot, artifactRoot }) {
  const manifest = JSON.parse(await readFile(path.join(artifactRoot, "canonical-fixture.json"), "utf8"));
  const artifactPath = path.resolve(repoRoot, manifest.artifactPath);
  const actualHash = await sha256File(artifactPath);
  if (actualHash !== manifest.sha256) {
    throw new Error("Canonical fixture bytes changed after manifest generation.");
  }
  return {
    ...manifest,
    absoluteArtifactPath: artifactPath
  };
}

export function fixtureFields(fixture) {
  if (!fixture) {
    return {
      fixtureLabel: null,
      fixtureSha256: null,
      fixtureSizeBytes: null,
      fixtureSourcePath: null,
      fixtureArtifactPath: null
    };
  }
  return {
    fixtureLabel: fixture.label,
    fixtureSha256: fixture.sha256,
    fixtureSizeBytes: fixture.sizeBytes,
    fixtureSourcePath: fixture.sourcePath,
    fixtureArtifactPath: fixture.artifactPath
  };
}
