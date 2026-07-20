#!/usr/bin/python3

import ctypes
import errno
import json
import os
import stat
import sys


AT_FDCWD = -2
RENAME_SWAP = 0x00000002


def fail(message):
    raise SystemExit(message)


def inspect_directory(raw_path):
    if not os.path.isabs(raw_path):
        fail(f"path must be absolute: {raw_path}")
    normalized = os.path.abspath(raw_path)
    if normalized != raw_path:
        fail(f"path must be normalized: {raw_path}")
    metadata = os.lstat(raw_path)
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
        fail(f"path must be a real directory: {raw_path}")
    resolved = os.path.realpath(raw_path)
    if resolved != raw_path:
        fail(f"path aliases another directory: {raw_path} -> {resolved}")
    return metadata


def main():
    if len(sys.argv) != 7:
        fail(
            "usage: atomic-swap-darwin.py <left-directory> <right-directory> "
            "<left-dev> <left-ino> <right-dev> <right-ino>"
        )
    left, right = sys.argv[1:3]
    expected_left_dev, expected_left_ino, expected_right_dev, expected_right_ino = map(int, sys.argv[3:])
    left_metadata = inspect_directory(left)
    right_metadata = inspect_directory(right)
    if (left_metadata.st_dev, left_metadata.st_ino) != (expected_left_dev, expected_left_ino):
        fail("left directory object changed after caller preflight")
    if (right_metadata.st_dev, right_metadata.st_ino) != (expected_right_dev, expected_right_ino):
        fail("right directory object changed after caller preflight")
    if left == right or (left_metadata.st_dev, left_metadata.st_ino) == (right_metadata.st_dev, right_metadata.st_ino):
        fail("swap paths must refer to distinct directories")
    if os.path.dirname(left) != os.path.dirname(right):
        fail("swap paths must share one parent directory")
    if left_metadata.st_dev != right_metadata.st_dev:
        fail("swap paths must be on one filesystem")

    libc = ctypes.CDLL(None, use_errno=True)
    renameatx_np = libc.renameatx_np
    renameatx_np.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    renameatx_np.restype = ctypes.c_int
    result = renameatx_np(
        AT_FDCWD,
        os.fsencode(left),
        AT_FDCWD,
        os.fsencode(right),
        RENAME_SWAP,
    )
    if result != 0:
        error_number = ctypes.get_errno()
        fail(f"renameatx_np(RENAME_SWAP) failed: [{error_number}] {os.strerror(error_number)}")

    parent_descriptor = os.open(os.path.dirname(left), os.O_RDONLY)
    try:
        os.fsync(parent_descriptor)
    except OSError as error:
        if error.errno not in (errno.EINVAL, errno.ENOTSUP):
            raise
    finally:
        os.close(parent_descriptor)

    print(json.dumps({
        "primitive": "renameatx_np",
        "flags": "RENAME_SWAP",
        "left": left,
        "right": right,
        "leftObject": {"dev": str(left_metadata.st_dev), "ino": str(left_metadata.st_ino)},
        "rightObject": {"dev": str(right_metadata.st_dev), "ino": str(right_metadata.st_ino)},
        "parentDirectoryFsynced": True,
    }))


if __name__ == "__main__":
    main()
