import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { appName } from "./macos-package-proof.mjs";

const workflowSchemaVersion = 1;
const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const artifactsRoot = path.join(experimentRoot, ".artifacts/internal-trial");
const appBundle = path.join(artifactsRoot, `${appName}-darwin-arm64/${appName}.app`);
const unsignedArchive = path.join(artifactsRoot, `${appName}-darwin-arm64.zip`);
const signedArchive = path.join(artifactsRoot, `${appName}-darwin-arm64-signed.zip`);
const notarizedArchive = path.join(artifactsRoot, `${appName}-darwin-arm64-notarized.zip`);
const entitlementsPath = path.join(experimentRoot, "packaging/macos/entitlements.plist");

const mode = ["plan", "sign", "notarize"].includes(process.argv[2]) ? process.argv[2] : "plan";
const execute = process.argv.includes("--execute") || process.env.AUTO_SVGA_SIGNING_EXECUTE === "1";
const signIdentity = process.env.AUTO_SVGA_MACOS_SIGN_IDENTITY || process.env.CSC_NAME || "";
const notaryProfile = process.env.AUTO_SVGA_NOTARY_PROFILE || process.env.NOTARYTOOL_KEYCHAIN_PROFILE || "";
const appleId = process.env.APPLE_ID || "";
const appleTeamId = process.env.APPLE_TEAM_ID || "";
const applePassword = process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_PASSWORD || "";

function commandAvailable(command, args = ["--version"]) {
  const result = spawnSync(command, args, { stdio: "ignore" });
  return result.status === 0;
}

function gitHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

function hasAppleIdCredentials() {
  return Boolean(appleId && appleTeamId && applePassword);
}

function notaryCredentialMode() {
  if (notaryProfile) return "keychain-profile";
  if (hasAppleIdCredentials()) return "apple-id";
  return "missing";
}

function pathForReport(filePath) {
  return path.relative(repoRoot, filePath);
}

function commandPlan() {
  return {
    sign: [
      "codesign",
      "--force",
      "--deep",
      "--timestamp",
      "--options",
      "runtime",
      "--entitlements",
      pathForReport(entitlementsPath),
      "--sign",
      signIdentity ? "<identity>" : "<missing identity>",
      pathForReport(appBundle)
    ],
    verifySignature: [
      "codesign",
      "--verify",
      "--deep",
      "--strict",
      "--verbose=2",
      pathForReport(appBundle)
    ],
    createSignedArchive: [
      "/usr/bin/ditto",
      "-c",
      "-k",
      "--sequesterRsrc",
      "--keepParent",
      pathForReport(appBundle),
      pathForReport(signedArchive)
    ],
    notarize: notaryProfile
      ? [
        "xcrun",
        "notarytool",
        "submit",
        pathForReport(signedArchive),
        "--keychain-profile",
        "<profile>",
        "--wait"
      ]
      : [
        "xcrun",
        "notarytool",
        "submit",
        pathForReport(signedArchive),
        "--apple-id",
        appleId ? "<apple id>" : "<missing apple id>",
        "--team-id",
        appleTeamId ? "<team id>" : "<missing team id>",
        "--password",
        applePassword ? "<app-specific password>" : "<missing password>",
        "--wait"
      ],
    staple: ["xcrun", "stapler", "staple", pathForReport(appBundle)],
    assess: ["spctl", "--assess", "--type", "execute", "--verbose", pathForReport(appBundle)],
    createNotarizedArchive: [
      "/usr/bin/ditto",
      "-c",
      "-k",
      "--sequesterRsrc",
      "--keepParent",
      pathForReport(appBundle),
      pathForReport(notarizedArchive)
    ]
  };
}

function report(status, extra = {}) {
  console.log(JSON.stringify({
    schemaVersion: workflowSchemaVersion,
    workflow: "macos-signing-notarization",
    mode,
    execute,
    status,
    branch: execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim(),
    headCommit: gitHead(),
    appBundle: pathForReport(appBundle),
    unsignedArchive: pathForReport(unsignedArchive),
    signedArchive: pathForReport(signedArchive),
    notarizedArchive: pathForReport(notarizedArchive),
    entitlementsPath: pathForReport(entitlementsPath),
    credentialState: {
      signIdentityPresent: Boolean(signIdentity),
      notaryCredentialMode: notaryCredentialMode()
    },
    commandPlan: commandPlan(),
    ...extra
  }, null, 2));
}

function run(command, args) {
  execFileSync(command, args, { cwd: experimentRoot, stdio: "inherit", env: process.env });
}

function sign() {
  if (!existsSync(appBundle)) {
    report("PACKAGE_REQUIRED", {
      reason: "Run internal:trial:package:mac before signing."
    });
    return;
  }
  if (!existsSync(entitlementsPath)) {
    report("SIGNING_BLOCKED_MISSING_ENTITLEMENTS");
    return;
  }
  if (!signIdentity) {
    report("SIGNING_BLOCKED_REQUIRES_CREDENTIALS", {
      reason: "Set AUTO_SVGA_MACOS_SIGN_IDENTITY or CSC_NAME to a Developer ID Application signing identity."
    });
    return;
  }
  if (!commandAvailable("codesign", ["--help"])) {
    report("SIGNING_BLOCKED_REQUIRES_XCODE_TOOLS", {
      reason: "codesign is unavailable."
    });
    return;
  }
  if (!execute) {
    report("READY_REQUIRES_EXPLICIT_EXECUTE", {
      reason: "Dry run only. Re-run with --execute after verifying credentials and release approval."
    });
    return;
  }
  run("codesign", [
    "--force",
    "--deep",
    "--timestamp",
    "--options",
    "runtime",
    "--entitlements",
    entitlementsPath,
    "--sign",
    signIdentity,
    appBundle
  ]);
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appBundle]);
  run("/usr/bin/ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appBundle, signedArchive]);
  report("SIGNED_ARCHIVE_READY");
}

function notarize() {
  if (!existsSync(signedArchive)) {
    report("NOTARIZATION_BLOCKED_REQUIRES_SIGNED_ARCHIVE", {
      reason: "Run the sign workflow with --execute first."
    });
    return;
  }
  if (!commandAvailable("xcrun", ["notarytool", "--help"])) {
    report("NOTARIZATION_BLOCKED_REQUIRES_XCODE_NOTARYTOOL", {
      reason: "xcrun notarytool is unavailable."
    });
    return;
  }
  if (notaryCredentialMode() === "missing") {
    report("SIGNING_BLOCKED_REQUIRES_CREDENTIALS", {
      reason: "Set AUTO_SVGA_NOTARY_PROFILE or APPLE_ID, APPLE_TEAM_ID, and APPLE_APP_SPECIFIC_PASSWORD."
    });
    return;
  }
  if (!execute) {
    report("READY_REQUIRES_EXPLICIT_EXECUTE", {
      reason: "Dry run only. Re-run with --execute after verifying credentials and release approval."
    });
    return;
  }
  const submitArgs = ["notarytool", "submit", signedArchive, "--wait"];
  if (notaryProfile) submitArgs.push("--keychain-profile", notaryProfile);
  else submitArgs.push("--apple-id", appleId, "--team-id", appleTeamId, "--password", applePassword);
  run("xcrun", submitArgs);
  run("xcrun", ["stapler", "staple", appBundle]);
  run("spctl", ["--assess", "--type", "execute", "--verbose", appBundle]);
  run("/usr/bin/ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appBundle, notarizedArchive]);
  report("NOTARIZED_ARCHIVE_READY");
}

if (mode === "sign") sign();
else if (mode === "notarize") notarize();
else report(signIdentity && notaryCredentialMode() !== "missing" ? "READY_REQUIRES_EXPLICIT_EXECUTE" : "SIGNING_BLOCKED_REQUIRES_CREDENTIALS", {
  reason: "Default plan mode does not sign, notarize, upload, staple, or release."
});
