import assert from 'node:assert/strict';
import test from 'node:test';
import { createRootGrowthProfile, ROOT_ARCHETYPES, rootGrowthHeading, rootGrowthWidth } from '../experimental/2_5d/gl/root-growth-profile.js';
import { createGrowthLayer, hashString } from '../experimental/2_5d/gl/growth.js';
import { createSharedUniforms } from '../experimental/2_5d/gl/shading.js';

const profile = (seed, extra = {}) => createRootGrowthProfile({ seed, length: 1700, ...extra });

test('seeded architecture contains four visibly different root families and reproduces exactly', () => {
  const types = new Set(), silhouettes = new Set();
  for (let seed = 1; seed <= 80; seed++) {
    const p = profile(seed);
    assert.deepEqual(profile(seed), p);
    types.add(p.archetype);
    silhouettes.add([p.archetype, p.girth.toFixed(2), p.taper.toFixed(2), p.bend.toFixed(2), p.branches.length].join(':'));
    assert.ok(p.girth >= 1.5 && p.girth <= 3.1, 'primary roots are trunks, not magnified fine hairs');
    assert.ok(p.branches.length <= 8, 'hierarchy remains bounded per root');
  }
  assert.deepEqual([...types].sort(), [...ROOT_ARCHETYPES].sort());
  assert.ok(silhouettes.size > 65, 'systems vary within each family rather than repeating four stamps');
});

test('root widths taper continuously and their long coherent curves avoid angular hinges', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const p = profile(seed);
    assert.equal(rootGrowthWidth(p, 0, 24), 24);
    assert.ok(rootGrowthWidth(p, p.length * .5, 24) < 18);
    assert.ok(rootGrowthWidth(p, p.length, 24) < 1);
    let previous = rootGrowthHeading(p, 0, -Math.PI / 2), min = previous, max = previous;
    for (let distance = 6; distance <= p.length; distance += 6) {
      const angle = rootGrowthHeading(p, distance, -Math.PI / 2);
      assert.ok(Number.isFinite(angle)); assert.ok(Math.abs(angle - previous) < .12);
      assert.ok(Math.abs(rootGrowthWidth(p, distance, 24) - rootGrowthWidth(p, distance - 6, 24)) < 1);
      previous = angle; min = Math.min(min, angle); max = Math.max(max, angle);
    }
    assert.ok(max - min > .24, 'the main axis has broad visible bends');
  }
});

test('laterals form asymmetric clusters, several widths/lengths and occasional strong secondary axes', () => {
  let unilateral = 0, crowns = 0;
  const widths = [], lengths = [], angles = [], gaps = [];
  for (let seed = 1; seed <= 80; seed++) {
    const p = profile(seed);
    const sides = new Set(p.branches.map(b => Math.sign(b.angle)));
    if (sides.size === 1) unilateral++;
    for (let i = 0; i < p.branches.length; i++) {
      const b = p.branches[i]; widths.push(b.width); lengths.push(b.length); angles.push(Math.abs(b.angle));
      if (b.width > .62 && b.length > .6) crowns++;
      if (i) { const gap = b.at - p.branches[i - 1].at; assert.ok(gap >= 15 - 1e-8); gaps.push(gap); }
    }
  }
  assert.ok(unilateral > 8 && crowns > 20);
  assert.ok(Math.max(...widths) / Math.min(...widths) > 3);
  assert.ok(Math.max(...lengths) / Math.min(...lengths) > 5);
  assert.ok(Math.max(...angles) - Math.min(...angles) > .8);
  assert.ok(Math.min(...gaps) < 45 && Math.max(...gaps) > 300, 'dense nodes alternate with long quiet trunk sections');
});

test('max generation and sparse depth settings keep hierarchy bounded', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const sparse = profile(seed, { branchSpacing: 2.2 });
    const deep = profile(seed, { branchSpacing: 1 });
    assert.ok(sparse.branches.length <= deep.branches.length);
    assert.equal(profile(seed, { generation: 2, maxGeneration: 2 }).branches.length, 0);
    assert.equal(profile(seed, { generation: 1, maxGeneration: 1 }).branches.length, 0);
  }
});

test('ten campaign seeds keep GPU budgets fixed and maintain robust tapered systems at phase scale', () => {
  for (let phase = 1; phase <= 10; phase++) {
    const layer = createGrowthLayer({ shared: createSharedUniforms(), z: -340,
      seed: hashString(`poc-seed:fase-${phase}`) ^ 0x51, maxSegments: 14000 });
    const rand = layer.random;
    for (let x = -200; x < 17000; x += 300 + rand() * 300) {
      layer.spawn({ x, y: 20, angle: -Math.PI / 2 + (rand() - .5) * .35,
        width: 6 + rand() * 5, speed: 34, maxLength: 1500 + rand() * 500 });
    }
    layer.prewarm(40);
    assert.ok(layer.segments <= 14000);
    assert.ok(layer.systems.length > 25 && layer.systems.length < 50);
    const widths = layer.systems.map(s => s.width);
    assert.ok(Math.max(...widths) > 22 && Math.max(...widths) < 34);
    assert.ok(new Set(layer.systems.map(s => s.profile.archetype)).size >= 3);
    const info = layer.mesh.geometry.attributes.aInfo.array;
    const point = layer.mesh.geometry.attributes.aPoint.array;
    assert.ok(info.every(Number.isFinite) && point.every(Number.isFinite));
    const index = layer.mesh.geometry.index.array;
    let area = 0;
    for (let i = 0; i < layer.segments; i++) {
      const a = index[i * 6], b = index[i * 6 + 2];
      const x = (point[a * 2] + point[b * 2]) * .5, y = (point[a * 2 + 1] + point[b * 2 + 1]) * .5;
      if (x < 200 || x > 1200 || y < -650 || y > -50 || info[a * 4 + 2] > .5) continue;
      area += Math.hypot(point[b * 2] - point[a * 2], point[b * 2 + 1] - point[a * 2 + 1]) * (info[a * 4] + info[b * 4]) * .5 * 1.6;
    }
    assert.ok(area / 600000 < .22, 'background trunks cannot fill the gameplay viewport');
    if (layer.exhausted) assert.ok(layer.mesh.children[0].geometry.drawRange.count > 0, 'budget saturation never removes the true tip caps');
    layer.dispose();
  }
});
