// Particulas da calmaria: brotam por tras de cada organismo zen (branco,
// amarelo, laranja e rosa, com brilho) e morrem logo. So visual, sem RNG da
// simulacao. Cada organismo tem no maximo MAX_PER_KEY particulas vivas e so
// os organismos desenhados (na tela) atualizam, entao o custo e limitado.

const PALETTE = ['#ffffff', '#ffe38a', '#ffb066', '#ff9ec4'];
const MAX_PER_KEY = 14;
const RATE = 9; // por segundo, com calmaria cheia

const pools = new WeakMap();
const glowSprites = new Map();

export function glowSprite(color) {
  let s = glowSprites.get(color);
  if (s || typeof document === 'undefined') return s || null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, color);
  grd.addColorStop(.3, color);
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  glowSprites.set(color, cv);
  return cv;
}

function pool(key) {
  let p = pools.get(key);
  if (!p) { p = { motes: [], last: null, acc: 0 }; pools.set(key, p); }
  return p;
}

/**
 * Atualiza e desenha as particulas de um organismo calmo, ANTES do sprite
 * (assim ficam por tras). `time` e o relogio do jogo: pausado, nada se mexe.
 */
export function drawCalmMotes(ctx, key, { x, y, size, calm, time }) {
  if (!key) return;
  const p = pool(key);
  const dt = p.last === null ? 0 : Math.max(0, Math.min(.1, time - p.last));
  p.last = time;

  // nascimento
  if (calm > 0) {
    p.acc += dt * RATE * calm;
    while (p.acc >= 1) {
      p.acc -= 1;
      if (p.motes.length >= MAX_PER_KEY) { p.acc = 0; break; }
      // nascem na borda da silhueta e saem para fora: assim aparecem mesmo
      // atras de um sprite cheio (no miolo ficavam escondidas pelo corpo)
      const a = Math.random() * Math.PI * 2;
      const r = size * (.3 + Math.random() * .16);
      const speed = 34 + Math.random() * 44;
      p.motes.push({
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r * .8,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 18,
        life: .45 + Math.random() * .6,
        max: 0,
        radius: 1.6 + Math.random() * 2.6,
        color: PALETTE[(Math.random() * PALETTE.length) | 0],
      });
      p.motes[p.motes.length - 1].max = p.motes[p.motes.length - 1].life;
    }
  } else {
    p.acc = 0;
  }

  if (!p.motes.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  let w = 0;
  for (const m of p.motes) {
    m.life -= dt;
    if (m.life <= 0) continue;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.vx *= 1 - dt * 1.4;
    m.vy = m.vy * (1 - dt * 1.4) - dt * 10;
    const t = m.life / m.max;
    const fade = t > .7 ? (1 - t) / .3 : t / .7;
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));
    const spr = glowSprite(m.color);
    const d = m.radius * 5;
    if (spr) ctx.drawImage(spr, m.x - d / 2, m.y - d / 2, d, d);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius * .45, 0, Math.PI * 2);
    ctx.fill();
    p.motes[w++] = m;
  }
  p.motes.length = w;
  ctx.restore();
}


// Brilhos da area da calmaria: poucos, maiores e lentos, subindo devagar e
// piscando, espalhados pelo halo. Sem estado: a posicao sai de um hash fixo
// por indice e do relogio do jogo (nao consome Math.random por quadro).
const SPARKLES_PER_ZONE = 20;
const SPARKLE_COLORS = ['#ffe9a8', '#ffc59a', '#ffb3d1', '#ffffff'];
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

export function drawCalmSparkles(ctx, state) {
  const zones = state?.calmZones;
  if (!zones?.length) return;
  const time = state.time || 0;
  ctx.save();
  ctx.translate(-(state.cameraX || 0), 0);
  ctx.globalCompositeOperation = 'lighter';
  zones.forEach((zone, zi) => {
    const k = zone.intensity || 0;
    if (k <= 0) return;
    const r = zone.radius * .9;
    const n = Math.round(SPARKLES_PER_ZONE * k);
    for (let i = 0; i < n; i++) {
      const seed = zi * 97 + i * 13.7;
      const speed = 10 + hash(seed + 1) * 16;
      const span = r * 1.6;
      const rise = ((time * speed + hash(seed + 2) * span) % span);
      const x = zone.x + (hash(seed + 3) * 2 - 1) * r + Math.sin(time * .5 + seed) * 14;
      const y = zone.y + r * .8 - rise;
      const dx = x - zone.x, dy = y - zone.y;
      const edge = 1 - Math.min(1, Math.hypot(dx, dy) / r);
      if (edge <= 0) continue;
      const tw = .5 + .5 * Math.sin(time * (1 + hash(seed + 4) * 1.8) + seed * 3);
      const life = Math.sin(Math.PI * rise / span);
      const a = k * Math.min(1, edge * 2.2) * life * (.35 + .65 * tw);
      if (a <= .02) continue;
      const color = SPARKLE_COLORS[(hash(seed + 5) * SPARKLE_COLORS.length) | 0];
      const radius = 2.4 + hash(seed + 6) * 3.4;
      const spr = glowSprite(color);
      const d = radius * 7;
      ctx.globalAlpha = a;
      if (spr) ctx.drawImage(spr, x - d / 2, y - d / 2, d, d);
      ctx.globalAlpha = a * .9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, radius * .35, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}
