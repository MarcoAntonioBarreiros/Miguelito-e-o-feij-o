import { createDefaultPhaseLabConfig, PHASE_LAB_STORAGE_KEY } from '../../src/procgen/phase-lab-config.js';

const $ = id => document.getElementById(id);
const frame = $('game');
const originalLabConfig = localStorage.getItem(PHASE_LAB_STORAGE_KEY);
let game = null;
let ready = false;
let applying = false;
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const state = () => game?.miguelitoSim?.state;
const root = () => (state()?.level.platforms || []).find(platform => platform.objectiveTarget === 'p1-intro-root');
const entries = () => game?.miguelitoSim?.bacillusBioprotection?.entries || [];

function restoreLabConfig() {
  if (originalLabConfig === null) localStorage.removeItem(PHASE_LAB_STORAGE_KEY);
  else localStorage.setItem(PHASE_LAB_STORAGE_KEY, originalLabConfig);
}
function configuration() {
  const config = createDefaultPhaseLabConfig(1);
  config.seed = $('seed').value.trim() || 'bacillus-surface-film-1';
  return config;
}
function clearInputs() {
  game.miguelitoSim.setInputs({});
  for (const code of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyE', 'ShiftLeft']) {
    game.dispatchEvent(new game.KeyboardEvent('keyup', { key: code, code, bubbles: true }));
  }
}
function closeCard() {
  if (!game.miguelitoTutorial?.isOpen) return;
  for (const type of ['keydown', 'keyup']) game.dispatchEvent(new game.KeyboardEvent(type, { code: 'Escape', key: 'Escape', bubbles: true }));
}
function warp(x, y, platform = null) {
  const st = state();
  clearInputs();
  Object.assign(st.player, {
    x: x - st.player.w / 2, y: y - st.player.h,
    vx: 0, vy: 0, onGround: Boolean(platform), supportPlatform: platform,
    facing: 1, dashTime: 0, jetpackActive: false,
  });
  game.miguelitoCamera?.setZoom?.(1.5);
  st.cameraX = st.player.x - (st.visibleWorldWidth || 850) * .35;
  st.cameraY = st.player.y - (st.visibleWorldHeight || 480) * .60;
}
async function enterRhizosphere() {
  // Use the real title action and tunnel transition. Only player position is
  // changed: no intro state, resource, biology or objective is assigned here.
  if (state().introFall?.stage === 'title') game.document.getElementById('title-play')?.click();
  if (state().introFall?.stage === 'surface') {
    warp(state().level.introBurrowX, state().introFall.surface);
    const deadline = performance.now() + 4000;
    while (state().introFall?.stage === 'surface' && performance.now() < deadline) await delay(40);
  }
}
function nearestSafePlatform(x, y) {
  return (state().level.platforms || []).filter(platform => !platform.recovery && !platform.final && !platform.collapsed)
    .sort((a, b) => Math.hypot(a.x + a.w / 2 - x, a.y - y) - Math.hypot(b.x + b.w / 2 - x, b.y - y))[0];
}
function goExudate() {
  const target = (state().level.exudates || []).filter(item => !item.taken && item.authored)
    .sort((a, b) => a.logicIndex - b.logicIndex)[0];
  if (!target) { $('status').textContent = 'Os exsudatos introdutórios já foram coletados. Reinicie para uma formação nova.'; return; }
  const platform = nearestSafePlatform(target.x, target.y);
  // A few steps before the pickup, rather than awarding it from the shortcut.
  const x = Math.max(platform.x + state().player.w / 2 + 8, target.x - 38);
  warp(x, platform.y, platform);
  $('status').textContent = 'Caminhe até a gota para coletar exsudato; os estoques continuam sendo os da partida.';
  frame.focus();
}
function goBacillus() {
  const agent = game.miguelitoSim.ecology.agents.filter(agent => agent.type === 'bacillus' && !(agent.beneficialRecruitedUntil > state().time))
    .sort((a, b) => (a.logicIndex ?? 0) - (b.logicIndex ?? 0))[0];
  if (!agent) { $('status').textContent = 'Bacillus já pode estar recrutado. Confira o seletor e vá à raiz marcada.'; return; }
  const platform = nearestSafePlatform(agent.x, agent.y);
  warp(Math.max(platform.x + 24, Math.min(platform.x + platform.w - 24, agent.x - 30)), platform.y, platform);
  $('status').textContent = 'Selecione exsudato com ↓, pressione E perto de Bacillus e espere o recrutamento.';
  frame.focus();
}
function goRoot() {
  const target = root();
  if (!target) return;
  warp(target.x + target.w * .35, target.y, target);
  $('status').textContent = 'Raiz marcada · selecione Bacillus com ↓ e inocule com E. O crescimento usa a simulação normal.';
  frame.focus();
}
async function restart() {
  if (!ready || applying) return;
  applying = true;
  try {
    game.miguelitoPhaseLab.applyConfig(configuration());
    restoreLabConfig();
    closeCard();
    await enterRhizosphere();
    goExudate();
    renderDiagnostics();
  } catch (error) { $('status').textContent = error.message; }
  finally { restoreLabConfig(); applying = false; }
}
const percent = value => Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';
function stage(entry) {
  if (entry.mode === 'spores') return 'Endósporos dormentes';
  if (entry.mode === 'sporulating') return 'Esporulação';
  if (entry.mode === 'germinating') return 'Germinação';
  return entry.maturity < .2 ? 'Adesão' : entry.maturity < .42 ? 'Microcolônia' : entry.maturity < .72 ? 'Expansão' : 'Maturação';
}
function renderDiagnostics() {
  if (!ready) return;
  const st = state(); const all = entries();
  const target = root();
  const functional = (st.level.biofilms || []).filter(film => film.functional && film.platform === target).length;
  const block = st.level.fixedBlocks?.find(block => block.targetPlatform === target);
  $('progress').textContent = `Fase ${st.campaign.phase} · tempo ${st.time.toFixed(1)}s · exsudatos ${st.player.exudates || 0} · seguidores ${game.miguelitoSim.beneficialInoculants.followerCount} · biofilmes funcionais na raiz marcada ${functional} · objetivo ${block?.completed ? 'concluído' : 'pendente'}`;
  $('colonies').replaceChildren(...all.map(entry => {
    const card = document.createElement('article'); card.className = 'colony';
    card.textContent = `${stage(entry)} · maturidade ${percent(entry.maturity)} · estabelecimento ${percent(entry.colony.growth)} · vigor ${percent(entry.colony.vigor)} · ${entry.film.functional ? 'funcional' : 'ainda não funcional'}${entry.colony.platform === target ? ' · raiz marcada' : ''}`;
    return card;
  }));
  $('mode').textContent = game.miguelito25DMode?.() ? 'Comparar em 2D' : 'Comparar em WebGL';
}

frame.addEventListener('load', async () => {
  game = frame.contentWindow;
  try {
    const deadline = performance.now() + 60000;
    while (!game.miguelitoPhaseLab || !game.miguelitoSim?.bacillusBioprotection || !game.miguelito25DMode) {
      if (performance.now() > deadline) throw Error('O jogo não terminou de carregar. Execute npm run build e recarregue.');
      await delay(100);
    }
    const style = game.document.createElement('style');
    style.textContent = '.phase-lab,.phase-lab-toggle,#phase-card{display:none!important}';
    game.document.head.append(style);
    if (!game.document.getElementById('debug')?.classList.contains('hidden')) {
      for (const type of ['keydown', 'keyup']) game.dispatchEvent(new game.KeyboardEvent(type, { code: 'Tab', key: 'Tab', bubbles: true }));
    }
    ready = true;
    for (const id of ['restart', 'mode', 'exudate', 'bacillus', 'root']) $(id).disabled = false;
    await restart();
    setInterval(renderDiagnostics, 250);
  } catch (error) { $('status').textContent = error.message; }
  finally { restoreLabConfig(); }
});
$('configuration').addEventListener('submit', event => { event.preventDefault(); restart(); });
$('exudate').addEventListener('click', goExudate);
$('bacillus').addEventListener('click', goBacillus);
$('root').addEventListener('click', goRoot);
$('mode').addEventListener('click', () => { game.miguelito25DMode(!game.miguelito25DMode()); frame.focus(); });
$('fullscreen').addEventListener('click', () => frame.parentElement.requestFullscreen());
window.addEventListener('pagehide', restoreLabConfig);

// Phase Lab disables campaign persistence. Its preferences are restored after
// every restart, including an existing preference on this isolated test port.
localStorage.setItem(PHASE_LAB_STORAGE_KEY, JSON.stringify(configuration()));
frame.src = new URL('dist/index.html?render=25d&phaseLab=1', document.baseURI).href;
