import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const observedCallees = new Set([
  "JSON.stringify",
  "appendFileSync",
  "buildNormalProofSummary",
  "buildNormalRuntimeProof",
  "buildNormalSmokeParity",
  "buildNormalVisibleStartupProof",
  "buildStartupPlacementSummary",
  "console.error",
  "console.log",
  "console.warn",
  "emitEarlyStartupConsoleRecord",
  "emitLoadedStartupConsoleRecord",
  "finalizeEarlyStartupRecord",
  "finalizeStartupRecord",
  "fsApi.writeSync",
  "multiFormatTrace.record",
  "sanitizeProductArtifactIndex",
  "sanitizeRuntimeTraceEntry",
  "serializeEarlyStartupRecord",
  "serializeStartupRecord",
  "writeEarlyStartupFileRecord",
  "writeFileSync",
  "writeJsonProductArtifact",
  "writeStartupJsonProductArtifact",
  "writeSync"
]);

export function deriveStartupAuthoritySourcePaths(packageProofSource) {
  const sourceFile = ts.createSourceFile(
    "scripts/macos-package-proof.mjs",
    packageProofSource,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.JS
  );
  let paths;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === "windowPlacementPackagedSourceFiles"
      && node.initializer
      && ts.isArrayLiteralExpression(node.initializer)
    ) {
      paths = node.initializer.elements.map((element) => {
        if (!ts.isStringLiteral(element)) {
          throw new Error("windowPlacementPackagedSourceFiles must contain only string literals");
        }
        return `tools/electron-prototype/experiments/svga-web/${element.text}`;
      });
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (!paths || paths.length === 0) {
    throw new Error("windowPlacementPackagedSourceFiles authority is missing or empty");
  }
  return paths;
}

function calleeName(node) {
  const expression = node.expression;
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isElementAccessExpression(expression)) {
    return `${expression.expression.getText()}[*]`;
  }
  if (!ts.isPropertyAccessExpression(expression)) return "";
  const owner = ts.isIdentifier(expression.expression)
    ? expression.expression.text
    : expression.expression.getText();
  return `${owner}.${expression.name.text}`;
}

function isObservedCallee(callee) {
  return observedCallees.has(callee)
    || callee.startsWith("console.")
    || /(?:^|\.)(?:appendFile|appendFileSync|write|writeFile|writeFileSync|writeSync)$/u.test(callee);
}

function enclosingName(ancestors) {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const node = ancestors[index];
    if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
    if (ts.isMethodDeclaration(node) && node.name) return node.name.getText();
    if (
      (ts.isFunctionExpression(node) || ts.isArrowFunction(node))
      && node.parent
      && ts.isVariableDeclaration(node.parent)
      && ts.isIdentifier(node.parent.name)
    ) {
      return node.parent.name.text;
    }
  }
  return "<top-level>";
}

function literalHint(node) {
  const values = [];
  function visit(current) {
    if (values.length >= 3) return;
    if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
      values.push(current.text.slice(0, 96));
      return;
    }
    if (ts.isTemplateExpression(current)) {
      values.push(current.head.text.slice(0, 96));
    }
    ts.forEachChild(current, visit);
  }
  for (const argument of node.arguments) visit(argument);
  return values.join(" | ");
}

function normalizedCallText(node, sourceFile) {
  return node.getText(sourceFile).replace(/\s+/gu, " ").trim();
}

export function deriveStartupCallsites(sourceByPath) {
  const observations = [];
  for (const relativePath of Object.keys(sourceByPath).sort()) {
    const source = sourceByPath[relativePath];
    const sourceFile = ts.createSourceFile(
      relativePath,
      source,
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.JS
    );
    const ancestors = [];
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const callee = calleeName(node);
        if (isObservedCallee(callee)) {
          const context = enclosingName(ancestors);
          const text = normalizedCallText(node, sourceFile);
          observations.push({
            file: relativePath,
            context,
            callee,
            hint: literalHint(node),
            callSha256: createHash("sha256").update(text).digest("hex")
          });
        }
      }
      ancestors.push(node);
      ts.forEachChild(node, visit);
      ancestors.pop();
    }
    visit(sourceFile);
  }
  const ordinals = new Map();
  return observations.map((observation) => {
    const key = `${observation.file}\0${observation.context}\0${observation.callee}`;
    const ordinal = (ordinals.get(key) ?? 0) + 1;
    ordinals.set(key, ordinal);
    return { ...observation, ordinal };
  });
}

export function startupCallsiteDigest(callsites) {
  return createHash("sha256").update(JSON.stringify(callsites)).digest("hex");
}

function isJsonConsole(callsite) {
  return callsite.callee.startsWith("console.")
    && callsite.hint.startsWith("AUTO_SVGA_")
    && callsite.callSha256;
}

export function architecturalStartupBypasses(callsites) {
  const violations = [];
  const startupConsoleContexts = new Set([
    "emitEarlyStartupConsoleRecord",
    "emitLoadedStartupConsoleRecord"
  ]);
  const startupArtifactScenarios = new Set([
    "normal-runtime-proof",
    "normal-smoke-parity",
    "normal-visible-startup",
    "runtime-identity"
  ]);
  for (const callsite of callsites) {
    if (isJsonConsole(callsite) && !startupConsoleContexts.has(callsite.context)) {
      if (
        /(?:FATAL_BOOTSTRAP|WEB_EXPERIMENT_ERROR|ACCEPTANCE_STARTUP_PLACEMENT_PROOF|DESKTOP_NORMAL_PROOF)/u
          .test(callsite.hint)
      ) {
        violations.push({ ...callsite, reason: "startup_console_outside_central_emitter" });
      }
    }
    if (
      callsite.callee === "writeJsonProductArtifact"
      && [...startupArtifactScenarios].some((scenario) => callsite.hint.includes(scenario))
      && callsite.context !== "writeStartupJsonProductArtifact"
    ) {
      violations.push({ ...callsite, reason: "startup_artifact_outside_schema_writer" });
    }
    if (
      callsite.file.endsWith("/main.cjs")
      && callsite.callee === "writeSync"
      && ["writeAcceptanceStartupBootstrapPhase", "writeAcceptanceStartupBootstrapFailureArtifact"]
        .includes(callsite.context)
    ) {
      violations.push({ ...callsite, reason: "early_record_bypasses_early_writer" });
    }
  }
  return violations;
}
