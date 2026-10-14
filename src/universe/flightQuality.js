const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

/**
 * Adjust raster resolution after sustained frame pressure; geometry stays intact.
 * Feed the interval between rendered RAF frames, without a fixed FPS limiter.
 * Skip samples while loading, paused or hidden so those delays do not lower quality.
 */
export function createFlightQuality({
  initialPixelRatio = 1,
  maxPixelRatio = 1.7,
  minPixelRatio = .85,
  targetFrameMs = 1000 / 45,
} = {}) {
  const ceiling = Math.max(.5, finite(maxPixelRatio, 1.7));
  const floor = clamp(finite(minPixelRatio, .85), .5, ceiling);
  const target = clamp(finite(targetFrameMs, 1000 / 45), 12, 50);
  let pixelRatio = clamp(finite(initialPixelRatio, 1), floor, ceiling);
  let average = 0, observationMs = 0, slowMs = 0, fastMs = 0, cooldownMs = 0;

  function state(changed = false) {
    return {
      pixelRatio,
      changed,
      mode: pixelRatio >= ceiling - .01 ? 'native' : pixelRatio <= floor + .01 ? 'performance' : 'balanced',
      frameMs: average,
    };
  }
  function reset() {
    average = observationMs = slowMs = fastMs = cooldownMs = 0;
    return state();
  }
  function sample(frameMs, { visible = true, loading = false, paused = false } = {}) {
    if (!visible || loading || paused) return reset();
    // A resumed tab or a single shader/texture stall is not steady GPU pressure.
    if (!Number.isFinite(frameMs) || frameMs < 2 || frameMs > 150) return state();
    average = average ? average + (frameMs - average) * (1 - Math.exp(-frameMs / 900)) : frameMs;
    observationMs += frameMs;
    cooldownMs = Math.max(0, cooldownMs - frameMs);
    if (observationMs < 1200 || cooldownMs) return state();

    if (average > target * 1.22 && frameMs > target * 1.05) {
      slowMs += frameMs;
      fastMs = 0;
    } else if (average < target * .82 && frameMs < target) {
      fastMs += frameMs;
      slowMs = 0;
    } else {
      // A wide neutral band prevents reallocating the render target repeatedly.
      slowMs = fastMs = 0;
    }
    let next = pixelRatio;
    if (slowMs >= 1800 && pixelRatio > floor) {
      next = Math.max(floor, pixelRatio * clamp(Math.sqrt(target / average), .85, .95));
      cooldownMs = 3000;
    } else if (fastMs >= 12000 && pixelRatio < ceiling) {
      // Recovery is deliberately slower than relief under sustained load.
      next = Math.min(ceiling, pixelRatio + .08);
      cooldownMs = 5000;
    }
    if (next === pixelRatio) return state();
    pixelRatio = clamp(Math.round(next * 1000) / 1000, floor, ceiling);
    slowMs = fastMs = 0;
    return state(true);
  }
  return { sample, reset, getState: state };
}
