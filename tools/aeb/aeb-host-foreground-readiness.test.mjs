import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAebHostForegroundReadiness,
  inspectPendingRequest,
  parseCuaLockScreenGuardian,
  parseFrontmostApplication,
  parseTargetProcesses,
} from "./aeb-host-foreground-readiness.mjs";

const LOGINWINDOW_FRONT = `
 1) "loginwindow" ASN:0x0-0x2002: (in front)
    bundleID="com.apple.loginwindow"
    bundle path="/System/Library/CoreServices/loginwindow.app"
`;

const FINDER_FRONT = `
 1) "Finder" ASN:0x0-0x3003: (in front)
    bundleID="com.apple.finder"
    bundle path="/System/Library/CoreServices/Finder.app"
`;

test("frontmost parser identifies loginwindow and normal desktop apps", () => {
  assert.deepEqual(parseFrontmostApplication(LOGINWINDOW_FRONT), {
    name: "loginwindow",
    bundleId: "com.apple.loginwindow",
    bundlePath: "/System/Library/CoreServices/loginwindow.app",
  });
  assert.deepEqual(parseFrontmostApplication(FINDER_FRONT), {
    name: "Finder",
    bundleId: "com.apple.finder",
    bundlePath: "/System/Library/CoreServices/Finder.app",
  });
});

test("readiness rejects lock screen and CUALockScreenGuardian before request publication", () => {
  const report = buildAebHostForegroundReadiness({
    lsappinfoOutput: LOGINWINDOW_FRONT,
    pmsetOutput: 'pid 388(WindowServer): UserIsActive named: "process:CUALockScreenGuardian"',
    psOutput: "",
    pendingRequest: { exists: false, path: "/tmp/request.json" },
  });

  assert.equal(report.ready, false);
  assert.deepEqual(
    report.blockers.map((blocker) => blocker.code),
    [
      "aeb.host_readiness_loginwindow_frontmost",
      "aeb.host_readiness_cu_lock_screen_guardian",
    ],
  );
});

test("readiness rejects stale pending request and ambiguous target processes", () => {
  const report = buildAebHostForegroundReadiness({
    lsappinfoOutput: FINDER_FRONT,
    pmsetOutput: "",
    psOutput: [
      "123 1 00:01 S /Applications/Adobe After Effects 2026/Adobe After Effects 2026.app/Contents/MacOS/After Effects",
      "456 1 00:02 S /Users/huangtengxin/Applications/Auto SVGA.app/Contents/MacOS/Auto SVGA",
      "789 1 00:03 S /Applications/Adobe After Effects 2025/Adobe After Effects 2025.app/Contents/MacOS/After Effects",
    ].join("\n"),
    pendingRequest: {
      exists: true,
      path: "/private/tmp/auto-svga-aeb-dev/semantic-inbox-ae26/request.json",
      requestId: "aeb-semantic-example",
      permitId: "ASV-APR-example",
    },
  });

  assert.equal(report.ready, false);
  assert.deepEqual(
    report.blockers.map((blocker) => blocker.code),
    [
      "aeb.host_readiness_pending_request_exists",
      "aeb.host_readiness_ae26_process_exists",
      "aeb.host_readiness_auto_svga_process_exists",
    ],
  );
  assert.deepEqual(report.warnings.map((warning) => warning.code), [
    "aeb.host_readiness_ae25_process_present",
  ]);
});

test("readiness passes for an unlocked desktop with no pending request or target process", () => {
  const report = buildAebHostForegroundReadiness({
    lsappinfoOutput: FINDER_FRONT,
    pmsetOutput: "Assertion status system-wide:",
    psOutput: "",
    pendingRequest: { exists: false, path: "/tmp/request.json" },
  });

  assert.equal(report.ready, true);
  assert.deepEqual(report.blockers, []);
});

test("pending request inspection is parse tolerant and side-effect free", () => {
  const files = new Map([
    [
      "/tmp/request.json",
      JSON.stringify({
        requestId: "aeb-semantic-fixture",
        permitId: "ASV-APR-1",
      }),
    ],
    ["/tmp/bad.json", "{not-json"],
  ]);
  const fsStub = {
    existsSync: (path) => files.has(path),
    readFileSync: (path) => files.get(path),
  };

  assert.equal(parseCuaLockScreenGuardian("process:CUALockScreenGuardian"), true);
  assert.deepEqual(parseTargetProcesses("123 1 00:01 S no target"), []);
  assert.deepEqual(inspectPendingRequest("/tmp/request.json", { fs: fsStub }), {
    exists: true,
    path: "/tmp/request.json",
    bytes: files.get("/tmp/request.json").length,
    requestId: "aeb-semantic-fixture",
    permitId: "ASV-APR-1",
  });
  assert.equal(inspectPendingRequest("/tmp/bad.json", { fs: fsStub }).requestId, "unparseable");
  assert.equal(inspectPendingRequest("/tmp/missing.json", { fs: fsStub }).exists, false);
});
