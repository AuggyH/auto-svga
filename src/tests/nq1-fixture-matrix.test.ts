import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import test from "node:test";
import {
  createNq1SvgaFixture,
  fixtureManifestRows,
  NQ1_FIXTURE_MATRIX_CASES,
  nq1FixtureGeneratorVersion
} from "./helpers/nq1-svga-fixture.js";
import {
  NodeProtobufSvgaInspector,
  SvgaImageEditError,
  SvgaImageResourceEditor
} from "../workbench/svga/index.js";

test("NQ1 fixture matrix manifest matches the committed generator contract", async () => {
  const manifest = JSON.parse(await readFile("fixtures/generated/nq1/fixture-matrix.manifest.json", "utf8"));

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.sourceGeneratorVersion, nq1FixtureGeneratorVersion);
  assert.deepEqual(manifest.resourceCounts, [1, 2, 3, 5, 10, 25]);
  assert.deepEqual(
    manifest.cases.map((entry: { fixtureId: string }) => entry.fixtureId),
    NQ1_FIXTURE_MATRIX_CASES.map(({ fixtureId }) => fixtureId)
  );
  assert.ok(manifest.features.includes("unicode_resource_key"));
  assert.ok(manifest.features.includes("matte_key_reference"));
  assert.ok(manifest.features.includes("unsupported_unknown_field_boundary"));
});

test("NQ1 fixture generation is deterministic by seed and config", async () => {
  const first = await createNq1SvgaFixture(NQ1_FIXTURE_MATRIX_CASES[3]);
  const second = await createNq1SvgaFixture(NQ1_FIXTURE_MATRIX_CASES[3]);
  const different = await createNq1SvgaFixture({
    ...NQ1_FIXTURE_MATRIX_CASES[3],
    seed: NQ1_FIXTURE_MATRIX_CASES[3].seed + 1
  });

  assert.equal(first.generatedSha256, second.generatedSha256);
  assert.notEqual(first.generatedSha256, different.generatedSha256);
  assert.deepEqual(first.resourceHashes, second.resourceHashes);
});

test("NQ1 supported fixtures inflate, decode, and expose expected editor resources", async () => {
  const editor = new SvgaImageResourceEditor();
  const inspector = new NodeProtobufSvgaInspector();

  for (const config of NQ1_FIXTURE_MATRIX_CASES.filter(({ expectedSupported }) => expectedSupported)) {
    const fixture = await createNq1SvgaFixture(config);
    assert.doesNotThrow(() => inflateSync(fixture.bytes), `${fixture.fixtureId} must inflate`);

    const inspected = await inspector.inspect(fixture.bytes);
    const session = await editor.createSession(fixture.bytes, `${fixture.fixtureId}.svga`);

    assert.equal(inspected.images.length, config.resourceCount, fixture.fixtureId);
    assert.equal(session.imageResources.length, config.resourceCount, fixture.fixtureId);
    assert.deepEqual(session.imageResources.map(({ resourceKey }) => resourceKey), fixture.resourceKeys);
    assert.equal(session.parsedMovie.spriteCount, fixture.spriteCount);
    assert.equal(session.parsedMovie.frames, fixture.frameCount);
  }
});

test("NQ1 unsupported boundary fixture fails closed in the editor", async () => {
  const unsupportedConfig = NQ1_FIXTURE_MATRIX_CASES.find(({ expectedSupported }) => !expectedSupported);
  assert.ok(unsupportedConfig);

  const fixture = await createNq1SvgaFixture(unsupportedConfig);
  assert.doesNotThrow(() => inflateSync(fixture.bytes));

  const editor = new SvgaImageResourceEditor();
  await assert.rejects(
    editor.createSession(fixture.bytes, `${fixture.fixtureId}.svga`),
    (error) => error instanceof SvgaImageEditError
      && error.code === "unsupported_round_trip_file"
  );
});

test("NQ1 fixture matrix rows are report-safe and do not share mutable state", async () => {
  const fixtures = await Promise.all(NQ1_FIXTURE_MATRIX_CASES.map(createNq1SvgaFixture));
  const rows = fixtureManifestRows(fixtures);
  const mutated = fixtures[0].bytes.slice();
  mutated[0] = 0;
  const regenerated = await createNq1SvgaFixture(NQ1_FIXTURE_MATRIX_CASES[0]);

  assert.equal(regenerated.generatedSha256, fixtures[0].generatedSha256);
  assert.notEqual(mutated[0], fixtures[0].bytes[0]);
  assert.equal(rows.length, NQ1_FIXTURE_MATRIX_CASES.length);
  assert.ok(rows.every((row) => typeof row.generatedSha256 === "string"));
  assert.ok(JSON.stringify(rows).includes("img_动画_02"));
  assert.ok(!JSON.stringify(rows).includes("/" + "Users/"));
});
