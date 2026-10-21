// FAZENDINHA: uma tela frontal ilustrada em camadas (farm-scene.js), com a
// lojinha embaixo. Casas, arvores e objetos sao itens comprados com as moedas
// da colheita e postos nos lugares da cena (farm-layout.js): cada lugar aceita
// um tipo de item e o item escala pela perspectiva do lugar.

import { FARM_ITEMS, FARM_TABS, getFarmItem } from './farm-items.js';
import {
  buyItem, canBuy, canPlace, collectHarvests, loadFarm, pendingCoins, pendingHarvests, pickUpItem, placeItem, saveFarm,
} from './farm-state.js';
import { fieldLevelFromScore } from './bean-field.js';
import { FARM_SLOTS, FARM_SLOT_COUNT, itemSceneRect, perspectiveAt } from './farm-layout.js';
import { createFarmScene, depthAt, HARVEST_PATH, harvestPose } from './farm-scene.js';

const ART = './assets/farm/';

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
#farm-overlay .farm-shop { width: min(1040px,100%); pointer-events: auto; border-radius: 16px; padding: 10px; background: rgba(42,19,13,.9);
  border: 1px solid rgba(255,214,170,.22); backdrop-filter: blur(6px); }
#farm-overlay .farm-tabs { display: flex; gap: 6px; margin-bottom: 8px; overflow-x: auto; }
#farm-overlay .farm-tab { border: 1px solid rgba(255,214,170,.28); background: transparent; color: #fbeedd; border-radius: 999px; padding: 7px 14px;
  font: 700 .92rem/1 inherit; cursor: pointer; white-space: nowrap; }
#farm-overlay .farm-tab[aria-selected="true"] { background: #ffc35a; color: #3a1608; border-color: #ffc35a; }
#farm-overlay .farm-tab small { opacity: .75; font-weight: 600; }
#farm-overlay .farm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 8px; max-height: min(44vh, 360px);
  overflow-y: auto; padding-right: 4px; }
#farm-overlay .farm-item { display: grid; grid-template-rows: 72px auto auto; justify-items: center; gap: 4px; padding: 8px 6px; border-radius: 12px;
  background: rgba(255,240,220,.06); border: 1px solid rgba(255,214,170,.14); text-align: center; }
#farm-overlay .farm-item img { width: 100%; height: 72px; object-fit: contain; }
#farm-overlay .farm-item strong { font-size: .84rem; line-height: 1.15; }
#farm-overlay .farm-buy { border: 0; border-radius: 999px; padding: 6px 12px; background: #ffc35a; color: #3a1608; font: 800 .86rem/1 system-ui;
  box-shadow: 0 3px 0 #b3651f; cursor: pointer; }
#farm-overlay .farm-buy:disabled { opacity: .4; cursor: default; box-shadow: none; }
#farm-overlay .farm-hand { pointer-events: auto; display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 14px;
  background: rgba(42,19,13,.86); border: 1px solid rgba(255,214,170,.22); max-width: 100%; overflow-x: auto; }
#farm-overlay .farm-hand[hidden] { display: none; }
#farm-overlay .farm-hand span { font-weight: 700; font-size: .85rem; color: #dcbfa3; padding: 0 4px; white-space: nowrap; }
#farm-overlay .farm-hand button { flex: none; width: 58px; height: 50px; border-radius: 10px; border: 2px solid transparent; background: rgba(255,240,220,.08);
  padding: 3px; cursor: pointer; }
#farm-overlay .farm-hand button[aria-pressed="true"] { border-color: #ffc35a; background: rgba(255,195,90,.22); }
#farm-overlay .farm-hand img { width: 100%; height: 100%; object-fit: contain; }
#farm-overlay .farm-loading[hidden] { display: none; }
#farm-overlay .farm-loading { position: absolute; inset: 0; display: grid; place-items: center; color: #dcbfa3; pointer-events: none; }
@media (max-width: 760px) {
  #farm-overlay .farm-grid { grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); max-height: 38vh; }
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

export function createFarmView({ onClose = () => {} } = {}) {
  let root = null, glCanvas = null, marks = null, mctx = null, scene = null;
  let frame = null, farm = null, hover = null, last = 0, time = 0;
  // item da mao que vai ser colocado (id) e aba aberta na lojinha
  let selected = null, tab = FARM_TABS[0].kind;
  // colheita em andamento: { t, coins, startCoins, score, nextPop }
  let run = null;
  const pops = [];

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
    return farm.slots.map((itemId, slot) => (itemId ? { slot, item: getFarmItem(itemId) } : null)).filter(Boolean);
  }

  // retangulo do item colocado, em px da tela
  function screenRect(index) {
    const item = getFarmItem(farm.slots[index]);
    const slot = FARM_SLOTS[index];
    const [x, y, w, h] = itemSceneRect(slot, item);
    const depth = depthAt(slot.y);
    const a = scene.sceneToScreen(x, y, depth), b = scene.sceneToScreen(x + w, y + h, depth);
    return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
  }

  // lugares livres que aceitam o item da mao
  function targets() {
    if (!selected) return [];
    return FARM_SLOTS.map((_, i) => i).filter(i => canPlace(farm, i, selected));
  }

  function markRadius(slot, p) {
    return Math.max(16, 110 * perspectiveAt(slot.y) * p.scale);
  }

  // marcas: com item na mao, os lugares que servem pulsam; sem item, o toque
  // num item colocado o devolve para a mao (mudar de lugar)
  function drawMarks() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = marks.clientWidth, ch = marks.clientHeight;
    if (marks.width !== Math.round(cw * dpr)) { marks.width = Math.round(cw * dpr); marks.height = Math.round(ch * dpr); }
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, cw, ch);
    const pulse = .6 + .4 * Math.sin(time * 5);
    for (const index of targets()) {
      const slot = FARM_SLOTS[index];
      const p = scene.sceneToScreen(slot.x, slot.y, depthAt(slot.y));
      const r = markRadius(slot, p);
      const on = hover && hover.type === 'slot' && hover.index === index;
      mctx.save();
      mctx.setLineDash([7, 6]); mctx.lineWidth = 2.5;
      mctx.strokeStyle = `rgba(255,214,110,${on ? 1 : pulse})`;
      mctx.fillStyle = on ? 'rgba(255,214,110,.34)' : 'rgba(255,214,110,.18)';
      mctx.beginPath(); mctx.ellipse(p.x, p.y - 2, r, r * .28, 0, 0, Math.PI * 2); mctx.fill(); mctx.stroke();
      mctx.setLineDash([]);
      mctx.fillStyle = '#ffd36f';
      mctx.font = `800 ${Math.round(Math.max(15, r * .45))}px system-ui`; mctx.textAlign = 'center';
      mctx.fillText('+', p.x, p.y + 5);
      mctx.restore();
    }
    if (hover && hover.type === 'item' && !run) {
      const r = screenRect(hover.index);
      mctx.save();
      mctx.strokeStyle = 'rgba(255,240,200,.75)'; mctx.lineWidth = 2; mctx.setLineDash([6, 5]);
      mctx.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      mctx.setLineDash([]);
      const label = `${getFarmItem(farm.slots[hover.index]).name}: toque para mudar de lugar`;
      mctx.font = '700 13px system-ui'; mctx.textAlign = 'center';
      const w = mctx.measureText(label).width + 16, cx = (r.x0 + r.x1) / 2;
      mctx.fillStyle = 'rgba(30,14,8,.75)'; mctx.fillRect(cx - w / 2, r.y1 + 6, w, 22);
      mctx.fillStyle = '#fff4e2'; mctx.fillText(label, cx, r.y1 + 22);
      mctx.restore();
    }
  }

  // o que esta sob o ponteiro: um lugar marcado (com item na mao) ou um item
  function pick(px, py) {
    if (!scene) return null;
    for (const index of targets()) {
      const slot = FARM_SLOTS[index];
      const p = scene.sceneToScreen(slot.x, slot.y, depthAt(slot.y));
      const r = markRadius(slot, p) * 1.15;
      if (((px - p.x) / r) ** 2 + ((py - p.y) / (r * .6)) ** 2 <= 1) return { type: 'slot', index };
    }
    // itens: o mais da frente primeiro
    const placed = farm.slots.map((id, i) => (id ? i : -1)).filter(i => i >= 0).sort((a, b) => FARM_SLOTS[b].y - FARM_SLOTS[a].y);
    for (const index of placed) {
      const r = screenRect(index);
      if (px >= r.x0 && px <= r.x1 && py >= r.y0 && py <= r.y1) return { type: 'item', index };
    }
    return null;
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

  function shopCards() {
    return FARM_ITEMS.filter(item => item.kind === tab).map(item => `
      <div class="farm-item" data-item="${item.id}">
        <img src="${ART}${item.src}" alt="" loading="lazy" decoding="async">
        <strong>${item.name}</strong>
        <button type="button" class="farm-buy"><span class="farm-coin"></span> ${item.price}</button>
      </div>`).join('');
  }

  function renderTabs() {
    const free = kind => FARM_SLOTS.filter((slot, i) => slot.kind === kind && !farm.slots[i]).length;
    root.querySelector('.farm-tabs').innerHTML = FARM_TABS.map(t => `
      <button type="button" class="farm-tab" role="tab" data-kind="${t.kind}" aria-selected="${t.kind === tab}">
        ${t.label} <small>${free(t.kind)} lugares</small></button>`).join('');
  }

  function renderHand() {
    const hand = root.querySelector('.farm-hand');
    hand.hidden = !farm.inventory.length;
    if (selected && !farm.inventory.includes(selected)) selected = null;
    if (!selected && farm.inventory.length) selected = farm.inventory[0];
    hand.innerHTML = `<span>Para colocar:</span>${farm.inventory.map(id => {
      const item = getFarmItem(id);
      return `<button type="button" data-item="${id}" title="${item.name}" aria-pressed="${id === selected}"><img src="${ART}${item.src}" alt="${item.name}"></button>`;
    }).join('')}`;
  }

  function renderShop() {
    root.querySelector('.farm-coins-value').textContent = farm.coins;
    renderTabs();
    renderHand();
    for (const card of root.querySelectorAll('.farm-item')) {
      const check = canBuy(farm, card.dataset.item);
      const button = card.querySelector('.farm-buy');
      button.disabled = !check.ok;
      button.title = check.reason === 'coins' ? 'Moedas insuficientes'
        : check.reason === 'no-space' ? 'Sem lugar livre para este tipo' : 'Comprar';
    }
  }

  function showTab(kind) {
    tab = kind;
    root.querySelector('.farm-grid').innerHTML = shopCards();
    root.querySelector('.farm-grid').scrollTop = 0;
    renderShop();
  }

  function persist() { saveFarm(farm); renderShop(); }

  // A lojinha abre por cima da parte de baixo da cena; fechada, a fazenda
  // fica inteira a vista (e os lugares da frente ficam livres para tocar).
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
        <div class="farm-hand" hidden></div>
        <button type="button" class="farm-shop-toggle" aria-expanded="false">Lojinha</button>
        <div class="farm-shop">
          <div class="farm-tabs" role="tablist"></div>
          <div class="farm-grid"></div>
        </div>
      </div>`;
    document.body.appendChild(root);
    glCanvas = root.querySelector('.farm-gl');
    marks = root.querySelector('.farm-marks');
    mctx = marks.getContext('2d');
    scene = createFarmScene(glCanvas, { items: placedItems, plantState, harvest: () => run });
    if (!scene) root.querySelector('.farm-loading').textContent = 'Este navegador não tem WebGL.';
    else scene.loading.then(() => { root.querySelector('.farm-loading').hidden = true; })
      .catch(() => { root.querySelector('.farm-loading').textContent = 'Não foi possível carregar a fazendinha.'; });

    root.querySelector('.farm-tabs').addEventListener('click', event => {
      const button = event.target.closest('.farm-tab');
      if (button) showTab(button.dataset.kind);
    });
    root.querySelector('.farm-grid').addEventListener('click', event => {
      const button = event.target.closest('.farm-buy');
      if (!button) return;
      const item = getFarmItem(button.closest('.farm-item').dataset.item);
      const result = buyItem(farm, item.id);
      if (!result.ok) {
        message(result.reason === 'coins' ? 'Moedas insuficientes: conclua mais uma fase para colher mais.' : 'Não há lugar livre para este tipo de item.');
        return;
      }
      selected = item.id;
      persist();
      setShop(false);
      message(`${item.name} comprado! Toque num lugar marcado para colocar.`);
    });
    root.querySelector('.farm-hand').addEventListener('click', event => {
      const button = event.target.closest('button[data-item]');
      if (!button) return;
      selected = button.dataset.item;
      renderHand();
      message(targets().length ? `${getFarmItem(selected).name}: toque num lugar marcado.` : 'Não há lugar livre para este item: tire outro do lugar.');
    });
    root.querySelector('.farm-shop-toggle').addEventListener('click', () => setShop(!root.classList.contains('shop-open')));
    root.querySelector('.farm-back').addEventListener('click', close);

    // paralaxe pelo mouse; no toque, arrastar desliza a cena
    let drag = null;
    marks.addEventListener('pointermove', event => {
      const rect = marks.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      if (event.pointerType === 'mouse') scene?.setPointer((x / rect.width) * 2 - 1, (y / rect.height) * 2 - 1);
      if (drag) { scene?.panBy(x - drag.x); drag.moved += Math.abs(x - drag.x); drag.x = x; }
      hover = event.pointerType === 'mouse' ? pick(x, y) : null;
      marks.style.cursor = hover ? 'pointer' : 'default';
    });
    marks.addEventListener('pointerleave', () => { hover = null; scene?.releasePointer(); });
    marks.addEventListener('pointerdown', event => {
      const rect = marks.getBoundingClientRect();
      if (event.pointerType !== 'mouse') drag = { x: event.clientX - rect.left, moved: 0 };
    });
    marks.addEventListener('pointerup', () => { setTimeout(() => { drag = null; }, 0); });
    marks.addEventListener('click', event => {
      if (!scene || run || (drag && drag.moved > 8)) return;
      const rect = marks.getBoundingClientRect();
      const hit = pick(event.clientX - rect.left, event.clientY - rect.top);
      if (!hit) return;
      if (hit.type === 'slot') {
        const name = getFarmItem(selected).name;
        placeItem(farm, hit.index, selected);
        selected = null;
        hover = null;
        persist();
        message(farm.inventory.length ? `${name} no lugar. Ainda há itens para colocar.` : `${name} no lugar.`);
      } else {
        const name = getFarmItem(farm.slots[hit.index]).name;
        pickUpItem(farm, hit.index);
        selected = farm.inventory[0];
        hover = null;
        persist();
        message(`${name} na mão: toque num lugar marcado.`);
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
    hover = null; last = 0;
    pops.length = 0;
    selected = farm.inventory[0] || null;
    setShop(false);
    showTab(tab);
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    message(farm.inventory.length ? 'Toque num lugar marcado para colocar o item.'
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
