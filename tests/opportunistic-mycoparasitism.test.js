import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpportunisticCoils, drawOpportunisticMycoparasitism, opportunisticSearchPath } from '../src/render/opportunistic-mycoparasitism.js';

function substrate() {
  return { anchor: { x: 100, y: 200 }, paths: [{
    points: [{ x: 100, y: 200 }, { x: 140, y: 200 }, { x: 180, y: 200 }],
    width: 1.8, integrity: 1,
  }] };
}

test('contact helices remain supported by the actual opportunist hypha', () => {
  const source = substrate();
  const original = structuredClone(source);
  const coils = buildOpportunisticCoils(source, 1, .43);
  assert.equal(coils.length, 1);
  assert.ok(coils[0].points.length > 10);
  for (const point of coils[0].points) {
    assert.ok(point.x >= 100 && point.x <= 180);
    assert.ok(Math.abs(point.y - 200) <= 1.6, 'helix stays within the substrate radius');
  }
  assert.deepEqual(source, original, 'read-only geometry');
});

test('contact extends coils progressively and lysis fades them without consuming RNG', () => {
  const source = substrate();
  const oldRandom = Math.random;
  Math.random = () => { throw new Error('visual geometry consumed gameplay RNG'); };
  try {
    assert.deepEqual(buildOpportunisticCoils(source, 0), []);
    const early = buildOpportunisticCoils(source, .12)[0];
    const established = buildOpportunisticCoils(source, .8)[0];
    const lytic = buildOpportunisticCoils(source, .8, 0, .9)[0];
    assert.ok(early.points.at(-1).x < established.points.at(-1).x);
    assert.ok(lytic.opacity < established.opacity);
    source.paths[0].integrity = 0;
    assert.deepEqual(buildOpportunisticCoils(source, 1), []);
  } finally { Math.random = oldRandom; }
});

test('coil geometry has a fixed budget even on a large source network', () => {
  const source = substrate();
  source.paths = Array.from({ length: 40 }, () => ({
    points: [{ x: 0, y: 0 }, { x: 10000, y: 0 }], width: 3, integrity: 1,
  }));
  const coils = buildOpportunisticCoils(source, 1);
  assert.equal(coils.length, 8);
  assert.ok(coils.every(coil => coil.points.length <= 97));
});

test('search stalk retains its arrival but excludes mechanical sprite orbits', () => {
  const search = { mode: 'search', points: [{ x: 0, y: 200 }, { x: 60, y: 200 }] };
  assert.equal(opportunisticSearchPath(search, null, null), search.points);
  const coil = { mode: 'coil', points: [
    { x: 0, y: 200 }, { x: 40, y: 200 }, { x: 60, y: 200 },
    { x: 100, y: 160 }, { x: 140, y: 200 }, { x: 100, y: 240 },
  ] };
  const original = structuredClone(coil);
  const points = opportunisticSearchPath(coil, { x: 100, y: 200 }, substrate());
  assert.deepEqual(points, [coil.points[0], coil.points[1], coil.points[2], { x: 100, y: 200 }]);
  assert.deepEqual(coil, original);
  assert.deepEqual(opportunisticSearchPath({ mode: 'coil', points: [{ x: 110, y: 200 }] }, { x: 100, y: 200 }, substrate()), []);
  assert.deepEqual(opportunisticSearchPath(coil, null, null), []);
});

test('render draws supported contact without rings, neon or simulation mutations', () => {
  const source = substrate();
  const attack = { metadata: { contactLocked: true, contact: .8, phase: .23, lysis: .4 }, fading: 0 };
  const before = structuredClone({ source, attack });
  const calls = [];
  const context = new Proxy({ globalAlpha: .7 }, {
    get(target, property) {
      if (property in target) return target[property];
      return (...args) => { calls.push({ property, args }); };
    },
    set(target, property, value) { calls.push({ property, value }); target[property] = value; return true; },
  });
  drawOpportunisticMycoparasitism(context, source, attack, { cameraX: 50 });
  assert.ok(calls.some(call => call.property === 'stroke'));
  assert.ok(!calls.some(call => call.property === 'arc' || call.property === 'ellipse' || call.property === 'setLineDash'));
  assert.ok(calls.filter(call => call.property === 'shadowBlur').every(call => call.value === 0));
  assert.deepEqual({ source, attack }, before);
});
