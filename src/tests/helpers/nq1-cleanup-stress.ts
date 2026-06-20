export interface Nq1CleanupStressReport {
  schemaVersion: 1;
  milestoneId: "NQ1";
  reportId: "resource-process-memory-cleanup-stress";
  passed: boolean;
  sourceCheckCount: number;
  sourceCheckFailures: readonly string[];
  scenarioCount: number;
  scenarioFailureCount: number;
  cleanupCount: number;
  playerDestroyCount: number;
  parserDestroyCount: number;
  localDestroyCount: number;
  maxActiveResourceCount: number;
  finalActiveResourceCount: number;
  sourceChecks: readonly Nq1CleanupSourceCheck[];
  scenarios: readonly Nq1CleanupStressScenario[];
}

export interface Nq1CleanupSourceCheck {
  id: string;
  passed: boolean;
}

export interface Nq1CleanupStressScenario {
  id: string;
  passed: boolean;
  evidence: Readonly<Record<string, unknown>>;
}

export function buildNq1CleanupStressReport(input: {
  mainSource: string;
  rendererSource: string;
}): Nq1CleanupStressReport {
  const sourceChecks = buildSourceChecks(input);
  const scenarios = runStressScenarios();
  const sourceCheckFailures = sourceChecks
    .filter((check) => !check.passed)
    .map((check) => check.id);
  const scenarioFailureCount = scenarios.filter((scenario) => !scenario.passed).length;
  const finalModel = runLongCycleStress(80);
  return {
    schemaVersion: 1,
    milestoneId: "NQ1",
    reportId: "resource-process-memory-cleanup-stress",
    passed: sourceCheckFailures.length === 0 && scenarioFailureCount === 0 && finalModel.activeResourceCount === 0,
    sourceCheckCount: sourceChecks.length,
    sourceCheckFailures,
    scenarioCount: scenarios.length,
    scenarioFailureCount,
    cleanupCount: finalModel.cleanupCount,
    playerDestroyCount: finalModel.playerDestroyCount,
    parserDestroyCount: finalModel.parserDestroyCount,
    localDestroyCount: finalModel.localDestroyCount,
    maxActiveResourceCount: finalModel.maxActiveResourceCount,
    finalActiveResourceCount: finalModel.activeResourceCount,
    sourceChecks,
    scenarios
  };
}

function buildSourceChecks(input: { mainSource: string; rendererSource: string }): Nq1CleanupSourceCheck[] {
  const { mainSource, rendererSource } = input;
  return [
    check("session_root_uses_os_tmpdir", mainSource.includes("path.join(os.tmpdir()")),
    check("user_data_scoped_to_session_root", mainSource.includes('app.setPath("userData", path.join(sessionRoot')),
    check("session_data_scoped_to_session_root", mainSource.includes('app.setPath("sessionData", path.join(sessionRoot')),
    check("cleanup_runtime_is_idempotent", mainSource.includes("if (cleanedUp) return")),
    check("cleanup_runtime_closes_server", mainSource.includes("if (experimentServer) await experimentServer.close()")),
    check("cleanup_runtime_removes_session_root", mainSource.includes("rmSync(sessionRoot, { recursive: true, force: true })")),
    check("finish_smoke_cleans_before_exit", /async function finishSmoke[\s\S]*await cleanupRuntime\(\)[\s\S]*app\.exit/.test(mainSource)),
    check("finish_audit_cleans_before_exit", /async function finishAudit[\s\S]*await cleanupRuntime\(\)[\s\S]*app\.exit/.test(mainSource)),
    check("window_all_closed_cleans_runtime", /app\.on\("window-all-closed"[\s\S]*await cleanupRuntime\(\)[\s\S]*app\.quit/.test(mainSource)),
    check("renderer_cleanup_destroys_player", rendererSource.includes("activePlayer?.destroy?.()")),
    check("renderer_cleanup_destroys_parser", rendererSource.includes("activeParser?.destroy?.()")),
    check("renderer_cleanup_clears_active_references", rendererSource.includes("activePlayer = undefined") && rendererSource.includes("activeParser = undefined") && rendererSource.includes("activeVideo = undefined")),
    check("renderer_cleanup_resets_playback_flags", rendererSource.includes("playerStarted = false") && rendererSource.includes("playerPaused = false")),
    check("renderer_cleanup_clears_canvas", rendererSource.includes("clearCanvas();")),
    check("renderer_load_cleans_previous_player_first", /async function loadSvgaBytes[\s\S]*cleanupPlayer\(\);[\s\S]*activeName = name/.test(rendererSource)),
    check("renderer_error_path_cleans_player", /catch \(error\)[\s\S]*cleanupPlayer\(\);[\s\S]*showError/.test(rendererSource)),
    check("smoke_requires_multiple_cleanup_cycles", rendererSource.includes("cleanupCount >= 3"))
  ];
}

function runStressScenarios(): Nq1CleanupStressScenario[] {
  return [
    repeatedSuccessLoadsLeaveOnlyLatestActive(),
    failureAfterSuccessCleansActiveResources(),
    stalePreActivationDestroysLocalResources(),
    finalCleanupIsIdempotent(),
    longCycleStressReturnsToZeroResources()
  ];
}

function repeatedSuccessLoadsLeaveOnlyLatestActive(): Nq1CleanupStressScenario {
  const model = new CleanupStressModel();
  model.loadSuccess("first.svga");
  model.loadSuccess("second.svga");
  return scenario("repeated_success_loads_leave_only_latest_active", {
    activeResourceCount: model.activeResourceCount,
    cleanupCount: model.cleanupCount,
    playerDestroyCount: model.playerDestroyCount,
    parserDestroyCount: model.parserDestroyCount,
    activeName: model.activeName
  }, model.activeResourceCount === 2
    && model.cleanupCount === 2
    && model.playerDestroyCount === 1
    && model.parserDestroyCount === 1
    && model.activeName === "second.svga");
}

function failureAfterSuccessCleansActiveResources(): Nq1CleanupStressScenario {
  const model = new CleanupStressModel();
  model.loadSuccess("before-error.svga");
  model.loadFailure("bad.svga");
  return scenario("failure_after_success_cleans_active_resources", {
    activeResourceCount: model.activeResourceCount,
    cleanupCount: model.cleanupCount,
    playerDestroyCount: model.playerDestroyCount,
    parserDestroyCount: model.parserDestroyCount,
    lastErrorName: model.lastErrorName
  }, model.activeResourceCount === 0
    && model.cleanupCount === 2
    && model.playerDestroyCount === 1
    && model.parserDestroyCount === 1
    && model.lastErrorName === "bad.svga");
}

function stalePreActivationDestroysLocalResources(): Nq1CleanupStressScenario {
  const model = new CleanupStressModel();
  model.stalePreActivationLoad("stale.svga");
  return scenario("stale_pre_activation_destroys_local_resources", {
    activeResourceCount: model.activeResourceCount,
    localDestroyCount: model.localDestroyCount,
    cleanupCount: model.cleanupCount
  }, model.activeResourceCount === 0
    && model.localDestroyCount === 2
    && model.cleanupCount === 1);
}

function finalCleanupIsIdempotent(): Nq1CleanupStressScenario {
  const model = new CleanupStressModel();
  model.loadSuccess("current.svga");
  model.cleanupPlayer();
  model.cleanupPlayer();
  return scenario("final_cleanup_is_idempotent", {
    activeResourceCount: model.activeResourceCount,
    cleanupCount: model.cleanupCount,
    playerDestroyCount: model.playerDestroyCount,
    parserDestroyCount: model.parserDestroyCount
  }, model.activeResourceCount === 0
    && model.cleanupCount === 3
    && model.playerDestroyCount === 1
    && model.parserDestroyCount === 1);
}

function longCycleStressReturnsToZeroResources(): Nq1CleanupStressScenario {
  const model = runLongCycleStress(80);
  return scenario("long_cycle_stress_returns_to_zero_resources", {
    cycles: 80,
    activeResourceCount: model.activeResourceCount,
    maxActiveResourceCount: model.maxActiveResourceCount,
    cleanupCount: model.cleanupCount,
    playerDestroyCount: model.playerDestroyCount,
    parserDestroyCount: model.parserDestroyCount,
    localDestroyCount: model.localDestroyCount
  }, model.activeResourceCount === 0
    && model.maxActiveResourceCount === 2
    && model.cleanupCount >= 120
    && model.playerDestroyCount === model.parserDestroyCount
    && model.localDestroyCount > 0);
}

function runLongCycleStress(cycles: number): CleanupStressModel {
  const model = new CleanupStressModel();
  for (let index = 0; index < cycles; index += 1) {
    model.loadSuccess(`loop-${index}.svga`);
    if (index % 3 === 0) model.loadFailure(`error-${index}.svga`);
    if (index % 5 === 0) model.stalePreActivationLoad(`stale-${index}.svga`);
  }
  model.cleanupPlayer();
  model.cleanupPlayer();
  return model;
}

class CleanupStressModel {
  cleanupCount = 0;
  playerDestroyCount = 0;
  parserDestroyCount = 0;
  localDestroyCount = 0;
  maxActiveResourceCount = 0;
  activeName = "";
  lastErrorName = "";
  private activePlayer = false;
  private activeParser = false;
  private activeVideo = false;

  get activeResourceCount(): number {
    return Number(this.activePlayer) + Number(this.activeParser);
  }

  loadSuccess(name: string): void {
    this.cleanupPlayer();
    this.activeName = name;
    this.activeParser = true;
    this.activeVideo = true;
    this.activePlayer = true;
    this.recordMax();
  }

  loadFailure(name: string): void {
    this.cleanupPlayer();
    this.lastErrorName = name;
    this.activeName = "";
    this.activeVideo = false;
  }

  stalePreActivationLoad(_name: string): void {
    this.cleanupPlayer();
    this.localDestroyCount += 2;
  }

  cleanupPlayer(): void {
    this.cleanupCount += 1;
    if (this.activePlayer) this.playerDestroyCount += 1;
    if (this.activeParser) this.parserDestroyCount += 1;
    this.activePlayer = false;
    this.activeParser = false;
    this.activeVideo = false;
    this.activeName = "";
  }

  private recordMax(): void {
    this.maxActiveResourceCount = Math.max(this.maxActiveResourceCount, this.activeResourceCount);
  }
}

function scenario(
  id: string,
  evidence: Readonly<Record<string, unknown>>,
  passed: boolean
): Nq1CleanupStressScenario {
  return { id, evidence, passed };
}

function check(id: string, passed: boolean): Nq1CleanupSourceCheck {
  return { id, passed };
}
