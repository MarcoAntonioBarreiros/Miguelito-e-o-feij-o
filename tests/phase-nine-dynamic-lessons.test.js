import assert from 'node:assert/strict';
import test from 'node:test';
import { getPhaseManifest } from '../src/procgen/campaign-manifest.js';
import { createCampaignObjectiveEvaluator } from '../src/procgen/campaign-objectives.js';
import { createPathogenArrival } from '../src/procgen/pathogen-arrival.js';
import { createPseudomonasSiderophores } from '../src/procgen/pseudomonas-siderophores.js';
import { prepareRalstoniaTeachingEncounters } from '../src/procgen/ralstonia-teaching.js';
import { createRalstoniaVascularWilt } from '../src/procgen/ralstonia-vascular-wilt.js';

const DT = 1 / 60;
const manifest = getPhaseManifest(9);

function bench({ seed = 'p9-dynamic-lessons', arrivalSettings = null } = {}) {
  // Simple primary route: positions are fixtures, while the teaching plan,
  // resource placement, arrival director, disease and iron recovery are real.
  const roots = Array.from({ length: 24 }, (_, logicIndex) => ({
    id: `root-${logicIndex}`, type: 'root', logicIndex,
    x: logicIndex * 300, y: 500, w: 220, h: 60,
    rootHealth: .8, rootGameplayDamage: .2,
    routeRole: 'primary', routeScope: 'primary',
  }));
  const level = {
    seed, campaignPhase: 9, dynamicPathogenArrival: true, platforms: roots,
    microbeEncounters: [], exudates: [], ironDeposits: [],
    biofilms: [], azospirillumRoots: [], agents: [], allies: [],
    exudateClouds: [], pathogenPressure: { totalPressure: 0, pressureBand: 'safe' },
    goal: { completed: false }, objectiveProgress: { attemptId: 1 },
  };
  prepareRalstoniaTeachingEncounters(level, { phaseManifest: manifest, seed });
  const state = {
    time: 0, gameState: 'play', tutorialOpen: false, cameraX: 0, cameraY: 0,
    visibleWorldWidth: 1280, visibleWorldHeight: 720,
    campaign: { phase: 9, seed, unlocks: {} }, level,
    player: { x: 10, y: 440, w: 26, h: 34, soil: 20, hope: 20 },
    discoveredMicrobes: new Set(),
  };
  const entities = { burst() {}, damagePlayer() {} };
  const ecology = { agents: [] };
  const inoculants = { colonies: [] };
  const pseudomonas = createPseudomonasSiderophores({ state, entities, ecology, inoculants });
  pseudomonas.reset();
  const control = createRalstoniaVascularWilt({ state, entities, inoculants, pseudomonas });
  control.initialize();
  const arrival = createPathogenArrival({ state, systems: { ralstoniaControl: control }, settings: arrivalSettings });
  arrival.reset();
  const evaluator = createCampaignObjectiveEvaluator({ state, systems: { ralstonia: control } });
  const plan = level.ralstoniaTeachingEncounters;
  const step = seconds => {
    for (let frame = 0; frame < Math.round(seconds / DT); frame++) {
      state.time += DT;
      pseudomonas.update(DT);
      control.update(DT);
      arrival.update(DT);
    }
  };
  const goTo = root => {
    state.player.x = root.x + root.w / 2 - state.player.w / 2;
    state.player.y = root.y - state.player.h;
  };
  const protect = (root, withPseudomonas = false) => {
    // Established biofilm is an explicit fixture: recruitment, inoculation and
    // maturation are outside this director/progression contract. Its strength
    // is consumed by the unchanged real Ralstonia control equations.
    level.biofilms.push({
      functional: true, platform: root, x: root.x + root.w / 2,
      y: root.y, radius: 240, protectionStrength: 1,
    });
    if (withPseudomonas) {
      assert.equal(root, plan.containment.root);
      assert.ok(plan.containment.resources.iron.stock > 0, 'teaching iron is available');
      // Colony is also an established fixture. Iron reserve is NOT assigned:
      // real siderophores collect the deposit placed by the teaching planner.
      inoculants.colonies.push({
        id: `pseudo-${root.id}`, type: 'pseudomonas', platform: root,
        x: root.x + root.w / 2, y: root.y - 8,
        vigor: 1, growth: 1, dormant: false, sourceCount: 3,
      });
    }
  };
  const source = () => control.foci.find(focus => focus.role === 'containment');
  const prevention = () => control.foci.find(focus => focus.role === 'prevention');
  const result = key => evaluator.evaluate(manifest.finalTest).results.find(entry => entry.condition.key === key);
  return { roots, state, level, plan, control, arrival, pseudomonas, step, goTo, protect, source, prevention, result };
}

function preventFirstArrival(b) {
  b.protect(b.plan.prevention.root);
  b.goTo(b.plan.prevention.root);
  b.step(40);
  assert.equal(b.arrival.tutorialArrivalCompleted, true);
  assert.equal(b.control.preventedCount, 1);
  assert.equal(b.prevention().neutralized, true);
}

test('planejamento + inicializacao dinamica reserva duas licoes mas so cria a infeccao vascular pendente', () => {
  const b = bench();
  assert.ok(b.plan.prevention.root);
  assert.ok(b.plan.containment.root);
  assert.notEqual(b.plan.prevention.root, b.plan.containment.root);
  assert.ok(b.plan.prevention.resources.encounters.some(encounter => encounter.id === 'bacillus'));
  assert.ok(b.plan.prevention.resources.exudates.length >= 1);
  assert.ok(b.plan.containment.resources.encounters.some(encounter => encounter.id === 'pseudomonas'));
  assert.ok(b.plan.containment.resources.exudates.length >= 3);
  assert.ok(b.plan.containment.resources.iron.stock > 0);
  assert.equal(b.control.foci.length, 1);
  assert.equal(b.prevention(), undefined, 'a chegada superficial ainda nao ocorreu');
  assert.equal(b.source().root, b.plan.containment.root);
  assert.equal(b.source().activationState, 'pending');
  assert.equal(b.source().vascularLoad, manifest.ralstonia.containmentFocusVascularLoad);
  assert.equal(b.source().everEnteredVascular, true);
  assert.equal(b.control.preventedCount, 0);
  assert.equal(b.control.containedCount, 0);
});

test('a primeira chegada ambiental aponta a raiz de prevencao e comeca em V zero', () => {
  const b = bench();
  b.goTo(b.plan.prevention.root);
  b.step(DT);
  assert.equal(b.arrival.warning?.targetRoot, b.plan.prevention.root);
  assert.equal(b.arrival.warning?.tutorial, true);
  b.step(b.arrival.settings.warningSeconds + DT);
  const focus = b.prevention();
  assert.ok(focus);
  assert.equal(focus.root, b.plan.prevention.root);
  assert.equal(focus.vascularLoad, 0);
  assert.equal(focus.everEnteredVascular, false);
  assert.equal(b.control.foci.length, 2);
  assert.equal(b.source().activationState, 'pending');
  assert.equal(b.source().vascularLoad, manifest.ralstonia.containmentFocusVascularLoad);
});

test('proteger antes da entrada conquista prevencao e deixa a licao vascular independente e concluivel', () => {
  const b = bench();
  preventFirstArrival(b);
  assert.equal(b.control.containedCount, 0, 'prevencao nao falsifica contencao');
  assert.equal(b.source().activationState, 'pending');
  assert.equal(b.source().vascularLoad, manifest.ralstonia.containmentFocusVascularLoad);
  b.protect(b.plan.containment.root, true);
  b.goTo(b.plan.containment.root);
  b.step(28);
  assert.equal(b.source().contained, true);
  assert.equal(b.source().neutralized, false, 'xilema infectado continua com carga residual');
  assert.equal(b.control.preventedCount, 1);
  assert.equal(b.control.containedCount, 1);
  assert.equal(b.result('preventedRalstoniaEntryCount').passed, true);
  assert.equal(b.result('containedVascularRalstoniaCount').passed, true);
  assert.ok(b.pseudomonas.ironRecovered > 0, 'o recurso garantido foi coletado pelo sistema real');
});

test('conter primeiro nao bloqueia a primeira oportunidade de prevencao', () => {
  // A longer configurable transit makes the order deterministic: containment
  // completes while the first environmental inoculum is still travelling.
  const b = bench({ arrivalSettings: { warningSeconds: 30 } });
  b.protect(b.plan.containment.root, true);
  b.goTo(b.plan.containment.root);
  b.step(16);
  assert.equal(b.source().contained, true);
  assert.equal(b.control.containedCount, 1);
  assert.equal(b.control.preventedCount, 0);
  assert.equal(b.arrival.tutorialArrivalCompleted, false);
  assert.equal(b.arrival.warning?.targetRoot, b.plan.prevention.root);
  b.protect(b.plan.prevention.root);
  b.step(40);
  assert.equal(b.arrival.tutorialArrivalCompleted, true);
  assert.equal(b.prevention().neutralized, true);
  assert.equal(b.control.preventedCount, 1);
  assert.equal(b.control.containedCount, 1);
});

test('entrar na licao de disseminacao nao arma foco de baixa carga nem obriga foco contido a propagar', () => {
  const b = bench();
  b.protect(b.plan.prevention.root);
  b.goTo(b.plan.containment.root);
  b.step(9);
  assert.equal(b.source().activationState, 'active');
  assert.equal(b.source().contained, false);
  assert.ok(b.source().vascularLoad < manifest.ralstonia.spreadTriggerThreshold);
  b.goTo(b.roots[16]);
  b.step(3);
  assert.equal(b.source().pedagogicalSpread, false);
  assert.equal(b.control.spreadEventCount, 0);
  b.protect(b.plan.containment.root, true);
  b.step(25);
  assert.equal(b.source().contained, true);
  b.step(20);
  assert.equal(b.source().pedagogicalSpread, false);
  assert.equal(b.control.spreadEventCount, 0);
  assert.equal(b.control.pedagogicalSpreadAttempts, 0);
});

test('conter a ameaca vascular libera o teto para uma nova chegada ambiental', () => {
  const b = bench();
  preventFirstArrival(b);
  b.goTo(b.plan.containment.root);
  b.step(9);
  assert.equal(b.source().contained, false);
  assert.ok(!b.arrival.eligiblePathogens().includes('ralstonia'), 'ameaca ativa ocupa o teto');
  b.protect(b.plan.containment.root, true);
  b.step(25);
  assert.equal(b.source().contained, true);
  assert.ok(b.arrival.eligiblePathogens().includes('ralstonia'), 'contencao atual libera a chegada');
  const before = b.arrival.arrivalsByPathogen.ralstonia;
  b.goTo(b.roots[22]);
  b.arrival.configure({
    safeMeanIntervalSeconds: 2, moderateMeanIntervalSeconds: 2,
    highMeanIntervalSeconds: 2, criticalMeanIntervalSeconds: 2,
    minimumCooldownSeconds: 1,
  });
  b.step(12);
  assert.ok(b.arrival.arrivalsByPathogen.ralstonia > before, 'o relogio real fez uma segunda chegada');
  assert.ok(b.control.foci.some(focus => focus.role === 'environmental' && focus.root.logicIndex >= 20));
  assert.equal(b.control.containedCount, 1);
});

test('a licao distante nao ocupa o teto, mas um inoculo ambiental pendente ocupa', () => {
  const b = bench();
  assert.equal(b.source().activationState, 'pending');
  assert.ok(b.arrival.eligiblePathogens().includes('ralstonia'));
  const focus = b.control.introduceEnvironmentalInoculum({ targetRoot: b.roots[23] });
  assert.equal(focus.activationState, 'pending');
  assert.ok(!b.arrival.eligiblePathogens().includes('ralstonia'));
});

test('passar muito acima do encontro vascular nao inicia sua janela de tratamento', () => {
  const b = bench();
  b.goTo(b.plan.containment.root);
  b.state.player.y -= 700;
  b.step(10);
  assert.equal(b.source().activationState, 'pending');
  assert.equal(b.source().vascularLoad, manifest.ralstonia.containmentFocusVascularLoad);
  b.goTo(b.plan.containment.root);
  b.step(DT);
  assert.equal(b.source().activationState, 'warning');
  assert.ok(b.source().activationGraceRemaining > 7);
});
