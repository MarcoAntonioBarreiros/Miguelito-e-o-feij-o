import test from 'node:test';
import assert from 'node:assert/strict';
import { tutorialCards } from '../src/procgen/tutorial-registry.js';
import { tutorialCycleLayout, tutorialCycleStep } from '../src/procgen/tutorial-cycle.js';

test('cada ciclo tem um percurso aberto, com transições entre etapas consecutivas', () => {
  for (const card of Object.values(tutorialCards)) {
    if (!card.cycle.length) continue;
    for (const narrow of [false, true]) {
      const layout = tutorialCycleLayout(card.cycle.length, narrow);
      assert.equal(layout.positions.length, card.cycle.length, card.id);
      assert.equal(layout.arrows.length, card.cycle.length - 1, card.id);
      assert(!/[zZ]/.test(layout.path), 'o percurso não deve fechar');
      assert.notDeepEqual(layout.positions[0], layout.positions.at(-1));
      assert(layout.positions.every(p => p.x > 0 && p.x < 400 && p.y < layout.height));
      assert.equal(new Set(layout.positions.map(p => `${p.x},${p.y}`)).size, card.cycle.length);
    }
  }
});

test('cada etapa tem rotulo e legenda propria; nenhuma cai em texto generico', () => {
  for (const card of Object.values(tutorialCards)) {
    for (let stage = 0; stage < card.cycle.length; stage++) {
      const step = tutorialCycleStep(card, stage);
      assert(step.label && step.caption, `${card.id}: etapa ${stage}`);
      assert.doesNotMatch(step.caption, /será apresentado/);
    }
    assert.equal(tutorialCycleStep(card, card.cycle.length), null);
  }
});
