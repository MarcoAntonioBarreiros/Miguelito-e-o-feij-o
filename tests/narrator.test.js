import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NARRATION,
  NARRATION_TEXT_LIMIT,
  narrationText,
} from '../src/procgen/narration-catalog.js';
import {
  createNarrator,
  narrate,
  narrationDisplaySeconds,
  registerNarrator,
} from '../src/procgen/narrator.js';
import { tutorialCardIds } from '../src/procgen/tutorial-registry.js';
import {
  campaignSnapshot,
  createCampaign,
  resetCampaign,
} from '../src/procgen/campaign-progression.js';

// Parâmetros de pior caso de cada texto que é função: o maior nome de fonte de
// dano, a maior pendência da saída, as mensagens da guarda e as origens da
// chegada de patógenos.
const WORST_CASE_PARAMS = {
  'survival.defeated': [
    { source: 'contaminação pelo fungo oportunista' },
    { source: 'colapso de raiz com murcha vascular' },
    { source: 'hifa invasiva de Rhizoctonia' },
  ],
  'p1.exit-blocked': [
    { missing: 'forme o biofilme na raiz amarela' },
    { missing: 'inocule Bacillus na raiz amarela' },
    { missing: 'lance um exsudato com E' },
    { missing: 'complete o objetivo' },
  ],
  'goal.blocked': [
    { message: 'Falta ferro e controlar o fungo' },
    { message: 'Faltam objetivos: veja a lista' },
  ],
  'arrival.ralstonia': [
    { where: 'de tecido necrosado' }, { where: 'pela esquerda' }, { where: 'por baixo' },
  ],
  'arrival.meloidogyne': [
    { where: 'de tecido necrosado' }, { where: 'pela direita' }, { where: 'pelo solo' },
  ],
};

function makeState(campaign = null) {
  return { time: 0, toast: '', toastTime: 0, campaign };
}

function makeNarrator({ campaign = null, tutorial = null, catalog } = {}) {
  const state = makeState(campaign);
  const narrator = createNarrator({ state, getTutorial: () => tutorial, ...(catalog ? { catalog } : {}) });
  registerNarrator(state, narrator);
  return { state, narrator };
}

function advance(narrator, seconds, step = .1) {
  for (let t = 0; t < seconds - 1e-9; t += step) narrator.update(step);
}

test('todo texto do catálogo cabe em 60 caracteres, sem ponto final', () => {
  for (const [id, entry] of Object.entries(NARRATION)) {
    const variants = typeof entry.text === 'function'
      ? (WORST_CASE_PARAMS[id] || [{}])
      : [{}];
    assert.ok(
      typeof entry.text !== 'function' || WORST_CASE_PARAMS[id],
      `${id} é função e precisa de parâmetros de pior caso no teste`,
    );
    for (const params of variants) {
      const text = narrationText(entry, params);
      assert.ok(text.length > 0, `${id} ficou vazio`);
      assert.ok(text.length <= NARRATION_TEXT_LIMIT, `${id} tem ${text.length} caracteres: "${text}"`);
      assert.ok(!/\.$/.test(text), `${id} termina com ponto: "${text}"`);
    }
  }
});

test('todo science tem cardId, e todo cardId existe no GUIA', () => {
  const known = new Set(tutorialCardIds);
  for (const [id, entry] of Object.entries(NARRATION)) {
    assert.ok(['science', 'hint', 'danger', 'system'].includes(entry.kind), `${id}: kind inválido`);
    if (entry.kind === 'science') assert.ok(entry.cardId, `${id}: ciência sem cardId`);
    if (entry.cardId) assert.ok(known.has(entry.cardId), `${id}: cardId desconhecido ${entry.cardId}`);
  }
});

test('nenhum texto visível traz jargão de desenvolvimento', () => {
  for (const [id, entry] of Object.entries(NARRATION)) {
    const variants = typeof entry.text === 'function' ? WORST_CASE_PARAMS[id] : [{}];
    for (const params of variants) {
      const text = narrationText(entry, params);
      assert.doesNotMatch(text, /chunk|vigor persistente|respawn/i, `${id}: "${text}"`);
    }
  }
});

test('ciência aparece uma vez por campanha e sobrevive ao snapshot', () => {
  const campaign = createCampaign('narracao');
  const { state, narrator } = makeNarrator({ campaign });
  assert.equal(narrate(state, 'rhizobium.curl'), true);
  assert.equal(state.toast, NARRATION['rhizobium.curl'].text);
  advance(narrator, 5.5);
  assert.ok(campaign.narrationSeen.includes('rhizobium.curl'));

  narrator.resetPhase();
  assert.equal(narrate(state, 'rhizobium.curl'), false, 'nova fase não repete ciência');

  const restored = createCampaign('outra', {
    storage: { getItem: () => JSON.stringify(campaignSnapshot(campaign)) },
  });
  assert.deepEqual(restored.narrationSeen, ['rhizobium.curl']);
  const second = makeNarrator({ campaign: restored });
  assert.equal(narrate(second.state, 'rhizobium.curl'), false, 'campanha restaurada lembra');

  resetCampaign(restored);
  assert.deepEqual(restored.narrationSeen, []);
  assert.equal(narrate(second.state, 'rhizobium.curl'), true, 'campanha nova volta a narrar');
});

test('instrução de fase volta depois de resetPhase', () => {
  const { state, narrator } = makeNarrator();
  assert.equal(narrate(state, 'exudate.empty'), true);
  advance(narrator, 5);
  assert.equal(narrate(state, 'exudate.empty'), false, 'mesma fase: dita uma vez');
  narrator.resetPhase();
  assert.equal(narrate(state, 'exudate.empty'), true, 'fase nova: volta');
});

test('escopo always respeita 6 s por id', () => {
  const { state, narrator } = makeNarrator();
  assert.equal(narrate(state, 'survival.defeated', { source: 'hifa de Rhizoctonia' }), true);
  advance(narrator, 3);
  assert.equal(narrate(state, 'survival.defeated', { source: 'hifa de Rhizoctonia' }), false);
  advance(narrator, 3.2);
  assert.equal(narrate(state, 'survival.defeated', { source: 'hifa de Rhizoctonia' }), true);
});

test('ciência com o cartão aberto ou pendente não aparece e fica dita', () => {
  const tutorial = { currentCardId: 'structure-nodule', pendingCards: [{ cardId: 'process-fbn' }] };
  const { state, narrator } = makeNarrator({ tutorial });
  assert.equal(narrate(state, 'rhizobium.curl'), false);
  assert.equal(narrate(state, 'rhizobium.mature'), false);
  assert.equal(state.toast, '');
  tutorial.currentCardId = null;
  tutorial.pendingCards = [];
  assert.equal(narrate(state, 'rhizobium.curl'), false, 'marcada como dita');
  assert.equal(narrate(state, 'rhizobium.mature'), false, 'marcada como dita');
  assert.deepEqual(narrator.diagnostics().campaignSeen.sort(), ['rhizobium.curl', 'rhizobium.mature']);
});

test('cartão que abre depois do say derruba a ciência em tela', () => {
  const tutorial = { currentCardId: null, pendingCards: [] };
  const { state, narrator } = makeNarrator({ tutorial });
  narrate(state, 'melo.hatch');
  assert.equal(state.toast, NARRATION['melo.hatch'].text);
  tutorial.pendingCards = [{ cardId: 'structure-egg-mass' }];
  narrator.observeTutorial();
  assert.equal(state.toastTime, 0);
  assert.equal(narrator.current, null);
  assert.equal(narrate(state, 'melo.hatch'), false);
});

test('nada troca a mensagem antes do tempo mínimo, exceto perigo', () => {
  const { state, narrator } = makeNarrator();
  narrate(state, 'bacillus.mature');
  const first = state.toast;
  const duration = narrationDisplaySeconds(first);
  narrate(state, 'exudate.empty');
  narrate(state, 'pseudo.chelate');
  advance(narrator, duration - .2);
  assert.equal(state.toast, first, 'hint e ciência esperam na fila');

  // Um escritor antigo também não consegue encurtar o que está em tela.
  state.toast = 'escritor antigo';
  state.toastTime = .01;
  narrator.update(.05);
  assert.equal(state.toast, first);

  narrate(state, 'rhizoc.attack');
  assert.equal(state.toast, NARRATION['rhizoc.attack'].text, 'perigo interrompe na hora');
});

test('mensagem interrompida antes de 1,5 s não fica marcada', () => {
  const { state, narrator } = makeNarrator();
  narrate(state, 'bacillus.mature');
  advance(narrator, 1);
  narrate(state, 'root.collapse');
  assert.equal(state.toast, 'Raiz em colapso');
  assert.equal(narrator.diagnostics().campaignSeen.includes('bacillus.mature'), false);
  advance(narrator, 5);
  assert.equal(narrate(state, 'bacillus.mature'), true, 'pode voltar na próxima ocorrência');

  advance(narrator, 1.6);
  assert.ok(narrator.diagnostics().campaignSeen.includes('bacillus.mature'), '≥ 1,5 s marca');
});

test('fila respeita prioridade, limite de 3 e descarta expirados', () => {
  const { state, narrator } = makeNarrator();
  narrate(state, 'bacillus.mature');
  narrate(state, 'melo.hatch');
  narrate(state, 'system.parallax-on');
  narrate(state, 'exudate.empty');
  narrate(state, 'tricho.exhausted');
  assert.deepEqual(
    narrator.queue.map(item => item.id),
    ['exudate.empty', 'tricho.exhausted', 'melo.hatch'],
    'hint > science > system; o de menor prioridade sai quando lota',
  );

  // Instrução expira em 5 s na fila; ciência em 8 s.
  advance(narrator, 4.8);
  assert.equal(state.toast, NARRATION['exudate.empty'].text);
  advance(narrator, narrationDisplaySeconds(state.toast) + .1);
  assert.notEqual(state.toast, NARRATION['tricho.exhausted'].text, 'instrução velha foi descartada');
  assert.equal(state.toast, NARRATION['melo.hatch'].text, 'ciência ainda válida entra');
});

test('narrate sem narrador registrado mantém o comportamento antigo', () => {
  const state = { toast: '', toastTime: 0 };
  assert.equal(narrate(state, 'azo.coinoculation'), true);
  assert.equal(state.toast, 'Co-inoculação: FBN potencializada');
  assert.equal(state.toastTime, 4);
  narrate(state, 'goal.blocked', { message: 'Prova pendente' });
  assert.equal(state.toast, 'Prova pendente');
  assert.equal(narrate(state, 'id-inexistente'), false);
});

test('toast carrega o cardId para o botão ◈', () => {
  const { state } = makeNarrator();
  narrate(state, 'pseudo.chelate');
  assert.equal(state.toastCardId, 'process-siderophore');
  const other = makeNarrator();
  narrate(other.state, 'exudate.empty');
  assert.equal(other.state.toastCardId, null);
});

test('tempo em tela segue 1,8 + 0,05 × caracteres, entre 2,5 e 5 s', () => {
  assert.equal(narrationDisplaySeconds('Raiz em colapso'), 2.55);
  assert.equal(narrationDisplaySeconds('x'), 2.5);
  assert.equal(narrationDisplaySeconds('x'.repeat(80)), 5);
});
