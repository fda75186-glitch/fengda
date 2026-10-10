// A shared viewBox keeps the Sun, drawn paths and planet positions in one coordinate space.
// Radii and periods are compressed for readability; this is a teaching diagram, not an ephemeris.
export const ORBIT_SCENE = Object.freeze({ width: 960, height: 640, cx: 480, cy: 320 });
export const orbitLayouts = [
  { rx: 70, ry: 46, period: 18, phase: 0.4, size: 6 },
  { rx: 116, ry: 77, period: 26, phase: 2.4, size: 9 },
  { rx: 162, ry: 108, period: 36, phase: 4.1, size: 10 },
  { rx: 208, ry: 139, period: 46, phase: 1.7, size: 8 },
  { rx: 254, ry: 170, period: 62, phase: 5.4, size: 17 },
  { rx: 300, ry: 201, period: 78, phase: 3.2, size: 15 },
  { rx: 346, ry: 232, period: 94, phase: 0.9, size: 12 },
  { rx: 392, ry: 263, period: 112, phase: 4.7, size: 12 },
].map(Object.freeze);

export function orbitPosition(orbit, elapsedSeconds) {
  const angle = orbit.phase + elapsedSeconds / orbit.period * Math.PI * 2;
  return { x: ORBIT_SCENE.cx + Math.cos(angle) * orbit.rx, y: ORBIT_SCENE.cy + Math.sin(angle) * orbit.ry };
}

export function advanceOrbitTime(elapsedSeconds, deltaMs, paused) {
  // Clamp hidden-tab gaps so resuming never makes the planets jump around the Sun.
  return paused ? elapsedSeconds : elapsedSeconds + Math.max(0, Math.min(100, deltaMs)) / 1000;
}
