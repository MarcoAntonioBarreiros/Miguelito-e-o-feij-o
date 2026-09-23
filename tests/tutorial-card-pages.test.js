import assert from 'node:assert/strict';
import test from 'node:test';
import { tutorialCards } from '../src/procgen/tutorial-registry.js';
import { tutorialDisplayPages } from '../src/procgen/tutorial-card-pages.js';

test('paginação visual conserva cada texto, título e tópico de todos os cartões', () => {
  for (const card of Object.values(tutorialCards)) {
    const before = JSON.stringify(card);
    const views = tutorialDisplayPages(card, card.pages.map((_, index) => index));
    for (const [index, page] of card.pages.entries()) {
      const parts = views.filter(view => view.sourceIndex === index);
      assert.equal(parts.filter(view => view.body).map(view => view.body).join(''), page.body, card.id);
      assert.deepEqual(parts.flatMap(view => view.points), page.points || [], card.id);
      assert(parts.every(view => view.title === page.title));
    }
    assert.equal(JSON.stringify(card), before, 'o catálogo não pode ser mutado');
    const cycles = views.filter(view => view.kind === 'cycle');
    assert.equal(cycles.length, card.cycle.length ? 1 : 0);
    if (cycles.length) assert.deepEqual(cycles[0].cycle, card.cycle);
  }
});

test('página visual extra não revela conteúdo científico ainda bloqueado', () => {
  const card = tutorialCards['organism-rhizobium'];
  const views = tutorialDisplayPages(card, [0]);
  assert(views.every(view => view.kind === 'cycle' || view.sourceIndex === 0));
  assert.equal(views.at(-1).kind, 'cycle');
  assert.deepEqual(tutorialDisplayPages(card, []), []);
});

test('listas extensas são repartidas sem perda nem duplicação de tópicos', () => {
  const card = tutorialCards['action-inoculation'];
  const views = tutorialDisplayPages(card, [1]);
  assert(views.filter(view => view.kind === 'details').length >= 2);
  assert(views.every(view => view.points.length <= 2));
  assert.deepEqual(views.flatMap(view => view.points), card.pages[1].points);
});
