import assert from 'node:assert/strict';
import test from 'node:test';
import { createPhosphateCrystalGeometry, drawPhosphateCrystalCluster } from '../src/render/phosphate-crystals.js';

const deposit = (id = 'test') => ({ id, x: 200, y: 80, w: 58, h: 210, remainingPhosphate: 1, initialPhosphate: 1, broken: false });
function context() {
  const points = [], gradients = [];
  let saves = 0, restores = 0;
  const ctx = new Proxy({
    save() { saves++; }, restore() { restores++; },
    moveTo(x, y) { points.push([x, y]); }, lineTo(x, y) { points.push([x, y]); },
    createLinearGradient() { const stops = []; gradients.push(stops); return { addColorStop: (n, c) => stops.push([n, c]) }; },
    createRadialGradient() { return { addColorStop() {} }; },
  }, { get: (o, k) => o[k] ?? (() => {}) });
  return { ctx, points, gradients, balance: () => saves - restores };
}

test('anatomy stays stable across frames, stock changes and serialization', () => {
  const d = deposit();
  const expected = createPhosphateCrystalGeometry(d);
  assert.deepEqual(createPhosphateCrystalGeometry({ ...JSON.parse(JSON.stringify(d)), remainingPhosphate: .2 }), expected);
  assert.equal(expected.shards.filter(s => s.dominant).length, 1);
  assert.ok(expected.shards.length >= 12);
});

test('different deposits vary in crown, palette and anatomy without global RNG', () => {
  const saved = Math.random;
  Math.random = () => { throw Error('Rendering must not consume game/VFX randomness'); };
  try {
    const shapes = Array.from({ length: 100 }, (_, i) => createPhosphateCrystalGeometry(deposit(`seed-${i}`)));
    assert.equal(new Set(shapes.map(s => JSON.stringify(s.shards))).size, 100);
    assert.equal(new Set(shapes.map(s => s.family)).size, 3);
    assert.ok(Math.max(...shapes.map(s => s.hue)) - Math.min(...shapes.map(s => s.hue)) > 25);
    const d = Object.freeze(deposit());
    const c = context();
    drawPhosphateCrystalCluster(c.ctx, d, 4, { cache: false });
    assert.equal(c.balance(), 0);
    assert.ok(c.points.length > 100);
  } finally { Math.random = saved; }
});

test('rendering preserves collider, stock and finite coordinates at narrow game sizes', () => {
  for (const [w, h] of [[58, 210], [30, 60], [58, 190], [145, 210]]) {
    for (const ratio of [1, .4, .01]) {
      const d = Object.freeze({ ...deposit(), w, h, remainingPhosphate: ratio });
      const before = JSON.stringify(d), c = context();
      drawPhosphateCrystalCluster(c.ctx, d, 3, { cache: false });
      assert.equal(JSON.stringify(d), before);
      assert.ok(c.points.every(p => p.every(Number.isFinite)));
      assert.ok(c.gradients.every(stops => stops.every(([n]) => n >= 0 && n <= 1)));
      assert.equal(c.balance(), 0);
    }
  }
});

test('partial stock keeps the blocking central height visible; broken means no crystal drawing', () => {
  const full = context(), partial = context(), broken = context();
  drawPhosphateCrystalCluster(full.ctx, deposit(), 0, { cache: false, glints: false });
  drawPhosphateCrystalCluster(partial.ctx, { ...deposit(), remainingPhosphate: .1 }, 0, { cache: false, glints: false });
  assert.equal(Math.min(...full.points.map(p => p[1])), Math.min(...partial.points.map(p => p[1])));
  drawPhosphateCrystalCluster(broken.ctx, { ...deposit(), broken: true }, 10);
  assert.equal(broken.points.length, 0);
});
