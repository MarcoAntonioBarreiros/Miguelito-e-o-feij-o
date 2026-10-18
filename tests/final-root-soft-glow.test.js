import assert from 'node:assert/strict';
import test from 'node:test';
import { drawFinalRoot, traceSoftRootGlowTube } from '../src/render/final-root-visual.js';
import { ROOT_PALETTE } from '../src/render/root-tissue.js';

function recorder(soft) {
  const draws = [], cells = [], gradients = [], paths = [];
  const stack = [];
  let path = [];
  const ctx = {
    globalAlpha: 1, globalCompositeOperation: 'source-over', shadowBlur: 0,
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    save() { stack.push({ alpha: this.globalAlpha, composite: this.globalCompositeOperation, blur: this.shadowBlur,
      fill: this.fillStyle, stroke: this.strokeStyle, width: this.lineWidth, cap: this.lineCap, join: this.lineJoin }); },
    restore() { const s = stack.pop(); Object.assign(this, { globalAlpha: s.alpha, globalCompositeOperation: s.composite,
      shadowBlur: s.blur, fillStyle: s.fill, strokeStyle: s.stroke, lineWidth: s.width, lineCap: s.cap, lineJoin: s.join }); },
    translate() {}, scale() {},
    beginPath() { path = []; }, closePath() { path.push(['close']); }, clip() {},
    moveTo(...p) { path.push(['move', ...p]); }, lineTo(...p) { path.push(['line', ...p]); },
    quadraticCurveTo(...p) { path.push(['curve', ...p]); },
    rect(...p) { path.push(['rect', ...p]); },
    arc(...p) { path.push(['arc', ...p]); },
    roundRect(...p) { cells.push({ type: 'cell', args: p, color: this.fillStyle, stroke: this.strokeStyle }); },
    ellipse(...p) { cells.push({ type: 'nucleus', args: p, color: this.fillStyle }); },
    fill() { draws.push({ type: 'fill', color: this.fillStyle, composite: this.globalCompositeOperation, blur: this.shadowBlur }); paths.push([...path]); },
    stroke() { draws.push({ type: 'stroke', color: this.strokeStyle, composite: this.globalCompositeOperation, blur: this.shadowBlur, width: this.lineWidth,
      cap: this.lineCap, join: this.lineJoin }); paths.push([...path]); },
    createRadialGradient(...args) { const gradient = { args, stops: [], addColorStop(...s) { this.stops.push(s); } }; gradients.push(gradient); return gradient; },
  };
  if (soft !== undefined) ctx.__glSoftFinalRootGlow = soft;
  return { ctx, draws, cells, gradients, paths, stack };
}

function render({ soft, pulse = 0, extension = false } = {}) {
  const rec = recorder(soft);
  const goal = { x: 300, y: 200, ...(extension ? { collarY: -300 } : {}) };
  drawFinalRoot(rec.ctx, goal, { pulse, time: 12 });
  return rec;
}

test('soft glow is opt-in; default and explicit false retain the same original 2D drawing', () => {
  const plain = value => JSON.parse(JSON.stringify(value));
  for (const pulse of [0, .55, 1]) {
    const normal = render({ pulse }), off = render({ soft: false, pulse });
    assert.deepEqual(plain(off.draws), plain(normal.draws)); assert.deepEqual(off.cells, normal.cells);
    assert.deepEqual(off.paths, normal.paths); assert.deepEqual(plain(off.gradients), plain(normal.gradients));
  }
});

test('every original tissue cell, nucleus, dimension, palette and outline remains unchanged', () => {
  for (const extension of [false, true]) {
    const original = render({ extension }), soft = render({ soft: true, extension });
    assert.deepEqual(soft.cells, original.cells);
    assert.ok(soft.cells.length > 300);
    const outlines = rec => rec.draws.filter(d => d.type === 'stroke' && d.color === ROOT_PALETTE.outline);
    assert.deepEqual(outlines(soft), outlines(original));
    assert.equal(soft.stack.length, 0);
    assert.equal(soft.ctx.globalCompositeOperation, 'source-over');
  }
});

test('WebGL aura uses low-energy Gaussian contours behind the tissue and only a thin axial glint', () => {
  for (const pulse of [0, .55, 1]) {
    const soft = render({ soft: true, pulse });
    const aura = soft.draws.filter(d => d.composite === 'destination-over' && typeof d.color === 'string');
    assert.equal(aura.length, 7 * 20, 'six branches and the main root have twenty feathered contours each');
    for (const draw of aura) {
      const alpha = Number(draw.color.match(/, ([\d.e+-]+)\)$/)[1]);
      assert.ok(alpha > 0 && alpha < .012, 'no individual broad contour can form a solid painted plateau');
      assert.ok(draw.type === 'fill' || draw.type === 'stroke'); assert.equal(draw.blur, 0);
      assert.ok(draw.color.startsWith('rgba(255, 203, 115,'), 'light uses warm amber rather than a silver/blue veil');
      if (draw.type === 'stroke') { assert.equal(draw.cap, 'round'); assert.equal(draw.join, 'round'); }
    }
    const glints = soft.draws.filter(d => d.type === 'stroke' && String(d.color).startsWith('rgba(255, 248, 229,'));
    assert.equal(glints.length, 7);
    assert.ok(glints.every(d => d.width <= 1.6 && d.blur === 0));
    const glowGradient = soft.gradients.at(-1);
    assert.ok(glowGradient.args.at(-1) < 150, 'radial halo is contained instead of flooding a 200–290 unit circle');
    assert.ok(Number(glowGradient.stops[0][1].match(/, ([\d.]+)\)$/)[1]) <= .043);
  }
});

test('completion grows the light gently while the tapered tip remains narrower than the collar', () => {
  const idle = render({ soft: true }), completed = render({ soft: true, pulse: 1 });
  const auraAlpha = rec => rec.draws.filter(d => d.composite === 'destination-over' && typeof d.color === 'string')
    .reduce((sum, d) => sum + Number(d.color.match(/, ([\d.e+-]+)\)$/)[1]), 0);
  assert.ok(auraAlpha(completed) > auraAlpha(idle));
  assert.ok(auraAlpha(completed) < auraAlpha(idle) * 2);
  // The last twenty contours belong to the main root. At each true last
  // cross-section the width includes the SAME .62 taper as the tissue.
  const indices = idle.draws.flatMap((d, i) => d.composite === 'destination-over' && typeof d.color === 'string' ? [i] : []);
  const mainOuter = idle.paths[indices.at(-20)];
  const caps = mainOuter.filter(p => p[0] === 'arc');
  assert.equal(caps.length, 2);
  assert.ok(caps[0][3] < caps[1][3], 'aura narrows with the tissue instead of making a capsule at the tip');
});

test('soft contour caps follow forward/backward tangents for horizontal, vertical and oblique roots', () => {
  for (const samples of [
    [{ x: 0, y: 0 }, { x: 20, y: 0 }],
    [{ x: 0, y: 0 }, { x: 0, y: 20 }],
    [{ x: 0, y: 0 }, { x: 20, y: -15 }],
    [{ x: 0, y: 0 }, { x: -20, y: -10 }],
    [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 30 }],
  ]) {
    const rec = recorder();
    traceSoftRootGlowTube(rec.ctx, samples, () => 12); rec.ctx.fill();
    const caps = rec.paths[0].filter(p => p[0] === 'arc');
    assert.equal(caps.length, 2);
    const a = samples[0], b = samples[1], p = samples.at(-2), q = samples.at(-1);
    for (const [cap, dx, dy, sign] of [[caps[0], q.x - p.x, q.y - p.y, 1], [caps[1], b.x - a.x, b.y - a.y, -1]]) {
      const middle = (cap[4] + cap[5]) * .5;
      const dot = (Math.cos(middle) * dx + Math.sin(middle) * dy) / Math.hypot(dx, dy);
      assert.ok(Math.abs(dot - sign) < 1e-10, 'cap midpoint points along the correct tangent, never a hardcoded downward flap');
      assert.equal(cap[3], 6); assert.equal(cap[6], true);
    }
  }
});
