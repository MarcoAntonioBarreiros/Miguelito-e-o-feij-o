import assert from 'node:assert/strict';
import test from 'node:test';
import { tutorialCards } from '../src/procgen/tutorial-registry.js';
import { tutorialDisplayPages } from '../src/procgen/tutorial-card-pages.js';

test('paginação visual conserva cada texto, título e tópico de todos os cartões', () => {
  for (const card of Object.values(tutorialCards)) {
    const before = JSON.stringify(card);
    const views = tutorialDisplayPages(card, card.pages.map((_, index) => index), { includeCycle: true });
    for (const [index, page] of card.pages.entries()) {
      const parts = views.flatMap(view => view.callout ? [view, view.callout] : [view])
        .filter(view => view.sourceIndex === index);
      const own = parts.filter(view => !view.continued);
      const extra = parts.filter(view => view.continued);
      assert.equal(own.filter(view => view.body).map(view => view.body).join(''), page.body, card.id);
      assert.deepEqual(own.flatMap(view => view.points), page.points || [], card.id);
      assert.deepEqual(extra.map(view => view.body), (page.more || []).map(more => more.body), card.id);
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
  const views = tutorialDisplayPages(card, [0], { includeCycle: true });
  assert(views.every(view => view.kind === 'cycle' || view.sourceIndex === 0));
  assert(views.every(view => !view.callout), 'instrução bloqueada não entra no destaque');
  assert.equal(views.at(-1).kind, 'cycle');
  assert(!tutorialDisplayPages(card, [0]).some(view => view.kind === 'cycle'), 'ciclo só depois da revisão');
  assert.deepEqual(tutorialDisplayPages(card, []), []);
});

test('apresentação reúne conceito e aplicação sem repetir nem antecipar instruções', () => {
  const card = tutorialCards['organism-azospirillum'];
  const all = card.pages.map((_, index) => index);
  const views = tutorialDisplayPages(card, all);
  const game = card.pages.findIndex(page => /poder no jogo/i.test(page.title));
  assert.equal(views[0].callout.body, card.pages[game].body);
  assert.equal(views[0].callout.sourceIndex, game);
  assert(!views.some(view => view.sourceIndex === game));
  assert.equal(views[0].body, card.pages[0].body);
});

test('introdução com tópicos fica inteira: nada de frase solta numa página', () => {
  const card = tutorialCards['organism-rhizobium'];
  const views = tutorialDisplayPages(card, card.pages.map((_, index) => index));
  assert(!views[0].callout);
  assert.equal(views.filter(view => view.sourceIndex === 0).length, 1);
  assert.equal(views[0].body, card.pages[0].body);
});

test('listas extensas são repartidas sem perda nem duplicação de tópicos', () => {
  // Os textos revisados têm no máximo 2 tópicos; a regra continua valendo
  // para qualquer cartão futuro com lista longa.
  const card = { id: 'lista', cycle: [], pages: [
    { title: 'Intro', body: 'Corpo.', points: [] },
    { title: 'Lista', body: 'Corpo da lista.', points: ['um', 'dois', 'três', 'quatro'] },
  ] };
  const views = tutorialDisplayPages(card, [1]);
  assert(views.filter(view => view.kind === 'details').length >= 2);
  assert(views.every(view => view.points.length <= 2));
  assert.deepEqual(views.flatMap(view => view.points), card.pages[1].points);
});
