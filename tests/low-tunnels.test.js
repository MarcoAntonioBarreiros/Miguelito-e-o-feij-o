import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulator } from '../src/procgen/simulator.js';
import { LOW_TUNNEL, lowTunnelCandidates, installLowTunnels, tunnelGapFor } from '../src/procgen/low-tunnels.js';

const DT = 1 / 60;
const FLOOR = 400;

// Par da rota num trecho procedural da fase 6 (p6-rhizo-practice, 11-35).
function pair(pairGap, { aw = 260, bw = 260, dy = 0 } = {}) {
  const a = { x: 1000, y: FLOOR, w: aw, h: 60, logicIndex: 20, type: 'soil' };
  const b = { x: 1000 + aw + pairGap, y: FLOOR + dy, w: bw, h: 60, logicIndex: 21, type: 'soil' };
  return { platforms: [a, b], exudates: [] };
}

// Atravessa o tunel instalado com o simulador do jogo. plan.at = distancia da
// borda do vao (px) em que a acao comeca, andando para a direita.
function cross(sim, level, plan) {
  sim.reset();
  const s = sim.state;
  const drop = level.ceilingDrops[0];
  s.level.platforms = level.platforms.map(p => ({ ...p }));
  s.level.ceilingDrops = level.ceilingDrops;
  s.level.tunnelFloors = level.tunnelFloors;
  s.level.hazards = [];
  const a = level.platforms[0];
  s.player.x = a.x + 10;
  s.player.y = a.y - 48;
  s.player.vx = 0;
  s.player.canDoubleJump = true;
  s.player.canDash = plan.dash != null;
  s.player.canJetpack = Boolean(plan.jet);
  s.player.jetpackEnergy = plan.jet ? 1 : 0;
  let t0 = -1;
  for (let f = 0; f < 400; f++) {
    const keys = { ArrowRight: true };
    if (t0 < 0 && s.player.x + s.player.w >= drop.entryX - plan.at) t0 = f;
    if (t0 >= 0) {
      const t = f - t0;
      if (plan.dash != null && t === plan.dash) keys.ShiftLeft = true;
      if (plan.jump != null && t >= plan.jump && t < plan.jump + plan.hold) keys.Space = true;
      if (plan.dj != null && t >= plan.dj && t < plan.dj + 6) keys.Space = true;
      if (plan.jet && t >= plan.jetAt) keys.KeyK = true;
    }
    sim.setInputs(keys);
    sim.step(DT);
    if (s.player.y > FLOOR + 170) return false;
    if (t0 >= 0 && s.player.onGround && s.player.x >= drop.exitX - 4) return true;
  }
  return false;
}

test('dentro do tunel a cabeca nao sobe: o pulo bate no teto', () => {
  const level = pair(136);
  installLowTunnels(level, { phase: 6, seedValue: 't' });
  const drop = level.ceilingDrops[0];
  const sim = createSimulator();
  sim.reset();
  const s = sim.state;
  s.level.platforms = level.platforms;
  s.level.ceilingDrops = level.ceilingDrops;
  s.level.hazards = [];
  s.player.x = drop.entryX - 80;
  s.player.y = FLOOR - 48;
  let minY = Infinity;
  for (let f = 0; f < 40; f++) {
    sim.setInputs(f < 10 ? { Space: true } : {});
    sim.step(DT);
    minY = Math.min(minY, s.player.y);
  }
  assert.ok(minY >= FLOOR - LOW_TUNNEL.clearance - .5, `a cabeca entrou no teto (minY ${minY})`);
});

for (const pairGap of [136, 246, 300]) {
  for (const dy of [-6, 0, 8, 24, LOW_TUNNEL.maxDrop]) {
    test(`anda -> Dash -> anda atravessa; pulo nao (vao do par ${pairGap}, chegada ${dy} px abaixo)`, () => {
      const level = pair(pairGap, { dy });
      const drops = installLowTunnels(level, { phase: 6, seedValue: 't' });
      if (pairGap < tunnelGapFor(dy) - 4) { assert.equal(drops.length, 0, 'chegada baixa pede vao maior'); return; }
      assert.equal(drops.length, 1);
      assert.equal(Math.round(drops[0].exitX - drops[0].entryX), Math.min(pairGap, tunnelGapFor(dy)), 'vao dentro do tunel');
      const sim = createSimulator();
      let jumps = 0;
      for (let at = -12; at <= 50; at += 6) for (const hold of [1, 3, 6, 12]) for (const dj of [null, 4, 8, 14, 20]) {
        if (cross(sim, level, { at, jump: 0, hold, dj })) jumps++;
      }
      assert.equal(jumps, 0, `${jumps} pulos atravessaram`);
      // Dash andando: janela folgada (apertar perto da borda, antes ou logo depois)
      const ok = [];
      for (let at = -12; at <= 40; at += 4) if (cross(sim, level, { at, dash: 0 })) ok.push(at);
      assert.ok(ok.length >= 7, `Dash andando passou em ${ok.length}/14 pontos (${ok.join(',')})`);
      // propulsor andando
      let jet = 0;
      for (const at of [-8, 0, 10]) for (const jetAt of [0, 4]) if (cross(sim, level, { at, jet: true, jetAt })) jet++;
      assert.ok(jet >= 5, `propulsor passou ${jet}/6`);
    });
  }
}

test('candidatos: trecho procedural, alturas compativeis e nada no caminho', () => {
  assert.equal(lowTunnelCandidates(pair(246), 6).length, 1);
  assert.equal(lowTunnelCandidates(pair(246), 3).length, 0, 'antes da fase 4 nao existe');
  assert.equal(lowTunnelCandidates(pair(100), 6).length, 0, 'vao curto demais');
  assert.equal(lowTunnelCandidates(pair(246, { dy: -10 }), 6).length, 0, 'chegada mais alta');
  assert.equal(lowTunnelCandidates(pair(246, { dy: 50 }), 6).length, 0, 'chegada baixa demais');
  const blocked = pair(246);
  blocked.platforms.push({ x: 1300, y: 300, w: 60, h: 20, logicIndex: 30 });
  assert.equal(lowTunnelCandidates(blocked, 6).length, 0, 'plataforma dentro do tunel');
  const level = pair(246);
  installLowTunnels(level, { phase: 6, seedValue: 't' });
  const [ea, eb] = level.platforms;
  assert.ok(ea.lowTunnelExtension > 0 && eb.lowTunnelExtension > 0, 'os dois blocos crescem ate o vao');
  assert.equal(eb.x - (ea.x + ea.w), tunnelGapFor(0));
  const roots = pair(246);
  roots.platforms.forEach(p => { p.type = 'root'; });
  installLowTunnels(roots, { phase: 6, seedValue: 't' });
  assert.ok(roots.platforms.every(p => p.type === 'soil'), 'raiz comum vira bloco de terra no tunel');
  const busy = pair(246);
  busy.platforms[0].type = 'root';
  busy.microbeEncounters = [{ x: 1100, y: 340, platform: busy.platforms[0] }];
  assert.equal(lowTunnelCandidates(busy, 6).length, 0, 'raiz com organismo nao vira terra');
  assert.ok(level.platforms.every(p => p.lowTunnelAnchor), 'chao do tunel nao cede');
});

// --- tunel de fosfato (fases 8-10) -----------------------------------------
function phosphateLevel(pairGap, { dy = 0 } = {}) {
  // charger (raiz) -> a -> b, no trecho procedural p8-challenge (24-35)
  const charger = { x: 300, y: FLOOR, w: 220, h: 60, logicIndex: 25, type: 'root' };
  const a = { x: 700, y: FLOOR, w: 260, h: 60, logicIndex: 26, type: 'soil' };
  const b = { x: 960 + pairGap, y: FLOOR + dy, w: 260, h: 60, logicIndex: 27, type: 'soil' };
  return { platforms: [charger, a, b], exudates: [] };
}

function walkThrough(level, drop, { dash = false } = {}) {
  const sim = createSimulator();
  sim.reset();
  const s = sim.state;
  s.level.platforms = level.platforms;
  s.level.ceilingDrops = level.ceilingDrops;
  s.level.crystals = level.crystals;
  s.level.hazards = [];
  s.player.x = drop.entryPlatform.x + 10;
  s.player.y = drop.floorY - 48;
  s.player.canDash = true;
  s.player.canDoubleJump = true;
  let dashed = false;
  for (let f = 0; f < 400; f++) {
    const keys = { ArrowRight: true };
    if (f % 25 < 4) keys.Space = true;
    if (dash && !dashed && s.player.x + s.player.w >= drop.entryX - 30) { keys.ShiftLeft = true; dashed = true; }
    sim.setInputs(keys);
    sim.step(DT);
    if (s.player.y > FLOOR + 170) return false;
    if (s.player.onGround && s.player.x >= drop.exitX - 4) return true;
  }
  return false;
}

test('fosfato: so a partir da fase 8 e com colonia de Bacillus antes do tunel', () => {
  for (const phase of [6, 7]) {
    const level = phosphateLevel(110);
    installLowTunnels(level, { phase, seedValue: 'f', abilities: { phosphateSolubilization: true } });
    assert.ok(!(level.crystals || []).length, `fase ${phase} sem fosfato em tunel`);
  }
  const level = phosphateLevel(110);
  installLowTunnels(level, { phase: 8, seedValue: 'f', abilities: { phosphateSolubilization: true } });
  const drop = level.ceilingDrops.find(d => d.phosphate);
  assert.ok(drop, 'tunel de fosfato na fase 8');
  const colony = (level.authoredBeneficialColonies || []).find(c => c.type === 'bacillus');
  assert.ok(colony && colony.x < drop.crystal.x, 'Bacillus antes do cristal');
  assert.equal(drop.crystal.y + drop.crystal.h, drop.floorY, 'cristal apoiado no chao');
  assert.equal(drop.crystal.y, drop.y + drop.h, 'cristal encosta no teto');
});

test('fosfato sem vao: bloco comprido unico; cristal bloqueia ate dissolver', () => {
  const level = phosphateLevel(110);
  installLowTunnels(level, { phase: 8, seedValue: 'f', abilities: { phosphateSolubilization: true } });
  const drop = level.ceilingDrops.find(d => d.phosphate);
  if (!drop.merged) return; // a semente escolheu o tipo com vao; coberto no proximo teste
  assert.equal(level.platforms.length, 2, 'os dois blocos viraram um');
  assert.equal(walkThrough(level, drop), false, 'cristal inteiro bloqueia');
  drop.crystal.broken = true;
  assert.equal(walkThrough(level, drop), true, 'dissolvido, passa andando');
});

test('fosfato com vao: dissolver e depois anda -> Dash -> anda', () => {
  const level = phosphateLevel(246);
  installLowTunnels(level, { phase: 8, seedValue: 'f', abilities: { phosphateSolubilization: true } });
  const drop = level.ceilingDrops.find(d => d.phosphate);
  assert.ok(drop && !drop.merged);
  assert.ok(drop.crystal.x + drop.crystal.w <= drop.entryX - LOW_TUNNEL.crystalBeforeEdge + .5, 'corrida livre antes do vao');
  assert.equal(walkThrough(level, drop, { dash: true }), false, 'cristal inteiro bloqueia');
  drop.crystal.broken = true;
  assert.equal(walkThrough(level, drop, { dash: true }), true, 'dissolvido, Dash atravessa');
});
