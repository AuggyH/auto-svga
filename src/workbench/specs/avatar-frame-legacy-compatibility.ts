import type { MotionSpecProfile } from "../contracts.js";

export const avatarFrameLegacyCompatibilityProfile: MotionSpecProfile = {
  id: "legacy_compatibility",
  label: "Avatar Frame Legacy Compatibility",
  purpose: "Describe existing catalog compatibility without approving new production deliveries.",
  approvedForNewDelivery: false
};
