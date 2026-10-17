import assert from 'node:assert/strict';
import test from 'node:test';
import { createSimulation } from './simulation.js';

function stepFor(simulation, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds * 120); i++) simulation.update(1 / 120, input);
}

test('phase 4 geometry and the biological bridge come from the production runtime', () => {
  const simulation = createSimulation();
  const initial = simulation.snapshot();
  const source = initial.platforms.find(p => p.introHost);
  const target = initial.platforms.find(p => p.introDestination);
  assert.ok(initial.microbes.some(agent => agent.type === 'myco'));
  assert.equal(target.x - source.x - source.w, 325);
  // decorateCampaignLevel adjusts the generated root elevations after the
  // authored introduction, exactly as in app.js; retain its final geometry.
  assert.ok(Math.abs(source.y - target.y) <= 68);
  assert.equal(initial.player.onGround, true);
  assert.equal(initial.player.y + initial.player.h, source.y);
  assert.equal(initial.structures.length, 0);
  assert.equal(initial.platforms.some(p => p.mycorrhizaStructure), false);
  stepFor(simulation, 9);
  const grown = simulation.snapshot();
  assert.equal(grown.stats.matureBridges, 1);
  assert.ok(grown.platforms.some(p => p.mycorrhizaStructure));
  assert.ok(grown.hyphae.reduce((n, network) => n + network.paths.flat().length, 0) > 60);
  assert.equal(grown.player.onGround, true);
  assert.equal(grown.player.x, initial.player.x);
  stepFor(simulation, 1.25, { right: true });
  assert.equal(simulation.engine.state.player.supportPlatform?.mycorrhizaStructure, true);
  assert.equal(simulation.snapshot().player.onGround, true);
  simulation.regrow();
  assert.equal(simulation.snapshot().stats.matureBridges, 0);
  assert.equal(simulation.snapshot().platforms.some(p => p.mycorrhizaStructure), false);
});

test('adapter delegates movement and jump to the engine and preserves jump edge detection', () => {
  const simulation = createSimulation({ autoGrow: false });
  const x = simulation.snapshot().player.x;
  simulation.update(1 / 120, { right: true });
  assert.ok(simulation.snapshot().player.x > x);
  assert.ok(simulation.snapshot().player.vx > 0);
  simulation.update(1 / 120, { jump: true });
  const firstJump = simulation.snapshot().player.vy;
  assert.ok(firstJump < -400);
  assert.equal(simulation.snapshot().player.onGround, false);
  stepFor(simulation, .15, { jump: true });
  assert.ok(simulation.snapshot().player.vy > firstJump);
  // Releasing then pressing performs the actual previously unlocked double jump.
  simulation.update(1 / 120, {});
  simulation.update(1 / 120, new Set(['Space']));
  assert.equal(simulation.snapshot().player.airJumpAvailable, false);
  assert.ok(simulation.snapshot().player.vy < -400);
});

test('E uses production ecological-gameplay and does not repeat while held', () => {
  const a = createSimulation({ autoGrow: false });
  const before = a.snapshot().player.exudates;
  a.update(1 / 60, { inoculate: true });
  assert.equal(a.snapshot().player.exudates, before - 1);
  assert.equal(a.snapshot().clouds.length, 1);
  a.update(1 / 60, { inoculate: true });
  assert.equal(a.snapshot().player.exudates, before - 1);
});

test('each update matches one original engine step at the same clamped frame dt', () => {
  const adapter = createSimulation({ autoGrow: false });
  const reference = createSimulation({ autoGrow: false });
  // Compare actual adapter integration with direct calls to the unmodified
  // production simulator; different frame cadences are intentionally NOT
  // declared equivalent. Biological RNG is outside this motion comparison.
  const frames = [
    { dt: 1 / 60, input: { right: true }, keys: { ArrowRight: true } },
    { dt: 1 / 30, input: { right: true, jump: true }, keys: { ArrowRight: true, Space: true } },
    { dt: .007, input: { right: true, jump: true }, keys: { ArrowRight: true, Space: true } },
    { dt: .5, input: {}, keys: {} },
    { dt: 1 / 75, input: { jump: true }, keys: { Space: true } },
    { dt: -.02, input: {}, keys: {} },
  ];
  for (const { dt, input, keys } of frames) {
    reference.engine.setInputs(keys);
    reference.engine.step(Math.max(0, Math.min(.1, dt)));
    adapter.update(dt, input);
    assert.equal(adapter.snapshot().time, reference.engine.state.time);
    for (const field of ['x', 'y', 'vx', 'vy', 'onGround', 'coyote', 'jumpBuffer', 'airJumpAvailable']) {
      assert.equal(adapter.snapshot().player[field], reference.engine.state.player[field], `${field} at dt=${dt}`);
    }
  }
});
