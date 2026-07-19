#!/usr/bin/env python3
"""Pinned no-overwrite evidence storage for the registered AEB fixture proof."""

import argparse
import base64
import hashlib
import json
import os
import re
import secrets
import stat
import sys


SCHEMA = "auto-svga-aeb-registered-fixture-evidence-binding-v1"
BASE_ROOT = "/private/tmp"
TASK_NAME = "auto-svga-aeb-d001-8594bcfa"
TASK_ROOT = f"{BASE_ROOT}/{TASK_NAME}"
TASK_MODE = 0o700
GROUPS = ("reports", "saved", "identity", "user-data", "session-data")
RUNTIME_STATE_GROUPS = ("user-data", "session-data")
OUTPUT_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]{15,95}$")
RECORD_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$")
MAX_JSON_BYTES = 5 * 1024 * 1024
MAX_BINARY_BYTES = 50 * 1024 * 1024
MAX_RUNTIME_STATE_ENTRIES = 4096
MAX_RUNTIME_STATE_DEPTH = 32
BINDING_NAME = "evidence-binding.json"


def script_sha256():
    with open(os.path.realpath(__file__), "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def directory_flags():
    return os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)


def file_read_flags():
    return os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)


def identity(value):
    return {"device": value.st_dev, "inode": value.st_ino}


def same_identity(value, expected):
    return (
        isinstance(expected, dict)
        and value.st_dev == expected.get("device")
        and value.st_ino == expected.get("inode")
    )


def canonical_json_bytes(value):
    return (json.dumps(value, ensure_ascii=True, indent=2, sort_keys=True) + "\n").encode("utf-8")


def validate_output_root(output_root):
    resolved = os.path.abspath(output_root or "")
    if not os.path.isabs(output_root or "") or os.path.dirname(resolved) != TASK_ROOT:
        raise ValueError("output root must be a direct task-root child")
    output_name = os.path.basename(resolved)
    if not OUTPUT_NAME_RE.fullmatch(output_name):
        raise ValueError("output root name is outside the bounded contract")
    return resolved, output_name


def validate_record(group, name):
    if group not in GROUPS:
        raise ValueError("evidence group is invalid")
    if not RECORD_NAME_RE.fullmatch(name or "") or "/" in name or name in (".", ".."):
        raise ValueError("evidence record name is invalid")
    if name == BINDING_NAME and group != "reports":
        raise ValueError("binding record belongs to reports")
    return group, name


def open_directory(name, parent_fd=None):
    descriptor = os.open(name, directory_flags(), dir_fd=parent_fd)
    opened = os.fstat(descriptor)
    if not stat.S_ISDIR(opened.st_mode):
        os.close(descriptor)
        raise ValueError("bound path is not a directory")
    return descriptor


def assert_owned_private_directory(value, label):
    if not stat.S_ISDIR(value.st_mode) or value.st_uid != os.getuid():
        raise ValueError(f"{label} ownership is invalid")
    if stat.S_IMODE(value.st_mode) != TASK_MODE:
        raise ValueError(f"{label} mode must be 0700")


def entry_exists(directory_fd, name):
    try:
        os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
        return True
    except FileNotFoundError:
        return False


class BoundTree:
    def __init__(self, output_root, output_name, descriptors, binding):
        self.output_root = output_root
        self.output_name = output_name
        self.descriptors = descriptors
        self.binding = binding

    def close(self):
        for key in reversed(("base", "task", "output", *GROUPS)):
            descriptor = self.descriptors.pop(key, None)
            if descriptor is not None:
                os.close(descriptor)

    def assert_current(self):
        expected = self.binding["identities"]
        assert_owned_private_directory(os.fstat(self.descriptors["task"]), "task root")
        assert_owned_private_directory(os.fstat(self.descriptors["output"]), "output root")
        for group in GROUPS:
            assert_owned_private_directory(os.fstat(self.descriptors[group]), group)
        for key, descriptor in self.descriptors.items():
            if not same_identity(os.fstat(descriptor), expected[key]):
                raise ValueError("bound directory descriptor identity changed")
        pairs = [
            (os.stat(TASK_NAME, dir_fd=self.descriptors["base"], follow_symlinks=False), expected["task"]),
            (os.stat(self.output_name, dir_fd=self.descriptors["task"], follow_symlinks=False), expected["output"]),
        ]
        pairs.extend(
            (os.stat(group, dir_fd=self.descriptors["output"], follow_symlinks=False), expected[group])
            for group in GROUPS
        )
        if any(not stat.S_ISDIR(value.st_mode) or not same_identity(value, expected_value) for value, expected_value in pairs):
            raise ValueError("bound directory path identity changed")


def make_binding(output_name, descriptors):
    return {
        "schema": SCHEMA,
        "outputName": output_name,
        "helperSha256": script_sha256(),
        "ownerUid": os.getuid(),
        "identities": {key: identity(os.fstat(value)) for key, value in descriptors.items()},
    }


def validate_binding(binding, output_name):
    expected_keys = {"schema", "outputName", "helperSha256", "ownerUid", "identities"}
    if not isinstance(binding, dict) or set(binding) != expected_keys:
        raise ValueError("evidence binding shape is invalid")
    if (
        binding["schema"] != SCHEMA
        or binding["outputName"] != output_name
        or binding["helperSha256"] != script_sha256()
        or binding["ownerUid"] != os.getuid()
    ):
        raise ValueError("evidence binding identity mismatched")
    if set(binding["identities"]) != {"base", "task", "output", *GROUPS}:
        raise ValueError("evidence binding directory identities are incomplete")
    for value in binding["identities"].values():
        if not isinstance(value, dict) or not isinstance(value.get("device"), int) or not isinstance(value.get("inode"), int):
            raise ValueError("evidence binding directory identity is malformed")
    return binding


def open_existing_tree(output_root, binding):
    _, output_name = validate_output_root(output_root)
    validate_binding(binding, output_name)
    descriptors = {}
    try:
        if os.path.realpath(BASE_ROOT) != BASE_ROOT:
            raise ValueError("base root is not canonical")
        descriptors["base"] = open_directory(BASE_ROOT)
        descriptors["task"] = open_directory(TASK_NAME, descriptors["base"])
        descriptors["output"] = open_directory(output_name, descriptors["task"])
        for group in GROUPS:
            descriptors[group] = open_directory(group, descriptors["output"])
        tree = BoundTree(output_root, output_name, descriptors, binding)
        tree.assert_current()
        return tree
    except Exception:
        for descriptor in descriptors.values():
            os.close(descriptor)
        raise


def create_tree(output_root):
    resolved, output_name = validate_output_root(output_root)
    descriptors = {}
    created_output = False
    try:
        if os.path.realpath(BASE_ROOT) != BASE_ROOT:
            raise ValueError("base root is not canonical")
        descriptors["base"] = open_directory(BASE_ROOT)
        descriptors["task"] = open_directory(TASK_NAME, descriptors["base"])
        assert_owned_private_directory(os.fstat(descriptors["task"]), "task root")
        if entry_exists(descriptors["task"], output_name):
            raise FileExistsError("output root already exists")
        os.mkdir(output_name, mode=TASK_MODE, dir_fd=descriptors["task"])
        created_output = True
        descriptors["output"] = open_directory(output_name, descriptors["task"])
        assert_owned_private_directory(os.fstat(descriptors["output"]), "output root")
        for group in GROUPS:
            os.mkdir(group, mode=TASK_MODE, dir_fd=descriptors["output"])
            descriptors[group] = open_directory(group, descriptors["output"])
        binding = make_binding(output_name, descriptors)
        tree = BoundTree(resolved, output_name, descriptors, binding)
        tree.assert_current()
        atomic_publish(tree, "reports", BINDING_NAME, canonical_json_bytes(binding), MAX_JSON_BYTES)
        return tree
    except Exception:
        if created_output:
            # Roll back only entries created through the still-pinned parent descriptors.
            reports_fd = descriptors.get("reports")
            if reports_fd is not None and entry_exists(reports_fd, BINDING_NAME):
                try:
                    os.unlink(BINDING_NAME, dir_fd=reports_fd)
                except OSError:
                    pass
            for group in reversed(GROUPS):
                descriptor = descriptors.pop(group, None)
                if descriptor is not None:
                    try:
                        os.close(descriptor)
                    except OSError:
                        pass
            output_fd = descriptors.get("output")
            if output_fd is not None:
                for group in reversed(GROUPS):
                    try:
                        os.rmdir(group, dir_fd=output_fd)
                    except OSError:
                        pass
                try:
                    os.close(descriptors.pop("output"))
                except OSError:
                    pass
            task_fd = descriptors.get("task")
            if task_fd is not None:
                try:
                    os.rmdir(output_name, dir_fd=task_fd)
                except OSError:
                    pass
        for descriptor in reversed(tuple(descriptors.values())):
            try:
                os.close(descriptor)
            except OSError:
                pass
        raise


def atomic_publish(tree, group, name, payload, max_bytes):
    validate_record(group, name)
    tree.assert_current()
    if not isinstance(payload, bytes) or len(payload) <= 0 or len(payload) > max_bytes:
        raise ValueError("evidence payload is outside the bounded contract")
    directory_fd = tree.descriptors[group]
    if entry_exists(directory_fd, name):
        raise FileExistsError("evidence destination already exists")
    temporary = None
    linked = False
    try:
        for _ in range(16):
            temporary = f".fixture-{secrets.token_hex(8)}"
            try:
                descriptor = os.open(
                    temporary,
                    os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
                    0o600,
                    dir_fd=directory_fd,
                )
                break
            except FileExistsError:
                continue
        else:
            raise RuntimeError("unable to allocate evidence temporary")
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        opened = os.stat(temporary, dir_fd=directory_fd, follow_symlinks=False)
        if not stat.S_ISREG(opened.st_mode) or opened.st_nlink != 1 or opened.st_size != len(payload):
            raise ValueError("temporary evidence identity is invalid")
        tree.assert_current()
        os.link(temporary, name, src_dir_fd=directory_fd, dst_dir_fd=directory_fd, follow_symlinks=False)
        linked = True
        os.unlink(temporary, dir_fd=directory_fd)
        temporary = None
        current = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
        if (
            not stat.S_ISREG(current.st_mode)
            or current.st_nlink != 1
            or current.st_dev != opened.st_dev
            or current.st_ino != opened.st_ino
            or current.st_size != len(payload)
        ):
            raise ValueError("published evidence identity changed")
        os.fsync(directory_fd)
        tree.assert_current()
        return {
            "byteLength": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
            "device": current.st_dev,
            "inode": current.st_ino,
        }
    except Exception:
        if linked and entry_exists(directory_fd, name):
            os.unlink(name, dir_fd=directory_fd)
        raise
    finally:
        if temporary is not None and entry_exists(directory_fd, temporary):
            os.unlink(temporary, dir_fd=directory_fd)


def bounded_read(tree, group, name, max_bytes):
    validate_record(group, name)
    tree.assert_current()
    directory_fd = tree.descriptors[group]
    descriptor = os.open(name, file_read_flags(), dir_fd=directory_fd)
    try:
        opened = os.fstat(descriptor)
        if (
            not stat.S_ISREG(opened.st_mode)
            or opened.st_nlink != 1
            or opened.st_size <= 0
            or opened.st_size > max_bytes
        ):
            raise ValueError("evidence record is not a bounded single-link regular file")
        chunks = []
        remaining = opened.st_size + 1
        while remaining > 0:
            chunk = os.read(descriptor, min(65536, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        payload = b"".join(chunks)
        after = os.fstat(descriptor)
        current = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
        if (
            len(payload) != opened.st_size
            or after.st_size != opened.st_size
            or after.st_dev != opened.st_dev
            or after.st_ino != opened.st_ino
            or after.st_nlink != 1
            or current.st_dev != opened.st_dev
            or current.st_ino != opened.st_ino
            or current.st_nlink != 1
        ):
            raise ValueError("evidence record changed during bounded read")
        tree.assert_current()
        return payload, {
            "byteLength": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
            "device": current.st_dev,
            "inode": current.st_ino,
        }
    finally:
        os.close(descriptor)


def assert_runtime_state_entry(value, label):
    if value.st_uid != os.getuid():
        raise ValueError(f"{label} ownership is invalid")
    if stat.S_ISLNK(value.st_mode):
        raise ValueError(f"{label} symlink is forbidden")
    if stat.S_ISREG(value.st_mode):
        if value.st_nlink != 1:
            raise ValueError(f"{label} hardlink is forbidden")
        return "file"
    if stat.S_ISDIR(value.st_mode):
        return "directory"
    raise ValueError(f"{label} type is invalid")


def runtime_state_entries(directory_fd, depth=0, counter=None):
    if depth > MAX_RUNTIME_STATE_DEPTH:
        raise ValueError("runtime state depth exceeds the bound")
    if counter is None:
        counter = [0]
    for name in sorted(os.listdir(directory_fd)):
        if not name or name in (".", "..") or "/" in name:
            raise ValueError("runtime state entry name is invalid")
        before = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
        entry_type = assert_runtime_state_entry(before, "runtime state entry")
        counter[0] += 1
        if counter[0] > MAX_RUNTIME_STATE_ENTRIES:
            raise ValueError("runtime state entry count exceeds the bound")
        if entry_type == "directory":
            child_fd = open_directory(name, directory_fd)
            try:
                opened = os.fstat(child_fd)
                if not same_identity(opened, identity(before)) or opened.st_uid != os.getuid():
                    raise ValueError("runtime state directory identity changed")
                runtime_state_entries(child_fd, depth + 1, counter)
            finally:
                os.close(child_fd)
            current = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
            if not same_identity(current, identity(before)) or not stat.S_ISDIR(current.st_mode):
                raise ValueError("runtime state directory path identity changed")
        else:
            descriptor = os.open(name, file_read_flags(), dir_fd=directory_fd)
            try:
                opened = os.fstat(descriptor)
                if not same_identity(opened, identity(before)) or opened.st_nlink != 1:
                    raise ValueError("runtime state file identity changed")
            finally:
                os.close(descriptor)
            current = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
            if not same_identity(current, identity(before)) or current.st_nlink != 1:
                raise ValueError("runtime state file path identity changed")
    return counter[0]


def clear_runtime_state_directory(directory_fd, depth=0, counter=None):
    if depth > MAX_RUNTIME_STATE_DEPTH:
        raise ValueError("runtime state depth exceeds the bound")
    if counter is None:
        counter = [0]
    for name in sorted(os.listdir(directory_fd)):
        if not name or name in (".", "..") or "/" in name:
            raise ValueError("runtime state entry name is invalid")
        before = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
        entry_type = assert_runtime_state_entry(before, "runtime state entry")
        counter[0] += 1
        if counter[0] > MAX_RUNTIME_STATE_ENTRIES:
            raise ValueError("runtime state entry count exceeds the bound")
        if entry_type == "directory":
            child_fd = open_directory(name, directory_fd)
            try:
                opened = os.fstat(child_fd)
                if not same_identity(opened, identity(before)) or opened.st_uid != os.getuid():
                    raise ValueError("runtime state directory identity changed")
                clear_runtime_state_directory(child_fd, depth + 1, counter)
                os.fsync(child_fd)
            finally:
                os.close(child_fd)
            current = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
            if not same_identity(current, identity(before)) or not stat.S_ISDIR(current.st_mode):
                raise ValueError("runtime state directory path identity changed")
            os.rmdir(name, dir_fd=directory_fd)
        else:
            descriptor = os.open(name, file_read_flags(), dir_fd=directory_fd)
            try:
                opened = os.fstat(descriptor)
                if not same_identity(opened, identity(before)) or opened.st_nlink != 1:
                    raise ValueError("runtime state file identity changed")
            finally:
                os.close(descriptor)
            current = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
            if not same_identity(current, identity(before)) or current.st_nlink != 1:
                raise ValueError("runtime state file path identity changed")
            os.unlink(name, dir_fd=directory_fd)
    return counter[0]


def inspect_runtime_state(tree):
    tree.assert_current()
    entry_count = 0
    for group in RUNTIME_STATE_GROUPS:
        entry_count += runtime_state_entries(tree.descriptors[group])
    tree.assert_current()
    return entry_count


def clear_runtime_state(tree):
    tree.assert_current()
    removed_entry_count = 0
    for group in RUNTIME_STATE_GROUPS:
        removed_entry_count += clear_runtime_state_directory(tree.descriptors[group])
        os.fsync(tree.descriptors[group])
    tree.assert_current()
    remaining_entry_count = inspect_runtime_state(tree)
    if remaining_entry_count != 0:
        raise ValueError("runtime state cleanup is incomplete")
    return removed_entry_count, remaining_entry_count


def decode_binding(encoded):
    try:
        padding = "=" * (-len(encoded or "") % 4)
        return json.loads(base64.urlsafe_b64decode((encoded + padding).encode("ascii")).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("evidence binding is malformed") from error


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        choices=(
            "create", "load", "write-json", "write-bytes", "read-json", "read-bytes",
            "inspect-runtime-state", "clear-runtime-state",
        ),
        required=True,
    )
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--binding-base64")
    parser.add_argument("--binding-sha256")
    parser.add_argument("--group", choices=GROUPS)
    parser.add_argument("--record-name")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    if args.mode == "create":
        if args.binding_base64 or args.binding_sha256 or args.group or args.record_name:
            raise ValueError("create accepts only output-root")
        tree = create_tree(args.output_root)
        try:
            binding_bytes = canonical_json_bytes(tree.binding)
            result = {
                "status": "pass",
                "binding": tree.binding,
                "bindingSha256": hashlib.sha256(binding_bytes).hexdigest(),
            }
        finally:
            tree.close()
    else:
        binding = decode_binding(args.binding_base64)
        if (
            not re.fullmatch(r"[0-9a-f]{64}", args.binding_sha256 or "")
            or hashlib.sha256(canonical_json_bytes(binding)).hexdigest() != args.binding_sha256
        ):
            raise ValueError("evidence binding hash mismatched")
        tree = open_existing_tree(args.output_root, binding)
        try:
            if args.mode == "load":
                if args.group or args.record_name:
                    raise ValueError("load does not accept a record")
                result = {"status": "pass", "bindingSha256": args.binding_sha256}
            elif args.mode == "inspect-runtime-state":
                if args.group or args.record_name:
                    raise ValueError("inspect-runtime-state does not accept a record")
                result = {"status": "pass", "runtimeStateEntryCount": inspect_runtime_state(tree)}
            elif args.mode == "clear-runtime-state":
                if args.group or args.record_name:
                    raise ValueError("clear-runtime-state does not accept a record")
                removed, remaining = clear_runtime_state(tree)
                result = {
                    "status": "pass",
                    "removedEntryCount": removed,
                    "remainingEntryCount": remaining,
                }
            elif args.mode == "write-json":
                value = json.load(sys.stdin)
                metadata = atomic_publish(tree, args.group, args.record_name, canonical_json_bytes(value), MAX_JSON_BYTES)
                result = {"status": "pass", **metadata}
            elif args.mode == "write-bytes":
                metadata = atomic_publish(tree, args.group, args.record_name, sys.stdin.buffer.read(MAX_BINARY_BYTES + 1), MAX_BINARY_BYTES)
                result = {"status": "pass", **metadata}
            else:
                payload, metadata = bounded_read(
                    tree,
                    args.group,
                    args.record_name,
                    MAX_JSON_BYTES if args.mode == "read-json" else MAX_BINARY_BYTES,
                )
                result = {"status": "pass", **metadata}
                if args.mode == "read-json":
                    result["value"] = json.loads(payload.decode("utf-8"))
        finally:
            tree.close()
    json.dump(result, sys.stdout, ensure_ascii=True, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        json.dump({"status": "failed_closed", "issueCode": "fixture_evidence_store_rejected"}, sys.stderr)
        sys.stderr.write("\n")
        raise SystemExit(1)
