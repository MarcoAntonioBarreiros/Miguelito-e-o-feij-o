// A surface coating, not the biological area of protection. All dimensions here
// are visual; film.radius and every simulation threshold keep their old meaning.
import { drawInoculatedBacillusSprite } from './bacillus-sprite.js';
import { visibleRootRect } from './rhizosphere-geometry.js';

const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const smooth = (lo, hi, value) => { const t = clamp((value - lo) / (hi - lo)); return t * t * (3 - 2 * t); };
const noise = (seed, i) => { const n = Math.sin(seed * .173 + i * 127.1) * 43758.5453; return n - Math.floor(n); };
const cache = new WeakMap();

const TAU = Math.PI * 2;

export function biofilmVisualState({ entry = null, colony = entry?.colony, film = entry?.film, progress = null } = {}) {
  // Ecological film.growth also advances independently in gameplay.update. It
  // must NEVER replace the Bacillus lifecycle's maturity for a managed colony.
  const maturity = clamp(entry ? entry.maturity : progress ?? film?.growth ?? 1);
  const mode = entry?.mode || film?.bacillusMode || 'matrix';
  const vigor = clamp(colony?.vigor ?? 1);
  const spores = mode === 'spores';
  const sporulation = mode === 'sporulating' ? clamp(entry?.sporulation || 0) : 0;
  return {
    maturity, vigor, mode,
    functional: Boolean(film?.functional ?? (!entry && maturity >= .42)),
    adhesion: smooth(.06, .26, maturity),
    matrix: smooth(.12, .42, maturity),
    expansion: smooth(.24, .74, maturity),
    maturation: smooth(.65, 1, maturity),
    hydration: spores ? 0 : (1 - sporulation * .82) * (.48 + vigor * .52),
    activity: clamp(entry?.activePressure || 0),
    antibiotic: clamp(entry?.antibioticReserve || 0),
    sourceCount: clamp(colony?.sourceCount ?? 3, 1, 8),
  };
}

export function biofilmSurface({ film, colony, entry, platform = colony?.platform || film?.platform, platforms = [] }) {
  const x = film?.checkpoint?.x ?? colony?.x ?? film?.x ?? entry?.colony?.x ?? 0;
  const y = film?.checkpoint ? film.checkpoint.y + 8 : colony?.y ?? film?.y ?? 0;
  // Natural checkpoints have no platform reference. Resolve their actual host
  // only for painting; do not attach/change any simulation object.
  if (!platform) {
    let best = 110;
    for (const p of platforms) {
      if (p.final || p.mycorrhizaStructure) continue;
      const d = Math.hypot(x - clamp(x, p.x, p.x + p.w), y - p.y);
      if (d < best) { platform = p; best = d; }
    }
  }
  const rect = platform ? visibleRootRect(platform) : null;
  const left = rect ? rect.x + 6 : x - 90;
  const right = rect ? rect.x + rect.w - 6 : x + 90;
  const center = clamp(x, left + 2, right - 2);
  const seed = Math.round(x * 13 + y * 7 + (platform?.logicIndex || 0) * 83);
  return { x: center, y: rect?.y ?? y + 7, left, right, band: clamp(rect?.h || 18, 14, 24), seed };
}

export function buildBiofilmProfile(surface, visual, time = 0) {
  const m = visual.maturity;
  const spread = .12 + .88 * smooth(.09, .82, m);
  const reach = 80 + visual.sourceCount * 10;
  const left = Math.max(surface.left, surface.x - reach * spread * (.94 + noise(surface.seed, 1) * .15));
  const right = Math.min(surface.right, surface.x + reach * spread * (.94 + noise(surface.seed, 2) * .15));
  const center = (left + right) / 2;
  const half = Math.max(1, (right - left) / 2);
  const bridge = smooth(.34, .42, m);
  const eps = smooth(.12, .29, m) * visual.hydration;
  const samples = [];
  for (let i = 0; i <= 80; i++) {
    const u = i / 80;
    const x = left + (right - left) * u;
    const envelope = Math.pow(Math.max(0, 1 - ((x - center) / half) ** 2), .48);
    let density = 0;
    for (let k = 0; k < 9; k++) {
      const at = (k + .25 + noise(surface.seed, 10 + k) * .5) / 9;
      const onset = .13 + Math.abs(at - .5) * .30 + noise(surface.seed, 30 + k) * .025;
      const emergence = smooth(onset, onset + .11, m);
      const width = .015 + .058 * visual.matrix + noise(surface.seed, 50 + k) * .012;
      const d = (u - at) / width;
      density = Math.max(density, emergence * Math.exp(-d * d * 1.5));
    }
    const ripple = .83 + .12 * Math.sin(u * 25 + surface.seed) + .055 * Math.sin(u * 61 + surface.seed * .3);
    // Only restrained breathing/gloss uses time. Extent, density and thickness
    // cannot advance unless real maturity advances (same principle as nodules).
    const breath = Math.sin(time * 1.1 + u * 8 + surface.seed) * .24 * visual.matrix;
    const depth = Math.max(density, bridge * (.68 + .12 * Math.sin(u * 19 + surface.seed)));
    const height = depth * envelope * eps;
    samples.push({ x, top: surface.y - height * (10 + visual.expansion * 8) * ripple - breath * height,
      bottom: surface.y + height * (4 + visual.expansion * 6) * (1.08 - ripple * .2), height });
  }
  // Gaps are separate attached EPS islands early on; later the same heightfield
  // joins into one continuous film. There is no replacement at a stage boundary.
  const segments = [];
  let segment = [];
  for (const p of samples) {
    if (p.height > .025) segment.push(p);
    else if (segment.length) { if (segment.length > 1) segments.push(segment); segment = []; }
  }
  if (segment.length > 1) segments.push(segment);
  return { left, right, samples, segments };
}

function trace(ctx, points, reverse = false, edge = 'top', move = true) {
  const list = reverse ? [...points].reverse() : points;
  if (move) ctx.moveTo(list[0].x, list[0][edge]); else ctx.lineTo(list[0].x, list[0][edge]);
  for (let i = 1; i < list.length - 1; i++) {
    ctx.quadraticCurveTo(list[i].x, list[i][edge], (list[i].x + list[i + 1].x) / 2, (list[i][edge] + list[i + 1][edge]) / 2);
  }
  const last = list[list.length - 1]; ctx.lineTo(last.x, last[edge]);
}

function outline(ctx, profile) {
  ctx.beginPath();
  for (const points of profile.segments) {
    trace(ctx, points); trace(ctx, points, true, 'bottom', false); ctx.closePath();
  }
}

function paintGel(ctx, surface, visual, profile) {
  if (!profile.segments.length) return;
  const y = surface.y;
  outline(ctx, profile);
  const gel = ctx.createLinearGradient(0, y - 19, 0, y + 12);
  gel.addColorStop(0, 'rgba(177,250,201,.59)');
  gel.addColorStop(.36, 'rgba(102,215,156,.46)');
  gel.addColorStop(.7, 'rgba(57,170,123,.47)');
  gel.addColorStop(1, 'rgba(22,102,77,.62)');
  ctx.fillStyle = gel; ctx.fill();
  ctx.strokeStyle = 'rgba(24,111,82,.48)'; ctx.lineWidth = 1.1; ctx.stroke();
  // Broad refracted edge inside the gel, never an external halo.
  ctx.save(); outline(ctx, profile); ctx.clip();
  ctx.strokeStyle = 'rgba(168,255,199,.17)'; ctx.lineWidth = 5; ctx.stroke();
  ctx.restore();
}

function paintCells(ctx, surface, visual, profile, time) {
  const m = visual.maturity;
  const slots = 12;
  const spread = .2 + .8 * smooth(.10, .78, m);
  for (let k = 0; k < slots; k++) {
    // Stable low-discrepancy placement: daughter cells appear between the first
    // adherent cells. They do not orbit, float away or form a radial rosette.
    const u = k < 2 ? .43 + k * .16 : .055 + ((k * .61803398875) % 1) * .89;
    const onset = k < 2 ? .025 : .12 + (k - 2) * .047;
    const alpha = smooth(onset, onset + .10, m) * (.55 + visual.vigor * .45) * (1 - (1 - visual.hydration) * .7);
    if (alpha < .005) continue;
    const x = clamp(surface.x + (u - .5) * (profile.right - profile.left) * spread,
      surface.left + 7, surface.right - 7);
    const index = clamp(Math.round((x - profile.left) / Math.max(1, profile.right - profile.left) * 80), 0, 80);
    const p = profile.samples[index];
    const y = surface.y - (3.5 + visual.expansion * 1.3) + (noise(surface.seed, k + 100) - .5) * (3 + visual.expansion * 13);
    const width = 9.0 + noise(surface.seed, k + 120) * 3.4 + smooth(onset, onset + .15, m) * 1.3;
    ctx.save(); ctx.translate(x, Math.max(p.top + 5.5, y));
    ctx.rotate((noise(surface.seed, k + 140) - .5) * 2.1);
    const drawn = drawInoculatedBacillusSprite(ctx, 0, 0, width, null, time, k * 3.7, alpha);
    if (!drawn) {
      // Only an asset-loading fallback; the real game uses its unmodified sheet.
      ctx.globalAlpha = alpha; ctx.fillStyle = '#aa7ed8';
      ctx.beginPath(); ctx.roundRect(-3, -6, 6, 12, 3); ctx.fill();
    }
    ctx.restore();
  }
}

function paintGlaze(ctx, surface, visual, profile, time) {
  if (!profile.segments.length) return;
  ctx.save(); outline(ctx, profile); ctx.clip();
  ctx.fillStyle = 'rgba(164,255,199,.09)'; ctx.fill();
  for (const segment of profile.segments) {
    ctx.beginPath();
    trace(ctx, segment.map(p => ({ x: p.x, top: p.top + 2.0 })));
    ctx.strokeStyle = 'rgba(217,255,225,.38)'; ctx.lineWidth = .85; ctx.stroke();
    // Interrupted wet highlights follow the local surface instead of tracing
    // a solid neon border around the whole film.
    for (let k = 0; k < 3; k++) {
      const begin = Math.floor(segment.length * (.13 + k * .28));
      const end = Math.min(segment.length, begin + Math.max(2, Math.floor(segment.length * .10)));
      if (end - begin < 2) continue;
      ctx.beginPath(); trace(ctx, segment.slice(begin, end).map(p => ({ x: p.x, top: p.top + 3.2 })));
      ctx.strokeStyle = `rgba(243,255,229,${.20 + visual.maturation * .18})`;
      ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.stroke();
    }
  }
  // A few inclusions trapped in EPS, not emitted particles. Their locations are
  // fixed to the root and their brightness reflects real film vitality.
  for (let i = 0; i < 6; i++) {
    const u = .08 + noise(surface.seed, 180 + i) * .84;
    const p = profile.samples[Math.round(u * 80)];
    if (p.height < .2) continue;
    const r = .7 + noise(surface.seed, 200 + i) * 1.1;
    const y = p.top + (p.bottom - p.top) * (.32 + noise(surface.seed, 220 + i) * .45);
    ctx.strokeStyle = `rgba(187,255,224,${.18 + visual.vigor * .16})`;
    ctx.lineWidth = .65;
    ctx.beginPath(); ctx.ellipse(p.x, y, r, r * .75, -.3, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function paintRelief(ctx, surface, profile) {
  if (!profile.segments.length) return;
  outline(ctx, profile);
  const height = ctx.createLinearGradient(0, surface.y - 20, 0, surface.y + 12);
  height.addColorStop(0, '#000'); height.addColorStop(.42, '#dedede');
  height.addColorStop(.62, '#bcbcbc'); height.addColorStop(1, '#000');
  ctx.fillStyle = height; ctx.fill();
  ctx.save(); outline(ctx, profile); ctx.clip();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
}

function makeCanvas(ctx) {
  return ctx.canvas?.ownerDocument?.createElement?.('canvas')
    || (typeof document !== 'undefined' ? document.createElement('canvas') : null);
}

export function drawBacillusBiofilm(ctx, { entry = null, colony = entry?.colony, film = entry?.film,
  platform = colony?.platform || film?.platform, platforms = [], progress = null, key = entry || film || colony } = {}, time = 0) {
  const visual = biofilmVisualState({ entry, colony, film, progress });
  if (visual.hydration <= 0 || !key) return;
  const surface = biofilmSurface({ film, colony, entry, platform, platforms });
  const reach = (80 + visual.sourceCount * 10) * 1.1 + 8;
  const x0 = Math.max(surface.left - 2, surface.x - reach);
  const x1 = Math.min(surface.right + 2, surface.x + reach);
  const bounds = { x: x0, y: surface.y - 34, w: Math.max(4, x1 - x0), h: 53 };
  const transform = ctx.getTransform?.();
  if (transform && ctx.canvas?.width > 0 && ctx.canvas?.height > 0) {
    const corners = [[bounds.x, bounds.y], [bounds.x + bounds.w, bounds.y],
      [bounds.x, bounds.y + bounds.h], [bounds.x + bounds.w, bounds.y + bounds.h]]
      .map(([x, y]) => [transform.a * x + transform.c * y + transform.e, transform.b * x + transform.d * y + transform.f]);
    if (Math.max(...corners.map(p => p[0])) < -8 || Math.min(...corners.map(p => p[0])) > ctx.canvas.width + 8
      || Math.max(...corners.map(p => p[1])) < -8 || Math.min(...corners.map(p => p[1])) > ctx.canvas.height + 8) return;
  }
  let item = cache.get(key);
  if (!item) {
    item = { image: makeCanvas(ctx), relief: makeCanvas(ctx), revision: 0, stamp: '', lastTime: -Infinity };
    cache.set(key, item);
  }
  let profile = null;
  const paint = (target, relief = false) => {
    profile ||= buildBiofilmProfile(surface, visual, time);
    if (relief) { paintRelief(target, surface, profile); return; }
    paintGel(target, surface, visual, profile);
    paintCells(target, surface, visual, profile, time);
    paintGlaze(target, surface, visual, profile, time);
  };
  if (!item.image || !item.relief) { ctx.save(); paint(ctx); ctx.restore(); return; }
  // A bounded local patch retains sprite detail. It is uploaded only while its
  // own biology/animation changes, never as a full-screen extra texture.
  const scale = 2.5;
  // Moving a root/camera moves the patch pose, not its pixels. Only a change in
  // local host geometry should force a repaint between the bounded updates.
  const stamp = [visual.mode, surface.x - bounds.x, surface.left - bounds.x,
    surface.right - bounds.x, bounds.w].map(value => typeof value === 'number' ? value.toFixed(3) : value).join(':');
  if (stamp !== item.stamp || time < item.lastTime || time - item.lastTime >= 1 / 24) {
    for (const [canvas, relief] of [[item.image, false], [item.relief, true]]) {
      const w = Math.max(2, Math.ceil(bounds.w * scale)), h = Math.ceil(bounds.h * scale);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const target = canvas.getContext('2d');
      target.setTransform(1, 0, 0, 1, 0, 0); target.clearRect(0, 0, canvas.width, canvas.height);
      target.setTransform(scale, 0, 0, scale, -bounds.x * scale, -bounds.y * scale);
      paint(target, relief);
    }
    item.revision++; item.stamp = stamp; item.lastTime = time;
  }
  const packet = { key, image: item.image, relief: item.relief, ...bounds, revision: item.revision,
    activity: visual.functional ? .55 + visual.vigor * .45 : .15 + visual.vigor * .1 };
  if (typeof ctx.__glBiofilm === 'function' && ctx.__glBiofilm(packet) !== false) return;
  ctx.drawImage(item.image, bounds.x, bounds.y, bounds.w, bounds.h);
}
