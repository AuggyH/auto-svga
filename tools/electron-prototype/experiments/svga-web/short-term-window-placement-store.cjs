"use strict";

const { randomBytes } = require("node:crypto");
const defaultFileSystem = require("node:fs");
const path = require("node:path");

const WINDOW_PLACEMENT_MAX_BYTES = 16 * 1024;

function createWindowPlacementStore(fileSystem = defaultFileSystem) {
  const noFollowFlag = fileSystem.constants.O_NOFOLLOW ?? 0;
  const directoryFlag = fileSystem.constants.O_DIRECTORY ?? 0;

  function sameIdentity(left, right) {
    return Boolean(left && right) && left.dev === right.dev && left.ino === right.ino;
  }

  function safeRegularFile(stat) {
    return Boolean(stat?.isFile?.()) && !stat.isSymbolicLink?.() && stat.nlink === 1;
  }

  function safeDirectory(stat) {
    return Boolean(stat?.isDirectory?.())
      && !stat.isSymbolicLink?.()
      && (stat.mode & 0o022) === 0;
  }

  function lstatState(filePath) {
    try {
      const stat = fileSystem.lstatSync(filePath);
      return safeRegularFile(stat) ? { status: "safe", stat } : { status: "unsafe" };
    } catch (error) {
      if (error?.code === "ENOENT") return { status: "missing" };
      return { status: "failed" };
    }
  }

  function bindParentDirectory(parentPath, create) {
    let descriptor;
    try {
      if (create) fileSystem.mkdirSync(parentPath, { recursive: true, mode: 0o700 });
      const pathStat = fileSystem.lstatSync(parentPath);
      if (!safeDirectory(pathStat)) return { status: "unsafe" };
      descriptor = fileSystem.openSync(
        parentPath,
        fileSystem.constants.O_RDONLY | directoryFlag | noFollowFlag
      );
      const descriptorStat = fileSystem.fstatSync(descriptor);
      if (!safeDirectory(descriptorStat) || !sameIdentity(pathStat, descriptorStat)) {
        fileSystem.closeSync(descriptor);
        return { status: "unsafe" };
      }
      return { status: "bound", descriptor, stat: descriptorStat };
    } catch (error) {
      if (descriptor !== undefined) {
        try {
          fileSystem.closeSync(descriptor);
        } catch {
          // The typed parent result remains authoritative.
        }
      }
      if (error?.code === "ENOENT") return { status: "missing" };
      return { status: "unsafe" };
    }
  }

  function parentIdentityUnchanged(parentPath, binding) {
    try {
      const descriptorStat = fileSystem.fstatSync(binding.descriptor);
      const pathStat = fileSystem.lstatSync(parentPath);
      return safeDirectory(descriptorStat)
        && safeDirectory(pathStat)
        && sameIdentity(binding.stat, descriptorStat)
        && sameIdentity(binding.stat, pathStat);
    } catch {
      return false;
    }
  }

  function fileIdentityUnchanged(filePath, expectedStat) {
    const current = lstatState(filePath);
    return current.status === "safe"
      && sameIdentity(expectedStat, current.stat)
      && current.stat.nlink === expectedStat.nlink
      && current.stat.size === expectedStat.size;
  }

  function readWindowPlacementPreference(filePath) {
    const parentPath = path.dirname(filePath);
    let parentBinding;
    let descriptor;
    try {
      parentBinding = bindParentDirectory(parentPath, false);
      if (parentBinding.status === "missing") return { status: "missing" };
      if (parentBinding.status !== "bound") {
        return { status: "invalid", reason: "placement_store_unsafe_parent" };
      }

      const existing = lstatState(filePath);
      if (existing.status === "missing") return { status: "missing" };
      if (existing.status !== "safe") return { status: "invalid", reason: "placement_store_unsafe_file" };

      descriptor = fileSystem.openSync(filePath, fileSystem.constants.O_RDONLY | noFollowFlag);
      const initialStat = fileSystem.fstatSync(descriptor);
      if (!safeRegularFile(initialStat) || !sameIdentity(existing.stat, initialStat)) {
        return { status: "invalid", reason: "placement_store_unsafe_file" };
      }
      if (initialStat.size <= 0) return { status: "invalid", reason: "placement_store_malformed" };
      if (initialStat.size > WINDOW_PLACEMENT_MAX_BYTES) {
        return { status: "invalid", reason: "placement_store_oversized" };
      }

      const buffer = Buffer.alloc(WINDOW_PLACEMENT_MAX_BYTES + 1);
      let bytesRead = 0;
      while (bytesRead < buffer.byteLength) {
        const count = fileSystem.readSync(descriptor, buffer, bytesRead, buffer.byteLength - bytesRead, null);
        if (count === 0) break;
        bytesRead += count;
      }
      const finalStat = fileSystem.fstatSync(descriptor);
      if (bytesRead > WINDOW_PLACEMENT_MAX_BYTES) {
        return { status: "invalid", reason: "placement_store_oversized" };
      }
      if (!safeRegularFile(finalStat)
        || !sameIdentity(initialStat, finalStat)
        || bytesRead !== initialStat.size
        || finalStat.size !== initialStat.size
        || !fileIdentityUnchanged(filePath, finalStat)
        || !parentIdentityUnchanged(parentPath, parentBinding)) {
        return { status: "invalid", reason: "placement_store_changed_during_read" };
      }

      const value = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { status: "invalid", reason: "placement_store_malformed" };
      }
      return { status: "loaded", value };
    } catch (error) {
      if (error?.code === "ENOENT") return { status: "invalid", reason: "placement_store_changed_during_read" };
      if (error?.code === "ELOOP") return { status: "invalid", reason: "placement_store_unsafe_file" };
      if (error instanceof SyntaxError) return { status: "invalid", reason: "placement_store_malformed" };
      return { status: "invalid", reason: "placement_store_read_failed" };
    } finally {
      if (descriptor !== undefined) {
        try {
          fileSystem.closeSync(descriptor);
        } catch {
          // The typed result already captures the useful boundary.
        }
      }
      if (parentBinding?.descriptor !== undefined) {
        try {
          fileSystem.closeSync(parentBinding.descriptor);
        } catch {
          // Parent cleanup is best-effort after a typed result.
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
    let parentBinding;
    let descriptor;
    try {
      parentBinding = bindParentDirectory(parentPath, true);
      if (parentBinding.status !== "bound") {
        return { status: "failed", reason: "placement_store_unsafe_parent" };
      }
      const initialTarget = lstatState(filePath);
      if (initialTarget.status === "failed" || initialTarget.status === "unsafe") {
        return { status: "failed", reason: "placement_store_unsafe_file" };
      }

      descriptor = fileSystem.openSync(
        temporaryPath,
        fileSystem.constants.O_WRONLY
          | fileSystem.constants.O_CREAT
          | fileSystem.constants.O_EXCL
          | noFollowFlag,
        0o600
      );
      let bytesWritten = 0;
      while (bytesWritten < bytes.byteLength) {
        const count = fileSystem.writeSync(descriptor, bytes, bytesWritten, bytes.byteLength - bytesWritten, null);
        if (count <= 0) throw new Error("placement_store_short_write");
        bytesWritten += count;
      }
      fileSystem.fsyncSync(descriptor);
      const temporaryStat = fileSystem.fstatSync(descriptor);
      if (!safeRegularFile(temporaryStat) || temporaryStat.size !== bytes.byteLength) {
        return { status: "failed", reason: "placement_store_write_failed" };
      }
      fileSystem.closeSync(descriptor);
      descriptor = undefined;

      if (!parentIdentityUnchanged(parentPath, parentBinding)) {
        return { status: "failed", reason: "placement_store_changed_during_write" };
      }
      const currentTarget = lstatState(filePath);
      if (initialTarget.status === "missing") {
        if (currentTarget.status !== "missing") {
          return { status: "failed", reason: "placement_store_changed_during_write" };
        }
        try {
          fileSystem.linkSync(temporaryPath, filePath);
        } catch (error) {
          if (error?.code === "EEXIST") {
            return { status: "failed", reason: "placement_store_changed_during_write" };
          }
          throw error;
        }
        fileSystem.unlinkSync(temporaryPath);
      } else {
        if (currentTarget.status !== "safe" || !sameIdentity(initialTarget.stat, currentTarget.stat)) {
          return { status: "failed", reason: "placement_store_changed_during_write" };
        }
        fileSystem.renameSync(temporaryPath, filePath);
      }
      fileSystem.fsyncSync(parentBinding.descriptor);

      const finalTarget = lstatState(filePath);
      if (finalTarget.status !== "safe"
        || finalTarget.stat.size !== bytes.byteLength
        || !parentIdentityUnchanged(parentPath, parentBinding)) {
        return { status: "failed", reason: "placement_store_changed_during_write" };
      }
      return { status: "saved" };
    } catch (error) {
      if (error?.code === "ELOOP") return { status: "failed", reason: "placement_store_unsafe_file" };
      return { status: "failed", reason: "placement_store_write_failed" };
    } finally {
      if (descriptor !== undefined) {
        try {
          fileSystem.closeSync(descriptor);
        } catch {
          // Cleanup below remains best-effort.
        }
      }
      try {
        fileSystem.unlinkSync(temporaryPath);
      } catch {
        // Successful publication removes the temporary path.
      }
      if (parentBinding?.descriptor !== undefined) {
        try {
          fileSystem.closeSync(parentBinding.descriptor);
        } catch {
          // Parent cleanup is best-effort after a typed result.
        }
      }
    }
  }

  return {
    readWindowPlacementPreference,
    writeWindowPlacementPreference
  };
}

const defaultStore = createWindowPlacementStore();

module.exports = {
  WINDOW_PLACEMENT_MAX_BYTES,
  createWindowPlacementStore,
  ...defaultStore
};
