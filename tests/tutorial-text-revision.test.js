import test from 'node:test';
import assert from 'node:assert/strict';
import { cycleCardsForPhase, tutorialCardIds, tutorialCards } from '../src/procgen/tutorial-registry.js';
import { tutorialDisplayPages } from '../src/procgen/tutorial-card-pages.js';
import { createTutorialFlow } from '../src/procgen/tutorial-flow.js';
import { NARRATION } from '../src/procgen/narration-catalog.js';
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
    if (NEW_CARDS[id]) continue;
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
      assert.ok(step.caption.length <= 140, `${id}: legenda ${step.caption.length} "${step.caption}"`);
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

// ---- integracao no jogo -----------------------------------------------------

test('o jogo mostra o texto revisado, com as continuacoes logo depois da pagina', () => {
  for (const [id, pages] of Object.entries(PAGE_REVISION)) {
    const card = tutorialCards[id];
    pages.forEach((page, index) => {
      assert.equal(card.pages[index].body, page.body, `${id}[${index}]`);
      assert.equal(card.pages[index].title, page.title, `${id}[${index}]`);
    });
    const views = tutorialDisplayPages(card, card.pages.map((_, index) => index));
    const bodies = views.flatMap(view => view.callout ? [view.body, view.callout.body] : [view.body]).join(' ');
    for (const page of pages) for (const extra of page.more || []) assert.ok(bodies.includes(extra.body), `${id}: continuacao`);
  }
});

test('ciclo fica fora da primeira apresentacao e so os 13 tem ciclo', () => {
  const withCycle = Object.values(tutorialCards).filter(card => card.cycle.length).map(card => card.id).sort();
  assert.deepEqual(withCycle, Object.keys(CYCLE_REVISION).sort());
  for (const card of Object.values(tutorialCards)) {
    const all = card.pages.map((_, index) => index);
    assert.ok(!tutorialDisplayPages(card, all).some(view => view.kind === 'cycle'), `${card.id}: ciclo na apresentacao`);
    if (!card.cycle.length) continue;
    assert.equal(tutorialDisplayPages(card, all, { includeCycle: true }).at(-1).kind, 'cycle');
    assert.deepEqual(tutorialDisplayPages(card, all, { cycleOnly: true }).map(view => view.kind), ['cycle']);
    assert.ok(card.cycle.every(step => step.label && step.caption), `${card.id}: etapa sem legenda`);
  }
  assert.deepEqual(cycleCardsForPhase(8), ['organism-meloidogyne-j2', 'organism-meloidogyne-female']);
  assert.deepEqual(cycleCardsForPhase(10), []);
});

test('cartoes novos estao no GUIA, perto do cartao com que conversam', () => {
  for (const id of Object.keys(NEW_CARDS)) assert.ok(tutorialCardIds.includes(id), id);
  const at = id => tutorialCardIds.indexOf(id);
  assert.equal(at('process-mycoparasitism'), at('organism-trichoderma') + 1);
  assert.equal(at('hazard-necrotic-zone'), at('system-welcome') + 1);
  assert.equal(at('status-j2-carried'), at('status-contamination') + 1);
});

test('cartao de situacao abre na primeira vez, ate em trecho silencioso; zona necrotica so no GUIA', () => {
  const flow = createTutorialFlow();
  const silent = { tutorialMode: 'silent', phase: 7, chunkIndex: 30, worldX: 0, nowSeconds: 1 };
  const first = flow.handle('event-calm', silent);
  assert.equal(first.open, true);
  assert.equal(first.reason, 'first-occurrence');
  flow.markSeen('event-calm');
  assert.equal(flow.handle('event-calm', silent).open, false);
  const necrotic = flow.handle('hazard-necrotic-zone', { tutorialMode: 'guided', phase: 1, chunkIndex: 0 });
  assert.equal(necrotic.open, false);
  assert.equal(flow.handle('status-contamination', { tutorialMode: 'disabled' }).open, false);
});

test('pagina liberada depois num cartao ja lido ganha selo novo', () => {
  const flow = createTutorialFlow();
  const ctx = (chunkIndex, nowSeconds) => ({
    tutorialMode: 'guided', source: 'first-proximity-encounter', phase: 5, chunkIndex, worldX: 0, nowSeconds,
  });
  flow.handle('organism-pseudomonas', ctx(8, 1));
  flow.markSeen('organism-pseudomonas');
  assert.equal(flow.isFresh('organism-pseudomonas'), false);
  const later = flow.handle('process-siderophore', ctx(9, 50));
  assert.equal(later.guideUpdated, true);
  assert.equal(flow.isFresh('organism-pseudomonas'), true);
  flow.markSeen('organism-pseudomonas');
  assert.equal(flow.isFresh('organism-pseudomonas'), false);
});

test('ciclo revisado fica salvo e volta no snapshot', () => {
  const flow = createTutorialFlow();
  assert.equal(flow.markCycleReviewed('organism-bacillus'), true);
  assert.equal(flow.markCycleReviewed('action-exudate'), false, 'sem ciclo');
  const again = createTutorialFlow(flow.snapshot());
  assert.equal(again.cycleReviewed('organism-bacillus'), true);
});

test('narracoes revisadas estao no catalogo do jogo', () => {
  for (const [id, text] of Object.entries(NARRATION_REVISION)) assert.equal(NARRATION[id].text, text, id);
});
