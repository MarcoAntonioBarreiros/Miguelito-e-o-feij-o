// Calmaria no modo 2D: aproximacao da correcao de cor do 2,5D com modos de
// mistura do canvas. Desenha em coordenadas do mundo (zoom/Y da camera ja aplicados).
// So visual: le state.calmZones e nao escreve nada.

export function drawCalmGrade2D(ctx, state) {
  const zones = state?.calmZones;
  if (!zones?.length) return;
  // como os outros sistemas do mundo: a camera aplica zoom e Y; o X e de cada um
  ctx.save();
  ctx.translate(-(state.cameraX || 0), 0);
  for (const zone of zones) {
    const k = zone.intensity || 0;
    if (k <= 0) continue;
    const r = zone.radius;
    const inner = Math.max(1, r - Math.max(60, r * .28));
    ctx.save();
    // primeiro clareia (screen levanta o escuro para pessego/rosa claro)...
    ctx.globalCompositeOperation = 'screen';
    let g = ctx.createRadialGradient(zone.x, zone.y - r * .2, 0, zone.x, zone.y, r);
    g.addColorStop(0, `rgba(255,186,140,${.5 * k})`);
    g.addColorStop(inner / r, `rgba(250,150,170,${.36 * k})`);
    g.addColorStop(1, 'rgba(250,150,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(zone.x - r, zone.y - r, r * 2, r * 2);
    // ...depois aquece os tons sem escurecer
    ctx.globalCompositeOperation = 'soft-light';
    g = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, r);
    g.addColorStop(0, `rgba(255,170,110,${.35 * k})`);
    g.addColorStop(inner / r, `rgba(255,140,170,${.3 * k})`);
    g.addColorStop(1, 'rgba(255,140,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(zone.x - r, zone.y - r, r * 2, r * 2);
    ctx.restore();
  }
  ctx.restore();
}
