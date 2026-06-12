import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type {
  MotionAssetSource,
  MotionSpec,
  WorkbenchOperationContext
} from "../workbench/contracts.js";
import { MotionAssetInspectionService } from "../workbench/inspection-service.js";
import {
  SvgaFormatAdapter,
  SvgaMotionSpecChecker
} from "../workbench/svga/index.js";
import type {
  SvgaBinaryInspector,
  SvgaMovieInspection
} from "../workbench/svga/index.js";

test("inspection service returns the same MotionAssetInfo as direct SVGA adapter parsing", async () => {
  const bytes = Uint8Array.from([1, 2, 3, 4]);
  const adapter = new SvgaFormatAdapter(new FixtureSvgaInspector());
  const service = new MotionAssetInspectionService(adapter);
  const directResult = await adapter.parse(memorySource("fixture.svga", bytes));
  const serviceResult = await service.inspect(memorySource("fixture.svga", bytes));

  assert.deepEqual(serviceResult, directResult);
});

test("inspection service supports a host-provided local file source", async () => {
  const bytes = Uint8Array.from([5, 6, 7, 8]);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-inspection-service-"));
  const filePath = path.join(tempDir, "fixture.svga");

  try {
    await writeFile(filePath, bytes);
    const service = new MotionAssetInspectionService(
      new SvgaFormatAdapter(new FixtureSvgaInspector())
    );
    const result = await service.inspect(fileSource(filePath));

    assert.equal(result.issues.length, 0);
    assert.equal(result.value?.name, "fixture.svga");
    assert.equal(result.value?.sizeBytes, bytes.byteLength);
    assert.deepEqual(result.value?.dimensions, { width: 480, height: 96 });
    assert.equal(result.value?.resources.length, 2);
    assert.equal(result.value?.layers.length, 2);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("inspection service forwards operation context to the adapter", async () => {
  const source = memorySource("fixture.svga", Uint8Array.from([9]));
  const context: WorkbenchOperationContext = {};
  let receivedSource: MotionAssetSource | undefined;
  let receivedContext: WorkbenchOperationContext | undefined;
  const expected = { value: undefined, issues: [] };
  const service = new MotionAssetInspectionService({
    format: "svga",
    async probe() {
      return { format: "svga", confidence: 1, issues: [] };
    },
    async parse(input, operationContext) {
      receivedSource = input;
      receivedContext = operationContext;
      return expected;
    }
  });

  const result = await service.inspect(source, context);

  assert.equal(receivedSource, source);
  assert.equal(receivedContext, context);
  assert.equal(result, expected);
});

test("inspection service returns a passing specification report", async () => {
  const service = serviceWithFixtureAdapter();
  const result = await service.inspectWithSpec(
    memorySource("fixture.svga", Uint8Array.from([1, 2, 3, 4])),
    spec(),
    new SvgaMotionSpecChecker()
  );

  assert.equal(result.issues.length, 0);
  assert.ok(result.value);
  assert.equal(result.value.asset.format, "svga");
  assert.equal(result.value.specReport.passed, true);
  assert.deepEqual(result.value.specReport.issues, []);
});

test("inspection service returns specification issues without removing the parsed asset", async () => {
  const service = serviceWithFixtureAdapter();
  const result = await service.inspectWithSpec(
    memorySource("fixture.svga", Uint8Array.from([1, 2, 3, 4])),
    spec({ maxDimensions: { width: 300, height: 96 } }),
    new SvgaMotionSpecChecker()
  );

  assert.equal(result.issues.length, 0);
  assert.ok(result.value);
  assert.deepEqual(result.value.asset.dimensions, { width: 480, height: 96 });
  assert.equal(result.value.specReport.passed, false);
  assert.deepEqual(
    result.value.specReport.issues.map(({ code }) => code),
    ["dimensions_exceed_limit"]
  );
});

test("inspection service preserves the parsed asset when checker reports a failure", async () => {
  const service = serviceWithFixtureAdapter();
  const source = memorySource("fixture.svga", Uint8Array.from([1, 2, 3, 4]));
  const parsed = await service.inspect(source);
  const checked = await service.inspectWithSpec(source, spec(), {
    async check(asset) {
      return {
        specId: "forced-failure",
        passed: false,
        issues: [{
          severity: "error",
          code: "forced_failure",
          message: "Forced checker failure.",
          path: "sizeBytes"
        }]
      };
    }
  });

  assert.ok(parsed.value);
  assert.ok(checked.value);
  assert.deepEqual(checked.value.asset, parsed.value);
  assert.equal(checked.value.specReport.passed, false);
});

test("inspection service does not report limits omitted from the specification", async () => {
  const service = serviceWithFixtureAdapter();
  const result = await service.inspectWithSpec(
    memorySource("fixture.svga", Uint8Array.from([1, 2, 3, 4])),
    spec({
      maxFileSizeBytes: undefined,
      maxDimensions: undefined,
      maxDurationMs: undefined,
      maxFps: undefined,
      maxResourceCount: undefined
    }),
    new SvgaMotionSpecChecker()
  );

  assert.ok(result.value);
  assert.equal(result.value.specReport.passed, true);
  assert.deepEqual(result.value.specReport.issues, []);
});

class FixtureSvgaInspector implements SvgaBinaryInspector {
  async inspect(): Promise<SvgaMovieInspection> {
    return {
      version: "2.0",
      params: {
        viewBoxWidth: 480,
        viewBoxHeight: 96,
        fps: 24,
        frames: 48
      },
      images: [
        { imageKey: "img_frame", bytes: Uint8Array.from([1, 2, 3]) },
        { imageKey: "img_sweep", bytes: Uint8Array.from([4, 5]) }
      ],
      sprites: [
        {
          index: 0,
          imageKey: "img_frame",
          matteKey: "",
          frameCount: 48
        },
        {
          index: 1,
          imageKey: "img_sweep",
          matteKey: "img_frame",
          frameCount: 24
        }
      ],
      audioCount: 0
    };
  }
}

function serviceWithFixtureAdapter(): MotionAssetInspectionService {
  return new MotionAssetInspectionService(
    new SvgaFormatAdapter(new FixtureSvgaInspector())
  );
}

function spec(overrides: Partial<MotionSpec> = {}): MotionSpec {
  return {
    id: "avatar-frame-delivery",
    label: "Avatar frame delivery",
    maxFileSizeBytes: 200_000,
    maxDimensions: { width: 480, height: 96 },
    maxDurationMs: 2_000,
    maxFps: 24,
    maxResourceCount: 2,
    ...overrides
  };
}

function memorySource(name: string, bytes: Uint8Array): MotionAssetSource {
  return {
    id: `memory:${name}`,
    name,
    sizeBytes: bytes.byteLength,
    mediaType: "application/octet-stream",
    async read() {
      return bytes;
    }
  };
}

function fileSource(filePath: string): MotionAssetSource {
  return {
    id: `file:${filePath}`,
    name: path.basename(filePath),
    sizeBytes: 4,
    mediaType: "application/octet-stream",
    async read() {
      return readFile(filePath);
    }
  };
}
