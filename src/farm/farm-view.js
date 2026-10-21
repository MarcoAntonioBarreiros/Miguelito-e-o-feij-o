// FAZENDINHA: uma tela 2D frontal, ilustrada em camadas (ceu, morro, casinha,
// canteiro e quatro espacos de melhoria), com a lojinha embaixo. Nada de mapa,
// grade ou vista de cima: e uma "tela viva" clicavel.
//
// Arte provisoria desenhada em canvas; quando houver ilustracao, troca-se o
// desenho de cada camada sem mexer no estado (farm-state.js).

import { FARM_ITEMS, FARM_SLOT_COUNT, getFarmItem } from './farm-items.js';
import { buyItem, canBuy, loadFarm, pickUpItem, placeItem, saveFarm } from './farm-state.js';

const W = 960, H = 540;
// base (chao) de cada espaco de melhoria, em coordenadas da cena
const SLOTS = [
  { x: 676, y: 392, s: .72 },
  { x: 860, y: 392, s: .72 },
  { x: 650, y: 500, s: .86 },
  { x: 850, y: 500, s: .86 },
];

const STYLE = `
#farm-overlay { position: fixed; inset: 0; z-index: 240; display: flex; flex-direction: column; align-items: center;
  gap: 10px; padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom)); overflow-y: auto;
  background: rgba(14,8,5,.92); color: #fbeedd; font-family: 'Tutorial Atkinson','Atkinson Hyperlegible',system-ui,sans-serif; }
#farm-overlay[hidden] { display: none; }
#farm-overlay .farm-top { width: min(960px,100%); display: flex; align-items: center; gap: 12px; }
#farm-overlay h1 { margin: 0; font: 800 1.7rem/1 'Tutorial Grandstander','Grandstander',system-ui; color: #fff4e2; }
#farm-overlay .farm-coins { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px;
  border-radius: 999px; background: #3a1a11; border: 1px solid rgba(255,214,170,.25); font: 800 1.15rem/1 system-ui; }
.farm-coin { display: inline-block; width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff2a8, #f2b63c 60%, #b97a17);
  box-shadow: inset 0 0 0 2px #c98a1d; vertical-align: -3px; }
#farm-overlay .farm-back { border: 1.5px solid rgba(255,214,170,.3); background: transparent; color: #fbeedd; border-radius: 999px;
  padding: 8px 16px; font: 700 .95rem/1 inherit; cursor: pointer; }
#farm-overlay > canvas { flex: none; height: auto; width: min(960px, 100%, max(calc((100dvh - 230px) * 16 / 9), 320px)); aspect-ratio: 16/9; border-radius: 16px; box-shadow: 0 16px 40px rgba(0,0,0,.5); cursor: pointer; touch-action: manipulation; }
#farm-overlay .farm-msg { min-height: 1.3em; margin: 0; color: #ffc35a; font-weight: 700; text-align: center; }
#farm-overlay .farm-shop { width: min(960px,100%); display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }
#farm-overlay .farm-item { display: grid; grid-template-columns: 64px 1fr; gap: 10px; align-items: center; padding: 10px; border-radius: 14px;
  background: linear-gradient(160deg,#3a1a11,#2a130d 60%); border: 1px solid rgba(255,214,170,.2); }
#farm-overlay .farm-item canvas { width: 64px; height: 64px; aspect-ratio: auto; border-radius: 10px; box-shadow: none; background: #f6ecd2; cursor: default; }
#farm-overlay .farm-item strong { display: block; font-size: 1rem; }
#farm-overlay .farm-item small { display: block; color: #dcbfa3; font-size: .8rem; line-height: 1.3; margin: 2px 0 6px; }
#farm-overlay .farm-buy { border: 0; border-radius: 999px; padding: 7px 14px; background: #ffc35a; color: #3a1608; font: 800 .9rem/1 system-ui;
  box-shadow: 0 3px 0 #b3651f; cursor: pointer; }
#farm-overlay .farm-buy:disabled { opacity: .4; cursor: default; box-shadow: none; }
@media (max-width: 700px) { #farm-overlay .farm-shop { grid-template-columns: 1fr; } }
`;

function ensureStyle() {
  if (document.getElementById('farm-style')) return;
  const style = document.createElement('style');
  style.id = 'farm-style';
  style.textContent = STYLE;
  document.head.appendChild(style);
}

// ---- cena -----------------------------------------------------------------
function drawSky(c, t) {
  const g = c.createLinearGradient(0, 0, 0, 320);
  g.addColorStop(0, '#8fd0ee'); g.addColorStop(1, '#fdf1d2');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,236,150,.9)'; c.beginPath(); c.arc(820, 86, 42, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.85)';
  for (const [x, y, k] of [[180, 80, 1], [470, 60, .8], [690, 130, .7]]) {
    const dx = ((x + t * 6 * k) % (W + 200)) - 100;
    for (const [ox, oy, r] of [[0, 0, 26], [26, -10, 22], [50, 2, 24], [24, 8, 22]]) {
      c.beginPath(); c.arc(dx + ox * k, y + oy * k, r * k, 0, Math.PI * 2); c.fill();
    }
  }
}

function drawHills(c) {
  c.fillStyle = '#9fd17a';
  c.beginPath(); c.moveTo(0, 300); c.quadraticCurveTo(220, 210, 470, 290); c.quadraticCurveTo(720, 220, 960, 280); c.lineTo(960, 360); c.lineTo(0, 360); c.fill();
  c.fillStyle = '#7fbf5b';
  c.beginPath(); c.moveTo(0, 340); c.quadraticCurveTo(300, 290, 600, 330); c.quadraticCurveTo(800, 300, 960, 330); c.lineTo(960, 400); c.lineTo(0, 400); c.fill();
  const g = c.createLinearGradient(0, 360, 0, H);
  g.addColorStop(0, '#6cad49'); g.addColorStop(1, '#4f8f36');
  c.fillStyle = g; c.fillRect(0, 370, W, H - 370);
}

function drawHouse(c) {
  c.save(); c.translate(40, 430);
  c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.ellipse(130, 6, 150, 14, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f3e3c3'; c.strokeStyle = '#8a6a48'; c.lineWidth = 3;
  c.fillRect(20, -150, 220, 150); c.strokeRect(20, -150, 220, 150);
  c.fillStyle = '#c4553a'; c.strokeStyle = '#7d2f1f';
  c.beginPath(); c.moveTo(0, -146); c.lineTo(130, -236); c.lineTo(260, -146); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#8a6a48'; c.fillRect(186, -222, 22, 46);
  c.fillStyle = '#7a4a2a'; c.fillRect(100, -86, 54, 86);
  c.fillStyle = '#ffd36f'; c.beginPath(); c.arc(144, -42, 4, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#bfe4f4'; c.strokeStyle = '#8a6a48';
  for (const wx of [38, 180]) { c.fillRect(wx, -118, 46, 40); c.strokeRect(wx, -118, 46, 40); c.beginPath(); c.moveTo(wx + 23, -118); c.lineTo(wx + 23, -78); c.moveTo(wx, -98); c.lineTo(wx + 46, -98); c.stroke(); }
  c.restore();
}

// O canteiro mostra o feijoeiro da ultima colheita: doente, saudavel ou super.
function drawBed(c, plantState, t) {
  c.save(); c.translate(318, 470);
  c.fillStyle = '#7a4f2c'; c.beginPath(); c.roundRect(0, -26, 270, 46, 12); c.fill();
  c.fillStyle = '#5e3a1f';
  for (let r = 0; r < 3; r++) c.fillRect(14, -18 + r * 13, 242, 4);
  const conf = [
    { h: 34, leaf: '#b9b65a', pods: 0 },
    { h: 52, leaf: '#4fa63a', pods: 1 },
    { h: 70, leaf: '#2f9a34', pods: 2 },
  ][plantState ?? 1];
  for (let i = 0; i < 6; i++) {
    const px = 28 + i * 43, sway = Math.sin(t * 1.4 + i) * 3;
    c.strokeStyle = '#3f7d2a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(px, -18); c.quadraticCurveTo(px + sway, -18 - conf.h / 2, px + sway, -18 - conf.h); c.stroke();
    c.fillStyle = conf.leaf;
    for (let k = 1; k <= 3; k++) {
      const ly = -18 - conf.h * k / 3.4;
      c.beginPath(); c.ellipse(px + sway - 9, ly, 10, 6, -.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(px + sway + 9, ly - 3, 10, 6, .5, 0, Math.PI * 2); c.fill();
    }
    for (let k = 0; k < conf.pods; k++) {
      c.fillStyle = '#8bc34a';
      c.beginPath(); c.ellipse(px + sway + 4, -30 - k * 14, 3, 9, .3, 0, Math.PI * 2); c.fill();
    }
  }
  c.restore();
}

function drawSlot(c, slot, index, farm, placing, hover, t) {
  const itemId = farm.slots[index];
  if (itemId) {
    c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.ellipse(slot.x, slot.y + 2, 70 * slot.s, 10 * slot.s, 0, 0, Math.PI * 2); c.fill();
    getFarmItem(itemId).draw(c, slot.x, slot.y, slot.s);
    if (hover === index && !placing) {
      c.fillStyle = 'rgba(255,255,255,.9)'; c.font = '700 14px system-ui'; c.textAlign = 'center';
      c.fillText('toque para mudar de lugar', slot.x, slot.y + 22);
    }
    return;
  }
  const pulse = placing ? .55 + .45 * Math.sin(t * 5) : .5;
  c.save();
  c.setLineDash([8, 6]); c.lineWidth = 3;
  c.strokeStyle = placing ? `rgba(255,214,110,${pulse})` : 'rgba(255,255,255,.45)';
  c.fillStyle = placing ? 'rgba(255,214,110,.16)' : 'rgba(255,255,255,.08)';
  c.beginPath(); c.ellipse(slot.x, slot.y - 4, 72 * slot.s, 20 * slot.s, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.setLineDash([]);
  c.fillStyle = placing ? '#ffd36f' : 'rgba(255,255,255,.7)'; c.font = '800 22px system-ui'; c.textAlign = 'center';
  c.fillText('+', slot.x, slot.y + 4);
  c.restore();
}

function slotAt(x, y) {
  return SLOTS.findIndex(slot => Math.abs(x - slot.x) < 86 * slot.s + 10 && y < slot.y + 26 && y > slot.y - 150 * slot.s);
}

export function createFarmView({ onClose = () => {} } = {}) {
  let root = null, canvas = null, ctx = null, frame = null, farm = null, hover = -1, elapsed = 0, last = 0;

  function message(text) { root.querySelector('.farm-msg').textContent = text || ''; }

  function plantState() {
    const score = farm.lastHarvest?.score;
    if (!Number.isFinite(score)) return 1;
    return score >= 85 ? 2 : score >= 60 ? 1 : 0;
  }

  function draw(now = performance.now()) {
    frame = null;
    if (!root || root.hidden) return;
    elapsed += last ? Math.min(.05, (now - last) / 1000) : 0;
    last = now;
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    drawSky(ctx, elapsed);
    drawHills(ctx);
    drawHouse(ctx);
    // fundo primeiro (espacos de tras), depois o canteiro e os da frente
    drawSlot(ctx, SLOTS[0], 0, farm, farm.inventory.length > 0, hover, elapsed);
    drawSlot(ctx, SLOTS[1], 1, farm, farm.inventory.length > 0, hover, elapsed);
    drawBed(ctx, plantState(), elapsed);
    drawSlot(ctx, SLOTS[2], 2, farm, farm.inventory.length > 0, hover, elapsed);
    drawSlot(ctx, SLOTS[3], 3, farm, farm.inventory.length > 0, hover, elapsed);
    frame = requestAnimationFrame(draw);
  }

  function renderShop() {
    root.querySelector('.farm-coins-value').textContent = farm.coins;
    for (const card of root.querySelectorAll('.farm-item')) {
      const check = canBuy(farm, card.dataset.item);
      const button = card.querySelector('.farm-buy');
      button.disabled = !check.ok;
      button.title = check.reason === 'coins' ? 'Moedas insuficientes'
        : check.reason === 'no-space' ? 'Sem espaço livre' : 'Comprar';
    }
  }

  function persist() { saveFarm(farm); renderShop(); }

  function ensureDom() {
    if (root) return;
    ensureStyle();
    root = document.createElement('div');
    root.id = 'farm-overlay';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Fazendinha');
    root.innerHTML = `
      <div class="farm-top">
        <h1>Fazendinha</h1>
        <span class="farm-coins" aria-label="Moedas"><span class="farm-coin"></span><span class="farm-coins-value">0</span></span>
        <button type="button" class="farm-back">Voltar</button>
      </div>
      <canvas width="1920" height="1080" aria-label="Cena da fazendinha"></canvas>
      <p class="farm-msg" aria-live="polite"></p>
      <div class="farm-shop">${FARM_ITEMS.map(item => `
        <div class="farm-item" data-item="${item.id}">
          <canvas width="128" height="128" aria-hidden="true"></canvas>
          <div><strong>${item.name}</strong><small>${item.blurb}</small>
            <button type="button" class="farm-buy"><span class="farm-coin"></span> ${item.price}</button></div>
        </div>`).join('')}</div>`;
    document.body.appendChild(root);
    canvas = root.querySelector(':scope > canvas');
    ctx = canvas.getContext('2d');
    // miniaturas da loja
    for (const card of root.querySelectorAll('.farm-item')) {
      const item = getFarmItem(card.dataset.item);
      const c = card.querySelector('canvas').getContext('2d');
      item.draw(c, 64, 118, item.id === 'fence' ? .7 : .78);
      card.querySelector('.farm-buy').addEventListener('click', () => {
        const result = buyItem(farm, item.id);
        if (!result.ok) {
          message(result.reason === 'coins' ? 'Moedas insuficientes: jogue mais uma fase para colher mais.' : 'Não há espaço livre na fazendinha.');
          return;
        }
        persist();
        message(`${item.name} comprado! Toque num espaço livre para colocar.`);
      });
    }
    root.querySelector('.farm-back').addEventListener('click', close);
    const toScene = event => {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
    };
    canvas.addEventListener('pointermove', event => { const p = toScene(event); hover = slotAt(p.x, p.y); });
    canvas.addEventListener('pointerleave', () => { hover = -1; });
    canvas.addEventListener('click', event => {
      const p = toScene(event);
      const index = slotAt(p.x, p.y);
      if (index < 0) return;
      if (farm.inventory.length && !farm.slots[index]) {
        const name = getFarmItem(farm.inventory[0]).name;
        placeItem(farm, index);
        persist();
        message(farm.inventory.length ? 'Pronto! Ainda há item para colocar.' : `${name} no lugar.`);
      } else if (farm.slots[index] && !farm.inventory.length) {
        pickUpItem(farm, index);
        persist();
        message('Escolha o novo espaço para o item.');
      } else if (farm.slots[index]) {
        message('Coloque primeiro o item que está na mão.');
      }
    });
    // Enquanto a fazendinha esta aberta, o teclado nao chega ao jogo.
    window.addEventListener('keydown', event => {
      if (root.hidden) return;
      event.stopImmediatePropagation();
      if (event.code === 'Escape') { event.preventDefault(); close(); }
    }, true);
  }

  function open() {
    ensureDom();
    farm = loadFarm();
    root.hidden = false;
    hover = -1; last = 0;
    renderShop();
    message(farm.inventory.length ? 'Toque num espaço livre para colocar o item.'
      : farm.coins ? 'Use as moedas da colheita na lojinha.' : 'Conclua fases para colher moedas.');
    if (!frame) frame = requestAnimationFrame(draw);
    root.querySelector('.farm-back').focus();
  }

  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    if (frame) cancelAnimationFrame(frame);
    frame = null;
    onClose();
  }

  return {
    open,
    close,
    get isOpen() { return Boolean(root && !root.hidden); },
    get slotCount() { return FARM_SLOT_COUNT; },
  };
}
