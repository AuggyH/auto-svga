"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const { types: utilTypes } = require("node:util");

const CONTRACT = Object.freeze({
  schema: "auto-svga-aeb-registered-fixture-proof-descriptor-v1",
  aeDevRoot: "/private/tmp/auto-svga-aeb-dev",
  taskRoot: "/private/tmp/auto-svga-aeb-d001-8594bcfa",
  electronApp: "/Users/huangtengxin/Documents/auto-svga/tools/electron-prototype/node_modules/electron/dist/Electron.app",
  electronExecutable: "/Users/huangtengxin/Documents/auto-svga/tools/electron-prototype/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
  electronBundleId: "com.github.Electron",
  electronVersion: "42.4.1",
  experimentRoot: path.resolve(__dirname, "../electron-prototype/experiments/svga-web"),
  bootstrapPath: path.join(__dirname, "registered-aeb-native-preview-bootstrap.cjs"),
  isolatedPanelSourceHead: "aa567f2f509ada69e9ab304464f319155aa564db",
  fixtureSourceHead: "f09604d07a675bf36e7f7b1de7a8f33612ac11e9",
  fixtureSha256: "b7970b1a9c9a313e9b9f912411dacfe61d6e196c102918f4c77f49883da06936",
  fixtureBytes: 811,
  panelMaterialHashes: Object.freeze({
    manifest: "0fe5ea0b77465b1f09c8db8e1a4c454f428e2fc41b51db5c1cd17c644296cc53",
    isolatedIndex: "f0d5b8ff2c2aac41a175ac069e9220f5b13b48c3753f6fac8c4a17efe446ddbd",
    sharedPanel: "c9fbe9cf8ed0a8ca6a5b2b1444e59c63e782b65d253e16ee7c41d9b8ef3e10ab",
    jsx: "a45ecdb35599bac740e596ace02d6492e7cca0e7e6baa63df641c544ae81b048"
  })
});

const DESCRIPTOR_KEYS = Object.freeze([
  "d001ExecutionId",
  "d001PacketHead",
  "d001PermitId",
  "d001SourceHead",
  "executionId",
  "expectedGeneratedSvgaBytes",
  "expectedGeneratedSvgaSha256",
  "fixtureBytes",
  "fixtureSha256",
  "fixtureSourceHead",
  "isolatedPanelSourceHead",
  "outputRoot",
  "packageRoot",
  "packageSha256",
  "packageTreeFileCount",
  "packageTreeSha256",
  "packageTreeTotalBytes",
  "panelIndexSha256",
  "panelJsxSha256",
  "panelManifestSha256",
  "panelSharedPanelSha256",
  "permitId",
  "requestId",
  "requestSha256",
  "schema",
  "sourceBranch",
  "sourceHead",
  "sourcePackageRoot"
]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function requirePrimitiveString(value, code) {
  if (typeof value !== "string") fail(code);
  return value;
}

function requireOwnedPath(value, purpose, { directChild = false } = {}) {
  requirePrimitiveString(value, `registered_fixture_${purpose}_invalid`);
  if (value.length === 0 || value.includes("\0")) fail(`registered_fixture_${purpose}_invalid`);
  const resolved = path.resolve(value);
  const relative = path.relative(CONTRACT.taskRoot, resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`registered_fixture_${purpose}_out_of_root`);
  }
  if (directChild && path.dirname(resolved) !== CONTRACT.taskRoot) {
    fail(`registered_fixture_${purpose}_not_direct_child`);
  }
  return resolved;
}

function requireAeDevPath(value, purpose) {
  requirePrimitiveString(value, `registered_fixture_${purpose}_invalid`);
  if (value.length === 0 || value.includes("\0")) fail(`registered_fixture_${purpose}_invalid`);
  const resolved = path.resolve(value);
  const relative = path.relative(CONTRACT.aeDevRoot, resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative) || path.basename(resolved) !== "ae-export-package") {
    fail(`registered_fixture_${purpose}_out_of_root`);
  }
  return resolved;
}

function validateDescriptor(value) {
  const record = readOwnDataRecord(value, DESCRIPTOR_KEYS, "descriptor");
  const numericFields = new Set(["expectedGeneratedSvgaBytes", "fixtureBytes", "packageTreeFileCount", "packageTreeTotalBytes"]);
  for (const field of DESCRIPTOR_KEYS) {
    if (!numericFields.has(field)) {
      requirePrimitiveString(record[field], `registered_fixture_${camelToSnake(field)}_invalid`);
    }
  }
  if (record.schema !== CONTRACT.schema) fail("registered_fixture_descriptor_schema_invalid");
  if (!/^ASV-APR-\d{8}-\d{3}$/u.test(record.permitId)) fail("registered_fixture_permit_invalid");
  if (!/^[a-z0-9][a-z0-9-]{15,95}$/u.test(record.executionId)) fail("registered_fixture_execution_invalid");
  if (!/^[a-f0-9]{40}$/u.test(record.sourceHead)) fail("registered_fixture_source_head_invalid");
  if (!/^codex\/[a-z0-9][a-z0-9._/-]{7,120}$/u.test(record.sourceBranch)) {
    fail("registered_fixture_source_branch_invalid");
  }
  if (!/^aeb-semantic-[a-z0-9][a-z0-9-]{7,79}$/u.test(record.requestId)) {
    fail("registered_fixture_request_id_invalid");
  }
  if (!isSha256(record.requestSha256)) fail("registered_fixture_request_sha256_invalid");
  if (!/^ASV-APR-\d{8}-\d{3}$/u.test(record.d001PermitId)) fail("registered_fixture_d001_permit_invalid");
  if (!/^[a-z0-9][a-z0-9-]{15,95}$/u.test(record.d001ExecutionId)) fail("registered_fixture_d001_execution_invalid");
  if (!/^[a-f0-9]{40}$/u.test(record.d001PacketHead) || record.d001PacketHead !== record.sourceHead) {
    fail("registered_fixture_d001_packet_invalid");
  }
  if (!/^[a-f0-9]{40}$/u.test(record.d001SourceHead) || record.d001SourceHead === record.d001PacketHead) {
    fail("registered_fixture_d001_source_invalid");
  }
  if (record.isolatedPanelSourceHead !== CONTRACT.isolatedPanelSourceHead) fail("registered_fixture_panel_lineage_invalid");
  if (record.fixtureSourceHead !== CONTRACT.fixtureSourceHead) fail("registered_fixture_fixture_lineage_invalid");
  if (record.fixtureSha256 !== CONTRACT.fixtureSha256 || record.fixtureBytes !== CONTRACT.fixtureBytes) {
    fail("registered_fixture_png_identity_invalid");
  }
  const panelFields = {
    panelManifestSha256: "manifest",
    panelIndexSha256: "isolatedIndex",
    panelSharedPanelSha256: "sharedPanel",
    panelJsxSha256: "jsx"
  };
  for (const [field, material] of Object.entries(panelFields)) {
    if (record[field] !== CONTRACT.panelMaterialHashes[material]) fail(`registered_fixture_${camelToSnake(field)}_invalid`);
  }
  for (const field of ["packageSha256", "expectedGeneratedSvgaSha256", "packageTreeSha256"]) {
    if (!isSha256(record[field])) fail(`registered_fixture_${camelToSnake(field)}_invalid`);
  }
  if (!Number.isInteger(record.packageTreeFileCount) || record.packageTreeFileCount <= 0 || record.packageTreeFileCount > 128) {
    fail("registered_fixture_package_tree_file_count_invalid");
  }
  if (!Number.isInteger(record.packageTreeTotalBytes) || record.packageTreeTotalBytes <= 0 || record.packageTreeTotalBytes > 25 * 1024 * 1024) {
    fail("registered_fixture_package_tree_total_bytes_invalid");
  }
  if (!Number.isInteger(record.expectedGeneratedSvgaBytes) || record.expectedGeneratedSvgaBytes <= 0) {
    fail("registered_fixture_generated_size_invalid");
  }
  const sourcePackageRoot = requireAeDevPath(record.sourcePackageRoot, "source_package_root");
  if (path.basename(path.dirname(sourcePackageRoot)) !== record.requestId) {
    fail("registered_fixture_request_source_package_mismatch");
  }
  const packageRoot = requireOwnedPath(record.packageRoot, "package_root", { directChild: true });
  const outputRoot = requireOwnedPath(record.outputRoot, "output_root", { directChild: true });
  if (packageRoot === outputRoot || packageRoot.startsWith(`${outputRoot}${path.sep}`) || outputRoot.startsWith(`${packageRoot}${path.sep}`)) {
    fail("registered_fixture_package_output_overlap");
  }
  return Object.freeze({ ...record, sourcePackageRoot, packageRoot, outputRoot });
}

function canonicalDescriptorBytes(value) {
  return Buffer.from(`${JSON.stringify(sortJson(validateDescriptor(value)), null, 2)}\n`, "utf8");
}

function descriptorSha256(value) {
  return crypto.createHash("sha256").update(canonicalDescriptorBytes(value)).digest("hex");
}

function readOwnDataRecord(value, expectedKeys, purpose) {
  if (!value || typeof value !== "object" || Array.isArray(value) || utilTypes.isProxy(value)) {
    fail(`registered_fixture_${purpose}_record_invalid`);
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) fail(`registered_fixture_${purpose}_prototype_invalid`);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) fail(`registered_fixture_${purpose}_fields_invalid`);
  const actualKeys = ownKeys.slice().sort();
  const requiredKeys = [...expectedKeys].sort();
  if (actualKeys.length !== requiredKeys.length || actualKeys.some((key, index) => key !== requiredKeys[index])) {
    fail(`registered_fixture_${purpose}_fields_invalid`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || !("value" in descriptor)
      || descriptor.get
      || descriptor.set
      || descriptor.enumerable !== true
    ) fail(`registered_fixture_${purpose}_accessor_invalid`);
    const primitive = descriptor.value;
    if (primitive !== null && !["string", "number", "boolean"].includes(typeof primitive)) {
      fail(`registered_fixture_${purpose}_primitive_invalid`);
    }
    result[key] = primitive;
  }
  return result;
}

function descriptorEnvironment(descriptor, evidenceStore) {
  const value = validateDescriptor(descriptor);
  const store = validateEvidenceStore(evidenceStore);
  if (store.outputRoot !== value.outputRoot || !isSha256(store.bindingSha256)) {
    fail("registered_fixture_evidence_store_binding_invalid");
  }
  const bindingBytes = Buffer.from(JSON.stringify(store.binding), "utf8");
  return {
    AUTO_SVGA_PRODUCT_MILESTONE: "0.3.0-alpha.1",
    AUTO_SVGA_AEB_PROOF_TASK_ROOT: CONTRACT.taskRoot,
    AUTO_SVGA_AEB_PROOF_OUTPUT_ROOT: value.outputRoot,
    AUTO_SVGA_AEB_PROOF_PACKAGE_ROOT: value.packageRoot,
    AUTO_SVGA_AEB_PROOF_PERMIT_ID: value.permitId,
    AUTO_SVGA_AEB_PROOF_EXECUTION_ID: value.executionId,
    AUTO_SVGA_AEB_PROOF_REPORT_RECORD: "aeb-native-preview-product-proof.json",
    AUTO_SVGA_AEB_PROOF_SAVE_RECORD: "aeb-native-preview-save-as.svga",
    AUTO_SVGA_AEB_PROOF_SOURCE_HEAD: value.sourceHead,
    AUTO_SVGA_AEB_PROOF_REQUEST_ID: value.requestId,
    AUTO_SVGA_AEB_PROOF_REQUEST_SHA256: value.requestSha256,
    AUTO_SVGA_AEB_PROOF_D001_PERMIT_ID: value.d001PermitId,
    AUTO_SVGA_AEB_PROOF_D001_EXECUTION_ID: value.d001ExecutionId,
    AUTO_SVGA_AEB_PROOF_D001_PACKET_HEAD: value.d001PacketHead,
    AUTO_SVGA_AEB_PROOF_PACKAGE_SHA256: value.packageSha256,
    AUTO_SVGA_AEB_PROOF_PACKAGE_TREE_SHA256: value.packageTreeSha256,
    AUTO_SVGA_AEB_PROOF_PACKAGE_TREE_FILE_COUNT: String(value.packageTreeFileCount),
    AUTO_SVGA_AEB_PROOF_PACKAGE_TREE_TOTAL_BYTES: String(value.packageTreeTotalBytes),
    AUTO_SVGA_AEB_PROOF_FIXTURE_SHA256: value.fixtureSha256,
    AUTO_SVGA_AEB_PROOF_GENERATED_SVGA_SHA256: value.expectedGeneratedSvgaSha256,
    AUTO_SVGA_AEB_PROOF_GENERATED_SVGA_BYTES: String(value.expectedGeneratedSvgaBytes),
    AUTO_SVGA_AEB_PROOF_EVIDENCE_BINDING_BASE64: bindingBytes.toString("base64url"),
    AUTO_SVGA_AEB_PROOF_EVIDENCE_BINDING_SHA256: store.bindingSha256
  };
}

function validateEvidenceStore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || utilTypes.isProxy(value)) {
    fail("registered_fixture_evidence_store_record_invalid");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(value);
  const expected = ["binding", "bindingSha256", "outputRoot"];
  if (
    keys.some((key) => typeof key !== "string")
    || keys.slice().sort().some((key, index) => key !== expected.slice().sort()[index])
    || keys.length !== expected.length
  ) fail("registered_fixture_evidence_store_fields_invalid");
  for (const key of expected) {
    if (!descriptors[key] || !("value" in descriptors[key]) || descriptors[key].get || descriptors[key].set) {
      fail("registered_fixture_evidence_store_accessor_invalid");
    }
  }
  const binding = cloneOwnJsonRecord(descriptors.binding.value);
  if (typeof descriptors.bindingSha256.value !== "string" || typeof descriptors.outputRoot.value !== "string") {
    fail("registered_fixture_evidence_store_primitive_invalid");
  }
  return {
    binding,
    bindingSha256: descriptors.bindingSha256.value,
    outputRoot: descriptors.outputRoot.value
  };
}

function cloneOwnJsonRecord(value, depth = 0) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || utilTypes.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || depth > 4
  ) fail("registered_fixture_evidence_binding_invalid");
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) fail("registered_fixture_evidence_binding_invalid");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || descriptor.enumerable !== true) {
      fail("registered_fixture_evidence_binding_invalid");
    }
    const nested = descriptor.value;
    if (nested && typeof nested === "object") {
      result[key] = cloneOwnJsonRecord(nested, depth + 1);
    } else if (nested === null || ["string", "number", "boolean"].includes(typeof nested)) {
      result[key] = nested;
    } else {
      fail("registered_fixture_evidence_binding_invalid");
    }
  }
  return result;
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`);
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
  }
  return value;
}

module.exports = {
  CONTRACT,
  canonicalDescriptorBytes,
  descriptorEnvironment,
  descriptorSha256,
  readOwnDataRecord,
  validateDescriptor
};
