import test from 'node:test';
import assert from 'node:assert/strict';
import { tutorialCards } from '../src/procgen/tutorial-registry.js';
import { CYCLE_REVISION, NARRATION_REVISION, NEW_CARDS, PAGE_REVISION, TEXT_LIMITS } from '../src/procgen/tutorial-text-revision.js';

function checkPage(where, page, { requireTitle = true } = {}) {
  const problems = [];
  if (requireTitle && !(page.title?.length > 0)) problems.push(`${where}: sem titulo`);
  if (page.title && page.title.length > TEXT_LIMITS.title) problems.push(`${where}: titulo ${page.title.length}`);
  if (!(page.body?.length > 0)) problems.push(`${where}: sem corpo`);
  if (page.body.length > TEXT_LIMITS.body) problems.push(`${where}: corpo ${page.body.length} > ${TEXT_LIMITS.body}`);
  const points = page.points || [];
  if (points.length > TEXT_LIMITS.points) problems.push(`${where}: ${points.length} topicos`);
  for (const pt of points) if (pt.length > TEXT_LIMITS.point) problems.push(`${where}: topico ${pt.length} "${pt}"`);
  return problems;
}

test('revisao cobre todos os cartoes e mantem o numero de paginas (indices estaveis)', () => {
  for (const [id, card] of Object.entries(tutorialCards)) {
    assert.ok(PAGE_REVISION[id], `${id} sem revisao`);
    assert.equal(PAGE_REVISION[id].length, card.pages.length, `${id}: numero de paginas mudou`);
  }
  for (const id of Object.keys(PAGE_REVISION)) assert.ok(tutorialCards[id], `${id} nao existe`);
});

test('textos dentro do limite (corpo, topicos, titulo), inclusive continuacoes e cartoes novos', () => {
  const problems = [];
  for (const [id, pages] of Object.entries(PAGE_REVISION)) {
    pages.forEach((page, i) => {
      problems.push(...checkPage(`${id}[${i}]`, page));
      (page.more || []).forEach((extra, k) => problems.push(...checkPage(`${id}[${i}]+${k + 1}`, extra, { requireTitle: false })));
    });
  }
  for (const [id, card] of Object.entries(NEW_CARDS)) card.pages.forEach((page, i) => problems.push(...checkPage(`novo ${id}[${i}]`, page)));
  assert.deepEqual(problems, []);
});

test('ciclos: 13, de 3 a 5 etapas, legenda propria curta e sem repeticao', () => {
  const ids = Object.keys(CYCLE_REVISION);
  assert.equal(ids.length, 13);
  for (const id of ids) {
    const cycle = CYCLE_REVISION[id];
    assert.ok(tutorialCards[id], `${id} nao existe`);
    assert.ok(cycle.steps.length >= 3 && cycle.steps.length <= 5, `${id}: ${cycle.steps.length} etapas`);
    assert.ok(Number.isInteger(cycle.phase) && cycle.phase >= 1 && cycle.phase <= 9);
    const captions = cycle.steps.map(step => step.caption);
    assert.equal(new Set(captions).size, captions.length, `${id}: legenda repetida`);
    for (const step of cycle.steps) {
      assert.ok(step.label.length <= 22, `${id}: rotulo longo "${step.label}"`);
      assert.ok(step.caption.length <= 70, `${id}: legenda ${step.caption.length} "${step.caption}"`);
    }
  }
});

test('nenhum texto de espera generico', () => {
  const all = JSON.stringify({ PAGE_REVISION, CYCLE_REVISION, NEW_CARDS, NARRATION_REVISION });
  assert.ok(!/ser[áa] apresentado ao longo/i.test(all));
});

test('narracoes revisadas cabem em 60 caracteres', () => {
  for (const [id, text] of Object.entries(NARRATION_REVISION)) assert.ok(text.length <= 60, `${id}: ${text.length}`);
});
