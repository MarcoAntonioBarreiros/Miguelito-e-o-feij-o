// Diretor de salas (fase 10 em diante)
// ====================================
//
// A fase deixa de ser "rota primeiro, desafios encaixados depois". O diretor
// decide ANTES da geometria uma receita: em que chunk entra cada sala, e entre
// elas trechos curtos de ligacao. O gerador constroi cada sala como geometria
// autoral (como os portoes) e o resto do chunk segue o pipeline de sempre.
//
// Por que: no plano vertical antigo a altura vinha do COMPRIMENTO das zonas
// (subidas e descidas lentas por 8-15 blocos), e a fase ficava repetitiva.
// Aqui o desnivel fica concentrado dentro das salas (subida de escada, queda
// forte) e as ligacoes sao curtas e quase planas, com relevo local.
//
// Salas da Etapa 1:
//   ascent          degrau de 240-330 px aberto pela escada de Azospirillum
//   drop            queda forte num passo so (170-260 px)
//   nitrogenGate    trio da FBN (raiz que so o nodulo completa) - 2 chunks
//   dashTunnel      tunel baixo com vao: anda -> Dash/propulsor -> anda - 2 chunks
//   phosphateTunnel tunel bloqueado por cristal (com ou sem vao) - 2 chunks
//   bridge          vao largo da ponte de micorriza (ja existia na fase 10)

import { createRandom } from './random.js';
import { PHASE_VERTICAL_ENVELOPE } from './phase-vertical-plan.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const DIRECTOR_ROOMS = Object.freeze({
  ascent: Object.freeze({ chunks: 1, gateKind: 'azospirillumAscent', max: 3, weight: 1.2 }),
  drop: Object.freeze({ chunks: 1, gateKind: null, max: 3, weight: 1.0 }),
  nitrogenGate: Object.freeze({ chunks: 2, gateKind: 'nitrogenRootGate', max: 2, weight: 1.0 }),
  dashTunnel: Object.freeze({ chunks: 2, gateKind: null, ability: 'dash', max: 2, weight: 1.0 }),
  phosphateTunnel: Object.freeze({ chunks: 2, gateKind: null, ability: 'phosphateSolubilization', max: 2, weight: 1.1 }),
  bridge: Object.freeze({ chunks: 1, gateKind: 'mycorrhizaBridge', max: 1, weight: .7 }),
});

// Alturas medias usadas so para o diretor decidir se ha espaco (a altura real
// sai do gerador, que confere de novo).
const ASCENT_AVG = 285;
const ASCENT_MAX = 330;
const DROP_MAX = 260;
const LIGHT_MARGIN = 60;
const FIRST_ROOM_CHUNK = 6;
const CONNECTOR_RANGE = Object.freeze([2, 3]);
// Relevo das ligacoes, relativo a saida da ultima sala (negativo sobe)
const CONNECTOR_OFFSET = Object.freeze([-80, 50]);

// COMBOS: salas encadeadas com 1 bloco de ligacao entre elas. O segundo
// desafio depende do primeiro (subiu a torre, nodulou e ja sobe; caiu e ja
// entra no tunel...). No maximo 2 por fase.
export const DIRECTOR_COMBOS = Object.freeze([
  Object.freeze({ id: 'torre', rooms: Object.freeze(['ascent', 'ascent']) }),
  Object.freeze({ id: 'nodula-e-sobe', rooms: Object.freeze(['nitrogenGate', 'ascent']) }),
  Object.freeze({ id: 'cai-no-tunel', rooms: Object.freeze(['drop', 'dashTunnel']) }),
  Object.freeze({ id: 'dissolve-e-cai', rooms: Object.freeze(['phosphateTunnel', 'drop']) }),
  Object.freeze({ id: 'ponte-e-fosfato', rooms: Object.freeze(['bridge', 'phosphateTunnel']) }),
]);
const MAX_COMBOS = 2;
const COMBO_CHANCE = .45;

// DESVIO OPCIONAL com lugar reservado: o diretor guarda uma janela sem tunel
// nem subida (o desvio passa POR CIMA da rota e o teto do tunel sobe ate a
// superficie). Dentro dela so salas planas ou de descida.
const DETOUR_WINDOW_CHUNKS = 17;

const DETOUR_FIRST_CHUNK = 6;
const DETOUR_MIN_OUTSIDE = 12;
const DETOUR_ROOMS = new Set(['nitrogenGate', 'bridge', 'drop']);

function blocked(chunk) {
  return !chunk || chunk.isSkillIntro || chunk.allyId || chunk.isCheckpoint;
}

/**
 * Receita da fase: lista de salas por chunk e o relevo das ligacoes.
 * `logic` e o grafo logico ja gerado (o diretor evita checkpoints/estreias).
 */
export function createPhaseRecipe({
  seedValue = '',
  phase = 10,
  logic = [],
  gateKinds = [],
  abilities = {},
  lastChunk = null,
  reservedChunks = [],
  baseY = 500,
  envelope = PHASE_VERTICAL_ENVELOPE,
} = {}) {
  const total = logic.length;
  if (total < 12) return null;
  const rnd = createRandom(`${seedValue}:diretor:p${phase}`);
  rnd(); rnd();
  const gates = new Set(gateKinds);
  const available = Object.entries(DIRECTOR_ROOMS)
    .filter(([, room]) => (room.gateKind ? gates.has(room.gateKind) : true))
    .filter(([, room]) => !room.ability || abilities[room.ability] !== false)
    .map(([kind]) => kind);
  // encontros de travessia ja ocupam o chunk (e a saida deles o seguinte)
  const reserved = new Set(reservedChunks.flatMap(at => [at, at + 1]));
  const end = Math.min(total - 3, Number.isFinite(lastChunk) ? lastChunk : total - 3);

  // janela do desvio: escolhida antes das salas
  let detour = null;
  // So ha desvio se, fora da janela, sobra trecho para as outras salas (os
  // tuneis nao entram na janela). Fase curta fica sem desvio e com mais salas.
  if ((end - FIRST_ROOM_CHUNK + 1) - (DETOUR_WINDOW_CHUNKS + 1) >= DETOUR_MIN_OUTSIDE) {
    const choices = [];
    // perto do comeco ou do fim da fase: o resto fica num trecho continuo
    // para as salas (e os tuneis) em vez de picotado dos dois lados
    const last = end - DETOUR_WINDOW_CHUNKS;
    for (let at = DETOUR_FIRST_CHUNK; at <= last; at++) {
      const nearEdge = at <= DETOUR_FIRST_CHUNK + 2 || at >= last - 2;
      if (nearEdge && !blocked(logic[at]) && !reserved.has(at)) choices.push(at);
    }
    if (choices.length) {
      const startChunk = choices[Math.floor(rnd() * choices.length)];
      detour = { startChunk, windowEnd: startChunk + DETOUR_WINDOW_CHUNKS };
    }
  }
  const inDetour = at => detour && at >= detour.startChunk && at <= detour.windowEnd;

  const rooms = [];
  const combos = [];
  const used = {};
  const offsets = new Array(total).fill(0);
  let level = baseY;
  let last = null;
  let cursor = FIRST_ROOM_CHUNK;

  const fits = (kind, at) => {
    const room = DIRECTOR_ROOMS[kind];
    if ((used[kind] || 0) >= room.max) return false;
    if (kind === last) return false;
    if (at + room.chunks - 1 > end) return false;
    if (detour) {
      // o bloco de partida do desvio e comum; dentro da janela, so sala plana
      // (nem o seguinte: o portao usa o bloco anterior como hospedeiro)
      if (at <= detour.startChunk + 1 && at + room.chunks - 1 >= detour.startChunk) return false;

      for (let k = 0; k < room.chunks; k++) if (inDetour(at + k) && !DETOUR_ROOMS.has(kind)) return false;
    }
    for (let k = 0; k < room.chunks; k++) if (blocked(logic[at + k]) || reserved.has(at + k)) return false;
    // o chunk de depois tambem e autoral no portao da FBN e nos tuneis
    if (kind === 'ascent' && level - ASCENT_MAX < envelope.top + LIGHT_MARGIN) return false;
    if (kind === 'drop' && level + DROP_MAX > envelope.bottom - 40) return false;
    return true;
  };

  const place = (kind, at) => {
    const room = DIRECTOR_ROOMS[kind];
    const entry = { kind, chunkIndex: at, chunks: room.chunks, gateKind: room.gateKind, id: `${kind}-${at}` };
    rooms.push(entry);
    used[kind] = (used[kind] || 0) + 1;
    last = kind;
    if (kind === 'ascent') level -= ASCENT_AVG;
    if (kind === 'drop') level += 215;
    return entry;
  };
  const connectorAfter = (at, length) => {
    const offset = Math.round(CONNECTOR_OFFSET[0] + rnd() * (CONNECTOR_OFFSET[1] - CONNECTOR_OFFSET[0]));
    for (let k = 0; k < length; k++) if (at + k < total) offsets[at + k] = offset;
  };

  // Tenta um combo a partir de `at`: cada sala cabe, com 1 bloco entre elas.
  const tryCombo = at => {
    const options = DIRECTOR_COMBOS.filter(combo => {
      if (combos.some(c => c.id === combo.id)) return false;
      if (combo.rooms.every(kind => !available.includes(kind)) || !combo.rooms.every(kind => available.includes(kind))) return false;
      const savedLevel = level, savedLast = last, savedUsed = { ...used };
      let cursorAt = at, ok = true;
      for (const [index, kind] of combo.rooms.entries()) {
        // a torre repete a sala de proposito
        if (index && kind === last) last = null;
        if (!fits(kind, cursorAt)) { ok = false; break; }
        used[kind] = (used[kind] || 0) + 1;
        last = kind;
        if (kind === 'ascent') level -= ASCENT_AVG;
        if (kind === 'drop') level += 215;
        cursorAt += DIRECTOR_ROOMS[kind].chunks + 1;
      }
      level = savedLevel; last = savedLast;
      for (const key of Object.keys(used)) delete used[key];
      Object.assign(used, savedUsed);
      return ok;
    });
    if (!options.length) return 0;
    const combo = options[Math.floor(rnd() * options.length)];
    let cursorAt = at;
    const placed = [];
    for (const [index, kind] of combo.rooms.entries()) {
      if (index && kind === last) last = null;
      placed.push(place(kind, cursorAt).id);
      cursorAt += DIRECTOR_ROOMS[kind].chunks;
      if (index < combo.rooms.length - 1) { connectorAfter(cursorAt, 1); cursorAt += 1; }
    }
    for (const id of placed) rooms.find(r => r.id === id).comboId = combo.id;
    combos.push({ id: combo.id, rooms: placed });
    return cursorAt - at;
  };

  while (cursor <= end) {
    if (combos.length < MAX_COMBOS && !inDetour(cursor) && rnd() < COMBO_CHANCE) {
      const span = tryCombo(cursor);
      if (span) {
        const connector = CONNECTOR_RANGE[0] + Math.floor(rnd() * (CONNECTOR_RANGE[1] - CONNECTOR_RANGE[0] + 1));
        connectorAfter(cursor + span, connector);
        cursor += span + connector;
        continue;
      }
    }
    const options = available.filter(kind => fits(kind, cursor));
    if (!options.length) { cursor++; continue; }
    const weights = options.map(kind => {
      let w = DIRECTOR_ROOMS[kind].weight;
      if (!used[kind]) w *= /Tunnel$/.test(kind) ? 10 : 4; // cada sala aparece ao menos uma vez
      if (kind === 'drop' && level < 260) w *= 3;      // alto demais: desce
      if (kind === 'ascent' && level > 420) w *= 3;    // baixo demais: sobe
      return w;
    });
    let pick = rnd() * weights.reduce((s, w) => s + w, 0);
    let kind = options[0];
    for (let k = 0; k < options.length; k++) { pick -= weights[k]; if (pick <= 0) { kind = options[k]; break; } }
    const room = DIRECTOR_ROOMS[kind];
    place(kind, cursor);
    // ligacao curta: relevo proprio, sem rampa longa
    const connector = CONNECTOR_RANGE[0] + Math.floor(rnd() * (CONNECTOR_RANGE[1] - CONNECTOR_RANGE[0] + 1));
    connectorAfter(cursor + room.chunks, connector);
    cursor += room.chunks + connector;
  }

  // Os dois tuneis sao o desafio central das fases 8-10: se o sorteio nao os
  // trouxe (a janela do desvio ocupa boa parte da fase), troca uma sala plana
  // fora da janela pelo tunel que faltou.
  const startsAt = new Set(rooms.map(r => r.chunkIndex));
  for (const kind of ['phosphateTunnel', 'dashTunnel']) {
    if (!available.includes(kind) || rooms.some(r => r.kind === kind)) continue;
    const other = kind === 'dashTunnel' ? 'phosphateTunnel' : 'dashTunnel';
    // subida e queda nao entram: mudariam a altura que o resto da receita supos
    const order = ['nitrogenGate', 'bridge', other];
    const swap = rooms
      .filter(r => !r.comboId && order.includes(r.kind))
      // o outro tunel so cede se ele aparece duas vezes
      .filter(r => r.kind !== other || (used[other] || 0) > 1)
      .filter(r => !inDetour(r.chunkIndex) && !inDetour(r.chunkIndex + 1))
      .filter(r => r.chunks === 2 || (
        !inDetour(r.chunkIndex) && !inDetour(r.chunkIndex + 1) && r.chunkIndex + 1 <= end
        && !blocked(logic[r.chunkIndex + 1]) && !reserved.has(r.chunkIndex + 1)
        && !startsAt.has(r.chunkIndex + 1) && !startsAt.has(r.chunkIndex + 2)
        && ((used[r.kind] || 0) > 1 || r.kind === 'nitrogenGate' || r.kind === 'bridge')))
      .filter(r => {
        const k = rooms.indexOf(r);
        return rooms[k - 1]?.kind !== kind && rooms[k + 1]?.kind !== kind;
      })
      .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0];
    if (!swap) continue;
    used[swap.kind] -= 1;
    used[kind] = (used[kind] || 0) + 1;
    swap.swappedFrom = swap.kind;
    swap.kind = kind;
    swap.chunks = DIRECTOR_ROOMS[kind].chunks;
    swap.gateKind = null;
    swap.id = `${kind}-${swap.chunkIndex}`;
  }

  const byChunk = new Map();
  for (const room of rooms) byChunk.set(room.chunkIndex, room);
  return {
    phase,
    rooms,
    byChunk,
    offsets,
    envelope,
    baseY,
    combos,
    detour,
    signature: rooms.map(room => (room.comboId ? `[${room.kind}]` : room.kind)).join('>'),
  };
}

/** Faixa que o chunk comum mira: a saida da ultima sala + o relevo da ligacao. */
export function directorBand(recipe, index, level) {
  const target = Math.round(clamp(level + (recipe.offsets[index] || 0), recipe.envelope.top + 40, recipe.envelope.bottom - 40));
  return {
    zoneId: `diretor:${index}`,
    role: 'connector',
    verticalIntent: 'hold',
    target,
    floorLimit: recipe.envelope.top,
    ceilingLimit: recipe.envelope.bottom,
    top: target - 50,
    bottom: target + 50,
  };
}
