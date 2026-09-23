// ARQUITETURA RADICULAR — crescida, não carimbada
// ===============================================
//
// Cada planta tem uma raiz principal que desce do colo. As laterais de 1ª ordem
// CRESCEM passo a passo (direção + gravitropismo + ruído + atração pelo alvo);
// as de 2ª ordem brotam delas; pelos só perto das pontas. Nenhum trecho é
// copiado de outro: tudo sai de uma semente por raiz. Só desenho — nada daqui é
// lido pela física.
//
// Desenho: tubo afunilado (polígono pelas bordas) com a textura de tecido do
// autor (epiderme verde, camada cinza, córtex ocre) e sombreamento cilíndrico
// por cima — sombra de um lado, realce e brilho do outro.

import { ROOT_PALETTE, clamp, paintRootTissueVertical } from './root-tissue.js';

const TAU = Math.PI * 2;

export function seededRandom(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ------------------------------------------------------------ crescimento --

function nearPlatform(x, y, platforms, pad = 12) {
  for (const p of platforms) {
    if (x > p.x - pad && x < p.x + p.w + pad && y > p.y - 46 && y < p.y + p.h + 4) return true;
  }
  return false;
}

// Cresce uma raiz a partir de (x, y) com ângulo inicial. `target` opcional
// atrai a ponta; sem alvo, o gravitropismo puxa para baixo.
function growPath({ x, y, angle, length, step = 7, random, target = null, gravity = .06, wiggle = .16, avoid = null }) {
  const points = [[x, y]];
  let heading = angle;
  let travelled = 0;
  let px = x;
  let py = y;
  for (let guard = 0; guard < 400 && travelled < length; guard++) {
    if (target) {
      const desired = Math.atan2(target[1] - py, target[0] - px);
      let diff = desired - heading;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      const pull = clamp(travelled / Math.max(40, length) * .5 + .12, .12, .55);
      heading += clamp(diff, -.3, .3) * pull;
      if (Math.hypot(target[0] - px, target[1] - py) < step * 1.2) {
        points.push([target[0], target[1]]);
        return points;
      }
    } else {
      let diff = Math.PI / 2 - heading;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      heading += diff * gravity;
    }
    heading += (random() - .5) * wiggle;
    px += Math.cos(heading) * step;
    py += Math.sin(heading) * step;
    if (avoid && avoid(px, py)) break;
    points.push([px, py]);
    travelled += step;
  }
  return points;
}

// Arco da principal até a entrada do bloco: sai para o lado e chega na
// horizontal. Controles e ondulação sorteados por raiz — nunca dá laço.
function arcPath(start, end, random) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const k1 = .25 + random() * .25;
  const k2 = .25 + random() * .2;
  const c1 = [start[0] + dx * k1, start[1] + dy * (.1 + random() * .15) + 8];
  const c2 = [end[0] - dx * k2, end[1] - random() * 6];
  const length = Math.hypot(dx, dy);
  const steps = Math.max(8, Math.ceil(length / 6));
  const phaseA = random() * TAU;
  const phaseB = random() * TAU;
  const ampA = 2 + random() * 4;
  const ampB = 1 + random() * 2;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * u * start[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * end[0];
    const y = u * u * u * start[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * end[1];
    const envelope = Math.sin(t * Math.PI);
    const wobble = (Math.sin(t * 7 + phaseA) * ampA + Math.sin(t * 17 + phaseB) * ampB) * envelope;
    points.push([x, y + wobble]);
  }
  return points;
}

function taper(points, from, to, curve = 1) {
  const n = points.length - 1 || 1;
  return points.map((_, i) => from + (to - from) * Math.pow(i / n, curve));
}

function sideBranches(parent, random, platforms, { count, order, maxLen, widthScale }) {
  const out = [];
  const pts = parent.points;
  if (pts.length < 6) return out;
  for (let b = 0; b < count; b++) {
    const t = .18 + random() * .68;
    const i = Math.floor(t * (pts.length - 2)) + 1;
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    const heading = Math.atan2(ny - y, nx - x);
    const side = random() < .5 ? -1 : 1;
    let angle = heading + side * (.65 + random() * .6);
    if (Math.sin(angle) < -.15) angle = heading - side * (.65 + random() * .6);
    const length = maxLen * (.35 + random() * .65);
    const points = growPath({
      x, y, angle, length, step: 5, random, gravity: .05, wiggle: .22,
      avoid: (px, py) => nearPlatform(px, py, platforms, 4),
    });
    if (points.length < 3) continue;
    const w0 = Math.max(1.2, parent.widths[i] * widthScale);
    out.push({ points, widths: taper(points, w0, .8, .8), order, hairs: true, layer: parent.layer });
  }
  return out;
}

/**
 * Monta todas as raízes de uma planta.
 * `links`: laterais que precisam chegar a blocos ({ attachY, entry:[x,y], side, band }).
 */
export function growPlantRoots({ plant, surface, tipY, links, platforms, mainWidth }) {
  const random = seededRandom(plant.seed * 7 + 13);
  const roots = [];
  // Principal: desce sinuosa, com gravitropismo forte.
  const mainPoints = growPath({
    x: plant.x, y: surface, angle: Math.PI / 2, length: tipY - surface, step: 9,
    random, gravity: .22, wiggle: .1,
  });
  const main = {
    points: mainPoints,
    widths: taper(mainPoints, mainWidth, 3, 1.1),
    order: 0, hairs: true, layer: 'back', main: true,
  };
  if (!plant.goal) roots.push(main);
  const mainXAt = y => {
    let best = mainPoints[0];
    for (const p of mainPoints) if (Math.abs(p[1] - y) < Math.abs(best[1] - y)) best = p;
    return best;
  };
  const mainWidthAt = y => {
    const idx = mainPoints.findIndex(p => p[1] >= y);
    return main.widths[Math.max(0, idx)] || 4;
  };

  // Laterais que alimentam blocos.
  for (const link of links) {
    const start = plant.goal ? [plant.x, link.attachY] : mainXAt(link.attachY);
    const out = link.entry[0] >= start[0] ? 1 : -1;
    // Nasce de dentro da principal, um pouco para o lado de onde vai.
    const arc = arcPath([start[0] + out * mainWidthAt(start[1]) * .15, start[1]], link.blockCenters[0], random);
    // Sempre mais fina que a principal no ponto de onde sai: a principal
    // cobre a junta.
    const w0 = mainWidthAt(start[1]) * .6;
    const arcWidths = taper(arc, w0, w0 * .85, 1);
    const points = arc.slice(0, -1).concat(link.blockCenters);
    const widths = arcWidths.slice(0, -1).concat(link.blockWidths);
    const lateral = { points, widths, order: 1, hairs: false, noCap: true, layer: 'link', linkIndex: link.index };
    roots.push(lateral);
    const arcOnly = { points: arc, widths: arcWidths, layer: 'link' };
    roots.push(...sideBranches(arcOnly, random, platforms, { count: Math.floor(arc.length / 14), order: 2, maxLen: 34, widthScale: .35 }));
  }

  // Laterais livres ao longo da principal: dão a arquitetura da planta.
  if (!plant.goal) {
    const free = Math.floor((tipY - surface) / 62);
    let side = random() < .5 ? -1 : 1;
    for (let k = 0; k < free; k++) {
      const t = .12 + (k + random() * .7) / Math.max(1, free) * .8;
      const i = Math.floor(t * (mainPoints.length - 1));
      const [x, y] = mainPoints[i];
      side = random() < .72 ? -side : side;
      const angle = side > 0 ? .45 + random() * .6 : Math.PI - .45 - random() * .6;
      const length = 55 + random() * 150 * (1 - t * .5);
      const points = growPath({
        x: x + side * main.widths[i] * .3, y, angle, length, step: 6, random,
        gravity: .045 + random() * .05, wiggle: .2,
        avoid: (px, py) => nearPlatform(px, py, platforms),
      });
      if (points.length < 4) continue;
      const w0 = Math.max(1.6, main.widths[i] * (.3 + random() * .12));
      const lateral = { points, widths: taper(points, w0, 1, .9), order: 1, hairs: true, layer: 'back' };
      roots.push(lateral);
      roots.push(...sideBranches(lateral, random, platforms, { count: Math.floor(points.length / 9), order: 2, maxLen: 30, widthScale: .4 }));
    }
  }
  return { roots, main };
}

// ---------------------------------------------------------------- desenho --

function outline(points, widths) {
  const left = [];
  const right = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    const h = widths[i] / 2;
    left.push([points[i][0] + nx * h, points[i][1] + ny * h, nx, ny]);
    right.push([points[i][0] - nx * h, points[i][1] - ny * h, -nx, -ny]);
  }
  return { left, right };
}

function traceShape(ctx, left, right, tipRound = true) {
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
  const l = left[left.length - 1];
  const r = right[right.length - 1];
  if (tipRound) {
    const tx = (l[0] + r[0]) / 2 - (l[2] - r[2]) * 0;
    const n = left.length - 1;
    const a = left[Math.max(0, n - 1)];
    const dx = (l[0] + r[0]) / 2 - (a[0] + right[Math.max(0, n - 1)][0]) / 2;
    const dy = (l[1] + r[1]) / 2 - (a[1] + right[Math.max(0, n - 1)][1]) / 2;
    const d = Math.hypot(dx, dy) || 1;
    const w = Math.hypot(l[0] - r[0], l[1] - r[1]);
    ctx.quadraticCurveTo(tx + dx / d * w * 1.1, (l[1] + r[1]) / 2 + dy / d * w * 1.1, r[0], r[1]);
  } else {
    ctx.lineTo(r[0], r[1]);
  }
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
}

/**
 * Desenha uma raiz com a textura do autor, CONTÍNUA (sem fatias):
 * - principal: as camadas de células em faixas verticais numa passada só,
 *   recortadas pelo contorno afunilado;
 * - laterais e ramificações: as mesmas camadas em miniatura (epiderme verde,
 *   faixa cinza, córtex ocre) com as paredes celulares em tracinhos.
 * `palette` define o quanto ela recua (paleta apagada para o fundo).
 */
export function drawRootTube(ctx, root, { palette = ROOT_PALETTE, seed = 1, time = 0, fade = 0 } = {}) {
  const { points, widths } = root;
  if (points.length < 2) return;
  const maxW = Math.max(...widths);

  ctx.save();
  if (root.main && maxW >= 8) {
    const { left, right } = outline(points, widths);
    let minY = Infinity; let maxY = -Infinity; let sumX = 0;
    for (const [x, y] of points) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); sumX += x; }
    traceShape(ctx, left, right);
    ctx.fillStyle = palette.innerBase;
    ctx.fill();
    ctx.save();
    ctx.clip();
    paintRootTissueVertical(ctx, seed, sumX / points.length, minY - 4, maxY + 12, maxW * .62 + 8, palette);
    ctx.restore();
    traceShape(ctx, left, right);
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const stroke = (color, factor, extra = 0) => {
      ctx.strokeStyle = color;
      for (let i = 0; i < points.length - 1; i++) {
        ctx.lineWidth = Math.max(.5, widths[i] * factor + extra);
        ctx.beginPath(); ctx.moveTo(points[i][0], points[i][1]); ctx.lineTo(points[i + 1][0], points[i + 1][1]); ctx.stroke();
      }
    };
    stroke(palette.outline, 1, 1.6);
    stroke(palette.green[1], 1);
    if (maxW >= 3) {
      stroke(palette.blue[0], .7);
      stroke(palette.ochreLarge[1], .46);
      // Paredes celulares ao longo do córtex (divisão celular).
      ctx.strokeStyle = palette.ochreStroke;
      ctx.lineWidth = .7;
      for (let i = 1; i < points.length - 1; i++) {
        if (widths[i] < 3) continue;
        const [x, y] = points[i];
        const [nx, ny] = points[i + 1];
        const len = Math.hypot(nx - x, ny - y) || 1;
        const px = -(ny - y) / len * widths[i] * .3;
        const py = (nx - x) / len * widths[i] * .3;
        ctx.beginPath(); ctx.moveTo(x - px, y - py); ctx.lineTo(x + px, y + py); ctx.stroke();
      }
    }
  }
  // Coifa translúcida na ponta.
  const tip = points[points.length - 1];
  const tipW = widths[widths.length - 1];
  if (tipW > 1.2 && !root.noCap) {
    const r = tipW * 1.8 + 2;
    const cap = ctx.createRadialGradient(tip[0], tip[1], .5, tip[0], tip[1], r);
    cap.addColorStop(0, `rgba(255,244,218,${.4 - fade * .25})`);
    cap.addColorStop(1, 'rgba(255,244,218,0)');
    ctx.fillStyle = cap;
    ctx.beginPath(); ctx.arc(tip[0], tip[1], r, 0, TAU); ctx.fill();
  }
  // Pelos radiculares na zona de maturação (terço perto da ponta): finos,
  // esparsos, cada um com comprimento e curva próprios.
  if (root.hairs && maxW >= 1.5) {
    const random = seededRandom(seed * 3 + 1);
    const start = Math.floor(points.length * .66);
    ctx.lineCap = 'round';
    ctx.lineWidth = .55;
    for (let i = start; i < points.length - 2; i++) {
      if (random() > .38) continue;
      const [x, y] = points[i];
      const [nx, ny] = points[i + 1];
      const len = Math.hypot(nx - x, ny - y) || 1;
      const s = random() < .5 ? -1 : 1;
      const px = -(ny - y) / len * s;
      const py = (nx - x) / len * s;
      const h = widths[i] / 2;
      const l = 4 + random() * (5 + widths[i] * 1.4);
      const bend = (random() - .5) * l * .8 + Math.sin(time * 1.2 + i) * .6;
      ctx.strokeStyle = `rgba(240,230,200,${(.22 + random() * .22) * (1 - fade * .5)})`;
      ctx.beginPath();
      ctx.moveTo(x + px * h, y + py * h);
      ctx.quadraticCurveTo(
        x + px * (h + l * .55) + (nx - x) / len * bend, y + py * (h + l * .55) + (ny - y) / len * bend,
        x + px * (h + l), y + py * (h + l) + l * .2,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}
