export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function curtainFrame(progress, stageWidth, curtainLang) {
  const safeWidth = Math.max(1, stageWidth);
  const safeProgress = clamp(progress, 0, 1);
  const dividerPosition = (1 - safeProgress) * safeWidth;
  const distance = curtainLang === 'en' ? dividerPosition : safeWidth - dividerPosition;
  const direction = curtainLang === 'en' ? 1 : -1;
  const revealX = direction * distance || 0;

  return {
    progress: safeProgress,
    dividerPosition,
    revealX,
    layerX: -revealX || 0,
  };
}

export function snapProgress({
  progress,
  targetLang,
  velocity,
  travelled,
  flingVelocity,
  minimumFlingTravel,
}) {
  if (Math.abs(velocity) >= flingVelocity && travelled >= minimumFlingTravel) {
    return velocity < 0 ? 1 : 0;
  }
  if (progress === 0.5) return targetLang === 'en' ? 1 : 0;
  return progress >= 0.5 ? 1 : 0;
}
