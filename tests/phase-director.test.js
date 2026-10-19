import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, decorateCampaignLevel, prepareCampaignGeneration } from '../src/procgen/campaign-progression.js';
import { auditTraversableRoute, generateLevel } from '../src/procgen/generator.js';
import { ROUTE_GATE_KINDS } from '../src/procgen/phase-vertical-plan.js';
import { installLowTunnels } from '../src/procgen/low-tunnels.js';

const SEEDS = Array.from({ length: 12 }, (_, k) => `diretor-${k + 1}:fase-10`);

function phaseTen(seed) {
  const campaign = createCampaign(seed.split(':')[0]);
  campaign.phase = 10;
  for (const f of Object.keys(campaign.unlocks)) campaign.unlocks[f] = true;
  const profile = prepareCampaignGeneration(campaign);
  const level = decorateCampaignLevel(generateLevel(seed, {
    referenceScreenWorldWidth: 1280,
    referenceScreenWorldHeight: 720,
    director: { gateKinds: ROUTE_GATE_KINDS, abilities: { dash: true, phosphateSolubilization: true } },
  }), campaign, profile);
  installLowTunnels(level, { phase: 10, seedValue: seed, abilities: campaign.unlocks });
  return { level, campaign };
}

const route = level => level.platforms
  .filter(p => p.logicIndex >= 0 && !p.recovery && !p.optionalTraversal)
  .sort((a, b) => a.x - b.x);

test('diretor: receita variada, todas as salas construidas', () => {
  const signatures = new Set();
  const kinds = new Set();
  for (const seed of SEEDS) {
    const { level } = phaseTen(seed);
    const recipe = level.directorRecipe;
    assert.ok(recipe && recipe.rooms.length >= 5, `${seed}: poucas salas`);
    assert.deepEqual(recipe.skipped, [], `${seed}: salas puladas`);
    recipe.rooms.forEach((room, k) => {
      kinds.add(room.kind);
      if (k) assert.notEqual(room.kind, recipe.rooms[k - 1].kind, `${seed}: sala repetida em seguida`);
    });
    signatures.add(recipe.signature);
  }
  assert.equal(signatures.size, SEEDS.length, 'cada semente tem a sua receita');
  for (const kind of ['ascent', 'drop', 'nitrogenGate', 'dashTunnel', 'phosphateTunnel', 'bridge']) {
    assert.ok(kinds.has(kind), `sala ${kind} nunca apareceu`);
  }
});

test('diretor: desnivel concentrado, sem rampa lenta de muitos blocos', () => {
  for (const seed of SEEDS) {
    const ys = route(phaseTen(seed).level).map(p => p.y);
    let run = 0, best = 0, dir = 0;
    for (let i = 1; i < ys.length; i++) {
      const d = ys[i] - ys[i - 1];
      const s = Math.abs(d) >= 15 && Math.abs(d) <= 95 ? Math.sign(d) : 0;
      if (s && s === dir) run++; else { run = s ? 1 : 0; dir = s; }
      best = Math.max(best, run);
    }
    assert.ok(best <= 4, `${seed}: ${best} passos pequenos seguidos na mesma direcao`);
  }
});

test('diretor: queda e tuneis atravessaveis; tunel de fosfato com Bacillus antes', () => {
  for (const seed of SEEDS) {
    const { level, campaign } = phaseTen(seed);
    const audit = auditTraversableRoute(level, campaign.unlocks);
    const byIndex = new Map(route(level).map(p => [p.logicIndex, p]));
    // escada de Azospirillum so nasce no app; aqui ela ainda nao existe
    const failures = audit.ordinaryFailures.filter(f => !byIndex.get(f.nextLogicIndex)?.ascentGate);
    assert.deepEqual(failures, [], `${seed}: travessia impossivel`);
    const rooms = level.directorRecipe.rooms.filter(r => /Tunnel$/.test(r.kind));
    assert.deepEqual(level.tunnelRoomFailures, [], `${seed}: tunel nao instalado`);
    assert.equal(level.ceilingDrops.length, rooms.length, `${seed}: um tunel por sala`);
    for (const drop of level.ceilingDrops.filter(d => d.phosphate)) {
      const colony = (level.authoredBeneficialColonies || []).find(c => c.id === `${drop.id}-bacillus`);
      assert.ok(colony && colony.x < drop.crystal.x, `${seed}: Bacillus antes do cristal`);
    }
  }
});
