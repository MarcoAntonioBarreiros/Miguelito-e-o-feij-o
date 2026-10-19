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

  const rooms = [];
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
    for (let k = 0; k < room.chunks; k++) if (blocked(logic[at + k]) || reserved.has(at + k)) return false;
    // o chunk de depois tambem e autoral no portao da FBN e nos tuneis
    if (kind === 'ascent' && level - ASCENT_MAX < envelope.top + LIGHT_MARGIN) return false;
    if (kind === 'drop' && level + DROP_MAX > envelope.bottom - 40) return false;
    return true;
  };

  while (cursor <= end) {
    const options = available.filter(kind => fits(kind, cursor));
    if (!options.length) { cursor++; continue; }
    const weights = options.map(kind => {
      let w = DIRECTOR_ROOMS[kind].weight;
      if (!used[kind]) w *= 4;                         // cada sala aparece ao menos uma vez
      if (kind === 'drop' && level < 260) w *= 3;      // alto demais: desce
      if (kind === 'ascent' && level > 420) w *= 3;    // baixo demais: sobe
      return w;
    });
    let pick = rnd() * weights.reduce((s, w) => s + w, 0);
    let kind = options[0];
    for (let k = 0; k < options.length; k++) { pick -= weights[k]; if (pick <= 0) { kind = options[k]; break; } }
    const room = DIRECTOR_ROOMS[kind];
    rooms.push({ kind, chunkIndex: cursor, chunks: room.chunks, gateKind: room.gateKind, id: `${kind}-${cursor}` });
    used[kind] = (used[kind] || 0) + 1;
    last = kind;
    if (kind === 'ascent') level -= ASCENT_AVG;
    if (kind === 'drop') level += 215;
    // ligacao curta: relevo proprio, sem rampa longa
    const connector = CONNECTOR_RANGE[0] + Math.floor(rnd() * (CONNECTOR_RANGE[1] - CONNECTOR_RANGE[0] + 1));
    const offset = Math.round(CONNECTOR_OFFSET[0] + rnd() * (CONNECTOR_OFFSET[1] - CONNECTOR_OFFSET[0]));
    for (let k = 0; k < connector; k++) {
      const at = cursor + room.chunks + k;
      if (at < total) offsets[at] = offset;
    }
    cursor += room.chunks + connector;
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
    signature: rooms.map(room => room.kind).join('>'),
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
