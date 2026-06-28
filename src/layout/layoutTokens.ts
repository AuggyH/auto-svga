export const layoutTokens = Object.freeze({
  gap: 16,
  left: Object.freeze({
    min: 240,
    max: 320,
    default: 288,
    collapsed: 56
  }),
  center: Object.freeze({
    min: 520
  }),
  right: Object.freeze({
    min: 280,
    max: 360,
    default: 336,
    collapsed: 56
  }),
  modes: Object.freeze({
    fullWorkbenchMinWidth: 1280,
    compactWorkbenchMinWidth: 1064
  })
});

export const layoutMinTotal = layoutTokens.left.min
  + layoutTokens.center.min
  + layoutTokens.right.min
  + layoutTokens.gap * 2;
