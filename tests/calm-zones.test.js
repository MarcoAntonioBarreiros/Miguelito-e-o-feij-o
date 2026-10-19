import test from 'node:test';
import assert from 'node:assert/strict';
import { CALM_ZONE_CONFIG, calmLevelAt, createCalmZones, findCalmPairs } from '../src/procgen/calm-zones.js';
import { calmFungalResponse, fungalResponse, OPPORTUNISTIC_FUNGUS_DEFAULTS, PSEUDOMONAS_IRON_CONTROL_DEFAULTS } from '../src/procgen/opportunistic-fungus.js';
import { calmRalstoniaGrowth } from '../src/procgen/ralstonia-vascular-wilt.js';
import { createSimulator } from '../src/procgen/simulator.js';

const colony = (id, type, x, extra = {}) => ({ id, type, x, y: 400, growth: 1, vigor: 1, dormant: false, ...extra });

test('calmaria: par Pseudomonas + Bacillus proximos forma halo amplo', () => {
  const zones = findCalmPairs([colony('p', 'pseudomonas', 1000), colony('b', 'bacillus', 1300)]);
  assert.equal(zones.length, 1);
  assert.equal(zones[0].x, 1150);
  assert.equal(zones[0].radius, CALM_ZONE_CONFIG.maxRadius);
  // muito maior que a influencia das colonias (~60-130 px)
  assert.ok(zones[0].radius >= 420);
});

test('calmaria: sem par, longe demais, autoral, dormente ou sem aderir nao conta', () => {
  assert.equal(findCalmPairs([colony('p', 'pseudomonas', 0), colony('p2', 'pseudomonas', 100)]).length, 0);
  assert.equal(findCalmPairs([colony('p', 'pseudomonas', 0), colony('b', 'bacillus', 500)]).length, 0);
  assert.equal(findCalmPairs([colony('p', 'pseudomonas', 0), colony('b', 'bacillus', 100, { authored: true })]).length, 0);
  assert.equal(findCalmPairs([colony('p', 'pseudomonas', 0, { dormant: true }), colony('b', 'bacillus', 100)]).length, 0);
  assert.equal(findCalmPairs([colony('p', 'pseudomonas', 0, { growth: .2 }), colony('b', 'bacillus', 100)]).length, 0);
});

test('calmaria: raio acompanha o vigor do par dentro de 420-600', () => {
  const weak = findCalmPairs([colony('p', 'pseudomonas', 0, { vigor: .2 }), colony('b', 'bacillus', 100, { vigor: .2 })])[0];
  assert.ok(weak.radius > 420 && weak.radius < 480, `${weak.radius}`);
});

test('calmaria: nivel cheio no centro, borda suave, zero fora', () => {
  const zones = [{ x: 0, y: 0, radius: 500, intensity: 1 }];
  assert.equal(calmLevelAt(zones, 0, 0), 1);
  assert.equal(calmLevelAt(zones, 380, 0), 1);
  const edge = calmLevelAt(zones, 450, 0);
  assert.ok(edge > 0 && edge < 1);
  assert.equal(calmLevelAt(zones, 520, 0), 0);
});

test('calmaria: entra e sai aos poucos e conta como controle depois de sustentada', () => {
  const colonies = [colony('p', 'pseudomonas', 1000), colony('b', 'bacillus', 1200)];
  const state = { gameState: 'play', level: {}, narration: null };
  const calm = createCalmZones({ state, inoculants: { colonies } });
  calm.update(.5);
  assert.ok(state.calmZones[0].intensity > 0 && state.calmZones[0].intensity < 1);
  for (let i = 0; i < 10; i++) calm.update(.25);
  assert.equal(state.calmZones[0].intensity, 1);
  const pathogen = {};
  for (let t = 0; t < 7; t += .1) calm.settle(pathogen, 'oportunista', 1100, 400, .1);
  assert.equal(pathogen.calm, 1);
  assert.equal(calm.calmedCount('oportunista'), 1);
  // o mesmo objeto nao conta duas vezes
  for (let t = 0; t < 7; t += .1) calm.settle(pathogen, 'oportunista', 1100, 400, .1);
  assert.equal(calm.calmedCount('oportunista'), 1);
  colonies.length = 0;
  calm.update(.5);
  assert.ok(state.calmZones[0].intensity < 1 && state.calmZones[0].intensity > 0, 'saida gradual');
  for (let i = 0; i < 12; i++) calm.update(.25);
  assert.equal(state.calmZones.length, 0);
  for (let t = 0; t < 3; t += .1) calm.settle(pathogen, 'oportunista', 1100, 400, .1);
  assert.equal(pathogen.calm, 0, 'fora do halo volta ao normal');
});

test('calmaria: fungo oportunista para de crescer, esporular e aderir; vigor cai ao piso', () => {
  const base = fungalResponse(0, OPPORTUNISTIC_FUNGUS_DEFAULTS, PSEUDOMONAS_IRON_CONTROL_DEFAULTS);
  const calm = calmFungalResponse(base, 1, PSEUDOMONAS_IRON_CONTROL_DEFAULTS);
  assert.equal(calm.growth, 0);
  assert.equal(calm.branching, 0);
  assert.equal(calm.sporulation, 0);
  assert.equal(calm.adhesion, 0);
  assert.equal(calm.vigor, PSEUDOMONAS_IRON_CONTROL_DEFAULTS.minimumFungalVigor);
  assert.equal(calmFungalResponse(base, 0, PSEUDOMONAS_IRON_CONTROL_DEFAULTS), base);
});

test('calmaria: Ralstonia nao avanca, mas o controle que ja reduz continua', () => {
  const config = { vascularEntryThreshold: .2 };
  const growing = calmRalstoniaGrowth({ surfaceRate: .02, vascularRate: .03, control: .1, holdingVascular: false }, 1, { vascularLoad: .5 }, config);
  assert.equal(growing.vascularRate, 0);
  assert.equal(growing.surfaceRate, 0);
  assert.equal(growing.holdingVascular, true);
  const shrinking = calmRalstoniaGrowth({ surfaceRate: -.02, vascularRate: -.01, control: .6 }, 1, { vascularLoad: .5 }, config);
  assert.equal(shrinking.vascularRate, -.01);
  assert.equal(shrinking.control, .6, 'a calmaria nao inventa controle (nao neutraliza)');
});

test('calmaria: integrada ao simulador, le as colonias inoculadas', () => {
  const sim = createSimulator();
  sim.state.gameState = 'play';
  sim.beneficialInoculants.colonies.push(colony('p', 'pseudomonas', 2000), colony('b', 'bacillus', 2250));
  for (let i = 0; i < 4; i++) sim.calmZones.update(.5);
  assert.equal(sim.state.calm.at(2125, 400), 1);
  assert.equal(sim.state.calm.at(3200, 400), 0);
});
