#!/usr/bin/env node
import { buildCommand } from "./commands/build.js";
import { initCommand } from "./commands/init.js";
import { previewCommand } from "./commands/preview.js";
import { validateCommand } from "./commands/validate.js";
import { hasErrors } from "./core/validator.js";

interface ParsedArgs {
  command?: string;
  input?: string;
  output?: string;
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
      const report = await buildCommand(input, args.output);
      printIssues(report.issues);
      console.log(`Build ${report.ok ? "completed" : "failed"}: ${report.outputDir}`);
      process.exitCode = report.ok ? 0 : 1;
      break;
    }
    case "preview": {
      const input = requireInput(args);
      const previewPath = await previewCommand(input, args.output);
      console.log(`Preview generated: ${previewPath}`);
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
  return { command, input, output };
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
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
