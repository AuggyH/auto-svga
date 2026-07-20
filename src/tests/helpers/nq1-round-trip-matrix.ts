import { createHash } from "node:crypto";
import {
  NodeProtobufSvgaInspector,
  SvgaImageEditError,
  SvgaImageResourceEditor
} from "../../workbench/svga/index.js";
import {
  createTransparentImage,
  encodeRgbaPng,
  setPixel
} from "../../utils/png-writer.js";
import {
  createNq1SvgaFixture,
  NQ1_FIXTURE_MATRIX_CASES
} from "./nq1-svga-fixture.js";

export interface Nq1RoundTripMatrixReport {
  schemaVersion: 1;
  milestoneId: "NQ1";
  reportId: "multi-resource-round-trip-matrix";
  passed: boolean;
  supportedFixtureCount: number;
  unsupportedFixtureCount: number;
  replacementAttemptCount: number;
  failClosedCount: number;
  rows: readonly Nq1RoundTripMatrixRow[];
}

export interface Nq1RoundTripMatrixRow {
  fixtureId: string;
  resourceCount: number;
  replacementCount: number;
  milestoneId: "P3" | "P4" | "unsupported";
  passed: boolean;
  sourceUnchanged: boolean;
  replacedHashesMatch: boolean;
  untouchedHashesMatch: boolean;
  failClosedReason?: string;
  replacedResourceKeys: readonly string[];
  unchangedResourceKeys: readonly string[];
}

export async function runNq1RoundTripMatrixValidation(): Promise<Nq1RoundTripMatrixReport> {
  const editor = new SvgaImageResourceEditor();
  const rows: Nq1RoundTripMatrixRow[] = [];

  for (const config of NQ1_FIXTURE_MATRIX_CASES) {
    const fixture = await createNq1SvgaFixture(config);
    if (!fixture.expectedSupported) {
      rows.push(await runUnsupportedCase(editor, fixture.fixtureId, fixture.resourceCount, fixture.bytes));
      continue;
    }
    rows.push(await runSupportedCase(editor, fixture));
  }

  const supportedRows = rows.filter((row) => row.milestoneId !== "unsupported");
  const unsupportedRows = rows.filter((row) => row.milestoneId === "unsupported");
  const passed = rows.every((row) => row.passed);

  return {
    schemaVersion: 1,
    milestoneId: "NQ1",
    reportId: "multi-resource-round-trip-matrix",
    passed,
    supportedFixtureCount: supportedRows.length,
    unsupportedFixtureCount: unsupportedRows.length,
    replacementAttemptCount: supportedRows.reduce((total, row) => total + row.replacementCount, 0),
    failClosedCount: unsupportedRows.filter((row) => row.failClosedReason).length,
    rows
  };
}

async function runSupportedCase(
  editor: SvgaImageResourceEditor,
  fixture: Awaited<ReturnType<typeof createNq1SvgaFixture>>
): Promise<Nq1RoundTripMatrixRow> {
  const sourceSha256 = sha256(fixture.bytes);
  const replacementKeys = selectedReplacementKeys(fixture.resourceKeys);
  const milestoneId = replacementKeys.length === 1 ? "P3" : "P4";
  const replacements = replacementKeys.map((resourceKey, index) => ({
    resourceKey,
    pngBytes: createReplacementPng(fixture.fixtureId, index)
  }));
  const result = await editor.replaceImages(fixture.bytes, replacements, `${fixture.fixtureId}.svga`, {
    milestoneId
  });
  const inspected = await new NodeProtobufSvgaInspector().inspect(result.editedBytes);
  const exportedHashes = Object.fromEntries(
    inspected.images.map(({ imageKey, bytes }) => [imageKey, sha256(bytes)])
  );
  const replacementHashes = Object.fromEntries(
    replacements.map(({ resourceKey, pngBytes }) => [resourceKey, sha256(pngBytes)])
  );
  const unchangedResourceKeys = fixture.resourceKeys.filter((key) => !replacementKeys.includes(key));
  const sourceUnchanged = sha256(fixture.bytes) === sourceSha256;
  const replacedHashesMatch = replacementKeys.every((key) => exportedHashes[key] === replacementHashes[key]);
  const untouchedHashesMatch = unchangedResourceKeys.every((key) => exportedHashes[key] === fixture.resourceHashes[key]);
  const reportPassed = result.roundTripReport.passed === (milestoneId === "P4")
    || (milestoneId === "P3" && result.roundTripReport.passed === true);
  return {
    fixtureId: fixture.fixtureId,
    resourceCount: fixture.resourceCount,
    replacementCount: replacementKeys.length,
    milestoneId,
    passed: sourceUnchanged
      && replacedHashesMatch
      && untouchedHashesMatch
      && reportPassed
      && result.session.imageResources.filter(({ replacementStatus }) => replacementStatus === "replaced").length === replacementKeys.length,
    sourceUnchanged,
    replacedHashesMatch,
    untouchedHashesMatch,
    replacedResourceKeys: replacementKeys,
    unchangedResourceKeys
  };
}

async function runUnsupportedCase(
  editor: SvgaImageResourceEditor,
  fixtureId: string,
  resourceCount: number,
  bytes: Uint8Array
): Promise<Nq1RoundTripMatrixRow> {
  let failClosedReason = "";
  try {
    await editor.createSession(bytes, `${fixtureId}.svga`);
  } catch (error) {
    if (error instanceof SvgaImageEditError) {
      failClosedReason = error.code;
    } else {
      throw error;
    }
  }
  return {
    fixtureId,
    resourceCount,
    replacementCount: 0,
    milestoneId: "unsupported",
    passed: failClosedReason === "unsupported_round_trip_file",
    sourceUnchanged: true,
    replacedHashesMatch: true,
    untouchedHashesMatch: true,
    failClosedReason,
    replacedResourceKeys: [],
    unchangedResourceKeys: []
  };
}

function selectedReplacementKeys(resourceKeys: readonly string[]): readonly string[] {
  if (resourceKeys.length === 1) return [resourceKeys[0]];
  const candidates = [
    resourceKeys[0],
    resourceKeys[1],
    resourceKeys.at(-1)
  ].filter((value): value is string => Boolean(value));
  return [...new Set(candidates)].slice(0, Math.min(3, resourceKeys.length));
}

function createReplacementPng(fixtureId: string, index: number): Uint8Array {
  const width = 14 + index * 5;
  const height = 16 + index * 7;
  const image = createTransparentImage(width, height);
  const seed = [...fixtureId].reduce((total, char) => total + char.charCodeAt(0), 0) + index * 31;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(image, x, y, [
        (seed + x * 3) % 256,
        (seed + y * 5) % 256,
        (seed + x + y) % 256,
        255
      ]);
    }
  }
  return encodeRgbaPng(image);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
