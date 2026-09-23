import { H, W } from '../core/constants.js';
import { drawWorldLabel } from './world-label.js';
import { createRhizosphereGeometry } from '../render/rhizosphere-geometry.js';
import { readGeometryPreference } from '../render/geometry-preference.js';
import {
  ROOT_PALETTE, paintRootCondition, paintRootTissue, paintRootTissueVertical,
} from '../render/root-tissue.js';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function platformSeed(platform) {
  const x = Math.round(platform.x || 0);
  const y = Math.round(platform.rootBaseY ?? platform.y ?? 0);
  const w = Math.round(platform.w || 0);
  return Math.abs((x * 73856093) ^ (y * 19349663) ^ (w * 83492791));
}

function pseudo(seed, index) {
  const value = Math.sin(seed * .000013 + index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function roundedPath(ctx, platform, radius) {
  ctx.beginPath();
  ctx.roundRect(platform.x, platform.y, platform.w, platform.h, radius);
}

function drawUpwardHairs(ctx, platform, seed) {
  const hairCount = Math.max(3, Math.min(12, Math.floor(platform.w / 60)));
  const safeCount = Math.max(2, hairCount);
  const margin = platform.w * 0.13;
  const height = platform.h;
  ctx.save();
  ctx.strokeStyle = ROOT_PALETTE.radicle;
  ctx.lineWidth = clamp(height * 0.020, 1.4, 2.6);
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.95;

  for (let i = 0; i < safeCount; i++) {
    const t = safeCount === 1 ? 0.5 : i / (safeCount - 1);
    const startX = platform.x + margin + t * (platform.w - margin * 2) + (pseudo(seed, i + 80) - 0.5) * platform.w * 0.03;
    const startY = platform.y + pseudo(seed, i + 81) * height * 0.07;
    const length = (0.2 + pseudo(seed, i + 82) * 0.15) * height;

    const c1x = startX + (pseudo(seed, i + 83) - 0.5) * 12;
    const c2x = startX + (pseudo(seed, i + 84) - 0.5) * 24;
    const endX = startX + (pseudo(seed, i + 85) - 0.5) * 30;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(c1x, startY - length * 0.3, c2x, startY - length * 0.7, endX, startY - length);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRootVisual(ctx, platform) {
  const seed = platformSeed(platform);
  const radius = platform.final ? 18 : 15;

  // 1. Radículas / Pelos no topo
  drawUpwardHairs(ctx, platform, seed);

  ctx.save();
  roundedPath(ctx, platform, radius);
  ctx.clip();

  // 2. Fundo base
  ctx.fillStyle = ROOT_PALETTE.innerBase;
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
  paintRootTissue(ctx, seed, platform.x, platform.y, platform.w, platform.h);
  paintRootCondition(ctx, platform);

  ctx.restore();

  // Outlining do bloco de raiz
  ctx.save();
  ctx.strokeStyle = ROOT_PALETTE.outline;
  ctx.lineWidth = Math.max(2, platform.h * 0.025);
  roundedPath(ctx, platform, radius);
  ctx.stroke();
  ctx.restore();

  if (platform.fixedObjective) {
    const objectivePulse = .78 + Math.sin(3.2) * .08;
    ctx.save();
    ctx.strokeStyle = `rgba(255,213,111,${objectivePulse})`;
    ctx.fillStyle = 'rgba(255,213,111,.08)';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ffd56f';
    roundedPath(ctx, platform, radius);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd56f';
    ctx.fillRect(platform.x + 12, platform.y - 2, Math.max(24, platform.w - 24), 4);
    ctx.restore();
  }
}

export function createPlatformVisuals({ state }) {

  const SOIL_PALETTE = Object.freeze({
    base: '#3a2115',
    aggregates: ['#472a1b', '#301b11', '#402417'],
    pores: '#1c100a',
    silt: ['#613c28', '#523120'],
    outline: '#24140d',
  });

  function drawOrganicBlobCanvas(ctx, seed, idx, cx, cy, radius, fillStyle, alpha) {
    const sides = Math.floor(5 + pseudo(seed, idx + 1) * 4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = fillStyle;
    ctx.lineWidth = radius * 0.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * TAU;
      const r = radius * (0.6 + pseudo(seed, idx + 10 + i) * 0.6);
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Textura do solo do autor (agregados, poros, grãos de silte/areia) num
  // retângulo. `grain` é a altura de referência que dimensiona os torrões e
  // poros: no bloco antigo é a própria altura da plataforma; na massa de solo
  // continua sendo a altura do topo, para o grão não crescer com a massa.
  function paintSoilTexture(ctx, seed, x, y, width, height, grain = height, withBase = true) {
    const area = width * height;

    if (withBase) {
      // Fundo base
      ctx.fillStyle = SOIL_PALETTE.base;
      ctx.fillRect(x, y, width, height);
    }

    // 1. Macroagregados (Torrões maiores)
    const macroCount = Math.floor(area / 1500);
    for (let i = 0; i < macroCount; i++) {
      const idx = i * 13 + 500;
      const cx = x + pseudo(seed, idx) * width;
      const cy = y + pseudo(seed, idx + 1) * height;
      const r = (0.15 + pseudo(seed, idx + 2) * 0.20) * grain;
      const color = SOIL_PALETTE.aggregates[Math.floor(pseudo(seed, idx + 3) * SOIL_PALETTE.aggregates.length)];
      const alpha = 0.7 + pseudo(seed, idx + 4) * 0.3;
      drawOrganicBlobCanvas(ctx, seed, idx, cx, cy, r, color, alpha);
    }

    // 2. Porosidade (Espaços vazios escuros estruturais)
    const poreCount = Math.floor(area / 2000);
    for (let i = 0; i < poreCount; i++) {
      const idx = i * 17 + 1000;
      const cx = x + pseudo(seed, idx) * width;
      const cy = y + pseudo(seed, idx + 1) * height;
      const r = (0.05 + pseudo(seed, idx + 2) * 0.07) * grain;
      drawOrganicBlobCanvas(ctx, seed, idx, cx, cy, r, SOIL_PALETTE.pores, 0.8);
    }

    // 3. Partículas de Silte / Areia (Incrustações minerais claras)
    const siltCount = Math.floor(area / 800);
    for (let i = 0; i < siltCount; i++) {
      const idx = i * 19 + 2000;
      const cx = x + pseudo(seed, idx) * width;
      const cy = y + pseudo(seed, idx + 1) * height;
      const r = 1.5 + pseudo(seed, idx + 2) * 2.5;
      const color = SOIL_PALETTE.silt[Math.floor(pseudo(seed, idx + 3) * SOIL_PALETTE.silt.length)];
      const alpha = 0.5 + pseudo(seed, idx + 4) * 0.4;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function paintSoilTextureBatched(ctx, seed, x, y, width, height, grain = height, withBase = true) {
    if (typeof Path2D === 'undefined') {
      paintSoilTexture(ctx, seed, x, y, width, height, grain, withBase);
      return;
    }
    const area = width * height;
    if (withBase) {
      ctx.fillStyle = SOIL_PALETTE.base;
      ctx.fillRect(x, y, width, height);
    }
    const flush = buckets => {
      for (const [key, path] of buckets) {
        const [color, alpha] = key.split('|');
        ctx.globalAlpha = Number(alpha);
        ctx.fillStyle = color;
        ctx.fill(path);
      }
      ctx.globalAlpha = 1;
    };
    const blob = (buckets, idx, cx, cy, radius, color, alpha) => {
      const key = `${color}|${(Math.round(alpha * 20) / 20).toFixed(2)}`;
      if (!buckets.has(key)) buckets.set(key, new Path2D());
      const path = buckets.get(key);
      const sides = Math.floor(5 + pseudo(seed, idx + 1) * 4);
      const grow = radius * 0.1;
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * TAU;
        const r = radius * (0.6 + pseudo(seed, idx + 10 + i) * 0.6) + grow;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (i === 0) path.moveTo(px, py);
        else path.lineTo(px, py);
      }
      path.closePath();
    };
    ctx.save();
    const macro = new Map();
    const macroCount = Math.floor(area / 1500);
    for (let i = 0; i < macroCount; i++) {
      const idx = i * 13 + 500;
      const cx = x + pseudo(seed, idx) * width;
      const cy = y + pseudo(seed, idx + 1) * height;
      const r = (0.15 + pseudo(seed, idx + 2) * 0.20) * grain;
      const color = SOIL_PALETTE.aggregates[Math.floor(pseudo(seed, idx + 3) * SOIL_PALETTE.aggregates.length)];
      blob(macro, idx, cx, cy, r, color, 0.7 + pseudo(seed, idx + 4) * 0.3);
    }
    flush(macro);
    const pores = new Map();
    const poreCount = Math.floor(area / 2000);
    for (let i = 0; i < poreCount; i++) {
      const idx = i * 17 + 1000;
      const cx = x + pseudo(seed, idx) * width;
      const cy = y + pseudo(seed, idx + 1) * height;
      const r = (0.05 + pseudo(seed, idx + 2) * 0.07) * grain;
      blob(pores, idx, cx, cy, r, SOIL_PALETTE.pores, 0.8);
    }
    flush(pores);
    const silt = new Map();
    const siltCount = Math.floor(area / 800);
    for (let i = 0; i < siltCount; i++) {
      const idx = i * 19 + 2000;
      const cx = x + pseudo(seed, idx) * width;
      const cy = y + pseudo(seed, idx + 1) * height;
      const r = 1.5 + pseudo(seed, idx + 2) * 2.5;
      const color = SOIL_PALETTE.silt[Math.floor(pseudo(seed, idx + 3) * SOIL_PALETTE.silt.length)];
      const alpha = 0.5 + pseudo(seed, idx + 4) * 0.4;
      const key = `${color}|${(Math.round(alpha * 20) / 20).toFixed(2)}`;
      if (!silt.has(key)) silt.set(key, new Path2D());
      const path = silt.get(key);
      path.moveTo(cx + r, cy);
      path.arc(cx, cy, r, 0, TAU);
    }
    flush(silt);
    ctx.restore();
  }

  function drawSoil(ctx, platform) {
    const seed = platformSeed(platform);
    const radius = 10;

    ctx.save();
    roundedPath(ctx, platform, radius);
    ctx.clip();
    paintSoilTexture(ctx, seed, platform.x, platform.y, platform.w, platform.h);
    ctx.restore();

    // Outlining do bloco de solo
    ctx.save();
    ctx.strokeStyle = SOIL_PALETTE.outline;
    ctx.lineWidth = Math.max(2, platform.h * 0.025);
    roundedPath(ctx, platform, radius);
    ctx.stroke();
    ctx.restore();
  }

  // Visual de geometria (massas de solo, raízes laterais, teto). `?geo=0`
  // volta aos blocos para comparação. Só desenho: nada disso vira colisor.
  const geometryEnabled = readGeometryPreference(globalThis.location);
  const geometry = createRhizosphereGeometry({
    state,
    painters: {
      paintSoilTexture: paintSoilTextureBatched,
      paintRootTissue,
      paintRootTissueVertical,
      paintRootCondition,
      soilPalette: SOIL_PALETTE,
      rootPalette: ROOT_PALETTE,
    },
  });
  if (typeof window !== 'undefined') {
    window.miguelitoGeometry = {
      enabled: geometryEnabled,
      get lastRenderMs() { return geometry.lastRenderMs; },
    };
  }

  function drawTraversalDebug(ctx) {
    const encounters = state.level.traversalEncounters || [];
    if (!state.level.traversalDebugVisible || !encounters.length) return;
    const colors = { shared: '#63ef9d', primary: '#64b7ff', optional: '#ffd75c' };
    ctx.save();
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2;
    for (const encounter of encounters) {
      const blocks = (state.level.platforms || [])
        .filter(platform => platform.encounterInstanceId === encounter.encounterInstanceId);
      for (const role of ['primary', 'optional']) {
        const key = role === 'primary' ? 'primaryRouteOrder' : 'optionalRouteOrder';
        const route = blocks
          .filter(platform => platform.routeRole === role || platform.routeRole === 'shared')
          .sort((left, right) => left[key] - right[key]);
        ctx.strokeStyle = colors[role];
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        route.forEach((platform, index) => {
          const x = platform.x + platform.w / 2;
          const y = platform.y - 14;
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const platform of blocks) {
        ctx.strokeStyle = colors[platform.routeRole] || '#fff';
        ctx.strokeRect(platform.x - 2, platform.y - 2, platform.w + 4, platform.h + 4);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillText(
          `${platform.blockRole}:${platform.platformId.split(':').at(-1)}`,
          platform.x + platform.w / 2,
          platform.y - 21,
        );
      }
      for (const reward of (state.level.exudates || []).filter(item => (
        item.encounterInstanceId === encounter.encounterInstanceId
      ))) {
        ctx.strokeStyle = '#ffd75c';
        ctx.beginPath();
        ctx.arc(reward.x, reward.y, 22, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawOptionalDetourDebug(ctx) {
    if (
      !state.level.traversalDebugVisible
      || !state.level.optionalDetourPlaytestMode
    ) return;
    const detour = state.level.optionalDetours?.[0];
    if (!detour) return;
    const byId = id => (state.level.platforms || []).find(platform => (
      (platform.platformId ?? platform.id) === id
    ));
    const groups = [
      { ids: [detour.startPlatformId], color: '#ffcf56' },
      { ids: [detour.preEntryPlatformId], color: '#65d7ff' },
      { ids: [detour.accessLandingId], color: '#ff71e8' },
      { ids: detour.transitionPlatformIds || [], color: '#ff9f59' },
      { ids: detour.cruisePlatformIds || [], color: '#b889ff' },
      { ids: [detour.rejoinPlatformId], color: '#74f39a' },
    ];
    ctx.save();
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 6]);
    for (const group of groups) {
      ctx.strokeStyle = group.color;
      for (const id of group.ids) {
        const platform = byId(id);
        if (!platform) continue;
        ctx.strokeRect(platform.x - 5, platform.y - 5, platform.w + 10, platform.h + 10);
        if (platform.detourModuleId === 'hard-movement-combo') {
          const gap = Number(platform.movementGap);
          const deltaY = Number(platform.verticalDeltaY);
          ctx.save();
          ctx.setLineDash([]);
          ctx.font = '600 12px ui-monospace, SFMono-Regular, Consolas, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = group.color;
          ctx.fillText(
            `${platform.optionalDetourSection} | ${platform.movementRecipeId}`
              + ` | ${platform.verticalIntent}`
              + ` | ${platform.validatedPrimitiveId || 'INVALID'}`
              + ` | gap ${Number.isFinite(gap) ? Math.round(gap) : '-'}`
              + ` | dY ${Number.isFinite(deltaY) ? Math.round(deltaY) : '-'}`,
            platform.x + platform.w / 2,
            platform.y - 10,
          );
          ctx.restore();
        }
      }
    }
    const host = byId(detour.startPlatformId);
    const access = byId(detour.accessLandingId);
    if (host && access) {
      ctx.strokeStyle = '#d8bb78';
      ctx.beginPath();
      ctx.moveTo(host.x + host.w - 26, host.y - 6);
      ctx.lineTo(access.x - 26, access.y + 16);
      ctx.stroke();
    }
    const viewports = detour.hypotheticalViewports || {};
    for (const [key, viewport] of Object.entries(viewports)) {
      ctx.strokeStyle = key === 'zoom1' ? '#46e8ff' : '#ff69c8';
      ctx.lineWidth = 2;
      ctx.setLineDash(key === 'zoom1' ? [14, 8] : [5, 7]);
      ctx.strokeRect(viewport.x, viewport.y, viewport.w, viewport.h);
    }
    ctx.restore();
  }

  // Portões de subida da ROTA PRINCIPAL. Desenha o desnível pedido entre
  // hospedeiro e degrau, e o estado da escada que o abre. Nada aqui vira
  // colisor: é só `ctx`.
  function drawAscentGateDebug(ctx) {
    if (!state.level.traversalDebugVisible) return;
    const gates = state.level.routeGates || [];
    if (!gates.length) return;
    ctx.save();
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    for (const gate of gates) {
      const { host, destination } = gate;
      if (!host || !destination) continue;
      const ladder = (state.level.azospirillumRootLadders || [])
        .find(entry => entry.ascentGateId === gate.id || entry.host === host) || null;
      const developed = gate.kind === 'azospirillumAscent'
        ? Boolean(ladder?.developed)
        : gate.kind === 'phosphateWall'
          ? Boolean(gate.deposit?.broken)
          : false;
      // Uma cor por tipo: num print de playtest é isso que diz qual desafio
      // está na tela sem precisar ler o painel.
      const idle = gate.kind === 'mycorrhizaBridge' ? '#c99bff'
        : gate.kind === 'phosphateWall' ? '#ffd75c'
        : '#72e8dd';
      ctx.strokeStyle = developed ? '#8ef5b0' : idle;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 3;
      ctx.setLineDash(developed ? [] : [9, 6]);
      const x = host.x + host.w - 10;
      ctx.beginPath();
      ctx.moveTo(x, host.y - 6);
      ctx.lineTo(x, destination.y - 6);
      ctx.stroke();
      ctx.setLineDash([]);
      // Contorno do degrau: o que a rota PEDIU, para conferir contra o que
      // apareceu na tela.
      ctx.lineWidth = 2;
      ctx.strokeRect(destination.x, destination.y, destination.w, destination.h);
      const estado = gate.kind === 'mycorrhizaBridge'
        ? `PONTE AM ${gate.gap}px — inocular micorriza na borda`
        : gate.kind === 'phosphateWall'
          ? `PAREDE DE P — ${developed ? 'aberta' : 'carregar pulso e disparar'}`
          : !ladder ? `PORTAO +${gate.rise}px — SEM ESCADA`
            : developed ? `PORTAO +${gate.rise}px — escada madura`
            : ladder.progress > 0 ? `PORTAO +${gate.rise}px — escada ${Math.round(ladder.progress * 100)}%`
            : `PORTAO +${gate.rise}px — inocular Azospirillum aqui`;
      ctx.fillText(estado, x + 8, destination.y - 12);
    }
    ctx.restore();
  }

  // CHEGADA DE PATOGENO — o que se ve e o patogeno, nao um marcador
  //
  // A versao anterior desenhava a INFORMACAO: elipse crescendo, retangulo
  // pontilhado em volta da raiz-alvo, contagem regressiva em numeros. Isso
  // dizia ao jogador onde olhar sem nunca mostrar a coisa em si, e o "aviso"
  // aparecia num lugar onde ainda nao havia nada.
  //
  // Agora o aviso E o deslocamento. O que atravessa o solo e a propria entidade
  // que vai infectar: os J2 da Meloidogyne (desenhados pelo ciclo dela, porque
  // ja sao J2 de verdade desde a origem) e, aqui, o inoculo ambiental da
  // Ralstonia. A janela de reacao continua existindo — ela so deixou de ser um
  // relogio e virou distancia.
  //
  // Os marcadores geometricos nao foram apagados: foram movidos para o debug,
  // onde medir posicao alvo e tempo restante e util.

  function drawRalstoniaTravelInoculum(ctx) {
    const travelling = state.level.ralstoniaTravelInoculum || [];
    if (!travelling.length) return;
    const time = state.time || 0;
    ctx.save();
    for (const entry of travelling) {
      const x = Number(entry.x);
      const y = Number(entry.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const progress = clamp(entry.progress || 0, 0, 1);
      const phase = entry.wobblePhase || 0;
      // Direcao do deslocamento: da origem para onde ele esta agora. Serve para
      // orientar os bastonetes, que assim "nadam" em vez de flutuar de lado.
      const dx = x - (entry.originX ?? x);
      const dy = y - (entry.originY ?? y);
      const heading = Math.hypot(dx, dy) > 4 ? Math.atan2(dy, dx) : 0;

      // Rastro: o solo revolvido atras do inoculo. Some rapido, entao nao vira
      // uma linha desenhada — e um sulco recente.
      ctx.globalAlpha = .16;
      ctx.fillStyle = '#8c5a4a';
      for (let step = 1; step <= 5; step++) {
        const back = step * 13;
        const trailX = x - Math.cos(heading) * back;
        const trailY = y - Math.sin(heading) * back + Math.sin(time * 3 + step + phase) * 2.5;
        ctx.beginPath();
        ctx.arc(trailX, trailY, 5.5 - step * .7, 0, TAU);
        ctx.fill();
      }

      // Halo de mucilagem: a suspensao bacteriana carrega agua do solo junto.
      const swell = 1 + Math.sin(time * 4.6 + phase) * .08;
      ctx.globalAlpha = .22 + progress * .16;
      ctx.fillStyle = '#c96a54';
      ctx.beginPath();
      ctx.ellipse(x, y, 17 * swell, 12 * swell, heading, 0, TAU);
      ctx.fill();

      // As celulas. Bastonetes curtos, o mesmo formato do foco instalado — e a
      // mesma bacteria, so que ainda em transito.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(heading);
      for (let cell = 0; cell < 5; cell++) {
        const spin = time * 1.7 + cell * 1.31 + phase;
        const cellX = Math.cos(spin) * (5 + cell * 1.6);
        const cellY = Math.sin(spin * 1.4) * (4 + cell * .9);
        ctx.save();
        ctx.translate(cellX, cellY);
        ctx.rotate(Math.sin(spin * .8) * .9);
        ctx.globalAlpha = .72 + Math.sin(spin) * .18;
        ctx.fillStyle = cell % 2 ? '#ffb59d' : '#ff8368';
        ctx.beginPath();
        ctx.roundRect(-4.6, -1.9, 9.2, 3.8, 1.9);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Os marcadores geometricos, agora so no debug (Tab).
   *
   * Origem, trajetoria prevista, raiz-alvo e as pontuacoes dos candidatos. Fora
   * do debug nada disso aparece: no jogo normal a leitura e o proprio patogeno
   * atravessando o solo.
   */
  function drawPathogenArrivalDebug(ctx) {
    if (!state.level.traversalDebugVisible) return;
    const reading = state.level.pathogenArrival;
    if (!reading) return;
    ctx.save();
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Pontuacao dos candidatos do patogeno em rota (ou da Meloidogyne, quando
    // nao ha nada a caminho): da para ver POR QUE o alvo foi aquele.
    const pathogen = reading.warning?.pathogen || 'meloidogyne';
    const candidates = reading.candidateScores?.[pathogen] || [];
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index];
      const best = index === 0;
      ctx.globalAlpha = best ? .95 : .5;
      ctx.fillStyle = best ? '#ffe08a' : '#9fb8d0';
      ctx.fillText(
        `#${candidate.logicIndex} s=${candidate.score.toFixed(2)}`
        + ` nuvem=${candidate.cloud.toFixed(2)} dist=${candidate.distance.toFixed(2)}`
        + ` tec=${candidate.tissue.toFixed(2)} les=${candidate.lesion.toFixed(2)}`,
        candidate.x - 90,
        candidate.y - 30 - (best ? 12 : 0),
      );
    }

    const warning = reading.warning;
    if (warning) {
      const color = warning.pathogen === 'ralstonia' ? '#ff7a6b' : '#ffc46b';
      const root = warning.targetRoot;
      const targetX = warning.targetX;
      const targetY = warning.targetY;

      // Trajetoria prevista, amostrada com a mesma funcao que move a entidade.
      ctx.globalAlpha = .6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(warning.originX, warning.originY);
      ctx.lineTo(warning.travelPoint?.x ?? targetX, warning.travelPoint?.y ?? targetY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();

      // Raiz-alvo.
      if (root) {
        ctx.globalAlpha = .85;
        ctx.strokeRect(root.x - 6, root.y - 10, root.w + 12, root.h + 20);
      }
      ctx.setLineDash([]);

      // Origem.
      ctx.globalAlpha = .9;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(warning.originX, warning.originY, 6, 0, TAU);
      ctx.fill();
      ctx.fillText(
        `${warning.pathogen} <- ${warning.originType}`
        + ` ${Math.round((warning.travelProgress || 0) * 100)}%`
        + ` ${Math.max(0, warning.timeRemaining).toFixed(1)}s`,
        warning.originX + 10,
        warning.originY - 8,
      );
    }
    ctx.restore();
  }

  // Overlay do §21. Desenha limites de zona, nós do grafo, arestas normais, a
  // aresta bloqueada, o vão intencional e a saída por queda. Nada aqui cria
  // colisor: é só `ctx`.
  function drawTopologyT1Debug(ctx) {
    if (!state.level.traversalDebugVisible) return;
    const detour = (state.level.optionalDetours || [])
      .find(entry => entry.implementationStage === 'T1');
    if (!detour) return;
    const overlay = detour.topologyOverlay || {};
    const byId = id => (state.level.platforms || []).find(platform => (
      (platform.platformId ?? platform.id) === id
    ));
    ctx.save();
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';

    // Limites das zonas.
    const corridor = overlay.corridor || {};
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    for (const zone of overlay.zones || []) {
      const exit = byId(zone.exitPlatformId);
      if (!exit) continue;
      const x = exit.x + exit.w;
      ctx.strokeStyle = zone.challengeId ? '#ff8ae2' : '#5fd0ff';
      ctx.beginPath();
      ctx.moveTo(x, (corridor.top ?? exit.y - 320));
      ctx.lineTo(x, (corridor.bottom ?? exit.y + 220));
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(
        `${zone.role}/${zone.verticalIntent}${zone.challengeId ? ` [${zone.challengeId}]` : ''}`,
        x + 6,
        (corridor.top ?? exit.y - 320) + 16,
      );
    }

    // Nós do grafo: faixas, não posições finais — por isso retângulos ocos.
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(160, 200, 255, .55)';
    for (const node of overlay.nodes || []) {
      const [left, right] = node.xRange || [];
      const [top, bottom] = node.yRange || [];
      if (![left, right, top, bottom].every(Number.isFinite)) continue;
      ctx.strokeRect(left, top, right - left, bottom - top);
    }

    // Arestas.
    ctx.setLineDash([]);
    for (const edge of overlay.edges || []) {
      const from = byId(edge.from);
      const to = byId(edge.to);
      if (!from || !to) continue;
      if (edge.role === 'movement') ctx.strokeStyle = '#8ef5b0';
      else if (edge.role === 'drop-rejoin') ctx.strokeStyle = '#ffd75c';
      else ctx.strokeStyle = '#ff5b6e';
      ctx.lineWidth = edge.role === 'movement' ? 2 : 4;
      ctx.beginPath();
      ctx.moveTo(from.x + from.w - 8, from.y - 10);
      ctx.lineTo(to.x + 8, to.y - 10);
      ctx.stroke();
      if (edge.role !== 'movement') {
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillText(
          edge.blockedUntil || edge.role,
          from.x + from.w + 10,
          from.y - 18,
        );
      }
    }

    // Corredor de queda: reserva VAZIA. Desenhado só como contorno e texto —
    // nada aqui vira colisor, e é justamente por ser vazio que ele existe.
    const dropCorridor = overlay.dropCorridor;
    if (dropCorridor) {
      ctx.setLineDash([14, 8]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffd75c';
      ctx.strokeRect(
        dropCorridor.left,
        dropCorridor.top,
        dropCorridor.right - dropCorridor.left,
        dropCorridor.bottom - dropCorridor.top,
      );
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffd75c';
      const textX = dropCorridor.left + 10;
      let textY = dropCorridor.top + 18;
      const lines = [
        overlay.dropRejoinDirect
          ? 'DROP REJOIN — QUEDA DIRETA'
          : 'DROP REJOIN — QUEDA INDIRETA',
        `PLATAFORMAS NO CORREDOR: ${overlay.dropRejoinPlatformCount ?? '-'}`,
        `SEPARACAO MINIMA DA ROTA FACIL: ${overlay.minimumPrimaryClearance ?? '-'} px`,
      ];
      for (const line of lines) {
        ctx.fillText(line, textX, textY);
        textY += 15;
      }
    }

    // Vãos intencionais.
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    for (const gap of overlay.intentionalGaps || []) {
      const bounds = gap.bounds;
      if (!bounds) continue;
      ctx.strokeStyle = gap.kind === 'mycorrhiza-bridge-gap' ? '#ff5b6e' : '#ffa552';
      ctx.strokeRect(
        bounds.left,
        bounds.top,
        bounds.right - bounds.left,
        bounds.bottom - bounds.top,
      );
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(gap.kind, bounds.left + 6, bounds.top - 4);
    }
    ctx.restore();
  }

  function drawWorld(ctx) {
    ctx.save();
    ctx.translate(-state.cameraX, 0);
    const visibleWidth = state.visibleWorldWidth || state.viewportWidth || W;
    const visibleHeight = state.visibleWorldHeight || state.viewportHeight || H;
    const cameraY = state.cameraY || 0;
    const margin = 220;
    const viewLeft = (state.cameraX || 0) - margin;
    const viewRight = (state.cameraX || 0) + visibleWidth + margin;
    const viewTop = cameraY - margin;
    const viewBottom = cameraY + visibleHeight + margin;
    if (geometryEnabled) {
      geometry.draw(ctx, {
        left: (state.cameraX || 0) - 60,
        right: (state.cameraX || 0) + visibleWidth + 60,
        top: cameraY - 60,
        bottom: cameraY + visibleHeight + 60,
      }, platformSeed);
    } else {
      for (const platform of state.level.platforms || []) {
        if (platform.mycorrhizaStructure || platform.azospirillumStructure) continue;
        if (
          platform.x + platform.w < viewLeft
          || platform.x > viewRight
          || platform.y + platform.h < viewTop
          || platform.y > viewBottom
        ) continue;
        // Recovery desligada e recovery desligada, sem excecao. A versao anterior
        // tinha `&& !platform.safetyStep`, e por isso um degrau da antiga rede
        // anti-softlock continuava visivel mesmo com o toggle ativo. Defesa contra
        // niveis salvos antigos, uso do Phase Lab e residuos.
        //
        // Uma recovery PROMOVIDA (ex.: hospedeiro da escada de Azospirillum)
        // recebe `recovery = false` e por isso continua aqui, visivel e normal.
        if (platform.recovery && state.recoveryPlatformsDisabled) continue;

        if (platform.type === 'soil') drawSoil(ctx, platform);
        else drawRootVisual(ctx, platform);
      }
    }

    for (const label of state.level.worldLabels || []) {
      drawWorldLabel(ctx, label.x, label.y, label.text, label.options);
    }
    drawTraversalDebug(ctx);
    drawOptionalDetourDebug(ctx);
    drawTopologyT1Debug(ctx);
    drawAscentGateDebug(ctx);
    drawRalstoniaTravelInoculum(ctx);
    drawPathogenArrivalDebug(ctx);

    ctx.restore();
  }

  function renderLabel(ctx) {
    // Rótulos adicionais, se houver
  }

  return {
    drawWorld,
    renderWorld: drawWorld,
    renderLabel,
  };
}
