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

import { MICROBE_MOTION_PROFILES } from '../procgen/microbe-ecology.js';

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
      // sombra de contato: o solo logo abaixo do bloco fica mais escuro
      const sh = Math.min(70, 26 + p.w * .08);
      const g = ctx.createLinearGradient(0, p.y + p.h - 6, 0, p.y + p.h + sh);
      g.addColorStop(0, `rgba(2,6,9,${.42 * fade})`);
      g.addColorStop(1, 'rgba(2,6,9,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p.x + p.w / 2, p.y + p.h - 4, p.w * .56, sh, 0, 0, Math.PI);
      ctx.fill();
      // borda superior iluminada pela luz que vem de cima
      const rim = ctx.createLinearGradient(0, p.y - 2, 0, p.y + 10);
      rim.addColorStop(0, `rgba(255,232,180,${.34 * fade})`);
      rim.addColorStop(1, 'rgba(255,232,180,0)');
      ctx.fillStyle = rim;
      const inset = Math.min(10, p.w * .08);
      ctx.fillRect(p.x + inset, p.y - 1, p.w - inset * 2, 10);
    }
    ctx.restore();
  }

  // ---------- helpers de projeção ----------
  function project(m, wx, wy) {
    const x = wx - (state.cameraX || 0);
    return [m.a * x + m.c * wy + m.e, m.b * x + m.d * wy + m.f];
  }

  function collectLights() {
    const level = state.level || {};
    const t = state.time || 0;
    const lights = [];
    const p = state.player;
    if (p) lights.push({ x: p.x + (p.w || 32) / 2, y: p.y + (p.h || 48) * .45, r: 250, a: .92, color: '#bfeee6', glow: .10 });
    for (const e of level.exudates || []) {
      if (e.taken) continue;
      lights.push({ x: e.x, y: e.y, r: 120, a: .72, color: '#9df27a', glow: .30 + Math.sin(t * 3 + e.x) * .06 });
    }
    for (const c of level.crystals || []) {
      if (c.taken || c.collected) continue;
      lights.push({ x: c.x, y: c.y, r: 110, a: .6, color: '#9fd8ff', glow: .25 });
    }
    for (const c of level.checkpoints || []) lights.push({ x: c.x, y: c.y, r: 150, a: .6, color: '#f3dc86', glow: c.active ? .35 : .15 });
    for (const b of level.biofilms || []) if (Number.isFinite(b.x)) lights.push({ x: b.x, y: b.y, r: 150, a: .6, color: '#f3dc86', glow: .28 });
    if (level.goal && Number.isFinite(level.goal.x)) {
      lights.push({ x: level.goal.x, y: level.goal.y, r: 330, a: .95, color: '#ffe7a8', glow: .38 + Math.sin(t * 1.6) * .05 });
    }
    const agents = typeof getAgents === 'function' ? getAgents() : null;
    if (agents) {
      for (const a of agents) {
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) continue;
        const color = MICROBE_MOTION_PROFILES[a.type]?.color || '#9ff3e6';
        lights.push({ x: a.x, y: a.y, r: 78, a: .42, color, glow: .22 });
      }
    }
    return lights;
  }

  // ---------- 2. feixes de luz ----------
  function drawShafts(ctx, m, zoom, W, H, t) {
    const { top, bottom } = geometryBounds();
    const yTop = top - 260;
    const yBot = bottom + 60;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of shafts) {
      const breathe = .72 + Math.sin(t * .45 + s.phase) * .28;
      const alpha = .12 * s.strength * breathe * fade;
      const [ax, ay] = project(m, s.x, yTop);
      const [bx, by] = project(m, s.x + (yBot - yTop) * s.slant, yBot);
      const halfTop = s.w * .32 * zoom;
      const halfBot = s.w * .9 * zoom;
      if (Math.max(ax, bx) + halfBot < -40 || Math.min(ax, bx) - halfBot > W + 40) continue;
      const g = ctx.createLinearGradient(0, ay, 0, by);
      g.addColorStop(0, `rgba(255,236,190,${alpha * 1.4})`);
      g.addColorStop(.55, `rgba(214,240,220,${alpha * .7})`);
      g.addColorStop(1, 'rgba(160,230,220,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ax - halfTop, ay);
      ctx.lineTo(ax + halfTop, ay);
      ctx.lineTo(bx + halfBot, by);
      ctx.lineTo(bx - halfBot, by);
      ctx.closePath();
      ctx.fill();
      // partículas em suspensão dentro do feixe
      for (const mo of s.motes) {
        const v = (mo.v + t * .018 * mo.s) % 1;
        const wy = yTop + 120 + v * (yBot - yTop - 180);
        const wx = s.x + (wy - yTop) * s.slant + (mo.u - .5) * s.w * 1.1 + Math.sin(t * .7 + mo.u * 20) * 8;
        const [px, py] = project(m, wx, wy);
        if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
        const tw = .5 + .5 * Math.sin(t * 2.2 + mo.u * 40);
        ctx.fillStyle = `rgba(255,244,214,${(.25 + tw * .45) * fade * (1 - Math.abs(v - .5) * 1.4)})`;
        ctx.beginPath();
        ctx.arc(px, py, mo.s * zoom, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---------- 3. escuridão ----------
  function drawDarkness(ctx, m, zoom, W, H, lights, t) {
    if (!dctx) return;
    const dw = Math.max(2, Math.ceil(W / DARK_SCALE));
    const dh = Math.max(2, Math.ceil(H / DARK_SCALE));
    if (dark.width !== dw || dark.height !== dh) { dark.width = dw; dark.height = dh; }
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, dw, dh);

    // profundidade: acima da geometria a luz é maior; abaixo, o solo fecha
    const { top, bottom } = geometryBounds();
    const [, yTop] = project(m, 0, top - 120);
    const [, yBot] = project(m, 0, bottom + 80);
    const g = dctx.createLinearGradient(0, yTop / DARK_SCALE, 0, yBot / DARK_SCALE);
    g.addColorStop(0, 'rgba(2,9,14,.16)');
    g.addColorStop(.55, 'rgba(2,8,13,.32)');
    g.addColorStop(1, 'rgba(1,4,8,.58)');
    dctx.fillStyle = g;
    dctx.fillRect(0, 0, dw, dh);
    // vinheta
    const vg = dctx.createRadialGradient(dw / 2, dh * .52, Math.min(dw, dh) * .35, dw / 2, dh * .52, Math.max(dw, dh) * .75);
    vg.addColorStop(0, 'rgba(1,4,8,0)');
    vg.addColorStop(1, 'rgba(1,4,8,.34)');
    dctx.fillStyle = vg;
    dctx.fillRect(0, 0, dw, dh);

    // recortes de luz
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
      const [sx, sy] = project(m, l.x, l.y);
      stamp(sx, sy, l.r * zoom, l.a);
    }
    dctx.globalAlpha = 1;
    // feixes também clareiam a escuridão
    const yT = top - 260;
    const yB = bottom + 60;
    for (const s of shafts) {
      const breathe = .72 + Math.sin(t * .45 + s.phase) * .28;
      const [ax, ay] = project(m, s.x, yT);
      const [bx, by] = project(m, s.x + (yB - yT) * s.slant, yB);
      const lg = dctx.createLinearGradient(0, ay / DARK_SCALE, 0, by / DARK_SCALE);
      lg.addColorStop(0, `rgba(0,0,0,${.42 * s.strength * breathe})`);
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = lg;
      dctx.beginPath();
      dctx.moveTo((ax - s.w * .3 * zoom) / DARK_SCALE, ay / DARK_SCALE);
      dctx.lineTo((ax + s.w * .3 * zoom) / DARK_SCALE, ay / DARK_SCALE);
      dctx.lineTo((bx + s.w * .8 * zoom) / DARK_SCALE, by / DARK_SCALE);
      dctx.lineTo((bx - s.w * .8 * zoom) / DARK_SCALE, by / DARK_SCALE);
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
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawDarkness(ctx, m, zoom, W, H, lights, t);
    drawShafts(ctx, m, zoom, W, H, t);
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
