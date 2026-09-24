// A RAIZ FINAL — UM DESENHO SÓ
// ============================
//
// Existia uma raiz principal desenhada em `goal-system.js` e outra, parecida e
// independente, dentro da cinemática de fim de fase. Duas geometrias no mesmo
// lugar: o afastamento da câmera trocava de raiz no meio do caminho, e o colo do
// feijoeiro não caía sobre a raiz que o jogador tinha acabado de alcançar.
//
// Este módulo é a única fonte. `goal-system` desenha por aqui enquanto Miguelito
// se aproxima; a cinemática NÃO desenha raiz nenhuma — ela só empurra o pulso e
// lê os limites geométricos para enquadrar a câmera. Não há crossfade, não há
// troca: é literalmente o mesmo caminho de desenho antes, durante e depois.
//
// GEOMETRIA. Vem do protótipo aprovado, convertida para coordenadas LOCAIS com o
// colo na origem — no protótipo o colo era `(1390, 320)` no mundo dele, e usar
// aqueles números absolutos amarraria a raiz a um mundo que este jogo não tem.
// O colo real sai de `state.level.goal`.
//
// CAMADAS TRANSLÚCIDAS. Halo, córtex externo âmbar, córtex interno creme, tubo
// vascular opaco e filamento luminoso central — a leitura de profundidade do
// protótipo, preservada. A escala aproxima a raiz do tamanho que ela já tinha na
// fase, para a troca de desenho não alterar o enquadramento do gameplay.

import { GEOMETRY_ENABLED } from './geometry-preference.js';
import { ROOT_PALETTE, paintRootTissueVertical } from './root-tissue.js';

const TAU = Math.PI * 2;

// Colo em relação a `goal.y`. O valor vem do desenho anterior, cujo topo ficava
// em `goal.y - 205`: mantê-lo faz a raiz nova nascer onde a antiga terminava.
export const FINAL_ROOT_COLLAR_OFFSET = -205;

// Protótipo -> jogo. Com 0,42 a raiz desce 378 px abaixo do colo, contra os 335
// do desenho anterior, e se espalha 80 px para os lados.
export const FINAL_ROOT_SCALE = 0.42;

export const FINAL_ROOT_MAIN_LOCAL = Object.freeze([
  Object.freeze({ x: 0, y: 0 }),
  Object.freeze({ x: -5, y: 140 }),
  Object.freeze({ x: 10, y: 340 }),
  Object.freeze({ x: -15, y: 540 }),
  Object.freeze({ x: -50, y: 740 }),
  Object.freeze({ x: -80, y: 900 }),
]);

export const FINAL_ROOT_BRANCHES_LOCAL = Object.freeze([
  Object.freeze([{ x: -2, y: 90 }, { x: -70, y: 150 }, { x: -150, y: 190 }]),
  Object.freeze([{ x: 0, y: 190 }, { x: 60, y: 240 }, { x: 140, y: 290 }]),
  Object.freeze([{ x: 5, y: 300 }, { x: -60, y: 360 }, { x: -170, y: 400 }]),
  Object.freeze([{ x: -5, y: 410 }, { x: 50, y: 470 }, { x: 150, y: 510 }]),
  Object.freeze([{ x: -20, y: 550 }, { x: -100, y: 600 }, { x: -190, y: 640 }]),
  Object.freeze([{ x: -35, y: 650 }, { x: 20, y: 700 }, { x: 110, y: 740 }]),
]);

// Larguras em unidades locais. O protótipo usava 42 para o eixo; 56 devolve, na
// escala acima, os ~23 px do traço que a raiz tinha antes.
const MAIN_WIDTH_LOCAL = 56;
const branchWidthLocal = index => 24 - index * 2;

/**
 * O colo: onde a raiz encontra a superfície e de onde o caule sai.
 *
 * É o mesmo ponto para os dois desenhos — não há um "colo da raiz" e um "pé do
 * caule" que possam divergir por arredondamento.
 */
export function finalRootCollar(goal) {
  return {
    x: Number(goal?.x) || 0,
    // `collarY` é a superfície da fase quando ela precisou subir para dar
    // espaço ao bloco mais alto (ver rhizosphereSurfaceY).
    y: Number.isFinite(goal?.collarY) ? goal.collarY : (Number(goal?.y) || 0) + FINAL_ROOT_COLLAR_OFFSET,
  };
}

// Onde o desenho da raiz fica ancorado: sempre `goal.y + OFFSET`, para o córtex
// luminoso continuar em cima do alvo. Quando a superfície (colo) sobe, o tronco
// se estica do colo até aqui — a raiz não sobe junto.
function finalRootAnchorY(goal) {
  return (Number(goal?.y) || 0) + FINAL_ROOT_COLLAR_OFFSET;
}

// Trecho reto do colo até a âncora, em coordenadas locais (null se não há).
function finalRootExtension(goal, scale) {
  const gap = finalRootAnchorY(goal) - finalRootCollar(goal).y;
  if (!(gap > 1)) return null;
  const length = gap / scale;
  const count = Math.max(2, Math.ceil(length / 40));
  return Array.from({ length: count + 1 }, (_, i) => ({ x: 0, y: -length + length * i / count }));
}

/**
 * Limites da raiz em coordenadas de mundo. A cinemática enquadra a câmera com
 * isto — nunca com números copiados à mão.
 */
export function finalRootBounds(goal, scale = FINAL_ROOT_SCALE) {
  const collar = finalRootCollar(goal);
  const anchorY = Math.max(collar.y, finalRootAnchorY(goal));
  let minX = collar.x;
  let maxX = collar.x;
  let maxY = collar.y;
  const consider = point => {
    const x = collar.x + point.x * scale;
    const y = anchorY + point.y * scale;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const point of FINAL_ROOT_MAIN_LOCAL) consider(point);
  for (const branch of FINAL_ROOT_BRANCHES_LOCAL) for (const point of branch) consider(point);
  return { collarX: collar.x, collarY: collar.y, minX, maxX, tipY: maxY };
}

function splinePath(ctx, points) {
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index++) {
    const cx = (points[index].x + points[index + 1].x) / 2;
    const cy = (points[index].y + points[index + 1].y) / 2;
    ctx.quadraticCurveTo(points[index].x, points[index].y, cx, cy);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
}

/**
 * As cinco passadas translúcidas do protótipo, da casca ao filamento.
 *
 * `pulse` acende a aura dourada; é o mesmo parâmetro usado pela conclusão da
 * fase, então o pulso corre pela raiz que já estava desenhada em vez de por uma
 * cópia acesa por cima.
 */
function drawRootPath(ctx, points, baseWidth, pulse) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pulse > 0.02) {
    ctx.beginPath(); splinePath(ctx, points);
    ctx.strokeStyle = `rgba(255, 230, 150, ${pulse * 0.45})`;
    ctx.lineWidth = baseWidth * 2.2;
    ctx.shadowColor = 'rgba(255, 235, 170, 0.9)';
    ctx.shadowBlur = 30 + pulse * 40;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  const layers = [
    ['rgba(160, 110, 65, 0.28)', 1],
    ['rgba(225, 185, 130, 0.42)', 0.74],
    ['rgba(248, 228, 185, 0.62)', 0.5],
    ['rgba(255, 253, 245, 0.96)', 0.24],
    ['#ffffff', Math.max(1.2 / baseWidth, 0.09)],
  ];
  for (const [color, factor] of layers) {
    ctx.beginPath(); splinePath(ctx, points);
    ctx.strokeStyle = color;
    ctx.lineWidth = baseWidth * factor;
    ctx.stroke();
  }
  ctx.restore();
}

// Amostra a mesma spline de `splinePath` (quadráticas pelos pontos médios).
function sampleSpline(points, perSegment = 6) {
  const out = [{ x: points[0].x, y: points[0].y }];
  let from = points[0];
  for (let index = 1; index < points.length - 1; index++) {
    const control = points[index];
    const to = index < points.length - 2
      ? { x: (points[index].x + points[index + 1].x) / 2, y: (points[index].y + points[index + 1].y) / 2 }
      : points[points.length - 1];
    for (let step = 1; step <= perSegment; step++) {
      const t = step / perSegment;
      const u = 1 - t;
      out.push({
        x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
        y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
      });
    }
    from = to;
  }
  return out;
}

function traceTube(ctx, samples, widthAt) {
  const left = [];
  const right = [];
  samples.forEach((point, index) => {
    const prev = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const len = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
    const nx = -(next.y - prev.y) / len;
    const ny = (next.x - prev.x) / len;
    const half = widthAt(index / (samples.length - 1)) / 2;
    left.push([point.x + nx * half, point.y + ny * half]);
    right.push([point.x - nx * half, point.y - ny * half]);
  });
  const tip = samples[samples.length - 1];
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const point of left) ctx.lineTo(point[0], point[1]);
  ctx.quadraticCurveTo(tip.x, tip.y + widthAt(1) * 1.2, right[right.length - 1][0], right[right.length - 1][1]);
  for (let index = right.length - 1; index >= 0; index--) ctx.lineTo(right[index][0], right[index][1]);
  ctx.closePath();
}

// A raiz-objetivo com a MESMA textura celular das outras raízes (faixas do
// autor: epiderme verde, camada cinza, córtex) e o brilho por cima.
function drawTexturedMain(ctx, points, baseWidth, taper = .62) {
  const samples = sampleSpline(points);
  const widthAt = t => baseWidth * (1 - t * taper);
  ctx.save();
  traceTube(ctx, samples, widthAt);
  ctx.fillStyle = ROOT_PALETTE.innerBase;
  ctx.fill();
  ctx.clip();
  // Em fatias, para as faixas acompanharem a raiz quando ela entorta.
  const slice = 4;
  for (let index = 0; index < samples.length - 1; index += slice) {
    const top = samples[index];
    const bottom = samples[Math.min(samples.length - 1, index + slice)];
    ctx.save();
    ctx.beginPath();
    ctx.rect(-600, top.y - .5, 1200, bottom.y - top.y + 1);
    ctx.clip();
    paintRootTissueVertical(
      ctx, 7919 + index, (top.x + bottom.x) / 2, top.y - 4, bottom.y + 4,
      widthAt(index / (samples.length - 1)) * .62,
    );
    ctx.restore();
  }
  ctx.restore();
  ctx.save();
  traceTube(ctx, samples, widthAt);
  ctx.strokeStyle = ROOT_PALETTE.outline;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function drawTexturedBranch(ctx, points, baseWidth) {
  const samples = sampleSpline(points, 8);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const stroke = (color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath(); splinePath(ctx, points); ctx.stroke();
  };
  stroke(ROOT_PALETTE.outline, baseWidth + 4);
  stroke(ROOT_PALETTE.green[1], baseWidth);
  stroke(ROOT_PALETTE.blue[0], baseWidth * .7);
  stroke(ROOT_PALETTE.ochreLarge[1], baseWidth * .46);
  ctx.strokeStyle = ROOT_PALETTE.ochreStroke;
  ctx.lineWidth = 2;
  for (let index = 1; index < samples.length - 1; index++) {
    const a = samples[index];
    const b = samples[index + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const px = -(b.y - a.y) / len * baseWidth * .3;
    const py = (b.x - a.x) / len * baseWidth * .3;
    ctx.beginPath(); ctx.moveTo(a.x - px, a.y - py); ctx.lineTo(a.x + px, a.y + py); ctx.stroke();
  }
  ctx.restore();
}

// Brilho do objetivo aplicado POR CIMA do tecido: aura dourada translúcida e um
// filamento claro no eixo. O pulso de conclusão só acende mais.
function drawObjectiveGlow(ctx, points, baseWidth, pulse) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath(); splinePath(ctx, points);
  // Aura só nas bordas (traço largo e fraco): o tecido continua legível.
  ctx.strokeStyle = `rgba(255, 222, 140, ${.1 + pulse * .3})`;
  ctx.lineWidth = baseWidth * (1.3 + pulse);
  ctx.shadowColor = 'rgba(255, 225, 140, .8)';
  ctx.shadowBlur = 18 + pulse * 40;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath(); splinePath(ctx, points);
  ctx.strokeStyle = `rgba(255, 246, 215, ${.32 + pulse * .45})`;
  ctx.lineWidth = Math.max(2.5, baseWidth * .09);
  ctx.stroke();
  ctx.restore();
}

/**
 * Desenha a raiz final em coordenadas de MUNDO, com o colo em `goal`.
 *
 * Único ponto de desenho da raiz principal no jogo inteiro. `pulse` vai de 0 (em
 * jogo) a 1 (pulso de conclusão) e não altera geometria nenhuma — só acende.
 */
export function drawFinalRoot(ctx, goal, { pulse = 0, scale = FINAL_ROOT_SCALE, time = 0 } = {}) {
  if (!goal) return false;
  const collar = finalRootCollar(goal);
  const glow = Math.max(0, Math.min(1, Number(pulse) || 0));
  const extension = finalRootExtension(goal, scale);

  ctx.save();
  ctx.translate(collar.x, Math.max(collar.y, finalRootAnchorY(goal)));
  ctx.scale(scale, scale);

  if (GEOMETRY_ENABLED) {
    // Tronco do colo até a âncora, na largura do topo da raiz (sem afinar).
    if (extension) {
      drawTexturedMain(ctx, extension, MAIN_WIDTH_LOCAL, 0);
      drawObjectiveGlow(ctx, extension, MAIN_WIDTH_LOCAL, glow * .6);
    }
    FINAL_ROOT_BRANCHES_LOCAL.forEach((branch, index) => drawTexturedBranch(ctx, branch, branchWidthLocal(index)));
    drawTexturedMain(ctx, FINAL_ROOT_MAIN_LOCAL, MAIN_WIDTH_LOCAL);
    FINAL_ROOT_BRANCHES_LOCAL.forEach((branch, index) => (
      drawObjectiveGlow(ctx, branch, branchWidthLocal(index), glow * .4)
    ));
    drawObjectiveGlow(ctx, FINAL_ROOT_MAIN_LOCAL, MAIN_WIDTH_LOCAL, glow * .6);
  } else {
    FINAL_ROOT_BRANCHES_LOCAL.forEach((branch, index) => {
      drawRootPath(ctx, branch, branchWidthLocal(index), glow * 0.4);
    });
    if (extension) drawRootPath(ctx, extension, MAIN_WIDTH_LOCAL, glow * 0.6);
    drawRootPath(ctx, FINAL_ROOT_MAIN_LOCAL, MAIN_WIDTH_LOCAL, glow * 0.6);
  }

  // O halo do córtex luminoso, que é o alvo do jogador durante a fase.
  const breath = 1 + Math.sin(time * 2.1) * 0.05;
  const halo = ctx.createRadialGradient(0, 120, 10, 0, 120, (200 + glow * 90) * breath);
  halo.addColorStop(0, `rgba(255, 240, 180, ${0.22 + glow * 0.22})`);
  halo.addColorStop(0.5, `rgba(255, 220, 140, ${0.09 + glow * 0.13})`);
  halo.addColorStop(1, 'rgba(255, 220, 120, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 120, (200 + glow * 90) * breath, 0, TAU);
  ctx.fill();

  ctx.restore();
  return true;
}
