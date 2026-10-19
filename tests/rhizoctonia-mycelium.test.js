import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RHIZOCTONIA_VISUAL_LIMITS,
  drawRhizoctoniaMycelium,
  forgetRhizoctoniaMycelium,
  rhizoctoniaContactPaths,
  rhizoctoniaMyceliumSnapshot,
  rhizoctoniaVisualBiology,
  syncRhizoctoniaMycelium,
} from '../src/render/rhizoctonia-mycelium.js';
import { buildRhizoctoniaCoils } from '../src/render/rhizoctonia-mycoparasitism.js';
import { visibleRootRect } from '../src/render/rhizosphere-geometry.js';
import { createRhizoctoniaControl } from '../src/procgen/rhizoctonia-control.js';
import { createTrichodermaColonies } from '../src/procgen/trichoderma-colonies.js';
import { createTrichodermaRhizoctoniaControl } from '../src/procgen/trichoderma-rhizoctonia-control.js';
import { createCampaignObjectiveEvaluator } from '../src/procgen/campaign-objectives.js';
import { getPhaseManifest } from '../src/procgen/campaign-manifest.js';
import { createSimulator } from '../src/procgen/simulator.js';

function focus(colonization = .16, options = {}) {
  const hostPlatform = { type: 'root', x: 120, y: 458, w: 240, h: 68,
    rootDamage: 0, rootHealth: 1, logicIndex: 1, ...options.host };
  return { type: 'rhizoctonia', alive: true, x: 200, y: 390, w: 45, h: 54,
    infectionX: hostPlatform.x + hostPlatform.w * .48,
    colonization, hostPlatform, ...options.enemy };
}

function drawingContext() {
  const paint = { fills: [], strokes: [] };
  const gradient = { addColorStop() {} };
  const stack = [];
  const target = {
    globalAlpha: 1,
    canvas: { width: 3000, height: 2000 },
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    fill() { paint.fills.push({ style: this.fillStyle, alpha: this.globalAlpha }); },
    stroke() { paint.strokes.push({ style: this.strokeStyle, alpha: this.globalAlpha, width: this.lineWidth }); },
    save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
    restore() { Object.assign(this, stack.pop() || {}); },
  };
  return { paint, ctx: new Proxy(target, { get: (object, name) => name in object ? object[name] : (() => {}) }) };
}

const vertices = model => model.tips.map(tip => tip.points.map(point => ({ ...point })));

test('hifas persistem por extensão apical: vértices anteriores não mudam quando a colonização avança', () => {
  const enemy = focus(.09);
  const model = syncRhizoctoniaMycelium(enemy);
  const previous = vertices(model);
  const first = rhizoctoniaMyceliumSnapshot(enemy);
  for (let c = .10; c <= .80; c += .01) { enemy.colonization = c; syncRhizoctoniaMycelium(enemy); }
  const grown = rhizoctoniaMyceliumSnapshot(enemy);
  assert.ok(grown.points > first.points);
  assert.ok(grown.branches > first.branches, 'a extensão produz ramificações secundárias');
  previous.forEach((points, index) => assert.deepEqual(model.tips[index].points.slice(0, points.length), points));
});

test('colonização fixa e relógio de renderização não criam hifas, ramos ou área nova', () => {
  const enemy = focus(.46);
  const model = syncRhizoctoniaMycelium(enemy);
  const before = { points: vertices(model), snapshot: rhizoctoniaMyceliumSnapshot(enemy) };
  const { ctx } = drawingContext();
  for (let frame = 0; frame < 121; frame++) drawRhizoctoniaMycelium(ctx, enemy, { time: frame * 99, cameraX: frame });
  assert.deepEqual(vertices(model), before.points);
  assert.deepEqual(rhizoctoniaMyceliumSnapshot(enemy), before.snapshot);
});

test('rede é restrita ao hospedeiro e acompanha deslocamento, largura e espessura da raiz', () => {
  const enemy = focus(.9);
  const model = syncRhizoctoniaMycelium(enemy);
  const original = vertices(model);
  const pathsBefore = rhizoctoniaContactPaths(enemy);
  enemy.hostPlatform.x += 421;
  enemy.hostPlatform.y -= 89;
  const pathsAfter = rhizoctoniaContactPaths(enemy);
  assert.deepEqual(vertices(model), original, 'movimento da raiz não recria seus vértices locais');
  pathsAfter.paths.forEach((path, i) => path.points.forEach((p, j) => {
    assert.ok(Math.abs(p.x - pathsBefore.paths[i].points[j].x - 421) < 1e-9);
    assert.ok(Math.abs(p.y - pathsBefore.paths[i].points[j].y + 89) < 1e-9);
  }));
  enemy.hostPlatform.w = 92;
  enemy.hostPlatform.h = 40;
  const rect = visibleRootRect(enemy.hostPlatform);
  for (const path of rhizoctoniaContactPaths(enemy).paths) {
    for (const p of path.points) {
      assert.ok(p.x >= rect.x && p.x <= rect.x + rect.w, 'não cria pontes para outra plataforma');
      assert.ok(p.y >= rect.y && p.y <= rect.y + rect.h, 'a rizobainha inteira não é a raiz visível');
    }
  }
  for (const tip of model.tips) for (const p of tip.points) {
    assert.ok(p.x >= 0 && p.x <= model.width);
    assert.ok(p.y >= 0 && p.y <= model.band);
  }
});

test('as bifurcações são próximas de 90 graus e respeitam o orçamento por foco', () => {
  let forks = 0;
  for (let seed = 0; seed < 30; seed++) {
    const enemy = focus(.06, { host: { x: seed * 97, w: 90 + seed * 13 } });
    for (let i = 6; i <= 100; i++) { enemy.colonization = i / 100; syncRhizoctoniaMycelium(enemy); }
    const snapshot = rhizoctoniaMyceliumSnapshot(enemy);
    assert.ok(snapshot.points <= RHIZOCTONIA_VISUAL_LIMITS.points);
    assert.ok(snapshot.branches <= RHIZOCTONIA_VISUAL_LIMITS.branches);
    assert.equal(RHIZOCTONIA_VISUAL_LIMITS.points, 720);
    assert.equal(RHIZOCTONIA_VISUAL_LIMITS.branches, 34);
    for (const angle of snapshot.forks) {
      const degrees = angle / Math.PI * 180;
      assert.ok(degrees >= 84 && degrees <= 96, `ramificação de ${degrees} graus`);
      forks++;
    }
  }
  assert.ok(forks > 100, 'o critério cobre ramos de vários focos e profundidades');
});

test('Bacillus e limitação de ferro atenuam pontas sem inventar regressão da colonização', () => {
  const enemy = focus(.33);
  const active = rhizoctoniaMyceliumSnapshot(enemy);
  enemy.bacillusControl = .45;
  const bacillus = rhizoctoniaMyceliumSnapshot(enemy);
  enemy.ironLimitation = .8;
  const combined = rhizoctoniaMyceliumSnapshot(enemy);
  assert.ok(bacillus.activity < active.activity);
  assert.ok(combined.activity < bacillus.activity);
  assert.equal(combined.totalLength, active.totalLength);
  assert.equal(combined.remainingLength, active.remainingLength,
    'pressão não substitui queda real de colonização ou lise');
  enemy.colonization = .45;
  assert.ok(rhizoctoniaMyceliumSnapshot(enemy).totalLength > active.totalLength,
    'crescimento positivo ainda calculado pela biologia continua visível');
  enemy.trichodermaSuppression = .9;
  assert.ok(rhizoctoniaVisualBiology(enemy).activity < combined.activity * .2);
  enemy.contained = true;
  assert.equal(rhizoctoniaMyceliumSnapshot(enemy).activeTips, 0);
});

test('regressão e lise degradam a rede existente e não apagam a cicatriz antes da cura real', () => {
  const enemy = focus(.85, { host: { rootDamage: .72, rootHealth: .28 } });
  const initial = rhizoctoniaMyceliumSnapshot(enemy);
  enemy.colonization = .30;
  const retreat = rhizoctoniaMyceliumSnapshot(enemy);
  enemy.trichodermaLysis = .65;
  enemy.trichodermaSuppression = 1;
  const lysis = rhizoctoniaMyceliumSnapshot(enemy);
  assert.ok(retreat.remainingLength < initial.remainingLength);
  assert.ok(lysis.remainingLength < retreat.remainingLength);
  assert.equal(lysis.totalLength, initial.totalLength, 'a rede persiste com integridade menor, não é resorteada');
  assert.equal(lysis.damage, .72, 'lise não finge cura do tecido');
  enemy.alive = false; enemy.colonization = .06; enemy.trichodermaLysis = 1;
  const eliminated = rhizoctoniaMyceliumSnapshot(enemy);
  assert.equal(eliminated.remainingLength, 0);
  assert.equal(eliminated.activity, 0);
  assert.equal(eliminated.damage, .72);
});

test('necrose responde ao dano da raiz independentemente de nova colonização', () => {
  const enemy = focus(.4);
  const before = rhizoctoniaMyceliumSnapshot(enemy);
  const healthy = drawingContext();
  drawRhizoctoniaMycelium(healthy.ctx, enemy, { time: 0 });
  enemy.hostPlatform.rootDamage = .8; enemy.hostPlatform.rootHealth = .2;
  const damaged = drawingContext();
  drawRhizoctoniaMycelium(damaged.ctx, enemy, { time: 0 });
  assert.equal(healthy.paint.fills.filter(call => String(call.style).startsWith('rgba(66,43,29,')).length,
    0, 'não pinta lesão na raiz saudável');
  const cortical = damaged.paint.fills.filter(call => String(call.style).startsWith('rgba(66,43,29,'));
  assert.ok(cortical.length > 10, 'dano produz manchas corticais irregulares, não apenas um retângulo');
  assert.ok(new Set(cortical.map(call => call.style)).size > 5, 'a severidade varia sobre o tecido');
  const after = rhizoctoniaMyceliumSnapshot(enemy);
  assert.equal(after.points, before.points);
  assert.equal(after.totalLength, before.totalLength);
  assert.equal(after.damage, .8);
});

test('modelo, desenho e contatos não consomem RNG global nem alteram a simulação', () => {
  const enemy = focus(.74, { host: { rootDamage: .52, rootHealth: .48 },
    enemy: { trichodermaContact: .8, trichodermaLysis: .3 } });
  const original = structuredClone(enemy);
  // The legacy visibleRootRect helper uses Object.create(host), so freezing
  // inherited dimensions would also prohibit its unrelated derived rectangle.
  Object.freeze(enemy);
  const oldRandom = Math.random;
  const { ctx } = drawingContext();
  Math.random = () => { throw new Error('o visual consumiu RNG da jogabilidade'); };
  try {
    syncRhizoctoniaMycelium(enemy);
    drawRhizoctoniaMycelium(ctx, enemy, { time: 800 });
    const paths = rhizoctoniaContactPaths(enemy);
    buildRhizoctoniaCoils(paths, .8, .2, .3);
    rhizoctoniaMyceliumSnapshot(enemy);
  } finally { Math.random = oldRandom; }
  assert.deepEqual(enemy, original);
});

test('reset visual libera o foco e a reconstrução determinística conserva sua pose', () => {
  const enemy = focus(.65);
  const first = syncRhizoctoniaMycelium(enemy);
  const points = vertices(first);
  forgetRhizoctoniaMycelium(enemy);
  const second = syncRhizoctoniaMycelium(enemy);
  assert.notEqual(second, first);
  assert.deepEqual(vertices(second), points);
  assert.equal(syncRhizoctoniaMycelium({ alive: true }), null);
});

function polylineLength(points) {
  return points.slice(1).reduce((sum, p, index) => sum + Math.hypot(p.x - points[index].x, p.y - points[index].y), 0);
}

function distanceToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

test('enovelamento acompanha hifas existentes e cresce com contato real de zero a um', () => {
  const paths = rhizoctoniaContactPaths(focus(.8));
  const original = structuredClone(paths);
  assert.deepEqual(buildRhizoctoniaCoils(paths, 0, .7), []);
  const beginning = buildRhizoctoniaCoils(paths, .1, .7);
  const mature = buildRhizoctoniaCoils(paths, 1, .7);
  assert.ok(beginning.length > 0 && mature.length > 0);
  assert.ok(mature.reduce((sum, coil) => sum + polylineLength(coil.points), 0)
    > beginning.reduce((sum, coil) => sum + polylineLength(coil.points), 0) * 2);
  mature.forEach((coil, index) => {
    const substrate = paths.paths[index].points;
    for (const p of coil.points) {
      const distance = Math.min(...substrate.slice(1).map((b, i) => distanceToSegment(p, substrate[i], b)));
      assert.ok(distance < 2.2, 'a hélice envolve a hifa, não orbita livremente o sprite');
    }
    assert.ok(coil.points.length <= 111);
  });
  assert.deepEqual(buildRhizoctoniaCoils(paths, 1, .7), mature);
  assert.deepEqual(paths, original, 'o enovelamento não modifica o substrato patogênico');
});

function runBiology(withRendering) {
  const oldRandom = Math.random;
  let rng = 81913, randomCalls = 0;
  Math.random = () => { randomCalls++; rng = Math.imul(rng, 1664525) + 1013904223 | 0; return (rng >>> 0) / 4294967296; };
  try {
    const enemy = focus(.16);
    const root = enemy.hostPlatform;
    const state = { gameState: 'play', time: 0, cameraX: 0, campaign: { phase: 6, seed: 'rhizo-visual-invariance' },
      player: { x: enemy.infectionX + 50, y: root.y - 48, w: 30, h: 48, facing: -1, soil: 0, hope: 0 },
      level: { platforms: [root], enemies: [enemy], biofilms: [], exudateClouds: [] } };
    const audio = [], hits = [], bursts = [];
    const entities = {
      damagePlayer(...args) { hits.push(structuredClone(args)); },
      burst(...args) { bursts.push(args); },
      discoverMicrobe() {},
      interactionFx(...args) { audio.push(['interaction', ...args]); return { state: 'played' }; },
      audio: {
        startLoop(...args) { audio.push(['start', ...structuredClone(args)]); },
        stopLoop(...args) { audio.push(['stop', ...structuredClone(args)]); },
        stopGroup(...args) { audio.push(['group', ...args]); },
        play(...args) { audio.push(['play', ...structuredClone(args)]); return { state: 'played' }; },
      },
    };
    const ecology = { agents: [] };
    const input = { keys: {} };
    const colonies = createTrichodermaColonies({ state, input, ecology, entities });
    const rhizo = createRhizoctoniaControl({ state, entities });
    const tricho = createTrichodermaRhizoctoniaControl({ state, entities, colonies });
    const objectives = createCampaignObjectiveEvaluator({ state, systems: { trichoderma: tricho } });
    const { ctx } = drawingContext();
    const trace = [];
    let contactSeen = false, lysisSeen = false, damageBeforeTreatment = 0;
    for (let frame = 0; frame < 600; frame++) {
      state.time += .1;
      rhizo.prepare(); tricho.update(0);
      if (frame === 350) {
        damageBeforeTreatment = root.rootDamage;
        // The real natural inoculation API creates the normal colony values.
        // This fixture does not override growth, vigor, attack or pathogen stats.
        const agent = { id: 'fixture-trichoderma', type: 'trichoderma', x: enemy.infectionX - 45, y: root.y - 7 };
        ecology.agents.push(agent);
        colonies.inoculateNaturalAgent(agent);
      }
      colonies.update(.1);
      rhizo.update(.1); tricho.update(.1);
      contactSeen ||= (enemy.trichodermaContact || 0) > .1;
      lysisSeen ||= (enemy.trichodermaLysis || 0) > .3;
      if (withRendering) { rhizo.render(ctx); tricho.render(ctx); }
      trace.push({ colonization: enemy.colonization, hp: enemy.hp, alive: enemy.alive,
        charge: enemy.rhizoCharge, lunge: enemy.rhizoLunge, hit: enemy.rhizoHitApplied,
        contact: enemy.trichodermaContact, lysis: enemy.trichodermaLysis,
        damage: root.rootDamage, health: root.rootHealth,
        vigor: colonies.colonies[0]?.vigor, growth: colonies.colonies[0]?.growth,
        eliminated: tricho.eliminatedCount, active: tricho.activeAttackCount,
        objective: objectives.worldValue({ key: 'neutralizedRhizoctoniaCount' }),
        playerSoil: state.player.soil, playerHope: state.player.hope });
    }
    return { trace, randomCalls, audio, hits, bursts, contactSeen, lysisSeen, damageBeforeTreatment,
      final: objectives.evaluate(getPhaseManifest(6).finalTest) };
  } finally { Math.random = oldRandom; }
}

test('600 passos da biologia real mantêm combate, dano, vigor, áudio, RNG e objetivos idênticos com ou sem desenho', () => {
  const control = runBiology(false);
  const rendered = runBiology(true);
  assert.ok(control.damageBeforeTreatment > .25, 'há lesão real antes da intervenção');
  assert.ok(control.contactSeen && control.lysisSeen, 'o controle percorreu contato e lise reais');
  assert.ok(control.trace.at(-1).eliminated >= 1, 'a colônia real completou o micoparasitismo');
  assert.ok(control.hits.length > 0, 'o teste também percorreu a hifa de ataque do patógeno');
  assert.ok(control.audio.some(event => event[0] === 'play' && event[1] === 'trichodermaControlComplete'));
  assert.deepEqual(rendered, control);
});

function completeLoopFixture() {
  const sim = createSimulator();
  const enemy = focus(.16, { enemy: { maxHp: 3, hp: 3, vx: 0, phase: .7, attackCooldown: 5 } });
  Object.assign(sim.state.level, { platforms: [enemy.hostPlatform], enemies: [enemy], endX: 2000 });
  sim.state.campaign = { phase: 6, seed: 'managed-physics-regression', unlocks: {} };
  Object.assign(sim.state.player, { x: 125, y: enemy.hostPlatform.y - sim.state.player.h,
    vx: 0, vy: 0, onGround: true, supportPlatform: enemy.hostPlatform });
  return { sim, enemy };
}

test('loop completo deixa a colonização gerenciada para o controlador moderno, sem consumir biomassa pelo stun de posicionamento', () => {
  const { sim, enemy } = completeLoopFixture();
  const rhizo = createRhizoctoniaControl({ state: sim.state, entities: sim.entities,
    pseudomonas: sim.pseudomonasSiderophores });
  let expected = enemy.colonization;
  for (let frame = 0; frame < 60; frame++) {
    rhizo.prepare();
    const beforePhysics = enemy.colonization;
    sim.step(1 / 60);
    assert.equal(enemy.rhizoctoniaManaged, true);
    assert.equal(enemy.colonization, beforePhysics, 'a física não pode aplicar outra taxa nem outro piso');
    rhizo.update(1 / 60);
    expected += (1 / 60) * (.012 + expected * .012) * 1.175;
    assert.ok(Math.abs(enemy.colonization - expected) < 1e-12);
  }
  assert.ok(enemy.colonization > .176, 'o foco sem controle cresce naturalmente');
  assert.ok(enemy.stun > 900, 'o foco continua fixado, sem reativar o combate legado');
});

test('Rhizoctonia legada sem controlador mantém regressão por stun e crescimento quando não atordoada', () => {
  const stunned = completeLoopFixture();
  stunned.enemy.colonization = .4; stunned.enemy.stun = 1;
  stunned.sim.step(.1);
  assert.ok(Math.abs(stunned.enemy.colonization - (.4 - .1 * .025)) < 1e-12);
  assert.equal(stunned.enemy.rhizoctoniaManaged, undefined);
  const unstunned = completeLoopFixture();
  unstunned.enemy.colonization = .4; unstunned.enemy.stun = 0;
  unstunned.sim.step(.1);
  assert.ok(Math.abs(unstunned.enemy.colonization - (.4 + .1 * .018)) < 1e-12);
});
