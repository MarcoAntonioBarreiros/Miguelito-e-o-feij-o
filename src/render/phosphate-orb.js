// Pulso solubilizador como bola de luz: nucleo branco, anel violeta e dourado
// (fosforo) e gotinhas de acidos organicos (citrato, gluconato) girando em
// volta. So desenho: a carga, o alcance e a area de acerto continuam sendo os
// do sistema de fosfato.

const TAU = Math.PI * 2;
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const glowCache = new Map();

function glow(color) {
  let s = glowCache.get(color);
  if (s || typeof document === 'undefined') return s || null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, color);
  grd.addColorStop(.25, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(color, cv);
  return cv;
}

function blob(ctx, color, x, y, d, alpha) {
  const s = glow(color);
  if (!s || alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(s, x - d / 2, y - d / 2, d, d);
}

/**
 * A bola em si. `radius` e o raio do nucleo luminoso; `time` anima; `fill`
 * (0..1, opcional) desenha o arco dourado de carga em volta.
 */
export function drawPhosphateOrb(ctx, x, y, radius, time, { fill = null, droplets = 6, crackle = true, seed = 0 } = {}) {
  const r = Math.max(2, radius);
  const pulse = 1 + Math.sin(time * 9 + seed) * .06;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // halo largo violeta, anel dourado, nucleo branco
  blob(ctx, '#b65cff', x, y, r * 7.5 * pulse, .55);
  blob(ctx, '#ffcf66', x, y, r * 4.4 * pulse, .7);
  blob(ctx, '#f3c9ff', x, y, r * 2.8, .9);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r * .62, 0, TAU);
  ctx.fill();

  // gotinhas de acido girando em volta
  for (let i = 0; i < droplets; i++) {
    const a = time * (2.4 + (i % 3) * .5) + i * TAU / droplets + seed;
    const orbit = r * (1.5 + (i % 2) * .45);
    const dx = x + Math.cos(a) * orbit;
    const dy = y + Math.sin(a) * orbit * .72;
    blob(ctx, i % 2 ? '#ffd98a' : '#e9a8ff', dx, dy, 7 + r * .35, .85);
    ctx.globalAlpha = .9;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(dx, dy, 1.1, 0, TAU);
    ctx.fill();
  }

  // pequenos raios
  if (crackle && r > 4) {
    ctx.strokeStyle = '#fff1ff';
    ctx.lineWidth = 1.1;
    const step = Math.floor(time * 14);
    for (let k = 0; k < 2; k++) {
      const h = hash(step * 3.1 + k * 7 + seed);
      if (h < .45) continue;
      const a0 = hash(step + k * 11 + seed) * TAU;
      ctx.globalAlpha = .8;
      ctx.beginPath();
      let px = x + Math.cos(a0) * r * .7;
      let py = y + Math.sin(a0) * r * .7;
      ctx.moveTo(px, py);
      for (let j = 1; j <= 3; j++) {
        const rr = r * (.7 + j * .45);
        const jitter = (hash(step * 5 + j + k * 13 + seed) - .5) * .9;
        px = x + Math.cos(a0 + jitter) * rr;
        py = y + Math.sin(a0 + jitter) * rr;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  // arco dourado de carga (substitui o circulo antigo em volta do Miguelito)
  if (fill != null) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = .9;
    ctx.strokeStyle = '#ffd56f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.3 + 3, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, Math.min(1, fill)));
    ctx.stroke();
  }
  ctx.restore();
}

/** Rastro de cometa e gotas soltas atras da bola em voo. */
export function drawPhosphateTrail(ctx, shot, radius, time) {
  const dir = shot.direction || 1;
  const travelled = Math.max(0, shot.x - shot.originX) * dir;
  const length = Math.min(150, travelled);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const n = 9;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const along = t * length;
    const wob = Math.sin(time * 12 + i * 1.7) * radius * .25 * t;
    blob(ctx, i % 3 ? '#c06cff' : '#ffcf66', shot.x - dir * along, shot.y + wob, radius * (4.6 - t * 2.8), .62 * (1 - t));
  }
  // gotas de acido que se desprendem do rastro e caem
  for (let i = 0; i < 6; i++) {
    const seed = i * 3.7 + (shot.originX % 97);
    const along = (hash(seed) * .8 + .1) * length;
    const age = (time * 1.6 + hash(seed + 1)) % 1;
    const dx = shot.x - dir * along;
    const dy = shot.y + (hash(seed + 2) - .5) * radius * 2 + age * age * 26;
    blob(ctx, hash(seed + 3) < .5 ? '#ffd98a' : '#f0b2ff', dx, dy, 8, .7 * (1 - age));
  }
  ctx.restore();
}

/** Anel de choque na saida do disparo (primeiros ~60 px de voo). */
export function drawPhosphateLaunchRing(ctx, shot) {
  const t = Math.min(1, Math.max(0, (shot.distance || 0) / 70));
  if (t >= 1) return;
  ctx.save();
  ctx.globalAlpha = (1 - t) * .85;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#d89bff';
  ctx.lineWidth = 3 * (1 - t) + .5;
  ctx.beginPath();
  ctx.ellipse(shot.originX, shot.originY, 10 + t * 34, 14 + t * 44, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
