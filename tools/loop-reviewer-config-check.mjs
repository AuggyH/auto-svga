#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requiredMustCheckItems = [
  "scope drift",
  "review handoff completeness"
];

function readScalar(text, section, key) {
  const sectionMatch = text.match(new RegExp(`\\[${section}\\]([\\s\\S]*?)(?:\\n\\[|$)`));
  if (!sectionMatch) return undefined;
  const match = sectionMatch[1].match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, "m"));
  if (!match) return undefined;
  const raw = match[1].trim();
  if (raw === "true") return true;
  if (raw === "false") return false;
  const quoted = raw.match(/^"([^"]*)"$/);
  return quoted ? quoted[1] : raw;
}

function readStringArray(text, section, key) {
  const sectionMatch = text.match(new RegExp(`\\[${section}\\]([\\s\\S]*?)(?:\\n\\[|$)`));
  if (!sectionMatch) {
    throw new Error(`Missing [${section}] section.`);
  }
  const arrayMatch = sectionMatch[1].match(new RegExp(`${key}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  if (!arrayMatch) {
    throw new Error(`Missing ${section}.${key} array.`);
  }

  const itemLines = arrayMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const values = [];

  for (let index = 0; index < itemLines.length; index += 1) {
    const line = itemLines[index];
    const isLast = index === itemLines.length - 1;
    if (!/^"[^"]*"\s*,?$/.test(line)) {
      throw new Error(`${section}.${key} contains a malformed string item: ${line}`);
    }
    if (!isLast && !line.endsWith(",")) {
      throw new Error(`${section}.${key} array item is missing a comma separator: ${line}`);
    }
    values.push(line.replace(/,\s*$/, "").slice(1, -1));
  }

  return values;
}

export async function validateReviewerConfig(configPath = ".codex/agents/reviewer.toml") {
  const resolved = resolve(configPath);
  const text = await readFile(resolved, "utf8");
  const mustCheck = readStringArray(text, "review", "must_check");

  const errors = [];
  if (readScalar(text, "permissions", "mode") !== "read-only") {
    errors.push("permissions.mode must be read-only.");
  }
  if (readScalar(text, "permissions", "allow_writes") !== false) {
    errors.push("permissions.allow_writes must be false.");
  }
  if (readScalar(text, "permissions", "allow_commits") !== false) {
    errors.push("permissions.allow_commits must be false.");
  }
  if (readScalar(text, "permissions", "allow_network") !== false) {
    errors.push("permissions.allow_network must be false.");
  }
  for (const required of requiredMustCheckItems) {
    if (!mustCheck.includes(required)) {
      errors.push(`review.must_check must include ${required}.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  return {
    schemaVersion: 1,
    status: "pass",
    configPath,
    permissions: {
      mode: "read-only",
      allow_writes: false,
      allow_commits: false,
      allow_network: false
    },
    mustCheck
  };
}

export async function main(argv = process.argv.slice(2)) {
  const configPath = argv[0] ?? ".codex/agents/reviewer.toml";
  const result = await validateReviewerConfig(configPath);
  console.log(`AUTO_SVGA_REVIEWER_CONFIG_CHECK_RESULT=${JSON.stringify(result)}`);
}

const isDirectRun = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
