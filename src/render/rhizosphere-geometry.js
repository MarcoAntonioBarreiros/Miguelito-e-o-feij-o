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
import { GEOMETRY_ENABLED } from './geometry-preference.js';
import { FINAL_ROOT_SCALE, finalRootCollar } from './final-root-visual.js';
import {
  LINK_ROOT_PALETTE, MUTED_ROOT_PALETTE, clamp, paintRootCondition, paintRootTissue, paintRootTissueVertical, pseudo,
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

export function createRhizosphereGeometry({ state, painters }) {
  const { paintSoilTexture, soilPalette, rootPalette } = painters;

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
    const bump = (pseudo(hash2(Math.floor(x / CEILING_STEP), 7), 3) - .5) * 14;
    return Math.max(topLimit, best + bump);
  }

  // A faixa vai da superfície (linha do colo) até a linha do teto. Acima da
  // superfície fica o céu da cinemática final, que ela nunca cobre.
  function drawCeiling(ctx, view, platforms, surface) {
    if (!platforms.length) return false;
    // Com propulsão o jogador voa até o limite do mundo: não há onde pôr teto.
    if (state.campaign?.unlocks?.jetpack) return false;
    const clearance = ceilingClearance();
    const topLimit = surface + 40;
    const first = Math.floor((view.left - 60) / CEILING_STEP);
    const last = Math.ceil((view.right + 60) / CEILING_STEP);
    const line = [];
    for (let i = first; i <= last; i++) {
      const x = i * CEILING_STEP;
      const y = ceilingLineAt(x, platforms, clearance, topLimit);
      if (y !== null) line.push([x, y]);
    }
    if (line.length < 2) return false;
    let deepest = -Infinity;
    for (const point of line) deepest = Math.max(deepest, point[1]);
    // Acima da câmera: existe, só não aparece.
    if (deepest < view.top - 10) return true;
    const top = surface;
    const leftX = line[0][0];
    const rightX = line[line.length - 1][0];

    const outline = () => {
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
    };

    ctx.save();
    outline();
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
    ctx.strokeStyle = 'rgba(10,5,3,.34)';
    ctx.lineWidth = 34;
    ctx.beginPath();
    ctx.moveTo(line[0][0], line[0][1]);
    for (let i = 1; i < line.length; i++) {
      const p = line[i - 1];
      const q = line[i];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = soilPalette.outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(line[0][0], line[0][1]);
    for (let i = 1; i < line.length; i++) {
      const p = line[i - 1];
      const q = line[i];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.stroke();
    // Radicelas finas pendendo do teto.
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
  const MAIN_ROOT_WIDTH = 26;

  function surfaceLine(platforms) {
    const goal = state.level?.goal;
    if (goal && Number.isFinite(Number(goal.y))) return finalRootCollar(goal).y;
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
      // A ligação desce íngreme (> 45°) da principal até o bloco: vista de
      // longe, nunca forma uma ponte ou rampa na altura das plataformas.
      let attachY = entryY - clamp(dx * 1.25 + 40, 70, 240);
      attachY = Math.max(attachY, ceiling + 22, surface + 60);
      attachY = Math.min(attachY, entryY - 40);
      links.push({ block, plant, side, band, entryX, entryY, attachY });
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

  function mainHalfWidth(plant, surface, y) {
    const k = clamp((y - surface) / Math.max(1, plant.tipY - surface), 0, 1);
    return MAIN_ROOT_WIDTH / 2 * (1 - k * .6) * (k > .92 ? 1 - (k - .92) * 9 : 1);
  }

  function mainCenterX(plant, surface, y) {
    const k = clamp((y - surface) / Math.max(1, plant.tipY - surface), 0, 1);
    return plant.x + Math.sin(y * .011 + plant.seed * .001) * 6 * k;
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

  // Raiz principal: da superfície até a coifa, afinando para baixo. Textura em
  // faixas verticais com a paleta apagada (menos saturação e contraste).
  function drawMainRoot(ctx, plant, surface, view) {
    if (plant.goal) return; // a raiz-objetivo é desenhada pelo goal-system
    if (plant.tipY < view.top || surface > view.bottom) return;
    const centers = [];
    const widths = [];
    const n = Math.max(6, Math.ceil((plant.tipY - surface) / 16));
    for (let i = 0; i <= n; i++) {
      const y = surface + (plant.tipY - surface) * i / n;
      centers.push([mainCenterX(plant, surface, y), y]);
      widths.push(Math.max(2, mainHalfWidth(plant, surface, y) * 2));
    }
    const palette = MUTED_ROOT_PALETTE;
    ctx.save();
    const { left, right } = traceTube(ctx, centers, widths);
    ctx.fillStyle = palette.innerBase;
    ctx.fill();
    ctx.clip();
    paintRootTissueVertical(ctx, plant.seed, plant.x, surface, plant.tipY + 12, MAIN_ROOT_WIDTH * .62, palette);
    ctx.restore();
    ctx.save();
    traceTube(ctx, centers, widths);
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // Pelos só no terço perto da ponta.
    ctx.strokeStyle = palette.radicle;
    ctx.globalAlpha = .55;
    ctx.lineWidth = .9;
    for (let i = Math.floor(n * .67); i < n - 1; i++) {
      const sway = Math.sin((state.time || 0) * 1.3 + i) * 1.5;
      ctx.beginPath();
      ctx.moveTo(left[i][0], left[i][1]);
      ctx.lineTo(left[i][0] + 8 + sway, left[i][1] + 5);
      ctx.moveTo(right[i][0], right[i][1]);
      ctx.lineTo(right[i][0] - 8 - sway, right[i][1] + 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function linkCenters(link, surface) {
    const { plant, entryX, entryY, attachY, side } = link;
    const out = entryX >= plant.x ? 1 : -1;
    const startX = plant.goal ? plant.x : mainCenterX(plant, surface, attachY);
    const start = [startX + out * 4, attachY];
    const end = [entryX - side * 6, entryY];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    // Sai da principal para o lado e cai quase na vertical sobre a entrada.
    const c1 = [start[0] + dx * .55, start[1] + dy * .1];
    const c2 = [end[0] - dx * .1, end[1] - dy * .55];
    const points = [];
    const steps = 22;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const x = u * u * u * start[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * end[0];
      const y = u * u * u * start[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * end[1];
      // Sinuosa, mas presa nas duas pontas.
      const wave = Math.sin(t * Math.PI * 2.4 + link.block.x * .01) * 4.5 * Math.sin(t * Math.PI);
      points.push([x, y + wave]);
    }
    return points;
  }

  // Lateral de ligação: fina, sinuosa, atrás do bloco, com ramificações de 2ª
  // ordem. Sem pelos: eles ficam no terço perto da ponta, já sobre o bloco.
  function drawLink(ctx, link, surface) {
    const centers = linkCenters(link, surface);
    const palette = LINK_ROOT_PALETTE;
    const mainWidth = link.plant.goal ? 22 : mainHalfWidth(link.plant, surface, link.attachY) * 2;
    const width = Math.min(link.band * .8, mainWidth * .7, 14);
    const seed = hash2(Math.round(link.block.x), 83);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Ramificações de 2ª ordem (atrás da lateral), apontando para baixo.
    ctx.strokeStyle = palette.green[0];
    for (let b = 0; b < 3; b++) {
      const t = .22 + b * .22 + pseudo(seed, b) * .08;
      const i = Math.round(t * (centers.length - 1));
      const [x, y] = centers[i];
      const [nx, ny] = centers[Math.min(centers.length - 1, i + 1)];
      const heading = Math.atan2(ny - y, nx - x);
      const turn = (b % 2 ? .95 : -.95) * (pseudo(seed, b + 5) > .3 ? 1 : -1);
      let angle = heading + turn;
      if (Math.sin(angle) < -.2) angle = heading - turn;
      const len = 16 + pseudo(seed, b + 9) * 20;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.cos(angle) * len * .5, y + Math.sin(angle) * len * .5 + 3,
        x + Math.cos(angle) * len, y + Math.sin(angle) * len + 6,
      );
      ctx.stroke();
    }
    const stroke = (color, w) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(centers[0][0], centers[0][1]);
      for (const [x, y] of centers) ctx.lineTo(x, y);
      ctx.stroke();
    };
    stroke(palette.outline, width + 2);
    stroke(palette.green[1], width);
    stroke(palette.blue[0], width * .7);
    stroke(palette.ochreLarge[1], width * .46);
    // Paredes celulares: tracinhos ao longo do córtex.
    ctx.strokeStyle = palette.ochreStroke;
    ctx.lineWidth = .8;
    for (let i = 1; i < centers.length - 1; i++) {
      const [x, y] = centers[i];
      const [nx, ny] = centers[i + 1];
      const len = Math.hypot(nx - x, ny - y) || 1;
      const px = -(ny - y) / len * width * .32;
      const py = (nx - x) / len * width * .32;
      ctx.beginPath();
      ctx.moveTo(x - px, y - py);
      ctx.lineTo(x + px, y + py);
      ctx.stroke();
    }
    ctx.restore();
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
    const capOut = clamp(band * 1.2, 16, 24);
    const centers = [];
    const widths = [];
    // A coifa dobra para baixo DENTRO do bloco: nada passa da borda e invade o vão.
    const straightEnd = exitX - dir * (capOut + 6);
    const straightLen = Math.abs(straightEnd - entryX);
    const steps = Math.max(2, Math.ceil(straightLen / 12));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      centers.push([entryX + dir * straightLen * t, y]);
      // Na entrada ainda tem a espessura da lateral de ligação.
      widths.push(i === 0 ? band * .72 : band * (1 - t * .15));
    }
    const p0 = [straightEnd, y];
    const p1 = [exitX - dir * 6, y];
    const p2 = [exitX - dir * 4, y + capOut * 1.1];
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
    for (let i = 0; i < grains; i++) {
      const gx = x + 8 + pseudo(seed, 60 + i) * (w - 16);
      const gy = y + h * .8 + pseudo(seed, 90 + i) * (h * .2 + 14);
      ctx.fillStyle = pseudo(seed, 120 + i) < .4 ? soilPalette.silt[1] : soilPalette.aggregates[i % 3];
      ctx.beginPath();
      ctx.arc(gx, gy, 1.2 + pseudo(seed, 150 + i) * 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    const { centers, widths, dir, exitX } = blockRootCenters(link);
    // Pelos radiculares no terço perto da ponta: entram no solo do bloco e
    // alguns saem pela base.
    const hairStart = exitX - dir * w / 3;
    ctx.save();
    ctx.strokeStyle = rootPalette.radicle;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1;
    for (let k = 0; k < 40; k++) {
      const hx = hairStart + dir * k * 6;
      if ((hx - exitX) * dir > -4) break;
      const r = pseudo(seed, 200 + k);
      const sway = Math.sin(time * 1.5 + hx * .05) * 1.5;
      const from = y + band - 2;
      const len = 8 + r * (h * .5);
      ctx.globalAlpha = .75;
      ctx.beginPath();
      ctx.moveTo(hx, from);
      ctx.quadraticCurveTo(hx + sway, from + len * .6, hx + sway * 1.5 + dir * 2, from + len);
      ctx.stroke();
      if (r > .55) {
        const out = y + h * (.82 + r * .1);
        ctx.globalAlpha = .6;
        ctx.beginPath();
        ctx.moveTo(hx + 2, out);
        ctx.quadraticCurveTo(hx + 2 + sway, out + 8, hx + 3 + sway * 1.6, out + 12 + r * 8);
        ctx.stroke();
      }
    }
    ctx.restore();

    // A raiz: textura celular do autor, contraste pleno.
    ctx.save();
    traceTube(ctx, centers, widths, .45);
    ctx.fillStyle = rootPalette.innerBase;
    ctx.fill();
    ctx.clip();
    const minX = Math.min(...centers.map(point => point[0])) - band;
    const maxX = Math.max(...centers.map(point => point[0])) + band;
    const maxY = Math.max(...centers.map(point => point[1])) + band;
    paintRootTissue(ctx, seed, minX, y, maxX - minX, band);
    // A ponta que dobra para baixo continua em córtex.
    paintRootTissue(ctx, seed + 17, minX, y + band, maxX - minX, maxY - y - band + 4);
    paintRootCondition(ctx, visibleRootRect(block));
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
    for (let k = 0; k < 60; k++) {
      const px = x + 10 + k * 11 + pseudo(seed, 300 + k) * 6;
      if (px > x + w - 10) break;
      if (pseudo(seed, 360 + k) < .35) continue;
      ctx.fillStyle = pseudo(seed, 420 + k) < .5 ? soilPalette.aggregates[0] : soilPalette.base;
      ctx.beginPath();
      ctx.arc(px, y + band - 1 + pseudo(seed, 480 + k) * 2, 2 + pseudo(seed, 540 + k) * 2.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    if (block.fixedObjective) {
      // Mesmo tecido, com o brilho do objetivo por cima.
      ctx.save();
      ctx.strokeStyle = 'rgba(255,213,111,.85)';
      ctx.fillStyle = 'rgba(255,213,111,.12)';
      ctx.lineWidth = 2.6;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ffd56f';
      traceTube(ctx, centers, widths, .45);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // ------------------------------------------------------------ mundo ----

  let lastRenderMs = 0;

  function draw(ctx, view, seedOf) {
    const started = typeof performance !== 'undefined' ? performance.now() : 0;
    const platforms = solidPlatforms();
    const worldBottom = Number(state.level?.worldBottomY);
    const floor = Math.max(Number.isFinite(worldBottom) ? worldBottom : view.bottom, view.bottom) + 40;
    // Folga de 100 px: o barranco alarga a massa para os lados, embaixo.
    const inX = (left, right, margin = 100) => right >= view.left - margin && left <= view.right + margin;
    const { surface, plants, links } = rootLayout(platforms);

    // Fundo: principais e laterais de ligação, apagadas.
    for (const plant of plants) {
      if (inX(plant.x - 40, plant.x + 40, 60)) drawMainRoot(ctx, plant, surface, view);
    }
    for (const link of links) {
      if (inX(Math.min(link.plant.x, link.entryX), Math.max(link.plant.x, link.entryX), 60)) drawLink(ctx, link, surface);
    }
    drawCeiling(ctx, view, platforms, surface);
    for (const plant of plants) {
      if (inX(plant.x - 120, plant.x + 120, 60)) drawPlant(ctx, plant, surface, view);
    }
    for (const platform of platforms) {
      if (platform.type !== 'soil' || !inX(platform.x, platform.x + platform.w)) continue;
      drawSoilMass(ctx, platform, platforms, view, floor, seedOf(platform));
    }
    for (const link of links) {
      const { block } = link;
      if (!inX(block.x, block.x + block.w, 40)) continue;
      if (block.y > view.bottom || block.y + block.h < view.top) continue;
      drawAggregate(ctx, link, seedOf(block));
    }
    if (started) lastRenderMs = performance.now() - started;
  }

  return {
    draw,
    layout: () => rootLayout(solidPlatforms()),
    get lastRenderMs() { return lastRenderMs; },
  };
}
