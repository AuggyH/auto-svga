import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const artifactRoot = path.join(repoRoot, ".artifacts/product/NQ1");
const fixtureOutputRoot = path.join(artifactRoot, "fixtures");
const helperUrl = pathToFileURL(path.join(repoRoot, "dist/tests/helpers/nq1-svga-fixture.js")).href;
const {
  createNq1SvgaFixture,
  fixtureManifestRows,
  NQ1_FIXTURE_MATRIX_CASES
} = await import(helperUrl);

await mkdir(fixtureOutputRoot, { recursive: true });

const fixtures = [];
for (const config of NQ1_FIXTURE_MATRIX_CASES) {
  const fixture = await createNq1SvgaFixture(config);
  const fileName = `${fixture.fixtureId}.svga`;
  await writeFile(path.join(fixtureOutputRoot, fileName), fixture.bytes);
  fixtures.push({
    ...fixture,
    generatedPath: `.artifacts/product/NQ1/fixtures/${fileName}`
  });
}

const report = {
  schemaVersion: 1,
  milestoneId: "NQ1",
  reportId: "fixture-matrix",
  generatedAt: new Date().toISOString(),
  fixtureCount: fixtures.length,
  supportedFixtureCount: fixtures.filter(({ expectedSupported }) => expectedSupported).length,
  unsupportedFixtureCount: fixtures.filter(({ expectedSupported }) => !expectedSupported).length,
  resourceCounts: [...new Set(fixtures.filter(({ expectedSupported }) => expectedSupported).map(({ resourceCount }) => resourceCount))],
  fixtures: fixtureManifestRows(fixtures).map((row, index) => ({
    ...row,
    generatedPath: fixtures[index].generatedPath
  })),
  sourceGeneratorVersion: fixtures[0]?.sourceGeneratorVersion ?? "unknown"
};

await writeFile(path.join(artifactRoot, "fixture-matrix.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  reportPath: ".artifacts/product/NQ1/fixture-matrix.json",
  fixtureCount: report.fixtureCount,
  supportedFixtureCount: report.supportedFixtureCount,
  unsupportedFixtureCount: report.unsupportedFixtureCount
}));
