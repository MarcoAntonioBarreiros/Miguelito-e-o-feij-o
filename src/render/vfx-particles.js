// Efeitos de particulas de evento (inoculacao, vigor da colonia, comemoracao).
//
// Portado da biblioteca do RizoVector (src/effects/ParticleLibrary.js,
// src/systems/EffectsSystem.js e o desenho de EnhancedRenderer.particle): os
// mesmos presets (faisca riscada, floracao, vortice de arcos, espiral,
// filamento, estilhaco, esporo, dissolucao), o anel que expande, a linha do
// tempo com atraso e a reducao de carga quando ha muitas particulas.
//
// Tudo aqui e transitorio: cada efeito nasce, se espalha e some. Nada fica
// permanente na cena. Coordenadas de mundo (o mesmo espaco dos organismos);
// o desenho recebe o contexto ja com a camera aplicada e desloca por cameraX.
//
// Custo: sprites de brilho em cache (drawImage) e um limite duro de
// particulas. Sem efeito ativo, update e render saem na primeira linha.

const TAU = Math.PI * 2;
const MAX_PARTICLES = 700;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const PRESETS = Object.freeze({
  spark: { shape: 'streak', speed: [245, 520], life: [.82, 1.28], radius: [1.2, 2.5], length: [15, 32], width: [.8, 1.7], gravity: [4, 34], turn: [-.28, .28], fadePower: [.85, 1.15], fadeStart: [.34, .46], drag: [.986, .994], glow: [.72, 1], spinSpeed: [-2.5, 2.5] },
  bloom: { shape: 'orb', speed: [70, 175], life: [1.45, 2.25], radius: [2.4, 4.8], length: [0, 0], width: [0, 0], gravity: [-18, 18], turn: [-.55, .55], fadePower: [.75, 1.05], fadeStart: [.48, .64], drag: [.982, .991], glow: [.75, 1.05], grow: [.45, 1.1], spinSpeed: [-1.5, 1.5] },
  vortex: { shape: 'arc', speed: [115, 235], life: [1.55, 2.45], radius: [1.6, 3.1], length: [18, 36], width: [1.1, 2.2], gravity: [-6, 10], turn: [2.4, 4.3], fadePower: [.82, 1.1], fadeStart: [.42, .58], drag: [.988, .995], glow: [.8, 1.1], spinSpeed: [8, 15] },
  spiral: { shape: 'spiral', speed: [82, 165], life: [1.8, 2.75], radius: [1.8, 3.3], length: [20, 39], width: [1, 2], gravity: [-12, 12], turn: [1.5, 2.7], fadePower: [.78, 1.02], fadeStart: [.48, .64], drag: [.989, .996], glow: [.82, 1.15], spinSpeed: [16, 28] },
  filament: { shape: 'ribbon', speed: [145, 320], life: [1.15, 1.9], radius: [1.3, 2.6], length: [24, 48], width: [.9, 1.9], gravity: [-5, 30], turn: [-.9, .9], fadePower: [.82, 1.08], fadeStart: [.38, .52], drag: [.986, .994], glow: [.72, 1.02], spinSpeed: [-3.5, 3.5] },
  shatter: { shape: 'shard', speed: [190, 385], life: [1.05, 1.72], radius: [1.7, 3.4], length: [13, 29], width: [1.1, 2.5], gravity: [34, 96], turn: [-.55, .55], fadePower: [.9, 1.18], fadeStart: [.34, .48], drag: [.984, .992], glow: [.7, 1], spinSpeed: [-10, 10] },
  spore: { shape: 'orb', speed: [30, 92], life: [1.9, 3.05], radius: [1.8, 3.5], length: [0, 0], width: [0, 0], gravity: [-18, 10], turn: [-.4, .4], fadePower: [.72, .98], fadeStart: [.55, .72], drag: [.991, .997], glow: [.7, 1], grow: [.15, .5], motion: 'wobble', spinSpeed: [-2, 2] },
  dissolve: { shape: 'cloud', speed: [9, 42], life: [2.15, 3.35], radius: [4.8, 10.5], length: [0, 0], width: [0, 0], gravity: [-28, -6], turn: [-.25, .25], fadePower: [1.05, 1.45], fadeStart: [.82, .94], drag: [.988, .995], glow: [.5, .8], grow: [1.2, 2.3], spinSpeed: [-.8, .8] },
});

function pathFor(pattern, index, total, baseAngle, spread, options) {
  const u = (index + .5) / Math.max(1, total);
  const theta = u * TAU + (options.phase || 0);
  const jitter = (Math.random() - .5) * (options.angleJitter ?? .12);
  if (pattern === 'radial') return { x: 0, y: 0, angle: theta + jitter };
  if (pattern === 'ring') { const r = options.ringRadius ?? 12; return { x: Math.cos(theta) * r, y: Math.sin(theta) * r, angle: theta + jitter }; }
  if (pattern === 'vortex') {
    const r = options.ringRadius ?? 16, dir = options.vortexDirection ?? 1;
    return { x: Math.cos(theta) * r, y: Math.sin(theta) * r, angle: theta + dir * Math.PI / 2 + jitter, turnDirection: dir };
  }
  if (pattern === 'fan') return { x: 0, y: 0, angle: baseAngle - spread * .5 + spread * u + jitter };
  return {
    x: (Math.random() - .5) * (options.originSpread || 12),
    y: (Math.random() - .5) * (options.originSpread || 12),
    angle: baseAngle + (Math.random() - .5) * spread,
  };
}

function createParticle(presetName, x, y, color, options = {}) {
  const preset = PRESETS[presetName] || PRESETS.bloom;
  const path = pathFor(options.pattern || 'scatter', options.index ?? 0, options.total ?? 1, options.angle ?? -Math.PI / 2, options.spread ?? TAU, options);
  const speed = rand(...preset.speed);
  const life = rand(...preset.life);
  const turnDirection = path.turnDirection ?? (Math.random() < .5 ? -1 : 1);
  const spinRange = preset.spinSpeed || [-5.5, 5.5];
  const palette = options.palette || null;
  return {
    x: x + path.x, y: y + path.y,
    vx: Math.cos(path.angle) * speed, vy: Math.sin(path.angle) * speed,
    grav: rand(...preset.gravity), life, maxLife: life,
    radius: rand(...preset.radius), length: rand(...preset.length), width: rand(...preset.width),
    color: palette ? palette[(Math.random() * palette.length) | 0] : color,
    kind: presetName === 'dissolve' ? 'smoke' : 'particle', shape: preset.shape, motion: preset.motion || 'ballistic',
    alpha: options.alpha ?? 1, turnRate: turnDirection * Math.abs(rand(...preset.turn)),
    spin: Math.random() * TAU, spinSpeed: turnDirection * Math.abs(rand(...spinRange)), curve: rand(-.72, .72),
    fadePower: rand(...preset.fadePower), fadeStart: rand(...preset.fadeStart), birthFade: .035,
    drag: rand(...preset.drag), grow: rand(...(preset.grow || [0, 0])), glowAlpha: rand(...preset.glow),
    glowScale: options.glowScale ?? 1,
    splitPreset: options.noSplit ? null : (options.splitPreset || null), splitCount: options.splitCount || 0,
    splitAt: options.splitAt ?? 0, splitSize: options.splitSize ?? .35, splitSpeed: options.splitSpeed ?? .7, splitDone: false,
    wob: Math.random() * TAU, wobSpeed: rand(1.1, 2.4),
  };
}

function rgba(color, a) {
  if (color && color[0] === '#') {
    let h = color.slice(1);
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  return color;
}

// Assinatura de cada inoculante (a mesma de pickupBurst no RizoVector).
const INOCULATION_STYLE = {
  bacillus: ['bloom', 'ring', 1],
  rhizobium: ['spiral', 'vortex', 1],
  azospirillum: ['vortex', 'vortex', 1],
  myco: ['filament', 'radial', 1],
  pseudomonas: ['spark', 'radial', 1],
  trichoderma: ['spiral', 'vortex', -1],
};

export function createVfxParticles() {
  const particles = [];
  const timeline = [];
  const sprites = new Map();

  function spriteFor(color) {
    let s = sprites.get(color);
    if (s) return s;
    if (typeof document === 'undefined') return null;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, rgba(color, 1));
    grd.addColorStop(.35, rgba(color, .6));
    grd.addColorStop(1, rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    sprites.set(color, cv);
    return cv;
  }

  function loadScale(priority = 'normal') {
    const n = particles.length;
    if (priority === 'critical') return n < 500 ? 1 : n < 600 ? .7 : .4;
    if (priority === 'ambient') return n < 250 ? 1 : n < 400 ? .5 : .15;
    return n < 350 ? 1 : n < 500 ? .65 : .3;
  }

  function emit(preset, x, y, color, count, options = {}) {
    const total = Math.max(1, Math.round(count * loadScale(options.priority)));
    for (let i = 0; i < total; i++) {
      if (particles.length >= MAX_PARTICLES) break;
      const p = createParticle(preset, x, y, color, { ...options, index: i, total });
      const speed = options.speedScale || 1, size = options.sizeScale || 1, life = options.lifeScale || 1;
      p.vx *= speed; p.vy *= speed;
      p.radius *= size; p.length *= size; p.width *= size;
      p.life *= life; p.maxLife *= life;
      particles.push(p);
    }
  }

  function ring(x, y, color, maxRadius = 180, duration = .62, lineWidth = 3.2) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({ x, y, radius: 4, maxRadius, life: duration, maxLife: duration, color, kind: 'ring', alpha: 1, fadePower: 1.15, fadeStart: .72, birthFade: .02, lineWidth });
  }

  function schedule(delay, fn) { timeline.push({ delay, fn }); }

  // --- efeitos do jogo -------------------------------------------------------

  // Inoculacao: acontece uma vez, onde a colonia se estabelece, e some.
  function inoculation(type, x, y, color, pale = '#ffffff') {
    const [preset, pattern, dir] = INOCULATION_STYLE[type] || ['bloom', 'ring', 1];
    const palette = [color, pale, color];
    ring(x, y, color, 120, .72);
    schedule(.12, () => ring(x, y, pale, 72, .55, 2));
    emit(preset, x, y, color, preset === 'spiral' ? 22 : 30, {
      priority: 'critical', pattern, ringRadius: 12, vortexDirection: dir, speedScale: .95, palette,
    });
    emit('bloom', x, y, pale, 12, { priority: 'critical', pattern: 'ring', ringRadius: 8, speedScale: .6, sizeScale: .9 });
    // as celulas assentando no suporte
    schedule(.35, () => emit('spore', x, y - 6, color, 10, { priority: 'normal', pattern: 'cloud', originSpread: 30, speedScale: .6, palette }));
  }

  // Vigor baixo: em vez do halo permanente, um pulso curto de particulas
  // ambar (enfraquecendo) ou vermelhas (quase dormente).
  function vigorPulse(x, y, color) {
    emit('spore', x, y - 10, color, 7, { priority: 'ambient', pattern: 'cloud', originSpread: 34, speedScale: .55, lifeScale: .75, sizeScale: .85 });
    ring(x, y - 8, color, 46, .5, 1.6);
  }

  // Comemoracao do fim da fase, em volta do Miguelito, encenada no tempo.
  function celebrate(x, y, seconds = 1.4) {
    const palette = ['#ffe08a', '#86efad', '#f6ffe0', '#7fd2ff'];
    ring(x, y, '#ffe08a', 230, .95, 3.6);
    schedule(.1, () => ring(x, y, '#86efad', 140, .72, 2.6));
    emit('vortex', x, y, '#86efad', 34, { priority: 'critical', pattern: 'vortex', ringRadius: 26, vortexDirection: 1, speedScale: 1.2, palette });
    emit('spark', x, y - 10, '#ffe08a', 48, { priority: 'critical', pattern: 'fan', angle: -Math.PI / 2, spread: 1.1, speedScale: 1.25, palette });
    const span = Math.max(.9, seconds);
    const bursts = 5;
    for (let i = 0; i < bursts; i++) {
      const a = -Math.PI / 2 + (i - (bursts - 1) / 2) * .62;
      const r = 90 + (i % 2) * 34;
      const bx = x + Math.cos(a) * r, by = y + Math.sin(a) * r * .8;
      const c = palette[i % palette.length];
      schedule(.3 + i * span * .16, () => {
        ring(bx, by, c, 62 + (i % 3) * 12, .5, 2.2);
        emit(i % 2 ? 'shatter' : 'spark', bx, by, c, 18, { priority: 'critical', pattern: 'radial', speedScale: .9, sizeScale: .85, palette: [c, '#ffffff', '#ffe08a'] });
        emit('bloom', bx, by, '#f6ffe0', 10, { priority: 'critical', pattern: 'ring', ringRadius: 8, sizeScale: .85 });
      });
    }
    // esporos dourados subindo durante toda a animacao do Miguelito
    for (let t = .2; t < span; t += .22) {
      schedule(t, () => emit('spore', x + rand(-70, 70), y + rand(-10, 30), '#ffe08a', 3, { priority: 'normal', pattern: 'fan', angle: -Math.PI / 2, spread: .7, speedScale: 1.1, palette }));
    }
  }

  // Pulso da raiz final: uma onda de luz sobe da ponta ate o colo.
  function rootWave(points, seconds = .9) {
    if (!points?.length) return;
    const palette = ['#86efad', '#d9ef88', '#f6ffe0'];
    const n = points.length;
    points.forEach((pt, i) => {
      schedule(i / Math.max(1, n - 1) * seconds * .85, () => {
        emit('filament', pt.x, pt.y, '#86efad', 5, { priority: 'normal', pattern: 'fan', angle: -Math.PI / 2, spread: 1.3, speedScale: .55, sizeScale: .8, palette });
        emit('bloom', pt.x, pt.y, '#d9ef88', 2, { priority: 'normal', pattern: 'cloud', originSpread: 10, speedScale: .3, sizeScale: .8 });
      });
    });
    const top = points[n - 1];
    schedule(seconds * .9, () => {
      ring(top.x, top.y, '#d9ef88', 150, .8, 3);
      emit('spark', top.x, top.y, '#f6ffe0', 36, { priority: 'critical', pattern: 'fan', angle: -Math.PI / 2, spread: 1.6, speedScale: 1.1, palette });
    });
  }

  // --- simulacao e desenho ---------------------------------------------------

  function update(dt) {
    if (!(dt > 0) || (!particles.length && !timeline.length)) return;
    for (let i = timeline.length - 1; i >= 0; i--) {
      const e = timeline[i];
      e.delay -= dt;
      if (e.delay <= 0) { timeline.splice(i, 1); e.fn(); }
    }
    const splits = [];
    let w = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.kind === 'particle' && p.splitPreset && !p.splitDone && p.life / p.maxLife <= p.splitAt) {
        p.splitDone = true;
        splits.push(p);
      }
      if (p.kind === 'ring') {
        p.radius += (p.maxRadius - p.radius) * Math.min(1, dt * 6.5);
      } else if (p.motion === 'wobble') {
        p.wob += dt * p.wobSpeed;
        p.x += (p.vx + Math.cos(p.wob) * 18) * dt;
        p.y += (p.vy + Math.sin(p.wob * .72) * 14) * dt;
      } else {
        if (p.kind === 'particle' && p.turnRate) {
          const a = p.turnRate * dt, cs = Math.cos(a), sn = Math.sin(a), vx = p.vx, vy = p.vy;
          p.vx = vx * cs - vy * sn;
          p.vy = vx * sn + vy * cs;
        }
        p.spin += p.spinSpeed * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const drag = Math.pow(p.drag || .99, dt * 60);
        p.vx *= drag;
        p.vy = (p.vy + p.grav * dt) * drag;
      }
      particles[w++] = p;
    }
    particles.length = w;
    for (const s of splits) {
      emit(s.splitPreset, s.x, s.y, s.color, s.splitCount, { priority: 'critical', pattern: 'radial', sizeScale: s.splitSize, speedScale: s.splitSpeed, lifeScale: .72, noSplit: true, glowScale: .8 });
    }
  }

  function drawParticle(c, p) {
    const lr = clamp(p.life / p.maxLife, 0, 1);
    const birth = clamp((1 - lr) / (p.birthFade ?? .035), 0, 1);
    const fadeStart = p.fadeStart ?? .55;
    const fade = lr > fadeStart ? 1 : Math.pow(clamp(lr / fadeStart, 0, 1), p.fadePower ?? 1);
    const alpha = fade * birth * (p.alpha ?? 1);
    if (alpha <= .003) return;
    c.globalAlpha = alpha;
    if (p.kind === 'ring') {
      c.strokeStyle = p.color;
      c.lineWidth = p.lineWidth || 3.2;
      c.beginPath();
      c.arc(p.x, p.y, p.radius, 0, TAU);
      c.stroke();
      return;
    }
    const shape = p.shape || (p.kind === 'smoke' ? 'cloud' : 'orb');
    const r = (p.radius || 2) * (1 + (1 - lr) * (p.grow || 0));
    const speed = Math.hypot(p.vx, p.vy);
    const dir = speed > 1 ? Math.atan2(p.vy, p.vx) : p.spin;
    const len = (p.length || r * 5) * (.62 + lr * .38);
    const w = p.width || Math.max(.8, r * .65);
    c.save();
    c.translate(p.x, p.y);
    if (shape === 'orb' || shape === 'cloud') {
      const spr = spriteFor(p.color);
      const rr = shape === 'cloud' ? r * (1.25 + (1 - lr) * 1.7) : r;
      const d = rr * (shape === 'cloud' ? 4.8 : 4);
      if (spr) c.drawImage(spr, -d / 2, -d / 2, d, d);
      if (shape === 'orb') {
        c.fillStyle = 'rgba(255,255,255,.72)';
        c.beginPath();
        c.arc(0, 0, Math.max(.7, r * .34), 0, TAU);
        c.fill();
      }
      c.restore();
      return;
    }
    const halo = spriteFor(p.color);
    if (halo) {
      const hr = Math.max(r * 5, w * 7, len * .38) * (p.glowScale || 1);
      c.globalAlpha = alpha * (p.glowAlpha ?? .75);
      c.drawImage(halo, -hr, -hr, hr * 2, hr * 2);
      c.globalAlpha = alpha;
    }
    c.lineCap = 'round';
    if (shape === 'streak') {
      c.rotate(dir);
      c.strokeStyle = rgba(p.color, .52); c.lineWidth = w * 3.6;
      c.beginPath(); c.moveTo(-len, 0); c.lineTo(3, 0); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = Math.max(.8, w * .72);
      c.beginPath(); c.moveTo(-len * .72, 0); c.lineTo(3, 0); c.stroke();
    } else if (shape === 'shard') {
      c.rotate(p.spin + dir * .22);
      c.fillStyle = p.color; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(len * .46, 0); c.lineTo(-len * .34, w * 1.9); c.lineTo(-len * .18, -w * 1.6); c.closePath();
      c.fill(); c.stroke();
    } else if (shape === 'ribbon') {
      c.rotate(dir);
      const bend = p.curve * len;
      c.strokeStyle = rgba(p.color, .5); c.lineWidth = w * 3.7;
      c.beginPath(); c.moveTo(-len, 0); c.quadraticCurveTo(-len * .45, bend, 3, 0); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.84)'; c.lineWidth = Math.max(.75, w * .62);
      c.beginPath(); c.moveTo(-len * .84, 0); c.quadraticCurveTo(-len * .42, bend * .78, 3, 0); c.stroke();
    } else if (shape === 'arc') {
      c.rotate(p.spin + dir);
      const rr = Math.max(5, len * .44), span = 1.3 + Math.abs(p.curve);
      c.strokeStyle = rgba(p.color, .62); c.lineWidth = w * 2.7;
      c.beginPath(); c.arc(0, 0, rr, -span * .5, span * .5); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.82)'; c.lineWidth = Math.max(.7, w * .56);
      c.beginPath(); c.arc(0, 0, rr, -span * .34, span * .5); c.stroke();
    } else if (shape === 'spiral') {
      c.rotate(p.spin);
      c.strokeStyle = rgba(p.color, .68); c.lineWidth = w * 2.2;
      c.beginPath();
      for (let i = 0; i <= 15; i++) {
        const u = i / 15, a = u * TAU * 1.85, rr = u * len * .52;
        if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = Math.max(.65, w * .48);
      c.beginPath();
      for (let i = 5; i <= 15; i++) {
        const u = i / 15, a = u * TAU * 1.85, rr = u * len * .52;
        if (i === 5) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.stroke();
    }
    c.restore();
  }

  // ctx com a camera ja aplicada (como os modulos de organismos).
  function render(ctx, cameraX = 0, viewWidth = 1e9) {
    if (!particles.length) return;
    ctx.save();
    ctx.translate(-cameraX, 0);
    ctx.globalCompositeOperation = 'lighter';
    const x0 = cameraX - 300, x1 = cameraX + viewWidth + 300;
    for (const p of particles) {
      if (p.x < x0 || p.x > x1) continue;
      drawParticle(ctx, p);
    }
    ctx.restore();
  }

  function clear() {
    particles.length = 0;
    timeline.length = 0;
  }

  return {
    emit, ring, schedule, inoculation, vigorPulse, celebrate, rootWave, update, render, clear,
    get count() { return particles.length; },
    get busy() { return particles.length > 0 || timeline.length > 0; },
  };
}

// Uma instancia para o jogo inteiro: os sistemas da simulacao disparam os
// efeitos e o app desenha.
export const vfxParticles = createVfxParticles();
