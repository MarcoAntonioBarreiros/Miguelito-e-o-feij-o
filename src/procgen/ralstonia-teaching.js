import { createRandom } from './random.js';
import { getPrimaryTraversalPlatforms } from './traversal-route.js';
import { resolveEntityPlatform } from './route-geometry.js';

const SOURCE = 'ralstonia-teaching';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function structuralPlatform(platform, minimumWidth = 120) {
  return platform && !platform.final && !platform.recovery && !platform.safetyStep
    && !platform.temporary && !platform.mycorrhizaStructure
    && !platform.azospirillumStructure && !platform.azospirillumLadderStep
    && !platform.nitrogenRootCollider && !platform.nitrogenRootStructure
    && !platform.signatureChallenge
    && platform.routeScope !== 'optional'
    && Number.isInteger(platform.logicIndex)
    && Number.isFinite(platform.x) && Number.isFinite(platform.y)
    && platform.w >= minimumWidth;
}

function center(platform) {
  return { x: platform.x + platform.w / 2, y: platform.y - 7 };
}

function distance(left, right) {
  const a = center(left), b = center(right);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function precedingHosts(route, root) {
  return route.filter(platform => structuralPlatform(platform, 90)
    && platform.logicIndex < root.logicIndex)
    .sort((a, b) => b.logicIndex - a.logicIndex || distance(a, root) - distance(b, root));
}

function selectRoot(route, segment, random, reserved, previous) {
  if (!segment) return null;
  const candidates = route.filter(platform => structuralPlatform(platform)
    && !reserved.has(platform)
    && platform.logicIndex >= segment.from && platform.logicIndex <= segment.to
    && precedingHosts(route, platform).length > 0);
  if (candidates.includes(previous)) return previous;
  const roots = candidates.filter(platform => platform.type === 'root');
  const pool = roots.length ? roots : candidates.filter(platform => platform.type === 'soil');
  if (!pool.length) return null;
  const root = pool[Math.floor(random() * pool.length)];
  if (root.type === 'soil') {
    root.type = 'root';
    root.ralstoniaPromotedRoot = true;
  }
  return root;
}

function resourceHost(route, root) {
  const hosts = precedingHosts(route, root);
  return hosts.find(platform => distance(platform, root) <= 900) || hosts[0] || null;
}

function usableEncounter(level, routeSet, root, organism) {
  return (level.microbeEncounters || []).find(encounter => {
    if ((encounter.id || encounter.type) !== organism) return false;
    const host = resolveEntityPlatform(level, encounter);
    return routeSet.has(host) && structuralPlatform(host, 90)
      && host.logicIndex < root.logicIndex
      && distance(host, root) <= 900
      && encounter.x >= host.x + 12 && encounter.x <= host.x + host.w - 12
      && encounter.y >= host.y - 170 && encounter.y <= host.y - 20;
  }) || null;
}

function ensureEncounter(level, route, root, role, organism, host) {
  const existing = usableEncounter(level, new Set(route), root, organism);
  if (existing) return existing;
  if (!host) return null;
  const encounter = {
    id: organism,
    platform: host,
    platformId: host.id ?? host.platformId ?? null,
    logicIndex: host.logicIndex,
    x: host.x + host.w * (organism === 'pseudomonas' ? .6 : .4),
    y: host.y - 78,
    r: 155,
    territory: 360,
    collect: false,
    source: SOURCE,
    teachingRole: role,
    requiresSeenCardId: null,
  };
  level.microbeEncounters.push(encounter);
  return encounter;
}

function accessibleExudates(level, routeSet, root, hosts) {
  return (level.exudates || []).filter(item => {
    const host = resolveEntityPlatform(level, item);
    return routeSet.has(host) && hosts.has(host)
      && host.logicIndex < root.logicIndex
      && item.x >= host.x + 18 && item.x <= host.x + host.w - 18
      && item.y >= host.y - 55 && item.y <= host.y - 20;
  });
}

function ensureExudates(level, route, root, role, encounters, minimum, fallbackHost) {
  const hosts = new Set(encounters.filter(Boolean)
    .map(encounter => resolveEntityPlatform(level, encounter)).filter(Boolean));
  if (fallbackHost) hosts.add(fallbackHost);
  const items = accessibleExudates(level, new Set(route), root, hosts);
  if (!fallbackHost) return items;
  for (let index = items.length; index < minimum; index++) {
    const lateral = minimum === 1 ? .5 : .25 + index * .25;
    const offsetX = clamp(fallbackHost.w * lateral, 24, fallbackHost.w - 24);
    const item = {
      id: `p9-${role}-exudate-${index}`,
      platform: fallbackHost,
      platformId: fallbackHost.id ?? fallbackHost.platformId ?? null,
      logicIndex: fallbackHost.logicIndex,
      x: fallbackHost.x + offsetX,
      y: fallbackHost.y - 34,
      taken: false,
      authored: true,
      source: SOURCE,
      teachingRole: role,
    };
    level.exudates.push(item);
    items.push(item);
  }
  return items;
}

function ensureIron(level, route, root, random) {
  const own = (level.ironDeposits || []).find(item => item.id === 'p9-containment-iron');
  if (own) return own;
  const point = center(root), routeSet = new Set(route);
  const existing = (level.ironDeposits || []).find(item => {
    const host = resolveEntityPlatform(level, item);
    return routeSet.has(host) && (item.stock || 0) > .08
      && Math.hypot(item.x - point.x, item.y - point.y) <= 350
      && Math.max(
        Math.hypot(item.x - root.x - 18, item.y - point.y),
        Math.hypot(item.x - root.x - root.w + 18, item.y - point.y),
      ) <= 400;
  });
  if (existing) {
    // resetBiology conserva somente depósitos autorais. Reutilizar um depósito
    // procedural sem esta marca faria o recurso desaparecer antes do jogo.
    existing.authored = true;
    return existing;
  }
  const deposit = {
    id: 'p9-containment-iron',
    platform: root,
    platformId: root.id ?? root.platformId ?? null,
    logicIndex: root.logicIndex,
    x: root.x + root.w * .5,
    y: root.y + Math.min(24, Math.max(12, root.h * .45)),
    stock: 7,
    maxStock: 7,
    radius: 13,
    phase: random() * Math.PI * 2,
    exposed: true,
    authored: true,
    source: SOURCE,
  };
  level.ironDeposits.push(deposit);
  return deposit;
}

// Reserva os dois encontros na geometria já pronta. Não cria infecção, não
// move colisores e não consome o RNG do gerador. O runtime decide ativação e
// progressão; este módulo garante a rota e os recursos antes de resetEcology.
export function prepareRalstoniaTeachingEncounters(level, { phaseManifest, seed } = {}) {
  if (!level || phaseManifest?.phase !== 9 || phaseManifest?.ralstonia?.enabled !== true) return level;
  const random = createRandom(`${seed ?? level.seed ?? 'phase-9'}:ralstonia-teaching`);
  const route = getPrimaryTraversalPlatforms(level);
  const previous = level.ralstoniaTeachingEncounters;
  const reserved = new Set();
  const plan = {};
  level.microbeEncounters ||= [];
  level.exudates ||= [];
  level.ironDeposits ||= [];
  for (const [role, segmentId] of [['prevention', 'p9-surface-intro'], ['containment', 'p9-vascular-intro']]) {
    const segment = (phaseManifest.segments || []).find(entry => entry.id === segmentId);
    const root = selectRoot(route, segment, random, reserved, previous?.[role]?.root);
    if (!root) continue;
    reserved.add(root);
    const host = resourceHost(route, root);
    const organisms = role === 'prevention' ? ['bacillus'] : ['bacillus', 'pseudomonas'];
    const encounters = organisms.map(organism => ensureEncounter(level, route, root, role, organism, host));
    const exudates = ensureExudates(level, route, root, role, encounters, role === 'prevention' ? 1 : 3, host);
    const iron = role === 'containment' ? ensureIron(level, route, root, random) : null;
    plan[role] = { root, role, segmentId, resources: { encounters, exudates, iron } };
  }
  level.ralstoniaTeachingEncounters = plan;
  return level;
}
