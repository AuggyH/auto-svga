export const P6_RUNTIME_SCENARIO_CONTRACT_VERSION = 1;

export const P6_RUNTIME_HOSTS = ["web", "electron", "packaged"];

export const P6_RUNTIME_SCENARIOS = [
  {
    id: "web-baseline",
    host: "web",
    requiredArtifacts: [
      "web-baseline/dom-manifest.json",
      "web-baseline/computed-styles-manifest.json",
      "web-baseline/motion-manifest.json",
      "web-baseline/interaction-trace.json",
      "web-baseline/request-audit.json",
      "web-baseline/screenshot-export-review-loaded-1440x900.png",
      "web-baseline/screenshot-local-empty-1440x900.png",
      "web-baseline/screenshot-mode-menu-open-1440x900.png",
      "web-baseline/screenshot-invalid-1440x900.png"
    ]
  },
  {
    id: "electron-runtime",
    host: "electron",
    requiredArtifacts: [
      "runtime-identity.json",
      "normal-smoke-parity.json",
      "desktop-state-render-proof.json",
      "artifact-index.json",
      "reviewer-b-product-categories.json"
    ]
  },
  {
    id: "packaged-runtime",
    host: "packaged",
    requiredArtifacts: [
      "packaged-app-runtime-proof.json",
      "internal-trial-manifest.json"
    ],
    requiredPackageExtensions: [".zip"]
  }
];

export function requiredRuntimeArtifactFragments() {
  return P6_RUNTIME_SCENARIOS.flatMap((scenario) => scenario.requiredArtifacts);
}
