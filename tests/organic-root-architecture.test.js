import assert from 'node:assert/strict';
import test from 'node:test';
import { createCurvedTissueContext, drawRootTube, growPlantRoots } from '../src/render/root-architecture.js';
import { ROOT_PALETTE, paintRootTissueVertical, setTissueCull } from '../src/render/root-tissue.js';
import { createRhizosphereGeometry } from '../src/render/rhizosphere-geometry.js';

const config = () => ({
  plant: { x: 100, seed: 42 }, surface: 0, tipY: 900, mainWidth: 14, platforms: [],
  links: [{ index: 0, attachY: 400, entry: [300, 450], blockCenters: [[300, 450], [320, 450]], blockWidths: [14, 14] }],
});

function paintRecorder() {
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack = [], commands = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    save() { stack.push({ matrix: [...matrix], fill: this.fillStyle, stroke: this.strokeStyle, width: this.lineWidth }); },
    restore() { const s = stack.pop(); matrix = s.matrix; this.fillStyle = s.fill; this.strokeStyle = s.stroke; this.lineWidth = s.width; },
    translate(x, y) { matrix[4] += matrix[0] * x + matrix[2] * y; matrix[5] += matrix[1] * x + matrix[3] * y; },
    rotate(angle) {
      const c = Math.cos(angle), s = Math.sin(angle), [a, b, e, d, x, y] = matrix;
      matrix = [a * c + e * s, b * c + d * s, e * c - a * s, d * c - b * s, x, y];
    },
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, clip() {}, fill() {}, stroke() {}, arc() {},
    roundRect(...args) { commands.push({ type: 'cell', args, matrix: [...matrix], color: this.fillStyle, stroke: this.strokeStyle }); },
    ellipse(...args) { commands.push({ type: 'nucleus', args, matrix: [...matrix], color: this.fillStyle }); },
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  return { ctx, commands, stack };
}

test('optional organic architecture bends substantially and deterministically; default stays original', () => {
  const args = config(), input = JSON.stringify(args);
  const baseline = growPlantRoots(args), explicitOff = growPlantRoots({ ...args, organic: false });
  assert.deepEqual(explicitOff, baseline);
  const organic = growPlantRoots({ ...args, organic: true });
  assert.deepEqual(growPlantRoots({ ...args, organic: true }), organic);
  assert.equal(JSON.stringify(args), input, 'platform, link and plant inputs remain untouched');
  assert.equal(organic.roots.length, baseline.roots.length);
  const bends = organic.main.points.map((p, i) => p[0] - baseline.main.points[i][0]);
  assert.ok(Math.max(...bends) > 20 && Math.min(...bends) < -20, 'long living curves are visible at gameplay scale');
  assert.ok(bends.every(x => Math.abs(x) <= 35));
  for (let i = 1; i < organic.main.points.length; i++) {
    assert.equal(organic.main.points[i][1], baseline.main.points[i][1]);
    assert.ok(Math.abs(bends[i] - bends[i - 1]) < 4, 'no angular hinges between trunk slices');
  }
});

test('collar, all block-centre anchors, widths and original texture origins are preserved', () => {
  const args = config(), baseline = growPlantRoots(args), organic = growPlantRoots({ ...args, organic: true });
  assert.deepEqual(organic.main.points[0], baseline.main.points[0]);
  for (let i = 0; i < baseline.roots.length; i++) {
    assert.deepEqual(organic.roots[i].widths, baseline.roots[i].widths);
    assert.deepEqual(organic.roots[i].textureOrigin, baseline.roots[i].points[0], 'tissue seed uses the unmodified original origin');
  }
  const linked = organic.roots.find(root => root.linkIndex === 0);
  assert.deepEqual(linked.points.slice(-2), args.links[0].blockCenters);
  const goal = growPlantRoots({ ...args, plant: { ...args.plant, goal: true }, organic: true });
  const goalBase = growPlantRoots({ ...args, plant: { ...args.plant, goal: true } });
  assert.deepEqual(goal.main.points, goalBase.main.points, 'separately drawn goal collar/root is never displaced');
  assert.deepEqual(goal.roots.find(root => root.linkIndex === 0).points[0], goalBase.roots.find(root => root.linkIndex === 0).points[0]);
});

test('secondary branches stay welded to the corresponding organic parent sample', () => {
  const baseline = growPlantRoots(config()), organic = growPlantRoots({ ...config(), organic: true });
  let checked = 0;
  baseline.roots.forEach((child, childIndex) => {
    if (child.order !== 2) return;
    let attachment = null;
    baseline.roots.forEach((parent, parentIndex) => {
      if (parent.order !== 1) return;
      const pointIndex = parent.points.findIndex(p => p[0] === child.points[0][0] && p[1] === child.points[0][1]);
      if (pointIndex >= 0) attachment = { parentIndex, pointIndex };
    });
    if (!attachment) return;
    const a = organic.roots[childIndex].points[0], b = organic.roots[attachment.parentIndex].points[attachment.pointIndex];
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-8, 'a branch cannot detach from the parent curve');
    checked++;
  });
  assert.ok(checked > 10);
});

test('curved transport retains every authored cell/nucleus command, colour, size and local pairing', () => {
  const flat = paintRecorder(), curved = paintRecorder();
  const path = [[100, 0], [125, 80], [80, 160], [120, 240]];
  setTissueCull(null);
  paintRootTissueVertical(flat.ctx, 42, 100, 0, 240, 17, ROOT_PALETTE);
  paintRootTissueVertical(createCurvedTissueContext(curved.ctx, path, 100), 42, 100, 0, 240, 17, ROOT_PALETTE);
  assert.equal(curved.commands.length, flat.commands.length);
  assert.ok(curved.commands.length > 100);
  for (let i = 0; i < flat.commands.length; i++) {
    const a = flat.commands[i], b = curved.commands[i];
    assert.equal(a.type, b.type); assert.equal(a.color, b.color);
    assert.equal(a.stroke, b.stroke); assert.deepEqual(a.args, b.args, 'source painter is preserved exactly');
    if (b.type === 'nucleus') assert.deepEqual(b.matrix, curved.commands[i - 1].matrix, 'nucleus follows its own cell, without drift');
    else {
      const y = b.args[1] + b.args[3] * .5;
      let segment = 0;
      while (segment < path.length - 2 && path[segment + 1][1] < y) segment++;
      const p = path[segment], q = path[segment + 1], t = Math.max(0, Math.min(1, (y - p[1]) / (q[1] - p[1])));
      const [aa, bb, cc, dd, xx, yy] = b.matrix;
      assert.ok(Math.abs(aa * 100 + cc * y + xx - (p[0] + (q[0] - p[0]) * t)) < 1e-8);
      assert.ok(Math.abs(bb * 100 + dd * y + yy - y) < 1e-8, 'the tissue axis follows the actual curve rather than the old straight strip');
    }
  }
  assert.ok(curved.commands.some(c => Math.abs(c.matrix[1]) > .1), 'texture actually bends with the root tangent');
  assert.equal(curved.stack.length, 0);
});

test('organic body still calls the author cell painter, with deterministic colours and balanced Canvas state', () => {
  const root = growPlantRoots({ ...config(), organic: true }).main;
  const a = paintRecorder(), b = paintRecorder();
  drawRootTube(a.ctx, root, { palette: ROOT_PALETTE, seed: 42, part: 'body' });
  drawRootTube(b.ctx, root, { palette: ROOT_PALETTE, seed: 42, part: 'body' });
  assert.deepEqual(a.commands, b.commands);
  assert.ok(a.commands.filter(c => c.type === 'cell').length > 100);
  assert.ok(a.commands.some(c => c.color === ROOT_PALETTE.ochreLarge[0]));
  assert.ok(a.commands.some(c => c.color === ROOT_PALETTE.green[1]));
  assert.equal(a.stack.length, 0);
});

test('switching the same renderer from 2D to organic and back restores the exact original cell drawing', () => {
  const state = { time: 0, campaign: { unlocks: {} }, level: {
    platforms: [{ x: 220, y: 400, w: 180, h: 64, type: 'root' }],
  } };
  const geometry = createRhizosphereGeometry({ state, painters: {
    rootPalette: ROOT_PALETTE, paintSoilTexture() {},
    soilPalette: { base: '#3a2115', outline: '#24140d', silt: ['#613c28', '#523120'], aggregates: ['#472a1b', '#301b11', '#402417'] },
  } });
  const recorder = paintRecorder();
  const ctx = new Proxy(recorder.ctx, { get: (target, key) => target[key] ?? (() => {}) });
  const render = organic => {
    recorder.commands.length = 0; ctx.__glOrganicRoots = organic;
    geometry.draw(ctx, { left: -100, right: 800, top: -100, bottom: 900 }, () => 42);
    return recorder.commands.map(c => ({ ...c }));
  };
  const baseline = render(false), curved = render(true), restored = render(false);
  assert.notDeepEqual(curved, baseline, 'WebGL target receives visibly different curved tissue');
  assert.deepEqual(restored, baseline, 'architecture cache and art cache cannot leak the organic profile into 2D');
  assert.equal(recorder.stack.length, 0);
});
