import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createRhizosphereLighting,
  readLightingPreference,
} from '../src/render/rhizosphere-lighting.js';

// Contexto falso: registra as chamadas de desenho e aceita qualquer método.
function mockContext() {
  const calls = [];
  const gradient = { addColorStop() {} };
  const target = {
    getTransform: () => ({ a: 1.45, b: 0, c: 0, d: 1.45, e: 0, f: -250 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  return {
    calls,
    ctx: new Proxy(target, {
      get(obj, key) {
        if (key in obj) return obj[key];
        return (...args) => { calls.push(key); return undefined; };
      },
      set() { return true; },
    }),
  };
}

function makeState(overrides = {}) {
  return {
    gameState: 'play',
    time: 1,
    cameraX: 0,
    cameraY: 170,
    cameraZoom: 1.45,
    player: { x: 100, y: 452, w: 32, h: 48 },
    level: {
      seed: 'teste',
      campaignPhase: 1,
      endX: 4000,
      geometryTopY: 300,
      geometryBottomY: 700,
      platforms: [{ x: 50, y: 500, w: 240, h: 100, type: 'root' }],
      exudates: [{ x: 300, y: 420, taken: false }],
      goal: { x: 3900, y: 280 },
    },
    ...overrides,
  };
}

const canvas = { width: 1280, height: 720, ownerDocument: null };

test('?luz=0 desliga; ausência do parâmetro ou valores positivos mantêm ligada', () => {
  assert.equal(readLightingPreference({ search: '' }), true);
  assert.equal(readLightingPreference({ search: '?luz=1' }), true);
  for (const off of ['?luz=0', '?luz=off', '?luz=false', '?luz=nao']) {
    assert.equal(readLightingPreference({ search: off }), false, off);
  }
  assert.equal(readLightingPreference(null), true);
});

test('desligada ao abrir, a camada não desenha nada', () => {
  const lighting = createRhizosphereLighting({ canvas, state: makeState(), enabled: false });
  const { ctx, calls } = mockContext();
  lighting.render(ctx);
  lighting.renderPlatformDepth(ctx);
  assert.equal(calls.length, 0);
  assert.equal(lighting.strength, 0);
});

async function settle(lighting, ctx, options, frames = 60) {
  for (let i = 0; i < frames; i++) {
    await new Promise(r => setTimeout(r, 25));
    lighting.render(ctx, options);
  }
}

test('ligada, entra suavemente, desenha em coordenadas de tela e restaura o contexto', async () => {
  const lighting = createRhizosphereLighting({ canvas, state: makeState() });
  const { ctx, calls } = mockContext();
  lighting.render(ctx);
  assert.equal(lighting.strength, 0, 'o primeiro quadro não aparece de uma vez');
  await settle(lighting, ctx);
  assert.equal(lighting.strength, 1);
  assert.ok(calls.includes('setTransform'));
  assert.equal(calls.filter(c => c === 'save').length, calls.filter(c => c === 'restore').length);
});

test('na cinemática final e na introdução a camada se apaga', async () => {
  const state = makeState();
  const lighting = createRhizosphereLighting({ canvas, state });
  const { ctx } = mockContext();
  await settle(lighting, ctx);
  assert.equal(lighting.strength, 1);
  await settle(lighting, ctx, { finaleActive: true });
  assert.equal(lighting.strength, 0);

  const intro = makeState({ gameState: 'intro' });
  const introLighting = createRhizosphereLighting({ canvas, state: intro });
  await settle(introLighting, ctx, undefined, 10);
  assert.equal(introLighting.strength, 0, 'nunca acende sobre a tela de introdução');
});

test('a tecla alterna e devolve o novo estado', () => {
  const lighting = createRhizosphereLighting({ canvas, state: makeState() });
  assert.equal(lighting.toggle(), false);
  assert.equal(lighting.toggle(), true);
  assert.equal(lighting.toggle(false), false);
});

test('a camada é só visual: não escreve no estado do jogo', async () => {
  const state = makeState();
  const before = JSON.stringify(state);
  const lighting = createRhizosphereLighting({ canvas, state, getAgents: () => [{ x: 400, y: 450, type: 'bacillus' }] });
  const { ctx } = mockContext();
  await settle(lighting, ctx, undefined, 20);
  lighting.renderPlatformDepth(ctx);
  assert.equal(JSON.stringify(state), before);
});

test('app.js liga a luz depois das plataformas e antes do rótulo, com tecla L', () => {
  const app = readFileSync(new URL('../src/procgen/app.js', import.meta.url), 'utf8');
  const depth = app.indexOf('lighting?.renderPlatformDepth(ctx)');
  const platforms = app.indexOf('platformVisuals.drawWorld(ctx)');
  const light = app.indexOf('lighting?.render(ctx, { finaleActive: phaseFinale.active })');
  const label = app.indexOf('platformVisuals.renderLabel(ctx)');
  assert.ok(platforms > 0 && depth > platforms, 'profundidade logo após as plataformas');
  assert.ok(light > depth && light < label, 'luz no fim do mundo, antes do rótulo');
  assert.match(app, /event\.code === 'KeyL'/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /data-mobile-action="toggle-lighting"/);
});
