import { createHash } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import { lstat, open, realpath, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { decode } from "fast-png";
import type {
  AebBakeFrameSource,
  AebBakeReadResource,
  AebBakeResourceReader,
  AebBakeTaskReceipt
} from "../workbench/aeb-bake-contracts.js";
import { AebBakePipelineError } from "../workbench/aeb-bake-pipeline.js";

const receiptFileName = ".aeb-bake-task.json";
const maxReceiptBytes = 32 * 1024;
const maxBoundedTaskFileBytes = 128 * 1024 * 1024;
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface AebTaskRootAuthorityHooks {
  afterFileOpen?(relativePath: string): Promise<void> | void;
  afterFileRead?(relativePath: string): Promise<void> | void;
}

export interface NodeAebTaskRootAuthorityOptions {
  approvedTaskBase: string;
  taskId: string;
  hooks?: AebTaskRootAuthorityHooks;
}

export interface AebBoundedTaskFile {
  bytes: Buffer;
  encodedBytes: number;
  identityDigest: string;
  fileIdentity: string;
}

interface PinnedDirectory {
  canonicalPath: string;
  handle: FileHandle;
  identity: BigIntStats;
}

export class NodeAebTaskRootAuthority {
  private initialization?: Promise<{ base: PinnedDirectory; root: PinnedDirectory }>;

  constructor(private readonly options: NodeAebTaskRootAuthorityOptions) {
    if (!isTaskId(options.taskId)) {
      fail("TASK_ID_INVALID", "AEB Bake task ID is not a safe direct-child name.");
    }
  }

  get taskId(): string {
    return this.options.taskId;
  }

  async close(): Promise<void> {
    if (!this.initialization) {
      return;
    }
    try {
      const pinned = await this.initialization;
      await Promise.allSettled([pinned.root.handle.close(), pinned.base.handle.close()]);
    } catch {
      // Initialization closes any partially opened authority descriptors.
    }
  }

  async verifyPinned(): Promise<void> {
    const { base, root } = await this.initialize();
    await verifyPinnedDirectory(base, "TASK_BASE_CHANGED");
    await verifyPinnedDirectory(root, "TASK_ROOT_CHANGED");
    if (path.dirname(root.canonicalPath) !== base.canonicalPath
      || path.basename(root.canonicalPath) !== this.options.taskId) {
      fail("TASK_ROOT_AUTHORITY_INVALID", "AEB Bake task root is not the approved task base direct child.");
    }
  }

  async readBoundedTaskFile(
    relativePath: string,
    maxBytes: number,
    codePrefix: string
  ): Promise<AebBoundedTaskFile> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > maxBoundedTaskFileBytes) {
      fail(`${codePrefix}_READ_LIMIT_INVALID`, "AEB Bake task-owned read limit is invalid.");
    }
    const normalized = validateRelativePath(relativePath, codePrefix);
    const { root } = await this.initialize();
    await this.verifyPinned();
    const filePath = path.resolve(root.canonicalPath, ...normalized.split("/"));
    const pathBefore = await safeLstat(filePath, normalized, codePrefix);
    if (pathBefore.isSymbolicLink()) {
      fail(`${codePrefix}_SYMLINK_FORBIDDEN`, "AEB Bake task-owned symlinks are forbidden.");
    }
    if (!pathBefore.isFile()) {
      fail(`${codePrefix}_NOT_FILE`, "AEB Bake task-owned path is not a regular file.");
    }
    assertSingleLink(pathBefore, codePrefix);
    await assertCanonicalTaskFile(filePath, root.canonicalPath, normalized, codePrefix);
    if (pathBefore.size <= 0n || pathBefore.size > BigInt(maxBytes)) {
      fail(`${codePrefix}_READ_LIMIT_EXCEEDED`, "AEB Bake task-owned file exceeds its read limit.");
    }

    let handle: FileHandle | undefined;
    try {
      handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      const openedBefore = await handle.stat({ bigint: true });
      assertSingleLink(openedBefore, codePrefix);
      assertSameFile(pathBefore, openedBefore, `${codePrefix}_CHANGED_DURING_READ`, normalized);
      await this.options.hooks?.afterFileOpen?.(normalized);
      const bytes = await readCapPlusOne(handle, maxBytes);
      await this.options.hooks?.afterFileRead?.(normalized);
      if (bytes.byteLength > maxBytes) {
        fail(`${codePrefix}_READ_LIMIT_EXCEEDED`, "AEB Bake task-owned file grew beyond its read limit.");
      }
      const openedAfter = await handle.stat({ bigint: true });
      const pathAfter = await safeLstat(filePath, normalized, codePrefix);
      assertSingleLink(openedAfter, codePrefix);
      assertSingleLink(pathAfter, codePrefix);
      assertStableFile(openedAfter, pathAfter, `${codePrefix}_PATH_SWAP_DETECTED`, normalized);
      assertStableFile(openedBefore, openedAfter, `${codePrefix}_CHANGED_DURING_READ`, normalized);
      await assertCanonicalTaskFile(filePath, root.canonicalPath, normalized, codePrefix);
      await this.verifyPinned();
      return {
        bytes,
        encodedBytes: bytes.byteLength,
        identityDigest: identityDigest(openedAfter),
        fileIdentity: `${openedAfter.dev}:${openedAfter.ino}`
      };
    } catch (error) {
      if (error instanceof AebBakePipelineError) {
        throw error;
      }
      fail(`${codePrefix}_READ_FAILED`, "AEB Bake task-owned file could not be safely read.");
    } finally {
      await handle?.close();
    }
    fail(`${codePrefix}_READ_FAILED`, "AEB Bake task-owned file could not be safely read.");
  }

  async directChildPath(fileName: string): Promise<string> {
    if (!isDirectFileName(fileName)) {
      fail("PUBLICATION_PATH_INVALID", "AEB successor package must use a safe direct-child file name.");
    }
    const { root } = await this.initialize();
    await this.verifyPinned();
    return path.join(root.canonicalPath, fileName);
  }

  async syncTaskRoot(): Promise<void> {
    const { root } = await this.initialize();
    await root.handle.sync();
    await this.verifyPinned();
  }

  private async initialize(): Promise<{ base: PinnedDirectory; root: PinnedDirectory }> {
    this.initialization ??= initializeAuthority(this.options.approvedTaskBase, this.options.taskId);
    return this.initialization;
  }
}

export class NodeAebBakeResourceReader implements AebBakeResourceReader {
  private readonly identityPaths = new Map<string, string>();

  constructor(readonly authority: NodeAebTaskRootAuthority) {}

  async verifyTaskReceipt(expected: AebBakeTaskReceipt): Promise<void> {
    const file = await this.authority.readBoundedTaskFile(receiptFileName, maxReceiptBytes, "TASK_RECEIPT");
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.bytes.toString("utf8"));
    } catch {
      fail("TASK_RECEIPT_MALFORMED", "AEB Bake task receipt is not valid JSON.");
    }
    if (!sameJson(parsed, expected) || expected.taskId !== this.authority.taskId) {
      fail("TASK_RECEIPT_BINDING_MISMATCH", "On-disk AEB Bake task receipt does not match the approved task authority.");
    }
  }

  async readFrame(
    source: AebBakeFrameSource,
    expected: {
      width: number;
      height: number;
      maxEncodedBytes: number;
      maxDecodedRgbaBytes: number;
    }
  ): Promise<AebBakeReadResource> {
    const relativePath = validateRelativePngPath(source.relativePath);
    const file = await this.authority.readBoundedTaskFile(relativePath, expected.maxEncodedBytes, "RESOURCE");
    const priorPath = this.identityPaths.get(file.fileIdentity);
    if (priorPath && priorPath !== relativePath) {
      fail("RESOURCE_ALIAS_FORBIDDEN", "AEB Bake resource inventory contains a file alias.");
    }
    this.identityPaths.set(file.fileIdentity, relativePath);

    preflightRgbaPng(file.bytes, relativePath, expected);
    let decoded;
    try {
      decoded = decode(file.bytes, { checkCrc: true });
    } catch {
      fail("RESOURCE_PNG_INVALID", "AEB Bake resource is not a valid CRC-checked PNG.");
    }
    if (decoded.channels !== 4 || decoded.depth !== 8) {
      fail("RESOURCE_RGBA_REQUIRED", "AEB Bake resource must be an 8-bit RGBA PNG.");
    }
    if (decoded.width !== expected.width || decoded.height !== expected.height) {
      fail("RESOURCE_DIMENSIONS_MISMATCH", "AEB Bake resource dimensions do not match the job canvas.");
    }

    return {
      bytes: file.bytes,
      encodedBytes: file.encodedBytes,
      width: decoded.width,
      height: decoded.height,
      decodedRgbaBytes: decoded.width * decoded.height * 4,
      alphaBounds: scanAlphaBounds(decoded.data, decoded.width, decoded.height),
      fileIdentity: file.fileIdentity
    };
  }
}

async function initializeAuthority(approvedTaskBase: string, taskId: string): Promise<{
  base: PinnedDirectory;
  root: PinnedDirectory;
}> {
  const requestedBase = path.resolve(approvedTaskBase);
  const baseMetadata = await safeDirectoryLstat(requestedBase, "TASK_BASE_INVALID");
  if (baseMetadata.isSymbolicLink() || !baseMetadata.isDirectory()) {
    fail("TASK_BASE_INVALID", "Approved AEB task base must be a real directory.");
  }
  const canonicalBase = await safeRealpath(requestedBase, "TASK_BASE_INVALID");
  const base = await pinDirectory(canonicalBase, "TASK_BASE_INVALID");
  try {
    const requestedRoot = path.join(canonicalBase, taskId);
    const rootMetadata = await safeDirectoryLstat(requestedRoot, "TASK_ROOT_INVALID");
    if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
      fail("TASK_ROOT_INVALID", "Approved AEB task root must be a real direct-child directory.");
    }
    const canonicalRoot = await safeRealpath(requestedRoot, "TASK_ROOT_INVALID");
    if (canonicalRoot !== requestedRoot || path.dirname(canonicalRoot) !== canonicalBase) {
      fail("TASK_ROOT_AUTHORITY_INVALID", "AEB task root alias or non-direct-child authority is forbidden.");
    }
    const root = await pinDirectory(canonicalRoot, "TASK_ROOT_INVALID");
    return { base, root };
  } catch (error) {
    await base.handle.close();
    throw error;
  }
}

async function pinDirectory(canonicalPath: string, code: string): Promise<PinnedDirectory> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(canonicalPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const identity = await handle.stat({ bigint: true });
    if (!identity.isDirectory()) {
      fail(code, "AEB task authority path is not a directory.");
    }
    return { canonicalPath, handle, identity };
  } catch (error) {
    await handle?.close();
    if (error instanceof AebBakePipelineError) {
      throw error;
    }
    fail(code, "AEB task authority directory could not be pinned.");
  }
}

async function verifyPinnedDirectory(pinned: PinnedDirectory, code: string): Promise<void> {
  const descriptor = await pinned.handle.stat({ bigint: true });
  const current = await safeDirectoryLstat(pinned.canonicalPath, code);
  assertSameFile(pinned.identity, descriptor, code, "[task authority]");
  assertSameFile(descriptor, current, code, "[task authority]");
  if (current.isSymbolicLink() || !current.isDirectory()
    || await safeRealpath(pinned.canonicalPath, code) !== pinned.canonicalPath) {
    fail(code, "AEB task authority directory changed or became an alias.");
  }
}

async function readCapPlusOne(handle: FileHandle, cap: number): Promise<Buffer> {
  const buffer = Buffer.alloc(cap + 1);
  let offset = 0;
  while (offset < buffer.byteLength) {
    const { bytesRead } = await handle.read(buffer, offset, buffer.byteLength - offset, null);
    if (bytesRead === 0) {
      break;
    }
    offset += bytesRead;
  }
  return buffer.subarray(0, offset);
}

function preflightRgbaPng(
  bytes: Buffer,
  relativePath: string,
  expected: { width: number; height: number; maxDecodedRgbaBytes: number }
): void {
  if (bytes.byteLength < 33
    || !bytes.subarray(0, 8).equals(pngSignature)
    || bytes.readUInt32BE(8) !== 13
    || bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    fail("RESOURCE_PNG_HEADER_INVALID", "AEB Bake resource has an invalid PNG header.");
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes.readUInt8(24);
  const colorType = bytes.readUInt8(25);
  const compression = bytes.readUInt8(26);
  const filter = bytes.readUInt8(27);
  const interlace = bytes.readUInt8(28);
  if (width !== expected.width || height !== expected.height) {
    fail("RESOURCE_DIMENSIONS_MISMATCH", "AEB Bake PNG IHDR dimensions do not match the job canvas.");
  }
  if (bitDepth !== 8 || colorType !== 6 || compression !== 0 || filter !== 0 || interlace !== 0) {
    fail("RESOURCE_RGBA_REQUIRED", "AEB Bake PNG IHDR must declare non-interlaced 8-bit RGBA.");
  }
  const decodedBytes = BigInt(width) * BigInt(height) * 4n;
  if (decodedBytes > BigInt(expected.maxDecodedRgbaBytes)) {
    fail("RESOURCE_DECODED_BUDGET_EXCEEDED", "AEB Bake PNG exceeds its decoded RGBA budget.");
  }
}

async function assertCanonicalTaskFile(
  filePath: string,
  rootPath: string,
  relativePath: string,
  codePrefix: string
): Promise<void> {
  const canonical = await safeRealpath(filePath, `${codePrefix}_MISSING`);
  const relative = path.relative(rootPath, canonical);
  if (canonical !== filePath
    || relative === ""
    || relative === ".."
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)) {
    fail(`${codePrefix}_ALIAS_FORBIDDEN`, "AEB Bake task-owned file aliases are forbidden.");
  }
}

async function safeLstat(filePath: string, relativePath: string, codePrefix: string): Promise<BigIntStats> {
  try {
    return await lstat(filePath, { bigint: true });
  } catch {
    fail(`${codePrefix}_MISSING`, "AEB Bake task-owned file is missing.");
  }
}

async function safeDirectoryLstat(directoryPath: string, code: string): Promise<BigIntStats> {
  try {
    return await lstat(directoryPath, { bigint: true });
  } catch {
    fail(code, "AEB task authority directory is missing.");
  }
}

async function safeRealpath(targetPath: string, code: string): Promise<string> {
  try {
    return await realpath(targetPath);
  } catch {
    fail(code, "AEB task-owned path cannot be resolved.");
  }
}

function assertSameFile(left: BigIntStats, right: BigIntStats, code: string, _label: string): void {
  if (left.dev !== right.dev || left.ino !== right.ino) {
    fail(code, "AEB task-owned file identity changed.");
  }
}

function assertSingleLink(metadata: BigIntStats, codePrefix: string): void {
  if (!metadata.isFile() || metadata.nlink !== 1n) {
    fail(
      `${codePrefix}_MULTILINK_FORBIDDEN`,
      "AEB Bake task-owned regular files must have exactly one filesystem link."
    );
  }
}

function assertStableFile(left: BigIntStats, right: BigIntStats, code: string, _label: string): void {
  if (left.dev !== right.dev
    || left.ino !== right.ino
    || left.size !== right.size
    || left.mtimeNs !== right.mtimeNs
    || left.ctimeNs !== right.ctimeNs) {
    fail(code, "AEB task-owned file changed during validation.");
  }
}

function identityDigest(metadata: BigIntStats): string {
  return createHash("sha256")
    .update(`${metadata.dev}:${metadata.ino}:${metadata.size}:${metadata.mtimeNs}:${metadata.ctimeNs}`)
    .digest("hex");
}

function validateRelativePath(value: string, codePrefix: string): string {
  if (typeof value !== "string"
    || value === ""
    || value.includes("\\")
    || path.posix.isAbsolute(value)
    || path.posix.normalize(value) !== value
    || value === ".."
    || value.startsWith("../")) {
    fail(`${codePrefix}_PATH_INVALID`, "AEB Bake task-owned path must be normalized and relative.");
  }
  return value;
}

function validateRelativePngPath(value: string): string {
  const normalized = validateRelativePath(value, "RESOURCE");
  if (path.posix.extname(normalized).toLowerCase() !== ".png") {
    fail("RESOURCE_PATH_INVALID", "AEB Bake resource path must reference a PNG.");
  }
  return normalized;
}

function isTaskId(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
}

function isDirectFileName(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value) && value !== "." && value !== "..";
}

function scanAlphaBounds(
  data: Uint8Array | Uint8ClampedArray | Uint16Array,
  width: number,
  height: number
): AebBakeReadResource["alphaBounds"] {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    if (Number(data[pixelIndex * 4 + 3]) === 0) continue;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (maxX < 0) return { status: "fully_transparent" };
  return { status: "known", x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortValue(left)) === JSON.stringify(sortValue(right));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
