// Adaptado diretamente de miguelito-fase1 (1).html: renderScope, glow e desenhos.
const TAU = Math.PI * 2;

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

const glowCache = new Map();
function glow(color) {
  if (glowCache.has(color)) return glowCache.get(color);
  const c = mk(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, hexA(color, 1)); gr.addColorStop(.25, hexA(color, .45)); gr.addColorStop(.6, hexA(color, .12)); gr.addColorStop(1, hexA(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); glowCache.set(color, c); return c;
}

function drawRhizobium(c, x, y, ang, t, s = 1, alpha = 1) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s); c.globalAlpha *= alpha;
  c.strokeStyle = 'rgba(214,246,160,.55)'; c.lineWidth = .9;
  for (let k = -1; k <= 1; k += 2) { c.beginPath(); for (let i = 0; i <= 12; i++) { const px = -8 - i * 1.6, py = k * 1.5 + Math.sin(t * 16 - i * .8 + k) * (1 + i * .12) + k * i * .25; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); }
  const g = c.createLinearGradient(0, -3.5, 0, 3.5); g.addColorStop(0, '#effcc8'); g.addColorStop(.5, '#c8f08a'); g.addColorStop(1, '#86b848');
  c.beginPath(); c.roundRect(-8, -3.4, 16, 6.8, 3.4); c.fillStyle = g; c.fill(); c.strokeStyle = '#4f7a24'; c.lineWidth = .8; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(-3, 0, 1.1, 0, TAU); c.arc(3, .4, .9, 0, TAU); c.fill();
  c.restore();
}
function drawAzo(c, x, y, ang, t, s = 1) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
  c.strokeStyle = 'rgba(170,220,255,.6)'; c.lineWidth = .9; c.beginPath();
  for (let i = 0; i <= 18; i++) { const px = 9 + i * 1.7, py = -3 + Math.sin(t * 12 - i * .7) * (1.2 + i * .15); i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke();
  c.lineCap = 'round'; c.beginPath(); c.arc(0, 8, 11, -Math.PI * .82, -Math.PI * .18); c.strokeStyle = '#3d86b8'; c.lineWidth = 8.5; c.stroke();
  c.beginPath(); c.arc(0, 8, 11, -Math.PI * .82, -Math.PI * .18); c.strokeStyle = '#8fd4ff'; c.lineWidth = 6.5; c.stroke();
  c.beginPath(); c.arc(0, 8, 12, -Math.PI * .72, -Math.PI * .38); c.strokeStyle = 'rgba(235,250,255,.8)'; c.lineWidth = 1.6; c.stroke();
  c.restore();
}
function drawBacillusColony(c, x, y, t, on, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const k = on ? 1 : .55, rad = 34 * (on ? 1 : .8);
  const m = c.createRadialGradient(0, 0, 4, 0, 0, rad); m.addColorStop(0, hexA('#fff1b0', .5 * k)); m.addColorStop(.7, hexA('#e7c95a', .3 * k)); m.addColorStop(1, hexA('#e7c95a', 0));
  c.beginPath(); c.ellipse(0, 0, rad * 1.25, rad, 0, Math.PI, 0); c.closePath(); c.fillStyle = m; c.fill();
  const r = rng(77);
  for (let i = 0; i < 16; i++) {
    const a = Math.PI + r() * Math.PI, d = r() * rad * .85, bx = Math.cos(a) * d * 1.2, by = Math.sin(a) * d * .9, ang = r() * TAU + Math.sin(t + i) * .05;
    c.save(); c.translate(bx, by); c.rotate(ang); c.beginPath(); c.roundRect(-5, -2, 10, 4, 2); c.fillStyle = on ? '#f0d77a' : '#9c8a52'; c.fill();
    if (i % 3 === 0) { c.beginPath(); c.ellipse(2, 0, 2, 1.3, 0, 0, TAU); c.fillStyle = on ? `rgba(255,255,240,${.7 + Math.sin(t * 3 + i) * .3})` : '#cfc3a0'; c.fill(); }
    c.restore();
  }
  c.restore();
}
function drawFungusMesh(c, x, y, w, t, intensity = 1) {
  const r = rng(Math.floor(x));
  c.save(); c.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    let px = x + r() * w, py = y + r() * 8; c.beginPath(); c.moveTo(px, py);
    for (let k = 0; k < 5; k++) { px += (r() - .5) * 22; py -= 3 + r() * 7 + Math.sin(t * 2 + i + k) * 1.2; c.lineTo(px, py); }
    c.strokeStyle = `rgba(190,140,230,${.55 * intensity})`; c.lineWidth = 1.2; c.stroke();
    c.beginPath(); c.arc(px, py, 2.2, 0, TAU); c.fillStyle = `rgba(220,185,245,${.8 * intensity})`; c.fill();
  }
  c.restore();
}
function drawExudate(c, x, y, t) {
  c.save(); c.translate(x, y); const s = 1 + Math.sin(t * 5) * .06; c.scale(s, 1 / s);
  c.beginPath(); c.moveTo(0, -8); c.bezierCurveTo(6, -3, 7, 4, 0, 7); c.bezierCurveTo(-7, 4, -6, -3, 0, -8);
  const g = c.createRadialGradient(-2, -2, 1, 0, 0, 9); g.addColorStop(0, '#fff3c8'); g.addColorStop(.5, '#ffc35a'); g.addColorStop(1, '#d9801e');
  c.fillStyle = g; c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(-2, -2, 1.4, 2.2, -.4, 0, TAU); c.fill();
  c.restore();
}

function renderScope(c, scopeKind, t) {
  if (!scopeKind) return; const w = 440;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#060202'; c.fillRect(0, 0, w, w);
  const bg = c.createRadialGradient(w / 2, w / 2, 10, w / 2, w / 2, w / 2); bg.addColorStop(0, '#1d0e0a'); bg.addColorStop(1, '#040101'); c.fillStyle = bg; c.fillRect(0, 0, w, w);
  c.save(); c.translate(w / 2, w / 2);
  // Matéria fora do plano focal, usando o mesmo glow radial do protótipo.
  c.globalAlpha = .06;
  for (let i = 0; i < 8; i++) c.drawImage(glow('#e6c49c'), Math.sin(i * 7.1 + t * .1) * 170 - 18, Math.cos(i * 3.3 + t * .08) * 170 - 18, 36, 36);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) { c.fillStyle = `rgba(255,230,200,${.04 + (i % 5) * .01})`; c.beginPath(); c.arc(Math.sin(i * 7.1 + t * .1) * 170, Math.cos(i * 3.3 + t * .08) * 170, 1 + (i % 3), 0, TAU); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  if (scopeKind === 'rhizobium') { for (let i = 0; i < 7; i++) { const a = i * .9 + t * .25; drawRhizobium(c, Math.cos(a) * (60 + i * 12), Math.sin(a * 1.3) * (50 + i * 8), a + Math.PI / 2, t + i, 4.2); } }
  else if (scopeKind === 'azospirillum') { drawAzo(c, -20, 20, Math.sin(t) * .2, t, 6); drawAzo(c, 90, -80, 2 + Math.sin(t * .7) * .2, t + 1, 3.5); drawAzo(c, -110, -90, 4, t + 2, 3); }
  else if (scopeKind === 'bacillus') { drawBacillusColony(c, 0, 70, t, true, 4); }
  else if (scopeKind === 'fungo') { c.scale(3, 3); drawFungusMesh(c, -40, 30, 80, t, 1); drawFungusMesh(c, -30, 55, 60, t + 1, .8); }

  else if (scopeKind === 'nodulo') {
    c.fillStyle = '#e8d3ad'; c.fillRect(-220, -150, 440, 60);
    const g = c.createRadialGradient(-20, -40, 10, 0, 0, 110); g.addColorStop(0, '#ffd3de'); g.addColorStop(.6, '#ff8fa8'); g.addColorStop(1, '#a23e62');
    c.beginPath(); c.arc(0, 0, 105, 0, TAU); c.fillStyle = g; c.fill();
    for (let i = 0; i < 60; i++) { const a = i * 2.4, d = Math.sqrt(i / 60) * 85; c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(a + t * .2); c.beginPath(); c.roundRect(-7, -2.5, 14, 5, 2.5); c.fillStyle = 'rgba(255,245,235,.55)'; c.fill(); c.restore(); }
    c.fillStyle = '#fff'; c.font = '800 26px Grandstander, sans-serif'; c.textAlign = 'center'; c.fillText('N₂ → NH₃', 0, 160);
  }
  else drawAdditionalField(c, scopeKind, t);
  c.restore();
  const vg = c.createRadialGradient(w / 2, w / 2, w * .3, w / 2, w / 2, w / 2); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.85)'); c.fillStyle = vg; c.fillRect(0, 0, w, w);
}

// IDs visuais ficam aqui; o catálogo científico e suas páginas não são alterados.
const fieldKinds = Object.freeze({
  'organism-rhizobium': 'rhizobium',
  'organism-azospirillum': 'azospirillum',
  'organism-bacillus': 'bacillus',
  'organism-phosphate-solubilizer': 'bacillus',
  'organism-pseudomonas': 'pseudomonas',
  'organism-trichoderma': 'trichoderma',
  'organism-rhizoctonia': 'fungo',
  'organism-opportunistic-fungus': 'fungo',
  'organism-ralstonia': 'ralstonia',
  'organism-mycorrhiza': 'mycorrhiza',
  'organism-meloidogyne-j2': 'nematode',
  'organism-meloidogyne-female': 'female',
  'action-exudate': 'exudate',
  'structure-nodule': 'nodulo',
  'process-fbn': 'nodulo',
  'structure-biofilm': 'bacillus',
  'process-siderophore': 'iron',
  'process-iron-competition': 'iron',
  'structure-arbuscule': 'mycorrhiza',
  'structure-mycorrhiza-path': 'mycorrhiza',
  'structure-lateral-root': 'root',
  'structure-egg-mass': 'eggs',
  'structure-gall': 'gall',
  'process-mycoparasitism': 'trichoderma',
  'process-ralstonia-entry': 'ralstonia',
  'process-vascular-obstruction': 'ralstonia',
  'process-ralstonia-containment': 'ralstonia',
  'process-ralstonia-spread': 'ralstonia',
});

function drawBacteria(c, t, color) {
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + t * .12;
    c.save();
    c.translate(Math.cos(a) * (45 + i * 13), Math.sin(a * 1.3) * (40 + i * 10));
    c.rotate(a);
    c.strokeStyle = hexA(color, .5); c.lineWidth = 2;
    c.beginPath(); c.moveTo(-20, 0);
    for (let j = 0; j < 16; j++) c.lineTo(-20 - j * 3, Math.sin(t * 3 - j * .6 + i) * (3 + j * .5));
    c.stroke();
    const g = c.createLinearGradient(0, -9, 0, 9);
    g.addColorStop(0, '#f1f7cf'); g.addColorStop(.4, color); g.addColorStop(1, hexA(color, .4));
    c.fillStyle = g; c.beginPath(); c.roundRect(-22, -9, 44, 18, 9); c.fill();
    c.restore();
  }
}

function drawHypha(c, x, y, angle, length, depth, t, color) {
  c.save(); c.translate(x, y); c.rotate(angle + Math.sin(t * .4 + depth) * .025);
  c.strokeStyle = color; c.lineWidth = depth + .6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(length * .45, -6, length, 0); c.stroke();
  if (depth > 0) {
    drawHypha(c, length, 0, -.55, length * .69, depth - 1, t, color);
    drawHypha(c, length, 0, .65, length * .65, depth - 1, t + .3, color);
  } else {
    c.globalAlpha = .55 + Math.sin(t + x) * .15;
    c.beginPath(); c.arc(length, 0, 4, 0, TAU); c.fillStyle = color; c.fill();
  }
  c.restore();
}

function drawTissue(c, t, altered = false) {
  c.save(); c.rotate(-.2);
  for (let row = -2; row <= 2; row++) for (let col = -3; col <= 3; col++) {
    const x = col * 58 + (row % 2) * 25, y = row * 45;
    c.fillStyle = altered ? '#805042' : '#92734d'; c.strokeStyle = '#d6b087'; c.lineWidth = 2;
    c.beginPath(); c.roundRect(x - 27, y - 20, 54, 40, 12); c.fill(); c.stroke();
    c.fillStyle = '#ddbe8b'; c.beginPath(); c.arc(x + Math.sin(t * .2 + col) * 5, y, 4, 0, TAU); c.fill();
  }
  c.restore();
}

function drawAdditionalField(c, kind, t) {
  if (kind === 'pseudomonas' || kind === 'ralstonia') {
    drawBacteria(c, t, kind === 'pseudomonas' ? '#a6d864' : '#d4ac77');
  } else if (kind === 'trichoderma' || kind === 'mycorrhiza') {
    if (kind === 'mycorrhiza') { c.globalAlpha = .25; drawTissue(c, t); c.globalAlpha = 1; }
    drawHypha(c, -110, 125, -1.1, 85, 4, t, kind === 'trichoderma' ? '#8df0a8' : '#d6afff');
  } else if (kind === 'exudate') {
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4 + t * .12;
      c.save(); c.translate(Math.cos(a) * (35 + i * 19), Math.sin(a) * (35 + i * 15)); c.scale(2.5, 2.5);
      drawExudate(c, 0, 0, t * .5 + i); c.restore();
    }
  } else if (kind === 'iron') {
    drawBacteria(c, t * .4, '#a6d864');
    c.fillStyle = '#ffc35a'; c.font = '700 30px sans-serif'; c.textAlign = 'center'; c.fillText('Fe³⁺', 0, 10);
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + t * .25;
      c.strokeStyle = '#b9f36f'; c.lineWidth = 4; c.beginPath();
      c.arc(Math.cos(a) * 65, Math.sin(a) * 65, 16, a + .6, a + TAU - .6); c.stroke();
    }
  } else if (kind === 'nematode') {
    for (let i = 0; i < 3; i++) {
      c.save(); c.translate(-90 + i * 85, -80 + i * 50); c.rotate(i - .8);
      c.lineCap = 'round'; c.strokeStyle = '#f4e5c7'; c.lineWidth = 9; c.beginPath();
      for (let j = 0; j <= 45; j++) {
        const x = j * 5 - 110, y = Math.sin(j * .15 - t * 1.2 + i) * 25;
        if (j) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.stroke(); c.restore();
    }
  } else if (['female', 'gall', 'eggs'].includes(kind)) {
    if (kind !== 'eggs') drawTissue(c, t, true);
    c.fillStyle = '#e3b5a0'; c.beginPath();
    c.ellipse(0, 0, 72, 90, .2, 0, TAU); c.fill();
    if (kind === 'female' || kind === 'gall') {
      c.fillStyle = '#fff0cf'; c.beginPath(); c.ellipse(0, 5, 35, 55, -.3, 0, TAU); c.fill();
    } else {
      for (let i = 0; i < 28; i++) {
        const a = i * 2.4, r = Math.sqrt(i / 28) * 60;
        c.fillStyle = '#ffe0a6'; c.strokeStyle = '#a27650'; c.beginPath();
        c.ellipse(Math.cos(a) * r, Math.sin(a) * r, 8, 13, a + Math.sin(t * .3 + i) * .05, 0, TAU); c.fill(); c.stroke();
      }
    }
  } else {
    // Cartões de ações/poderes: tecido vivo, sem atribuir organismos inexistentes.
    drawTissue(c, t);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = .18;
    for (let i = 0; i < 4; i++) c.drawImage(glow('#ffc35a'), Math.sin(t * .3 + i) * 130 - 35, i * 35 - 90, 70, 70);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
}

export function createTutorialMicroscope(canvas) {
  const context = canvas.getContext('2d');
  let frame = null;
  let kind = null;
  let elapsed = 0;
  let previousTime = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function tick(now) {
    frame = null;
    if (!kind || !canvas.isConnected) return;
    if (!document.hidden) {
      if (previousTime !== null) elapsed += Math.min((now - previousTime) / 1000, .05) * (reducedMotion.matches ? .15 : 1);
      renderScope(context, kind, elapsed);
    }
    previousTime = now;
    frame = requestAnimationFrame(tick);
  }
  return {
    show(cardId) {
      kind = fieldKinds[cardId] || 'root';
      canvas.dataset.microscopeKind = kind;
      if (context && frame === null) { previousTime = null; frame = requestAnimationFrame(tick); }
    },
    stop() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null; kind = null; previousTime = null;
    },
  };
}
