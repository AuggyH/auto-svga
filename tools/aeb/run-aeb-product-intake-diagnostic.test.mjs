import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOpenArgs,
  summarizeDiagnostic,
  validateDiagnosticInput,
} from "./run-aeb-product-intake-diagnostic.mjs";

test("product intake diagnostic exposes one redacted enum result", () => {
  assert.deepEqual(summarizeDiagnostic({
    schema: "auto-svga-aeb-package-intake-diagnostic-v1",
    phase: "materialize-export-svga",
    errorName: "Error",
    errorCode: "unclassified",
    pathRedacted: true,
  }), {
    schema: "auto-svga-aeb-product-intake-diagnostic-result-v1",
    status: "diagnosed",
    stage: "materialize-export-svga",
    errorType: "Error",
    errorCode: "unclassified",
    pathRedacted: true,
    runtimePassClaimed: false,
  });
  assert.throws(() => summarizeDiagnostic({
    schema: "auto-svga-aeb-package-intake-diagnostic-v1",
    phase: "/private/tmp/private",
    errorName: "Error",
    errorCode: "unclassified",
    pathRedacted: true,
  }), { code: "aeb_product_intake_diagnostic_result_invalid" });
});

test("product intake diagnostic launch arguments use registered hidden LaunchServices once", () => {
  const args = buildOpenArgs({
    wrapperPath: "/private/tmp/task/wrapper.cjs",
    descriptorPath: "/private/tmp/task/descriptor.json",
    descriptorHash: "a".repeat(64),
    store: { outputRoot: "/private/tmp/task", binding: { root: "task" }, bindingSha256: "b".repeat(64) },
    stdoutPath: "/private/tmp/task/stdout.log",
    stderrPath: "/private/tmp/task/stderr.log",
  });
  assert.deepEqual(args.slice(0, 9), [
    "-W", "-n", "-g",
    "--stdout", "/private/tmp/task/stdout.log",
    "--stderr", "/private/tmp/task/stderr.log",
    "-a", "/Users/huangtengxin/Documents/auto-svga/tools/electron-prototype/node_modules/electron/dist/Electron.app",
  ]);
  assert.equal(args.filter((value) => value === "--args").length, 1);
  assert.equal(args.filter((value) => value === "--output-root").length, 1);
});

test("product intake diagnostic rejects malformed outer input before descriptor use", () => {
  assert.throws(() => validateDiagnosticInput({ schema: "wrong", descriptor: {}, extra: true }), {
    code: "aeb_product_intake_diagnostic_input_invalid",
  });
});
