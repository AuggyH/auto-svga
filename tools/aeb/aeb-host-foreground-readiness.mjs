#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";

const DEFAULT_REQUEST_PATH = "/private/tmp/auto-svga-aeb-dev/semantic-inbox-ae26/request.json";

const PROCESS_NEEDLES = Object.freeze({
  ae26: "/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app",
  autoSvga: "/Users/huangtengxin/Applications/Auto SVGA.app",
  localAutoSvga: "/Applications/Auto SVGA.app",
});

export function parseFrontmostApplication(lsappinfoOutput) {
  const blocks = String(lsappinfoOutput || "").split(/\n\s*\n/u);
  for (const block of blocks) {
    if (!/\(in front\)/u.test(block)) continue;
    const nameMatch = block.match(/^\s*\d+\)\s+"([^"]+)"/u);
    const bundleMatch = block.match(/bundleID="([^"]+)"/u);
    const pathMatch = block.match(/bundle path="([^"]+)"/u);
    return {
      name: nameMatch?.[1] || "",
      bundleId: bundleMatch?.[1] || "",
      bundlePath: pathMatch?.[1] || "",
    };
  }
  return null;
}

export function parseCuaLockScreenGuardian(pmsetOutput) {
  return /process:CUALockScreenGuardian/u.test(String(pmsetOutput || ""));
}

export function parseTargetProcesses(psOutput) {
  const processes = [];
  const lines = String(psOutput || "").split(/\r?\n/u);
  for (const line of lines) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/u);
    if (!match) continue;
    const [, pid, ppid, etime, stat, args] = match;
    for (const [kind, needle] of Object.entries(PROCESS_NEEDLES)) {
      if (!args.includes(needle)) continue;
      processes.push({
        kind,
        pid: Number(pid),
        ppid: Number(ppid),
        etime,
        stat,
        args,
      });
      break;
    }
  }
  return processes;
}

export function inspectPendingRequest(requestPath = DEFAULT_REQUEST_PATH, deps = {}) {
  const fsImpl = deps.fs || fs;
  if (!fsImpl.existsSync(requestPath)) {
    return { exists: false, path: requestPath };
  }
  const bytes = fsImpl.readFileSync(requestPath, "utf8");
  let requestId = "";
  let permitId = "";
  try {
    const record = JSON.parse(bytes);
    requestId = typeof record.requestId === "string" ? record.requestId : "";
    permitId = typeof record.permitId === "string" ? record.permitId : "";
  } catch {
    requestId = "unparseable";
  }
  return {
    exists: true,
    path: requestPath,
    bytes: Buffer.byteLength(bytes),
    requestId,
    permitId,
  };
}

export function buildAebHostForegroundReadiness(input) {
  const frontmost = parseFrontmostApplication(input.lsappinfoOutput);
  const cuaLockScreenGuardian = parseCuaLockScreenGuardian(input.pmsetOutput);
  const targetProcesses = parseTargetProcesses(input.psOutput);
  const pendingRequest = input.pendingRequest || { exists: false, path: DEFAULT_REQUEST_PATH };
  const blockers = [];
  const warnings = [];

  if (frontmost?.bundleId === "com.apple.loginwindow") {
    blockers.push({
      code: "aeb.host_readiness_loginwindow_frontmost",
      message: "loginwindow is frontmost; AE foreground or CEP interaction is not possible.",
    });
  }
  if (cuaLockScreenGuardian) {
    blockers.push({
      code: "aeb.host_readiness_cu_lock_screen_guardian",
      message: "CUALockScreenGuardian is active; unlock the desktop before launching AE.",
    });
  }
  if (pendingRequest.exists) {
    blockers.push({
      code: "aeb.host_readiness_pending_request_exists",
      message: "An AE26 semantic request is already pending; consume or remove it before publishing a new one.",
      requestId: pendingRequest.requestId,
      permitId: pendingRequest.permitId,
    });
  }

  for (const process of targetProcesses) {
    if (process.kind === "ae26") {
      blockers.push({
        code: "aeb.host_readiness_ae26_process_exists",
        message: "An AE26 process already exists; start from a clean host instance.",
        pid: process.pid,
      });
    } else if (process.kind === "autoSvga" || process.kind === "localAutoSvga") {
      blockers.push({
        code: "aeb.host_readiness_auto_svga_process_exists",
        message: "An Auto SVGA process already exists; avoid ambiguous product proof ownership.",
        pid: process.pid,
      });
    }
  }

  const ae25Processes = String(input.psOutput || "")
    .split(/\r?\n/u)
    .filter((line) => line.includes("/Applications/Adobe After Effects 2025/Adobe After Effects 2025.app"))
    .map((line) => line.trim())
    .filter(Boolean);
  if (ae25Processes.length > 0) {
    warnings.push({
      code: "aeb.host_readiness_ae25_process_present",
      message: "AE25.5 is present; do not target or mutate it.",
      count: ae25Processes.length,
    });
  }

  return {
    schema: "auto-svga-aeb-host-foreground-readiness-v1",
    ready: blockers.length === 0,
    frontmost,
    cuaLockScreenGuardian,
    pendingRequest,
    targetProcesses,
    warnings,
    blockers,
  };
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? String(result.error.message || result.error) : "",
  };
}

export function collectAebHostForegroundReadiness(options = {}) {
  const lsappinfo = runCommand("/usr/bin/lsappinfo", ["list"]);
  const pmset = runCommand("/usr/bin/pmset", ["-g", "assertions"]);
  const ps = runCommand("/bin/ps", ["-axo", "pid=,ppid=,etime=,stat=,args="]);
  const pendingRequest = inspectPendingRequest(options.requestPath || DEFAULT_REQUEST_PATH);
  const report = buildAebHostForegroundReadiness({
    lsappinfoOutput: lsappinfo.stdout,
    pmsetOutput: pmset.stdout,
    psOutput: ps.stdout,
    pendingRequest,
  });
  return {
    ...report,
    commandStatus: {
      lsappinfo: { status: lsappinfo.status, stderr: lsappinfo.stderr, error: lsappinfo.error },
      pmset: { status: pmset.status, stderr: pmset.stderr, error: pmset.error },
      ps: { status: ps.status, stderr: ps.stderr, error: ps.error },
    },
  };
}

export function main(argv = process.argv.slice(2)) {
  const json = argv.includes("--json");
  const report = collectAebHostForegroundReadiness();
  const text = JSON.stringify(report, null, 2);
  if (json) {
    console.log(text);
  } else if (report.ready) {
    console.log("AEB_HOST_FOREGROUND_READY");
    console.log(text);
  } else {
    console.error("AEB_HOST_FOREGROUND_NOT_READY");
    console.error(text);
  }
  return report.ready ? 0 : 2;
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  process.exitCode = main();
}
