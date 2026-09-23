// TECIDO DA RAIZ — textura celular do autor, compartilhada
// ========================================================
//
// Camadas de células (epiderme verde, faixa cinza-azulada, córtex ocre) usadas
// pelo bloco de raiz antigo, pela raiz visível dos agregados de rizobainha, pelas
// raízes principais e pela raiz-objetivo. Só desenho.

const TAU = Math.PI * 2;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function pseudo(seed, index) {
  const value = Math.sin(seed * .000013 + index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function stateInfo(platform) {
  const health = clamp(platform.rootHealth ?? 1, 0, 1);
  const name = platform.rootState || (health >= .75 ? 'healthy' : health >= .5 ? 'stressed' : health >= .25 ? 'compromised' : 'collapse');
  if (name === 'healthy') return { label: 'saudável', color: '#9bea8f', overlay: 'rgba(99,208,127,.08)' };
  if (name === 'stressed') return { label: 'estressada', color: '#ffd36f', overlay: 'rgba(244,177,70,.12)' };
  if (name === 'compromised') return { label: 'comprometida', color: '#ff9c70', overlay: 'rgba(214,84,67,.18)' };
  return { label: 'em colapso', color: '#ff657f', overlay: 'rgba(79,25,38,.36)' };
}

export const ROOT_PALETTE = Object.freeze({
  outline: '#3f2d1d',
  innerBase: '#4b361f',
  green: ['#63753a', '#6d8140', '#596b33'],
  greenStroke: '#394622',
  blue: ['#70807a', '#7c8d86', '#66756f'],
  blueStroke: '#4c5a56',
  ochreSmall: ['#6d532d', '#785b31', '#624a27'],
  ochreLarge: ['#6f5027', '#78562a', '#654821'],
  ochreStroke: '#4a3720',
  radicle: '#8c9256',
});

// Versão "de fundo" da mesma paleta: menos saturação e menos contraste, puxada
// para o tom do subsolo. Separa raízes principais e laterais de ligação do que
// se pisa sem um véu escuro uniforme — as camadas continuam legíveis.
function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
}

export function muteColor(hex, { saturation = .55, contrast = .6, pivot = '#2c302a' } = {}) {
  const rgb = hexToRgb(hex);
  const grey = rgb[0] * .3 + rgb[1] * .59 + rgb[2] * .11;
  const pv = hexToRgb(pivot);
  return rgbToHex(rgb.map((v, i) => {
    const desaturated = grey + (v - grey) * saturation;
    return pv[i] + (desaturated - pv[i]) * contrast;
  }));
}

function mutePalette(palette, options) {
  const out = {};
  for (const [key, value] of Object.entries(palette)) {
    out[key] = Array.isArray(value) ? value.map(color => muteColor(color, options)) : muteColor(value, options);
  }
  return Object.freeze(out);
}

export const MUTED_ROOT_PALETTE = mutePalette(ROOT_PALETTE);
// Laterais de ligação: um pouco mais vivas que a principal, ainda atrás do bloco.
export const LINK_ROOT_PALETTE = mutePalette(ROOT_PALETTE, { saturation: .6, contrast: .68 });


// Retângulo visível (mundo) para as próximas pinturas de tecido. Células fora
// dele não são desenhadas — elas cairiam fora da tela ou do recorte da raiz.
let tissueCull = null;
export function setTissueCull(rect) {
  tissueCull = rect || null;
}

export function drawTissueLayerCanvas(ctx, seed, options) {
  const { startX, endX, startY, endY, cellW, cellH, fillColors, strokeColor, strokeWidth } = options;
  const width = endX - startX;
  const height = endY - startY;
  const cols = Math.max(1, Math.round(width / cellW));
  const rows = Math.max(1, Math.round(height / cellH));
  const dx = width / cols;
  const dy = height / rows;

  const cull = tissueCull;
  for (let i = 0; i < rows; i++) {
    const rowY = startY + i * dy;
    if (cull && (rowY + dy * 1.2 < cull.y0 || rowY - dy * .2 > cull.y1)) continue;
    const isOffset = (i % 2 === 1);
    const currentCols = isOffset ? cols + 1 : cols;

    for (let j = 0; j < currentCols; j++) {
      const idx = i * 31 + j * 7;
      const cellX = startX + j * dx - (isOffset ? dx * 0.5 : 0);
      const jx = (pseudo(seed, idx + 1) - 0.5) * dx * 0.2;
      const jy = (pseudo(seed, idx + 2) - 0.5) * dy * 0.2;
      const w = dx * (0.95 + pseudo(seed, idx + 3) * 0.13);
      const h = dy * (0.95 + pseudo(seed, idx + 4) * 0.13);
      if (cull && (cellX + jx + w < cull.x0 || cellX + jx > cull.x1)) continue;
      const rx = Math.min(w, h) * (0.25 + pseudo(seed, idx + 5) * 0.2);
      const fill = fillColors[Math.floor(pseudo(seed, idx + 6) * fillColors.length)];

      ctx.fillStyle = fill;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.beginPath();
      ctx.roundRect(cellX + jx, rowY + jy, w, h, rx);
      ctx.fill();
      ctx.stroke();

      // Nucleus
      const nucW = w * (0.12 + pseudo(seed, idx + 7) * 0.1);
      const nucH = h * (0.12 + pseudo(seed, idx + 8) * 0.1);
      const maxOffX = Math.max(0, (w / 2) - nucW - strokeWidth);
      const maxOffY = Math.max(0, (h / 2) - nucH - strokeWidth);
      let offX = (pseudo(seed, idx + 9) - 0.5) * 2 * maxOffX;
      let offY = (pseudo(seed, idx + 10) - 0.5) * 2 * maxOffY;
      if (pseudo(seed, idx + 11) > 0.5) offX *= 1.3;
      if (pseudo(seed, idx + 12) > 0.5) offY *= 1.3;
      offX = clamp(offX, -maxOffX, maxOffX);
      offY = clamp(offY, -maxOffY, maxOffY);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(cellX + jx + w / 2 + offX, rowY + jy + h / 2 + offY, Math.max(1, nucW), Math.max(1, nucH), 0, 0, TAU);
      ctx.fill();
    }
  }
}

// Tecido da raiz em camadas (epiderme verde, faixa azulada, córtex ocre) no
// retângulo dado. Usado pelo bloco antigo e pela raiz lateral/vertical do
// visual de geometria — a textura é a mesma nos dois.
export function paintRootTissue(ctx, seed, x, y, width, height, palette = ROOT_PALETTE) {
  const padX = width * 0.05;
  const gX = x - padX;
  const gEndX = x + width + padX;

  const greenBand = height * 0.20;
  const blueBand = height * 0.14;
  const smallOchreBand = height * 0.10;

  // Camada 1: Verde (Topo)
  drawTissueLayerCanvas(ctx, seed, {
    startX: gX, endX: gEndX, startY: y - 5, endY: y + greenBand,
    cellW: clamp(height * 0.24, 15, 36), cellH: Math.max(4, greenBand * 0.5),
    fillColors: palette.green, strokeColor: palette.greenStroke,
    strokeWidth: clamp(height * 0.010, 0.75, 1.2),
  });

  // Camada 2: Azul
  drawTissueLayerCanvas(ctx, seed, {
    startX: gX, endX: gEndX, startY: y + greenBand, endY: y + greenBand + blueBand,
    cellW: clamp(height * 0.12, 10, 20), cellH: Math.max(3, blueBand * 0.5),
    fillColors: palette.blue, strokeColor: palette.blueStroke,
    strokeWidth: clamp(height * 0.008, 0.65, 1),
  });

  // Camada 3: Ocre Pequena
  drawTissueLayerCanvas(ctx, seed, {
    startX: gX, endX: gEndX, startY: y + greenBand + blueBand, endY: y + greenBand + blueBand + smallOchreBand,
    cellW: clamp(height * 0.15, 12, 22), cellH: Math.max(3, smallOchreBand * 0.5),
    fillColors: palette.ochreSmall, strokeColor: palette.ochreStroke,
    strokeWidth: clamp(height * 0.009, 0.7, 1.05),
  });

  // Camada 4: Ocre Grande (Córtex inferior)
  drawTissueLayerCanvas(ctx, seed, {
    startX: gX, endX: gEndX, startY: y + greenBand + blueBand + smallOchreBand, endY: y + height + 10,
    cellW: clamp(height * 0.26, 17, 34), cellH: clamp(height * 0.13, 10, 18),
    fillColors: palette.ochreLarge, strokeColor: palette.ochreStroke,
    strokeWidth: clamp(height * 0.010, 0.75, 1.15),
  });
}

// A mesma textura de tecido, para uma raiz VERTICAL: as camadas viram faixas
// verticais (epiderme verde nas duas bordas, córtex ocre no meio) e as células
// se alongam ao longo do eixo da raiz. Tudo em coordenadas de mundo.
export function paintRootTissueVertical(ctx, seed, centerX, top, bottom, halfWidth, palette = ROOT_PALETTE) {
  const height = bottom - top;
  // Estreito demais para as camadas: só córtex (evita célula de largura negativa).
  if (halfWidth < 12 || height <= 0) {
    if (halfWidth <= 0 || height <= 0) return;
    drawTissueLayerCanvas(ctx, seed + 911, {
      startX: centerX - halfWidth, endX: centerX + halfWidth, startY: top, endY: bottom,
      cellW: Math.max(2, halfWidth), cellH: 10,
      fillColors: palette.ochreLarge, strokeColor: palette.ochreStroke, strokeWidth: 0.7,
    });
    return;
  }
  const bands = [
    { share: 0.20, colors: palette.green, stroke: palette.greenStroke, cellH: 16 },
    { share: 0.14, colors: palette.blue, stroke: palette.blueStroke, cellH: 11 },
    { share: 0.10, colors: palette.ochreSmall, stroke: palette.ochreStroke, cellH: 12 },
  ];
  let inner = halfWidth;
  bands.forEach((band, index) => {
    const width = Math.max(3, halfWidth * band.share);
    for (const side of [-1, 1]) {
      const outer = centerX + side * inner;
      const next = centerX + side * (inner - width);
      drawTissueLayerCanvas(ctx, seed + index * 101 + (side > 0 ? 37 : 0), {
        startX: Math.min(outer, next), endX: Math.max(outer, next), startY: top, endY: top + height,
        cellW: width, cellH: band.cellH,
        fillColors: band.colors, strokeColor: band.stroke, strokeWidth: 0.8,
      });
    }
    inner -= width;
  });
  drawTissueLayerCanvas(ctx, seed + 911, {
    startX: centerX - inner, endX: centerX + inner, startY: top, endY: top + height,
    cellW: clamp(inner * .5, 7, 11), cellH: 16,
    fillColors: palette.ochreLarge, strokeColor: palette.ochreStroke, strokeWidth: 0.9,
  });
}

// Saúde, cicatriz permanente e estresse da raiz, sobre o retângulo dela.
export function paintRootCondition(ctx, platform) {
  const permanentDamage = clamp(platform.permanentDamage || 0, 0, .7);
  const stateStyle = stateInfo(platform);

  // Overlay de estado de saúde
  ctx.fillStyle = stateStyle.overlay;
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);

  if (permanentDamage > .01) {
    const scarWidth = platform.w * permanentDamage;
    const scarX = platform.x + platform.w - scarWidth;
    const scar = ctx.createLinearGradient(scarX, platform.y, platform.x + platform.w, platform.y + platform.h);
    scar.addColorStop(0, 'rgba(80,42,47,.04)');
    scar.addColorStop(.45, `rgba(72,33,43,${.2 + permanentDamage * .55})`);
    scar.addColorStop(1, `rgba(37,20,31,${.28 + permanentDamage * .5})`);
    ctx.fillStyle = scar;
    ctx.fillRect(scarX, platform.y, scarWidth, platform.h);
  }

  const rootDamage = clamp(platform.rootDamage || 0, 0, 1);
  if (rootDamage > .025) {
    const stress = ctx.createLinearGradient(platform.x, platform.y, platform.x + platform.w, platform.y + platform.h);
    stress.addColorStop(0, `rgba(255,116,105,${rootDamage * .16})`);
    stress.addColorStop(.55, `rgba(128,42,54,${rootDamage * .24})`);
    stress.addColorStop(1, `rgba(72,22,40,${rootDamage * .12})`);
    ctx.fillStyle = stress;
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
  }
}

