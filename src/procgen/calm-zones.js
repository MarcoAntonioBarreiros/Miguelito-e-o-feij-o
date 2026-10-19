// Calmaria: Pseudomonas + Bacillus inoculados pelo jogador na mesma raiz (ou em
// raizes vizinhas) induzem resistencia sistemica na planta. Dentro do halo os
// patogenos e nematoides ficam "calmos": param de avancar e de causar dano,
// mas NAO sao removidos. Sai do halo (ou o halo se desfaz) e voltam ao normal
// aos poucos. O Trichoderma continua sendo o unico que mata.
//
// O raio NAO vem da area de influencia das colonias (que e pequena, ~60-130 px):
// e um raio proprio da calmaria, amplo, modulado pelo vigor somado do par.

import { narrate } from './narrator.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const CALM_ZONE_CONFIG = Object.freeze({
  // distancia maxima entre as duas colonias para formar o par
  pairDistance: 420,
  // raio do halo: vai de min a max conforme o vigor medio do par
  minRadius: 420,
  maxRadius: 600,
  // faixa da borda em que a calmaria cai de 1 para 0
  edge: 110,
  // colonia precisa ter aderido (crescimento) e ter vigor para contar
  minimumGrowth: .62,
  minimumVigor: .18,
  // entrada e saida do halo (s)
  rampIn: 1.5,
  rampOut: 2,
  // estado de cada patogeno acompanha a calmaria local com este atraso (s)
  entitySettle: 1.2,
  // calmaria sustentada por este tempo conta como controle (objetivos)
  controlHoldSeconds: 4,
  controlThreshold: .6,
  maxZones: 4,
});

function eligible(colony, config) {
  return colony
    && !colony.authored
    && !colony.dormant
    && (colony.type === 'pseudomonas' || colony.type === 'bacillus')
    && (colony.growth ?? 0) >= config.minimumGrowth
    && (colony.vigor ?? 0) >= config.minimumVigor;
}

// Pares Pseudomonas x Bacillus. Cada colonia entra no par mais proximo; pares
// cujo centro cai dentro de outro halo viram um so (o maior).
export function findCalmPairs(colonies = [], config = CALM_ZONE_CONFIG) {
  const pseudo = colonies.filter(c => eligible(c, config) && c.type === 'pseudomonas');
  const bacillus = colonies.filter(c => eligible(c, config) && c.type === 'bacillus');
  const candidates = [];
  for (const p of pseudo) {
    for (const b of bacillus) {
      const distance = Math.hypot(p.x - b.x, p.y - b.y);
      if (distance <= config.pairDistance) candidates.push({ p, b, distance });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const used = new Set();
  const pairs = [];
  for (const candidate of candidates) {
    if (used.has(candidate.p) || used.has(candidate.b)) continue;
    used.add(candidate.p);
    used.add(candidate.b);
    const vigor = clamp(((candidate.p.vigor ?? 0) + (candidate.b.vigor ?? 0)) / 2, 0, 1);
    pairs.push({
      key: `${candidate.p.id}|${candidate.b.id}`,
      x: (candidate.p.x + candidate.b.x) / 2,
      y: (candidate.p.y + candidate.b.y) / 2,
      vigor,
      radius: config.minRadius + (config.maxRadius - config.minRadius) * vigor,
      members: [candidate.p.id, candidate.b.id],
    });
  }
  pairs.sort((a, b) => b.radius - a.radius);
  const merged = [];
  for (const pair of pairs) {
    if (merged.some(zone => Math.hypot(zone.x - pair.x, zone.y - pair.y) < zone.radius * .5)) continue;
    merged.push(pair);
  }
  return merged.slice(0, config.maxZones);
}

export function calmLevelAt(zones, x, y, config = CALM_ZONE_CONFIG) {
  let best = 0;
  for (const zone of zones || []) {
    if (!(zone.intensity > 0)) continue;
    const distance = Math.hypot(x - zone.x, y - zone.y);
    const inner = zone.radius - config.edge;
    const local = distance <= inner ? 1
      : distance >= zone.radius ? 0
        : 1 - (distance - inner) / config.edge;
    best = Math.max(best, local * zone.intensity);
  }
  return clamp(best, 0, 1);
}

export function createCalmZones({ state, inoculants, config = CALM_ZONE_CONFIG }) {
  const zones = [];
  const controlled = new Map();
  const counts = new Map();
  let announced = false;

  function publish() {
    state.calmZones = zones;
    state.calm = api;
  }

  function update(dt) {
    if (state.gameState !== 'play') { publish(); return; }
    const pairs = findCalmPairs(inoculants?.colonies || [], config);
    const seen = new Set();
    for (const pair of pairs) {
      let zone = zones.find(item => item.key === pair.key);
      if (!zone) {
        zone = { ...pair, intensity: 0, active: true };
        zones.push(zone);
      }
      Object.assign(zone, pair, { active: true });
      seen.add(zone);
    }
    for (const zone of zones) {
      if (!seen.has(zone)) zone.active = false;
      zone.intensity = zone.active
        ? clamp(zone.intensity + dt / config.rampIn, 0, 1)
        : clamp(zone.intensity - dt / config.rampOut, 0, 1);
    }
    for (let i = zones.length - 1; i >= 0; i--) {
      if (!zones[i].active && zones[i].intensity <= 0) zones.splice(i, 1);
    }
    if (!announced && zones.some(zone => zone.intensity >= .6)) {
      announced = true;
      narrate(state, 'calm.first');
    }
    publish();
  }

  // Nivel da calmaria no ponto, ja suavizado no objeto (o patogeno nao "pisca"
  // ao cruzar a borda) e com o marco de controle: calmo por controlHoldSeconds
  // conta uma vez por objeto e por tipo.
  function settle(entity, type, x, y, dt) {
    const target = calmLevelAt(zones, x, y, config);
    const current = entity.calm || 0;
    const step = dt / config.entitySettle;
    entity.calm = target > current ? Math.min(target, current + step) : Math.max(target, current - step);
    if (entity.calm < .002) entity.calm = 0;
    if (entity.calm >= config.controlThreshold) {
      entity.calmHold = (entity.calmHold || 0) + dt;
      if (entity.calmHold >= config.controlHoldSeconds && !controlled.has(entity)) {
        controlled.set(entity, type);
        counts.set(type, (counts.get(type) || 0) + 1);
      }
    } else {
      entity.calmHold = 0;
    }
    return entity.calm;
  }

  function reset() {
    zones.length = 0;
    controlled.clear();
    counts.clear();
    announced = false;
    publish();
  }

  const api = {
    update,
    reset,
    clear: reset,
    settle,
    at: (x, y) => calmLevelAt(zones, x, y, config),
    calmedCount: type => counts.get(type) || 0,
    get zones() { return zones; },
    get activeCount() { return zones.filter(zone => zone.intensity > 0).length; },
    config,
  };
  publish();
  return api;
}

// Leitura segura para os modulos de patogeno: sem calmaria instalada, 0.
export function settleCalm(state, entity, type, x, y, dt) {
  if (!state?.calm || !entity) return 0;
  return state.calm.settle(entity, type, x, y, dt);
}
