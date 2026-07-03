import { overviewVisibleFacts } from "./short-term-macos-render-model.mjs";

const PLAYBACK_META_FACT_IDS = new Set(["canvas", "fps", "duration"]);

export function overviewTabView(model) {
  const overviewFacts = model?.overview?.facts ?? [];
  return {
    facts: overviewVisibleFacts(model),
    assets: Array.isArray(model?.assets) ? model.assets : [],
    playbackMeta: overviewFacts
      .filter((fact) => PLAYBACK_META_FACT_IDS.has(fact.id))
      .map((fact) => fact.value)
      .filter(Boolean)
      .join(" / ")
  };
}
