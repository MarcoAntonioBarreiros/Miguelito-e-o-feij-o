// Focos de patogeno do diretor de salas (fase 10 em diante)
// ========================================================
//
// O diretor marca uma raiz (`pathogenFocusRoom`) e o bloco anterior
// (`pathogenPrepHost`). Aqui entram o foco e o que o controla:
//
//   ralstonia   infeccao vascular ja instalada (mesmo encontro de contencao
//               da fase 9): Bacillus, Pseudomonas, 3 exsudatos e ferro antes.
//   meloidogyne massa de ovos na raiz, que so eclode quando o jogador chega
//               perto: Trichoderma e 2 exsudatos antes.
//
// As chegadas dinamicas (pressao do solo) continuam como estao; estes focos
// somam a elas. Nenhum dos dois bloqueia a saida da fase 10 (o teste final
// dela e pontuacao + raiz final), entao nao ha softlock possivel.

import { prepareRalstoniaFocusRoom } from './ralstonia-teaching.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function addEncounter(level, host, organism, role) {
  const existing = (level.microbeEncounters || []).find(e => (e.id || e.type) === organism
    && (e.platform === host || e.hostPlatform === host));
  if (existing) return existing;
  const encounter = {
    id: organism,
    platform: host,
    platformId: host.id ?? host.platformId ?? null,
    logicIndex: host.logicIndex,
    x: host.x + host.w * .45,
    y: host.y - 78,
    r: 155,
    territory: 360,
    collect: false,
    source: 'pathogen-focus-room',
    teachingRole: role,
    requiresSeenCardId: null,
  };
  level.microbeEncounters.push(encounter);
  return encounter;
}

function addExudates(level, host, count, id) {
  const items = [];
  for (let index = 0; index < count; index++) {
    const lateral = count === 1 ? .5 : .25 + index * (.5 / (count - 1));
    const item = {
      id: `${id}-exsudato-${index}`,
      platform: host,
      platformId: host.id ?? host.platformId ?? null,
      logicIndex: host.logicIndex,
      x: host.x + clamp(host.w * lateral, 24, host.w - 24),
      y: host.y - 34,
      taken: false,
      authored: true,
      source: 'pathogen-focus-room',
    };
    level.exudates.push(item);
    items.push(item);
  }
  return items;
}

export function preparePathogenFocusRooms(level, { seed } = {}) {
  if (!level?.directorRecipe?.pathogenFoci?.length) return [];
  level.microbeEncounters ||= [];
  level.exudates ||= [];
  const rooms = [];
  for (const focus of level.directorRecipe.pathogenFoci) {
    const root = (level.platforms || []).find(p => p.pathogenFocusId === focus.id && p.pathogenFocusRoom);
    const host = (level.platforms || []).find(p => p.pathogenFocusId === focus.id && p.pathogenPrepHost);
    if (!root || !host || root.type !== 'root') continue;
    if (focus.kind === 'ralstonia') {
      const lesson = prepareRalstoniaFocusRoom(level, { root, host, seed });
      if (lesson) rooms.push({ ...focus, root, host });
    } else if (focus.kind === 'meloidogyne') {
      addEncounter(level, host, 'trichoderma', 'nematode-focus');
      addExudates(level, host, 2, focus.id);
      level.authoredEggMasses = [
        ...(level.authoredEggMasses || []),
        { id: focus.id, platform: root, x: root.x + root.w * .6 },
      ];
      rooms.push({ ...focus, root, host });
    }
  }
  level.pathogenFocusRooms = rooms;
  return rooms;
}
