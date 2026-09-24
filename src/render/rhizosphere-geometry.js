// GEOMETRIA DA RIZOSFERA — só desenho
// ===================================
//
// Troca a cara de "blocos de videogame" por paisagem de solo, seguindo o
// protótipo de referência (drawSolids / buildSolidSprite / drawVerticalRoot /
// drawHorizontalRoot):
//
// · plataforma de solo = topo de uma massa contínua que desce até o fundo da
//   tela, com parede irregular; o vão entre duas massas vira barranco;
// · plataforma de raiz = agregado de rizobainha (solo preso à raiz por pelos,
//   mucilagem e exsudatos) com a raiz lateral visível correndo pela borda de
//   cima; a lateral sai, fina e sinuosa, da raiz principal mais próxima;
// · raízes principais descem da superfície (colo da cinemática final), cada
//   uma com um feijoeiro no colo;
// · faixa de solo entre a superfície e a caverna (teto).
//
// Nada aqui é lido pela física, pelo gerador ou pelos validadores: o colisor
// continua sendo o retângulo da plataforma. Por isso a borda de cima de toda
// forma desenhada fica exatamente em `platform.y` — é onde o pé pousa.
//
// As texturas (células da raiz, agregados/poros/grãos do solo) são as do
// autor e chegam prontas por `painters`; este módulo só decide a forma.

import { drawBeanPlant } from './bean-plant-visual.js';
import { drawRootTube, growPlantRoots, seededRandom } from './root-architecture.js';
import { GEOMETRY_ENABLED } from './geometry-preference.js';
import { FINAL_ROOT_COLLAR_OFFSET, FINAL_ROOT_SCALE } from './final-root-visual.js';
import {
  LINK_ROOT_PALETTE, MUTED_ROOT_PALETTE, ROOT_PALETTE, clamp, paintRootCondition, paintRootTissue, pseudo, setTissueCull,
} from './root-tissue.js';

const TAU = Math.PI * 2;

function hash2(x, y) {
  return Math.abs((Math.round(x) * 73856093) ^ (Math.round(y) * 19349663)) + 1;
}

// Curva suave passando pelos pontos médios (smoothPath do protótipo). Pontos
// consecutivos na mesma altura produzem trecho reto — é assim que o topo
// pisável fica plano.
function traceSmooth(ctx, points) {
  const n = points.length;
  ctx.beginPath();
  ctx.moveTo((points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2);
  for (let i = 1; i <= n; i++) {
    const p = points[i % n];
    const q = points[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

export function geometryEnabled() {
  return GEOMETRY_ENABLED;
}

// Linha de baixo do teto desenhada neste quadro (mundo), para a luz ficar
// por trás da camada de solo. null quando não há teto.
let currentCeiling = null;
export function currentCeilingLine() {
  return currentCeiling;
}

// Espessura da raiz visível sobre um bloco 'root' (14–20 px).
export function rootBandThickness(platform) {
  return clamp((platform?.h || 56) * .28, 14, 20);
}

// RETÂNGULO VISUAL DA RAIZ
// Efeitos que "caem na raiz" (nódulos, galhas, Ralstonia, estado de saúde)
// calculam posição como `root.y + fração * root.h`. Com a rizobainha, a raiz é
// só a faixa de cima do bloco: estes dois helpers levam essas contas para a raiz
// visível. Só para desenho — física e sistemas continuam lendo a plataforma.
export function visibleRootRect(platform) {
  if (!GEOMETRY_ENABLED || !platform || platform.type === 'soil') return platform;
  const band = rootBandThickness(platform);
  if (!(platform.h > band)) return platform;
  const rect = Object.create(platform);
  rect.h = band;
  return rect;
}

export function rootEffectY(platform, y) {
  if (!GEOMETRY_ENABLED || !platform || platform.type === 'soil' || !(platform.h > 0)) return y;
  const band = rootBandThickness(platform);
  if (y <= platform.y || y >= platform.y + platform.h + 40) return y;
  const depth = Math.min(y - platform.y, platform.h);
  return platform.y + depth * band / platform.h + Math.max(0, y - platform.y - platform.h);
}

// Folga entre o topo das plataformas e o teto desenhado. O pulo simples sobe
// ~96 px e o Miguelito tem 48: 230 deixa a cabeça sempre longe da faixa.
const CEILING_CLEARANCE = 230;
const DOUBLE_JUMP_EXTRA = 140;
// Alcance horizontal de cada plataforma na altura do teto: cobre o vão que o
// jogador atravessa pulando a partir dela.
const CEILING_REACH = 300;
const CEILING_STEP = 36;
// Espaço livre mínimo acima de uma plataforma que está embaixo de outra massa.
const UNDER_HEADROOM = 170;

// Superfície mínima acima do teto: a faixa de solo tem pelo menos 40 px
// (topLimit) e o relevo do teto oscila ~16 px.
const SURFACE_HEADROOM = 70;

// SUPERFÍCIE DA FASE (colo das plantas). Parte do colo da raiz-objetivo, mas
// sobe o quanto for preciso para o teto ficar a `clearance` do bloco mais alto
// — os blocos nunca descem. Calculada uma vez por fase (e por alcance de pulo),
// para não se mexer quando blocos crescem. Grava `goal.collarY`, e a raiz final
// e a cinemática acompanham.
export function rhizosphereSurfaceY(level, unlocks) {
  const goal = level?.goal;
  if (!goal || !Number.isFinite(Number(goal.y))) return null;
  const clearance = CEILING_CLEARANCE + (unlocks?.doubleJump ? DOUBLE_JUMP_EXTRA : 0);
  const memo = level.rhizosphereSurface;
  if (memo && memo.clearance === clearance) return memo.y;
  let top = Infinity;
  for (const platform of level.platforms || []) {
    if (platform.mycorrhizaStructure || platform.azospirillumStructure) continue;
    top = Math.min(top, Number(platform.y));
  }
  const base = Number(goal.y) + FINAL_ROOT_COLLAR_OFFSET;
  const y = Number.isFinite(top) ? Math.min(base, top - clearance - SURFACE_HEADROOM) : base;
  level.rhizosphereSurface = { clearance, y };
  goal.collarY = y;
  return y;
}

export function createRhizosphereGeometry({ state, painters }) {
  const { paintSoilTexture, soilPalette, rootPalette } = painters;

  // CACHE DO QUE NÃO SE MEXE
  // Solo, teto, torrões e o corpo das raízes são desenhados pelo mesmo código
  // procedural, UMA vez, numa tela em memória (2× a escala da câmera, para não
  // perder nitidez) e depois só copiados. O que anima — pelos balançando,
  // radicelas do teto, plantas, estado de saúde da raiz, brilho do objetivo —
  // continua sendo desenhado a cada quadro. Sem DOM (testes), desenha direto.
  const drawCache = new Map();
  let cacheFrame = 0;
  const CACHE_MAX_ENTRIES = 320;
  const canCache = typeof document !== 'undefined' && typeof document.createElement === 'function';

  function cached(ctx, key, box, paint) {
    if (!canCache || typeof ctx.getTransform !== 'function') { paint(ctx); return; }
    const m = ctx.getTransform();
    const q = Math.ceil(Math.max(1, Math.hypot(m.a, m.b)) * 2 * 4) / 4;
    let entry = drawCache.get(key);
    if (!entry || entry.q !== q) {
      const cw = Math.max(1, Math.ceil(box.w * q));
      const ch = Math.max(1, Math.ceil(box.h * q));
      if (cw * ch > 12e6) { paint(ctx); return; }
      const canvas = entry?.canvas || document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const g = canvas.getContext('2d');
      g.setTransform(q, 0, 0, q, -box.x * q, -box.y * q);
      paint(g);
      entry = { canvas, q, x: box.x, y: box.y, w: cw / q, h: ch / q };
      drawCache.set(key, entry);
    }
    entry.frame = cacheFrame;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(entry.canvas, entry.x, entry.y, entry.w, entry.h);
    ctx.restore();
  }

  function trimCache() {
    if (drawCache.size <= CACHE_MAX_ENTRIES) return;
    const old = [...drawCache.entries()].filter(([, e]) => e.frame !== cacheFrame).sort((a, b) => a[1].frame - b[1].frame);
    for (const [key] of old.slice(0, drawCache.size - CACHE_MAX_ENTRIES)) drawCache.delete(key);
  }

  const FULL_VIEW = Object.freeze({ left: -1e9, right: 1e9, top: -1e9, bottom: 1e9 });

  function solidPlatforms() {
    return (state.level?.platforms || []).filter(platform => !(
      platform.mycorrhizaStructure
      || platform.azospirillumStructure
      || (platform.recovery && state.recoveryPlatformsDisabled)
    ));
  }

  // ---------------------------------------------------------------- teto ----

  function ceilingClearance() {
    const unlocks = state.campaign?.unlocks || {};
    return CEILING_CLEARANCE + (unlocks.doubleJump ? DOUBLE_JUMP_EXTRA : 0);
  }

  // Linha de baixo do teto em x. Depende só das plataformas (nunca da câmera),
  // então não "nada" quando a câmera anda.
  function ceilingLineAt(x, platforms, clearance, topLimit) {
    let best = Infinity;
    let nearest = null;
    let nearestDistance = Infinity;
    for (const platform of platforms) {
      const left = platform.x - CEILING_REACH;
      const right = platform.x + platform.w + CEILING_REACH;
      const distance = Math.max(left - x, x - right, 0);
      if (distance < nearestDistance) { nearest = platform; nearestDistance = distance; }
      if (x < left || x > right) continue;
      // Some suave nas pontas do alcance, para o teto não fazer degrau.
      const edge = Math.min(x - left, right - x);
      const lift = edge < 120 ? (120 - edge) * .55 : 0;
      best = Math.min(best, platform.y - clearance - lift);
    }
    // Fora do alcance de qualquer plataforma (antes do começo, depois do fim),
    // o teto continua na altura da mais próxima: a superfície não fica sem solo.
    if (!Number.isFinite(best) && nearest) best = nearest.y - clearance - 66;
    if (!Number.isFinite(best)) return null;
    const bump = (pseudo(hash2(Math.floor(x / CEILING_STEP), 7), 3) - .5) * 14 + Math.sin(x * .013) * 9;
    return Math.max(topLimit, best + bump);
  }

  // A faixa vai da superfície (linha do colo) até a linha do teto. Acima da
  // superfície fica o céu da cinemática final, que ela nunca cobre.
  function ceilingLine(x0, x1, platforms, clearance, topLimit) {
    const first = Math.floor((x0 - 60) / CEILING_STEP);
    const last = Math.ceil((x1 + 60) / CEILING_STEP);
    const line = [];
    for (let i = first; i <= last; i++) {
      const x = i * CEILING_STEP;
      const y = ceilingLineAt(x, platforms, clearance, topLimit);
      if (y !== null) line.push([x, y]);
    }
    return line;
  }

  // Faixa do teto (preenchimento, textura, sombra da face de baixo, contorno).
  function paintCeilingBand(ctx, line, top) {
    const leftX = line[0][0];
    const rightX = line[line.length - 1][0];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(leftX, top);
    ctx.lineTo(rightX, top);
    ctx.lineTo(rightX, line[line.length - 1][1]);
    for (let i = line.length - 1; i > 0; i--) {
      const p = line[i];
      const q = line[i - 1];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.lineTo(leftX, line[0][1]);
    ctx.closePath();
    ctx.fillStyle = soilPalette.base;
    ctx.fill();
    ctx.clip();
    // Textura em ladrilhos presos ao mundo: o grão não desliza com a câmera.
    // Cada coluna de ladrilhos só desce até onde o teto chega nela.
    const tileW = 180;
    const tileH = 62;
    const tx0 = Math.floor(leftX / tileW);
    const tx1 = Math.ceil(rightX / tileW);
    const ty0 = Math.floor(top / tileH);
    for (let tx = tx0; tx <= tx1; tx++) {
      let columnDeep = -Infinity;
      for (const [px, py] of line) {
        if (px >= tx * tileW - CEILING_STEP && px <= (tx + 1) * tileW + CEILING_STEP) columnDeep = Math.max(columnDeep, py);
      }
      if (!Number.isFinite(columnDeep)) continue;
      const ty1 = Math.ceil(columnDeep / tileH);
      for (let ty = ty0; ty <= ty1; ty++) {
        paintSoilTexture(ctx, hash2(tx * 3 + 11, ty * 5 + 3), tx * tileW, ty * tileH, tileW, tileH, tileH, false);
      }
    }
    // A face de baixo do teto, voltada para o túnel, fica um pouco mais escura.
    const traceLine = () => {
      ctx.beginPath();
      ctx.moveTo(line[0][0], line[0][1]);
      for (let i = 1; i < line.length; i++) {
        const p = line[i - 1];
        const q = line[i];
        ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
    };
    ctx.strokeStyle = 'rgba(10,5,3,.34)';
    ctx.lineWidth = 34;
    traceLine();
    ctx.stroke();
    paintBurrow(ctx, line, top);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = soilPalette.outline;
    ctx.lineWidth = 3;
    traceLine();
    ctx.stroke();
    ctx.restore();
  }

  // Túnel de minhoca (bioporo) atravessando a camada de solo, por onde o
  // Miguelito entra na rizosfera: parede lisa e escura (drilosfera), com a boca
  // aberta na superfície e na caverna.
  function burrowX() {
    const x = Number(state.level?.introBurrowX);
    return Number.isFinite(x) ? x : null;
  }

  function paintBurrow(ctx, line, top) {
    const bx = burrowX();
    if (bx === null || bx < line[0][0] || bx > line[line.length - 1][0]) return;
    let bottom = top + 60;
    for (let i = 1; i < line.length; i++) {
      if (line[i][0] >= bx) {
        const [x0, y0] = line[i - 1];
        const [x1, y1] = line[i];
        bottom = y0 + (y1 - y0) * ((bx - x0) / Math.max(1, x1 - x0));
        break;
      }
    }
    const half = 24;
    const wobble = y => Math.sin(y * .05) * 3;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(bx - half - 6, top - 2);
      for (let y = top; y <= bottom + 16; y += 8) ctx.lineTo(bx - half + wobble(y), y);
      for (let y = bottom + 16; y >= top; y -= 8) ctx.lineTo(bx + half + wobble(y + 30), y);
      ctx.lineTo(bx + half + 6, top - 2);
      ctx.closePath();
    };
    ctx.save();
    path();
    const inside = ctx.createLinearGradient(bx - half, 0, bx + half, 0);
    inside.addColorStop(0, '#120906');
    inside.addColorStop(.5, '#070403');
    inside.addColorStop(1, '#120906');
    ctx.fillStyle = inside;
    ctx.fill();
    // Drilosfera: revestimento liso e mais escuro nas paredes.
    ctx.strokeStyle = 'rgba(60,34,22,.9)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,104,70,.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  const CEILING_CHUNK = 512;

  // A faixa vai da superfície (linha do colo) até a linha do teto. Acima da
  // superfície fica o céu da cinemática final, que ela nunca cobre.
  function drawCeiling(ctx, view, platforms, surface) {
    if (!platforms.length) return false;
    // Com propulsão o jogador voa até o limite do mundo: não há onde pôr teto.
    if (state.campaign?.unlocks?.jetpack) return false;
    const clearance = ceilingClearance();
    const topLimit = surface + 40;
    const line = ceilingLine(view.left, view.right, platforms, clearance, topLimit);
    if (line.length < 2) return false;
    currentCeiling = line;
    let deepest = -Infinity;
    for (const point of line) deepest = Math.max(deepest, point[1]);
    // Acima da câmera: existe, só não aparece.
    if (deepest < view.top - 10) return true;

    const firstChunk = Math.floor((view.left - 60) / CEILING_CHUNK);
    const lastChunk = Math.floor((view.right + 60) / CEILING_CHUNK);
    for (let chunk = firstChunk; chunk <= lastChunk; chunk++) {
      const x0 = chunk * CEILING_CHUNK - 2;
      const x1 = (chunk + 1) * CEILING_CHUNK + 2;
      const chunkLine = ceilingLine(x0, x1, platforms, clearance, topLimit);
      if (chunkLine.length < 2) continue;
      let chunkDeep = -Infinity;
      for (const point of chunkLine) chunkDeep = Math.max(chunkDeep, point[1]);
      const box = { x: x0, y: surface - 4, w: x1 - x0, h: chunkDeep - surface + 30 };
      cached(ctx, `ceil:${chunk}:${Math.round(surface)}:${clearance}:${Math.round(burrowX() ?? -1)}`, box, g => {
        g.save();
        g.beginPath();
        g.rect(x0, surface - 4, x1 - x0, box.h);
        g.clip();
        paintCeilingBand(g, chunkLine, surface);
        g.restore();
      });
    }

    // Radicelas finas pendendo do teto (balançam: a cada quadro).
    ctx.save();
    ctx.strokeStyle = rootPalette.radicle;
    ctx.globalAlpha = .55;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (let i = 1; i < line.length - 1; i++) {
      const seed = hash2(Math.round(line[i][0] / CEILING_STEP), 29);
      if (pseudo(seed, 1) < .55) continue;
      const x = line[i][0] + (pseudo(seed, 2) - .5) * CEILING_STEP;
      const y = line[i][1] - 3;
      const len = 10 + pseudo(seed, 3) * 26;
      const sway = Math.sin((state.time || 0) * 1.1 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + sway, y + len * .6, x + sway * 1.6 + (pseudo(seed, 4) - .5) * 10, y + len);
      ctx.stroke();
    }
    ctx.restore();
    return true;
  }

  // ------------------------------------------------------- massa de solo ----

  // Onde a massa termina embaixo: no fundo da tela, ou acima de outra
  // plataforma que esteja debaixo dela (o espaço de quem anda lá fica livre).
  function massBottom(platform, platforms, floor) {
    let bottom = floor;
    for (const other of platforms) {
      if (other === platform) continue;
      if (other.y <= platform.y + platform.h) continue;
      if (other.x >= platform.x + platform.w - 4 || other.x + other.w <= platform.x + 4) continue;
      bottom = Math.min(bottom, other.y - UNDER_HEADROOM);
    }
    return Math.max(bottom, platform.y + platform.h);
  }

  // Quanto a massa pode se alargar para cada lado, embaixo: 45% do vão até o
  // vizinho. O barranco se estreita em V para baixo mas nunca fecha — o fundo
  // (zona letal) continua à vista.
  function flareLimits(platform, platforms) {
    let gapLeft = Infinity;
    let gapRight = Infinity;
    for (const other of platforms) {
      if (other === platform || Math.abs(other.y - platform.y) > 320) continue;
      if (other.x + other.w <= platform.x + 2) gapLeft = Math.min(gapLeft, platform.x - (other.x + other.w));
      if (other.x >= platform.x + platform.w - 2) gapRight = Math.min(gapRight, other.x - (platform.x + platform.w));
    }
    const limit = gap => clamp(Number.isFinite(gap) ? gap * .45 : 80, 0, 80);
    return { left: limit(gapLeft), right: limit(gapRight) };
  }

  function massOutline(platform, bottom, seed, flare) {
    const { x, y, w, h } = platform;
    // A parte de cima do barranco fica no prumo do colisor; o alargamento só
    // começa abaixo do topo, fora do caminho de quem pula o vão.
    const flareStart = y + h + 10;
    const flareAt = (py, max) => max * clamp((py - flareStart) / 160, 0, 1);
    const floating = bottom <= platform.y + platform.h + 1;
    const points = [];
    const rightWall = [];
    const leftWall = [];
    // Topo: fica em `y` (o colisor). Só o grumo das quinas desce um pouco.
    points.push([x + 1, y + 12]);
    points.push([x + 4, y + 2]);
    for (let px = x + 14; px < x + w - 14; px += 18) points.push([px, y]);
    points.push([x + w - 4, y + 2]);
    points.push([x + w - 1, y + 12]);
    // Paredes do barranco: irregulares e, na altura dos pulos, sempre para
    // DENTRO do colisor. Ondulação lenta + ressaltos.
    const step = 22;
    const wall = (index, side) => 1 + (Math.sin(index * .55 + seed * .01 + side * 2.1) * .5 + .5) * 7
      + pseudo(seed, (side ? 300 : 500) + index) * 7;
    let i = 0;
    for (let py = y + 28; py < bottom; py += step, i++) {
      points.push([x + w - wall(i, 1) + flareAt(py, flare.right), py]);
      rightWall.push(points[points.length - 1]);
    }
    if (floating) {
      // Agregado suspenso: fundo arredondado e irregular.
      for (let px = x + w - 10, k = 0; px > x + 10; px -= 20, k++) {
        points.push([px, bottom + 2 + pseudo(seed, 400 + k) * 8]);
      }
    } else {
      points.push([x + w - 2 + flare.right, bottom + 40]);
      points.push([x + 2 - flare.left, bottom + 40]);
    }
    const rows = Math.floor((bottom - (y + 28)) / step);
    for (let row = rows; row >= 0; row--) {
      const py = y + 28 + row * step;
      points.push([x + wall(row, 0) - flareAt(py, flare.left), py]);
      leftWall.push(points[points.length - 1]);
    }
    return { points, walls: [rightWall, leftWall] };
  }

  function drawSoilMass(ctx, platform, platforms, view, floor, seed) {
    const bottom = massBottom(platform, platforms, floor);
    if (platform.y > view.bottom || bottom < view.top) return;
    const floating = bottom <= platform.y + platform.h + 1;
    const flare = floating ? { left: 0, right: 0 } : flareLimits(platform, platforms);
    const { points, walls } = massOutline(platform, bottom, seed, flare);
    const { x, y, w, h } = platform;
    const wideX = x - flare.left;
    const wideW = w + flare.left + flare.right;

    ctx.save();
    traceSmooth(ctx, points);
    ctx.fillStyle = soilPalette.base;
    ctx.fill();
    ctx.clip();
    // Topo: a mesma textura e densidade de antes, no mesmo retângulo.
    paintSoilTexture(ctx, seed, x, y, w, h, h, false);
    // Corpo: ladrilhos do tamanho do topo, cada um com a sua semente, desenhados
    // só onde a câmera vê.
    const firstRow = Math.max(1, Math.floor((view.top - y) / h));
    const lastRow = Math.ceil((Math.min(view.bottom, bottom + 40) - y) / h);
    for (let row = firstRow; row <= lastRow; row++) {
      paintSoilTexture(ctx, seed + row * 7919, wideX, y + row * h, wideW, h, h, false);
    }
    // Quanto mais fundo, mais escuro: a massa lê como volume, não como parede chapada.
    const depth = ctx.createLinearGradient(0, y + 20, 0, y + 380);
    depth.addColorStop(0, 'rgba(12,6,4,0)');
    depth.addColorStop(1, 'rgba(12,6,4,.55)');
    ctx.fillStyle = depth;
    ctx.beginPath();
    ctx.moveTo(wideX - 4, y + 20);
    ctx.lineTo(wideX + wideW + 4, y + 20);
    ctx.lineTo(wideX + wideW + 4, bottom + 44);
    ctx.lineTo(wideX - 4, bottom + 44);
    ctx.fill();
    // Paredes do barranco: sombra rente à borda, acompanhando a parede.
    ctx.strokeStyle = 'rgba(14,7,4,.32)';
    ctx.lineWidth = 20;
    ctx.lineJoin = 'round';
    for (const wall of walls) {
      if (wall.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(wall[0][0], wall[0][1] - 18);
      for (const point of wall) ctx.lineTo(point[0], point[1]);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    traceSmooth(ctx, points);
    ctx.strokeStyle = soilPalette.outline;
    ctx.lineWidth = Math.max(2, h * .025);
    ctx.stroke();
    // Borda de pisar: linha clara de silte e grumos soltos sobre ela.
    ctx.strokeStyle = soilPalette.silt[0];
    ctx.globalAlpha = .75;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 1.5);
    ctx.lineTo(x + w - 5, y + 1.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    let k = 0;
    for (let px = x + 7; px < x + w - 7; px += 10 + pseudo(seed, 700 + k) * 20, k++) {
      ctx.fillStyle = pseudo(seed, 720 + k) < .35 ? soilPalette.silt[0] : soilPalette.aggregates[0];
      ctx.beginPath();
      ctx.arc(px, y - .5 + pseudo(seed, 740 + k), 1.4 + pseudo(seed, 760 + k) * 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------- raízes e plantas ----
  //
  // Cada bloco 'root' é um agregado de rizobainha pendurado numa lateral fina
  // que sai da raiz principal mais próxima. As principais descem da superfície
  // (a mesma linha do colo usada pela cinemática final) e levam um feijoeiro no
  // colo. Tudo aqui é derivado das plataformas a cada quadro: nada é guardado no
  // nível e nada vira colisor.

  // Distância máxima entre a principal e a ponta mais próxima de um bloco.
  const PLANT_REACH = 380;
  // Distância máxima entre duas plantas vizinhas ao longo da fase.
  const PLANT_SPACING = 720;
  const PLANT_MIN_GAP = 220;
  // Mesma espessura do caule do feijoeiro no colo (40 × escala da planta).
  const MAIN_ROOT_WIDTH = 14;

  function surfaceLine(platforms) {
    const goal = state.level?.goal;
    if (goal && Number.isFinite(Number(goal.y))) return rhizosphereSurfaceY(state.level, state.campaign?.unlocks);
    let top = Infinity;
    for (const platform of platforms) top = Math.min(top, platform.y);
    return Number.isFinite(top) ? top - 360 : 0;
  }

  // Um ponto no vão ao lado do bloco, para a principal descer livre (barranco).
  function gapSpot(block, side, platforms) {
    let neighbor = null;
    for (const other of platforms) {
      if (other === block) continue;
      if (side < 0 && other.x + other.w <= block.x + 2) {
        if (!neighbor || other.x + other.w > neighbor.x + neighbor.w) neighbor = other;
      }
      if (side > 0 && other.x >= block.x + block.w - 2) {
        if (!neighbor || other.x < neighbor.x) neighbor = other;
      }
    }
    if (!neighbor) return side < 0 ? block.x - 36 : block.x + block.w + 36;
    const gap = side < 0 ? block.x - (neighbor.x + neighbor.w) : neighbor.x - (block.x + block.w);
    if (gap < 34) return null;
    return side < 0 ? block.x - gap / 2 : block.x + block.w + gap / 2;
  }

  function distanceToBlock(block, x) {
    if (x < block.x) return block.x - x;
    if (x > block.x + block.w) return x - (block.x + block.w);
    return 0;
  }

  function rootLayout(platforms) {
    const surface = surfaceLine(platforms);
    const goal = state.level?.goal;
    const blocks = platforms.filter(platform => platform.type !== 'soil').sort((a, b) => a.x - b.x);
    const plants = [];
    if (goal && Number.isFinite(Number(goal.x))) plants.push({ x: Number(goal.x), goal: true });
    const farFromOthers = x => plants.every(plant => Math.abs(plant.x - x) >= PLANT_MIN_GAP * .5);

    for (const block of blocks) {
      if (plants.some(plant => distanceToBlock(block, plant.x) <= PLANT_REACH)) continue;
      let x = gapSpot(block, -1, platforms);
      if (x === null || !farFromOthers(x)) x = gapSpot(block, 1, platforms) ?? x ?? block.x - 20;
      plants.push({ x });
    }

    // Plantas extras onde a fase ficaria sem nenhuma, sempre num vão.
    const sorted = [...platforms].sort((a, b) => a.x - b.x);
    if (sorted.length) {
      const start = sorted[0].x;
      const end = Math.max(...sorted.map(platform => platform.x + platform.w));
      const gaps = [];
      for (let i = 1; i < sorted.length; i++) {
        const left = sorted[i - 1].x + sorted[i - 1].w;
        if (sorted[i].x - left >= 40) gaps.push((left + sorted[i].x) / 2);
      }
      let guard = 0;
      while (guard++ < 40) {
        const xs = [start - PLANT_SPACING * .35, ...plants.map(plant => plant.x), end + PLANT_SPACING * .35]
          .sort((a, b) => a - b);
        let added = false;
        for (let i = 1; i < xs.length; i++) {
          if (xs[i] - xs[i - 1] <= PLANT_SPACING) continue;
          const middle = (xs[i] + xs[i - 1]) / 2;
          const spot = gaps
            .filter(x => x > xs[i - 1] + PLANT_MIN_GAP && x < xs[i] - PLANT_MIN_GAP)
            .sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))[0] ?? middle;
          plants.push({ x: spot });
          added = true;
          break;
        }
        if (!added) break;
      }
    }

    const clearance = ceilingClearance();
    const links = [];
    for (const block of blocks) {
      let plant = plants[0];
      for (const candidate of plants) {
        if (distanceToBlock(block, candidate.x) < distanceToBlock(block, plant.x)) plant = candidate;
      }
      if (!plant) continue;
      const side = plant.x <= block.x + block.w / 2 ? -1 : 1;
      const band = rootBandThickness(block);
      const entryX = side < 0 ? block.x : block.x + block.w;
      const entryY = block.y + band / 2;
      const dx = Math.abs(entryX - plant.x);
      const ceiling = ceilingLineAt(plant.x, platforms, clearance, surface + 40) ?? surface + 60;
      // Arco baixo e suave. Num vão estreito (principal a poucos px do bloco)
      // a ligação sai bem mais de cima: quase horizontal ali, ela emendaria os
      // blocos numa linha contínua e o vão sumiria.
      const drop = dx < 90 ? 75 : clamp(dx * .3, 18, 80);
      let attachY = entryY - drop;
      attachY = Math.max(attachY, ceiling + 22, surface + 60);
      attachY = Math.min(attachY, entryY - 8);
      // Vão livre do lado da ponta: a coifa só sai para fora se couber sem
      // encostar no vizinho (senão ela emendaria os dois blocos).
      let tipGap = Infinity;
      for (const other of platforms) {
        if (other === block || Math.abs(other.y - block.y) > 160) continue;
        if (side < 0 && other.x >= block.x + block.w - 2) tipGap = Math.min(tipGap, other.x - (block.x + block.w));
        if (side > 0 && other.x + other.w <= block.x + 2) tipGap = Math.min(tipGap, block.x - (other.x + other.w));
      }
      links.push({ block, plant, side, band, entryX, entryY, attachY, tipGap });
    }

    for (const [index, plant] of plants.entries()) {
      plant.seed = hash2(Math.round(plant.x), 41 + index);
      const deepest = links.filter(link => link.plant === plant)
        .reduce((max, link) => Math.max(max, link.entryY), -Infinity);
      plant.tipY = Number.isFinite(deepest)
        ? deepest + 110 + pseudo(plant.seed, 1) * 40
        : surface + 330 + pseudo(plant.seed, 1) * 120;
    }
    return { surface, plants, links };
  }

  // Tubo a partir de uma linha central e das larguras em cada ponto.
  function traceTube(ctx, centers, widths, capBulge = .3) {
    const left = [];
    const right = [];
    for (let i = 0; i < centers.length; i++) {
      const prev = centers[Math.max(0, i - 1)];
      const next = centers[Math.min(centers.length - 1, i + 1)];
      const tx = next[0] - prev[0];
      const ty = next[1] - prev[1];
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      const half = widths[i] / 2;
      left.push([centers[i][0] + nx * half, centers[i][1] + ny * half]);
      right.push([centers[i][0] - nx * half, centers[i][1] - ny * half]);
    }
    const last = centers.length - 1;
    const prev = centers[Math.max(0, last - 1)];
    const tx = centers[last][0] - prev[0];
    const ty = centers[last][1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (const point of left) ctx.lineTo(point[0], point[1]);
    const bulge = widths[last] * capBulge + 3;
    ctx.quadraticCurveTo(
      centers[last][0] + tx / len * bulge * 2, centers[last][1] + ty / len * bulge * 2,
      right[last][0], right[last][1],
    );
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    return { left, right };
  }

  function drawPlant(ctx, plant, surface, view) {
    if (plant.goal) return; // o feijoeiro da raiz-objetivo é o da cinemática
    if (surface < view.top - 260 || surface > view.bottom + 20) return;
    drawBeanPlant(ctx, {
      collarX: plant.x,
      collarY: surface,
      scale: FINAL_ROOT_SCALE * .9,
      plantState: 1,
      growth: 1,
      time: (state.time || 0) + pseudo(plant.seed, 3) * 7,
    });
  }

  // --------------------------------------- agregado de rizobainha ----

  function aggregateOutline(platform, seed) {
    const { x, y, w, h } = platform;
    const points = [];
    points.push([x + 2, y + 8]);
    points.push([x + 6, y + 1]);
    for (let px = x + 14; px < x + w - 14; px += 18) points.push([px, y]);
    points.push([x + w - 6, y + 1]);
    points.push([x + w - 2, y + 8]);
    points.push([x + w - 1 - pseudo(seed, 11) * 5, y + h * .38]);
    points.push([x + w - 3 - pseudo(seed, 12) * 7, y + h * .66]);
    // Base desfeita: borda de baixo em torrões irregulares.
    for (let px = x + w - 10, k = 0; px > x + 10; px -= 15, k++) {
      points.push([px, y + h * (.74 + pseudo(seed, 20 + k) * .26)]);
    }
    points.push([x + 3 + pseudo(seed, 13) * 7, y + h * .66]);
    points.push([x + 1 + pseudo(seed, 14) * 5, y + h * .38]);
    return points;
  }

  // A raiz visível do bloco: entra pelo lado da principal, corre pela borda de
  // cima (o topo dela é o topo do bloco) e sai na outra ponta com a coifa
  // curvada para baixo.
  function blockRootCenters(link) {
    const { block, side, band } = link;
    const y = block.y + band / 2;
    const entryX = side < 0 ? block.x : block.x + block.w;
    const exitX = side < 0 ? block.x + block.w : block.x;
    const dir = -side; // sentido de crescimento, da entrada para a ponta
    const capOut = clamp(band * 1.4, 18, 28);
    const centers = [];
    const widths = [];
    // Vão largo: coifa curvando para fora, como no protótipo. Vão estreito:
    // dobra rente à borda, sem avançar no vão.
    const outward = (link.tipGap ?? Infinity) >= capOut * 3 + 40;
    const straightEnd = exitX - dir * (outward ? 8 : capOut + 6);
    const straightLen = Math.abs(straightEnd - (entryX + side * 8));
    const steps = Math.max(2, Math.ceil(straightLen / 12));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      centers.push([entryX + side * 8 + dir * straightLen * t, y]);
      // Na entrada ainda tem a espessura da lateral de ligação.
      widths.push(i === 0 ? band * .72 : band * (1 - t * .15));
    }
    const p0 = [straightEnd, y];
    const p1 = outward ? [exitX + dir * capOut * .75, y] : [exitX - dir * 6, y];
    const p2 = outward ? [exitX + dir * capOut, y + capOut * .95] : [exitX - dir * 3, y + capOut * 1.1];
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const u = 1 - t;
      centers.push([
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
      ]);
      widths.push(band * (.85 - t * .3));
    }
    return { centers, widths, dir, exitX, entryX };
  }

  function drawAggregate(ctx, link, seed) {
    const { block } = link;
    const { x, y, w, h } = block;
    const band = link.band;
    const points = aggregateOutline(block, seed);
    const time = state.time || 0;
    const key = `agg:${seed}:${Math.round(x)}:${Math.round(y)}:${Math.round(w)}:${Math.round(h)}`;

    cached(ctx, `${key}:body`, { x: x - 6, y: y - 6, w: w + 12, h: h + 46 }, ctx => {
    // Corpo de solo com a textura do autor.
    ctx.save();
    traceSmooth(ctx, points);
    ctx.fillStyle = soilPalette.base;
    ctx.fill();
    ctx.clip();
    paintSoilTexture(ctx, seed, x, y, w, h, Math.min(h, 62), false);
    const base = ctx.createLinearGradient(0, y + band, 0, y + h);
    base.addColorStop(0, 'rgba(12,6,4,0)');
    base.addColorStop(1, 'rgba(12,6,4,.34)');
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.moveTo(x - 2, y + band);
    ctx.lineTo(x + w + 2, y + band);
    ctx.lineTo(x + w + 2, y + h + 4);
    ctx.lineTo(x - 2, y + h + 4);
    ctx.fill();
    ctx.restore();
    ctx.save();
    traceSmooth(ctx, points);
    ctx.strokeStyle = soilPalette.outline;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Grãos soltos embaixo da base.
    ctx.save();
    const grains = Math.floor(w / 14);
    const grainColors = new Map();
    for (let i = 0; i < grains; i++) {
      const gx = x + 8 + pseudo(seed, 60 + i) * (w - 16);
      const gy = y + h * .8 + pseudo(seed, 90 + i) * (h * .2 + 14);
      const color = pseudo(seed, 120 + i) < .4 ? soilPalette.silt[1] : soilPalette.aggregates[i % 3];
      if (!grainColors.has(color)) grainColors.set(color, []);
      grainColors.get(color).push([gx, gy, 1.2 + pseudo(seed, 150 + i) * 2.2]);
    }
    for (const [color, list] of grainColors) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const [gx, gy, r] of list) { ctx.moveTo(gx + r, gy); ctx.arc(gx, gy, r, 0, TAU); }
      ctx.fill();
    }
    ctx.restore();
    });

    const { centers, widths, dir, exitX } = blockRootCenters(link);
    let tubeMinX = Infinity; let tubeMaxX = -Infinity; let tubeMaxY = -Infinity;
    for (const [cx, cy] of centers) { tubeMinX = Math.min(tubeMinX, cx); tubeMaxX = Math.max(tubeMaxX, cx); tubeMaxY = Math.max(tubeMaxY, cy); }
    const tubeBox = {
      x: Math.min(tubeMinX, x) - band - 8, y: y - band - 8,
      w: Math.max(tubeMaxX, x + w) - Math.min(tubeMinX, x) + band * 2 + 16, h: tubeMaxY - y + band * 3 + 16,
    };
    // Pelos radiculares no terço perto da ponta: entram no solo do bloco e
    // alguns saem pela base.
    const hairStart = exitX - dir * w / 3;
    ctx.save();
    ctx.strokeStyle = rootPalette.radicle;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1;
    // Todos os pelos com o mesmo estilo: um caminho por nível de opacidade.
    const hairsIn = [];
    const hairsOut = [];
    for (let k = 0; k < 40; k++) {
      const hx = hairStart + dir * k * 6;
      if ((hx - exitX) * dir > -4) break;
      const r = pseudo(seed, 200 + k);
      const sway = Math.sin(time * 1.5 + hx * .05) * 1.5;
      const from = y + band - 2;
      const len = 8 + r * (h * .5);
      hairsIn.push([hx, from, hx + sway, from + len * .6, hx + sway * 1.5 + dir * 2, from + len]);
      if (r > .55) {
        const out = y + h * (.82 + r * .1);
        hairsOut.push([hx + 2, out, hx + 2 + sway, out + 8, hx + 3 + sway * 1.6, out + 12 + r * 8]);
      }
    }
    for (const [alpha, list] of [[.75, hairsIn], [.6, hairsOut]]) {
      if (!list.length) continue;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (const [ax, ay, cx, cy, bx, by] of list) { ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cx, cy, bx, by); }
      ctx.stroke();
    }
    ctx.restore();

    // A raiz: textura celular do autor, contraste pleno.
    const minX = Math.min(...centers.map(point => point[0])) - band;
    const maxX = Math.max(...centers.map(point => point[0])) + band;
    const maxY = Math.max(...centers.map(point => point[1])) + band;
    cached(ctx, `${key}:tissue`, tubeBox, ctx => {
      ctx.save();
      traceTube(ctx, centers, widths, .45);
      ctx.fillStyle = rootPalette.innerBase;
      ctx.fill();
      ctx.clip();
      paintRootTissue(ctx, seed, minX, y, maxX - minX, band);
      // A ponta que dobra para baixo continua em córtex.
      paintRootTissue(ctx, seed + 17, minX, y + band, maxX - minX, maxY - y - band + 4);
      ctx.restore();
    });
    // Estado de saúde muda durante a fase: por quadro.
    ctx.save();
    traceTube(ctx, centers, widths, .45);
    ctx.clip();
    paintRootCondition(ctx, visibleRootRect(block));
    ctx.restore();
    cached(ctx, `${key}:top`, tubeBox, ctx => {
    ctx.save();
    traceTube(ctx, centers, widths, .45);
    ctx.clip();
    // Coifa mais clara e translúcida.
    const tip = centers[centers.length - 1];
    const cap = ctx.createRadialGradient(tip[0], tip[1], 1, tip[0], tip[1], band * .9);
    cap.addColorStop(0, 'rgba(250,236,205,.55)');
    cap.addColorStop(1, 'rgba(250,236,205,0)');
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], band, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    traceTube(ctx, centers, widths, .45);
    ctx.strokeStyle = rootPalette.outline;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    // Parcialmente enterrada: grumos do agregado grudados na borda de baixo.
    ctx.save();
    const crumbs = [[soilPalette.aggregates[0], []], [soilPalette.base, []]];
    for (let k = 0; k < 60; k++) {
      const px = x + 10 + k * 11 + pseudo(seed, 300 + k) * 6;
      if (px > x + w - 10) break;
      if (pseudo(seed, 360 + k) < .35) continue;
      crumbs[pseudo(seed, 420 + k) < .5 ? 0 : 1][1].push([px, y + band - 1 + pseudo(seed, 480 + k) * 2, 2 + pseudo(seed, 540 + k) * 2.6]);
    }
    for (const [color, list] of crumbs) {
      if (!list.length) continue;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const [cx, cy, r] of list) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU); }
      ctx.fill();
    }
    ctx.restore();
    });

    if (block.fixedObjective) {
      const entryX = link.side < 0 ? x : x + w;
      const exitX = link.side < 0 ? x + w + 30 : x - 30;
      const glow = ctx.createLinearGradient(entryX, 0, exitX, 0);
      glow.addColorStop(0, 'rgba(255,213,111,0)');
      glow.addColorStop(.18, 'rgba(255,213,111,.55)');
      glow.addColorStop(1, 'rgba(255,213,111,.55)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = glow;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(255,213,111,.8)';
      ctx.shadowBlur = 14;
      ctx.globalAlpha = .45;
      ctx.lineWidth = band * 1.1;
      ctx.beginPath();
      ctx.moveTo(centers[0][0], centers[0][1]);
      for (const [px, py] of centers) ctx.lineTo(px, py);
      ctx.stroke();
      ctx.restore();
    }
  }


  // ------------------------------------------------ superfície e céu ----

  function drawSky(ctx, view, surface) {
    // Na cinemática o céu é o da cena final (mesma região, mesmas cores).
    if (state.level?.finalRootPulse !== undefined) return;
    if (view.top >= surface) return;
    const top = view.top - 40;
    ctx.save();
    const sky = ctx.createLinearGradient(0, surface - 900, 0, surface);
    sky.addColorStop(0, '#2572b8');
    sky.addColorStop(.55, '#4ea1e6');
    sky.addColorStop(1, '#99e0f8');
    ctx.fillStyle = sky;
    ctx.beginPath();
    ctx.moveTo(view.left - 20, top); ctx.lineTo(view.right + 20, top);
    ctx.lineTo(view.right + 20, surface + 2); ctx.lineTo(view.left - 20, surface + 2);
    ctx.fill();
    // Fileiras distantes de feijão.
    ctx.fillStyle = 'rgba(62,120,58,.5)';
    for (let x = Math.floor((view.left - 30) / 22) * 22; x < view.right + 30; x += 22) {
      const k = pseudo(hash2(Math.round(x / 22), 5), 1);
      const hh = 7 + k * 9;
      const xx = x + k * 6;
      ctx.beginPath();
      ctx.moveTo(xx - .6, surface); ctx.lineTo(xx + .6, surface); ctx.lineTo(xx + .6, surface - hh); ctx.lineTo(xx - .6, surface - hh);
      ctx.fill();
      for (let j = -1; j <= 1; j++) {
        ctx.beginPath();
        ctx.ellipse(xx + j * 4, surface - hh - 2 + Math.abs(j) * 2, 3.4, 1.8, j * .7, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Linha do chão: palhada e tufos, presos ao mundo.
  function drawGround(ctx, view, surface) {
    if (surface < view.top - 40 || surface > view.bottom + 10) return;
    ctx.save();
    ctx.lineCap = 'round';
    const colors = ['#d9b36a', '#b58d4e', '#e8cf93', '#9c7a40'];
    const mouth = burrowX();
    for (let x = Math.floor((view.left - 20) / 4) * 4; x < view.right + 20; x += 4) {
      if (mouth !== null && Math.abs(x - mouth) < 30) continue;
      const k = hash2(x, 17);
      if (pseudo(k, 1) < .25) continue;
      const len = 7 + pseudo(k, 2) * 16;
      const ang = (pseudo(k, 3) - .5) * .7;
      ctx.strokeStyle = colors[Math.floor(pseudo(k, 4) * colors.length)];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, surface - pseudo(k, 5) * 3);
      ctx.lineTo(x + Math.cos(ang) * len, surface - pseudo(k, 5) * 3 + Math.sin(ang) * len * .3 - 1);
      ctx.stroke();
      if (pseudo(k, 6) > .86) {
        ctx.strokeStyle = pseudo(k, 7) > .5 ? '#5f9a3c' : '#77ad48';
        ctx.lineWidth = 1.2;
        for (let g = -2; g <= 2; g++) {
          ctx.beginPath();
          ctx.moveTo(x + g * 1.5, surface);
          ctx.quadraticCurveTo(x + g * 2.5, surface - 6, x + g * 3.5, surface - 9 - pseudo(k, 8 + g) * 5);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ mundo ----

  let architecture = { key: '', plants: [] };

  function buildArchitecture(layout, platforms, seedOf) {
    const key = Math.round(layout.surface) + '|' + platforms.map(p => Math.round(p.x) + ',' + Math.round(p.y)).join(';');
    if (architecture.key === key) return architecture;
    const plants = layout.plants.map(plant => {
      const links = [];
      layout.links.forEach((link, index) => {
        if (link.plant !== plant) return;
        const entry = [link.entryX - link.side * 6, link.entryY];
        links.push({ index, attachY: link.attachY, entry, band: link.band, blockCenters: [entry], blockWidths: [link.band * .72] });
      });
      const { roots } = growPlantRoots({
        plant, surface: layout.surface, tipY: plant.tipY, links, platforms, mainWidth: MAIN_ROOT_WIDTH,
      });
      for (const root of roots) {
        let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
        for (const [px, py] of root.points) {
          minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
        }
        root.box = { minX, maxX, minY, maxY };
        root.seed = hash2(Math.round(root.points[0][0]), Math.round(root.points[0][1]));
      }
      return { plant, roots };
    });
    const lateralOf = new Map();
    for (const { roots } of plants) {
      for (const root of roots) if (root.linkIndex !== undefined) lateralOf.set(root.linkIndex, root);
    }
    architecture = { key, plants, lateralOf };
    return architecture;
  }

  let lastRenderMs = 0;

  function draw(ctx, view, seedOf) {
    const started = typeof performance !== 'undefined' ? performance.now() : 0;
    cacheFrame++;
    currentCeiling = null;
    const platforms = solidPlatforms();
    const worldBottom = Number(state.level?.worldBottomY);
    const floor = Math.max(Number.isFinite(worldBottom) ? worldBottom : view.bottom, view.bottom) + 40;
    // Folga de 100 px: o barranco alarga a massa para os lados, embaixo.
    const inX = (left, right, margin = 100) => right >= view.left - margin && left <= view.right + margin;
    const layout = rootLayout(platforms);
    const { surface, plants, links } = layout;
    const arch = buildArchitecture(layout, platforms, seedOf);
    const time = state.time || 0;

    drawSky(ctx, view, surface);
    // Arquitetura radicular: principal e laterais livres mais atrás; laterais
    // que alimentam blocos um pouco mais à frente.
    // Como no original: ramificações finas atrás, depois a principal, e as
    // laterais por cima dela, saindo de dentro — brotando da principal.
    for (const { roots } of arch.plants) {
      for (const order of [2, 0, 1]) {
        for (const root of roots) {
          if (root.order !== order) continue;
          const { box } = root;
          if (!inX(box.minX, box.maxX, 20) || box.maxY < view.top - 20 || box.minY > view.bottom + 20) continue;
          const palette = root.linkIndex !== undefined ? ROOT_PALETTE
            : root.layer === 'link' ? LINK_ROOT_PALETTE : MUTED_ROOT_PALETTE;
          const fade = root.layer === 'link' ? .2 : .5;
          const pad = Math.max(...root.widths) + 14;
          cached(ctx, `root:${root.seed}:${root.order}:${root.layer}:${root.linkIndex ?? ''}`, {
            x: box.minX - pad, y: box.minY - pad, w: box.maxX - box.minX + pad * 2, h: box.maxY - box.minY + pad * 2,
          }, g => drawRootTube(g, root, { palette, seed: root.seed, time: 0, fade, part: 'body' }));
          drawRootTube(ctx, root, { palette, seed: root.seed, time, fade, part: 'hairs' });
        }
      }
    }
    drawCeiling(ctx, view, platforms, surface);
    drawGround(ctx, view, surface);
    for (const plant of plants) {
      if (inX(plant.x - 120, plant.x + 120, 60)) drawPlant(ctx, plant, surface, view);
    }
    for (const platform of platforms) {
      if (platform.type !== 'soil' || !inX(platform.x, platform.x + platform.w)) continue;
      const massSeed = seedOf(platform);
      const bottom = massBottom(platform, platforms, floor);
      if (platform.y > view.bottom || bottom < view.top) continue;
      cached(ctx, `mass:${massSeed}:${Math.round(platform.x)}:${Math.round(platform.y)}:${Math.round(platform.w)}:${Math.round(bottom)}`, {
        x: platform.x - 96, y: platform.y - 12, w: platform.w + 192, h: bottom - platform.y + 72,
      }, g => drawSoilMass(g, platform, platforms, FULL_VIEW, floor, massSeed));
    }
    links.forEach((link, index) => {
      const { block } = link;
      if (!inX(block.x, block.x + block.w, 40)) return;
      if (block.y > view.bottom || block.y + block.h < view.top) return;
      drawAggregate(ctx, link, seedOf(block));
    });
    trimCache();
    if (started) lastRenderMs = performance.now() - started;
  }

  return {
    draw,
    layout: () => rootLayout(solidPlatforms()),
    get lastRenderMs() { return lastRenderMs; },
  };
}
