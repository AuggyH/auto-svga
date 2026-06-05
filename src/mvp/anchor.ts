import type { AnchorConversion, MvpPart } from "./types.js";

export function convertCanvasAnchorToLocal(part: MvpPart): AnchorConversion {
  const [x1, y1] = part.bbox;
  return {
    canvasX: part.anchor.x,
    canvasY: part.anchor.y,
    localX: part.anchor.x - x1,
    localY: part.anchor.y - y1
  };
}
