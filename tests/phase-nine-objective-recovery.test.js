import assert from 'node:assert/strict';
import test from 'node:test';
import { createCampaignObjectiveEvaluator } from '../src/procgen/campaign-objectives.js';
import { FINAL_TEST_KEYS, getPhaseManifest } from '../src/procgen/campaign-manifest.js';
import { createGoalSystem } from '../src/procgen/goal-system.js';
import { createRalstoniaVascularWilt } from '../src/procgen/ralstonia-vascular-wilt.js';

const REQUIREMENTS = getPhaseManifest(9).finalTest.requires;
const LIVE_SPREAD_KEY = 'unresolvedRalstoniaSpreadCount';
const DT = 1 / 60;

function bench() {
  const roots = [3, 10, 11, 16].map(logicIndex => ({
    id: `root-${logicIndex}`, type: 'root', logicIndex,
    x: logicIndex * 420, y: 500, w: 220, h: 60,
    rootHealth: .8, rootGameplayDamage: .5,
  }));
  const state = {
    time: 0, gameState: 'play', tutorialOpen: false,
    campaign: { phase: 9, seed: 'p9-objective-recovery', unlocks: {} },
    player: { x: roots[0].x, y: 440, w: 26, h: 34, soil: 20, hope: 20 },
    level: {
      dynamicPathogenArrival: true, platforms: roots, biofilms: [],
      azospirillumRoots: [], exudates: [], ironDeposits: [], allies: [], agents: [],
      goal: { completed: false },
    },
    discoveredMicrobes: new Set(),
  };
  const entities = { burst() {}, damagePlayer() {} };
  const inoculants = { colonies: [] };
  const pseudomonas = { colonyStates: new Map() };
  const system = createRalstoniaVascularWilt({ state, entities, inoculants, pseudomonas });
  system.initialize();
  const evaluator = createCampaignObjectiveEvaluator({ state, systems: { ralstonia: system } });
  const step = seconds => {
    for (let frame = 0; frame < Math.round(seconds / DT); frame++) {
      state.time += DT;
      system.update(DT);
    }
  };
  const goTo = root => {
    state.player.x = root.x + root.w / 2 - state.player.w / 2;
    state.player.y = root.y - state.player.h;
  };
  const protect = root => {
    state.level.biofilms.push({
      functional: true, platform: root, x: root.x + root.w / 2,
      y: root.y, radius: 300, protectionStrength: 1,
    });
    const colony = {
      id: `pseudo-${root.id}`, type: 'pseudomonas', platform: root,
      x: root.x + root.w / 2, y: root.y - 8, vigor: 1, dormant: false,
    };
    inoculants.colonies.push(colony);
    pseudomonas.colonyStates.set(colony.id, { colony, ironReserve: .7, activePressure: 0 });
  };
  const result = key => evaluator.evaluate(REQUIREMENTS).results.find(entry => entry.condition.key === key);
  return { state, entities, roots, system, evaluator, step, goTo, protect, result };
}

// Lab prepares an already vascular source and opens an event immediately;
// resolveNextArrival runs the product's arrival verdict and creates a real
// secondary focus. Objective counts are never assigned by this fixture.
function secondaryFocus(b) {
  const source = b.system.lab.spawnFocus({ root: b.roots[1], stage: 'vascular' });
  b.goTo(source.root);
  const event = b.system.lab.openSpreadEvent(source);
  assert.ok(event, 'fixture needs an eligible secondary root');
  b.system.lab.resolveNextArrival();
  const secondary = b.system.foci.find(focus => focus.role === 'spread');
  assert.ok(secondary);
  return { source, event, secondary };
}

test('fase 9 exige os dois marcos distintos e uma situacao final recuperavel', () => {
  assert.ok(FINAL_TEST_KEYS.worldState.includes(LIVE_SPREAD_KEY));
  assert.ok(REQUIREMENTS.some(condition => condition.key === 'preventedRalstoniaEntryCount'));
  assert.ok(REQUIREMENTS.some(condition => condition.key === 'containedVascularRalstoniaCount'));
  assert.ok(!REQUIREMENTS.some(condition => condition.key === 'succeededRalstoniaSpreadCount'));
  const spread = REQUIREMENTS.find(condition => condition.key === LIVE_SPREAD_KEY);
  assert.equal(spread.latch, false);
  assert.equal(spread.displayMode, 'final-status');
});

test('prevenir entradas ambientais nao falsifica uma contencao vascular', () => {
  const b = bench();
  for (const root of b.roots.slice(0, 3)) {
    b.goTo(root);
    b.protect(root);
    b.system.introduceEnvironmentalInoculum({ targetRoot: root });
    b.step(40);
  }
  assert.equal(b.system.preventedCount, 3);
  assert.equal(b.system.containedCount, 0);
  assert.equal(b.result('preventedRalstoniaEntryCount').passed, true);
  assert.equal(b.result('containedVascularRalstoniaCount').passed, false);
});

test('aviso e percurso bloqueiam a raiz final mesmo antes da primeira chegada secundaria', () => {
  const b = bench();
  assert.equal(b.result(LIVE_SPREAD_KEY).passed, true);
  const source = b.system.lab.spawnFocus({ root: b.roots[1], stage: 'vascular' });
  const event = b.system.lab.openSpreadEvent(source);
  assert.ok(event);
  assert.equal(b.system.successfulSpreadCount, 0);
  assert.equal(b.result(LIVE_SPREAD_KEY).actual, 1);
  assert.equal(b.result(LIVE_SPREAD_KEY).passed, false, 'o zero inicial nao pode ficar travado');
  event.state = 'traveling';
  assert.equal(b.result(LIVE_SPREAD_KEY).passed, false);
  b.protect(event.targetRoot);
  b.system.lab.resolveNextArrival();
  assert.equal(event.blocked, true);
  assert.equal(b.result(LIVE_SPREAD_KEY).passed, true);
});

test('neutralizar foco secundario recupera o objetivo e preserva o historico da chegada', () => {
  const b = bench();
  const { source, secondary } = secondaryFocus(b);
  assert.equal(b.system.successfulSpreadCount, 1);
  assert.equal(b.result(LIVE_SPREAD_KEY).passed, false);
  b.protect(source.root);
  b.protect(secondary.root);
  b.goTo(secondary.root);
  b.step(40);
  assert.equal(secondary.neutralized, true);
  assert.equal(b.result(LIVE_SPREAD_KEY).passed, true);
  assert.equal(b.system.successfulSpreadCount, 1);
  assert.equal(b.evaluator.worldValue({ key: 'succeededRalstoniaSpreadCount' }), 1);
});

test('contencao secundaria recupera objetivo, recaida e carga critica voltam a bloquear', () => {
  const b = bench();
  const { source, secondary } = secondaryFocus(b);
  // Prepare the alternative endpoint: the secondary had already entered xylem.
  b.system.lab.setFocus(secondary, { vascularLoad: .34 });
  b.protect(source.root);
  b.protect(secondary.root);
  b.goTo(secondary.root);
  b.step(30);
  assert.equal(secondary.neutralized, false, 'xilema colonizado nao e curado');
  assert.equal(secondary.contained, true);
  assert.equal(b.result(LIVE_SPREAD_KEY).passed, true);
  assert.equal(b.system.successfulSpreadCount, 1);

  b.system.lab.setFocus(secondary, { contained: false });
  assert.equal(b.result(LIVE_SPREAD_KEY).passed, false, 'everContained nao garante controle atual');
  b.system.lab.setFocus(secondary, { contained: true, vascularLoad: b.system.config.criticalThreshold + .01 });
  assert.equal(b.result(LIVE_SPREAD_KEY).passed, false, 'flag contida nao mascara carga critica');
});

test('o guard da raiz final conclui depois de recuperar disseminacao sem apagar o erro passado', () => {
  const b = bench();
  b.protect(b.roots[0]);
  b.system.introduceEnvironmentalInoculum({ targetRoot: b.roots[0] });
  b.goTo(b.roots[0]);
  b.step(40);
  const { source, secondary } = secondaryFocus(b);
  b.protect(source.root);
  // Keep the player before the pedagogical spread segment while the actual
  // containment and neutralization hold timers run.
  b.step(15);
  assert.equal(b.system.containedCount, 1);
  assert.equal(b.result('preventedRalstoniaEntryCount').passed, true);
  assert.equal(b.result('containedVascularRalstoniaCount').passed, true);

  const goal = createGoalSystem({ state: b.state, entities: b.entities });
  goal.setCompletionGuard(() => b.evaluator.evaluate(REQUIREMENTS.filter(condition => condition.key !== 'reachedFinalRoot')));
  b.state.level.goal = {
    x: b.state.player.x + b.state.player.w / 2,
    y: b.state.player.y + b.state.player.h / 2 - 48,
    radius: 80, completed: false,
  };
  goal.update();
  assert.equal(b.state.level.goal.completed, false, 'secundario ainda sem controle bloqueia');

  b.protect(secondary.root);
  b.goTo(secondary.root);
  b.step(40);
  assert.equal(secondary.neutralized, true);
  b.state.level.goal.x = b.state.player.x + b.state.player.w / 2;
  b.state.level.goal.y = b.state.player.y + b.state.player.h / 2 - 48;
  goal.update();
  assert.equal(b.state.level.goal.completed, true);
  assert.equal(b.system.successfulSpreadCount, 1, 'o erro continua disponivel para pontuacao e telemetria');
  assert.equal(b.state.gameState, 'transition');
});
