import test from 'node:test';
import assert from 'node:assert/strict';
import { tutorialCards } from '../src/procgen/tutorial-registry.js';
import { tutorialCycleLayout, tutorialCycleContext } from '../src/procgen/tutorial-cycle.js';

test('cada ciclo tem um percurso aberto, com transições entre etapas consecutivas', () => {
  for (const card of Object.values(tutorialCards)) {
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

test('os destaques de todas as etapas usam somente páginas existentes e desbloqueadas', () => {
  for (const card of Object.values(tutorialCards)) {
    const all = card.pages.map((_, index) => index);
    for (let stage = 0; stage < card.cycle.length; stage++) {
      const context = tutorialCycleContext(card, stage, all);
      assert(context, `${card.id}: etapa ${stage}`);
      assert.equal(context.body, card.pages[context.sourceIndex].body);
      assert.equal(context.title, card.pages[context.sourceIndex].title);
      assert.equal(tutorialCycleContext(card, stage, all.filter(i => i !== context.sourceIndex)), null);
    }
  }
});
