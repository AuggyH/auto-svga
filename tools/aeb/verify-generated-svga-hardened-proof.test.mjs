import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  validateGeneratedSvgaHardenedProof,
  verifyGeneratedSvgaHardenedProofFile,
} from "./verify-generated-svga-hardened-proof.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const proofPath = path.resolve(
  here,
  "fixtures/generated-svga-hardened-proof.fixture.json",
);
const proofBytes = fs.readFileSync(proofPath);
const accepted = JSON.parse(proofBytes.toString("utf8"));
const clone = () => structuredClone(accepted);

test("accepts the exact hardened generated-SVGA proof", () => {
  const result = verifyGeneratedSvgaHardenedProofFile(proofPath);
  assert.equal(result.status, "pass");
  assert.deepEqual(result.errors, []);
  assert.equal(result.proofSha256, "2c03459c773176947a590fc518721dd1222916a15f37c1b451230fa0349a853a");
});

const mutations = [
  ["player cleanup", (proof) => { proof.core.renderer.cleanup.playerAfterDestroy.videoItemNull = false; }, "player_video_item_destroyed"],
  ["parser cleanup", (proof) => { proof.core.renderer.cleanup.parserAfterDestroy.workerNull = false; }, "parser_worker_destroyed"],
  ["decoded canvas", (proof) => { proof.core.renderer.mountState.decodedVideoWidth = 256; }, "decoded_canvas_width"],
  ["listener cleanup", (proof) => { proof.core.sessionCleanup.listenerSilentAfterRemoval = false; }, "listener_silent_after_removal"],
  ["vendor copy drift", (proof) => { proof.core.bindings.vendor.executedCopyPostSha256 = "0".repeat(64); }, "vendor_executedCopyPostSha256"],
  ["source head drift", (proof) => { proof.core.bindings.sources.post.player.head = "0".repeat(40); }, "source_post_player_head"],
  ["lineage drift", (proof) => { proof.core.bindings.lineage.post.hashes.asset = "0".repeat(64); }, "lineage_post_asset"],
  ["serialized path leak", (proof) => { proof.leakedPath = "/Users/operator/private-output"; }, "serialized_path_redaction"],
];

for (const [name, mutate, expectedError] of mutations) {
  test(`rejects ${name}`, () => {
    const proof = clone();
    mutate(proof);
    const result = validateGeneratedSvgaHardenedProof(proof);
    assert.equal(result.status, "fail");
    assert.ok(result.errors.includes(expectedError));
  });
}

test("rejects a runner binding mismatch", () => {
  const proof = clone();
  proof.bindings.runner.postSha256 = "0".repeat(64);
  const result = validateGeneratedSvgaHardenedProof(proof);
  assert.equal(result.status, "fail");
  assert.ok(result.errors.includes("runner_post_hash"));
});

test("rejects generated SVGA identity drift", () => {
  const proof = clone();
  proof.core.bindings.input.postSha256 = "0".repeat(64);
  const result = validateGeneratedSvgaHardenedProof(proof);
  assert.equal(result.status, "fail");
  assert.ok(result.errors.includes("generated_svga_post_hash"));
});

test("rejects a narrowed mutation-evidence set", () => {
  const proof = clone();
  proof.failureFirst.cases.pop();
  proof.failureFirst.rejectedCount = 7;
  const result = validateGeneratedSvgaHardenedProof(proof);
  assert.equal(result.status, "fail");
  assert.ok(result.errors.includes("failure_first_count"));
  assert.ok(result.errors.includes("failure_first_issue_set"));
});

test("rejects a support or release boundary overclaim", () => {
  const proof = clone();
  proof.boundaries.externalNetworkUsed = true;
  const result = validateGeneratedSvgaHardenedProof(proof);
  assert.equal(result.status, "fail");
  assert.ok(result.errors.includes("boundary_external_network"));
});
