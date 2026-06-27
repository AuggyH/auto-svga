#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const targetPath = path.join(repoRoot, "docs/product/P6_R1_MACOS_VISUAL_SYSTEM_TARGET.json");
const sourceOnly = process.argv.includes("--source-only");

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function countHardcodedColors(css) {
  return countMatches(css, /#[0-9a-fA-F]{3,8}\b|(?<!color-mix\()rgba?\(/g);
}

function countHardcodedDeclarations(css, property) {
  return countMatches(css, new RegExp(`${property}\\s*:\\s*(?!var\\()[^;]+`, "g"));
}

function includesClass(source, className) {
  return source.includes(`.${className}`)
    || source.includes(`class="${className}`)
    || source.includes(`class="`) && new RegExp(`class="[^"]*\\b${className}\\b`).test(source);
}

function assertCondition(errors, condition, message) {
  if (!condition) errors.push(message);
}

const target = JSON.parse(await readFile(targetPath, "utf8"));
const [tokens, styles, shell, app] = await Promise.all([
  readText("tools/shared/product-tokens.css"),
  readText("tools/shared/product-frontend/product-styles.css"),
  readText("tools/shared/product-frontend/product-shell.html"),
  readText("tools/shared/product-frontend/product-app.mjs")
]);

const errors = [];
for (const token of target.requiredTokens) {
  assertCondition(errors, tokens.includes(`${token}:`), `missing visual token ${token}`);
  assertCondition(errors, styles.includes(`var(${token}`) || styles.includes(`${token}:`), `visual token not consumed by product styles ${token}`);
}

const componentSources = `${styles}\n${shell}\n${app}`;
for (const className of target.requiredComponentClasses) {
  assertCondition(errors, includesClass(componentSources, className), `missing visual component class ${className}`);
}

for (const banned of target.ownerVisibleCopyBans) {
  assertCondition(errors, !shell.includes(banned) && !app.includes(banned), `owner-visible copy still contains ${banned}`);
}

const colorCount = countHardcodedColors(styles);
const radiusCount = countHardcodedDeclarations(styles, "border-radius");
const fontSizeCount = countHardcodedDeclarations(styles, "font-size");
const tokenReferenceCount = countMatches(styles, /var\(--visual-|var\(--preview-card|var\(--panel-header|var\(--metric-card|var\(--resource-row|var\(--log-row|var\(--inline-feedback|var\(--compact-toolbar|var\(--status-badge/g);

assertCondition(errors, colorCount <= target.auditRules.hardcodedOwnerVisibleColorCountMax, `hardcoded color count ${colorCount} exceeds ${target.auditRules.hardcodedOwnerVisibleColorCountMax}`);
assertCondition(errors, radiusCount <= target.auditRules.hardcodedOwnerVisibleRadiusCountMax, `hardcoded radius count ${radiusCount} exceeds ${target.auditRules.hardcodedOwnerVisibleRadiusCountMax}`);
assertCondition(errors, fontSizeCount <= target.auditRules.hardcodedOwnerVisibleFontSizeCountMax, `hardcoded font-size count ${fontSizeCount} exceeds ${target.auditRules.hardcodedOwnerVisibleFontSizeCountMax}`);
assertCondition(errors, tokenReferenceCount >= target.auditRules.requiredTokenReferenceMinimum, `visual token reference count ${tokenReferenceCount} below ${target.auditRules.requiredTokenReferenceMinimum}`);
assertCondition(errors, /body\s*\{[\s\S]*?min-width:\s*680px;/.test(styles), "body min-width must support the 900x720 owner-review viewport");
assertCondition(errors, /@media\s*\(max-width:\s*980px\)[\s\S]*?\.workspace\.withCompare/.test(styles), "missing 900px compact compare workspace rule");
assertCondition(errors, /duplicateFilePillHidden/.test(app), "preview card audit must prove duplicated file pill is hidden");
assertCondition(errors, /function reloadCurrentFile/.test(app), "Cmd/Ctrl+R reload path must be explicit");
assertCondition(errors, !/clearCurrentFile\("shortcut"\)/.test(app), "Cmd/Ctrl+R must not clear the current file");

if (!sourceOnly) {
  for (const evidenceTarget of target.evidenceTargets) {
    assertCondition(errors, typeof evidenceTarget === "string" && evidenceTarget.length > 0, `invalid evidence target ${evidenceTarget}`);
  }
}

const summary = {
  passed: errors.length === 0,
  target: target.target,
  sourceOnly,
  metrics: {
    colorCount,
    radiusCount,
    fontSizeCount,
    tokenReferenceCount,
    requiredTokenCount: target.requiredTokens.length,
    requiredComponentClassCount: target.requiredComponentClasses.length
  },
  errors
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exit(1);
