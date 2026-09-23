// Iluminação e atmosfera da rizosfera.
//
// Camada puramente visual, desenhada DEPOIS do mundo e dos organismos. Não lê
// nem escreve nada que a física, a coleta, os tutoriais ou o áudio usem.
//
//   1. Profundidade das plataformas (mundo): sombra de contato sob cada bloco e
//      borda superior iluminada, para os blocos "assentarem" no solo.
//   2. Feixes de luz (mundo): luz que desce da superfície por fissuras e
//      galerias, com partículas em suspensão.
//   3. Escuridão (tela): camada de baixa resolução que escurece o fundo pela
//      profundidade e nas bordas, recortada por luzes do jogador, dos exsudatos,
//      dos microrganismos e do objetivo.
//   4. Brilhos aditivos (mundo): halos coloridos das fontes de luz.
//   5. Primeiro plano (tela): silhuetas de raízes e agregados passando à frente
//      da câmera com parallax maior que 1.
//
// Desliga com `?luz=0` na URL ou com a tecla L durante o jogo, para comparar.

const TAU = Math.PI * 2;
const DARK_SCALE = 4; // escuridão calculada em 1/4 da resolução e ampliada com suavização
const SHAFT_SPACING = 760;
const FG_FACTOR = 1.32;
const FG_TILE = 1400;

function hash(seed, i) {
  const x = Math.sin((seed + 1) * 127.1 + i * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function seedFrom(value) {
  const text = String(value ?? 'rizosfera');
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100000;
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function readLightingPreference(locationLike) {
  try {
    const params = new URLSearchParams(locationLike?.search || '');
    const value = params.get('luz');
    if (value === null) return true;
    return !['0', 'off', 'false', 'nao', 'não'].includes(value.toLowerCase());
  } catch (_) {
    return true;
  }
}

export function createRhizosphereLighting({ canvas, state, getAgents, enabled = true }) {
  const doc = canvas?.ownerDocument || (typeof document === 'undefined' ? null : document);
  const dark = doc ? doc.createElement('canvas') : null;
  const dctx = dark ? dark.getContext('2d') : null;
  let on = enabled;
  // Transição suave: entra ao começar a jogar, sai ao desligar e na cinemática final.
  let fade = 0;
  let lastTime = null;
  let lastRenderMs = 0;
  let levelKey = null;
  let shafts = [];
  let fgPieces = [];
  let seed = 0;
  // Gradientes radiais custam caro quando há dezenas de fontes: cada luz e cada
  // halo vira um sprite pré-renderizado, desenhado com drawImage + globalAlpha.
  const glowCache = new Map();
  let stampSprite = null;

  function radialSprite(color, stops) {
    if (!doc) return null;
    const size = 128;
    const c = doc.createElement('canvas');
    c.width = size; c.height = size;
    const g2 = c.getContext('2d');
    const g = g2.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, a] of stops) g.addColorStop(o, rgba(color, a));
    g2.fillStyle = g;
    g2.fillRect(0, 0, size, size);
    return c;
  }

  function glowSprite(color) {
    let c = glowCache.get(color);
    if (!c) {
      c = radialSprite(color, [[0, 1], [.35, .45], [1, 0]]);
      glowCache.set(color, c);
    }
    return c;
  }

  function rebuild(level) {
    seed = seedFrom(level?.seed ?? level?.phaseTitle ?? 'rizosfera');
    shafts = [];
    const x0 = -200;
    const x1 = (Number(level?.endX) || 4000) + 600;
    let i = 0;
    for (let x = x0 + hash(seed, 1) * SHAFT_SPACING; x < x1; x += SHAFT_SPACING * (.7 + hash(seed, i * 7 + 3) * .6)) {
      shafts.push({
        x,
        w: 70 + hash(seed, i * 5 + 11) * 90,
        slant: .16 + hash(seed, i * 3 + 17) * .14,
        phase: hash(seed, i * 13 + 5) * TAU,
        strength: .55 + hash(seed, i * 19 + 2) * .45,
        motes: Array.from({ length: 12 }, (_, k) => ({
          u: hash(seed, i * 101 + k * 3),
          v: hash(seed, i * 101 + k * 3 + 1),
          s: .6 + hash(seed, i * 101 + k * 3 + 2) * 1.6,
        })),
      });
      i++;
    }
    fgPieces = [];
    for (let k = 0; k < 7; k++) {
      const top = true; // só raízes pendentes: agregados na base cobriam hazards e o piso
      fgPieces.push({
        x: hash(seed, 420 + k) * FG_TILE,
        top,
        len: top ? 70 + hash(seed, 440 + k) * 110 : 40 + hash(seed, 440 + k) * 50,
        w: top ? 10 + hash(seed, 460 + k) * 16 : 90 + hash(seed, 460 + k) * 140,
        bend: (hash(seed, 480 + k) - .5) * 40,
        kind: k,
      });
    }
  }

  function geometryBounds() {
    const level = state.level || {};
    const top = Number.isFinite(level.geometryTopY) ? level.geometryTopY : (Number.isFinite(level.worldTopY) ? level.worldTopY : 0);
    const bottom = Number.isFinite(level.geometryBottomY) ? level.geometryBottomY : (Number.isFinite(level.worldBottomY) ? level.worldBottomY : 720);
    return { top, bottom };
  }

  // ---------- 1. profundidade das plataformas (coordenadas de mundo) ----------
  function renderPlatformDepth(ctx) {
    if (fade <= .01) return;
    const level = state.level;
    if (!level?.platforms) return;
    const camX = state.cameraX || 0;
    const camY = state.cameraY || 0;
    const zoom = state.cameraZoom || 1;
    const vw = (canvas.width || 1280) / zoom;
    const vh = (canvas.height || 720) / zoom;
    ctx.save();
    ctx.translate(-camX, 0);
    for (const p of level.platforms) {
      if (p.x + p.w < camX - 80 || p.x > camX + vw + 80) continue;
      if (p.y > camY + vh + 120 || p.y + p.h < camY - 120) continue;
      if (p.recovery && state.recoveryPlatformsDisabled) continue;
      if (p.mycorrhizaStructure || p.azospirillumStructure) continue;

      // So sombra de contato. O antigo rim claro em TODA plataforma fazia
      // cada bloco parecer autoiluminado e tirava a leitura do feixe.
      const sh = Math.min(62, 22 + p.w * .07);
      const g = ctx.createLinearGradient(0, p.y + p.h - 4, 0, p.y + p.h + sh);
      g.addColorStop(0, 'rgba(2,6,9,' + (.30 * fade) + ')');
      g.addColorStop(1, 'rgba(2,6,9,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p.x + p.w / 2, p.y + p.h - 3, p.w * .54, sh, 0, 0, Math.PI);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- helpers de projeção ----------
  function project(m, wx, wy) {
    const x = wx - (state.cameraX || 0);
    return [m.a * x + m.c * wy + m.e, m.b * x + m.d * wy + m.f];
  }

  function beamHalfWidthAtY(shaft, y, yTop, yBottom) {
    const span = Math.max(1, yBottom - yTop);
    const u = Math.max(0, Math.min(1, (y - yTop) / span));
    return shaft.w * (.30 + u * .48);
  }

  function beamCenterAtY(shaft, y, yTop) {
    return shaft.x + (y - yTop) * shaft.slant;
  }

  function firstShaftImpact(shaft, yTop, yBottom) {
    const platforms = state.level?.platforms || [];
    let best = null;
    for (const p of platforms) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.w) || !Number.isFinite(p.h)) continue;
      if (p.recovery && state.recoveryPlatformsDisabled) continue;
      if (p.mycorrhizaStructure || p.azospirillumStructure) continue;
      if (p.y < yTop || p.y > yBottom) continue;

      const center = beamCenterAtY(shaft, p.y, yTop);
      const half = beamHalfWidthAtY(shaft, p.y, yTop, yBottom);
      const left = Math.max(p.x, center - half);
      const right = Math.min(p.x + p.w, center + half);
      if (right - left < 3) continue;

      if (!best || p.y < best.y || (p.y === best.y && right - left > best.right - best.left)) {
        best = { platform: p, y: p.y, center, half, left, right };
      }
    }
    return best;
  }

  function collectShaftImpacts() {
    const bounds = geometryBounds();
    const yTop = bounds.top - 260;
    const yBottom = bounds.bottom + 60;
    return {
      yTop,
      yBottom,
      items: shafts.map(shaft => ({
        shaft,
        impact: firstShaftImpact(shaft, yTop, yBottom),
      })),
    };
  }

  function roundedScreenRect(ctx, x, y, w, h, radius) {
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function collectLights() {
    const level = state.level || {};
    const t = state.time || 0;
    const lights = [];
    const p = state.player;
    if (p) {
      const x = p.x + (p.w || 32) / 2;
      const y = p.y + (p.h || 48) * .45;
      // Como no prototipo: halo amplo mais um nucleo claro.
      lights.push({ x, y, r: 300, a: .56, color: '#bfeee6', glow: .05 });
      lights.push({ x, y, r: 140, a: .86, color: '#dffbf3', glow: .09 });
    }
    for (const e of level.exudates || []) {
      if (e.taken) continue;
      lights.push({ x: e.x, y: e.y, r: 105, a: .58, color: '#9df27a', glow: .20 + Math.sin(t * 3 + e.x) * .04 });
    }
    for (const c of level.checkpoints || []) {
      lights.push({ x: c.x, y: c.y, r: c.active ? 155 : 105, a: c.active ? .66 : .42, color: '#f3dc86', glow: c.active ? .22 : .09 });
    }
    for (const b of level.biofilms || []) {
      if (Number.isFinite(b.x)) lights.push({ x: b.x, y: b.y, r: 135, a: .48, color: '#f3dc86', glow: .16 });
    }
    if (level.goal && Number.isFinite(level.goal.x)) {
      lights.push({ x: level.goal.x, y: level.goal.y, r: 300, a: .78, color: '#ffe7a8', glow: .24 + Math.sin(t * 1.6) * .04 });
    }
    // Nao perfura a escuridao com todos os agentes ambientais.
    return lights;
  }

  // ---------- 2. feixes de luz ----------
  function drawShafts(ctx, m, zoom, W, H, t, shaftImpacts) {
    const yTop = shaftImpacts.yTop;
    const yBottom = shaftImpacts.yBottom;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (const item of shaftImpacts.items) {
      const s = item.shaft;
      const impact = item.impact;
      const yEnd = impact ? impact.y : yBottom;
      if (yEnd <= yTop + 1) continue;

      const breathe = .80 + Math.sin(t * .45 + s.phase) * .20;
      const alpha = .075 * s.strength * breathe * fade;
      const xTop = beamCenterAtY(s, yTop, yTop);
      const xEnd = beamCenterAtY(s, yEnd, yTop);
      const topPoint = project(m, xTop, yTop);
      const endPoint = project(m, xEnd, yEnd);
      const ax = topPoint[0], ay = topPoint[1];
      const bx = endPoint[0], by = endPoint[1];
      const halfTop = beamHalfWidthAtY(s, yTop, yTop, yBottom) * zoom;
      const halfEnd = beamHalfWidthAtY(s, yEnd, yTop, yBottom) * zoom;
      if (Math.max(ax, bx) + halfEnd < -40 || Math.min(ax, bx) - halfEnd > W + 40) continue;

      // Feixe externo: existe no ar, mas nao e um trapezio branco opaco.
      const outer = ctx.createLinearGradient(0, ay, 0, by);
      outer.addColorStop(0, 'rgba(255,241,205,' + (alpha * .45) + ')');
      outer.addColorStop(.68, 'rgba(239,235,202,' + alpha + ')');
      outer.addColorStop(1, 'rgba(255,226,170,' + (alpha * 1.15) + ')');
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.moveTo(ax - halfTop, ay);
      ctx.lineTo(ax + halfTop, ay);
      ctx.lineTo(bx + halfEnd, by);
      ctx.lineTo(bx - halfEnd, by);
      ctx.closePath();
      ctx.fill();

      // Nucleo estreito para sugerir volume.
      const coreTop = halfTop * .34;
      const coreEnd = halfEnd * .38;
      const core = ctx.createLinearGradient(0, ay, 0, by);
      core.addColorStop(0, 'rgba(255,248,224,0)');
      core.addColorStop(.35, 'rgba(255,247,218,' + (alpha * .65) + ')');
      core.addColorStop(1, 'rgba(255,231,180,' + (alpha * 1.35) + ')');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.moveTo(ax - coreTop, ay);
      ctx.lineTo(ax + coreTop, ay);
      ctx.lineTo(bx + coreEnd, by);
      ctx.lineTo(bx - coreEnd, by);
      ctx.closePath();
      ctx.fill();

      // Particulas param na mesma superficie que bloqueia a luz.
      for (const mo of s.motes) {
        const v = (mo.v + t * .018 * mo.s) % 1;
        const wy = yTop + 70 + v * Math.max(1, yEnd - yTop - 85);
        if (wy >= yEnd) continue;
        const center = beamCenterAtY(s, wy, yTop);
        const half = beamHalfWidthAtY(s, wy, yTop, yBottom);
        const wx = center + (mo.u - .5) * half * 1.3 + Math.sin(t * .7 + mo.u * 20) * 5;
        const pp = project(m, wx, wy);
        const px = pp[0], py = pp[1];
        if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
        const tw = .5 + .5 * Math.sin(t * 2.2 + mo.u * 40);
        ctx.fillStyle = 'rgba(255,244,214,' + ((.12 + tw * .25) * fade) + ')';
        ctx.beginPath();
        ctx.arc(px, py, mo.s * zoom, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawSoilIllumination(ctx, m, zoom, W, H, shaftImpacts) {
    ctx.save();
    for (const item of shaftImpacts.items) {
      const s = item.shaft;
      const impact = item.impact;
      if (!impact) continue;
      const p = impact.platform;

      const a = project(m, p.x, p.y);
      const b = project(m, p.x + p.w, p.y + p.h);
      const left = Math.min(a[0], b[0]);
      const top = Math.min(a[1], b[1]);
      const width = Math.abs(b[0] - a[0]);
      const height = Math.abs(b[1] - a[1]);
      if (left + width < 0 || left > W || top + height < 0 || top > H) continue;

      const q0 = project(m, impact.left, impact.y);
      const q1 = project(m, impact.right, impact.y);
      const qc = project(m, impact.center, impact.y);
      const lo = Math.min(q0[0], q1[0]);
      const hi = Math.max(q0[0], q1[0]);
      const icx = qc[0], icy = qc[1];
      const footprint = Math.max(22 * zoom, hi - lo);
      const radius = Math.max(70 * zoom, footprint * .72);
      const penetration = Math.min(height * .78, Math.max(65 * zoom, footprint * .82));

      // A textura ja desenhada e clareada dentro da propria plataforma.
      ctx.save();
      roundedScreenRect(ctx, left, top, width, height, Math.min(22 * zoom, height * .16));
      ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      ctx.translate(icx, icy);
      ctx.scale(1, Math.max(.70, penetration / radius));
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      const power = (.18 + s.strength * .18) * fade;
      glow.addColorStop(0, 'rgba(255,224,157,' + (power * 1.35) + ')');
      glow.addColorStop(.26, 'rgba(255,218,145,' + power + ')');
      glow.addColorStop(.62, 'rgba(245,196,120,' + (power * .42) + ')');
      glow.addColorStop(1, 'rgba(235,174,95,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-radius, 0, radius * 2, radius);
      ctx.restore();

      // Reflexo forte apenas na borda superior atingida.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const edge = ctx.createLinearGradient(lo, 0, hi, 0);
      edge.addColorStop(0, 'rgba(255,226,166,0)');
      edge.addColorStop(.22, 'rgba(255,231,177,' + (.30 * fade) + ')');
      edge.addColorStop(.5, 'rgba(255,246,214,' + (.62 * fade) + ')');
      edge.addColorStop(.78, 'rgba(255,231,177,' + (.30 * fade) + ')');
      edge.addColorStop(1, 'rgba(255,226,166,0)');
      ctx.strokeStyle = edge;
      ctx.lineWidth = Math.max(1.5, 2.2 * zoom);
      ctx.beginPath();
      ctx.moveTo(lo, icy + .5);
      ctx.lineTo(hi, icy + .5);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- 3. escuridão ----------
  function drawDarkness(ctx, m, zoom, W, H, lights, t, shaftImpacts) {
    if (!dctx) return;
    const dw = Math.max(2, Math.ceil(W / DARK_SCALE));
    const dh = Math.max(2, Math.ceil(H / DARK_SCALE));
    if (dark.width !== dw || dark.height !== dh) { dark.width = dw; dark.height = dh; }
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, dw, dh);

    const bounds = geometryBounds();
    const topPoint = project(m, 0, bounds.top - 120);
    const bottomPoint = project(m, 0, bounds.bottom + 80);
    const g = dctx.createLinearGradient(0, topPoint[1] / DARK_SCALE, 0, bottomPoint[1] / DARK_SCALE);
    g.addColorStop(0, 'rgba(2,9,14,.24)');
    g.addColorStop(.55, 'rgba(2,8,13,.48)');
    g.addColorStop(1, 'rgba(1,4,8,.76)');
    dctx.fillStyle = g;
    dctx.fillRect(0, 0, dw, dh);

    const vg = dctx.createRadialGradient(dw / 2, dh * .52, Math.min(dw, dh) * .34, dw / 2, dh * .52, Math.max(dw, dh) * .76);
    vg.addColorStop(0, 'rgba(1,4,8,0)');
    vg.addColorStop(1, 'rgba(1,4,8,.30)');
    dctx.fillStyle = vg;
    dctx.fillRect(0, 0, dw, dh);

    dctx.globalCompositeOperation = 'destination-out';
    if (!stampSprite) stampSprite = radialSprite('#000000', [[0, 1], [.45, .55], [1, 0]]);
    const stamp = (sx, sy, r, a) => {
      const x = sx / DARK_SCALE;
      const y = sy / DARK_SCALE;
      const rr = r / DARK_SCALE;
      if (x + rr < 0 || x - rr > dw || y + rr < 0 || y - rr > dh) return;
      dctx.globalAlpha = a;
      dctx.drawImage(stampSprite, x - rr, y - rr, rr * 2, rr * 2);
    };
    for (const l of lights) {
      const p = project(m, l.x, l.y);
      stamp(p[0], p[1], l.r * zoom, l.a);
    }
    dctx.globalAlpha = 1;

    // O buraco do feixe na escuridao tambem termina no primeiro impacto.
    for (const item of shaftImpacts.items) {
      const s = item.shaft;
      const yStart = shaftImpacts.yTop;
      const yEnd = item.impact ? item.impact.y : shaftImpacts.yBottom;
      if (yEnd <= yStart + 1) continue;
      const breathe = .80 + Math.sin(t * .45 + s.phase) * .20;
      const p0 = project(m, beamCenterAtY(s, yStart, yStart), yStart);
      const p1 = project(m, beamCenterAtY(s, yEnd, yStart), yEnd);
      const half0 = beamHalfWidthAtY(s, yStart, yStart, shaftImpacts.yBottom) * zoom;
      const half1 = beamHalfWidthAtY(s, yEnd, yStart, shaftImpacts.yBottom) * zoom;
      const lg = dctx.createLinearGradient(0, p0[1] / DARK_SCALE, 0, p1[1] / DARK_SCALE);
      lg.addColorStop(0, 'rgba(0,0,0,' + (.22 * s.strength * breathe) + ')');
      lg.addColorStop(.7, 'rgba(0,0,0,' + (.38 * s.strength * breathe) + ')');
      lg.addColorStop(1, 'rgba(0,0,0,' + (.46 * s.strength * breathe) + ')');
      dctx.fillStyle = lg;
      dctx.beginPath();
      dctx.moveTo((p0[0] - half0) / DARK_SCALE, p0[1] / DARK_SCALE);
      dctx.lineTo((p0[0] + half0) / DARK_SCALE, p0[1] / DARK_SCALE);
      dctx.lineTo((p1[0] + half1) / DARK_SCALE, p1[1] / DARK_SCALE);
      dctx.lineTo((p1[0] - half1) / DARK_SCALE, p1[1] / DARK_SCALE);
      dctx.closePath();
      dctx.fill();
    }

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(dark, 0, 0, dw * DARK_SCALE, dh * DARK_SCALE);
    ctx.restore();
  }

  // ---------- 4. brilhos aditivos ----------
  function drawGlows(ctx, m, zoom, W, H, lights) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (!l.glow) continue;
      const [sx, sy] = project(m, l.x, l.y);
      const r = l.r * .42 * zoom;
      if (sx + r < 0 || sx - r > W || sy + r < 0 || sy - r > H) continue;
      const sprite = glowSprite(l.color);
      if (!sprite) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, l.glow * fade));
      ctx.drawImage(sprite, sx - r, sy - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  // ---------- 5. primeiro plano ----------
  function drawForeground(ctx, zoom, W, H, t) {
    const off = ((state.cameraX || 0) * FG_FACTOR * zoom) % (FG_TILE * zoom);
    ctx.save();
    ctx.globalAlpha = .9 * fade;
    for (let tile = -1; tile <= Math.ceil(W / (FG_TILE * zoom)) + 1; tile++) {
      for (const piece of fgPieces) {
        const sx = tile * FG_TILE * zoom + piece.x * zoom - off;
        if (sx < -300 * zoom || sx > W + 300 * zoom) continue;
        if (piece.top) {
          // raiz fina pendendo do teto: forma afunilada preenchida, com pelos
          const sway = Math.sin(t * .6 + piece.kind) * 5 * zoom;
          // comprimento limitado a uma faixa do topo da tela: no celular, com
          // zoom e densidade de pixels maiores, a raiz virava uma agulha longa
          const len = Math.min(piece.len * zoom, H * .17);
          const base = Math.max(piece.w * .7 * zoom, len * .09);
          const bend = piece.bend * zoom;
          const tipX = sx + bend * .6 + sway;
          ctx.fillStyle = '#041116';
          ctx.beginPath();
          ctx.moveTo(sx - base, -12);
          ctx.quadraticCurveTo(sx + bend - base * .4, len * .55, tipX, len);
          ctx.quadraticCurveTo(sx + bend + base * .4, len * .55, sx + base, -12);
          ctx.closePath();
          ctx.fill();
          // contraluz discreta na borda, para a silhueta não virar mancha chapada
          ctx.strokeStyle = 'rgba(120,200,190,.10)';
          ctx.lineWidth = Math.max(1, zoom);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(4,17,22,.75)';
          ctx.lineCap = 'round';
          ctx.lineWidth = Math.max(.8, zoom * .8);
          for (let k = 1; k < 7; k++) {
            const u = k / 7;
            const yy = len * u;
            const cx = sx + (bend * u * (2 - u)) * .8 + sway * u;
            const side = k % 2 ? 1 : -1;
            ctx.beginPath();
            ctx.moveTo(cx, yy);
            ctx.quadraticCurveTo(cx + side * 10 * zoom, yy + 4 * zoom, cx + side * 16 * zoom, yy + 12 * zoom);
            ctx.stroke();
          }
        } else {
          // agregado escuro na base da tela
          const w = piece.w * zoom;
          const h = piece.len * zoom;
          ctx.fillStyle = '#02070a';
          ctx.beginPath();
          ctx.moveTo(sx - w / 2, H + 10);
          ctx.bezierCurveTo(sx - w * .45, H - h * .8, sx - w * .1, H - h * 1.05, sx + w * .1, H - h);
          ctx.bezierCurveTo(sx + w * .4, H - h * .95, sx + w * .5, H - h * .3, sx + w / 2, H + 10);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function render(ctx, { finaleActive = false } = {}) {
    const t = Number.isFinite(state.time) ? state.time : 0;
    const now = typeof performance !== 'undefined' ? performance.now() / 1000 : t;
    const dt = lastTime === null ? 0 : Math.min(.1, Math.max(0, now - lastTime));
    lastTime = now;
    const target = on && !finaleActive && state.gameState !== 'intro' ? 1 : 0;
    fade += (target - fade) * Math.min(1, dt * 3.5);
    if (target === 0 && fade < .01) fade = 0;
    if (target === 1 && fade > .99) fade = 1;
    if (fade <= 0) return;
    // O objeto `level` é reaproveitado entre fases (Object.assign): a chave
    // precisa vir do conteúdo, não da referência.
    const key = `${state.level?.seed}|${state.level?.campaignPhase}|${Math.round(state.level?.endX || 0)}`;
    if (key !== levelKey) { levelKey = key; rebuild(state.level); }

    const started = typeof performance !== 'undefined' ? performance.now() : 0;
    const m = ctx.getTransform();
    const zoom = Math.hypot(m.a, m.b) || 1;
    const W = canvas.width || 1280;
    const H = canvas.height || 720;
    const lights = collectLights();
    const shaftImpacts = collectShaftImpacts();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawDarkness(ctx, m, zoom, W, H, lights, t, shaftImpacts);
    drawShafts(ctx, m, zoom, W, H, t, shaftImpacts);
    drawSoilIllumination(ctx, m, zoom, W, H, shaftImpacts);
    drawGlows(ctx, m, zoom, W, H, lights);
    drawForeground(ctx, zoom, W, H, t);
    ctx.restore();
    if (started) lastRenderMs = performance.now() - started;
  }

  function toggle(value) {
    on = typeof value === 'boolean' ? value : !on;
    return on;
  }

  return {
    render,
    renderPlatformDepth,
    toggle,
    get enabled() { return on; },
    get strength() { return fade; },
    get lastRenderMs() { return lastRenderMs; },
  };
}
