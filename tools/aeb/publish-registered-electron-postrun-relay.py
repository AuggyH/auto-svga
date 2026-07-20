#!/usr/bin/env python3
"""Publish one private postrun relay with the approved producer's pinned writer."""

import argparse
import hashlib
import json
import os
import stat
import sys
import types


AUTHORITY_BASE_ROOT = "/private/tmp/auto-svga-aeb-d001-8594bcfa/process-authority"
AUTHORITY_DIRECTORY_MODE = 0o700
APPROVED_PRODUCER_PATH = (
    "/Users/huangtengxin/Documents/auto-svga/tools/aeb/"
    "capture-aeb-process-authority.py"
)
APPROVED_PRODUCER_SHA256 = (
    "9ed0d47c5d4fe7bd8be4990fd3a84fbf5006230483142e92bddffa84c62506a5"
)
RELAY_NAME = "postrun-finalization-relay.json"
MAX_RELAY_BYTES = 5 * 1024 * 1024
MAX_PRODUCER_BYTES = 1024 * 1024


def load_approved_producer(producer_path):
    if producer_path != APPROVED_PRODUCER_PATH:
        raise ValueError("producer path mismatched")
    file_stat = os.lstat(producer_path)
    if not stat.S_ISREG(file_stat.st_mode) or stat.S_ISLNK(file_stat.st_mode):
        raise ValueError("producer is not a regular non-symlink file")
    if os.path.realpath(producer_path) != producer_path:
        raise ValueError("producer path is not canonical")
    descriptor = os.open(producer_path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        opened = os.fstat(descriptor)
        if not stat.S_ISREG(opened.st_mode) or opened.st_size <= 0 or opened.st_size > MAX_PRODUCER_BYTES:
            raise ValueError("producer bytes are outside the bounded contract")
        chunks = []
        remaining = opened.st_size + 1
        while remaining > 0:
            chunk = os.read(descriptor, min(65536, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        source = b"".join(chunks)
        after = os.fstat(descriptor)
        current = os.lstat(producer_path)
        if (
            len(source) != opened.st_size
            or after.st_dev != opened.st_dev
            or after.st_ino != opened.st_ino
            or after.st_size != opened.st_size
            or current.st_dev != opened.st_dev
            or current.st_ino != opened.st_ino
        ):
            raise ValueError("producer identity changed during bounded read")
    finally:
        os.close(descriptor)
    if hashlib.sha256(source).hexdigest() != APPROVED_PRODUCER_SHA256:
        raise ValueError("producer self-hash mismatched")
    module = types.ModuleType("aeb_process_authority_producer")
    module.__file__ = producer_path
    exec(compile(source, producer_path, "exec"), module.__dict__)
    return module


def validate_paths(authority_root, relay_path, allowed_base_root):
    if not all(os.path.isabs(value) for value in (authority_root, relay_path, allowed_base_root)):
        raise ValueError("authority publication paths must be absolute")
    if os.path.dirname(authority_root) != allowed_base_root:
        raise ValueError("authority root must be a direct base-root child")
    if os.path.basename(authority_root) in ("", ".", ".."):
        raise ValueError("authority root name is invalid")
    if relay_path != os.path.join(authority_root, RELAY_NAME):
        raise ValueError("relay path is outside the exact authority binding")
    for directory in (allowed_base_root, authority_root):
        directory_stat = os.lstat(directory)
        if stat.S_ISLNK(directory_stat.st_mode) or not stat.S_ISDIR(directory_stat.st_mode):
            raise ValueError("authority publication directory is not a non-symlink directory")
        if stat.S_IMODE(directory_stat.st_mode) != AUTHORITY_DIRECTORY_MODE:
            raise ValueError("authority publication directory must be owned-mode 0700")
        if os.path.realpath(directory) != directory:
            raise ValueError("authority publication directory is not canonical")


def publish_relay(
    relay,
    authority_root,
    relay_path,
    producer_path=APPROVED_PRODUCER_PATH,
    allowed_base_root=AUTHORITY_BASE_ROOT,
    before_publish=None,
    producer_module=None,
):
    validate_paths(authority_root, relay_path, allowed_base_root)
    if not isinstance(relay, dict):
        raise ValueError("relay must be a JSON object")
    producer = producer_module or load_approved_producer(producer_path)
    binding = producer.safe_output_path(relay_path, authority_root)
    published = False
    try:
        if before_publish is not None:
            before_publish(binding, producer)
        producer.atomic_write_json(binding, relay)
        published = True
        expected_payload = (
            json.dumps(relay, ensure_ascii=True, indent=2, sort_keys=True) + "\n"
        ).encode("utf-8")
        if len(expected_payload) <= 0 or len(expected_payload) > MAX_RELAY_BYTES:
            raise ValueError("relay bytes are outside the bounded contract")
        binding.assert_current()
        descriptor = os.open(
            binding.filename,
            os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0),
            dir_fd=binding.parent_fd,
        )
        try:
            opened = os.fstat(descriptor)
            if not stat.S_ISREG(opened.st_mode) or opened.st_size != len(expected_payload):
                raise ValueError("published relay size mismatched")
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
            current = os.stat(binding.filename, dir_fd=binding.parent_fd, follow_symlinks=False)
            if (
                payload != expected_payload
                or after.st_dev != opened.st_dev
                or after.st_ino != opened.st_ino
                or after.st_size != opened.st_size
                or current.st_dev != opened.st_dev
                or current.st_ino != opened.st_ino
                or not stat.S_ISREG(current.st_mode)
            ):
                raise ValueError("published relay identity or bytes changed")
        finally:
            os.close(descriptor)
        binding.assert_current()
        return {
            "status": "pass",
            "relaySha256": hashlib.sha256(expected_payload).hexdigest(),
            "relayByteLength": len(expected_payload),
        }
    except Exception:
        if published:
            try:
                current = os.stat(
                    binding.filename,
                    dir_fd=binding.parent_fd,
                    follow_symlinks=False,
                )
                if stat.S_ISREG(current.st_mode):
                    os.unlink(binding.filename, dir_fd=binding.parent_fd)
                    os.fsync(binding.parent_fd)
            except FileNotFoundError:
                pass
        raise
    finally:
        binding.close()


def read_stdin_json():
    payload = sys.stdin.buffer.read(MAX_RELAY_BYTES + 1)
    if len(payload) <= 0 or len(payload) > MAX_RELAY_BYTES:
        raise ValueError("relay stdin is outside the bounded contract")
    value = json.loads(payload.decode("utf-8"))
    if not isinstance(value, dict):
        raise ValueError("relay stdin must contain one JSON object")
    return value


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--authority-root", required=True)
    parser.add_argument("--relay-path", required=True)
    parser.add_argument("--producer-path", required=True)
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    result = publish_relay(
        read_stdin_json(),
        args.authority_root,
        args.relay_path,
        producer_path=args.producer_path,
    )
    json.dump(result, sys.stdout, ensure_ascii=True, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
