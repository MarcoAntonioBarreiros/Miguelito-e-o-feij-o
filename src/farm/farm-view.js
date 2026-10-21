// FAZENDINHA: uma tela 2D frontal, ilustrada em camadas (ceu, morro, casinha,
// canteiro e quatro espacos de melhoria), com a lojinha embaixo. Nada de mapa,
// grade ou vista de cima: e uma "tela viva" clicavel.
//
// Arte provisoria desenhada em canvas; quando houver ilustracao, troca-se o
// desenho de cada camada sem mexer no estado (farm-state.js).

import { FARM_ITEMS, FARM_SLOT_COUNT, getFarmItem } from './farm-items.js';
import {
  buyItem, canBuy, collectHarvests, loadFarm, pendingCoins, pendingHarvests, pickUpItem, placeItem, saveFarm,
} from './farm-state.js';
import { fieldLevelFromScore } from './bean-field.js';
import { createFarmScene, depthAt, FARM_SLOTS, HARVEST_PATH, harvestPose } from './farm-scene.js';


const STYLE = `
#farm-overlay { position: fixed; inset: 0; z-index: 240; background: #1b120c; color: #fbeedd; overflow: hidden;
  font-family: 'Tutorial Atkinson','Atkinson Hyperlegible',system-ui,sans-serif; touch-action: none; }
#farm-overlay[hidden] { display: none; }
/* o jogo pinta todo <canvas> de #222 (index.html): aqui eles sao camadas transparentes */
#farm-overlay canvas { background: transparent; image-rendering: auto; object-fit: fill; }
#farm-overlay .farm-stage, #farm-overlay .farm-gl, #farm-overlay .farm-marks { position: absolute; inset: 0; width: 100%; height: 100%; }
#farm-overlay .farm-marks { cursor: pointer; }
#farm-overlay .farm-top { position: absolute; top: max(12px, env(safe-area-inset-top)); left: 16px; right: 16px; display: flex; align-items: center; gap: 12px; pointer-events: none; }
#farm-overlay .farm-top > * { pointer-events: auto; }
#farm-overlay h1 { margin: 0; font: 800 1.8rem/1 'Tutorial Grandstander','Grandstander',system-ui; color: #fff8e8;
  text-shadow: 0 2px 0 rgba(80,40,10,.45), 0 0 18px rgba(0,0,0,.25); }
#farm-overlay .farm-coins { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 999px;
  background: rgba(42,19,13,.82); border: 1px solid rgba(255,214,170,.3); font: 800 1.15rem/1 system-ui; backdrop-filter: blur(4px); }
.farm-coin { display: inline-block; width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff2a8, #f2b63c 60%, #b97a17);
  box-shadow: inset 0 0 0 2px #c98a1d; vertical-align: -3px; }
#farm-overlay .farm-back { border: 1px solid rgba(255,214,170,.35); background: rgba(42,19,13,.82); color: #fbeedd; border-radius: 999px;
  padding: 9px 16px; font: 700 .95rem/1 inherit; cursor: pointer; backdrop-filter: blur(4px); }
#farm-overlay .farm-bottom { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 16px max(14px, env(safe-area-inset-bottom));
  display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }
#farm-overlay .farm-msg { margin: 0; padding: 6px 14px; border-radius: 999px; background: rgba(42,19,13,.78); color: #ffd36f; font-weight: 700;
  text-align: center; min-height: 1.2em; }
#farm-overlay .farm-msg:empty { display: none; }
#farm-overlay .farm-shop-toggle { pointer-events: auto; border: 0; border-radius: 999px; padding: 11px 22px; background: #ffc35a; color: #3a1608;
  font: 800 1.05rem/1 'Tutorial Grandstander','Grandstander',system-ui; box-shadow: 0 4px 0 #b3651f, 0 10px 24px rgba(0,0,0,.3); cursor: pointer; }
#farm-overlay:not(.shop-open) .farm-shop { display: none; }
#farm-overlay.harvesting .farm-shop-toggle { opacity: .45; pointer-events: none; }
#farm-overlay.shop-open .farm-shop-toggle { background: rgba(42,19,13,.86); color: #fbeedd; box-shadow: none; border: 1px solid rgba(255,214,170,.3); }
#farm-overlay .farm-shop { width: min(980px,100%); display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; pointer-events: auto; }
#farm-overlay .farm-item { display: grid; grid-template-columns: 58px 1fr; gap: 10px; align-items: center; padding: 9px 10px; border-radius: 14px;
  background: rgba(42,19,13,.86); border: 1px solid rgba(255,214,170,.22); backdrop-filter: blur(6px); }
#farm-overlay .farm-item canvas { width: 58px; height: 46px; }
#farm-overlay .farm-item strong { display: block; font-size: .98rem; }
#farm-overlay .farm-item small { display: block; color: #dcbfa3; font-size: .78rem; line-height: 1.3; margin: 2px 0 6px; }
#farm-overlay .farm-buy { border: 0; border-radius: 999px; padding: 7px 14px; background: #ffc35a; color: #3a1608; font: 800 .9rem/1 system-ui;
  box-shadow: 0 3px 0 #b3651f; cursor: pointer; }
#farm-overlay .farm-buy:disabled { opacity: .4; cursor: default; box-shadow: none; }
#farm-overlay .farm-loading[hidden] { display: none; }
#farm-overlay .farm-loading { position: absolute; inset: 0; display: grid; place-items: center; color: #dcbfa3; pointer-events: none; }
@media (max-width: 760px) {
  #farm-overlay .farm-shop { grid-template-columns: repeat(3, minmax(150px, 1fr)); overflow-x: auto; }
  #farm-overlay .farm-item { grid-template-columns: 1fr; text-align: center; justify-items: center; }
  #farm-overlay .farm-item small { display: none; }
  #farm-overlay h1 { font-size: 1.4rem; }
}
`;

function ensureStyle() {
  if (document.getElementById('farm-style')) return;
  const style = document.createElement('style');
  style.id = 'farm-style';
  style.textContent = STYLE;
  document.head.appendChild(style);
}

// Item da loja desenhado num canvas proprio (vira textura com relevo na cena).
function itemImage(itemId) {
  const c = document.createElement('canvas');
  c.width = 420; c.height = 330;
  getFarmItem(itemId).draw(c.getContext('2d'), 210, 318, 2.1);
  return c;
}

export function createFarmView({ onClose = () => {} } = {}) {
  let root = null, glCanvas = null, marks = null, mctx = null, scene = null;
  let frame = null, farm = null, hover = -1, last = 0, time = 0;
  // colheita em andamento: { t, coins, startCoins, score, nextPop }
  let run = null;
  const pops = [];
  const images = new Map();

  function message(text) { root.querySelector('.farm-msg').textContent = text || ''; }

  // Lavoura: cresce com a nota da colheita que espera o trator; depois de
  // colhida (ou antes da primeira fase) fica so a terra (-1).
  function plantState() {
    const score = run ? run.score : null;
    if (!Number.isFinite(score)) return -1;
    return fieldLevelFromScore(score);
  }

  function startHarvest() {
    const pending = pendingHarvests(farm);
    if (!pending.length) return false;
    run = { t: 0, coins: pendingCoins(farm), startCoins: farm.coins, score: pending.at(-1).score, nextPop: 0 };
    root.classList.add('harvesting');
    message('A colheitadeira está saindo para colher o feijão…');
    return true;
  }

  function finishHarvest() {
    if (!run) return;
    const { coins } = collectHarvests(farm);
    saveFarm(farm);
    run = null;
    root.classList.remove('harvesting');
    renderShop();
    message(`Colheita vendida: +${coins} moedas!`);
  }

  function updateHarvest(dt) {
    if (!run) return;
    run.t += dt;
    const pose = harvestPose(run.t);
    const k = pose.phase === 'pass' ? pose.progress : pose.phase === 'enter' ? 0 : 1;
    root.querySelector('.farm-coins-value').textContent = run.startCoins + Math.round(run.coins * k);
    if (pose.phase === 'pass') {
      if (run.t >= run.nextPop) {
        run.nextPop = run.t + .4;
        const p = scene.sceneToScreen(pose.pos[0] + 70, pose.pos[1] - HARVEST_PATH.height * .8, depthAt(pose.pos[1]));
        pops.push({ x: p.x, y: p.y, vy: -42, life: 1.3, value: Math.max(1, Math.round(run.coins / 16)) });
      }
      if (run.t > HARVEST_PATH.enterSeconds + .4 && !run.said) { run.said = true; message('Colhendo o feijão…'); }
    }
    if (pose.phase === 'done') finishHarvest();
  }

  // giroflex, poeira e moedas subindo (por cima da cena)
  function drawHarvestFx(dt) {
    for (const pop of pops) { pop.life -= dt; pop.y += pop.vy * dt; }
    for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);
    if (run) {
      const pose = harvestPose(run.t);
      const h = HARVEST_PATH.height;
      const top = scene.sceneToScreen(pose.pos[0] + h * 1.84 * .02, pose.pos[1] - h * .98, depthAt(pose.pos[1]));
      const blink = .5 + .5 * Math.sin(time * 10);
      const g = mctx.createRadialGradient(top.x, top.y, 0, top.x, top.y, 26 * top.scale * 2);
      g.addColorStop(0, `rgba(255,190,60,${.55 * blink})`); g.addColorStop(1, 'rgba(255,160,40,0)');
      mctx.fillStyle = g; mctx.beginPath(); mctx.arc(top.x, top.y, 52 * top.scale, 0, Math.PI * 2); mctx.fill();
    }
    for (const pop of pops) {
      const a = Math.min(1, pop.life * 1.5);
      mctx.globalAlpha = a;
      mctx.fillStyle = '#f2b63c'; mctx.strokeStyle = '#b97a17'; mctx.lineWidth = 2;
      mctx.beginPath(); mctx.arc(pop.x, pop.y, 9, 0, Math.PI * 2); mctx.fill(); mctx.stroke();
      mctx.fillStyle = '#fff6d0'; mctx.font = '800 15px system-ui'; mctx.textAlign = 'left';
      mctx.strokeStyle = 'rgba(60,30,5,.7)'; mctx.lineWidth = 3;
      mctx.strokeText(`+${pop.value}`, pop.x + 13, pop.y + 5); mctx.fillText(`+${pop.value}`, pop.x + 13, pop.y + 5);
      mctx.globalAlpha = 1;
    }
  }

  function placedItems() {
    if (!farm) return [];
    return farm.slots.map((itemId, slot) => {
      if (!itemId) return null;
      if (!images.has(itemId)) images.set(itemId, itemImage(itemId));
      return { slot, key: itemId, image: images.get(itemId) };
    }).filter(Boolean);
  }

  // marcas dos espacos (vazios pulsam quando ha item para colocar)
  function drawMarks() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = marks.clientWidth, ch = marks.clientHeight;
    if (marks.width !== Math.round(cw * dpr)) { marks.width = Math.round(cw * dpr); marks.height = Math.round(ch * dpr); }
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, cw, ch);
    const placing = farm.inventory.length > 0;
    FARM_SLOTS.forEach((slot, index) => {
      const p = scene.sceneToScreen(slot.x, slot.y, depthAt(slot.y));
      const r = 88 * slot.s * p.scale;
      if (farm.slots[index]) {
        if (hover === index && !placing) {
          mctx.font = '700 13px system-ui'; mctx.textAlign = 'center';
          mctx.fillStyle = 'rgba(30,14,8,.7)';
          mctx.fillRect(p.x - 92, p.y + 8, 184, 22);
          mctx.fillStyle = '#fff4e2';
          mctx.fillText('toque para mudar de lugar', p.x, p.y + 24);
        }
        return;
      }
      const pulse = placing ? .6 + .4 * Math.sin(time * 5) : .45;
      mctx.save();
      mctx.setLineDash([7, 6]); mctx.lineWidth = 2.5;
      mctx.strokeStyle = placing ? `rgba(255,214,110,${pulse})` : 'rgba(255,255,255,.55)';
      mctx.fillStyle = placing ? 'rgba(255,214,110,.18)' : 'rgba(255,255,255,.1)';
      mctx.beginPath(); mctx.ellipse(p.x, p.y - 4, r, r * .28, 0, 0, Math.PI * 2); mctx.fill(); mctx.stroke();
      mctx.setLineDash([]);
      mctx.fillStyle = placing ? '#ffd36f' : 'rgba(255,255,255,.85)';
      mctx.font = `800 ${Math.round(Math.max(16, 26 * slot.s * p.scale / .6))}px system-ui`; mctx.textAlign = 'center';
      mctx.fillText('+', p.x, p.y + 4);
      mctx.restore();
    });
  }

  function slotAt(px, py) {
    return FARM_SLOTS.findIndex(slot => {
      const p = scene.sceneToScreen(slot.x, slot.y, depthAt(slot.y));
      const r = 95 * slot.s * p.scale;
      return Math.abs(px - p.x) < r && py < p.y + 24 * p.scale && py > p.y - 230 * slot.s * p.scale;
    });
  }

  function loop(now) {
    frame = null;
    if (!root || root.hidden) return;
    const dt = last ? Math.min(.05, (now - last) / 1000) : 0;
    last = now; time += dt;
    // a colheita so anda depois que a cena carregou
    if (scene) {
      if (scene.ready) updateHarvest(dt);
      scene.render(dt);
      drawMarks();
      drawHarvestFx(dt);
    }
    frame = requestAnimationFrame(loop);
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

  // A lojinha abre por cima da parte de baixo da cena; fechada, a fazenda
  // fica inteira a vista (e os espacos da frente ficam livres para tocar).
  function setShop(open) {
    root.classList.toggle('shop-open', open);
    const toggle = root.querySelector('.farm-shop-toggle');
    toggle.textContent = open ? 'Fechar lojinha' : 'Lojinha';
    toggle.setAttribute('aria-expanded', String(open));
  }

  function ensureDom() {
    if (root) return;
    ensureStyle();
    root = document.createElement('div');
    root.id = 'farm-overlay';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Fazendinha');
    root.innerHTML = `
      <div class="farm-stage">
        <canvas class="farm-gl" aria-label="Cena da fazendinha"></canvas>
        <canvas class="farm-marks" aria-hidden="true"></canvas>
        <div class="farm-loading">Preparando a fazendinha…</div>
      </div>
      <div class="farm-top">
        <h1>Fazendinha</h1>
        <span class="farm-coins" aria-label="Moedas"><span class="farm-coin"></span><span class="farm-coins-value">0</span></span>
        <button type="button" class="farm-back">Voltar</button>
      </div>
      <div class="farm-bottom">
        <p class="farm-msg" aria-live="polite"></p>
        <button type="button" class="farm-shop-toggle" aria-expanded="false">Lojinha</button>
        <div class="farm-shop">${FARM_ITEMS.map(item => `
          <div class="farm-item" data-item="${item.id}">
            <canvas width="116" height="92" aria-hidden="true"></canvas>
            <div><strong>${item.name}</strong><small>${item.blurb}</small>
              <button type="button" class="farm-buy"><span class="farm-coin"></span> ${item.price}</button></div>
          </div>`).join('')}</div>
      </div>`;
    document.body.appendChild(root);
    glCanvas = root.querySelector('.farm-gl');
    marks = root.querySelector('.farm-marks');
    mctx = marks.getContext('2d');
    scene = createFarmScene(glCanvas, { items: placedItems, plantState, harvest: () => run });
    if (!scene) root.querySelector('.farm-loading').textContent = 'Este navegador não tem WebGL.';
    else scene.loading.then(() => { root.querySelector('.farm-loading').hidden = true; })
      .catch(() => { root.querySelector('.farm-loading').textContent = 'Não foi possível carregar a fazendinha.'; });
    for (const card of root.querySelectorAll('.farm-item')) {
      const item = getFarmItem(card.dataset.item);
      const c = card.querySelector('canvas').getContext('2d');
      item.draw(c, 58, 88, item.id === 'fence' ? .62 : .58);
      card.querySelector('.farm-buy').addEventListener('click', () => {
        const result = buyItem(farm, item.id);
        if (!result.ok) {
          message(result.reason === 'coins' ? 'Moedas insuficientes: conclua mais uma fase para colher mais.' : 'Não há espaço livre na fazendinha.');
          return;
        }
        persist();
        setShop(false);
        message(`${item.name} comprado! Toque num espaço livre para colocar.`);
      });
    }
    root.querySelector('.farm-shop-toggle').addEventListener('click', () => setShop(!root.classList.contains('shop-open')));
    root.querySelector('.farm-back').addEventListener('click', close);

    // paralaxe pelo mouse; no toque, arrastar desliza a cena
    let drag = null;
    marks.addEventListener('pointermove', event => {
      const rect = marks.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      if (event.pointerType === 'mouse') scene?.setPointer((x / rect.width) * 2 - 1, (y / rect.height) * 2 - 1);
      if (drag) { scene?.panBy(x - drag.x); drag.moved += Math.abs(x - drag.x); drag.x = x; }
      hover = scene ? slotAt(x, y) : -1;
    });
    marks.addEventListener('pointerleave', () => { hover = -1; scene?.releasePointer(); });
    marks.addEventListener('pointerdown', event => {
      const rect = marks.getBoundingClientRect();
      if (event.pointerType !== 'mouse') drag = { x: event.clientX - rect.left, moved: 0 };
    });
    marks.addEventListener('pointerup', () => { setTimeout(() => { drag = null; }, 0); });
    marks.addEventListener('click', event => {
      if (!scene || run || (drag && drag.moved > 8)) return;
      const rect = marks.getBoundingClientRect();
      const index = slotAt(event.clientX - rect.left, event.clientY - rect.top);
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
    pops.length = 0;
    setShop(false);
    renderShop();
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    message(farm.inventory.length ? 'Toque num espaço livre para colocar o item.'
      : touch ? 'Arraste para ver a fazenda toda.'
      : farm.coins ? 'Use as moedas da colheita na lojinha.' : 'Conclua fases para colher moedas.');
    if (!frame) frame = requestAnimationFrame(loop);
    root.querySelector('.farm-back').focus();
    startHarvest();
  }

  function close() {
    if (!root || root.hidden) return;
    // saiu no meio: a colheita termina na hora (as moedas nao se perdem)
    finishHarvest();
    root.hidden = true;
    if (frame) cancelAnimationFrame(frame);
    frame = null;
    onClose();
  }

  return {
    open,
    close,
    get isOpen() { return Boolean(root && !root.hidden); },
    // para testes: adianta a colheita em andamento
    advanceHarvest(seconds) { if (run) run.t += seconds; },
    get slotCount() { return FARM_SLOT_COUNT; },
  };
}
