export interface Nq1FlakeSourceSnapshot {
  readonly loopValidateSource: string;
  readonly launcherSource: string;
  readonly launcherTestSource: string;
  readonly svgaWebMainSource: string;
  readonly svgaWebServerSource: string;
  readonly svgaWebRendererSource: string;
  readonly svgaWebPrepareSource: string;
  readonly packageJsonSource: string;
}

export interface Nq1FlakeStaticCheck {
  readonly id: string;
  readonly status: "pass" | "advisory" | "fail";
  readonly evidence: string;
}

export interface Nq1RepeatedRunGroup {
  readonly id: "core-targeted-tests" | "electron-smoke" | "round-trip-subset";
  readonly command: string;
  readonly expectedRepetitions: number;
  readonly actualRepetitions: number;
  readonly passCount: number;
  readonly failCount: number;
  readonly durationsMs: readonly number[];
}

export interface Nq1FlakeStabilityReport {
  readonly schemaVersion: 1;
  readonly milestoneId: "NQ1";
  readonly reportId: "flake-stability";
  readonly passed: boolean;
  readonly staticChecks: readonly Nq1FlakeStaticCheck[];
  readonly repeatedRunGroups: readonly Nq1RepeatedRunGroup[];
  readonly developerDocs: readonly string[];
  readonly advisories: readonly string[];
}

export function buildNq1FlakeStaticChecks(snapshot: Nq1FlakeSourceSnapshot): readonly Nq1FlakeStaticCheck[] {
  return [
    check(
      "loop_validate_uses_random_loopback_port",
      snapshot.loopValidateSource.includes('server.listen(0, "127.0.0.1"'),
      "loop validation web smoke binds to an OS-assigned 127.0.0.1 port"
    ),
    check(
      "loop_validate_closes_web_smoke_server",
      snapshot.loopValidateSource.includes("} finally {")
        && snapshot.loopValidateSource.includes("server.close((error) => error ? rejectClose(error) : resolveClose())"),
      "web local smoke server is closed through a finally block"
    ),
    check(
      "loop_validate_tracks_and_kills_child_processes",
      snapshot.loopValidateSource.includes("const activeChildren = new Set()")
        && snapshot.loopValidateSource.includes("activeChildren?.add(child)")
        && snapshot.loopValidateSource.includes("if (!child.killed) child.kill()"),
      "loop validation tracks active child processes and terminates them on cleanup"
    ),
    check(
      "launcher_tests_use_random_ports",
      snapshot.launcherTestSource.includes('server.listen(0, "127.0.0.1"'),
      "launcher tests request OS-assigned loopback ports"
    ),
    check(
      "launcher_waits_for_readiness_and_cleans_child",
      snapshot.launcherSource.includes("probeAutoSvgaPreview")
        && snapshot.launcherSource.includes("waitForAutoSvgaPreview")
        && snapshot.launcherSource.includes("child.kill(\"SIGTERM\")"),
      "local launcher probes readiness and exposes a stop path for the spawned server"
    ),
    check(
      "electron_server_uses_random_loopback_port",
      snapshot.svgaWebServerSource.includes('server.listen(0, "127.0.0.1"'),
      "isolated Electron prototype server binds to an OS-assigned loopback port"
    ),
    check(
      "electron_preparation_resets_runtime_root",
      snapshot.svgaWebPrepareSource.includes('await rm(runtimeRoot, { recursive: true, force: true })')
        && snapshot.svgaWebPrepareSource.includes("await mkdir(runtimeRoot, { recursive: true })"),
      "isolated runtime preparation clears and recreates only its scoped .runtime directory"
    ),
    check(
      "renderer_screenshot_smoke_waits_for_visible_canvas",
      snapshot.svgaWebRendererSource.includes("waitForVisibleCanvasSamples")
        && snapshot.svgaWebRendererSource.includes("visibleCanvas.sampleCount >= 3"),
      "visual smoke waits for sampled nonblank canvas evidence instead of a fixed screenshot delay"
    ),
    check(
      "renderer_async_waits_are_bounded",
      snapshot.svgaWebRendererSource.includes("waitForVisibleCanvasSamples")
        && snapshot.svgaWebRendererSource.includes("timeoutMs"),
      "renderer canvas smoke waits are bounded by explicit readiness conditions"
    ),
    check(
      "electron_smoke_runs_sequentially",
      snapshot.packageJsonSource.includes('"desktop:smoke"')
        && snapshot.packageJsonSource.includes('"desktop:dev"')
        && snapshot.packageJsonSource.includes('"test": "npm run test:all"'),
      "Electron prototype smoke remains behind explicit scripts instead of default test entrypoints"
    )
  ];
}

export function buildNq1FlakeStabilityReport({
  staticChecks,
  repeatedRunGroups,
  developerDocs
}: {
  readonly staticChecks: readonly Nq1FlakeStaticCheck[];
  readonly repeatedRunGroups: readonly Nq1RepeatedRunGroup[];
  readonly developerDocs: readonly string[];
}): Nq1FlakeStabilityReport {
  const failedStaticChecks = staticChecks.filter(({ status }) => status === "fail");
  const failedRepeatedGroups = repeatedRunGroups.filter(({ failCount, actualRepetitions, expectedRepetitions }) =>
    failCount > 0 || actualRepetitions !== expectedRepetitions
  );
  const advisories = staticChecks
    .filter(({ status }) => status === "advisory")
    .map(({ id, evidence }) => `${id}: ${evidence}`);

  return {
    schemaVersion: 1,
    milestoneId: "NQ1",
    reportId: "flake-stability",
    passed: failedStaticChecks.length === 0 && failedRepeatedGroups.length === 0,
    staticChecks,
    repeatedRunGroups,
    developerDocs,
    advisories
  };
}

function check(id: string, passed: boolean, evidence: string): Nq1FlakeStaticCheck {
  return {
    id,
    status: passed ? "pass" : "fail",
    evidence
  };
}
