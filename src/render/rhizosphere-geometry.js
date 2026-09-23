// GEOMETRIA DA RIZOSFERA — só desenho
// ===================================
//
// Troca a cara de "blocos de videogame" por paisagem de solo, seguindo o
// protótipo de referência (drawSolids / buildSolidSprite / drawVerticalRoot /
// drawHorizontalRoot):
//
// · plataforma de solo = topo de uma massa contínua que desce até o fundo da
//   tela, com parede irregular; o vão entre duas massas vira barranco;
// · plataforma de raiz = raiz lateral que sai de uma raiz vertical descendo do
//   teto, afunilando até a coifa, com pelos radiculares na zona de maturação;
// · faixa de solo no teto da fase.
//
// Nada aqui é lido pela física, pelo gerador ou pelos validadores: o colisor
// continua sendo o retângulo da plataforma. Por isso a borda de cima de toda
// forma desenhada fica exatamente em `platform.y` — é onde o pé pousa.
//
// As texturas (células da raiz, agregados/poros/grãos do solo) são as do
// autor e chegam prontas por `painters`; este módulo só decide a forma.

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function pseudo(seed, index) {
  const value = Math.sin(seed * .000013 + index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

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

// `?geo=0` volta ao visual antigo (blocos), para comparação.
export function readGeometryPreference(locationLike) {
  try {
    const value = new URLSearchParams(locationLike?.search || '').get('geo');
    if (value === null) return true;
    return !['0', 'off', 'false', 'nao', 'não'].includes(value.toLowerCase());
  } catch (_) {
    return true;
  }
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
  const {
    paintSoilTexture, paintRootTissue, paintRootTissueVertical, paintRootCondition, soilPalette, rootPalette,
  } = painters;

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
    for (const platform of platforms) {
      const left = platform.x - CEILING_REACH;
      const right = platform.x + platform.w + CEILING_REACH;
      if (x < left || x > right) continue;
      // Some suave nas pontas do alcance, para o teto não fazer degrau.
      const edge = Math.min(x - left, right - x);
      const lift = edge < 120 ? (120 - edge) * .55 : 0;
      best = Math.min(best, platform.y - clearance - lift);
    }
    if (!Number.isFinite(best)) return null;
    const bump = (pseudo(hash2(Math.floor(x / CEILING_STEP), 7), 3) - .5) * 14;
    return Math.max(topLimit, best + bump);
  }

  function drawCeiling(ctx, view, platforms) {
    if (!platforms.length) return false;
    // Na cinemática final o céu aparece acima da superfície: o teto sai.
    if (state.level?.finalRootPulse !== undefined) return false;
    // Com propulsão o jogador voa até o limite do mundo: não há onde pôr teto.
    if (state.campaign?.unlocks?.jetpack) return false;
    const clearance = ceilingClearance();
    const worldTop = Number(state.level?.worldTopY);
    const topLimit = Number.isFinite(worldTop) ? worldTop + 30 : -Infinity;
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
    const top = Math.min(view.top, deepest) - 80;
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

  // ------------------------------------------------------------- raízes ----

  function verticalRootThickness(platform) {
    return clamp(platform.h * .5, 22, 40);
  }

  // Raiz vertical de fundo: desce do teto, passa pela base da raiz lateral e
  // afunila até a coifa. Mesma textura de células, em faixas verticais e mais
  // escura, para ficar atrás do que se pisa.
  function drawVerticalRoot(ctx, platform, view, ceilingY, seed) {
    const thickness = verticalRootThickness(platform);
    const cx = platform.x + thickness * .32;
    const y0 = ceilingY - 12;
    const y1 = platform.y + platform.h + clamp(platform.h * 1.2, 60, 110);
    if (y1 < view.top || y0 > view.bottom) return;
    const n = Math.max(5, Math.ceil((y1 - y0) / 18));
    const left = [];
    const right = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const yy = y0 + (y1 - y0) * k;
      // Afunila devagar do teto até a coifa, como no protótipo.
      const half = thickness / 2 * (1.25 - k * .8) * (k > .92 ? 1 - (k - .92) * 8 : 1);
      const wander = Math.sin(yy * .013 + seed * .001) * 7 * k;
      left.push([cx + wander - half, yy]);
      right.push([cx + wander + half, yy]);
    }
    const tipL = left[left.length - 1];
    const tipR = right[right.length - 1];
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(left[0][0], left[0][1]);
      for (const p of left) ctx.lineTo(p[0], p[1]);
      ctx.quadraticCurveTo((tipL[0] + tipR[0]) / 2, tipL[1] + thickness * .3, tipR[0], tipR[1]);
      for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath();
    };

    ctx.save();
    trace();
    ctx.fillStyle = rootPalette.innerBase;
    ctx.fill();
    ctx.clip();
    // Tecido em faixas verticais: epiderme verde nas duas bordas, córtex no meio.
    // Presa a y0 (mundo), não à câmera: as células não deslizam.
    paintRootTissueVertical(ctx, seed, cx, y0, y1 + 10, thickness * .62);
    // Fica atrás do jogo: um véu escuro separa o fundo do que se pisa.
    ctx.fillStyle = 'rgba(12,10,9,.5)';
    trace();
    ctx.fill();
    ctx.restore();

    ctx.save();
    trace();
    ctx.strokeStyle = rootPalette.outline;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Pelos radiculares perto da ponta.
    ctx.strokeStyle = rootPalette.radicle;
    ctx.globalAlpha = .5;
    ctx.lineWidth = 1;
    for (let i = Math.floor(n * .72); i < n - 1; i++) {
      const sway = Math.sin((state.time || 0) * 1.4 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(left[i][0], left[i][1]);
      ctx.lineTo(left[i][0] - 9 - sway, left[i][1] + 5);
      ctx.moveTo(right[i][0], right[i][1]);
      ctx.lineTo(right[i][0] + 9 + sway, right[i][1] + 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function lateralRootShape(platform) {
    const x0 = platform.x;
    const x1 = platform.x + platform.w;
    const y = platform.y;
    const base = platform.h;
    const tip = Math.max(18, platform.h * .62);
    const capLen = Math.min(tip * .9, 30, platform.w * .2);
    const bodyEnd = x1 - capLen;
    const thicknessAt = x => base - (base - tip) * Math.pow(clamp((x - x0) / Math.max(1, bodyEnd - x0), 0, 1), 1.7);
    return { x0, x1, y, base, tip, capLen, bodyEnd, thicknessAt };
  }

  function traceLateral(ctx, shape) {
    const { x0, x1, y, tip, bodyEnd, thicknessAt } = shape;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    // Topo reto: é onde se pisa.
    ctx.lineTo(bodyEnd, y);
    // Coifa.
    ctx.quadraticCurveTo(x1 - 3, y + 1, x1, y + tip * .55);
    ctx.quadraticCurveTo(x1 - 4, y + tip, bodyEnd, y + tip * .96);
    for (let x = bodyEnd; x > x0; x -= 14) ctx.lineTo(x, y + thicknessAt(x) + Math.sin(x * .03) * 1.2);
    ctx.lineTo(x0, y + thicknessAt(x0));
    ctx.closePath();
  }

  function drawLateralRoot(ctx, platform, seed) {
    const shape = lateralRootShape(platform);
    const { x0, x1, y, base, bodyEnd, capLen, thicknessAt } = shape;
    const time = state.time || 0;

    // Colar de ramificação: a lateral nasce da vertical alargando-se nela,
    // em cima e embaixo, como no protótipo.
    const vertical = verticalRootThickness(platform);
    const trunkLeft = x0 + vertical * .32 - vertical * .62;
    const collarW = clamp(base * .38, 14, 30);
    const collarH = clamp(base * .32, 10, 22);
    const bottomAtCollar = y + thicknessAt(x0 + collarW);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(trunkLeft, y - collarH);
    ctx.quadraticCurveTo(trunkLeft + 4, y, x0 + collarW, y);
    ctx.lineTo(x0 + collarW, bottomAtCollar);
    ctx.quadraticCurveTo(trunkLeft + 4, bottomAtCollar, trunkLeft, bottomAtCollar + collarH);
    ctx.closePath();
    ctx.fillStyle = rootPalette.ochreLarge[1];
    ctx.fill();
    ctx.strokeStyle = rootPalette.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Pelos radiculares da zona de maturação, atrás da coifa (antes do corpo,
    // para nascerem de dentro dele).
    const zoneStart = Math.max(x0 + collarW + 6, x1 - Math.min(200, platform.w * .62));
    ctx.save();
    ctx.strokeStyle = rootPalette.radicle;
    ctx.lineCap = 'round';
    ctx.lineWidth = clamp(base * .02, 1.1, 1.8);
    ctx.globalAlpha = .75;
    for (let hx = zoneStart, k = 0; hx < bodyEnd - 2; hx += 8, k++) {
      const r = pseudo(seed, 900 + k);
      const len = 10 + r * 16;
      const sway = Math.sin(time * 1.6 + hx * .05) * 3;
      const bottomY = y + thicknessAt(hx) - 2;
      ctx.beginPath();
      ctx.moveTo(hx, bottomY);
      ctx.quadraticCurveTo(hx + sway, bottomY + len * .6, hx + sway * 1.6 + 3, bottomY + len);
      ctx.stroke();
      if (r > .6) {
        ctx.beginPath();
        ctx.moveTo(hx + 3, y + 3);
        ctx.quadraticCurveTo(hx + 3 + sway, y - len * .45, hx + 5 + sway, y - len * .75);
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.save();
    traceLateral(ctx, shape);
    ctx.clip();
    paintRootTissue(ctx, seed, x0, y, platform.w, base);
    paintRootCondition(ctx, platform);
    // A coifa é mais clara e translúcida que o resto da raiz.
    const cap = ctx.createLinearGradient(bodyEnd - capLen, 0, x1, 0);
    cap.addColorStop(0, 'rgba(250,236,205,0)');
    cap.addColorStop(1, 'rgba(250,236,205,.38)');
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.moveTo(bodyEnd - capLen, y - 2);
    ctx.lineTo(x1 + 2, y - 2);
    ctx.lineTo(x1 + 2, y + base);
    ctx.lineTo(bodyEnd - capLen, y + base);
    ctx.fill();
    ctx.restore();

    ctx.save();
    traceLateral(ctx, shape);
    ctx.strokeStyle = rootPalette.outline;
    ctx.lineWidth = Math.max(2, base * .025);
    ctx.stroke();
    // Coifa translúcida com mucilagem, por dentro da ponta.
    ctx.strokeStyle = 'rgba(255,244,220,.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(bodyEnd, y + shape.tip * .5, capLen * .75, shape.tip * .36, 0, -1.1, 1.1);
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
      traceLateral(ctx, shape);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd56f';
      ctx.fillRect(x0 + 12, y - 2, Math.max(24, bodyEnd - x0 - 24), 4);
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
    const inX = platform => platform.x + platform.w >= view.left - 100 && platform.x <= view.right + 100;
    const visible = platforms.filter(inX);
    const soils = visible.filter(platform => platform.type === 'soil');
    const roots = visible.filter(platform => platform.type !== 'soil');

    const ceilingDrawn = drawCeiling(ctx, view, platforms);
    const clearance = ceilingClearance();
    const worldTop = Number(state.level?.worldTopY);
    const topLimit = Number.isFinite(worldTop) ? worldTop + 30 : -Infinity;
    for (const platform of roots) {
      const thickness = verticalRootThickness(platform);
      // Sem teto na tela, a raiz vertical entra pela borda de cima.
      const ceilingY = ceilingDrawn
        ? ceilingLineAt(platform.x + thickness * .32, platforms, clearance, topLimit) ?? view.top - 40
        : view.top - 40;
      drawVerticalRoot(ctx, platform, view, ceilingY, seedOf(platform));
    }
    for (const platform of soils) drawSoilMass(ctx, platform, platforms, view, floor, seedOf(platform));
    for (const platform of roots) {
      if (platform.y > view.bottom || platform.y + platform.h < view.top) continue;
      drawLateralRoot(ctx, platform, seedOf(platform));
    }
    if (started) lastRenderMs = performance.now() - started;
  }

  return {
    draw,
    get lastRenderMs() { return lastRenderMs; },
  };
}
