#!/usr/bin/env node
import { buildCommand } from "./commands/build.js";
import { exportCommand } from "./commands/export.js";
import { initCommand } from "./commands/init.js";
import { previewCommand } from "./commands/preview.js";
import { validateCommand } from "./commands/validate.js";
import { hasErrors } from "./core/validator.js";

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
      await initCommand(args.input ?? "avatar_frame_project");
      console.log(`Initialized avatar frame project at ${args.input ?? "avatar_frame_project"}`);
      break;
    case "validate": {
      const input = requireInput(args);
      const issues = await validateCommand(input);
      printIssues(issues);
      process.exitCode = hasErrors(issues) ? 1 : 0;
      break;
    }
    case "build": {
      const input = requireInput(args);
      const report = await buildCommand(input, args.output, { sweepStride: args.sweepStride });
      printIssues([...report.warnings, ...report.errors]);
      console.log(`Build ${report.status === "success" ? "completed" : "failed"}: ${report.outputDir}`);
      process.exitCode = report.status === "success" ? 0 : 1;
      break;
    }
    case "preview": {
      const input = requireInput(args);
      const previewPath = await previewCommand(input, args.output);
      console.log(`Preview generated: ${previewPath}`);
      break;
    }
    case "export": {
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

function printHelp(): void {
  console.log(`SVGA Avatar Frame MVP

Usage:
  svga-avatar-frame init <dir>
  svga-avatar-frame validate <dir>
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
