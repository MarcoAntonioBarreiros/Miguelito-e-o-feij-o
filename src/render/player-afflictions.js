// O que esta grudado no Miguelito, desenhado POR CIMA do corpo (no 2,5D o corpo
// vai para a GPU e e desenhado depois; por isso isto entra na mesma passada da
// mochila). Coordenadas locais: origem no centro do jogador, x ja espelhado
// pelo facing. So desenho: contaminacao, carga de J2 e dano vem dos sistemas.
//
// - Contaminacao fungica: hifas rosadas sobem dos pes conforme a porcentagem;
//   acima de ~40% caem esporos e fica uma trilha grudenta curta; ao limpar, as
//   hifas secam e caem em pedacos.
// - J2 carregado: um juvenil pequeno, curvado, com a cabeca enterrada na perna
//   e o corpo se contorcendo; vermelho quando ja esta causando dano.
// - Dash bloqueado: icone em vez do texto.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

export function createPlayerAfflictions() {
  let shown = 0;            // contaminacao desenhada (acompanha a real)
  let shownRhizo = 0;       // infeccao por Rhizoctonia desenhada
  let lastTime = null;
  let trailTimer = 0;
  const fragments = [];     // pedacos de hifa seca caindo (mundo)
  const trail = [];         // manchas grudentas no chao (mundo)

  function step(player, time) {
    const dt = lastTime === null ? 0 : clamp(time - lastTime, 0, .1);
    lastTime = time;
    const c = clamp(player.fungalContamination || 0, 0, 1);
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    // limpou: as hifas que sumiram secam e caem
    if (c < shown - .06) {
      const n = Math.min(14, Math.round((shown - c) * 26));
      for (let i = 0; i < n; i++) {
        fragments.push({
          x: cx + (Math.random() - .5) * 20,
          y: cy + 20 - Math.random() * (10 + shown * 46),
          vx: (Math.random() - .5) * 50,
          vy: -20 - Math.random() * 40,
          rot: Math.random() * TAU,
          spin: (Math.random() - .5) * 8,
          len: 4 + Math.random() * 6,
          life: .9 + Math.random() * .5,
          max: 1.4,
        });
      }
    }
    shown += (c - shown) * clamp(dt * 6, 0, 1);
    // Rhizoctonia: mesma ideia; ao curar, o micelio seco cai
    const r = clamp(player.infection || 0, 0, 1);
    if (r < shownRhizo - .06) {
      const n = Math.min(12, Math.round((shownRhizo - r) * 22));
      for (let i = 0; i < n; i++) {
        fragments.push({
          x: cx + (Math.random() - .5) * 20, y: cy + 22 - Math.random() * (8 + shownRhizo * 30),
          vx: (Math.random() - .5) * 46, vy: -18 - Math.random() * 36,
          rot: Math.random() * TAU, spin: (Math.random() - .5) * 8,
          len: 3 + Math.random() * 5, life: .9 + Math.random() * .5, max: 1.4,
        });
      }
    }
    shownRhizo += (r - shownRhizo) * clamp(dt * 6, 0, 1);
    for (const f of fragments) {
      f.life -= dt; f.vy += 220 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt;
    }
    for (let i = fragments.length - 1; i >= 0; i--) if (fragments[i].life <= 0) fragments.splice(i, 1);
    // trilha grudenta ao andar contaminado
    for (const m of trail) m.life -= dt;
    for (let i = trail.length - 1; i >= 0; i--) if (trail[i].life <= 0) trail.splice(i, 1);
    trailTimer -= dt;
    if (c > .4 && player.onGround && Math.abs(player.vx || 0) > 40 && trailTimer <= 0) {
      trailTimer = .11;
      trail.push({ x: cx + (Math.random() - .5) * 8, y: player.y + player.h, life: 1.6, size: 4 + c * 5 });
      if (trail.length > 24) trail.shift();
    }
    return { c: shown, r: shownRhizo, cx, cy };
  }

  // Hifas como rede que envolve o corpo: cada uma nasce nos pes/pernas e
  // caminha para cima mudando de direcao (passeio aleatorio fixo por indice),
  // com ramos curtos. O comprimento cresce com a contaminacao.
  function drawHyphae(ctx, c, time) {
    if (c < .04) return;
    const n = Math.round(4 + c * 10);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < n; i++) {
      const steps = 3 + Math.round(c * 9 * (.6 + .4 * hash(i + 9)));
      let x = -10 + hash(i + 1) * 20;
      let y = 22 - hash(i + 2) * 8;
      let ang = -Math.PI / 2 + (hash(i + 3) - .5) * 1.2;
      const pts = [[x, y]];
      for (let k = 0; k < steps; k++) {
        ang += (hash(i * 31 + k * 7) - .5) * 1.3 + Math.sin(time * 1.3 + i + k) * .05;
        ang = clamp(ang, -Math.PI + .35, -.35); // sempre subindo, de lado
        const len = 4 + hash(i * 13 + k) * 3;
        x = clamp(x + Math.cos(ang) * len, -14, 14);
        y = Math.max(-34, y + Math.sin(ang) * len);
        pts.push([x, y]);
      }
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length - 1; k++) {
          const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2;
          ctx.quadraticCurveTo(pts[k][0], pts[k][1], mx, my);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last[0], last[1]);
      };
      ctx.globalAlpha = .55 + c * .4;
      ctx.strokeStyle = 'rgba(70,24,48,.85)'; ctx.lineWidth = 2.1; path(); ctx.stroke();
      ctx.strokeStyle = c > .7 ? '#ff9cc0' : '#f4b2cd'; ctx.lineWidth = .95; path(); ctx.stroke();
      // ramos curtos
      for (let k = 2; k < pts.length - 1; k += 3) {
        if (hash(i * 17 + k) < .45) continue;
        const [bx, by] = pts[k];
        const dir = hash(i * 5 + k) < .5 ? -1 : 1;
        ctx.strokeStyle = '#f4b2cd'; ctx.lineWidth = .8;
        ctx.beginPath(); ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + dir * 3, by - 1.5, bx + dir * 5.5, by - 4 + Math.sin(time * 2 + i + k) * .6);
        ctx.stroke();
      }
      if (i % 3 === 0) {
        const last = pts[pts.length - 1];
        ctx.fillStyle = '#ffd1e2';
        ctx.beginPath(); ctx.arc(last[0], last[1], 1 + c * .7, 0, TAU); ctx.fill();
      }
    }
    // penugem: pontinhos de micelio no corpo quando a contaminacao e alta
    if (c > .5) {
      ctx.fillStyle = '#f7c4d8';
      const k = Math.round((c - .5) * 40);
      for (let s = 0; s < k; s++) {
        ctx.globalAlpha = .35 + .3 * Math.sin(time * 2 + s);
        ctx.beginPath(); ctx.arc(-12 + hash(s + 40) * 24, -26 + hash(s + 50) * 46, .9, 0, TAU); ctx.fill();
      }
    }
    // esporos caindo do corpo
    if (c > .4) {
      const k = Math.round((c - .4) * 10) + 2;
      for (let s = 0; s < k; s++) {
        const ph = (time * .8 + hash(s + 20)) % 1;
        ctx.globalAlpha = (1 - ph) * .85;
        ctx.fillStyle = s % 2 ? '#e58fb0' : '#c86b85';
        ctx.beginPath(); ctx.arc(-8 + hash(s + 30) * 16, -12 + ph * 38, 1.4, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawWorldBits(ctx, player, cx, cy) {
    const facing = player.facing || 1;
    const local = (x, y) => [(x - cx) * facing, y - cy];
    ctx.save();
    for (const m of trail) {
      const [x, y] = local(m.x, m.y);
      ctx.globalAlpha = clamp(m.life / 1.6, 0, 1) * .55;
      ctx.fillStyle = '#d97aa2';
      ctx.beginPath(); ctx.ellipse(x, y - 1, m.size, m.size * .32, 0, 0, TAU); ctx.fill();
    }
    for (const f of fragments) {
      const [x, y] = local(f.x, f.y);
      ctx.globalAlpha = clamp(f.life / .5, 0, 1);
      ctx.strokeStyle = '#8a6248';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(f.rot) * f.len / 2, y - Math.sin(f.rot) * f.len / 2);
      ctx.lineTo(x + Math.cos(f.rot) * f.len / 2, y + Math.sin(f.rot) * f.len / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // J2 agarrado: cabeca enterrada na perna (com o estilete), corpo curvado
  // saindo e se contorcendo.
  function drawLatchedJ2(ctx, slot, time, harmful) {
    const ax = slot ? -5 : 5;
    const ay = slot ? 9 : 17;
    const side = slot ? -1 : 1;
    const w = Math.sin(time * 9 + slot * 2);
    const w2 = Math.sin(time * 9 + slot * 2 + 1.4);
    // sai de lado da perna e a cauda se debate para fora (nao pendura ate o chao)
    const p1 = [ax + side * 6, ay - 2];
    const p2 = [ax + side * (11 + w2 * 1.5), ay + 1 + w * 3];
    const p3 = [ax + side * (15 + w * 2), ay + 5 + w2 * 3.5];
    ctx.save();
    ctx.lineCap = 'round';
    // furo na perna e estilete
    ctx.fillStyle = '#6b2a2a';
    ctx.beginPath(); ctx.arc(ax, ay, 1.6, 0, TAU); ctx.fill();
    const body = width => {
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
      ctx.stroke();
    };
    if (harmful) {
      ctx.globalAlpha = .45 + .25 * Math.sin(time * 8);
      ctx.strokeStyle = '#ff4d6d'; body(6.2);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = '#5e4a36'; body(4.2);
    ctx.strokeStyle = '#cdb68f'; body(2.6);
    // aneis do corpo
    ctx.strokeStyle = 'rgba(123,98,72,.6)';
    ctx.lineWidth = .7;
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      const u = 1 - t;
      const x = u * u * u * ax + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
      const y = u * u * u * ay + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
      ctx.beginPath(); ctx.arc(x, y, 1.2, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  function drawDashBlocked(ctx, time) {
    ctx.save();
    ctx.translate(0, -60 + Math.sin(time * 4) * 1.5);
    ctx.globalAlpha = .95;
    ctx.fillStyle = 'rgba(40,16,18,.75)';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd7a0'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -3); ctx.lineTo(-1, 0); ctx.lineTo(-5, 3);
    ctx.moveTo(0, -3); ctx.lineTo(4, 0); ctx.lineTo(0, 3);
    ctx.stroke();
    ctx.strokeStyle = '#ff5a6e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-6.5, 6.5); ctx.lineTo(6.5, -6.5); ctx.stroke();
    ctx.restore();
  }

  // Rhizoctonia (fase 6+): micelio bege-castanho com ramos em angulo reto
  // (o jeito dela), manchas de lesao escura nas pernas e, alta, escleródios.
  // Fica nas pernas e no tronco baixo: e um fungo de colo/caule.
  function drawRhizoctonia(ctx, r, time) {
    if (r < .03) return;
    ctx.save();
    ctx.lineCap = 'round';
    // lesoes (por baixo das hifas)
    const lesions = 1 + Math.round(r * 4);
    for (let i = 0; i < lesions; i++) {
      const x = -9 + hash(i + 70) * 18;
      const y = 6 + hash(i + 71) * 16;
      ctx.globalAlpha = .35 + r * .45;
      ctx.fillStyle = 'rgba(52,32,20,.9)';
      ctx.beginPath(); ctx.ellipse(x, y, 2.4 + r * 3.2, 1.6 + r * 2, hash(i + 72) * 3, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(214,170,110,.75)'; ctx.lineWidth = .9; ctx.stroke();
    }
    // hifas com ramos a 90 graus
    const n = 2 + Math.round(r * 7);
    for (let i = 0; i < n; i++) {
      let x = -10 + hash(i + 80) * 20;
      let y = 23 - hash(i + 81) * 4;
      const steps = 2 + Math.round(r * 6 * (.6 + .4 * hash(i + 82)));
      const pts = [[x, y]];
      const branches = [];
      for (let k = 0; k < steps; k++) {
        const len = 4 + hash(i * 11 + k) * 2.5;
        x = clamp(x + (hash(i * 7 + k) - .5) * 5.5, -13, 13);
        y = Math.max(-14, y - len);
        pts.push([x, y]);
        if (k > 0 && hash(i * 19 + k) > .72) branches.push([x, y, hash(i * 23 + k) < .5 ? -1 : 1, 2.5 + hash(i * 29 + k) * 3]);
      }
      const stroke = (color, width) => {
        ctx.strokeStyle = color; ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        for (const [bx, by, dir, len] of branches) {
          // quase em angulo reto, curvando para cima na ponta
          ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(bx + dir * len * .8, by + .3, bx + dir * len, by - len * .45 + Math.sin(time * 1.5 + i) * .4);
        }
        ctx.stroke();
      };
      ctx.globalAlpha = .6 + r * .35;
      stroke('#5e4c36', 2);
      stroke('#cbbd9e', .9);
      // estrangulamento na base de cada ramo (marca da Rhizoctonia)
      ctx.fillStyle = '#806e51';
      for (const [bx, by] of branches) { ctx.beginPath(); ctx.arc(bx, by, .9, 0, TAU); ctx.fill(); }
    }
    // escleródios
    if (r > .45) {
      const k = Math.round((r - .45) * 12) + 1;
      for (let i = 0; i < k; i++) {
        ctx.globalAlpha = .9;
        ctx.fillStyle = i % 2 ? '#3d2a1c' : '#4f3825';
        ctx.beginPath();
        ctx.ellipse(-10 + hash(i + 90) * 20, 10 + hash(i + 91) * 12, 1.6 + hash(i + 92), 1.2 + hash(i + 93) * .8, hash(i + 94) * 3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Desenha tudo; `ctx` ja esta no centro do jogador, escalado pelo facing. */
  function draw(ctx, player, time, juveniles = []) {
    const { c, r, cx, cy } = step(player, time);
    drawWorldBits(ctx, player, cx, cy);
    drawRhizoctonia(ctx, r, time);
    drawHyphae(ctx, c, time);
    const carried = juveniles.filter(j => j.alive && j.carriedByPlayer);
    carried.slice(0, 2).forEach((j, i) => drawLatchedJ2(ctx, j.carrySlot ?? i, time, (j.carryTime || 0) > 5.5));
    if ((player.nematodeLoad || 0) >= 2) drawDashBlocked(ctx, time);
  }

  return { draw };
}
