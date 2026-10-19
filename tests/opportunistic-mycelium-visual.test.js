import assert from 'node:assert/strict';
import test from 'node:test';

import { createOpportunisticFungus } from '../src/procgen/opportunistic-fungus.js';
import { createPseudomonasSiderophores } from '../src/procgen/pseudomonas-siderophores.js';
import { createTrichodermaGrowth } from '../src/procgen/trichoderma-growth.js';
import { visibleRootRect } from '../src/render/rhizosphere-geometry.js';
import {
  drawOpportunisticMycelium,
  opportunisticContactPaths,
  opportunisticVisualSnapshot,
  syncOpportunisticVisual,
} from '../src/render/opportunistic-mycelium.js';

// Este contexto somente exercita o código real de desenho. A inspeção estética
// depende das capturas do navegador; nenhuma comparação de pixels é simulada.
function drawingContext() {
  let context;
  context = new Proxy({
    measureText: text => ({ width: String(text).length * 7 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return () => undefined;
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return context;
}

function seededRandom(seed = 137) {
  let value = seed >>> 0;
  let calls = 0;
  const random = () => {
    calls++;
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
  random.calls = () => calls;
  return random;
}

function harness(seed = 'organic-opportunist') {
  const root = { x: 180, y: 430, w: 360, h: 70, type: 'root', logicIndex: 2 };
  const effects = [];
  const audio = Object.fromEntries(['play', 'startLoop', 'stopLoop', 'stopGroup'].map(name => [
    name, (...args) => { effects.push([name, ...args]); return true; },
  ]));
  const state = {
    time: 0, gameState: 'play', cameraX: 0,
    campaign: { phase: 5, seed }, discoveredMicrobes: new Set(),
    player: {
      x: 334, y: 382, w: 32, h: 48, vitality: 5, soil: 0, hope: 0,
      infection: .2, moveMultiplier: 1, accelerationMultiplier: 1,
      jumpMultiplier: 1, fungalContamination: 0,
    },
    level: {
      platforms: [root], particles: [], hazards: [],
      siderophores: [], ironDeposits: [{
        id: 'iron-test', x: 330, y: 415, stock: 30, maxStock: 30, radius: 14,
      }],
      exudateClouds: [],
    },
  };
  const ecology = {
    encounters: [{ id: 'oportunista', x: 350, y: 400 }],
    agents: [0, 1].map(index => ({
      id: `focus:${index}`, type: 'oportunista', zoneIndex: 0,
      x: 350, y: 400, homeX: 350, homeY: 400,
      vx: 0, vy: 0, ironLimitation: 0,
    })),
  };
  const entities = {
    audio, burst(...args) { effects.push(['burst', ...args]); },
    damagePlayer(amount, ...rest) {
      state.player.vitality -= amount;
      effects.push(['damage', amount, ...rest]);
    },
  };
  const mycoparasitism = { networks: [] };
  const fungal = createOpportunisticFungus({ state, entities, ecology, mycoparasitism });
  return { state, root, ecology, entities, effects, fungal, mycoparasitism };
}

function advance(h, seconds, render = false) {
  const context = drawingContext();
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) {
    h.state.time += 1 / 60;
    h.fungal.prepare();
    h.fungal.update(1 / 60);
    if (render) h.fungal.render(context);
  }
  return [...h.fungal.networks.values()][0];
}

function biologicalSnapshot(h) {
  return structuredClone({
    player: h.state.player,
    agents: h.ecology.agents,
    root: h.root,
    effects: h.effects,
    contacts: h.fungal.contactIntensity,
    maximumIronLimitation: h.fungal.maximumIronLimitation,
    controlledFungalVigor: h.fungal.controlledFungalVigor,
    controlledOpportunisticFungusCount: h.fungal.controlledOpportunisticFungusCount,
    networks: [...h.fungal.networks.values()].map(network => ({
      key: network.key, segments: network.segments, tips: network.tips,
      spores: network.spores, lesions: network.lesions,
      response: network.response, attached: network.attached,
      growthAccumulator: network.growthAccumulator,
      sporeAccumulator: network.sporeAccumulator,
      reachedLesions: network.reachedLesions,
      wasActive: network.wasActive, maximumObservedVigor: network.maximumObservedVigor,
      controlHold: network.controlHold, everControlled: network.everControlled,
    })),
  });
}

test('desenhar, inspecionar e obter caminhos não altera rede, raiz, jogador nem RNG', () => {
  const h = harness('drawing-purity');
  const network = advance(h, 7);
  const before = biologicalSnapshot(h);
  const globalRandom = Math.random;
  let globalCalls = 0;
  const biologicalRandom = network.random;
  let biologicalCalls = 0;
  Math.random = () => { globalCalls++; return .37; };
  network.random = () => { biologicalCalls++; return biologicalRandom(); };
  try {
    for (const time of [7, 7.01, 8, 20]) {
      syncOpportunisticVisual(network, time);
      opportunisticVisualSnapshot(network, time);
      opportunisticContactPaths(network, time);
      drawOpportunisticMycelium(drawingContext(), network, { ...h.state, time });
    }
    assert.deepEqual(biologicalSnapshot(h), before);
    assert.equal(globalCalls, 0, 'camada visual não consome RNG global');
    assert.equal(biologicalCalls, 0, 'camada visual não avança RNG da rede real');
  } finally {
    Math.random = globalRandom;
    network.random = biologicalRandom;
  }
});

function integratedRun(withRendering) {
  const globalRandom = Math.random;
  const random = seededRandom(41987);
  Math.random = random;
  try {
    const h = harness('coupled-controller-invariance');
    const pseudomonasColonies = [];
    const siderophores = createPseudomonasSiderophores({
      state: h.state, entities: h.entities, ecology: h.ecology,
      inoculants: { colonies: pseudomonasColonies },
    });
    const triColonies = [];
    const colonies = {
      colonies: triColonies,
      byId: id => triColonies.find(colony => colony.id === id),
      inoculateNaturalAgent: () => null,
      get vigorAverage() { return triColonies.length ? triColonies[0].vigor : 0; },
    };
    const trichoderma = createTrichodermaGrowth({
      state: h.state, entities: h.entities, ecology: h.ecology, colonies,
    });
    Object.defineProperty(h.mycoparasitism, 'networks', { get: () => trichoderma.networks });
    trichoderma.setTargetVisualProvider(targetId => h.fungal.contactPaths(targetId));
    const context = drawingContext();
    const snapshots = [];
    let peakSegments = 0;
    let peakSpores = 0;
    let peakLimitation = 0;
    for (let frame = 0; frame < 2500; frame++) {
      const dt = 1 / 60;
      h.state.time += dt;
      if (frame === 600) pseudomonasColonies.push({
        id: 'pseudo-1', type: 'pseudomonas', x: 342, y: 425,
        platform: h.root, radius: 110, vigor: 1, growth: 1,
        dormant: false, sourceCount: 3, rechargeIntensity: 1,
      });
      if (frame === 1200) {
        triColonies.push({
          id: 'tri-1', type: 'trichoderma', x: 325, y: 425,
          platform: h.root, radius: 90, vigor: 1, growth: 1,
          exhausted: false, cooldownUntil: 0, activeTargetId: null,
          sourceCount: 2, kills: 0,
        });
        h.state.level.exudateClouds.push({
          id: 'fuel-test', x: 325, y: 425, radius: 100, life: 30, maxLife: 30,
        });
      }
      h.fungal.prepare();
      siderophores.update(dt);
      h.fungal.update(dt);
      trichoderma.update(dt);
      for (const network of h.fungal.networks.values()) {
        peakSegments = Math.max(peakSegments, network.segments.length);
        peakSpores = Math.max(peakSpores, network.spores.length);
        peakLimitation = Math.max(peakLimitation, ...network.agents.map(agent => agent.ironLimitation || 0));
        if (withRendering) {
          const attacks = [...(trichoderma.networks?.values() || [])];
          drawOpportunisticMycelium(context, network, h.state, attacks);
          opportunisticVisualSnapshot(network, h.state.time, attacks);
        }
      }
      if (withRendering) {
        h.fungal.render(context);
        trichoderma.render(context);
        siderophores.render(context);
      }
      if (frame % 120 === 0 || frame === 2499) snapshots.push({
        biological: biologicalSnapshot(h),
        pseudo: structuredClone(pseudomonasColonies),
        tricho: structuredClone(triColonies),
        attackCount: trichoderma.attackCount,
        ironRecovered: siderophores.ironRecovered,
      });
    }
    return {
      snapshots, randomCalls: random.calls(), peakSegments, peakSpores, peakLimitation,
      remainingAgents: h.ecology.agents.length, kills: triColonies[0].kills,
    };
  } finally { Math.random = globalRandom; }
}

test('2.500 passos com Pseudomonas e Trichoderma reais preservam mecânica com desenho ligado', () => {
  const unseen = integratedRun(false);
  const seen = integratedRun(true);
  assert.deepEqual(seen, unseen, 'desenho/diagnóstico preservam taxas, colisões, esporos, áudio, recursos e RNG');
  assert.ok(seen.peakSegments >= 100, 'o micélio real estabeleceu-se');
  assert.ok(seen.peakSpores > 0, 'houve esporulação real');
  assert.ok(seen.peakLimitation > .3, 'houve pressão real por ferro');
  assert.ok(seen.kills >= 1, 'houve contato, lise e eliminação pelo controlador real de Trichoderma');
  assert.ok(seen.remainingAgents < 2, 'remoção de pelo menos um agente do foco foi exercitada');
});

test('alongamento visual interpola só segmentos reais e permanece na superfície original', () => {
  const h = harness('root-surface-apical');
  const network = advance(h, 4);
  const first = opportunisticVisualSnapshot(network, h.state.time);
  const fixed = first.points.filter(point => point.fraction === 1);
  assert.ok(first.segments > 0);
  assert.equal(first.segments, network.segments.length, 'não inventa filamentos de colisão ou nova biomassa');
  assert.ok(first.points.some(point => point.fraction < 1), 'a ponta mais nova ainda está alongando');
  const sourceSegments = structuredClone(network.segments);
  const rect = visibleRootRect(h.root);
  for (const point of first.points) {
    for (const endpoint of [point.start, point.end]) {
      assert.ok(endpoint.x >= rect.x && endpoint.x <= rect.x + rect.w);
      assert.ok(endpoint.y >= rect.y && endpoint.y <= rect.y + rect.h);
    }
  }
  advance(h, 2);
  const next = opportunisticVisualSnapshot(network, h.state.time);
  assert.deepEqual(network.segments.slice(0, sourceSegments.length), sourceSegments, 'estado mecânico já formado permanece');
  assert.deepEqual(next.points.slice(0, fixed.length).map(point => ({ start: point.start, end: point.end })),
    fixed.map(point => ({ start: point.start, end: point.end })), 'vértices maduros persistem sem ondular no tecido');
  assert.ok(next.branches >= first.branches);
});

test('lesão alcançada amadurece continuamente sem alterar a chegada biológica', () => {
  const h = harness('lesion-maturation');
  let network;
  let reachedIndex = -1;
  let arrival;
  for (let frame = 0; frame < 1200 && reachedIndex < 0; frame++) {
    network = advance(h, 1 / 60);
    const snapshot = opportunisticVisualSnapshot(network, h.state.time);
    reachedIndex = snapshot.lesions.findIndex((lesion, index) => index > 0 && lesion.reached);
    if (reachedIndex >= 0) arrival = snapshot.lesions[reachedIndex];
  }
  assert.ok(reachedIndex > 0, 'a ponta real alcançou um novo ponto de colonização');
  assert.equal(arrival.biologicalMaturity, 1, 'a regra legada de chegada permanece intacta');
  assert.ok(arrival.maturity < .05, 'a marca visual ainda não nasce como lesão completa');
  advance(h, .75);
  const middle = opportunisticVisualSnapshot(network, h.state.time).lesions[reachedIndex];
  assert.ok(middle.maturity > arrival.maturity && middle.maturity < 1);
  advance(h, 3);
  const mature = opportunisticVisualSnapshot(network, h.state.time).lesions[reachedIndex];
  assert.equal(mature.maturity, 1);
  assert.equal(network.lesions[reachedIndex].maturity, 1);
  assert.ok(opportunisticVisualSnapshot(network, h.state.time).lesions
    .filter(lesion => !lesion.reached).every(lesion => lesion.maturity === 0));
});

test('limitação de ferro desacelera crescimento e esporulação reais com perda gradual de vigor visual', () => {
  const h = harness('iron-inhibition');
  const network = advance(h, 6);
  const healthy = opportunisticVisualSnapshot(network, h.state.time);
  const formed = structuredClone(network.segments);
  for (const agent of h.ecology.agents) agent.ironLimitation = 1;
  h.fungal.update(0);
  const immediate = opportunisticVisualSnapshot(network, h.state.time);
  assert.equal(immediate.vigor, network.response.vigor);
  assert.ok(immediate.vigor < healthy.vigor);
  assert.equal(immediate.displayVigor, healthy.displayVigor, 'não pisca nem apaga rede no instante da inibição');
  advance(h, .5);
  const inhibited = opportunisticVisualSnapshot(network, h.state.time);
  assert.ok(inhibited.displayVigor < immediate.displayVigor);
  assert.ok(inhibited.displayVigor > inhibited.vigor, 'perda de vigor é progressiva');
  assert.equal(inhibited.growth, network.response.growth);
  assert.equal(inhibited.branching, network.response.branching);
  assert.equal(inhibited.sporulation, network.response.sporulation);
  assert.ok(inhibited.growth < healthy.growth);
  assert.ok(inhibited.branching < healthy.branching);
  assert.ok(inhibited.sporulation < healthy.sporulation);
  assert.equal(inhibited.lysis, 0, 'ferro não é confundido com micoparasitismo letal');
  assert.deepEqual(network.segments.slice(0, formed.length), formed);
  assert.ok(inhibited.remainingLength > 0, 'hifas existentes permanecem presentes');
  assert.equal(inhibited.spores, network.spores.length, 'só mostra os esporos biológicos reais');
});

test('contato e lise seguem cada agente do foco e não eliminam toda rede no primeiro ataque', () => {
  const h = harness('agent-weighted-lysis');
  const network = advance(h, 8);
  const before = opportunisticVisualSnapshot(network, h.state.time);
  const source = structuredClone(network.segments);
  const attack = { metadata: { targetId: 'focus:0', contact: .6, lysis: .5, contactLocked: true } };
  const during = opportunisticVisualSnapshot(network, h.state.time, [attack]);
  assert.equal(during.contact, .3);
  assert.equal(during.lysis, .25, 'um alvo em dois recebe peso proporcional');
  assert.ok(during.remainingLength < before.remainingLength && during.remainingLength > 0);
  network.agents = network.agents.filter(agent => agent.id !== 'focus:0');
  const firstEliminated = opportunisticVisualSnapshot(network, h.state.time, []);
  assert.equal(firstEliminated.lysis, .5, 'a remoção real mantém a regressão entre ataques');
  assert.ok(firstEliminated.remainingLength > 0, 'agente restante conserva parte da rede');
  const finalAttack = { metadata: { targetId: 'focus:1', contact: 1, lysis: 1, contactLocked: true } };
  const controlled = opportunisticVisualSnapshot(network, h.state.time, [finalAttack]);
  assert.equal(controlled.lysis, 1);
  assert.equal(controlled.remainingLength, 0);
  assert.deepEqual(network.segments, source, 'regressão do desenho não remove colisões nem adianta a eliminação');
});

test('ataque abortado ou exaurido não aparece como lise bem-sucedida', () => {
  const h = harness('aborted-control');
  const network = advance(h, 5);
  for (const reason of ['aborted', 'exhausted']) {
    const snapshot = opportunisticVisualSnapshot(network, h.state.time, [{
      metadata: { targetId: 'focus:0', contact: 1, lysis: .8, [reason]: true },
    }]);
    assert.equal(snapshot.lysis, 0);
    assert.equal(snapshot.contact, 0);
    assert.ok(snapshot.remainingLength > 0);
  }
});
