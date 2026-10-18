import assert from 'node:assert/strict';
import test from 'node:test';
import { appendRibbonNode, buildRootRibbon, createRibbonBuffers, smoothRootPath, writeActiveTipCaps } from '../experimental/2_5d/gl/root-ribbon.js';
import { createGrowthLayer } from '../experimental/2_5d/gl/growth.js';
import { createSharedUniforms } from '../experimental/2_5d/gl/shading.js';
import { ROOT_PALETTE } from '../src/render/root-tissue.js';
import { createRhizosphereGeometry } from '../src/render/rhizosphere-geometry.js';

test('adjacent spans share the identical ring, birth, width and normal during growth', () => {
  const data = createRibbonBuffers(12), strand = {};
  appendRibbonNode(data, strand, { x: 0, y: 0, width: 14, born: 0 });
  appendRibbonNode(data, strand, { x: 1, y: -6, width: 13, born: .2, along: 6 });
  appendRibbonNode(data, strand, { x: 3, y: -12, width: 12, born: .4, along: 12 });
  const first = [...data.index.slice(0, 6)], second = [...data.index.slice(6, 12)];
  assert.deepEqual(first, [0, 1, 2, 2, 1, 3]);
  assert.deepEqual(second, [2, 3, 4, 4, 3, 5]);
  assert.deepEqual(first.filter(v => v === 2 || v === 3).sort(), [2, 2, 3]);
  for (const vertex of [2, 3]) {
    assert.equal(data.info[vertex * 4], 13);
    assert.ok(Math.abs(data.info[vertex * 4 + 1] - .2) < 1e-6);
    assert.ok(Math.abs(Math.hypot(...data.normal.slice(vertex * 2, vertex * 2 + 2)) - 1) < 1e-6);
  }
});

test('curved root stays finite, continuous, closed at real tips and retains original endpoints', () => {
  const points = [[10, -10], [10, -10], [12, -30], [26, -48], [28, -70]];
  const widths = [14, 14, 12, 8, 2];
  const path = smoothRootPath(points, widths, 3);
  assert.deepEqual([path[0].x, path[0].y], points[0]);
  assert.deepEqual([path.at(-1).x, path.at(-1).y], points.at(-1));
  assert.equal(path[0].width, 14); assert.equal(path.at(-1).width, 2);
  for (let i = 1; i < path.length; i++) {
    assert.ok(path[i].along > path[i - 1].along);
    assert.ok(Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y) < 5);
  }
  const data = buildRootRibbon(points, widths);
  for (const attr of ['point', 'previous', 'normal', 'info']) assert.ok(data[attr].every(Number.isFinite));
  assert.ok(data.info[0] < 1e-6, 'true start cap closes to zero radius');
  assert.ok(data.info[(data.vertices - 1) * 4] < 1e-6, 'true tip closes to zero radius');
  for (let i = 1; i < data.segments; i++) {
    const prev = data.index.slice((i - 1) * 6, i * 6), next = data.index.slice(i * 6, (i + 1) * 6);
    assert.equal(prev[2], next[0]); assert.equal(prev[5], next[1]);
  }
});

test('growing tips have a rounded cap whose first ring matches the extending body exactly', () => {
  const data = createRibbonBuffers(12), caps = createRibbonBuffers(12), strand = {};
  appendRibbonNode(data, strand, { x: 0, y: 0, width: 14, born: 0 });
  const tip = appendRibbonNode(data, strand, { x: 2, y: -6, width: 13, born: .2, along: 6 });
  writeActiveTipCaps(caps, data, [tip]);
  assert.equal(caps.segments, 4);
  for (const [name, size] of [['point', 2], ['previous', 3], ['normal', 2], ['info', 4]]) {
    assert.deepEqual(caps[name].slice(0, size * 2), data[name].slice(tip.vertex * size, (tip.vertex + 2) * size), name);
  }
  assert.equal(caps.info[(caps.vertices - 1) * 4], 0, 'active tip closes to zero radius');
  assert.ok(caps.point.every(Number.isFinite));
  const firstShape = [...caps.point.slice(0, caps.vertices * 2)];
  writeActiveTipCaps(caps, data, [tip]);
  assert.deepEqual([...caps.point.slice(0, caps.vertices * 2)], firstShape, 'fixed buffer is reused deterministically');
  writeActiveTipCaps(caps, data, []); assert.equal(caps.segments, 0);
});

test('root caps and normals remain well-behaved for tiny, duplicate and sharp inputs', () => {
  for (const points of [[[0, 0], [0, 0]], [[0, 0], [.0001, .0001]], [[0, 0], [0, -10], [1, -10], [1, -30]]]) {
    const data = buildRootRibbon(points, points.map(() => 2));
    for (const attr of ['point', 'previous', 'normal', 'info']) assert.ok(data[attr].every(Number.isFinite));
    for (const node of data.nodes) assert.ok(Math.abs(Math.hypot(node.nx, node.ny) - 1) < 1e-6);
  }
});

test('seeded parallax growth is reproducible, finite, bounded and uses shared rings', () => {
  const make = () => {
    const layer = createGrowthLayer({ shared: createSharedUniforms(), z: -130, seed: 12, maxSegments: 2400 });
    layer.spawn({ x: 0, y: 0, angle: -Math.PI / 2, width: 11, maxLength: 400 });
    layer.prewarm(18);
    return layer;
  };
  const a = make(), b = make();
  assert.equal(a.segments, b.segments); assert.ok(a.segments > 60 && a.segments <= 2400);
  for (const name of ['aPoint', 'aNormal', 'aInfo']) {
    assert.deepEqual(a.mesh.geometry.attributes[name].array, b.mesh.geometry.attributes[name].array);
    assert.ok(a.mesh.geometry.attributes[name].array.every(Number.isFinite));
  }
  const index = a.mesh.geometry.index.array;
  assert.deepEqual([...index.slice(0, 12)], [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5]);
  a.dispose(); b.dispose();
});

test('exhausting the body budget freezes fronts and preserves every active tip cap', () => {
  for (const maxLength of [400, 60]) {
    const layer = createGrowthLayer({ shared: createSharedUniforms(), z: -130, seed: 12,
      maxSegments: 12, maxGeneration: 0 });
    layer.spawn({ x: 0, y: 0, angle: -Math.PI / 2, width: 14, speed: 60, maxLength });
    layer.prewarm(10);
    assert.equal(layer.exhausted, true);
    assert.equal(layer.tips, 1, 'the last body ring remains represented after exhaustion');
    assert.ok(layer.segments <= 12);
    const cap = layer.mesh.children[0];
    assert.equal(cap.geometry.drawRange.count, 4 * 6, 'the independent cap survives a full body pool');
    const segmentCount = layer.segments;
    const lastWidth = cap.geometry.attributes.aInfo.array[0];
    assert.ok(lastWidth > 0);
    for (let frame = 0; frame < 30; frame++) layer.step(1 / 60, frame / 60);
    assert.equal(layer.segments, segmentCount);
    assert.equal(cap.geometry.drawRange.count, 4 * 6);
    layer.dispose();
  }
});

test('foreground keeps the original Canvas cell texture instead of a GPU body replacement', () => {
  const cells = [], fills = new Set();
  const state = { time: 0, campaign: { unlocks: {} }, level: {
    platforms: [{ x: 220, y: 400, w: 180, h: 64, type: 'root' }],
  } };
  const geometry = createRhizosphereGeometry({ state, painters: {
    rootPalette: ROOT_PALETTE, paintSoilTexture() {},
    soilPalette: { base: '#3a2115', outline: '#24140d', silt: ['#613c28', '#523120'], aggregates: ['#472a1b', '#301b11', '#402417'] },
  } });
  const context = new Proxy({
    globalAlpha: 1,
    // An obsolete collector must never suppress the author-painted bodies.
    __glRootTube() { throw new Error('foreground root art was intercepted'); },
    roundRect(...args) { cells.push(args); },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    measureText() { return { width: 80 }; },
  }, {
    get: (target, name) => target[name] ?? (() => {}),
    set(target, name, value) { if (name === 'fillStyle' && typeof value === 'string') fills.add(value); target[name] = value; return true; },
  });
  geometry.draw(context, { left: -100, right: 800, top: -100, bottom: 900 }, () => 42);
  assert.ok(cells.length > 50, 'authored layered cells are still painted');
  assert.ok(fills.size > 12, 'original tissue and illustration retain their color variation');
});
