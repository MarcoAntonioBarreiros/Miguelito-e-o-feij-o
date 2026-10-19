// Radar de patogenos: sinal na borda da tela para cada ameaca fora do quadro.
//
// Ralstonia: chegada (raiz-alvo da chegada em curso) e focos ainda nao
// contidos. Nematoide: J2 a caminho/entrando na raiz (agrupados quando estao
// juntos) e massas de ovos ativas.
//
// Leitura do sinal:
//   - lado e seta: a direcao do alvo;
//   - tamanho: a distancia (quanto maior, mais perto);
//   - estado: chegando = contorno claro pulsando; instalado = ambar;
//     infeccao vascular = vermelho com "!" piscando.
// Alvo dentro da tela nao tem sinal: ali o proprio organismo e o aviso.
//
// So le o estado do jogo; nao muda nada. Desenhado em coordenadas de tela,
// depois do mundo.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const STATE_COLOR = {
  arriving: '#dff7ff',
  installed: '#ffc24a',
  critical: '#ff4d5e',
};
const STATE_RANK = { critical: 3, installed: 2, arriving: 1 };

function collectTargets(state) {
  const level = state.level || {};
  const out = [];

  // Ralstonia chegando: aponta para a raiz onde ela vai se instalar
  const warning = level.pathogenArrival?.warning;
  if (warning && Number.isFinite(warning.targetX)) {
    if (warning.pathogen === 'ralstonia') {
      out.push({ kind: 'ralstonia', status: 'arriving', x: warning.targetX, y: warning.targetY });
    }
  }
  for (const focus of level.ralstoniaFoci || []) {
    if (!focus || focus.neutralized || focus.contained) continue;
    const y = focus.root?.y ?? focus.y;
    if (!Number.isFinite(focus.x) || !Number.isFinite(y)) continue;
    out.push({ kind: 'ralstonia', status: focus.everEnteredVascular ? 'critical' : 'installed', x: focus.x, y });
  }

  // Nematoide: J2 a caminho (agrupados) e massas de ovos ativas
  const clusters = [];
  for (const j of level.nematodeJuveniles || []) {
    if (!j || j.alive === false || j.trichodermaCaught) continue;
    if (j.state !== 'seeking' && j.state !== 'penetrating' && j.state !== 'migrating') continue;
    const status = j.state === 'seeking' ? 'arriving' : 'installed';
    let c = clusters.find(k => Math.hypot(k.x - j.x, k.y - j.y) < 150);
    if (!c) { c = { kind: 'nematode', status, x: j.x, y: j.y, n: 0, sx: 0, sy: 0 }; clusters.push(c); }
    c.n += 1; c.sx += j.x; c.sy += j.y;
    c.x = c.sx / c.n; c.y = c.sy / c.n;
    if (STATE_RANK[status] > STATE_RANK[c.status]) c.status = status;
  }
  out.push(...clusters);
  for (const mass of level.nematodeEggMasses || []) {
    if (!mass || mass.neutralized || !(mass.eggs > 0)) continue;
    out.push({ kind: 'eggs', status: 'installed', x: mass.x, y: mass.y });
  }
  return out;
}

function drawGlyph(ctx, kind, r, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  if (kind === 'ralstonia') {
    // bastonete com flagelo
    ctx.save();
    ctx.rotate(-.5);
    ctx.lineWidth = r * .42;
    ctx.beginPath(); ctx.moveTo(-r * .38, 0); ctx.lineTo(r * .3, 0); ctx.stroke();
    ctx.lineWidth = r * .1;
    ctx.beginPath();
    ctx.moveTo(r * .48, 0);
    ctx.quadraticCurveTo(r * .62, -r * .22, r * .74, 0);
    ctx.stroke();
    ctx.restore();
  } else if (kind === 'nematode') {
    // corpo sinuoso
    ctx.lineWidth = r * .2;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const x = -r * .6 + u * r * 1.2;
      const y = Math.sin(u * TAU * 1.1) * r * .24;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  } else {
    // massa de ovos
    const pts = [[0, 0], [-.32, -.18], [.32, -.18], [-.32, .2], [.32, .2], [0, -.38], [0, .38]];
    for (const [px, py] of pts) {
      ctx.beginPath(); ctx.arc(px * r, py * r, r * .15, 0, TAU); ctx.fill();
    }
  }
}

/**
 * @param ctx contexto 2D do canvas principal (sem transformacao de camera)
 * @param state estado do jogo
 * @param canvas canvas principal (tamanho em pixels de desenho)
 * @param time segundos (animacao)
 * @param coarse true em tela de toque (reserva a faixa dos controles)
 */
export function drawThreatRadar(ctx, state, canvas, time = 0, coarse = false) {
  if (!state?.level || state.gameState !== 'play') return 0;
  const targets = collectTargets(state);
  if (!targets.length) return 0;

  const W = canvas.width || 1280;
  const H = canvas.height || 720;
  const css = canvas.clientWidth ? W / canvas.clientWidth : 1;
  const zoom = state.cameraZoom || 1;
  const camX = state.cameraX || 0;
  const camY = state.cameraY || 0;
  const visW = W / zoom;

  const inset = {
    left: 30 * css,
    right: W - 30 * css,
    top: 78 * css,
    bottom: H - (coarse ? 120 : 30) * css,
  };
  const cx = W / 2;
  const cy = (inset.top + inset.bottom) / 2;
  const maxR = 23 * css;
  const minR = 12 * css;

  const placed = [];
  for (const t of targets) {
    const sx = (t.x - camX) * zoom;
    const sy = (t.y - camY) * zoom;
    if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) continue;
    const dx = sx - cx;
    const dy = sy - cy;
    // ponto da borda (retangulo interno) na direcao do alvo
    const kx = dx > 0 ? (inset.right - cx) / dx : dx < 0 ? (inset.left - cx) / dx : Infinity;
    const ky = dy > 0 ? (inset.bottom - cy) / dy : dy < 0 ? (inset.top - cy) / dy : Infinity;
    const k = Math.min(kx, ky);
    const ex = cx + dx * k;
    const ey = cy + dy * k;
    // distancia em tela inteira de mundo alem da borda -> tamanho
    const worldDist = Math.hypot(t.x - (camX + visW / 2), t.y - (camY + H / zoom / 2));
    const far = clamp((worldDist - visW * .5) / (visW * 2.5), 0, 1);
    const r = maxR + (minR - maxR) * far;
    placed.push({ ...t, ex, ey, r, angle: Math.atan2(dy, dx), side: kx < ky ? 'v' : 'h' });
  }
  if (!placed.length) return 0;

  // afasta sinais sobrepostos ao longo da borda
  placed.sort((a, b) => STATE_RANK[b.status] - STATE_RANK[a.status] || b.r - a.r);
  for (let i = 1; i < placed.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = placed[i], b = placed[j];
      const need = (a.r + b.r) * 1.15;
      if (Math.hypot(a.ex - b.ex, a.ey - b.ey) >= need) continue;
      if (a.side === 'v') a.ey = clamp(b.ey + (a.ey >= b.ey ? need : -need), inset.top, inset.bottom);
      else a.ex = clamp(b.ex + (a.ex >= b.ex ? need : -need), inset.left, inset.right);
    }
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  for (const p of placed) {
    const color = STATE_COLOR[p.status];
    const pulse = p.status === 'arriving' ? 1 + Math.sin(time * 6) * .1 : 1;
    const r = p.r * pulse;
    ctx.save();
    ctx.translate(p.ex, p.ey);
    // seta apontando para o alvo
    ctx.save();
    ctx.rotate(p.angle);
    ctx.fillStyle = color;
    ctx.globalAlpha = .95;
    ctx.beginPath();
    ctx.moveTo(r + r * .62, 0);
    ctx.lineTo(r * .78, -r * .46);
    ctx.lineTo(r * .78, r * .46);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // disco
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.status === 'arriving' ? 'rgba(6,18,24,.78)' : p.status === 'critical' ? 'rgba(70,6,14,.88)' : 'rgba(52,32,4,.88)';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(2, r * .16);
    ctx.strokeStyle = color;
    if (p.status === 'arriving') {
      ctx.globalAlpha = .65 + Math.sin(time * 6) * .35;
      ctx.setLineDash([r * .5, r * .32]);
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    drawGlyph(ctx, p.kind, r, p.status === 'arriving' ? '#ffffff' : color);
    // contagem de J2 agrupados
    if (p.kind === 'nematode' && p.n > 1) {
      ctx.font = `800 ${Math.round(r * .62)}px Inter,system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(p.n), r * .72, r * .72);
    }
    // infeccao vascular: "!" piscando
    if (p.status === 'critical' && Math.sin(time * 8) > -.3) {
      ctx.fillStyle = '#ff4d5e';
      ctx.beginPath(); ctx.arc(-r * .72, -r * .72, r * .38, 0, TAU); ctx.fill();
      ctx.font = `900 ${Math.round(r * .58)}px Inter,system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('!', -r * .72, -r * .7);
    }
    ctx.restore();
  }
  ctx.restore();
  return placed.length;
}
