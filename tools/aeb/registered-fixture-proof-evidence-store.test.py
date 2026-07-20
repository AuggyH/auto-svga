#!/usr/bin/env python3

import importlib.util
import os
import pathlib
import stat
import tempfile
import unittest
from unittest import mock


MODULE_PATH = pathlib.Path(__file__).with_name("registered-fixture-proof-evidence-store.py")


def load_store_module():
    spec = importlib.util.spec_from_file_location("registered_fixture_evidence_store", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class EvidenceStoreTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="aeb-fixture-evidence-test-")
        self.module = load_store_module()
        self.base_root = os.path.realpath(self.temporary.name)
        self.module.BASE_ROOT = self.base_root
        self.module.TASK_NAME = "fixture-task-root"
        self.module.TASK_ROOT = os.path.join(self.base_root, self.module.TASK_NAME)
        os.mkdir(self.module.TASK_ROOT, mode=0o700)
        os.chmod(self.module.TASK_ROOT, 0o700)
        self.output_name = "fixture-evidence-test-001"
        self.output_root = os.path.join(self.module.TASK_ROOT, self.output_name)

    def tearDown(self):
        self.temporary.cleanup()

    def create_tree(self):
        return self.module.create_tree(self.output_root)

    def test_atomic_publication_is_no_overwrite_and_bounded_read_is_identity_pinned(self):
        tree = self.create_tree()
        try:
            payload = b'{"status":"pass"}\n'
            published = self.module.atomic_publish(
                tree, "reports", "result.json", payload, self.module.MAX_JSON_BYTES
            )
            readback, metadata = self.module.bounded_read(
                tree, "reports", "result.json", self.module.MAX_JSON_BYTES
            )
            self.assertEqual(readback, payload)
            self.assertEqual(metadata, published)
            with self.assertRaises(FileExistsError):
                self.module.atomic_publish(
                    tree, "reports", "result.json", payload, self.module.MAX_JSON_BYTES
                )
        finally:
            tree.close()

    def test_hardlink_and_symlink_records_are_rejected(self):
        tree = self.create_tree()
        try:
            payload = b"bounded"
            self.module.atomic_publish(tree, "saved", "proof.svga", payload, 1024)
            saved_fd = tree.descriptors["saved"]
            os.link("proof.svga", "proof-alias.svga", src_dir_fd=saved_fd, dst_dir_fd=saved_fd)
            with self.assertRaisesRegex(ValueError, "single-link"):
                self.module.bounded_read(tree, "saved", "proof.svga", 1024)
            os.unlink("proof-alias.svga", dir_fd=saved_fd)
            os.symlink("proof.svga", "proof-symlink.svga", dir_fd=saved_fd)
            with self.assertRaises(OSError):
                self.module.bounded_read(tree, "saved", "proof-symlink.svga", 1024)
        finally:
            tree.close()

    def test_growth_or_post_open_replacement_is_rejected(self):
        tree = self.create_tree()
        try:
            self.module.atomic_publish(tree, "reports", "growth.json", b"12345678", 1024)
            reports_path = os.path.join(self.output_root, "reports")
            original_read = self.module.os.read
            mutated = False

            def grow_after_first_read(descriptor, count):
                nonlocal mutated
                chunk = original_read(descriptor, count)
                if not mutated:
                    mutated = True
                    with open(os.path.join(reports_path, "growth.json"), "ab") as handle:
                        handle.write(b"x")
                return chunk

            with mock.patch.object(self.module.os, "read", side_effect=grow_after_first_read):
                with self.assertRaisesRegex(ValueError, "changed during bounded read"):
                    self.module.bounded_read(tree, "reports", "growth.json", 1024)

            self.module.atomic_publish(tree, "reports", "replace.json", b"original", 1024)
            original_stat = self.module.os.fstat
            replaced = False

            def replace_after_open(descriptor):
                nonlocal replaced
                value = original_stat(descriptor)
                if not replaced and stat.S_ISREG(value.st_mode):
                    replaced = True
                    target = os.path.join(reports_path, "replace.json")
                    replacement = os.path.join(reports_path, "replacement.tmp")
                    with open(replacement, "wb") as handle:
                        handle.write(b"replaced")
                    os.replace(replacement, target)
                return value

            with mock.patch.object(self.module.os, "fstat", side_effect=replace_after_open):
                with self.assertRaisesRegex(ValueError, "changed during bounded read"):
                    self.module.bounded_read(tree, "reports", "replace.json", 1024)
        finally:
            tree.close()

    def test_ancestor_swap_rejects_before_any_outside_publication(self):
        tree = self.create_tree()
        outside = os.path.join(self.base_root, "outside")
        os.mkdir(outside, mode=0o700)
        moved = os.path.join(self.base_root, "moved-task")
        try:
            os.rename(self.module.TASK_ROOT, moved)
            os.symlink(outside, self.module.TASK_ROOT)
            with self.assertRaises(ValueError):
                self.module.atomic_publish(tree, "reports", "outside.json", b"{}\n", 1024)
            self.assertEqual(os.listdir(outside), [])
        finally:
            tree.close()

    def test_partial_tree_creation_rolls_back_the_exact_claimed_output(self):
        original_open = self.module.open_directory

        def fail_identity_group(name, parent_fd=None):
            if name == "identity":
                raise OSError("injected open failure")
            return original_open(name, parent_fd)

        with mock.patch.object(self.module, "open_directory", side_effect=fail_identity_group):
            with self.assertRaises(OSError):
                self.create_tree()
        self.assertFalse(os.path.lexists(self.output_root))


if __name__ == "__main__":
    unittest.main()
