import { createHash, randomBytes } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import {
  lstat,
  link,
  mkdir,
  open,
  readdir,
  realpath,
  rm,
  unlink,
  type FileHandle
} from "node:fs/promises";
import path from "node:path";
import { decode } from "fast-png";
import {
  AEB_RETAINED_AE_BUDGETS,
  AebRetainedAeDiscriminatorError,
  type AebRetainedAeFileBinding,
  canonicalJson
} from "./contracts.js";

const RUN_SUBDIRECTORIES = ["control", "checkpoint", "output", "result"] as const;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_TASK_FILE_BYTES = 16 * 1024 * 1024;

export interface AebRetainedAeAuthorityHooks {
  afterFileOpen?(relativePath: string): Promise<void> | void;
  afterFileRead?(relativePath: string): Promise<void> | void;
}

interface PinnedDirectory {
  canonicalPath: string;
  handle: FileHandle;
  initial: BigIntStats;
  sealed: BigIntStats;
  requireStableTimes: boolean;
}

export interface AebRetainedAeCheckpointSeal {
  checkpoint: AebRetainedAeFileBinding;
  publication: AebRetainedAeFileBinding;
  directoryIdentityDigest: string;
}

export interface AebRetainedAeVerifiedFrame {
  binding: AebRetainedAeFileBinding;
  width: number;
  height: number;
  decodedRgbaBytes: number;
  alpha: "transparent" | "mixed" | "opaque";
}

export interface AebRetainedAeRunRootBinding {
  canonicalPath: string;
  device: string;
  inode: string;
}

export async function createAebRetainedAeRunRoot(
  approvedBase: string,
  runDirectoryName: string
): Promise<AebRetainedAeRunRootBinding> {
  const canonicalBase = await requireMode0700Directory(approvedBase, "TASK_BASE_INVALID");
  if (!/^run-[a-f0-9]{64}$/.test(runDirectoryName)) {
    fail("RUN_ROOT_NAME_INVALID", "The retained AE run-root name is invalid.");
  }
  const runRoot = path.join(canonicalBase, runDirectoryName);
  let createdRoot = false;
  try {
    await mkdir(runRoot, { mode: 0o700 });
    createdRoot = true;
    for (const child of RUN_SUBDIRECTORIES) {
      await mkdir(path.join(runRoot, child), { mode: 0o700 });
    }
  } catch {
    if (createdRoot) {
      try {
        await rm(runRoot, { recursive: true, force: true });
      } catch {
        fail("RUN_ROOT_CREATE_ROLLBACK_FAILED", "The retained AE run-root creation rollback failed.");
      }
    }
    fail("RUN_ROOT_CREATE_FAILED", "The retained AE run root could not be created exclusively.");
  }
  await requireMode0700Directory(runRoot, "RUN_ROOT_INVALID");
  const metadata = await safeDirectoryLstat(runRoot, "RUN_ROOT_INVALID");
  return {
    canonicalPath: runRoot,
    device: metadata.dev.toString(),
    inode: metadata.ino.toString()
  };
}

export async function removeAebRetainedAeRunRoot(
  approvedBase: string,
  runDirectoryName: string,
  expected: AebRetainedAeRunRootBinding
): Promise<void> {
  const canonicalBase = await requireMode0700Directory(approvedBase, "TASK_BASE_INVALID");
  if (!/^run-[a-f0-9]{64}$/.test(runDirectoryName)) {
    fail("RUN_ROOT_NAME_INVALID", "The retained AE run-root name is invalid.");
  }
  const target = path.join(canonicalBase, runDirectoryName);
  const canonicalTarget = await safeRealpath(target, "RUN_ROOT_INVALID");
  const current = await safeDirectoryLstat(target, "RUN_ROOT_INVALID");
  if (canonicalTarget !== target || path.dirname(target) !== canonicalBase) {
    fail("RUN_ROOT_AUTHORITY_INVALID", "The retained AE run root is not the approved direct child.");
  }
  if (expected.canonicalPath !== target
    || expected.device !== current.dev.toString()
    || expected.inode !== current.ino.toString()) {
    fail("RUN_ROOT_CLEANUP_IDENTITY_MISMATCH", "The retained AE run root changed before cleanup.");
  }
  await rm(target, { recursive: true, force: false });
}

export class NodeAebRetainedAeRunAuthority {
  private constructor(
    private readonly base: PinnedDirectory,
    private readonly root: PinnedDirectory,
    private readonly children: ReadonlyMap<string, PinnedDirectory>,
    private readonly hooks: AebRetainedAeAuthorityHooks
  ) {}

  static async open(
    approvedBase: string,
    runDirectoryName: string,
    hooks: AebRetainedAeAuthorityHooks = {}
  ): Promise<NodeAebRetainedAeRunAuthority> {
    const canonicalBase = await requireMode0700Directory(approvedBase, "TASK_BASE_INVALID");
    if (!/^run-[a-f0-9]{64}$/.test(runDirectoryName)) {
      fail("RUN_ROOT_NAME_INVALID", "The retained AE run-root name is invalid.");
    }
    const rootPath = path.join(canonicalBase, runDirectoryName);
    if (await safeRealpath(rootPath, "RUN_ROOT_INVALID") !== rootPath) {
      fail("RUN_ROOT_AUTHORITY_INVALID", "The retained AE run root is not canonical.");
    }
    const opened: PinnedDirectory[] = [];
    try {
      const base = await pinDirectory(canonicalBase, true, "TASK_BASE_INVALID");
      opened.push(base);
      const root = await pinDirectory(rootPath, true, "RUN_ROOT_INVALID");
      opened.push(root);
      const children = new Map<string, PinnedDirectory>();
      for (const child of RUN_SUBDIRECTORIES) {
        const pinned = await pinDirectory(path.join(rootPath, child), false, "RUN_ROOT_INVALID");
        opened.push(pinned);
        children.set(child, pinned);
      }
      const authority = new NodeAebRetainedAeRunAuthority(base, root, children, hooks);
      await authority.verifyRoots();
      return authority;
    } catch (error) {
      await Promise.allSettled(opened.map((directory) => directory.handle.close()));
      throw error;
    }
  }

  get canonicalRoot(): string {
    return this.root.canonicalPath;
  }

  async close(): Promise<void> {
    const results = await Promise.allSettled([
      ...[...this.children.values()].map((child) => child.handle.close()),
      this.root.handle.close(),
      this.base.handle.close()
    ]);
    if (results.some((result) => result.status === "rejected")) {
      fail("RUN_ROOT_CLOSE_FAILED", "The retained AE run-root authority did not close cleanly.");
    }
  }

  async verifyRoots(): Promise<void> {
    await verifyPinnedDirectory(this.base, "TASK_BASE_CHANGED");
    await verifyPinnedDirectory(this.root, "RUN_ROOT_CHANGED");
    if (path.dirname(this.root.canonicalPath) !== this.base.canonicalPath) {
      fail("RUN_ROOT_AUTHORITY_INVALID", "The retained AE run root is not a direct child.");
    }
    for (const child of this.children.values()) {
      await verifyPinnedDirectory(child, "RUN_ROOT_CHANGED");
      if (path.dirname(child.canonicalPath) !== this.root.canonicalPath) {
        fail("RUN_ROOT_AUTHORITY_INVALID", "A retained AE run directory escaped its root.");
      }
    }
  }

  async writeExclusiveJson(relativePath: string, value: unknown, maxBytes: number): Promise<AebRetainedAeFileBinding> {
    const normalized = validateRelativePath(relativePath);
    const bytes = Buffer.from(canonicalJson(value));
    validateBound(maxBytes);
    if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) {
      fail("TASK_FILE_WRITE_LIMIT_EXCEEDED", "The retained AE task file exceeds its write limit.");
    }
    await this.verifyRoots();
    const target = this.resolveTaskPath(normalized);
    const temporary = `${target}.partial-${process.pid}-${randomBytes(8).toString("hex")}`;
    let handle: FileHandle | undefined;
    let published = false;
    try {
      handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close();
      handle = undefined;
      await link(temporary, target);
      published = true;
      await unlink(temporary);
    } catch {
      await unlink(temporary).catch(() => undefined);
      if (published) await unlink(target).catch(() => undefined);
      fail("TASK_FILE_PUBLICATION_FAILED", "The retained AE task file could not be published exclusively.");
    } finally {
      await handle?.close();
    }
    return (await this.readBoundedFile(normalized, maxBytes)).binding;
  }

  async readBoundedJson<T>(relativePath: string, maxBytes: number): Promise<{ value: T; binding: AebRetainedAeFileBinding }> {
    const read = await this.readBoundedFile(relativePath, maxBytes);
    let value: T;
    try {
      value = JSON.parse(read.bytes.toString("utf8")) as T;
    } catch {
      fail("TASK_JSON_MALFORMED", "The retained AE task JSON is malformed.");
    }
    return { value, binding: read.binding };
  }

  async readBoundedFile(
    relativePath: string,
    maxBytes: number
  ): Promise<{ bytes: Buffer; binding: AebRetainedAeFileBinding }> {
    validateBound(maxBytes);
    const normalized = validateRelativePath(relativePath);
    await this.verifyRoots();
    const filePath = this.resolveTaskPath(normalized);
    const pathBefore = await safeFileLstat(filePath, "TASK_FILE_MISSING");
    assertOwnedSingleLinkFile(pathBefore, "TASK_FILE_INVALID");
    await assertCanonicalFile(filePath, this.root.canonicalPath, "TASK_FILE_ALIAS_FORBIDDEN");
    if (pathBefore.size <= 0n || pathBefore.size > BigInt(maxBytes)) {
      fail("TASK_FILE_READ_LIMIT_EXCEEDED", "The retained AE task file exceeds its read limit.");
    }
    let handle: FileHandle | undefined;
    try {
      handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      const openedBefore = await handle.stat({ bigint: true });
      assertOwnedSingleLinkFile(openedBefore, "TASK_FILE_INVALID");
      assertSameIdentity(pathBefore, openedBefore, "TASK_FILE_CHANGED_DURING_READ");
      await this.hooks.afterFileOpen?.(normalized);
      const bytes = await readCapPlusOne(handle, maxBytes);
      await this.hooks.afterFileRead?.(normalized);
      if (bytes.byteLength > maxBytes) {
        fail("TASK_FILE_READ_LIMIT_EXCEEDED", "The retained AE task file grew beyond its read limit.");
      }
      const openedAfter = await handle.stat({ bigint: true });
      const pathAfter = await safeFileLstat(filePath, "TASK_FILE_MISSING");
      assertOwnedSingleLinkFile(openedAfter, "TASK_FILE_INVALID");
      assertOwnedSingleLinkFile(pathAfter, "TASK_FILE_INVALID");
      assertStableFile(openedBefore, openedAfter, "TASK_FILE_CHANGED_DURING_READ");
      assertStableFile(openedAfter, pathAfter, "TASK_FILE_PATH_SWAP_DETECTED");
      await assertCanonicalFile(filePath, this.root.canonicalPath, "TASK_FILE_ALIAS_FORBIDDEN");
      await this.verifyRoots();
      return { bytes, binding: createFileBinding(normalized, bytes, openedAfter) };
    } catch (error) {
      if (error instanceof AebRetainedAeDiscriminatorError) throw error;
      fail("TASK_FILE_READ_FAILED", "The retained AE task file could not be safely read.");
    } finally {
      await handle?.close();
    }
    fail("TASK_FILE_READ_FAILED", "The retained AE task file could not be safely read.");
  }

  async captureCheckpointSeal(): Promise<AebRetainedAeCheckpointSeal> {
    const checkpoint = await this.readBoundedFile(
      "checkpoint/checkpoint.aep",
      AEB_RETAINED_AE_BUDGETS.maxCheckpointBytes
    );
    const publication = await this.readBoundedFile(
      "checkpoint/publication.json",
      AEB_RETAINED_AE_BUDGETS.maxExchangeBytes
    );
    const directory = this.requireChild("checkpoint");
    directory.sealed = await directory.handle.stat({ bigint: true });
    directory.initial = directory.sealed;
    directory.requireStableTimes = true;
    return {
      checkpoint: checkpoint.binding,
      publication: publication.binding,
      directoryIdentityDigest: directoryDigest(directory.sealed)
    };
  }

  async verifyCheckpointSeal(seal: AebRetainedAeCheckpointSeal): Promise<void> {
    await this.verifyRoots();
    const directory = this.requireChild("checkpoint");
    const descriptor = await directory.handle.stat({ bigint: true });
    const current = await safeDirectoryLstat(directory.canonicalPath, "CHECKPOINT_DIRECTORY_CHANGED");
    if (directoryDigest(descriptor) !== seal.directoryIdentityDigest
      || directoryDigest(current) !== seal.directoryIdentityDigest) {
      fail("CHECKPOINT_DIRECTORY_CHANGED", "The retained AE checkpoint directory changed after approval.");
    }
    const checkpoint = await this.readBoundedFile(
      seal.checkpoint.relativePath,
      AEB_RETAINED_AE_BUDGETS.maxCheckpointBytes
    );
    const publication = await this.readBoundedFile(
      seal.publication.relativePath,
      AEB_RETAINED_AE_BUDGETS.maxExchangeBytes
    );
    if (!sameBinding(checkpoint.binding, seal.checkpoint)
      || !sameBinding(publication.binding, seal.publication)) {
      fail("CHECKPOINT_CHANGED", "The retained AE checkpoint changed after approval.");
    }
  }

  async verifyRgbaFrame(relativePath: string): Promise<AebRetainedAeVerifiedFrame> {
    const read = await this.readBoundedFile(relativePath, AEB_RETAINED_AE_BUDGETS.maxEncodedFrameBytes);
    preflightRgbaPng(read.bytes);
    let decoded;
    try {
      decoded = decode(read.bytes, { checkCrc: true });
    } catch {
      fail("OUTPUT_PNG_INVALID", "The retained AE output is not a CRC-checked PNG.");
    }
    if (decoded.width !== 4 || decoded.height !== 4 || decoded.channels !== 4 || decoded.depth !== 8) {
      fail("OUTPUT_RGBA_MISMATCH", "The retained AE output is not the expected 4x4 RGBA frame.");
    }
    let transparent = 0;
    let opaque = 0;
    for (let offset = 3; offset < decoded.data.length; offset += 4) {
      const alpha = Number(decoded.data[offset]);
      if (alpha === 0) transparent += 1;
      if (alpha === 255) opaque += 1;
    }
    const alpha = transparent === 16 ? "transparent" : opaque === 16 ? "opaque" : "mixed";
    if (alpha !== "mixed") {
      fail("OUTPUT_ALPHA_INVALID", "The retained AE discriminator frame must contain mixed transparency.");
    }
    return {
      binding: read.binding,
      width: decoded.width,
      height: decoded.height,
      decodedRgbaBytes: decoded.width * decoded.height * 4,
      alpha
    };
  }

  async listFiles(): Promise<string[]> {
    const files: string[] = [];
    const visit = async (directory: string, prefix: string): Promise<void> => {
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) fail("TASK_RESIDUE_ALIAS_FORBIDDEN", "Task residue contains an alias.");
        if (entry.isDirectory()) await visit(path.join(directory, entry.name), relative);
        else if (entry.isFile()) files.push(relative);
        else fail("TASK_RESIDUE_TYPE_FORBIDDEN", "Task residue contains an unsupported file type.");
      }
    };
    await visit(this.root.canonicalPath, "");
    return files;
  }

  private resolveTaskPath(relativePath: string): string {
    const resolved = path.resolve(this.root.canonicalPath, ...relativePath.split("/"));
    if (!resolved.startsWith(`${this.root.canonicalPath}${path.sep}`)) {
      fail("TASK_FILE_PATH_INVALID", "The retained AE task path escaped its root.");
    }
    return resolved;
  }

  private requireChild(name: string): PinnedDirectory {
    const child = this.children.get(name);
    if (!child) fail("RUN_ROOT_INVALID", "The retained AE run directory is incomplete.");
    return child;
  }
}

async function requireMode0700Directory(directoryPath: string, code: string): Promise<string> {
  const requested = path.resolve(directoryPath);
  const metadata = await safeDirectoryLstat(requested, code);
  const canonical = await safeRealpath(requested, code);
  const expectedUid = typeof process.getuid === "function" ? BigInt(process.getuid()) : metadata.uid;
  if (metadata.isSymbolicLink()
    || !metadata.isDirectory()
    || canonical !== requested
    || (metadata.mode & 0o777n) !== 0o700n
    || metadata.uid !== expectedUid) {
    fail(code, "The retained AE authority directory must be canonical, owned, and mode 0700.");
  }
  return canonical;
}

async function pinDirectory(
  canonicalPath: string,
  requireStableTimes: boolean,
  code: string
): Promise<PinnedDirectory> {
  let handle: FileHandle | undefined;
  try {
    await requireMode0700Directory(canonicalPath, code);
    handle = await open(canonicalPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const initial = await handle.stat({ bigint: true });
    return { canonicalPath, handle, initial, sealed: initial, requireStableTimes };
  } catch (error) {
    await handle?.close();
    if (error instanceof AebRetainedAeDiscriminatorError) throw error;
    fail(code, "The retained AE authority directory could not be pinned.");
  }
}

async function verifyPinnedDirectory(directory: PinnedDirectory, code: string): Promise<void> {
  const descriptor = await directory.handle.stat({ bigint: true });
  const current = await safeDirectoryLstat(directory.canonicalPath, code);
  assertSameIdentity(directory.initial, descriptor, code);
  assertSameIdentity(descriptor, current, code);
  if (!current.isDirectory()
    || current.isSymbolicLink()
    || await safeRealpath(directory.canonicalPath, code) !== directory.canonicalPath
    || (current.mode & 0o777n) !== 0o700n) {
    fail(code, "The retained AE authority directory changed or became an alias.");
  }
  if (directory.requireStableTimes
    && (directory.initial.ctimeNs !== descriptor.ctimeNs || directory.initial.ctimeNs !== current.ctimeNs)) {
    fail(code, "The retained AE authority directory was renamed or replaced.");
  }
}

async function readCapPlusOne(handle: FileHandle, cap: number): Promise<Buffer> {
  const buffer = Buffer.alloc(cap + 1);
  let offset = 0;
  while (offset < buffer.byteLength) {
    const { bytesRead } = await handle.read(buffer, offset, buffer.byteLength - offset, null);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return buffer.subarray(0, offset);
}

function preflightRgbaPng(bytes: Buffer): void {
  if (bytes.byteLength < 33
    || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)
    || bytes.readUInt32BE(8) !== 13
    || bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    fail("OUTPUT_PNG_HEADER_INVALID", "The retained AE output PNG header is invalid.");
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== 4
    || height !== 4
    || bytes.readUInt8(24) !== 8
    || bytes.readUInt8(25) !== 6
    || bytes.readUInt8(26) !== 0
    || bytes.readUInt8(27) !== 0
    || bytes.readUInt8(28) !== 0
    || width * height * 4 > AEB_RETAINED_AE_BUDGETS.maxDecodedRgbaBytes) {
    fail("OUTPUT_RGBA_MISMATCH", "The retained AE output PNG preflight failed.");
  }
}

function createFileBinding(relativePath: string, bytes: Buffer, metadata: BigIntStats): AebRetainedAeFileBinding {
  return {
    relativePath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteCount: bytes.byteLength,
    device: String(metadata.dev),
    inode: String(metadata.ino),
    linkCount: 1,
    identityDigest: fileDigest(metadata)
  };
}

function validateRelativePath(value: string): string {
  if (typeof value !== "string"
    || value === ""
    || value.includes("\\")
    || path.posix.isAbsolute(value)
    || path.posix.normalize(value) !== value
    || value === ".."
    || value.startsWith("../")) {
    fail("TASK_FILE_PATH_INVALID", "The retained AE task path must be normalized and relative.");
  }
  return value;
}

function validateBound(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_TASK_FILE_BYTES) {
    fail("TASK_FILE_LIMIT_INVALID", "The retained AE task-file bound is invalid.");
  }
}

function assertOwnedSingleLinkFile(metadata: BigIntStats, code: string): void {
  const expectedUid = typeof process.getuid === "function" ? BigInt(process.getuid()) : metadata.uid;
  if (!metadata.isFile()
    || metadata.isSymbolicLink()
    || metadata.nlink !== 1n
    || metadata.uid !== expectedUid) {
    fail(code, "The retained AE task file must be an owned single-link regular file.");
  }
}

function assertSameIdentity(left: BigIntStats, right: BigIntStats, code: string): void {
  if (left.dev !== right.dev || left.ino !== right.ino) {
    fail(code, "The retained AE filesystem identity changed.");
  }
}

function assertStableFile(left: BigIntStats, right: BigIntStats, code: string): void {
  if (left.dev !== right.dev
    || left.ino !== right.ino
    || left.size !== right.size
    || left.mtimeNs !== right.mtimeNs
    || left.ctimeNs !== right.ctimeNs
    || left.nlink !== right.nlink) {
    fail(code, "The retained AE task file changed during validation.");
  }
}

async function assertCanonicalFile(filePath: string, root: string, code: string): Promise<void> {
  const canonical = await safeRealpath(filePath, code);
  const relative = path.relative(root, canonical);
  if (canonical !== filePath
    || relative === ""
    || relative === ".."
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)) {
    fail(code, "The retained AE task file is an alias or escaped its root.");
  }
}

async function safeDirectoryLstat(target: string, code: string): Promise<BigIntStats> {
  try {
    return await lstat(target, { bigint: true });
  } catch {
    fail(code, "The retained AE authority directory is unavailable.");
  }
}

async function safeFileLstat(target: string, code: string): Promise<BigIntStats> {
  try {
    return await lstat(target, { bigint: true });
  } catch {
    fail(code, "The retained AE task file is unavailable.");
  }
}

async function safeRealpath(target: string, code: string): Promise<string> {
  try {
    return await realpath(target);
  } catch {
    fail(code, "The retained AE path cannot be resolved.");
  }
}

function fileDigest(metadata: BigIntStats): string {
  return createHash("sha256")
    .update(`${metadata.dev}:${metadata.ino}:${metadata.size}:${metadata.mtimeNs}:${metadata.ctimeNs}:${metadata.nlink}`)
    .digest("hex");
}

function directoryDigest(metadata: BigIntStats): string {
  return createHash("sha256")
    .update(`${metadata.dev}:${metadata.ino}:${metadata.mode}:${metadata.uid}:${metadata.mtimeNs}:${metadata.ctimeNs}`)
    .digest("hex");
}

function sameBinding(left: AebRetainedAeFileBinding, right: AebRetainedAeFileBinding): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function fail(code: string, message: string): never {
  throw new AebRetainedAeDiscriminatorError(code, message);
}
