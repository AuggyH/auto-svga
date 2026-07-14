"use strict";

const { randomBytes } = require("node:crypto");
const {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  renameSync,
  unlinkSync,
  writeSync
} = require("node:fs");
const path = require("node:path");

const WINDOW_PLACEMENT_MAX_BYTES = 16 * 1024;
const noFollowFlag = constants.O_NOFOLLOW ?? 0;

function safeExistingFile(filePath) {
  try {
    const stat = lstatSync(filePath);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    return false;
  }
}

function readWindowPlacementPreference(filePath) {
  const existing = safeExistingFile(filePath);
  if (existing === undefined) return { status: "missing" };
  if (!existing) return { status: "invalid", reason: "placement_store_unsafe_file" };

  let descriptor;
  try {
    descriptor = openSync(filePath, constants.O_RDONLY | noFollowFlag);
    const initialStat = fstatSync(descriptor);
    if (!initialStat.isFile()) return { status: "invalid", reason: "placement_store_unsafe_file" };
    if (initialStat.size <= 0) return { status: "invalid", reason: "placement_store_malformed" };
    if (initialStat.size > WINDOW_PLACEMENT_MAX_BYTES) {
      return { status: "invalid", reason: "placement_store_oversized" };
    }

    const buffer = Buffer.alloc(WINDOW_PLACEMENT_MAX_BYTES + 1);
    let bytesRead = 0;
    while (bytesRead < buffer.byteLength) {
      const count = readSync(descriptor, buffer, bytesRead, buffer.byteLength - bytesRead, null);
      if (count === 0) break;
      bytesRead += count;
    }
    const finalStat = fstatSync(descriptor);
    if (bytesRead > WINDOW_PLACEMENT_MAX_BYTES) {
      return { status: "invalid", reason: "placement_store_oversized" };
    }
    if (bytesRead !== initialStat.size || finalStat.size !== initialStat.size) {
      return { status: "invalid", reason: "placement_store_changed_during_read" };
    }

    const value = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { status: "invalid", reason: "placement_store_malformed" };
    }
    return { status: "loaded", value };
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "missing" };
    if (error?.code === "ELOOP") return { status: "invalid", reason: "placement_store_unsafe_file" };
    if (error instanceof SyntaxError) return { status: "invalid", reason: "placement_store_malformed" };
    return { status: "invalid", reason: "placement_store_read_failed" };
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // The typed result already captures the useful boundary.
      }
    }
  }
}

function writeWindowPlacementPreference(filePath, value) {
  let bytes;
  try {
    bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  } catch {
    return { status: "failed", reason: "placement_store_malformed" };
  }
  if (bytes.byteLength > WINDOW_PLACEMENT_MAX_BYTES) {
    return { status: "failed", reason: "placement_store_oversized" };
  }

  const parentPath = path.dirname(filePath);
  const temporaryPath = path.join(
    parentPath,
    `.${path.basename(filePath)}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`
  );
  let descriptor;
  try {
    mkdirSync(parentPath, { recursive: true, mode: 0o700 });
    const existing = safeExistingFile(filePath);
    if (existing === false) return { status: "failed", reason: "placement_store_unsafe_file" };

    descriptor = openSync(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollowFlag,
      0o600
    );
    let bytesWritten = 0;
    while (bytesWritten < bytes.byteLength) {
      const count = writeSync(descriptor, bytes, bytesWritten, bytes.byteLength - bytesWritten, null);
      if (count <= 0) throw new Error("placement_store_short_write");
      bytesWritten += count;
    }
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;

    if (safeExistingFile(filePath) === false) {
      return { status: "failed", reason: "placement_store_unsafe_file" };
    }
    renameSync(temporaryPath, filePath);
    return { status: "saved" };
  } catch (error) {
    if (error?.code === "ELOOP") return { status: "failed", reason: "placement_store_unsafe_file" };
    return { status: "failed", reason: "placement_store_write_failed" };
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // Cleanup below remains best-effort.
      }
    }
    try {
      unlinkSync(temporaryPath);
    } catch {
      // A successful rename removes the temporary path; failures are typed above.
    }
  }
}

module.exports = {
  WINDOW_PLACEMENT_MAX_BYTES,
  readWindowPlacementPreference,
  writeWindowPlacementPreference
};
