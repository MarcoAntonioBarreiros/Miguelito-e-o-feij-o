// Árbitro único do toast.
//
// Antes, cada módulo gravava direto em `state.toast` com cooldown próprio: uma
// mensagem de 5 s podia ser sobrescrita 0,1 s depois por outro módulo, e quase
// tudo se repetia a cada ocorrência. Agora os módulos chamam
// `narrate(state, id, params)` e o narrador decide o que entra em tela, quando
// e por quanto tempo. Os textos vivem em narration-catalog.js; as classes estão
// descritas em docs/narration.md.
import { NARRATION, narrationText } from './narration-catalog.js';
import { persistCampaign } from './campaign-progression.js';

const PRIORITY = Object.freeze({ danger: 3, hint: 2, science: 1, system: 0 });
const DEFAULT_SCOPE = Object.freeze({
  science: 'campaign',
  hint: 'phase',
  danger: 'phase',
  system: 'always',
});
// Quanto tempo um item pode esperar na fila antes de perder o sentido. Instrução
// fala do que está acontecendo agora; feedback de botão fica velho logo.
const QUEUE_TTL = Object.freeze({ science: 8, hint: 5, system: 4, danger: Infinity });
const MAX_QUEUE = 3;
const ALWAYS_MIN_INTERVAL = 6;
const MARK_SEEN_AFTER = 1.5;

export function narrationDisplaySeconds(text) {
  return Math.min(5, Math.max(2.5, 1.8 + .05 * String(text || '').length));
}

function cardIsShowing(tutorial, cardId) {
  if (!tutorial || !cardId) return false;
  try {
    if (tutorial.currentCardId === cardId) return true;
    const pending = tutorial.pendingCards;
    return Array.isArray(pending) && pending.some(entry => entry?.cardId === cardId);
  } catch (_) {
    return false;
  }
}

export function createNarrator({
  state,
  campaign = null,
  getTutorial = () => null,
  catalog = NARRATION,
} = {}) {
  const phaseSeen = new Set();
  // Sem campanha (simuladores auxiliares, Phase Lab sem storage) o escopo de
  // campanha vive só na memória deste narrador.
  const localCampaignSeen = new Set();
  const lastSaidAt = new Map();
  const queue = [];
  let current = null;
  let clock = 0;
  let serial = 0;

  function activeCampaign() {
    return campaign || state?.campaign || null;
  }

  function campaignSeenList() {
    const target = activeCampaign();
    if (!target) return null;
    if (!Array.isArray(target.narrationSeen)) target.narrationSeen = [];
    return target.narrationSeen;
  }

  function scopeOf(entry) {
    return entry.scope || DEFAULT_SCOPE[entry.kind] || 'phase';
  }

  function tutorial() {
    try {
      return getTutorial?.() || null;
    } catch (_) {
      return null;
    }
  }

  function hasBeenSaid(id, entry) {
    const scope = scopeOf(entry);
    if (scope === 'campaign') {
      const list = campaignSeenList();
      return list ? list.includes(id) : localCampaignSeen.has(id);
    }
    if (scope === 'phase') return phaseSeen.has(id);
    return false;
  }

  function markSaid(id, entry) {
    const scope = scopeOf(entry);
    if (scope === 'campaign') {
      const list = campaignSeenList();
      if (list) {
        if (!list.includes(id)) {
          list.push(id);
          // Mesmo sessionStorage da campanha: recarregar a página não repete.
          persistCampaign(activeCampaign());
        }
      } else {
        localCampaignSeen.add(id);
      }
    } else if (scope === 'phase') {
      phaseSeen.add(id);
    }
  }

  function writeToState(item) {
    if (!state) return;
    state.toast = item ? item.text : '';
    state.toastTime = item ? item.duration : 0;
    state.toastCardId = item?.cardId || null;
    state.toastSerial = item ? item.serial : state.toastSerial;
  }

  function start(item) {
    item.shownFor = 0;
    current = item;
    writeToState(item);
  }

  function isQueuedOrCurrent(id) {
    return current?.id === id || queue.some(item => item.id === id);
  }

  function enqueue(item) {
    queue.push(item);
    // Estável: a ordem de chegada desempata a mesma prioridade.
    queue.sort((a, b) => (PRIORITY[b.kind] - PRIORITY[a.kind]) || (a.serial - b.serial));
    while (queue.length > MAX_QUEUE) queue.pop();
    return queue.includes(item);
  }

  function say(id, params = {}) {
    const entry = catalog[id];
    if (!entry || entry.kind === 'state') return false;
    const scope = scopeOf(entry);
    if (hasBeenSaid(id, entry)) return false;
    if (isQueuedOrCurrent(id) && scope !== 'always') return false;
    if (scope === 'always' && entry.kind !== 'system') {
      const last = lastSaidAt.get(id);
      if (Number.isFinite(last) && clock - last < ALWAYS_MIN_INTERVAL) return false;
    }
    if (entry.kind === 'science' && cardIsShowing(tutorial(), entry.cardId)) {
      // O cartão já está explicando isto agora; o GUIA fica como consulta.
      markSaid(id, entry);
      return false;
    }

    const text = narrationText(entry, params);
    if (!text) return false;
    serial++;
    const item = {
      id,
      kind: entry.kind,
      cardId: entry.cardId || null,
      text,
      duration: narrationDisplaySeconds(text),
      queuedAt: clock,
      serial,
      shownFor: 0,
      marked: false,
    };
    lastSaidAt.set(id, clock);

    if (entry.kind === 'danger') {
      // Perigo interrompe. O que estava em tela há menos de 1,5 s não conta
      // como dito e pode voltar na próxima ocorrência.
      start(item);
      return true;
    }
    if (!current && !queue.length) {
      start(item);
      return true;
    }
    return enqueue(item);
  }

  function markIfShownEnough(item) {
    if (!item || item.marked || item.shownFor < MARK_SEEN_AFTER) return;
    item.marked = true;
    const entry = catalog[item.id];
    if (entry) markSaid(item.id, entry);
  }

  // Um cartão que abriu no mesmo quadro (ou entrou na fila) depois do `say`
  // cobre a mensagem de ciência correspondente: ela sai e fica marcada.
  function observeTutorial() {
    const guide = tutorial();
    if (!guide) return;
    for (let i = queue.length - 1; i >= 0; i--) {
      const item = queue[i];
      if (item.kind !== 'science' || !cardIsShowing(guide, item.cardId)) continue;
      markSaid(item.id, catalog[item.id]);
      queue.splice(i, 1);
    }
    if (current && current.kind === 'science' && !current.marked && cardIsShowing(guide, current.cardId)) {
      markSaid(current.id, catalog[current.id]);
      current = null;
      writeToState(null);
    }
  }

  function update(dt = 0) {
    const step = Math.max(0, Number(dt) || 0);
    clock += step;
    observeTutorial();

    if (current) {
      current.shownFor += step;
      markIfShownEnough(current);
      if (current.shownFor >= current.duration) {
        current = null;
      } else if (state) {
        // Nenhum escritor antigo pode encurtar ou trocar o que está em tela.
        state.toast = current.text;
        state.toastTime = current.duration - current.shownFor;
        state.toastCardId = current.cardId;
      }
    }

    for (let i = queue.length - 1; i >= 0; i--) {
      const item = queue[i];
      if (clock - item.queuedAt > QUEUE_TTL[item.kind]) queue.splice(i, 1);
    }

    if (!current && queue.length) start(queue.shift());
  }

  function resetPhase() {
    phaseSeen.clear();
    queue.length = 0;
    current = null;
    lastSaidAt.clear();
    writeToState(null);
  }

  function resetCampaign() {
    localCampaignSeen.clear();
    const target = activeCampaign();
    if (target) target.narrationSeen = [];
    resetPhase();
  }

  function diagnostics() {
    return {
      clock,
      current: current ? { id: current.id, kind: current.kind, text: current.text, shownFor: current.shownFor } : null,
      queue: queue.map(item => ({ id: item.id, kind: item.kind, age: clock - item.queuedAt })),
      phaseSeen: [...phaseSeen],
      campaignSeen: [...(campaignSeenList() || localCampaignSeen)],
    };
  }

  return {
    say,
    update,
    observeTutorial,
    resetPhase,
    resetCampaign,
    diagnostics,
    get current() { return current; },
    get queue() { return queue.slice(); },
  };
}

const narrators = new WeakMap();

export function registerNarrator(state, narrator) {
  if (state && narrator) narrators.set(state, narrator);
  return narrator;
}

export function getNarrator(state) {
  return state ? narrators.get(state) || null : null;
}

// Chamado pelos módulos. Sem narrador registrado (testes unitários com `state`
// literal, jogo não procedural), cai no comportamento antigo: escreve direto no
// toast.
export function narrate(state, id, params = {}) {
  const narrator = getNarrator(state);
  if (narrator) return narrator.say(id, params);
  const entry = NARRATION[id];
  if (!entry || !state) return false;
  state.toast = narrationText(entry, params);
  state.toastTime = 4;
  return true;
}
