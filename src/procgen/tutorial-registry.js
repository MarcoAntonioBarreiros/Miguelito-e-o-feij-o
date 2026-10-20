import { gameplayTutorialCards } from './tutorial-cards-gameplay.js';
import { organismTutorialCards } from './tutorial-cards-organisms.js';
import { structureTutorialCards } from './tutorial-cards-structures.js';
import { CYCLE_REVISION, NEW_CARDS, PAGE_REVISION } from './tutorial-text-revision.js';

// Os textos que o jogador le vem da revisao (tutorial-text-revision.js): corpo
// curto, ate 2 topicos e paginas de continuacao (`more`). Os arquivos
// tutorial-cards-*.js guardam so a identidade de cada cartao (titulo, cor,
// glifo). A revisao preserva a quantidade de paginas, entao os desbloqueios do
// manifesto (pageUnlocks) e o progresso salvo continuam apontando para as
// mesmas posicoes.
function revisePages(id, pages) {
  const revised = PAGE_REVISION[id];
  if (!revised) return pages;
  if (revised.length !== pages.length) {
    throw new Error(`Revisao de ${id} mudou o numero de paginas (${pages.length} -> ${revised.length}).`);
  }
  return revised.map(page => ({
    title: page.title,
    body: page.body,
    points: [...(page.points || [])],
    more: (page.more || []).map(extra => ({ body: extra.body, points: [...(extra.points || [])] })),
  }));
}

// So 13 cartoes mantem ciclo, e o ciclo nao entra na primeira apresentacao:
// e revisado no fim da fase (`cyclePhase`) e depois fica no GUIA.
function reviseCycle(card) {
  const cycle = CYCLE_REVISION[card.id];
  return cycle
    ? { cycle: cycle.steps.map(step => ({ ...step })), cycleLabel: cycle.label, cyclePhase: cycle.phase }
    : { cycle: [], cycleLabel: '', cyclePhase: null };
}

// Cartoes novos: abrem na primeira vez que a situacao acontece (inclusive em
// trecho silencioso — e um estado novo do jogo, nao uma estreia de organismo).
// `taughtInPhase`: quem comeca numa fase posterior ja os recebe como vistos.
// A zona necrotica e apresentada pela chegada guiada; o cartao so fica no GUIA.
const NEW_CARD_RUNTIME = {
  'action-selection': { policy: 'first-occurrence', taughtInPhase: 1, after: 'action-inoculation' },
  'hazard-necrotic-zone': { policy: 'guide-only', taughtInPhase: 1, after: 'system-welcome' },
  'hud-radar': { policy: 'first-occurrence', taughtInPhase: 8, after: 'action-selection' },
  'status-contamination': { policy: 'first-occurrence', taughtInPhase: 5, after: 'process-root-collapse' },
  'status-j2-carried': { policy: 'first-occurrence', taughtInPhase: 8, after: 'status-contamination' },
  'event-calm': { policy: 'first-occurrence', taughtInPhase: null, after: 'process-iron-competition' },
};

const baseCards = {
  ...gameplayTutorialCards,
  ...organismTutorialCards,
  ...structureTutorialCards,
};

const revisedCards = {};
for (const [id, card] of Object.entries(baseCards)) {
  revisedCards[id] = Object.freeze({ ...card, pages: revisePages(id, card.pages), ...reviseCycle(card) });
}
for (const [id, card] of Object.entries(NEW_CARDS)) {
  const runtime = NEW_CARD_RUNTIME[id] || {};
  revisedCards[id] = Object.freeze({
    id,
    category: card.category,
    title: card.title,
    subtitle: card.subtitle,
    glyph: card.glyph,
    accent: card.accent,
    pages: card.pages.map(page => ({ title: page.title, body: page.body, points: [...(page.points || [])], more: [] })),
    cycle: [],
    cycleLabel: '',
    cyclePhase: null,
    policy: runtime.policy || 'first-occurrence',
    taughtInPhase: runtime.taughtInPhase ?? null,
  });
}

// Ordem do GUIA: cada cartao novo entra logo depois do cartao com que conversa,
// e o micoparasitismo fica junto do Trichoderma (e parte dele).
const GUIDE_AFTER = {
  ...Object.fromEntries(Object.entries(NEW_CARD_RUNTIME).map(([id, runtime]) => [id, runtime.after])),
  'process-mycoparasitism': 'organism-trichoderma',
};

function guideOrder(ids) {
  const order = ids.filter(id => !GUIDE_AFTER[id]);
  const pending = ids.filter(id => GUIDE_AFTER[id]);
  while (pending.length) {
    const index = pending.findIndex(id => order.includes(GUIDE_AFTER[id]));
    const id = pending.splice(index < 0 ? 0 : index, 1)[0];
    const anchor = order.indexOf(GUIDE_AFTER[id]);
    order.splice(anchor < 0 ? order.length : anchor + 1, 0, id);
  }
  return order;
}

export const tutorialCards = Object.freeze(revisedCards);

export const tutorialCardIds = Object.freeze(guideOrder(Object.keys(revisedCards)));

export function getTutorialCard(id) {
  return tutorialCards[id] || null;
}

// Cartoes cujo ciclo e revisado no fim de `phase`, na ordem do GUIA.
export function cycleCardsForPhase(phase) {
  return tutorialCardIds.filter(id => tutorialCards[id].cycle.length && tutorialCards[id].cyclePhase === phase);
}

// Cartoes novos (fora do manifesto) que fases anteriores ja ensinaram.
export function newCardsTaughtBeforePhase(phase) {
  return tutorialCardIds.filter(id => {
    const taught = tutorialCards[id].taughtInPhase;
    return Number.isInteger(taught) && taught < phase;
  });
}
