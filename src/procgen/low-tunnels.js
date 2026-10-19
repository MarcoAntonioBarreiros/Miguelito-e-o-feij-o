// TUNEL BAIXO — obstaculo procedural de Dash (fase 4 em diante).
//
// Um tunel de verdade: chao e teto baixo dos dois lados, e no meio dele um vao
// de zona hostil. A mecanica e ANDA -> DASH -> ANDA (ou anda -> propulsor ->
// anda): o teto fica 12 px acima da cabeca e, sob ele, o salto duplo nao
// funciona (physics.js, underLowTunnel); o Dash, horizontal, cruza o vao; o
// propulsor encosta no teto e desliza de lado.
//
// Calibrado na fisica do jogo (mesmo simulador), chao dos dois lados na mesma
// altura ou a chegada ate 8 px mais baixa, teto 52 px acima do chao:
//   - nenhum pulo atravessa vaos de 130-150 px (0 de 672 combinacoes de
//     tempo de pulo e salto duplo);
//   - o Dash disparado ANDANDO atravessa se apertado em qualquer ponto entre
//     ~40-50 px antes da borda e 16 px depois dela (vao 136-140);
//   - o propulsor atravessa (12 de 12).
//
// So blocos de terra (nunca raiz), como no prototipo. Vao conforme a altura da
// chegada (tunnelGapFor). Se o par da rota tem um vao maior, os dois blocos
// crescem em direcao ao vao (mesma altura; o lado de fora fica onde estava). O teto vive em
// `level.ceilingDrops`; nenhum dos dois entra em `level.platforms` (nao sao
// raiz, suporte de colonia nem alvo de patogeno).

import { createRandom } from './random.js';
import { getPhaseManifest, getSegmentAt } from './campaign-manifest.js';
import { isIntentionalDynamicCrossing } from './generator.js';

export const LOW_TUNNEL = Object.freeze({
  clearance: 60,          // da base do teto ao chao (Miguelito: 48; 12 px de folga)
  gap: 136,               // vao dentro do tunel
  minPairGap: 124,        // vao original minimo do par da rota
  maxLedge: 200,          // maior beirada que o tunel pode criar
  entryCover: 170,        // chao coberto antes do vao
  minEntryCover: 100,
  exitCover: 150,         // chao coberto depois do vao
  minExitCover: 80,
  landingZone: 60,        // chao livre no comeco do bloco de entrada (pouso)
  exitRunway: 40,         // chao livre no fim do bloco de saida
  maxRise: 6,             // chegada mais alta que a entrada (px)
  maxDrop: 40,            // chegada mais baixa que a entrada (px)
  ledgeDepth: 46,         // espessura desenhada/solida da beirada
  blockHeight: 2400,      // sobe ate a superficie: nem o propulsor passa por cima
  minChunkSpacing: 4,
  maxPerPhase: 2,
  firstPhase: 4,
  // tunel de fosfato (fases 8-10): cristal baixo, do chao ao teto
  phosphatePhases: Object.freeze([8, 9, 10]),
  crystalWidth: 66,
  crystalBeforeEdge: 56,  // folga entre o cristal e a borda do vao (corrida do Dash)
  mergedCover: 150,       // teto antes e depois do cristal no tunel sem vao
  mergedMinLength: 360,   // bloco comprido minimo do tunel sem vao
  mergedMaxGap: 300,      // vao original maximo que o bloco comprido fecha
  chargerReach: 3,        // blocos antes do tunel onde vai a colonia de Bacillus
});

function routePlatforms(level) {
  return (level.platforms || [])
    .filter(p => Number.isInteger(p.logicIndex) && p.logicIndex >= 0
      && !p.recovery && !p.mycorrhizaStructure && !p.azospirillumStructure
      && !p.final && !p.oneWay && !p.safetyStep)
    .sort((a, b) => a.x - b.x);
}

// Altura de projeto do chao: raiz doente afunda em jogo (root-health), entao
// vale a base, nao a altura do instante.
function floorOf(p) {
  return Number.isFinite(p.rootBaseY) ? p.rootBaseY : p.y;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pointIn(rect, x, y, pad = 0) {
  return x > rect.x - pad && x < rect.x + rect.w + pad && y > rect.y - pad && y < rect.y + rect.h + pad;
}

// Em que trecho da fase o tunel pode nascer.
function chunkAllowed(phase, chunk) {
  const manifest = getPhaseManifest(phase);
  const segment = getSegmentAt(phase, chunk);
  if (!segment || segment.kind !== 'procedural') return false;
  if (phase === LOW_TUNNEL.firstPhase) {
    const dash = (manifest?.unlockEvents || []).find(e => e.feature === 'dash');
    if (dash && chunk <= dash.eventChunk) return false;
  }
  return true;
}

// Vao dentro do tunel conforme a altura da chegada (dy > 0: mais baixa).
// Calibrado: em cada faixa, 0 pulo atravessa (176 combinacoes) e o Dash
// andando passa em 10-19 de 19 pontos de disparo; propulsor 6 de 6.
export function tunnelGapFor(dy) {
  if (dy < -LOW_TUNNEL.maxRise) return null;
  if (dy <= 2) return 128;
  if (dy <= 8) return 136;
  if (dy <= 16) return 144;
  if (dy <= 24) return 152;
  if (dy <= 32) return 162;
  if (dy <= LOW_TUNNEL.maxDrop) return 172;
  return null;
}

// Raiz comum pode virar bloco de terra para ser chao de tunel; raiz com papel
// (portao, ponte, escada, objetivo, colonia, organismo, checkpoint) nao.
const ROLE_KEY = /gate|host|objective|bridge|ladder|challenge|signature|detour|authored|nitrogen|structure|final|recovery/i;
function referencedPlatforms(level) {
  const set = new Set();
  const add = p => { if (p && typeof p === 'object') set.add(p); };
  for (const e of level.microbeEncounters || []) { add(e.platform); add(e.hostPlatform); add(e.root); }
  for (const c of level.beneficialColonies || []) add(c.platform);
  for (const f of level.biofilms || []) add(f.platform);
  for (const c of level.checkpoints || []) add(c.platform);
  for (const n of level.nitrogenRoots || []) { add(n.hostPlatform); add(n.targetPlatform); add(n.leftPlatform); add(n.rightPlatform); }
  for (const x of level.crystals || []) add(x.platform);
  for (const x of level.allies || []) add(x.platform);
  return set;
}
function convertibleToSoil(p, referenced) {
  if (p.type !== 'root') return true;
  if (referenced.has(p)) return false;
  return !Object.keys(p).some(k => ROLE_KEY.test(k) && p[k]);
}

// Geometria do tunel para o par (a -> b), ou null se nao cabe.
function planFor(a, b) {
  const aRight = a.x + a.w;
  const pairGap = b.x - aRight;
  const floorY = floorOf(a);
  const dy = floorOf(b) - floorY;
  const targetGap = tunnelGapFor(dy);
  if (!targetGap || pairGap < targetGap - 4) return null;
  const ledge = Math.max(0, pairGap - targetGap);
  if (ledge > LOW_TUNNEL.maxLedge) return null;
  // o chao que falta e dividido entre os dois blocos: cada um cresce em
  // direcao ao vao (massa unica, sem emenda)
  const growA = Math.round(ledge / 2);
  const growB = ledge - growA;
  const edgeX = aRight + growA;           // borda do vao (entrada)
  const exitX = b.x - growB;              // borda do vao (saida)
  // teto cobre `entryCover` de chao antes da borda, sem tomar o pouso de a
  const entryStart = Math.max(edgeX - LOW_TUNNEL.entryCover, a.x + LOW_TUNNEL.landingZone);
  if (edgeX - entryStart < LOW_TUNNEL.minEntryCover) return null;
  const exitEnd = Math.min(exitX + LOW_TUNNEL.exitCover, b.x + b.w - LOW_TUNNEL.exitRunway);
  if (exitEnd - exitX < LOW_TUNNEL.minExitCover) return null;
  const bottom = Math.min(floorY, floorOf(b)) - LOW_TUNNEL.clearance;
  return {
    pairGap,
    tunnelGap: pairGap - ledge,
    growA,
    growB,
    edgeX,
    exitX,
    floorY,
    block: { x: entryStart, y: bottom - LOW_TUNNEL.blockHeight, w: exitEnd - entryStart, h: LOW_TUNNEL.blockHeight },
  };
}

// Tunel SEM vao (so fosfato): o par vira um bloco comprido de terra, na altura
// do primeiro; o cristal fica onde era o vao, com teto antes e depois.
function planMerged(a, b) {
  const floorY = floorOf(a);
  if (Math.abs(floorOf(b) - floorY) > LOW_TUNNEL.maxRise) return null;
  const pairGap = b.x - (a.x + a.w);
  if (pairGap < 0 || pairGap > LOW_TUNNEL.mergedMaxGap) return null;
  const right = b.x + b.w;
  if (right - a.x < LOW_TUNNEL.mergedMinLength) return null;
  const crystalX = a.x + a.w + pairGap / 2 - LOW_TUNNEL.crystalWidth / 2;
  const start = Math.max(a.x + LOW_TUNNEL.landingZone, crystalX - LOW_TUNNEL.mergedCover);
  const end = Math.min(right - LOW_TUNNEL.exitRunway, crystalX + LOW_TUNNEL.crystalWidth + LOW_TUNNEL.mergedCover);
  if (crystalX - start < LOW_TUNNEL.minEntryCover || end - (crystalX + LOW_TUNNEL.crystalWidth) < LOW_TUNNEL.minExitCover) return null;
  const bottom = floorY - LOW_TUNNEL.clearance;
  return {
    merged: true,
    pairGap,
    tunnelGap: 0,
    floorY,
    crystalX,
    edgeX: crystalX,
    exitX: crystalX + LOW_TUNNEL.crystalWidth,
    block: { x: start, y: bottom - LOW_TUNNEL.blockHeight, w: end - start, h: LOW_TUNNEL.blockHeight },
  };
}

// O par (a -> b) comporta o tunel? Devolve o candidato ou null.
function candidateFor(level, a, b, { merged, all, referenced, segments, phase }) {
  const plan = merged ? planMerged(a, b) : planFor(a, b);
  if (!plan) return null;
  if (!convertibleToSoil(a, referenced) || !convertibleToSoil(b, referenced)) return null;
  if (segments && (!chunkAllowed(phase, a.logicIndex) || !chunkAllowed(phase, b.logicIndex))) return null;
  if (isIntentionalDynamicCrossing(level, a, b)) return null;
  if (a.nitrogenGate || b.nitrogenGate || a.underdevelopedNitrogenRoot || b.underdevelopedNitrogenRoot) return null;
  // portao de nitrogenio: a raiz subdesenvolvida cresce justamente sobre um
  // vao assim. Nem o par, nem nada que encoste no vao.
  const reserved = (level.nitrogenRoots || []).some(n => [n.hostPlatform, n.targetPlatform, n.leftPlatform, n.rightPlatform]
    .some(q => q === a || q === b));
  if (reserved) return null;
  const { block } = plan;
  // teto, corredor e beirada livres de qualquer outra plataforma
  const corridor = { x: block.x, y: block.y, w: block.w, h: block.h + LOW_TUNNEL.clearance + LOW_TUNNEL.ledgeDepth + 30 };
  if (all.some(p => p !== a && p !== b && overlaps(corridor, p))) return null;
  // nada que precise ser alcancado preso na parte baixa do teto (o bloco
  // sobe ate a superficie; o que voa la em cima nao conta)
  const lowBand = { x: block.x, y: block.y + block.h - 160, w: block.w, h: 160 };
  const blocked = [
    ...(level.allies || []),
    ...(level.checkpoints || []),
    ...(level.crystals || []),
  ].some(o => Number.isFinite(o?.x) && Number.isFinite(o?.y) && pointIn(lowBand, o.x, o.y, 24));
  if (blocked) return null;
  return { a, b, gap: Math.round(plan.pairGap), chunk: a.logicIndex, converts: (a.type === 'root') + (b.type === 'root'), ...plan };
}

/** Pares candidatos, em ordem de rota. Exportado para testes e diagnostico. */
export function lowTunnelCandidates(level, phase, { merged = false } = {}) {
  if (!(phase >= LOW_TUNNEL.firstPhase)) return [];
  const route = routePlatforms(level);
  const ctx = { merged, all: level.platforms || [], referenced: referencedPlatforms(level), segments: true, phase };
  const out = [];
  for (let i = 0; i + 1 < route.length; i++) {
    const c = candidateFor(level, route[i], route[i + 1], ctx);
    if (c) out.push(c);
  }
  return out;
}

// Diretor de salas (fase 10+): o gerador ja reservou o par de cada tunel.
// Instala exatamente esses, sem sorteio de posicao.
function installDirectorTunnels(level, phase, rnd, phosphateOn) {
  const route = routePlatforms(level);
  const all = level.platforms || [];
  const referenced = referencedPlatforms(level);
  const chosen = [];
  const failures = [];
  for (let i = 0; i + 1 < route.length; i++) {
    const a = route[i];
    if (a.tunnelRoomRole !== 'entry') continue;
    const b = route[i + 1];
    if (b.tunnelRoomRole !== 'exit' || b.tunnelRoomId !== a.tunnelRoomId) { failures.push({ id: a.tunnelRoomId, reason: 'par' }); continue; }
    const phosphate = a.tunnelRoomKind === 'phosphateTunnel' && phosphateOn;
    const options = [];
    for (const merged of phosphate ? [true, false] : [false]) {
      const c = candidateFor(level, a, b, { merged, all, referenced, segments: false, phase });
      if (c) options.push({ ...c, phosphate, roomId: a.tunnelRoomId });
    }
    let pick = null;
    while (options.length) {
      const o = options.splice(Math.floor(rnd() * options.length), 1)[0];
      if (o.phosphate && !chargerFor(level, o)) continue;
      pick = o;
      break;
    }
    if (pick) chosen.push(pick);
    else failures.push({ id: a.tunnelRoomId, reason: 'geometria' });
  }
  level.tunnelRoomFailures = failures;
  return chosen;
}

/**
 * Escolhe e instala os tuneis da fase. Deterministico pela semente. Devolve a
 * lista instalada (tambem em `level.ceilingDrops`).
 */
export function installLowTunnels(level, { phase, seedValue = '' , abilities = {} } = {}) {
  level.ceilingDrops = [];
  level.tunnelFloors = [];
  const rnd = createRandom(`${seedValue}:low-tunnel:${phase}`);
  const phosphateOn = LOW_TUNNEL.phosphatePhases.includes(phase)
    && abilities.phosphateSolubilization !== false;
  const directorMode = (level.platforms || []).some(p => p.tunnelRoomRole === 'entry');
  const chosen = directorMode ? installDirectorTunnels(level, phase, rnd, phosphateOn) : pickTunnels(level, phase, rnd, phosphateOn);
  materializeTunnels(level, chosen);
  return level.ceilingDrops;
}

function pickTunnels(level, phase, rnd, phosphateOn) {
  const gapCandidates = lowTunnelCandidates(level, phase);
  const mergedCandidates = phosphateOn ? lowTunnelCandidates(level, phase, { merged: true }) : [];
  const chosen = [];
  const spaced = c => !chosen.some(k => k.a === c.a || k.b === c.a || k.a === c.b
    || Math.abs(k.chunk - c.chunk) < LOW_TUNNEL.minChunkSpacing);

  if (phase === LOW_TUNNEL.firstPhase && gapCandidates.length) {
    // o que ensina: o primeiro par depois do Dash (de preferencia ja de terra)
    const teach = gapCandidates.find(c => !c.converts) || gapCandidates[0];
    chosen.push({ ...teach, teaching: true });
  }
  if (phosphateOn) {
    // um tunel de fosfato garantido: sem vao ou com vao, sorteado entre os que cabem
    const options = [
      ...mergedCandidates.map(c => ({ ...c, phosphate: true })),
      ...gapCandidates.map(c => ({ ...c, phosphate: true })),
    ];
    while (options.length) {
      const pick = options.splice(Math.floor(rnd() * options.length), 1)[0];
      if (!spaced(pick)) continue;
      if (!chargerFor(level, pick)) continue;
      chosen.push(pick);
      break;
    }
  }
  const pool = gapCandidates.slice();
  while (chosen.length < LOW_TUNNEL.maxPerPhase && pool.length) {
    const pick = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    if (!spaced(pick)) continue;
    chosen.push(pick);
  }
  return chosen;
}

function materializeTunnels(level, chosen) {
  chosen.sort((m, n) => m.a.x - n.a.x);
  for (const c of chosen) {
    const drop = {
      ...c.block,
      id: `low-tunnel-${c.chunk}`,
      lowTunnel: true,
      teaching: Boolean(c.teaching),
      phosphate: Boolean(c.phosphate),
      merged: Boolean(c.merged),
      gap: Math.round(c.tunnelGap),
      pairGap: c.gap,
      entryX: c.edgeX,
      exitX: c.exitX,
      floorY: c.floorY,
      logicIndex: c.chunk,
      entryPlatform: c.a,
      exitPlatform: c.merged ? c.a : c.b,
    };
    // chao de tunel e bloco de terra (como no prototipo)
    for (const p of [c.a, c.b]) {
      if (p.type === 'root') { p.type = 'soil'; p.lowTunnelConvertedFromRoot = true; }
    }
    if (c.merged) {
      // um bloco comprido: o primeiro cresce ate o fim do segundo, que sai da fase
      const right = c.b.x + c.b.w;
      c.a.w = right - c.a.x;
      c.a.lowTunnelExtension = right - c.a.x;
      level.platforms.splice(level.platforms.indexOf(c.b), 1);
    } else {
      // os dois blocos de terra crescem ate as bordas do vao (mesma altura;
      // o lado de fora de cada um fica onde estava)
      if (c.growA) { c.a.w += c.growA; c.a.lowTunnelExtension = c.growA; }
      if (c.growB) { c.b.x -= c.growB; c.b.w += c.growB; c.b.lowTunnelExtension = c.growB; }
    }
    level.ceilingDrops.push(drop);
    // os chaos do tunel nao cedem com a saude da raiz
    for (const p of c.merged ? [c.a] : [c.a, c.b]) {
      p.lowTunnelAnchor = true;
      if (Number.isFinite(p.rootBaseY)) { p.y = p.rootBaseY; p.supportOffset = 0; }
    }
    if (c.phosphate) installTunnelCrystal(level, c, drop);
    // exsudato que caiu dentro do bloco desce para baixo dele
    for (const e of level.exudates || []) {
      if (pointIn(drop, e.x, e.y, 6)) e.y = drop.y + drop.h + 22;
    }
  }
}

// Bloco de raiz ate `chargerReach` passos antes do tunel para a colonia de
// Bacillus que carrega a solubilizacao (como o portao de fosfato da fase 10).
function chargerFor(level, c) {
  const route = routePlatforms(level);
  const i = route.indexOf(c.a);
  if (i <= 0) return null;
  const referenced = referencedPlatforms(level);
  for (let k = 1; k <= LOW_TUNNEL.chargerReach && i - k >= 0; k++) {
    const p = route[i - k];
    if (p.lowTunnelAnchor || p.w < 90) continue;
    if (p.type === 'root' || convertibleToSoil(p, referenced)) return p;
  }
  return null;
}

function installTunnelCrystal(level, c, drop) {
  const w = LOW_TUNNEL.crystalWidth;
  const x = c.merged ? c.crystalX : c.edgeX - LOW_TUNNEL.crystalBeforeEdge - w;
  const deposit = {
    id: `low-tunnel-${c.chunk}:phosphate`,
    phosphateDeposit: true,
    lowTunnel: true,
    logicIndex: c.chunk,
    requiredFeature: 'phosphateSolubilization',
    // do chao ao teto: nao ha como pular por cima
    x,
    y: c.floorY - LOW_TUNNEL.clearance,
    w,
    h: LOW_TUNNEL.clearance,
    remainingPhosphate: 1,
    initialPhosphate: 1,
    hp: 1,
    broken: false,
    localAvailablePhosphate: 0,
    hostPlatformId: c.a.platformId || c.a.id || null,
    destinationPlatformId: null,
    routeScope: 'primary',
    routeOwned: false,
    authored: true,
    difficulty: c.merged ? 'low-tunnel' : 'low-tunnel-dash',
    transportRoot: null,
    transportRootLogicIndex: null,
  };
  level.crystals ||= [];
  level.phosphateDeposits ||= [];
  level.availablePhosphatePools ||= [];
  level.phosphateTransportParticles ||= [];
  level.crystals.push(deposit);
  level.phosphateDeposits.push(deposit);
  drop.crystal = deposit;

  const charger = chargerFor(level, c);
  if (charger) {
    if (charger.type !== 'root') { charger.type = 'root'; charger.lowTunnelCharger = true; }
    level.authoredBeneficialColonies = [
      ...(level.authoredBeneficialColonies || []),
      {
        id: `low-tunnel-${c.chunk}-bacillus`,
        type: 'bacillus',
        platform: charger,
        x: charger.x + charger.w * .55,
        y: charger.y - 8,
        sourceCount: 5,
        vigor: 1,
        growth: 1,
        rechargeIntensity: .35,
      },
    ];
    drop.chargerLogicIndex = charger.logicIndex;
  }
}

/** Diagnostico: por que cada par da rota foi recusado. */
export function lowTunnelDiagnostics(level, phase) {
  const route = routePlatforms(level);
  const reasons = {};
  const pairs = [];
  const hit = r => { reasons[r] = (reasons[r] || 0) + 1; };
  for (let i = 0; i + 1 < route.length; i++) {
    const a = route[i], b = route[i + 1];
    const gap = Math.round(b.x - (a.x + a.w));
    const dy = Math.round(floorOf(b) - floorOf(a));
    if (!chunkAllowed(phase, a.logicIndex) || !chunkAllowed(phase, b.logicIndex)) { hit('trecho'); continue; }
    pairs.push(`${gap}/${dy}/${Math.round(a.w)}-${Math.round(b.w)}`);
    if (isIntentionalDynamicCrossing(level, a, b)) { hit('intencional'); continue; }
    const plan = planFor(a, b);
    if (!plan) {
      const dyy = floorOf(b) - floorOf(a);
      hit(gap < 130 ? 'vao<130' : !tunnelGapFor(dyy) ? 'altura' : (dyy < -LOW_TUNNEL.maxRise || dyy > LOW_TUNNEL.maxDrop) ? 'altura' : gap - 136 > LOW_TUNNEL.maxLedge ? 'vao>336' : 'largura');
      continue;
    }
    const corridor = { x: plan.block.x, y: plan.block.y, w: plan.block.w, h: plan.block.h + LOW_TUNNEL.clearance + LOW_TUNNEL.ledgeDepth + 30 };
    if ((level.platforms || []).some(p => p !== a && p !== b && overlaps(corridor, p))) { hit('obstruido'); continue; }
    hit('ok');
  }
  return { reasons, pairs };
}
