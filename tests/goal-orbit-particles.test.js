import assert from 'node:assert/strict';
import test from 'node:test';
import {
  drawGoalOrbitParticles, GOAL_ORBIT_PARTICLE_COUNT, goalOrbitParticle, goalOrbitTwinkle,
} from '../src/render/goal-orbit-particles.js';

function recordingContext(collect = null) {
  const gradients = [], fills = [], stack = [];
  let circle;
  const ctx = {
    __glGoalOrbitParticle: collect,
    globalAlpha: .73, globalCompositeOperation: 'source-over', shadowBlur: 4,
    fillStyle: '#abc', strokeStyle: '#def', lineWidth: 2,
    save() {
      stack.push(Object.fromEntries(['globalAlpha', 'globalCompositeOperation', 'shadowBlur', 'fillStyle', 'strokeStyle', 'lineWidth']
        .map(k => [k, this[k]])));
    },
    restore() { assert.ok(stack.length); Object.assign(this, stack.pop()); },
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    arc(x, y, radius) { circle = { x, y, radius }; },
    fill() { fills.push({ ...circle, style: this.fillStyle, alpha: this.globalAlpha, composite: this.globalCompositeOperation }); },
    createRadialGradient(...args) { return gradient('radial', args); },
    createLinearGradient(...args) { return gradient('linear', args); },
  };
  function gradient(kind, args) {
    const g = { kind, args, stops: [], addColorStop(at, color) { this.stops.push([at, color]); } };
    gradients.push(g); return g;
  }
  return { ctx, gradients, fills, stack };
}

test('as 14 orbitas preservam posicao, velocidade, raio e duas cores originais', () => {
  assert.equal(GOAL_ORBIT_PARTICLE_COUNT, 14);
  for (const time of [0, 1, 14.2, 100]) for (const completed of [false, true]) {
    for (let i = 0; i < 14; i++) {
      const angle = i / 14 * Math.PI * 2 + time * (completed ? .42 : .18);
      const radius = 42 + (i % 4) * 11 + Math.sin(time * 1.7 + i) * 4;
      const particle = goalOrbitParticle(i, time, completed);
      assert.ok(Math.abs(particle.x - Math.cos(angle) * radius) < 1e-10);
      assert.ok(Math.abs(particle.y - (44 + Math.sin(angle) * radius * .55)) < 1e-10);
      assert.equal(particle.radius, 2.2 + (i % 3));
      assert.equal(particle.color, i % 2 ? '#d6afff' : '#8ff2c1');
      assert.equal(particle.alpha, completed ? .82 : .42);
    }
  }
});

test('cintilacao e individual e suave, sem alterar a orbita', () => {
  const original = goalOrbitParticle(4, 12);
  assert.equal(goalOrbitTwinkle(4, 12), goalOrbitTwinkle(4, 12));
  assert.notEqual(goalOrbitTwinkle(4, 12), goalOrbitTwinkle(5, 12));
  for (let time = 0; time < 20; time += .1) {
    const value = goalOrbitTwinkle(4, time);
    assert.ok(value >= .66 && value <= 1.22);
    assert.ok(Math.abs(value - goalOrbitTwinkle(4, time + .001)) < .01);
  }
  assert.deepEqual(goalOrbitParticle(4, 12), original);
});

test('fallback Canvas continua com os mesmos discos e sem gradientes ou composicao aditiva', () => {
  const { ctx, fills, gradients, stack } = recordingContext();
  drawGoalOrbitParticles(ctx, 3, false);
  assert.equal(fills.length, 14);
  assert.equal(gradients.length, 0);
  for (let i = 0; i < fills.length; i++) {
    const particle = goalOrbitParticle(i, 3, false);
    assert.deepEqual(fills[i], { x: particle.x, y: particle.y, radius: particle.radius,
      style: particle.color, alpha: particle.alpha, composite: 'source-over' });
  }
  assert.equal(ctx.globalAlpha, .73);
  assert.equal(ctx.shadowBlur, 4);
  assert.equal(stack.length, 0);
});

test('callback WebGL recebe as orbitas locais e cintilacao sem desenhar discos duplicados no Canvas', () => {
  const records = [];
  let callbackContext;
  const { ctx, fills, gradients, stack } = recordingContext(function (record) {
    callbackContext = this;
    records.push(record);
  });
  drawGoalOrbitParticles(ctx, 3, false);
  assert.equal(fills.length, 0);
  assert.equal(gradients.length, 0);
  assert.equal(records.length, 14);
  assert.strictEqual(callbackContext, ctx, 'a matriz do alvo continua disponivel no callback');
  for (let i = 0; i < 14; i++) {
    assert.deepEqual(records[i], { ...goalOrbitParticle(i, 3, false),
      index: i, time: 3, completed: false, twinkle: goalOrbitTwinkle(i, 3) });
  }
  assert.equal(ctx.globalAlpha, .73);
  assert.equal(ctx.globalCompositeOperation, 'source-over');
  assert.equal(ctx.shadowBlur, 4);
  assert.equal(ctx.fillStyle, '#abc');
  assert.equal(stack.length, 0);
});
