// Physical size of the existing beam, calibrated at the desktop default
// (1280 x 720, zoom 1.45). Camera zoom must never change its energy or width.
export const SHAFT_REFERENCE_WIDTH = 1280 / 1.45;
export const SHAFT_REFERENCE_HEIGHT = 720 / 1.45;
export const SHAFT_REACH_X = 1600;

export function shaftSourceY(topY) { return -(topY - 1300); }

export function visibleShafts(xs, centerX) {
  return xs.map((x, idx) => ({ x, idx, d: Math.abs(x - centerX) }))
    .filter(s => s.d < SHAFT_REACH_X)
    .sort((a, b) => a.d - b.d).slice(0, 2);
}

export function shaftWorldPoint(uv, camera) {
  return { x: camera.x + uv.x * camera.width, y: -(camera.y + (1 - uv.y) * camera.height) };
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const hash = x => fract(Math.sin(x * 127.1) * 43758.5453);
const noise = x => { const i = Math.floor(x), f = fract(x), t = f * f * (3 - 2 * f); return hash(i) * (1 - t) + hash(i + 1) * t; };
const streakAt = (angle, time) => smooth(.45, .95, noise(angle * 24 + time * .04) * .65 + noise(angle * 47 - time * .06) * .35);

// CPU references for geometry tests only. Production volume AND particles use
// the exact same GLSL below (sin/hash precision differs between JS and GPUs).
export function shaftStreak(delta, time) {
  return streakAt(Math.atan2(delta.x / SHAFT_REFERENCE_WIDTH, delta.y / SHAFT_REFERENCE_HEIGHT), time);
}
export function shaftCone(delta) { return 1 - smooth(.05, .8, Math.abs(delta.x / SHAFT_REFERENCE_WIDTH) * 1.4); }
export function shaftParticleCore(delta, time) {
  if (delta.y <= 0) return 0;
  const angle = Math.atan2(delta.x / SHAFT_REFERENCE_WIDTH, delta.y / SHAFT_REFERENCE_HEIGHT);
  const contrast = Math.max(streakAt(angle, time), streakAt(angle - .011, time) * .92, streakAt(angle + .011, time) * .92,
    streakAt(angle - .022, time) * .75, streakAt(angle + .022, time) * .75);
  return smooth(.12, .42, contrast) * smooth(.02, .20, streakAt(angle, time)) * smooth(.08, .25, shaftCone(delta));
}

// CPU reference used by the zoom regression test; shader uses the same units.
export function shaftEnvelope(point, source) {
  const dx = (source.x - point.x) / SHAFT_REFERENCE_WIDTH;
  const dy = (source.y - point.y) / SHAFT_REFERENCE_HEIGHT;
  if (dy <= 0) return 0;
  const t = Math.max(0, Math.min(1, (Math.abs(dx) * 1.4 - .05) / .75));
  return Math.exp(-Math.hypot(dx * 1.6, dy) * 1.6) * (1 - t * t * (3 - 2 * t));
}

export const SHAFT_PROFILE_GLSL = /* glsl */`
vec2 shaftWorldPoint(vec2 uv) {
  return vec2(uCam.x + uv.x * uCam.z, -(uCam.y + (1.0 - uv.y) * uCam.w));
}
vec2 shaftUv(vec2 p) {
  return vec2((p.x - uCam.x) / uCam.z, 1.0 - (-p.y - uCam.y) / uCam.w);
}
vec2 shaftReferenceDelta(vec2 d) {
  return d / vec2(${SHAFT_REFERENCE_WIDTH.toFixed(8)}, ${SHAFT_REFERENCE_HEIGHT.toFixed(8)});
}
float shaftHash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float shaftNoise(float x) {
  float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(shaftHash(i), shaftHash(i + 1.0), f);
}
float shaftStreakAtAngle(float angle, float time) {
  float s = shaftNoise(angle * 24.0 + time * .04) * .65 + shaftNoise(angle * 47.0 - time * .06) * .35;
  return smoothstep(.45, .95, s);
}
float shaftStreak(vec2 worldDelta, float time) {
  vec2 d = shaftReferenceDelta(worldDelta);
  return shaftStreakAtAngle(atan(d.x, d.y), time);
}
float shaftCone(vec2 worldDelta) {
  return 1.0 - smoothstep(.05, .8, abs(worldDelta.x / ${SHAFT_REFERENCE_WIDTH.toFixed(8)}) * 1.4);
}
float shaftParticleCore(vec2 worldDelta, float time) {
  if (worldDelta.y <= 0.0) return 0.0;
  vec2 d = shaftReferenceDelta(worldDelta);
  float angle = atan(d.x, d.y);
  // Broaden each actual luminous ridge symmetrically, rather than drawing a
  // separate vertical column. The broad ambient pedestal is never included.
  float contrast = shaftStreakAtAngle(angle, time);
  contrast = max(contrast, .92 * shaftStreakAtAngle(angle - .011, time));
  contrast = max(contrast, .92 * shaftStreakAtAngle(angle + .011, time));
  contrast = max(contrast, .75 * shaftStreakAtAngle(angle - .022, time));
  contrast = max(contrast, .75 * shaftStreakAtAngle(angle + .022, time));
  // Widen inside the visible ridge; never bridge an unlit gap between ridges.
  return smoothstep(.12, .42, contrast) * smoothstep(.02, .20, shaftStreakAtAngle(angle, time)) * smoothstep(.08, .25, shaftCone(worldDelta));
}
`;
