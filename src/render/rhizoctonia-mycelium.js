// A read-only, persistent surface network. Colonization pays for apical
// extension; the rendering clock cannot grow or heal a root on its own.
import { angleDelta, createHyphalTip, smoothHyphalNoise } from '../procgen/hyphal-growth.js';
import { visibleRootRect } from './rhizosphere-geometry.js';

const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const smooth = (lo, hi, n) => { const t = clamp((n - lo) / (hi - lo)); return t * t * (3 - 2 * t); };
const noise = (seed, k) => { const n = Math.sin(seed * .173 + k * 127.1) * 43758.5453; return n - Math.floor(n); };
const models = new WeakMap();
const POINT_SPACING = 2.6;
export const RHIZOCTONIA_VISUAL_LIMITS = Object.freeze({ points: 720, branches: 34 });

function randomFor(seed) {
  let n = seed >>> 0;
  return () => { n += 0x6D2B79F5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function rhizoctoniaVisualBiology(enemy) {
  const root = enemy.hostPlatform;
  const bacillus = clamp(enemy.bacillusControl || 0);
  const iron = clamp(enemy.ironLimitation || 0);
  const suppression = clamp(enemy.trichodermaSuppression || 0);
  return {
    colonization: clamp(enemy.colonization || 0),
    damage: clamp(Math.max(root?.rootDamage || 0, 1 - (root?.rootHealth ?? 1))),
    contact: clamp(enemy.trichodermaContact || 0),
    lysis: clamp(enemy.trichodermaLysis || 0),
    control: clamp(bacillus * .74 + iron * .34),
    activity: enemy.alive === false ? 0 : (enemy.contained ? .035 : 1)
      * (1 - clamp(bacillus * .74 + iron * .34)) * (1 - suppression * .96),
  };
}

function addTip(model, x, y, angle, depth, parent = null) {
  const tip = createHyphalTip({ x, y, angle, depth, mode: 'root-surface',
    seed: model.seed + model.tips.length * 2.731, parentId: parent?.id || null, random: model.random });
  tip.id = `surface-${model.tips.length}`;
  tip.side = Math.cos(angle) < 0 ? -1 : 1;
  tip.nextBranch = 15 + model.random() * 15;
  tip.initialAngle = angle;
  tip.parentAngle = parent?.angle ?? null;
  tip.points[0].level = model.currentC;
  tip.points[0].order = model.points;
  model.tips.push(tip);
  return tip;
}

function createModel(enemy) {
  const host = enemy.hostPlatform;
  const rect = visibleRootRect(host);
  const seed = Math.round((enemy.infectionX || host.x) * 127 + host.y * 17 + (host.logicIndex || 0) * 8191);
  const model = { seed, random: randomFor(seed), width: host.w, band: clamp(rect.h, 14, 24),
    origin: clamp((enemy.infectionX ?? enemy.x + enemy.w / 2) - host.x, 8, host.w - 8),
    maxC: 0, currentC: 0, length: 0, points: 0, cursor: 0, tips: [],
    capacity: Math.min(1780, host.w * 6.7 + 80), biology: null };
  addTip(model, model.origin, model.band * .37, .08, 0);
  addTip(model, model.origin, model.band * .37, Math.PI - .12, 0);
  models.set(enemy, model);
  return model;
}

function extend(model, c) {
  const target = 5 + model.capacity * Math.pow(c, 1.25);
  const reach = 8 + model.width * c * .51;
  const left = Math.max(5, model.origin - reach), right = Math.min(model.width - 5, model.origin + reach);
  for (const tip of model.tips) {
    if (tip.blocked && tip.x > left + POINT_SPACING && tip.x < right - POINT_SPACING) {
      tip.active = true; tip.blocked = false;
    }
  }
  let attempts = 0;
  while (model.length + POINT_SPACING <= target && model.points < RHIZOCTONIA_VISUAL_LIMITS.points && attempts++ < 4000) {
    const tip = model.tips[model.cursor++ % model.tips.length];
    if (!tip.active) {
      if (!model.tips.some(t => t.active)) break;
      continue;
    }
    // The first daughter segment retains the near-right-angle fork. It then
    // bends into the host's long axis instead of drawing a suspended bridge.
    if (tip.totalDistance >= POINT_SPACING * 1.5 || tip.depth === 0) {
      const inward = (model.band * .47 - tip.y) * .16;
      const wave = smoothHyphalNoise(tip.x, tip.y, 0, tip.seed);
      const desired = Math.atan2(inward, tip.side * 9) + wave * .32 + Math.sin(tip.totalDistance * .14 + tip.seed) * .22;
      tip.angle += angleDelta(tip.angle, desired) * .29;
    }
    let x = tip.x + Math.cos(tip.angle) * POINT_SPACING;
    let y = tip.y + Math.sin(tip.angle) * POINT_SPACING;
    if (x < left || x > right) { tip.active = false; tip.blocked = true; continue; }
    if (y < 1 || y > model.band - .8) {
      // Turn inward before appending. Older vertices are never repositioned.
      tip.angle = Math.atan2(model.band * .47 - tip.y, tip.side * 6);
      x = tip.x + Math.cos(tip.angle) * POINT_SPACING;
      y = tip.y + Math.sin(tip.angle) * POINT_SPACING;
      if (x < left || x > right) { tip.active = false; tip.blocked = true; continue; }
    }
    tip.x = x; tip.y = clamp(y, .6, model.band - .6);
    tip.totalDistance += POINT_SPACING;
    model.length += POINT_SPACING; model.points++;
    const level = Math.pow(Math.max(0, model.length - 5) / model.capacity, 1 / 1.25);
    tip.points.push({ x: tip.x, y: tip.y, level, order: model.points });
    if (tip.totalDistance >= tip.nextBranch && tip.depth < 3 && model.tips.length < RHIZOCTONIA_VISUAL_LIMITS.branches) {
      tip.nextBranch += 20 + model.random() * 18;
      const side = tip.y < model.band * .45 ? 1 : -1;
      const angle = tip.angle + side * (Math.PI / 2 + (model.random() - .5) * .20);
      const child = addTip(model, tip.x, tip.y, angle, tip.depth + 1, tip);
      child.side = model.random() < .5 ? -1 : 1;
    }
  }
}

export function syncRhizoctoniaMycelium(enemy) {
  if (!enemy.hostPlatform) return null;
  const model = models.get(enemy) || createModel(enemy);
  const biology = rhizoctoniaVisualBiology(enemy);
  model.currentC = biology.colonization;
  // Fixed biology means fixed geometry, regardless of render rate or time.
  if (biology.colonization > model.maxC) {
    extend(model, biology.colonization);
    model.maxC = biology.colonization;
  }
  model.biology = biology;
  return model;
}

function worldPoint(enemy, model, point) {
  const root = enemy.hostPlatform, rect = visibleRootRect(root);
  return { x: root.x + point.x * root.w / model.width,
    y: root.y + point.y * clamp(rect.h, 14, 24) / model.band };
}

function integrity(model, point, branch) {
  const b = model.biology;
  if (b.lysis >= .999 || b.activity === 0 && b.colonization <= .061) return 0;
  const load = smooth(point.level - .11, point.level + .015, b.colonization);
  // Lysis opens stable gaps in the existing hypha, rather than making a whole
  // cloud dissolve uniformly or inventing spores. The scarring is separate.
  const erosionAt = .10 + noise(model.seed, point.order * .29 + branch * 13) * .70;
  const erosion = smooth(erosionAt, Math.min(1, erosionAt + .21), b.lysis);
  return load * (1 - erosion) * (1 - b.lysis * .24);
}

export function rhizoctoniaMyceliumSnapshot(enemy) {
  const model = syncRhizoctoniaMycelium(enemy);
  if (!model) return null;
  let remaining = 0;
  model.tips.forEach((tip, index) => tip.points.slice(1).forEach(p => { remaining += integrity(model, p, index) * POINT_SPACING; }));
  return { ...model.biology, peakColonization: model.maxC, points: model.points,
    branches: model.tips.length, totalLength: model.length, remainingLength: remaining,
    activeTips: model.tips.filter((tip, index) => tip.points.length > 1 && model.biology.activity > .08
      && integrity(model, tip.points[tip.points.length - 1], index) > .2).length,
    forks: model.tips.filter(tip => tip.parentId).map(tip => Math.abs(angleDelta(tip.parentAngle, tip.initialAngle))),
  };
}

export function rhizoctoniaContactPaths(enemy) {
  const model = syncRhizoctoniaMycelium(enemy);
  if (!model) return null;
  const paths = model.tips.filter(tip => tip.points.length > 3)
    .sort((a, b) => a.depth - b.depth || b.points.length - a.points.length).slice(0, 3)
    .map(tip => ({ points: tip.points.slice(0, Math.min(13, tip.points.length)).map(p => worldPoint(enemy, model, p)),
      width: 1.6 - tip.depth * .26,
      integrity: tip.points.slice(1, 8).reduce((sum, p) => sum + integrity(model, p, model.tips.indexOf(tip)), 0) / Math.max(1, Math.min(7, tip.points.length - 1)),
    }));
  return { anchor: worldPoint(enemy, model, { x: model.origin, y: model.band * .37 }), paths,
    colonization: model.biology.colonization, damage: model.biology.damage };
}

export function forgetRhizoctoniaMycelium(enemy) { models.delete(enemy); }

function drawNecrosis(ctx, enemy, model) {
  const host = enemy.hostPlatform, rect = visibleRootRect(host), damage = model.biology.damage;
  if (damage <= .012) return;
  const reach = 12 + host.w * model.maxC * .55;
  const origin = host.x + model.origin * host.w / model.width;
  const left = Math.max(host.x + 4, origin - reach), right = Math.min(host.x + host.w - 4, origin + reach);
  const columns = Math.min(64, Math.max(5, Math.ceil(host.w / 9)));
  ctx.save(); ctx.beginPath(); ctx.rect(host.x + 3, host.y, host.w - 6, rect.h); ctx.clip();
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < columns; col++) {
      const k = row * 71 + col;
      const x = host.x + (col + .5 + (noise(model.seed, k + 31) - .5) * .65) / columns * host.w;
      if (x < left || x > right) continue;
      const y = host.y + (row + .5) / 3 * rect.h;
      const near = clamp(1 - Math.abs(x - origin) / Math.max(1, reach));
      const onset = noise(model.seed, k + 90) * .43 + (1 - near) * .13;
      const severity = smooth(onset, onset + .19, damage) * (.4 + near * .6) * smooth(0, .18, near);
      if (severity < .012) continue;
      const rx = 4 + severity * 6 + noise(model.seed, k + 150) * 4;
      const ry = 1.5 + severity * 2.5 + noise(model.seed, k + 180) * 2;
      ctx.beginPath();
      for (let j = 0; j < 8; j++) {
        const a = j * Math.PI / 4, r = .75 + noise(model.seed, k * 11 + j + 220) * .32;
        const px = x + Math.cos(a) * rx * r, py = y + Math.sin(a) * ry * r;
        if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(66,43,29,${severity * (.18 + damage * .38)})`; ctx.fill();
      ctx.strokeStyle = `rgba(121,80,39,${severity * .25})`; ctx.lineWidth = .6; ctx.stroke();
      // Short cortical grain follows the original tissue; no replacement root.
      ctx.strokeStyle = `rgba(38,28,23,${severity * damage * .28})`;
      ctx.beginPath(); ctx.moveTo(x - rx * .55, y); ctx.quadraticCurveTo(x, y + .8, x + rx * .45, y - .4); ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawRhizoctoniaMycelium(ctx, enemy, state) {
  const host = enemy.hostPlatform;
  if (!host) return;
  const rect = visibleRootRect(host);
  const transform = ctx.getTransform?.();
  if (transform && ctx.canvas?.width > 0) {
    const left = transform.a * host.x + transform.e, right = transform.a * (host.x + host.w) + transform.e;
    const y = transform.d * host.y + transform.f;
    if (Math.max(left, right) < -24 || Math.min(left, right) > ctx.canvas.width + 24 || y < -40 || y > ctx.canvas.height + 40) return;
  }
  const model = syncRhizoctoniaMycelium(enemy);
  if (!model) return;
  ctx.save(); drawNecrosis(ctx, enemy, model);
  ctx.beginPath(); ctx.rect(host.x + 3, host.y - 1, host.w - 6, rect.h + 3); ctx.clip();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  model.tips.forEach((tip, branch) => {
    if (tip.points.length < 2) return;
    const width = (1.40 - tip.depth * .23) * (.85 + noise(model.seed, branch + 400) * .25);
    const points = tip.points.map(p => worldPoint(enemy, model, p));
    // Short continuous runs preserve local lysis gaps while bounding Canvas
    // stroke calls. This avoids one pair of strokes per stored vertex.
    const inactive = 1 - model.biology.activity;
    for (let start = 1; start < points.length; start += 6) {
      const end = Math.min(points.length, start + 6);
      let run = [], healthSum = 0;
      const paintRun = () => {
        if (run.length < 2) { run = []; healthSum = 0; return; }
        const health = healthSum / (run.length - 1);
        ctx.globalAlpha = health * (.28 + model.biology.activity * .34);
        const stroke = (color, thickness) => {
          ctx.strokeStyle = color; ctx.lineWidth = thickness;
          ctx.beginPath(); ctx.moveTo(run[0].x, run[0].y);
          for (let k = 1; k < run.length - 1; k++) {
            ctx.quadraticCurveTo(run[k].x, run[k].y,
              (run[k].x + run[k + 1].x) / 2, (run[k].y + run[k + 1].y) / 2);
          }
          ctx.lineTo(run[run.length - 1].x, run[run.length - 1].y); ctx.stroke();
        };
        stroke(inactive > .6 ? '#786f60' : '#806e51', width + .65);
        stroke(inactive > .6 ? '#a69c88' : '#bdb197', Math.max(.40, width * .55));
        run = []; healthSum = 0;
      };
      for (let i = start; i < end; i++) {
        const health = integrity(model, tip.points[i], branch);
        if (health < .025) { paintRun(); continue; }
        if (!run.length) run.push(points[i - 1]);
        run.push(points[i]); healthSum += health;
      }
      paintRun();
    }
    if (tip.depth > 0 && points.length > 2) {
      const a = points[1], b = points[2], len = Math.max(.01, Math.hypot(b.x - a.x, b.y - a.y));
      const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
      ctx.globalAlpha = integrity(model, tip.points[2], branch) * .55;
      ctx.strokeStyle = '#79664e'; ctx.lineWidth = .45;
      ctx.beginPath(); ctx.moveTo(b.x - nx * width, b.y - ny * width); ctx.lineTo(b.x + nx * width, b.y + ny * width); ctx.stroke();
    }
    const endpoint = tip.points[tip.points.length - 1];
    const health = integrity(model, endpoint, branch);
    if (health > .1 && model.biology.activity > .05) {
      const p = points[points.length - 1];
      ctx.globalAlpha = health * model.biology.activity * .40;
      ctx.fillStyle = '#cfc3a6'; ctx.beginPath(); ctx.ellipse(p.x, p.y, .8 + width * .25, .65, tip.angle, 0, Math.PI * 2); ctx.fill();
    }
  });
  ctx.restore();
}
