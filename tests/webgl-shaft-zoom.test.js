import test from 'node:test';
import assert from 'node:assert/strict';
import { shaftEnvelope, shaftSourceY, shaftWorldPoint, visibleShafts } from '../experimental/2_5d/gl/shaft-profile.js';

test('the same world point retains beam energy through player and cinematic zooms', () => {
  const source = { x: 730, y: shaftSourceY(200) };
  for (const point of [{ x: 730, y: -200 }, { x: 830, y: -100 }, { x: 610, y: 0 }]) {
    const expected = shaftEnvelope(point, source);
    for (const zoom of [.22, 1, 1.45, 1.8, 2.5]) {
      const camera = { x: 100, y: -100, width: 1280 / zoom, height: 720 / zoom };
      const uv = { x: (point.x - camera.x) / camera.width, y: 1 - (-point.y - camera.y) / camera.height };
      const actual = shaftEnvelope(shaftWorldPoint(uv, camera), source);
      assert.ok(Math.abs(expected - actual) < 1e-12);
    }
  }
});

test('shaft source and selection do not depend on camera zoom or screen size', () => {
  assert.equal(shaftSourceY(200), 1100);
  assert.deepEqual(visibleShafts([400, 1700, 3000, 4300], 1000).map(s => s.idx), [0, 1]);
  assert.deepEqual(visibleShafts([400, 1700, 3000, 4300], 3100).map(s => s.idx), [2, 3]);
});

test('beam envelope has finite width and illuminates only below its source', () => {
  const source = { x: 700, y: 1100 };
  assert.ok(shaftEnvelope({ x: 700, y: 0 }, source) > 0);
  assert.equal(shaftEnvelope({ x: 1700, y: 0 }, source), 0);
  assert.equal(shaftEnvelope({ x: 700, y: 1200 }, source), 0);
});
