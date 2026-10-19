// Particulas da calmaria: brotam por tras de cada organismo zen (branco,
// amarelo, laranja e rosa, com brilho) e morrem logo. So visual, sem RNG da
// simulacao. Cada organismo tem no maximo MAX_PER_KEY particulas vivas e so
// os organismos desenhados (na tela) atualizam, entao o custo e limitado.

const PALETTE = ['#ffffff', '#ffe38a', '#ffb066', '#ff9ec4'];
const MAX_PER_KEY = 14;
const RATE = 9; // por segundo, com calmaria cheia

const pools = new WeakMap();
const glowSprites = new Map();

function glowSprite(color) {
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
      const a = Math.random() * Math.PI * 2;
      const r = size * (.08 + Math.random() * .22);
      const speed = 22 + Math.random() * 46;
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

