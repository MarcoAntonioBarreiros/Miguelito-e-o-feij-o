import { drawPhosphateCrystalCluster } from '../../src/render/phosphate-crystals.js';
import { createDefaultPhaseLabConfig, PHASE_LAB_STORAGE_KEY } from '../../src/procgen/phase-lab-config.js';

const $ = id => document.getElementById(id);
const frame = $('game'), status = $('status');
const originalLabConfig = localStorage.getItem(PHASE_LAB_STORAGE_KEY);
function restoreLabConfig() {
  if (originalLabConfig === null) localStorage.removeItem(PHASE_LAB_STORAGE_KEY);
  else localStorage.setItem(PHASE_LAB_STORAGE_KEY, originalLabConfig);
}
const phaseNames = ['Biofilme', 'Fixação de nitrogênio', 'Azospirillum', 'Micorrizas', 'Proteção biológica', 'Sideróforos', 'Fosfato', 'Nematoides', 'Ralstonia', 'Integração'];
phaseNames.forEach((name, i) => $('phase').add(new Option(`${i + 1} · ${name}`, i + 1)));
$('phase').value = '7';
let generation = 1, game, paused = true, focusIndex = -1;
let specimens = [];

function regenerate() {
  specimens = Array.from({ length: 6 }, (_, i) => ({
    id: `mineral-${generation}-${i}`, visualSeed: `crystal-study-${generation}-${i}`,
    x: 0, y: 0, w: i === 5 ? 145 : 58, h: 210,
    visualWidth: i === 5 ? 145 : 95.7,
    initialPhosphate: 1, remainingPhosphate: Number($('stock').value) / 100,
    broken: $('stock').value === '0',
  }));
  $('specimens').replaceChildren(...specimens.map((deposit, i) => {
    const card = document.createElement('div'); card.className = 'specimen';
    const canvas = document.createElement('canvas'); canvas.width = 440; canvas.height = 620;
    const label = document.createElement('span'); label.textContent = i === 5 ? 'ESTUDO LARGO · 145 × 210' : `FORMAÇÃO ${generation}.${i + 1} · 58 × 210`;
    card.append(canvas, label); deposit.canvas = canvas; return card;
  }));
  if (game) game.miguelitoSim.state.level.phosphateDeposits.forEach((d, i) => { d.visualSeed = `crystal-study-${generation}-${i}`; });
}

function paint(now) {
  for (const d of specimens) {
    const ctx = d.canvas.getContext('2d'); const cw = d.canvas.width;
    ctx.clearRect(0, 0, cw, 620);
    ctx.save(); ctx.translate((cw - d.visualWidth * 2.34) / 2 + (d.visualWidth - d.w) * 2.34, 572); ctx.scale(2.34, 2.34);
    const contact = ctx.createRadialGradient(d.w / 2, 0, 0, d.w / 2, 0, d.w * .75);
    contact.addColorStop(0, '#05171b'); contact.addColorStop(1, 'rgba(5,23,27,0)');
    ctx.save(); ctx.scale(1, .18); ctx.fillStyle = contact; ctx.fillRect(-d.w, -d.w, d.w * 3, d.w * 2); ctx.restore();
    ctx.translate(0, -d.h); drawPhosphateCrystalCluster(ctx, d, now / 1000); ctx.restore();
  }
  requestAnimationFrame(paint);
}

function settleTutorial() {
  const st = game.miguelitoSim.state;
  for (const entry of st.level.phaseProfile?.presentations || []) game.miguelitoTutorial?.markSeen?.(entry.cardId);
  game.miguelitoTutorial?.close?.();
  st.introFall = null;
}

function focusCrystal(next = true) {
  const st = game.miguelitoSim.state;
  const deposits = (st.level.phosphateDeposits || []).filter(d => !d.broken);
  if (!deposits.length) { status.textContent = `Fase ${st.campaign.phase} · nenhum depósito de fosfato nesta fase`; return; }
  if (next) focusIndex = (focusIndex + 1) % deposits.length;
  const d = deposits[Math.max(0, focusIndex) % deposits.length];
  const baseY = d.y + d.h;
  const ground = (d.hostPlatformId != null && st.level.platforms.find(p => (p.platformId || p.id) === d.hostPlatformId && Math.abs(p.y - baseY) < 2))
    || st.level.platforms.find(p => Math.abs(p.y - d.y - d.h) < 2 && p.x <= d.x && p.x + p.w >= d.x);
  Object.assign(st.player, { x: Math.max(ground?.x ?? -Infinity, d.x - 74), y: baseY - st.player.h, vx: 0, vy: 0, onGround: true, facing: 1, alive: true, invuln: 0, dashTime: 0, jetpackActive: false, supportPlatform: ground || null });
  settleTutorial();
  st.gameState = 'play'; paused = true; $('play').textContent = 'Jogar a partir daqui';
  game.miguelitoCamera.setZoom(1.8);
  st.cameraX = st.player.x - (st.visibleWorldWidth || 700) * .43;
  st.cameraY = st.player.y - (st.visibleWorldHeight || 450) * .66;
  status.textContent = `Fase ${st.campaign.phase} · depósito ${Math.max(0, focusIndex) + 1}/${deposits.length} · cena pausada`;
  $('focus').textContent = deposits.length > 1 ? 'Próximo depósito' : 'Ir aos cristais';
}

function applyPhase() {
  const phase = Number($('phase').value);
  const config = createDefaultPhaseLabConfig(phase);
  config.seed = 'crystal-preview-7';
  game.miguelitoPhaseLab.applyConfig(config);
  restoreLabConfig();
  game.document.querySelector('.phase-lab')?.setAttribute('hidden', '');
  focusIndex = -1;
  for (const d of game.miguelitoSim.state.level.phosphateDeposits || []) d.visualSeed = `crystal-study-${generation}-0`;
  if (game.miguelitoSim.state.level.phosphateDeposits?.length) focusCrystal();
  else { settleTutorial(); game.miguelitoSim.state.gameState = 'play'; paused = false; $('play').textContent = 'Pausar cena'; status.textContent = `Fase ${phase} · jogo livre`; }
  $('stock').value = '100'; $('stock-value').value = '100%'; specimens.forEach(d => { d.remainingPhosphate = 1; d.broken = false; });
}

frame.addEventListener('load', async () => {
  game = frame.contentWindow;
  try {
    const deadline = performance.now() + 45000;
    while (!game.miguelitoPhaseLab || !game.miguelito25D) {
      if (performance.now() > deadline) throw Error('O jogo não terminou de carregar. Recarregue a página.');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const style = game.document.createElement('style');
    style.textContent = '#debug,#phase-card,.phase-lab-toggle,#toast,#title-screen{display:none!important}'; game.document.head.append(style);
    const sim = game.miguelitoSim, originalStep = sim.step;
    // Inspection freezes physics only. The real camera, dust, lighting and
    // crystal reflections keep advancing, including the game's zoom buttons.
    sim.step = dt => { if (paused) { sim.state.time += dt; sim.setInputs({}); } else originalStep.call(sim, dt); };
    for (const id of ['focus', 'mode', 'play']) $(id).disabled = false;
    applyPhase(); restoreLabConfig();
    if (!game.document.getElementById('debug')?.classList.contains('hidden')) {
      game.dispatchEvent(new game.KeyboardEvent('keydown', { code: 'Tab', key: 'Tab', bubbles: true }));
      game.dispatchEvent(new game.KeyboardEvent('keyup', { code: 'Tab', key: 'Tab', bubbles: true }));
    }
  } catch (e) { status.textContent = e.message; restoreLabConfig(); }
});
$('phase').addEventListener('change', applyPhase);
$('focus').addEventListener('click', () => focusCrystal());
$('play').addEventListener('click', () => {
  settleTutorial(); paused = !paused;
  game.miguelitoSim.state.gameState = 'play';
  $('play').textContent = paused ? 'Jogar a partir daqui' : 'Pausar cena';
  status.textContent = `Fase ${$('phase').value} · ${paused ? 'cena pausada' : 'jogo livre'}`;
  if (!paused) frame.focus();
});
$('mode').addEventListener('click', () => { const active = game.miguelito25DMode(); game.miguelito25DMode(!active); $('mode').textContent = active ? 'Comparar em WebGL' : 'Comparar em 2D'; });
$('fullscreen').addEventListener('click', () => frame.parentElement.requestFullscreen());
$('stock').addEventListener('input', () => {
  const ratio = Number($('stock').value) / 100;
  $('stock-value').value = `${$('stock').value}%`;
  specimens.forEach(d => { d.remainingPhosphate = ratio; d.broken = ratio === 0; });
  if (game) {
    game.miguelitoSim.state.gameState = 'play'; paused = true; $('play').textContent = 'Jogar a partir daqui';
    for (const d of game.miguelitoSim.state.level.phosphateDeposits || []) { d.remainingPhosphate = d.initialPhosphate * ratio; d.broken = ratio === 0; }
  }
});
$('regenerate').addEventListener('click', () => { generation++; regenerate(); });
window.addEventListener('pagehide', restoreLabConfig);
regenerate(); requestAnimationFrame(paint);
// Dedicated localhost preview. Campaign saves are not read or overwritten.
const bootConfig = createDefaultPhaseLabConfig(7); bootConfig.seed = 'crystal-preview-7';
localStorage.setItem(PHASE_LAB_STORAGE_KEY, JSON.stringify(bootConfig));
frame.src = '../../dist/index.html?render=25d&phaseLab=1';
