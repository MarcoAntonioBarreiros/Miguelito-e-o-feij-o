import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareRalstoniaTeachingEncounters } from '../src/procgen/ralstonia-teaching.js';
import { getPhaseManifest, getPersistentUnlocksBeforePhase } from '../src/procgen/campaign-manifest.js';
import { createCampaign, prepareCampaignGeneration, campaignPhaseSeed, decorateCampaignLevel } from '../src/procgen/campaign-progression.js';
import { generateLevel } from '../src/procgen/generator.js';
import { generateCampaignEncounters } from '../src/procgen/campaign-encounters.js';
import { applySignatureChallenge } from '../src/procgen/signature-challenge.js';
import { getPrimaryTraversalPlatforms } from '../src/procgen/traversal-route.js';
import { resolveEntityPlatform, createRouteAnchorRegistry } from '../src/procgen/route-geometry.js';
import { createPseudomonasSiderophores } from '../src/procgen/pseudomonas-siderophores.js';
import { restoreExudatesAhead } from '../src/procgen/simulator.js';

const phaseManifest = getPhaseManifest(9);
function levelFixture() {
  return {
    seed: 'teaching-fixture',
    platforms: Array.from({ length: 22 }, (_, logicIndex) => ({
      id: `root-${logicIndex}`, type: 'root', logicIndex,
      x: logicIndex * 300, y: 480 - Math.sin(logicIndex) * 30, w: 220, h: 60,
      routeRole: 'primary', routeScope: 'primary',
    })),
    microbeEncounters: [], exudates: [], ironDeposits: [],
  };
}

function geometry(level) {
  return level.platforms.map(({ x, y, w, h, logicIndex }) => ({ x, y, w, h, logicIndex }));
}

function verifyPlan(level) {
  const plan = level.ralstoniaTeachingEncounters;
  assert.ok(plan?.prevention?.root, 'there is a prevention host');
  assert.ok(plan?.containment?.root, 'there is a containment host');
  assert.notEqual(plan.prevention.root, plan.containment.root);
  const route = new Set(getPrimaryTraversalPlatforms(level));
  for (const role of ['prevention', 'containment']) {
    const entry = plan[role], root = entry.root;
    const window = phaseManifest.segments.find(segment => segment.id === entry.segmentId);
    assert.ok(route.has(root), `${role}: primary route`);
    assert.ok(root.logicIndex >= window.from && root.logicIndex <= window.to, `${role}: inside teaching segment`);
    assert.equal(root.type, 'root');
    const organisms = new Set(entry.resources.encounters.map(item => item?.id));
    assert.ok(organisms.has('bacillus'));
    if (role === 'containment') assert.ok(organisms.has('pseudomonas'));
    for (const encounter of entry.resources.encounters) {
      const host = resolveEntityPlatform(level, encounter);
      assert.ok(route.has(host));
      assert.ok(host.logicIndex < root.logicIndex, 'organism appears before disease scenario');
      assert.ok(Math.hypot(host.x + host.w / 2 - root.x - root.w / 2, host.y - root.y) <= 900,
        'organism is local, not just somewhere in an earlier chunk');
    }
    assert.ok(entry.resources.exudates.length >= (role === 'prevention' ? 1 : 3));
    for (const item of entry.resources.exudates) {
      const host = resolveEntityPlatform(level, item);
      assert.ok(route.has(host));
      assert.ok(item.x >= host.x + 18 && item.x <= host.x + host.w - 18, 'pickup is over solid support');
      assert.ok(item.y >= host.y - 55 && item.y <= host.y - 20, 'pickup is reachable while on support');
      assert.ok(host.logicIndex < root.logicIndex);
    }
  }
  const containment = plan.containment;
  const iron = containment.resources.iron;
  assert.ok(iron.authored, 'survives resetBiology/reset siderophores');
  assert.ok(iron.stock > .08);
  assert.ok(Math.hypot(iron.x - containment.root.x - containment.root.w / 2,
    iron.y - containment.root.y + 7) <= 350, 'iron lies inside real initial siderophore range');
}

test('scope: other phases and disabled Ralstonia receive no teaching entities', () => {
  for (const manifest of [getPhaseManifest(8), getPhaseManifest(10), { ...phaseManifest, ralstonia: { enabled: false } }]) {
    const level = levelFixture(), before = JSON.stringify(level);
    assert.equal(prepareRalstoniaTeachingEncounters(level, { phaseManifest: manifest }), level);
    assert.equal(JSON.stringify(level), before);
  }
});

test('reserves distinct primary roots and usable resources without moving geometry', () => {
  const level = levelFixture(), before = geometry(level);
  prepareRalstoniaTeachingEncounters(level, { phaseManifest, seed: 'local-resource' });
  verifyPlan(level);
  assert.deepEqual(geometry(level), before);
});

test('promotes ordinary primary soil only when a segment has no root', () => {
  const level = levelFixture();
  for (const platform of level.platforms) platform.type = 'soil';
  const before = geometry(level);
  const optional = { ...level.platforms[5], id: 'optional-root', type: 'root', optionalDetourId: 'detour', routeRole: 'optional', routeScope: 'optional' };
  level.platforms.push(optional);
  prepareRalstoniaTeachingEncounters(level, { phaseManifest, seed: 'soil' });
  verifyPlan(level);
  assert.equal(optional.ralstoniaPromotedRoot, undefined);
  assert.deepEqual(geometry({ platforms: level.platforms.slice(0, -1) }), before);
  assert.equal(level.platforms.filter(platform => platform.ralstoniaPromotedRoot).length, 2);
});

test('same seed is deterministic and does not call global Math.random', () => {
  const a = levelFixture(), b = levelFixture();
  const original = Math.random;
  Math.random = () => { throw new Error('global randomness used'); };
  try {
    prepareRalstoniaTeachingEncounters(a, { phaseManifest, seed: 'same' });
    prepareRalstoniaTeachingEncounters(b, { phaseManifest, seed: 'same' });
  } finally { Math.random = original; }
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('initialization is idempotent and does not replenish collected items', () => {
  const level = levelFixture();
  prepareRalstoniaTeachingEncounters(level, { phaseManifest, seed: 'again' });
  const plan = level.ralstoniaTeachingEncounters;
  const sizes = [level.microbeEncounters.length, level.exudates.length, level.ironDeposits.length];
  for (const item of level.exudates) item.taken = true;
  const oldStock = plan.containment.resources.iron.stock = .03;
  prepareRalstoniaTeachingEncounters(level, { phaseManifest, seed: 'again' });
  assert.deepEqual([level.microbeEncounters.length, level.exudates.length, level.ironDeposits.length], sizes);
  assert.equal(level.ralstoniaTeachingEncounters.prevention.root, plan.prevention.root);
  assert.equal(level.ralstoniaTeachingEncounters.containment.root, plan.containment.root);
  assert.ok(level.exudates.every(item => item.taken));
  assert.equal(level.ralstoniaTeachingEncounters.containment.resources.iron.stock, oldStock);
});

test('reuses reachable route resources, excluding optional-route and distant lookalikes', () => {
  const level = levelFixture();
  prepareRalstoniaTeachingEncounters(level, { phaseManifest, seed: 'reuse' });
  const sizes = [level.microbeEncounters.length, level.exudates.length, level.ironDeposits.length];
  // Entries need not originate from this helper to be reused.
  for (const item of level.microbeEncounters) item.source = 'procedural';
  for (const item of level.exudates) item.source = 'procedural';
  for (const item of level.ironDeposits) { item.id = 'existing-iron'; item.authored = false; }
  prepareRalstoniaTeachingEncounters(level, { phaseManifest, seed: 'reuse' });
  assert.deepEqual([level.microbeEncounters.length, level.exudates.length, level.ironDeposits.length], sizes);
  assert.equal(level.ironDeposits[0].authored, true);
  verifyPlan(level);
});

test('an early organism on another route or far away does not satisfy resource access', () => {
  const level = levelFixture();
  const optional = { ...level.platforms[7], id: 'optional-resource', optionalDetourId: 'side', routeRole: 'optional', routeScope: 'optional' };
  level.platforms.push(optional);
  level.microbeEncounters.push(
    { id: 'bacillus', platform: optional, logicIndex: 7, x: optional.x + 80, y: optional.y - 78 },
    { id: 'pseudomonas', platform: level.platforms[0], logicIndex: 0, x: 80, y: level.platforms[0].y - 78 },
  );
  prepareRalstoniaTeachingEncounters(level, { phaseManifest, seed: 'unusable-lookalikes' });
  verifyPlan(level);
  assert.ok(level.ralstoniaTeachingEncounters.containment.resources.encounters.every(item => item.source === 'ralstonia-teaching'));
});

test('authored iron survives real siderophore reset; exudates use ordinary respawn semantics', () => {
  const level = levelFixture();
  prepareRalstoniaTeachingEncounters(level, { phaseManifest, seed: 'reset' });
  const state = { level, campaign: { phase: 9, seed: 'reset' } };
  const siderophores = createPseudomonasSiderophores({ state, entities: {}, ecology: { agents: [] }, inoculants: { colonies: [] } });
  const iron = level.ralstoniaTeachingEncounters.containment.resources.iron;
  siderophores.reset();
  assert.ok(level.ironDeposits.includes(iron));
  for (const item of level.exudates) item.taken = true;
  assert.equal(restoreExudatesAhead(level, 0), level.exudates.length);
  assert.ok(level.exudates.every(item => !item.taken && !item.renewable));
});

test('resource anchors follow later route synchronization', () => {
  const level = levelFixture();
  prepareRalstoniaTeachingEncounters(level, { phaseManifest, seed: 'anchor' });
  const registry = createRouteAnchorRegistry(level);
  registry.capture();
  const iron = level.ralstoniaTeachingEncounters.containment.resources.iron;
  const host = iron.platform, offsetX = iron.x - host.x, offsetY = iron.y - host.y;
  host.x += 43; host.y -= 27;
  registry.synchronize();
  assert.equal(iron.x - host.x, offsetX);
  assert.equal(iron.y - host.y, offsetY);
});

test('100 generated phase-nine seeds retain geometry and contain local, reachable teaching resources', { timeout: 180000 }, () => {
  for (let index = 0; index < 100; index++) {
    const campaign = createCampaign(`teaching-p9-${index}`, { storage: null });
    campaign.phase = 9;
    Object.assign(campaign.unlocks, getPersistentUnlocksBeforePhase(9));
    const profile = prepareCampaignGeneration(campaign), seed = campaignPhaseSeed(campaign);
    const level = decorateCampaignLevel(generateLevel(seed), campaign, profile);
    applySignatureChallenge(level, campaign.phase);
    level.microbeEncounters = generateCampaignEncounters({ platforms: level.platforms, phase: 9, seedValue: seed });
    const before = geometry(level);
    prepareRalstoniaTeachingEncounters(level, { phaseManifest, seed });
    try { verifyPlan(level); }
    catch (error) { throw new Error(`seed ${index}: ${error.message}`, { cause: error }); }
    assert.deepEqual(geometry(level), before, `seed ${index}: colliders do not move`);
  }
});
