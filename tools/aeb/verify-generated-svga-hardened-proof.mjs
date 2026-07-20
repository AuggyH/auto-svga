import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED = Object.freeze({
  proofSha256: "2c03459c773176947a590fc518721dd1222916a15f37c1b451230fa0349a853a",
  coreProofSha256: "56f813856c672562929ba0a2a762d8951dd5d62296f91e78a7bbfc7e5c06e001",
  harnessSha256: "687544e1c3d97ec08551bc1d12545799712e50d2ef4ccb03d5c91085d8c2e4f6",
  runnerSha256: "c141039c380192d4db84485bc462a6b329a7c54d584fbf4509d7dc518e48b1c8",
  electronSha256: "c0bf182389ea930585e3b0bf5c4f16529461e02bf3be751cb364d0e25f2257e0",
  electronVersion: "42.4.1",
  vendorSha256: "6235bc9802e76dd517343123ec730d25e02c4d476b66b81ef26befe7881f3c50",
  generatedSvgaSha256: "375f557a0e242df4dfec59004c0479f7cca205d17694ab96cb148eac41f5d9fd",
  generatedSvgaBytes: 823,
  playerHead: "59f4001230a7f2834f3374034fa1e0cf5da83e14",
  aebCheckpoint: "dcabbbce9a35dc3dba182da86ae2016950bfb76a",
  pmExecutionHead: "abf59ef372996c3c4064c226341f410058039ac2",
  projectSha256: "bf3ba0fec9d0284a4f85e9f6ada83f33553974c03404e4655596a587bd078a96",
  mapSha256: "64393540a756c8eace1c271ba81d2edffc91b23fcfb20ec19435f21a3bc34e75",
  assetSha256: "b7970b1a9c9a313e9b9f912411dacfe61d6e196c102918f4c77f49883da06936",
  encodeReportSha256: "d97e116b290c575862358202e1c6c41fc7b710a5d43330047128a564bffea679",
  frame0Sha256: "ee60aed6580f70206cc3555392ac32d8f0af320a21e3fce09ef9b78c31cdfebb",
  frame119Sha256: "e98faca0b28e4bd7059eb5ce68a7c8c31c91cd633a440d9a3f2f25734e3b1cef",
  directCropSha256: "797db0768e7197e4048d18ccb4b52804f027279085f98cf96ab54a2ab2dc2dcb",
  playing1Sha256: "7a12b764a6f8f1cab546924268f6e7d77d06a4307128f75a96c90de1df27ca60",
  playing2Sha256: "3285488e0bd732d89137f19b58368f8bf85fa58c3351eaeb740b87b0f5471bfc",
  playing2CropSha256: "3d7fa292aab01ceca18af8b68bd5b1ec08e787283c4fe81bd4bff6a88c7dc6eb",
});

const EXPECTED_MUTATION_ISSUES = [
  "player_cleanup",
  "parser_cleanup",
  "decoded_canvas",
  "listener_cleanup",
  "vendor_copy_drift",
  "source_head_drift",
  "lineage_drift",
  "serialized_path_redaction",
];

const EXPECTED_CORE_GATES = [
  "harnessStable",
  "inputStable",
  "vendorOriginalStable",
  "vendorCopyStable",
  "sourceBindingsStable",
  "lineageStable",
  "stageLineageReconciled",
  "realSvgaWebRuntime",
  "expectedVideoContract",
  "decodedCanvasBound",
  "directFramesDiffer",
  "xMotionTwenty",
  "yStable",
  "alphaStable",
  "cropStable",
  "playbackAdvanced",
  "pausedStable",
  "playerDestroyed",
  "parserDestroyed",
  "listenerDetached",
  "windowDestroyed",
  "noExternalRequests",
  "serializedCoreRedacted",
];

const EXPECTED_FINAL_GATES = [
  "coreAccepted",
  "scriptsStable",
  "electronRuntimeStable",
  "electronExitedNormally",
  "processCleanupObserved",
  "failureFirstMutationsRejected",
  "serializedProofRedacted",
];

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function stableCoreBytes(core) {
  return Buffer.from(`${JSON.stringify(core, null, 2)}\n`, "utf8");
}

function get(object, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => value?.[key], object);
}

function sameBoundsExceptX(start, end) {
  return (
    start.minY === end.minY &&
    start.maxY === end.maxY &&
    start.width === end.width &&
    start.height === end.height
  );
}

export function validateGeneratedSvgaHardenedProof(proof, options = {}) {
  const errors = [];
  const check = (code, condition) => {
    if (!condition) errors.push(code);
  };
  const exact = (code, actual, expected) => check(code, actual === expected);
  const core = proof?.core;
  const renderer = core?.renderer;
  const frame0 = renderer?.frame0 ?? {};
  const frame119 = renderer?.frame119 ?? {};
  const playing1 = renderer?.playing1 ?? {};
  const playing2 = renderer?.playing2 ?? {};
  const paused1 = renderer?.paused1 ?? {};
  const paused2 = renderer?.paused2 ?? {};

  exact("schema_version", proof?.schemaVersion, "aeb-generated-svga-hardened-proof-v1");
  exact("status", proof?.status, "passed");

  for (const [name, expected] of [
    ["runner", EXPECTED.runnerSha256],
    ["harness", EXPECTED.harnessSha256],
  ]) {
    exact(`${name}_pre_hash`, get(proof, `bindings.${name}.preSha256`), expected);
    exact(`${name}_post_hash`, get(proof, `bindings.${name}.postSha256`), expected);
  }
  exact("electron_version", get(proof, "bindings.electron.version"), EXPECTED.electronVersion);
  exact("electron_pre_hash", get(proof, "bindings.electron.preSha256"), EXPECTED.electronSha256);
  exact("electron_post_hash", get(proof, "bindings.electron.postSha256"), EXPECTED.electronSha256);
  exact("core_schema", core?.schemaVersion, "aeb-generated-svga-hardened-core-v1");
  exact("core_status", core?.status, "passed");
  exact("core_hash_binding", proof?.bindings?.coreProofSha256, EXPECTED.coreProofSha256);
  exact("core_hash_recomputed", sha256(stableCoreBytes(core)), EXPECTED.coreProofSha256);

  exact("generated_svga_alias", get(core, "bindings.input.alias"), "AEB-GENERATED-SVGA-057");
  exact("generated_svga_pre_hash", get(core, "bindings.input.preSha256"), EXPECTED.generatedSvgaSha256);
  exact("generated_svga_post_hash", get(core, "bindings.input.postSha256"), EXPECTED.generatedSvgaSha256);
  exact("generated_svga_size", get(core, "bindings.input.sizeBytes"), EXPECTED.generatedSvgaBytes);

  for (const key of [
    "originalPreSha256",
    "originalPostSha256",
    "executedCopyPreSha256",
    "executedCopyPostSha256",
  ]) {
    exact(`vendor_${key}`, get(core, `bindings.vendor.${key}`), EXPECTED.vendorSha256);
  }
  exact("vendor_identity", get(core, "bindings.vendor.identity"), "svga-web-2.4.4");

  for (const phase of ["pre", "post"]) {
    for (const [name, expectedHead] of [
      ["player", EXPECTED.playerHead],
      ["aeb", EXPECTED.aebCheckpoint],
      ["pm", EXPECTED.pmExecutionHead],
    ]) {
      exact(`source_${phase}_${name}_head`, get(core, `bindings.sources.${phase}.${name}.head`), expectedHead);
      exact(`source_${phase}_${name}_clean`, get(core, `bindings.sources.${phase}.${name}.trackedClean`), true);
    }
  }

  const expectedLineageHashes = {
    project: EXPECTED.projectSha256,
    map: EXPECTED.mapSha256,
    asset: EXPECTED.assetSha256,
    encodeReport: EXPECTED.encodeReportSha256,
  };
  for (const phase of ["pre", "post"]) {
    for (const [name, expectedHash] of Object.entries(expectedLineageHashes)) {
      exact(`lineage_${phase}_${name}`, get(core, `bindings.lineage.${phase}.hashes.${name}`), expectedHash);
    }
    exact(`lineage_${phase}_reconciled`, get(core, `bindings.lineage.${phase}.reconciled`), true);
    exact(`lineage_${phase}_exact_hashes`, get(core, `bindings.lineage.${phase}.exactHashes`), true);
    exact(
      `lineage_${phase}_stage_transition`,
      get(core, `bindings.lineage.${phase}.stageTransition`),
      "project-draft-stub_to_wp5ap-encoded",
    );
    exact(`lineage_${phase}_encode_status`, get(core, `bindings.lineage.${phase}.contract.encodeReportStatus`), "pass");
    exact(`lineage_${phase}_binary_encoded`, get(core, `bindings.lineage.${phase}.contract.binaryEncoded`), true);
    exact(`lineage_${phase}_binary_decoded`, get(core, `bindings.lineage.${phase}.contract.binaryDecoded`), true);
    exact(`lineage_${phase}_binary_size`, get(core, `bindings.lineage.${phase}.contract.binarySizeBytes`), 823);
  }

  exact("video_frames", renderer?.video?.frames, 120);
  exact("video_fps", renderer?.video?.fps, 24);
  exact("video_image_count", renderer?.video?.imageCount, 1);
  exact("video_sprite_count", renderer?.video?.spriteCount, 1);
  exact("video_width", renderer?.video?.videoSize?.width, 300);
  exact("video_height", renderer?.video?.videoSize?.height, 300);
  exact("mounted_canvas_width", renderer?.mountState?.canvasWidth, 300);
  exact("mounted_canvas_height", renderer?.mountState?.canvasHeight, 300);
  exact("decoded_canvas_width", renderer?.mountState?.decodedVideoWidth, 300);
  exact("decoded_canvas_height", renderer?.mountState?.decodedVideoHeight, 300);
  exact("mounted_player_present", renderer?.mountState?.playerVideoItemPresent, true);
  exact("mounted_parser_worker_present", renderer?.mountState?.parserWorkerPresent, true);
  for (const capability of ["parse", "mount", "start", "pause", "playerDestroy", "parserDestroy", "drawFrame"]) {
    exact(`runtime_capability_${capability}`, renderer?.runtime?.capabilities?.[capability], true);
  }

  exact("frame0_index", frame0.frame, 0);
  exact("frame119_index", frame119.frame, 119);
  exact("frame0_hash", frame0.sha256, EXPECTED.frame0Sha256);
  exact("frame119_hash", frame119.sha256, EXPECTED.frame119Sha256);
  exact("frame0_crop_hash", frame0.cropSha256, EXPECTED.directCropSha256);
  exact("frame119_crop_hash", frame119.cropSha256, EXPECTED.directCropSha256);
  exact("frame0_min_x", frame0.bounds?.minX, 90);
  exact("frame0_min_y", frame0.bounds?.minY, 110);
  exact("frame0_max_x", frame0.bounds?.maxX, 209);
  exact("frame0_max_y", frame0.bounds?.maxY, 189);
  exact("frame119_min_x", frame119.bounds?.minX, 110);
  exact("frame119_min_y", frame119.bounds?.minY, 110);
  exact("frame119_max_x", frame119.bounds?.maxX, 229);
  exact("frame119_max_y", frame119.bounds?.maxY, 189);
  exact("frame0_alpha_count", frame0.alphaPixelCount, 9600);
  exact("frame119_alpha_count", frame119.alphaPixelCount, 9600);
  exact("frame0_alpha_sum", frame0.alphaSum, 2448000);
  exact("frame119_alpha_sum", frame119.alphaSum, 2448000);
  check("direct_frame_pixels_distinct", frame0.sha256 !== frame119.sha256);
  exact("direct_crop_stable", frame119.cropSha256, frame0.cropSha256);
  exact("direct_x_motion", frame119.bounds?.minX - frame0.bounds?.minX, 20);
  check("direct_geometry_stable", sameBoundsExceptX(frame0.bounds ?? {}, frame119.bounds ?? {}));
  exact("direct_alpha_count_stable", frame119.alphaPixelCount, frame0.alphaPixelCount);
  exact("direct_alpha_sum_stable", frame119.alphaSum, frame0.alphaSum);

  exact("playing1_frame", playing1.frame, 11);
  exact("playing2_frame", playing2.frame, 22);
  exact("playing1_hash", playing1.sha256, EXPECTED.playing1Sha256);
  exact("playing2_hash", playing2.sha256, EXPECTED.playing2Sha256);
  check("playback_frame_advanced", playing2.frame > playing1.frame);
  check("playback_pixels_changed", playing1.sha256 !== playing2.sha256);
  exact("paused1_frame", paused1.frame, 22);
  exact("paused2_frame", paused2.frame, 22);
  exact("paused1_hash", paused1.sha256, EXPECTED.playing2Sha256);
  exact("paused2_hash", paused2.sha256, EXPECTED.playing2Sha256);
  exact("paused1_crop_hash", paused1.cropSha256, EXPECTED.playing2CropSha256);
  exact("paused2_crop_hash", paused2.cropSha256, EXPECTED.playing2CropSha256);
  exact("pause_frame_stable", paused2.frame, paused1.frame);
  exact("pause_pixels_stable", paused2.sha256, paused1.sha256);
  exact("pause_crop_stable", paused2.cropSha256, paused1.cropSha256);

  exact("player_video_item_destroyed", renderer?.cleanup?.playerAfterDestroy?.videoItemNull, true);
  exact("player_frame_reset", renderer?.cleanup?.playerAfterDestroy?.currentFrameZero, true);
  exact("parser_worker_destroyed", renderer?.cleanup?.parserAfterDestroy?.workerNull, true);
  exact("listener_registered", core?.sessionCleanup?.listenerRegistered, true);
  exact("listener_removal_returned", core?.sessionCleanup?.listenerRemovalCallReturned, true);
  exact("listener_observation_before", core?.sessionCleanup?.listenerObservationCountBeforeRemoval, 2);
  exact("listener_observation_after", core?.sessionCleanup?.listenerObservationCountAfterRemoval, 2);
  exact(
    "listener_observation_stable",
    core?.sessionCleanup?.listenerObservationCountAfterRemoval,
    core?.sessionCleanup?.listenerObservationCountBeforeRemoval,
  );
  exact("listener_silent_after_removal", core?.sessionCleanup?.listenerSilentAfterRemoval, true);
  exact("window_destroyed", core?.sessionCleanup?.windowDestroyed, true);
  exact("connections_closed", core?.sessionCleanup?.closeAllConnectionsReturned, true);
  exact("external_requests", core?.externalRequestCount, 0);

  for (const gate of EXPECTED_CORE_GATES) exact(`core_gate_${gate}`, core?.gates?.[gate], true);
  for (const gate of EXPECTED_FINAL_GATES) exact(`final_gate_${gate}`, proof?.gates?.[gate], true);

  exact("electron_exit_status", proof?.execution?.electronExitStatus, 0);
  exact("electron_exit_signal", proof?.execution?.electronSignal, null);
  exact("child_pid_absent", proof?.execution?.childPidAbsent, true);
  exact("tagged_process_residue", proof?.execution?.taggedProcessResidueCount, 0);
  exact("global_electron_residue", proof?.execution?.globalElectronProcessResidueCount, 0);
  exact("stderr_bytes", proof?.execution?.acceptedStderrBytes, 0);

  const mutationCases = proof?.failureFirst?.cases ?? [];
  exact("failure_first_passed", proof?.failureFirst?.passed, true);
  exact("failure_first_count", proof?.failureFirst?.rejectedCount, EXPECTED_MUTATION_ISSUES.length);
  check(
    "failure_first_issue_set",
    JSON.stringify(mutationCases.map(({ issue }) => issue)) === JSON.stringify(EXPECTED_MUTATION_ISSUES),
  );
  check("failure_first_all_rejected", mutationCases.every(({ rejected }) => rejected === true));

  for (const scope of [proof?.boundaries, core?.boundaries]) {
    exact("boundary_ae_launch", scope?.aeLaunched, false);
    exact("boundary_foreground", scope?.foregroundUsed, false);
    exact("boundary_installed_mutation", scope?.installedMutation, false);
    exact("boundary_source_mutation", scope?.sourceMutation, false);
    exact("boundary_external_network", scope?.externalNetworkUsed, false);
  }

  const serialized = JSON.stringify(proof);
  check(
    "serialized_path_redaction",
    !["/Users/", "/private/tmp/", "/var/folders/", "file:"].some((needle) => serialized.includes(needle)),
  );

  if (options.proofBytes) {
    exact("proof_file_hash", sha256(options.proofBytes), EXPECTED.proofSha256);
  }

  return {
    schemaVersion: "aeb-generated-svga-durable-proof-validation-v1",
    status: errors.length === 0 ? "pass" : "fail",
    errors,
    proofSha256: options.proofBytes ? sha256(options.proofBytes) : null,
    claim: "task_owned_generated_svga_real_player_evidence_only",
    supportClaimAllowed: false,
    productOwnerAcceptanceClaimed: false,
    releaseReadinessClaimed: false,
  };
}

export function verifyGeneratedSvgaHardenedProofFile(proofPath) {
  const proofBytes = fs.readFileSync(proofPath);
  const proof = JSON.parse(proofBytes.toString("utf8"));
  return validateGeneratedSvgaHardenedProof(proof, { proofBytes });
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error("Arguments must use --key value pairs");
    args[key.slice(2)] = value;
  }
  return args;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.proof) throw new Error("--proof is required");
    const result = verifyGeneratedSvgaHardenedProofFile(path.resolve(args.proof));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== "pass") process.exitCode = 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: "fail", errors: ["proof_read_or_parse_failed"] }, null, 2)}\n`);
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
