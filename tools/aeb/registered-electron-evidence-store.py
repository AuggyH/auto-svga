#!/usr/bin/env python3
"""Descriptor-bound private evidence storage for the Electron discriminator."""

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import secrets
import stat
import sys


SCHEMA = "auto-svga-registered-electron-evidence-binding-v1"
BASE_ROOT = "/private/tmp"
TASK_NAME = "auto-svga-aeb-d001-8594bcfa"
TASK_ROOT = f"{BASE_ROOT}/{TASK_NAME}"
TASK_ROOT_MODE = 0o700
REPORTS_NAME = "reports"
BINDING_NAME = "evidence-binding.json"
MAX_RECORD_BYTES = 5 * 1024 * 1024
OUTPUT_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]{15,95}$")
RECORD_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9.-]{1,95}\.json$")


class RecordMissing(FileNotFoundError):
    pass


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def script_sha256():
    with open(os.path.realpath(__file__), "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def directory_flags():
    return os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)


def file_read_flags():
    return os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)


def identity_from_stat(value):
    return {"device": value.st_dev, "inode": value.st_ino}


def same_identity(value, expected):
    return (
        isinstance(expected, dict)
        and value.st_dev == expected.get("device")
        and value.st_ino == expected.get("inode")
    )


def assert_task_root_mode(value):
    if (stat.S_IMODE(value.st_mode) & 0o777) != TASK_ROOT_MODE:
        raise ValueError("task root must be owned-mode 0700")


def canonical_json_bytes(value):
    return (json.dumps(value, ensure_ascii=True, indent=2, sort_keys=True) + "\n").encode("utf-8")


def validate_output_root(output_root):
    if not os.path.isabs(output_root):
        raise ValueError("output root must be absolute")
    resolved = os.path.abspath(output_root)
    if os.path.dirname(resolved) != TASK_ROOT:
        raise ValueError("output root must be a direct task-root child")
    output_name = os.path.basename(resolved)
    if not OUTPUT_NAME_RE.fullmatch(output_name):
        raise ValueError("output root name is outside the bounded contract")
    return resolved, output_name


def validate_record_name(record_name, allow_binding=False):
    if record_name == BINDING_NAME and allow_binding:
        return record_name
    if record_name == BINDING_NAME or not RECORD_NAME_RE.fullmatch(record_name or ""):
        raise ValueError("record name is outside the bounded contract")
    if "/" in record_name or record_name in (".", ".."):
        raise ValueError("record name is not a basename")
    return record_name


def entry_exists(directory_fd, name):
    try:
        os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
        return True
    except FileNotFoundError:
        return False


def open_directory(name, parent_fd=None):
    descriptor = os.open(name, directory_flags(), dir_fd=parent_fd)
    opened = os.fstat(descriptor)
    if not stat.S_ISDIR(opened.st_mode):
        os.close(descriptor)
        raise ValueError("bound path is not a directory")
    return descriptor


class BoundTree:
    def __init__(self, output_root, output_name, base_fd, task_fd, output_fd, reports_fd, binding):
        self.output_root = output_root
        self.output_name = output_name
        self.base_fd = base_fd
        self.task_fd = task_fd
        self.output_fd = output_fd
        self.reports_fd = reports_fd
        self.binding = binding

    def close(self):
        for attribute in ("reports_fd", "output_fd", "task_fd", "base_fd"):
            descriptor = getattr(self, attribute, None)
            if descriptor is not None:
                os.close(descriptor)
                setattr(self, attribute, None)

    def assert_current(self):
        expected = self.binding["identities"]
        assert_task_root_mode(os.fstat(self.task_fd))
        descriptor_pairs = (
            (self.base_fd, expected["base"]),
            (self.task_fd, expected["task"]),
            (self.output_fd, expected["output"]),
            (self.reports_fd, expected["reports"]),
        )
        for descriptor, identity in descriptor_pairs:
            if not same_identity(os.fstat(descriptor), identity):
                raise ValueError("bound directory descriptor identity changed")
        path_pairs = (
            (os.stat(TASK_NAME, dir_fd=self.base_fd, follow_symlinks=False), expected["task"]),
            (os.stat(self.output_name, dir_fd=self.task_fd, follow_symlinks=False), expected["output"]),
            (os.stat(REPORTS_NAME, dir_fd=self.output_fd, follow_symlinks=False), expected["reports"]),
        )
        for current, identity in path_pairs:
            if not stat.S_ISDIR(current.st_mode) or same_identity(current, identity) is False:
                raise ValueError("bound directory path identity changed")
        assert_task_root_mode(os.stat(TASK_NAME, dir_fd=self.base_fd, follow_symlinks=False))


def make_binding(output_name, base_fd, task_fd, output_fd, reports_fd):
    return {
        "schema": SCHEMA,
        "createdAtUtc": utc_now(),
        "outputName": output_name,
        "helperSha256": script_sha256(),
        "identities": {
            "base": identity_from_stat(os.fstat(base_fd)),
            "task": identity_from_stat(os.fstat(task_fd)),
            "output": identity_from_stat(os.fstat(output_fd)),
            "reports": identity_from_stat(os.fstat(reports_fd)),
        },
    }


def validate_binding(binding, output_name):
    if not isinstance(binding, dict):
        raise ValueError("evidence binding is missing")
    if binding.get("schema") != SCHEMA:
        raise ValueError("evidence binding schema mismatched")
    if binding.get("outputName") != output_name:
        raise ValueError("evidence binding output identity mismatched")
    if binding.get("helperSha256") != script_sha256():
        raise ValueError("evidence helper self-hash mismatched")
    try:
        created_at = dt.datetime.fromisoformat(
            str(binding.get("createdAtUtc", "")).replace("Z", "+00:00")
        )
    except ValueError as error:
        raise ValueError("evidence binding timestamp is malformed") from error
    if created_at.tzinfo is None:
        raise ValueError("evidence binding timestamp is malformed")
    identities = binding.get("identities")
    if not isinstance(identities, dict) or set(identities) != {"base", "task", "output", "reports"}:
        raise ValueError("evidence directory identities are incomplete")
    for identity in identities.values():
        if (
            not isinstance(identity, dict)
            or not isinstance(identity.get("device"), int)
            or not isinstance(identity.get("inode"), int)
            or identity["device"] < 0
            or identity["inode"] <= 0
        ):
            raise ValueError("evidence directory identity is malformed")
    return binding


def open_bound_tree(output_root, binding):
    resolved, output_name = validate_output_root(output_root)
    validate_binding(binding, output_name)
    base_fd = task_fd = output_fd = reports_fd = None
    try:
        if os.path.realpath(BASE_ROOT) != BASE_ROOT:
            raise ValueError("base root is not canonical")
        base_fd = open_directory(BASE_ROOT)
        task_fd = open_directory(TASK_NAME, base_fd)
        assert_task_root_mode(os.fstat(task_fd))
        output_fd = open_directory(output_name, task_fd)
        reports_fd = open_directory(REPORTS_NAME, output_fd)
        tree = BoundTree(resolved, output_name, base_fd, task_fd, output_fd, reports_fd, binding)
        tree.assert_current()
        return tree
    except Exception:
        for descriptor in (reports_fd, output_fd, task_fd, base_fd):
            if descriptor is not None:
                os.close(descriptor)
        raise


def atomic_write_json(tree, record_name, value, before_link=None):
    validate_record_name(record_name, allow_binding=record_name == BINDING_NAME)
    tree.assert_current()
    if entry_exists(tree.reports_fd, record_name):
        raise FileExistsError("evidence record already exists")
    payload = canonical_json_bytes(value)
    if len(payload) <= 0 or len(payload) > MAX_RECORD_BYTES:
        raise ValueError("evidence record size is outside the bounded contract")
    temporary = None
    descriptor = None
    linked = False
    try:
        for _ in range(16):
            temporary = f".evidence-{secrets.token_hex(8)}"
            try:
                descriptor = os.open(
                    temporary,
                    os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
                    0o600,
                    dir_fd=tree.reports_fd,
                )
                break
            except FileExistsError:
                continue
        if descriptor is None:
            raise RuntimeError("unable to allocate evidence temporary file")
        with os.fdopen(descriptor, "wb") as handle:
            descriptor = None
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        tree.assert_current()
        if before_link is not None:
            before_link(tree)
        tree.assert_current()
        os.link(
            temporary,
            record_name,
            src_dir_fd=tree.reports_fd,
            dst_dir_fd=tree.reports_fd,
            follow_symlinks=False,
        )
        linked = True
        tree.assert_current()
        os.fsync(tree.reports_fd)
        return {
            "recordName": record_name,
            "byteLength": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
        }
    except Exception:
        if linked and entry_exists(tree.reports_fd, record_name):
            os.unlink(record_name, dir_fd=tree.reports_fd)
        raise
    finally:
        if descriptor is not None:
            os.close(descriptor)
        if temporary is not None and entry_exists(tree.reports_fd, temporary):
            os.unlink(temporary, dir_fd=tree.reports_fd)


def read_json_record(tree, record_name):
    validate_record_name(record_name, allow_binding=record_name == BINDING_NAME)
    tree.assert_current()
    try:
        descriptor = os.open(record_name, file_read_flags(), dir_fd=tree.reports_fd)
    except FileNotFoundError as error:
        raise RecordMissing("evidence record is absent") from error
    try:
        opened = os.fstat(descriptor)
        if not stat.S_ISREG(opened.st_mode) or opened.st_size <= 0 or opened.st_size > MAX_RECORD_BYTES:
            raise ValueError("evidence record is not a bounded regular file")
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
        current = os.stat(record_name, dir_fd=tree.reports_fd, follow_symlinks=False)
        if (
            len(payload) != opened.st_size
            or after.st_size != opened.st_size
            or after.st_dev != opened.st_dev
            or after.st_ino != opened.st_ino
            or current.st_dev != opened.st_dev
            or current.st_ino != opened.st_ino
            or not stat.S_ISREG(current.st_mode)
        ):
            raise ValueError("evidence record changed during bounded read")
        tree.assert_current()
        try:
            value = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError("evidence record JSON is malformed") from error
        return {
            "recordName": record_name,
            "value": value,
            "byteLength": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
        }
    finally:
        os.close(descriptor)


def create_tree(output_root):
    resolved, output_name = validate_output_root(output_root)
    base_fd = task_fd = output_fd = reports_fd = None
    created_task = created_output = created_reports = False
    try:
        if os.path.realpath(BASE_ROOT) != BASE_ROOT:
            raise ValueError("base root is not canonical")
        base_fd = open_directory(BASE_ROOT)
        try:
            task_fd = open_directory(TASK_NAME, base_fd)
        except FileNotFoundError:
            os.mkdir(TASK_NAME, mode=0o700, dir_fd=base_fd)
            created_task = True
            task_fd = open_directory(TASK_NAME, base_fd)
        assert_task_root_mode(os.fstat(task_fd))
        if entry_exists(task_fd, output_name):
            raise FileExistsError("output root already exists")
        os.mkdir(output_name, mode=0o700, dir_fd=task_fd)
        created_output = True
        output_fd = open_directory(output_name, task_fd)
        os.mkdir(REPORTS_NAME, mode=0o700, dir_fd=output_fd)
        created_reports = True
        reports_fd = open_directory(REPORTS_NAME, output_fd)
        binding = make_binding(output_name, base_fd, task_fd, output_fd, reports_fd)
        tree = BoundTree(resolved, output_name, base_fd, task_fd, output_fd, reports_fd, binding)
        tree.assert_current()
        binding_record = atomic_write_json(tree, BINDING_NAME, binding)
        return tree, binding_record
    except Exception:
        if created_reports and reports_fd is not None:
            try:
                if entry_exists(reports_fd, BINDING_NAME):
                    os.unlink(BINDING_NAME, dir_fd=reports_fd)
                for name in os.listdir(reports_fd):
                    if name.startswith(".evidence-"):
                        os.unlink(name, dir_fd=reports_fd)
            except OSError:
                pass
        if reports_fd is not None:
            os.close(reports_fd)
            reports_fd = None
        if created_reports and output_fd is not None:
            try:
                os.rmdir(REPORTS_NAME, dir_fd=output_fd)
            except OSError:
                pass
        if output_fd is not None:
            os.close(output_fd)
            output_fd = None
        if created_output and task_fd is not None:
            try:
                os.rmdir(output_name, dir_fd=task_fd)
            except OSError:
                pass
        if task_fd is not None:
            os.close(task_fd)
            task_fd = None
        if created_task and base_fd is not None:
            try:
                os.rmdir(TASK_NAME, dir_fd=base_fd)
            except OSError:
                pass
        if base_fd is not None:
            os.close(base_fd)
            base_fd = None
        raise


def load_binding(output_root, expected_sha256):
    resolved, output_name = validate_output_root(output_root)
    base_fd = task_fd = output_fd = reports_fd = None
    try:
        base_fd = open_directory(BASE_ROOT)
        task_fd = open_directory(TASK_NAME, base_fd)
        assert_task_root_mode(os.fstat(task_fd))
        output_fd = open_directory(output_name, task_fd)
        reports_fd = open_directory(REPORTS_NAME, output_fd)
        placeholder = {
            "schema": SCHEMA,
            "outputName": output_name,
            "helperSha256": script_sha256(),
            "identities": {
                "base": identity_from_stat(os.fstat(base_fd)),
                "task": identity_from_stat(os.fstat(task_fd)),
                "output": identity_from_stat(os.fstat(output_fd)),
                "reports": identity_from_stat(os.fstat(reports_fd)),
            },
        }
        tree = BoundTree(resolved, output_name, base_fd, task_fd, output_fd, reports_fd, placeholder)
        read = read_json_record(tree, BINDING_NAME)
        if read["sha256"] != expected_sha256:
            raise ValueError("evidence binding hash mismatched")
        validate_binding(read["value"], output_name)
        tree.binding = read["value"]
        tree.assert_current()
        return tree, read
    except Exception:
        for descriptor in (reports_fd, output_fd, task_fd, base_fd):
            if descriptor is not None:
                os.close(descriptor)
        raise


def read_stdin_json():
    try:
        return json.load(sys.stdin)
    except json.JSONDecodeError as error:
        raise ValueError("stdin JSON is malformed") from error


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("create", "load-binding", "read", "write"), required=True)
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--binding-sha256")
    parser.add_argument("--record-name")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    if args.mode == "create":
        if args.binding_sha256 or args.record_name:
            raise ValueError("create mode accepts only output-root")
        tree, binding_record = create_tree(args.output_root)
        try:
            result = {
                "status": "pass",
                "binding": tree.binding,
                "bindingSha256": binding_record["sha256"],
                "bindingByteLength": binding_record["byteLength"],
            }
        finally:
            tree.close()
    else:
        if not re.fullmatch(r"[0-9a-f]{64}", args.binding_sha256 or ""):
            raise ValueError("exact binding SHA-256 is required")
        tree, binding_read = load_binding(args.output_root, args.binding_sha256)
        try:
            if args.mode == "load-binding":
                if args.record_name:
                    raise ValueError("load-binding mode does not accept record-name")
                result = {
                    "status": "pass",
                    "binding": binding_read["value"],
                    "bindingSha256": binding_read["sha256"],
                    "bindingByteLength": binding_read["byteLength"],
                }
            elif args.mode == "read":
                result = {"status": "pass", **read_json_record(tree, args.record_name)}
            else:
                request = read_stdin_json()
                if request.get("binding") != binding_read["value"]:
                    raise ValueError("stdin evidence binding mismatched")
                result = {
                    "status": "pass",
                    **atomic_write_json(tree, args.record_name, request.get("value")),
                }
        finally:
            tree.close()
    json.dump(result, sys.stdout, ensure_ascii=True, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        json.dump(
            {
                "status": "failed_closed",
                "issueCode": "evidence_record_missing" if isinstance(error, RecordMissing) else "evidence_store_rejected",
                "message": str(error),
            },
            sys.stderr,
            ensure_ascii=True,
            sort_keys=True,
        )
        sys.stderr.write("\n")
        raise SystemExit(1)
