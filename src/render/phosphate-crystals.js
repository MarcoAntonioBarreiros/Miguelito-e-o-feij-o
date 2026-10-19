// Mineral illustration shared by Canvas and the WebGL effects surface.
// Geometry is seeded locally; drawing never consumes the simulation RNG.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rasterCache = new WeakMap();

function seedHash(value) {
  let h = 2166136261;
  for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function randomFor(seed) {
  let value = seedHash(seed);
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function polygon(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function tint(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }

/** Normalized, immutable-at-render-time anatomy; the existing hitbox is untouched. */
export function createPhosphateCrystalGeometry(deposit) {
  const seed = `${deposit.visualSeed ?? deposit.id ?? 'phosphate'}:${deposit.x ?? 0}:${deposit.y ?? 0}`;
  const rnd = randomFor(seed);
  const hue = [305, 321, 333][Math.floor(rnd() * 3)] + rnd() * 9;
  const center = .44 + rnd() * .13;
  const family = Math.floor(rnd() * 3);
  const leftHeight = family === 0 ? .72 : family === 1 ? .49 : .64;
  const rightHeight = family === 0 ? .52 : family === 1 ? .76 : .67;
  const shards = [];
  const add = (bx, tx, height, width, front = false) => shards.push({
    bx, tx, height, width, base: .028 + rnd() * .035,
    shoulder: .16 + rnd() * .1, ridge: -.22 + rnd() * .36,
    hue: hue - 12 + rnd() * 18, shade: rnd(), front,
    reflection: .32 + rnd() * .28, phase: rnd() * TAU,
  });
  // Back fan: irregular direction, unequal pairs, no repeated five-column fence.
  add(.43, .09 + rnd() * .1, .48 + rnd() * .18, .16 + rnd() * .05);
  add(.57, .81 + rnd() * .1, .49 + rnd() * .2, .14 + rnd() * .06);
  add(.43, .26 + rnd() * .09, leftHeight + rnd() * .14, .20 + rnd() * .04);
  add(.59, .69 + rnd() * .09, rightHeight + rnd() * .14, .17 + rnd() * .06);
  add(center, center - .035 + rnd() * .07, .98, .29 + rnd() * .055);
  shards[4].dominant = true;
  add(.41, .18 + rnd() * .08, .27 + rnd() * .17, .14 + rnd() * .04, true);
  add(.58, .78 + rnd() * .1, .3 + rnd() * .18, .13 + rnd() * .04, true);
  add(.44, .32 + rnd() * .08, .43 + rnd() * .16, .19 + rnd() * .035, true);
  add(.60, .64 + rnd() * .1, .48 + rnd() * .16, .21 + rnd() * .035, true);
  const smallCount = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < smallCount; i++) {
    const bx = .22 + rnd() * .57;
    add(bx, clamp(bx + (rnd() - .5) * .22, .1, .9), .12 + rnd() * .20, .09 + rnd() * .06, true);
  }
  const rocks = Array.from({ length: 6 + Math.floor(rnd() * 3) }, (_, i) => ({
    x: .06 + (i / 8) * .86 + rnd() * .04,
    width: .11 + rnd() * .12, height: .025 + rnd() * .035,
    shade: rnd(), skew: (rnd() - .5) * .06,
  }));
  return { seed, hue, family, shards, rocks };
}

function prismPoints(shard, w, h, ratio) {
  // The central spine keeps the blocking height legible until the real deposit
  // is depleted; only the outer growth erodes on a partial solubilization.
  const shrink = shard.dominant ? 1 : .40 + .60 * ratio;
  const yBase = -shard.base * h;
  const yTip = -shard.height * h * shrink;
  const height = yBase - yTip;
  const bx = shard.bx * w, tx = shard.tx * w, half = shard.width * w * .5;
  const shoulderY = yTip + height * shard.shoulder;
  const axis = bx + (tx - bx) * (1 - shard.shoulder);
  const point = (x, y) => [clamp(x, w * .015, w * .985), y];
  return {
    tip: point(tx, yTip),
    left: point(axis - half * .94, shoulderY),
    right: point(axis + half * .88, shoulderY + height * .025),
    ridge: point(axis + half * shard.ridge, shoulderY + height * .08),
    bl: point(bx - half * .87, yBase),
    br: point(bx + half * .83, yBase + h * .01),
    bm: point(bx + half * .10, yBase + h * .006),
  };
}

function drawPrism(ctx, shard, w, h, ratio) {
  const p = prismPoints(shard, w, h, ratio);
  const { tip: t, left: l, right: r, ridge: m, bl, br, bm } = p;
  const hue = shard.hue, dark = tint(hue - 22, 44, 20);
  const edge = clamp(w * .013, .55, 1.45);
  const front = ctx.createLinearGradient(l[0], l[1], bm[0], bm[1]);
  front.addColorStop(0, tint(hue, 81, 70 + shard.shade * 6));
  front.addColorStop(.48, tint(hue - 3, 74, 53 + shard.shade * 5));
  front.addColorStop(1, tint(hue - 20, 58, 31));
  const side = ctx.createLinearGradient(m[0], m[1], br[0], br[1]);
  side.addColorStop(0, tint(hue - 19, 69, 44));
  side.addColorStop(1, tint(hue - 27, 55, 24));
  polygon(ctx, [l, bl, bm, m], front);
  polygon(ctx, [m, bm, br, r], side);
  polygon(ctx, [t, l, m], tint(hue + 7, 91, 86));
  polygon(ctx, [t, m, r], tint(hue - 5, 77, 59));

  // Large angular inclusions and long translucent facets, not texture noise.
  ctx.save();
  polygon(ctx, [l, bl, bm, m]); ctx.clip();
  const bandY = l[1] + (bl[1] - l[1]) * shard.reflection;
  polygon(ctx, [l, [l[0] + w * .075, l[1] + h * .01],
    [bm[0] - w * .025, bm[1]], bl], 'rgba(255,228,238,.27)');
  polygon(ctx, [[l[0] - w * .12, bandY + h * .15], [m[0] + w * .13, bandY - h * .13],
    [m[0] + w * .13, bandY - h * .065], [l[0] - w * .12, bandY + h * .20]], 'rgba(255,220,239,.16)');
  polygon(ctx, [[l[0], bandY - h * .1], [m[0], bandY + h * .035],
    [bm[0] - w * .02, bandY + h * .21]], tint(hue - 19, 74, 36, .24));
  if (ratio < .98) {
    ctx.strokeStyle = `rgba(255,229,245,${(1 - ratio) * .65})`; ctx.lineWidth = edge * .75;
    ctx.beginPath(); ctx.moveTo(l[0], bandY + h * .08);
    ctx.lineTo(l[0] + w * .055, bandY + h * .05);
    ctx.lineTo(l[0] + w * .043, bandY + h * .13);
    ctx.lineTo(m[0], bandY + h * .19); ctx.stroke();
  }
  ctx.restore();

  ctx.lineJoin = 'round';
  polygon(ctx, [t, l, bl, bm, br, r], null, dark, edge);
  ctx.strokeStyle = tint(hue - 30, 50, 25, .75); ctx.lineWidth = edge * .8;
  ctx.beginPath(); ctx.moveTo(...t); ctx.lineTo(...m); ctx.lineTo(...bm);
  ctx.moveTo(...l); ctx.lineTo(...m); ctx.lineTo(...r); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,239,244,.85)'; ctx.lineWidth = edge * .65;
  ctx.beginPath();
  ctx.moveTo(t[0] - edge * .3, t[1] + edge * 2);
  ctx.lineTo(l[0] + edge, l[1]); ctx.lineTo(bl[0] + edge, bl[1] - h * .05);
  ctx.moveTo(...l); ctx.lineTo(...m); ctx.stroke();
}

function drawMineralBody(ctx, geometry, w, h, ratio) {
  // Subtle contact shadow, confined to the footprint of the old mineral block.
  const ground = ctx.createLinearGradient(0, -h * .045, 0, 0);
  ground.addColorStop(0, 'rgba(35,13,37,0)'); ground.addColorStop(1, 'rgba(24,10,27,.65)');
  ctx.fillStyle = ground; ctx.fillRect(w * .02, -h * .05, w * .96, h * .05);
  for (const shard of geometry.shards) drawPrism(ctx, shard, w, h, ratio);
  for (const rock of geometry.rocks) {
    const x = Math.min(w * .88, rock.x * w), rw = rock.width * w;
    const top = -rock.height * h;
    const a = [clamp(x - rw * .5, 0, w), -h * .008];
    const b = [clamp(x - rw * .29, 0, w), top * .76];
    const c = [clamp(x + rock.skew * w, 0, w), top];
    const d = [clamp(x + rw * .48, 0, w), top * .35];
    const e = [clamp(x + rw * .40, 0, w), 0];
    polygon(ctx, [a, b, c, d, e], tint(geometry.hue - 12, 32, 27 + rock.shade * 13), '#45273e', clamp(w * .01, .5, 1));
    polygon(ctx, [b, c, d, [x, top * .42]], tint(geometry.hue + 6, 52, 63 + rock.shade * 8));
    polygon(ctx, [a, b, [x, top * .42], [x + rw * .04, 0]], tint(geometry.hue - 8, 40, 43));
  }
}

function createRaster(geometry, w, h, ratio) {
  if (typeof document === 'undefined' && typeof OffscreenCanvas === 'undefined') return null;
  const scale = 2;
  const canvas = typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale))
    : Object.assign(document.createElement('canvas'), { width: Math.ceil(w * scale), height: Math.ceil(h * scale) });
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(scale, 0, 0, scale, 0, h * scale);
  drawMineralBody(ctx, geometry, w, h, ratio);
  return canvas;
}

function drawGlints(ctx, geometry, w, h, ratio, time) {
  for (let i = 0; i < geometry.shards.length; i++) {
    if (i % 2 && i > 5) continue;
    const shard = geometry.shards[i];
    const flash = Math.pow(Math.max(0, Math.sin(time * (.72 + shard.shade * .30) + shard.phase)), 16);
    if (flash < .012) continue;
    const p = prismPoints(shard, w, h, ratio);
    const mix = .2 + shard.reflection * .72;
    const x = p.left[0] * (1 - mix) + p.bm[0] * mix + w * .028;
    const y = p.left[1] * (1 - mix) + p.bm[1] * mix;
    const size = clamp(w * .037, 1.05, 3) * (.5 + flash * .5);
    ctx.globalAlpha = flash * (.66 + ratio * .34);
    const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 3.3);
    halo.addColorStop(0, 'rgba(255,230,246,.65)'); halo.addColorStop(1, 'rgba(255,140,215,0)');
    ctx.fillStyle = halo; ctx.fillRect(x - size * 3.3, y - size * 3.3, size * 6.6, size * 6.6);
    polygon(ctx, [[x, y - size * 1.5], [x + size * .22, y - size * .22], [x + size, y],
      [x + size * .22, y + size * .22], [x, y + size * 1.5], [x - size * .22, y + size * .22],
      [x - size, y], [x - size * .22, y - size * .22]], '#fff3f9');
  }
  ctx.globalAlpha = 1;
}

/** Draw-only: stock, collider, world position and event VFX remain owned by the game. */
export function drawPhosphateCrystalCluster(ctx, deposit, time = 0, options = {}) {
  if (deposit.broken || !(deposit.w > 0 && deposit.h > 0)) return;
  const ratio = clamp((deposit.remainingPhosphate ?? 1) / (deposit.initialPhosphate || 1), 0, 1);
  // Stock changes discretely on impact. Bucketing bounds raster rebuilds during fades.
  const bucket = Math.round(ratio * 100) / 100;
  // A small skirt fans towards the inside of the host platform. Its right edge
  // stays at the original footprint; the tall central point stays in the hitbox.
  // This changes illustration only, never the blocking 58px-wide game object.
  const width = deposit.visualWidth || deposit.w * 1.65;
  const signature = `${deposit.visualSeed ?? deposit.id}:${deposit.x}:${deposit.y}:${width}:${deposit.h}`;
  let cache = rasterCache.get(deposit);
  if (!cache || cache.signature !== signature) {
    cache = { signature, geometry: createPhosphateCrystalGeometry(deposit), ratio: -1 };
    rasterCache.set(deposit, cache);
  }
  if (cache.ratio !== bucket && options.cache !== false) {
    cache.canvas = createRaster(cache.geometry, width, deposit.h, bucket);
    cache.ratio = bucket;
  }
  ctx.save();
  ctx.translate(deposit.x + deposit.w - width, deposit.y + deposit.h);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = .85 + ratio * .15;
  if (cache.canvas && options.cache !== false) ctx.drawImage(cache.canvas, 0, -deposit.h, width, deposit.h);
  else drawMineralBody(ctx, cache.geometry, width, deposit.h, bucket);
  if (options.glints !== false) drawGlints(ctx, cache.geometry, width, deposit.h, ratio, Number(time) || 0);
  ctx.restore();
}
