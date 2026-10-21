// Catalogo da lojinha da fazendinha. Arte provisoria em canvas (formas simples):
// cada item sabe se desenhar com a base (chao) em (x, y) e escala `s`.

export const FARM_SLOT_COUNT = 4;

function fence(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#a9733f'; ctx.strokeStyle = '#6d4523'; ctx.lineWidth = 3;
  for (const px of [-62, -21, 21, 62]) {
    ctx.beginPath();
    ctx.moveTo(px - 9, 0); ctx.lineTo(px - 9, -58); ctx.lineTo(px, -70); ctx.lineTo(px + 9, -58); ctx.lineTo(px + 9, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  for (const py of [-46, -20]) {
    ctx.fillRect(-76, py, 152, 10); ctx.strokeRect(-76, py, 152, 10);
  }
  ctx.restore();
}

function waterTank(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = '#5b4a3a'; ctx.lineWidth = 5;
  for (const lx of [-34, 34]) { ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx * .7, -70); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-30, -24); ctx.lineTo(30, -24); ctx.stroke();
  const g = ctx.createLinearGradient(-44, 0, 44, 0);
  g.addColorStop(0, '#3f8fb8'); g.addColorStop(.5, '#7cc8ea'); g.addColorStop(1, '#2f6f92');
  ctx.fillStyle = g; ctx.strokeStyle = '#1f4a63'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-44, -136, 88, 66, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2a6688'; ctx.beginPath(); ctx.ellipse(0, -136, 44, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-30, -124, 8, 40);
  ctx.restore();
}

function nursery(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // estufinha: estrutura + plastico translucido + mudas
  ctx.fillStyle = '#7a5532'; ctx.fillRect(-80, -8, 160, 8);
  for (let i = 0; i < 6; i++) {
    const px = -62 + i * 25;
    ctx.fillStyle = '#5c3b22'; ctx.fillRect(px - 7, -22, 14, 14);
    ctx.strokeStyle = '#3f9a3a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(px, -22); ctx.lineTo(px, -38); ctx.stroke();
    ctx.fillStyle = '#5fc24f';
    ctx.beginPath(); ctx.ellipse(px - 6, -40, 7, 4, -.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px + 6, -42, 7, 4, .5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(210,240,255,.32)'; ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-84, -8); ctx.lineTo(-84, -70); ctx.quadraticCurveTo(0, -128, 84, -70); ctx.lineTo(84, -8); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-42, -96); ctx.lineTo(-42, -8); ctx.moveTo(0, -107); ctx.lineTo(0, -8); ctx.moveTo(42, -96); ctx.lineTo(42, -8); ctx.stroke();
  ctx.restore();
}

export const FARM_ITEMS = Object.freeze([
  Object.freeze({ id: 'fence', name: 'Cerca de madeira', price: 30,
    blurb: 'Protege o canteiro e deixa a fazendinha arrumada.', draw: fence }),
  Object.freeze({ id: 'water-tank', name: "Caixa d'água", price: 70,
    blurb: 'Água guardada para os dias secos.', draw: waterTank }),
  Object.freeze({ id: 'nursery', name: 'Viveiro pequeno', price: 120,
    blurb: 'Mudas protegidas até irem para o canteiro.', draw: nursery }),
]);

export function getFarmItem(id) {
  return FARM_ITEMS.find(item => item.id === id) || null;
}
