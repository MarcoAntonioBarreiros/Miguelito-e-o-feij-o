import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhaseScoreReport, coinsFromScore, harvestPillars, plantStateFromPhaseScore, SCORE_WEIGHTS,
} from '../src/procgen/phase-score.js';

const FULL = {
  rootHealth: 1, infestation: 0, vascularTransport: 1,
  activeMatureNoduleCount: 2, totalFixationRate: 2,
  rootPhosphateStock: 1, mycorrhizalPhosphateTransported: 1,
  functionalBiofilmCount: 2, protectedRootCount: 3,
  controlledOpportunisticFungusCount: 2, calmedPathogenCount: 3,
  neutralizedRhizoctoniaCount: 2, neutralizedEggMassCount: 2, ralstoniaControlCount: 3,
};

test('objetivos 40 + colheita 60; tudo no maximo vale 100 em qualquer fase', () => {
  assert.equal(SCORE_WEIGHTS.objectives + SCORE_WEIGHTS.harvest, 100);
  for (const phase of [1, 2, 4, 7, 9, 12]) {
    const r = buildPhaseScoreReport({ phase, objectives: { passed: 2, total: 2 }, metrics: FULL });
    assert.equal(r.score, 100, `fase ${phase}`);
    assert.equal(r.coinsEarned, 100);
    assert.equal(r.plantState, 2);
  }
});

test('os pilares da colheita aparecem quando a mecanica existe na fase', () => {
  const ids = phase => buildPhaseScoreReport({ phase, objectives: { passed: 1, total: 1 }, metrics: FULL })
    .breakdown.harvest.pillars.map(p => p.id);
  assert.deepEqual(ids(1), ['biocontrol', 'health']);
  assert.deepEqual(ids(2), ['nitrogen', 'biocontrol', 'health']);
  assert.deepEqual(ids(4), ['nitrogen', 'phosphorus', 'biocontrol', 'health']);
  assert.equal(harvestPillars(1, FULL).nitrogen, null);
});

test('usar mais N, P e biocontrole rende mais pontos e mais moedas', () => {
  const base = { ...FULL, activeMatureNoduleCount: 0, totalFixationRate: 0, rootPhosphateStock: 0, mycorrhizalPhosphateTransported: 0, functionalBiofilmCount: 0, protectedRootCount: 0 };
  const objectives = { passed: 3, total: 3 };
  const low = buildPhaseScoreReport({ phase: 4, objectives, metrics: base });
  const n = buildPhaseScoreReport({ phase: 4, objectives, metrics: { ...base, activeMatureNoduleCount: 2, totalFixationRate: 2 } });
  const np = buildPhaseScoreReport({ phase: 4, objectives, metrics: { ...base, activeMatureNoduleCount: 2, totalFixationRate: 2, rootPhosphateStock: 1 } });
  assert.ok(low.coinsEarned < n.coinsEarned && n.coinsEarned < np.coinsEarned);
  assert.ok(low.hint.length > 0, 'pilar fraco recebe dica');
});

test('mortes nao entram na nota', () => {
  const a = buildPhaseScoreReport({ phase: 3, objectives: { passed: 2, total: 2 }, metrics: { ...FULL, deaths: 0 } });
  const b = buildPhaseScoreReport({ phase: 3, objectives: { passed: 2, total: 2 }, metrics: { ...FULL, deaths: 9 } });
  assert.equal(a.score, b.score);
});

test('feijoeiro e moedas seguem a nota', () => {
  assert.equal(plantStateFromPhaseScore(59), 0);
  assert.equal(plantStateFromPhaseScore(60), 1);
  assert.equal(plantStateFromPhaseScore(85), 2);
  assert.equal(coinsFromScore(83), 83);
  const r = buildPhaseScoreReport({ phase: 1, objectives: { passed: 1, total: 1 }, metrics: { rootHealth: .7 } });
  assert.equal(r.breakdown.objectives.points, 40);
  assert.equal(r.score, r.breakdown.objectives.points + r.breakdown.harvest.points);
  assert.ok(['Feijoeiro doente', 'Feijoeiro saudável', 'Feijoeiro super saudável'].includes(r.summaryLabel));
});
