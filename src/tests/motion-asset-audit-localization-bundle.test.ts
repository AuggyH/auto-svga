import assert from "node:assert/strict";
import test from "node:test";
import {
  getMotionAssetAuditLocalizationBundle,
  MOTION_ASSET_AUDIT_DEFAULT_LOCALE,
  MOTION_ASSET_AUDIT_SUPPORTED_LOCALES,
  resolveAuditPresentationLabel
} from "../workbench/motion-asset-audit-localization-bundle.js";
import { motionAssetAuditEnglishFallbacks } from "../workbench/motion-asset-audit-localization-keys.js";

test("exposes stable English and Chinese localization bundles", () => {
  assert.equal(MOTION_ASSET_AUDIT_DEFAULT_LOCALE, "en");
  assert.deepEqual(MOTION_ASSET_AUDIT_SUPPORTED_LOCALES, ["en", "zh-CN"]);
  assert.equal(getMotionAssetAuditLocalizationBundle("en").locale, "en");
  assert.equal(getMotionAssetAuditLocalizationBundle("zh-CN").locale, "zh-CN");
  assert.equal(
    getMotionAssetAuditLocalizationBundle("zh-CN").labels["audit.status.needs_review"],
    "需要检查"
  );
});

test("keeps every current catalog fallback available in the Chinese bundle", () => {
  const chinese = getMotionAssetAuditLocalizationBundle("zh-CN").labels;
  assert.deepEqual(
    Object.keys(motionAssetAuditEnglishFallbacks).filter((key) => !chinese[key]),
    []
  );
});

test("resolves locale labels and falls back deterministically", () => {
  assert.equal(
    resolveAuditPresentationLabel("audit.summary.needs_review.title", { locale: "zh-CN" }),
    "资产需要检查"
  );
  assert.equal(
    resolveAuditPresentationLabel("audit.summary.needs_review.title", { locale: "unsupported" }),
    "Asset needs review"
  );
  assert.equal(
    resolveAuditPresentationLabel("audit.finding.future.description", {
      locale: "zh-CN",
      fallbackMessage: "Original report message"
    }),
    "Original report message"
  );
  assert.equal(
    resolveAuditPresentationLabel("audit.finding.future.title", { locale: "zh-CN" }),
    "audit.finding.future.title"
  );
});
