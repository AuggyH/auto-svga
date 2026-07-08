export function playbackCanvasFitSize(input) {
  const movieWidth = Math.max(1, Number(input.movieWidth) || 1);
  const movieHeight = Math.max(1, Number(input.movieHeight) || 1);
  const containerWidth = Math.max(1, Math.floor(Number(input.containerWidth) || movieWidth));
  const containerHeight = Math.max(1, Math.floor(Number(input.containerHeight) || movieHeight));
  const aspect = movieWidth / movieHeight;
  let width = Math.min(containerWidth, containerHeight * aspect);
  let height = width / aspect;
  if (height > containerHeight) {
    height = containerHeight;
    width = height * aspect;
  }
  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
    aspect
  };
}
