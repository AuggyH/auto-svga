#!/usr/bin/env node
import { hasErrors } from "./core/validator.js";
import type { PlanningResult } from "./mvp/types.js";
import type { PreviewCommandResult } from "./commands/preview.js";

interface ParsedArgs {
  command?: string;
  input?: string;
  output?: string;
  sweepStride?: 1 | 2 | 3;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  switch (args.command) {
    case "init":
      {
      const { initCommand } = await import("./commands/init.js");
      await initCommand(args.input ?? "avatar_frame_project");
      console.log(`Initialized avatar frame project at ${args.input ?? "avatar_frame_project"}`);
      break;
      }
    case "validate": {
      const { validateCommand } = await import("./commands/validate.js");
      const input = requireInput(args);
      const issues = await validateCommand(input);
      printIssues(issues);
      process.exitCode = hasErrors(issues) ? 1 : 0;
      break;
    }
    case "build": {
      const { buildCommand } = await import("./commands/build.js");
      const input = requireInput(args);
      const report = await buildCommand(input, args.output, { sweepStride: args.sweepStride });
      printIssues([...report.warnings, ...report.errors]);
      console.log(`Build ${report.status === "success" ? "completed" : "failed"}: ${report.outputDir}`);
      process.exitCode = report.status === "success" ? 0 : 1;
      break;
    }
    case "plan": {
      const { planCommand } = await import("./commands/plan.js");
      const input = requireInput(args);
      const result = await planCommand(input);
      printIssues(result.issues);
      printPlanSummary(result);
      process.exitCode = hasErrors(result.issues) ? 1 : 0;
      break;
    }
    case "preview": {
      const { previewCommand } = await import("./commands/preview.js");
      const input = requireInput(args);
      const result = await previewCommand(input, args.output);
      if (result.mode === "mvp") {
        printMvpPreviewSummary(result);
      } else {
        console.log(`Preview generated: ${result.previewPath}`);
      }
      break;
    }
    case "export": {
      const { exportCommand } = await import("./commands/export.js");
      const input = requireInput(args);
      const report = await exportCommand(input, args.output, { sweepStride: args.sweepStride });
      printIssues([...report.warnings, ...report.errors]);
      if (report.svgaExport.success) {
        console.log(`SVGA export completed: ${report.svgaExport.outputPath}`);
      } else {
        console.log(`SVGA export failed: ${report.svgaExport.error ?? "unknown error"}`);
      }
      process.exitCode = report.svgaExport.success ? 0 : 1;
      break;
    }
    default:
      printHelp();
      process.exitCode = args.command ? 1 : 0;
  }
}

function parseArgs(values: string[]): ParsedArgs {
  const [command, input, ...rest] = values;
  const outputFlagIndex = rest.indexOf("--out");
  const output = outputFlagIndex >= 0 ? rest[outputFlagIndex + 1] : undefined;
  const strideFlagIndex = rest.indexOf("--sweep-stride");
  const sweepStride = parseSweepStride(strideFlagIndex >= 0 ? rest[strideFlagIndex + 1] : undefined);
  return { command, input, output, sweepStride };
}

function parseSweepStride(value: string | undefined): 1 | 2 | 3 | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (parsed === 1 || parsed === 2 || parsed === 3) {
    return parsed;
  }
  throw new Error("--sweep-stride must be 1, 2, or 3.");
}

function requireInput(args: ParsedArgs): string {
  if (!args.input) {
    throw new Error(`Command "${args.command}" requires an input directory.`);
  }
  return args.input;
}

function printIssues(issues: Array<{ level: string; code: string; message: string; path?: string }>): void {
  if (issues.length === 0) {
    console.log("Validation passed.");
    return;
  }

  for (const issue of issues) {
    const location = issue.path ? ` ${issue.path}` : "";
    console.log(`[${issue.level}] ${issue.code}${location}: ${issue.message}`);
  }
}

function printPlanSummary(result: PlanningResult): void {
  if (hasErrors(result.issues)) {
    console.log("\nauto-svga MVP 0.1 planning failed");
    return;
  }

  console.log(`\nauto-svga MVP 0.1 planning completed

Job: ${result.jobName}
Asset type: ${result.config.assetType}
Canvas: ${result.config.canvas.width}x${result.config.canvas.height}
FPS: ${result.config.fps}
Duration: ${result.config.durationMs}ms
Frames: ${result.project.frames}
Parts: ${result.structure.parts.length}
Effects: ${result.motionPlan.effects.length}
Project layers: ${result.project.layers.length}

Generated:
${result.generated.map((file) => `- ${file}`).join("\n")}
`);

  const warnings = [
    ...result.issues.filter((issue) => issue.level === "warning").map((issue) => issue.message),
    ...result.project.warnings
  ];
  if (warnings.length > 0) {
    console.log(`Warnings:\n${warnings.map((warning) => `- ${warning}`).join("\n")}`);
  }
}

function printMvpPreviewSummary(result: Extract<PreviewCommandResult, { mode: "mvp" }>): void {
  const report = result.report;
  console.log(`auto-svga MVP preview completed

Job: ${result.jobName}
Project: project/project.json
Canvas: ${report.canvas.width}x${report.canvas.height}
FPS: ${report.fps}
Frames: ${report.frames}
Layers: ${report.layers}
Generated assets: ${report.generatedAssets.length}
Output:
- ${result.previewPath}
- ${result.reportPath}
`);

  if (report.warnings.length > 0) {
    console.log(`Warnings:\n${report.warnings.map((warning) => `- ${warning}`).join("\n")}`);
  }
}

function printHelp(): void {
  console.log(`SVGA Avatar Frame MVP

Usage:
  svga-avatar-frame init <dir>
  svga-avatar-frame validate <dir>
  svga-avatar-frame plan <job-dir>
  svga-avatar-frame build <dir> [--out <dir>]
  svga-avatar-frame preview <dir> [--out <dir>]
  svga-avatar-frame export <dir> [--out <dir>] [--sweep-stride 1|2|3]
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
