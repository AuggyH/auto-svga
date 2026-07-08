export function playbackCanvasFitSize(input) {
  const movieWidth = Math.max(1, Number(input.movieWidth) || 1);
  const movieHeight = Math.max(1, Number(input.movieHeight) || 1);
  const containerWidth = Math.max(1, Math.floor(Number(input.containerWidth) || movieWidth));
  const containerHeight = Math.max(1, Math.floor(Number(input.containerHeight) || movieHeight));
  const fitScale = Math.min(1, Math.max(0.2, Number(input.fitScale) || 1));
  const aspect = movieWidth / movieHeight;
  let width = Math.min(containerWidth, containerHeight * aspect) * fitScale;
  let height = width / aspect;
  const scaledContainerHeight = containerHeight * fitScale;
  if (height > scaledContainerHeight) {
    height = scaledContainerHeight;
    width = height * aspect;
  }
  if (width > movieWidth) {
    width = movieWidth;
    height = width / aspect;
  }
  if (height > movieHeight) {
    height = movieHeight;
    width = height * aspect;
  }
  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
    aspect
  };
}
