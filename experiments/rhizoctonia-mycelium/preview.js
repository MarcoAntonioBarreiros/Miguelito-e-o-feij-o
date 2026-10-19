import { createDefaultPhaseLabConfig, PHASE_LAB_STORAGE_KEY } from '../../src/procgen/phase-lab-config.js';

const $ = id => document.getElementById(id);
const frame = $('game');
const originalLabConfig = localStorage.getItem(PHASE_LAB_STORAGE_KEY);
let game = null, ready = false, applying = false;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const state = () => game?.miguelitoSim?.state;
const percent = value => Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';
const focalEnemy = () => (state()?.level.enemies || []).find(enemy => enemy.debut && enemy.logicIndex === 1)
  || (state()?.level.enemies || []).filter(enemy => enemy.type === 'rhizoctonia').sort((a, b) => (a.logicIndex || 0) - (b.logicIndex || 0))[0];

function restoreLabConfig() {
  if (originalLabConfig === null) localStorage.removeItem(PHASE_LAB_STORAGE_KEY);
  else localStorage.setItem(PHASE_LAB_STORAGE_KEY, originalLabConfig);
}
function configuration() {
  const config = createDefaultPhaseLabConfig(6);
  config.seed = $('seed').value.trim() || 'rhizoctonia-organic-6';
  return config;
}
function closeCard() {
  if (!game.miguelitoTutorial?.isOpen) return;
  for (const type of ['keydown', 'keyup']) game.dispatchEvent(new game.KeyboardEvent(type, { code: 'Escape', key: 'Escape', bubbles: true }));
}
function warp(x, y, platform) {
  const st = state();
  game.miguelitoSim.setInputs({});
  for (const code of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyE', 'ShiftLeft']) {
    game.dispatchEvent(new game.KeyboardEvent('keyup', { key: code, code, bubbles: true }));
  }
  Object.assign(st.player, { x: x - st.player.w / 2, y: y - st.player.h, vx: 0, vy: 0,
    onGround: Boolean(platform), supportPlatform: platform || null, facing: 1, dashTime: 0, jetpackActive: false });
  game.miguelitoCamera?.setZoom?.(1.5);
  st.cameraX = st.player.x - (st.visibleWorldWidth || 850) * .35;
  st.cameraY = st.player.y - (st.visibleWorldHeight || 480) * .60;
}
function nearestPlatform(x, y) {
  return (state().level.platforms || []).filter(p => !p.recovery && !p.final && !p.collapsed)
    .sort((a, b) => Math.hypot(a.x + a.w / 2 - x, a.y - y) - Math.hypot(b.x + b.w / 2 - x, b.y - y))[0];
}
function goExudate() {
  const target = (state().level.exudates || []).filter(item => !item.taken)
    .sort((a, b) => Number(b.id === 'p6-trichoderma-recruitment-exudate') - Number(a.id === 'p6-trichoderma-recruitment-exudate') || (a.logicIndex || 0) - (b.logicIndex || 0))[0];
  if (!target) { $('status').textContent = 'Nenhum exsudato disponível; espere a reposição normal ou reinicie.'; return; }
  const p = nearestPlatform(target.x, target.y);
  warp(Math.max(p.x + state().player.w / 2 + 8, Math.min(p.x + p.w - 24, target.x - 38)), p.y, p);
  $('status').textContent = 'Caminhe até a gota para coletá-la; o atalho não concede exsudato.';
  frame.focus();
}
function goOrganism(type) {
  const target = game.miguelitoSim.ecology.agents.filter(a => a.type === type && !a.hyphalAttack && Math.max(a.recruitedUntil || 0, a.beneficialRecruitedUntil || 0) <= state().time)
    .sort((a, b) => (a.logicIndex || 0) - (b.logicIndex || 0))[0];
  if (!target) { $('status').textContent = `${type}: não há agente livre nesta partida. Confira os seguidores no seletor.`; return; }
  const p = nearestPlatform(target.x, target.y);
  warp(Math.max(p.x + 24, Math.min(p.x + p.w - 24, target.x - 30)), p.y, p);
  $('status').textContent = `Selecione exsudato com ↓ e use E perto de ${type}. Espere o recrutamento antes de ir ao foco.`;
  frame.focus();
}
function goRoot() {
  const enemy = focalEnemy();
  const p = enemy?.hostPlatform || (state().level.platforms || []).find(p => p.type === 'root' && p.logicIndex === 1 && !p.recovery && !p.final);
  if (!p) return;
  // Observe from the preceding real platform, outside the attack footprint.
  // Trichoderma can reach the focus from there using its ordinary detection range.
  const focusX = enemy?.infectionX || p.x + p.w / 2;
  const observation = (state().level.platforms || []).filter(root => root !== p && !root.recovery && !root.final && !root.collapsed && root.x + root.w < p.x && root.x + root.w > p.x - 450)
    .sort((a, b) => b.x + b.w - a.x - a.w)[0] || p;
  const x = observation === p ? p.x + 24 : observation.x + observation.w - 25;
  warp(x, observation.y, observation);
  state().player.facing = x < focusX ? 1 : -1;
  $('status').textContent = 'Observe o foco da plataforma vizinha. Inocule Trichoderma com E quando estiver selecionado; a detecção e o combate usam as regras normais.';
  frame.focus();
}
async function restart() {
  if (!ready || applying) return;
  applying = true;
  try {
    game.miguelitoPhaseLab.applyConfig(configuration());
    restoreLabConfig(); closeCard();
    if (state().introFall?.stage === 'title') game.document.getElementById('title-play')?.click();
    if (state().introFall?.stage === 'surface') {
      warp(state().level.introBurrowX, state().introFall.surface, null);
      const deadline = performance.now() + 4000;
      while (state().introFall?.stage === 'surface' && performance.now() < deadline) await delay(40);
    }
    goRoot(); renderDiagnostics();
  } catch (error) { $('status').textContent = error.message; }
  finally { restoreLabConfig(); applying = false; }
}
function renderDiagnostics() {
  if (!ready) return;
  const st = state(), sim = game.miguelitoSim, enemy = focalEnemy();
  const host = enemy?.hostPlatform;
  const visual = enemy ? sim.rhizoctoniaControl?.visualSnapshot?.(enemy) : null;
  $('progress').textContent = `Fase ${st.campaign.phase} · tempo ${st.time.toFixed(1)}s · exsudatos ${st.player.exudates || 0} · Trichoderma seguindo ${sim.trichodermaColonies.followerCount} · colônias ${sim.trichodermaColonies.colonies.length}`;
  $('colonies').replaceChildren();
  const rows = enemy ? [
    `${enemy.alive ? 'Foco ativo' : 'Foco controlado'} · colonização ${percent(enemy.colonization)} · dano da raiz ${percent(host?.rootDamage)} · saúde ${percent(host?.rootHealth)}`,
    `Bacillus ${percent(enemy.bacillusControl)} · limitação de ferro ${percent(enemy.ironLimitation)} · contato Trichoderma ${percent(enemy.trichodermaContact || 0)} · lise ${percent(enemy.trichodermaLysis || 0)} · supressão ${percent(enemy.trichodermaSuppression || 0)}`,
    ...(visual ? [`Rede persistente · ${visual.branches} ramificações · ${visual.activeTips} pontas ativas · extensão restante ${Math.round(visual.remainingLength)} px`] : []),
    ...sim.trichodermaColonies.colonies.map(c => `Trichoderma · ${c.stage} · crescimento ${percent(c.growth)} · vigor ${percent(c.vigor)}`),
  ] : ['O foco ainda não foi encontrado.'];
  for (const text of rows) { const card = document.createElement('article'); card.className = 'colony'; card.textContent = text; $('colonies').append(card); }
  $('mode').textContent = game.miguelito25DMode?.() ? 'Comparar em 2D' : 'Comparar em WebGL';
}
frame.addEventListener('load', async () => {
  game = frame.contentWindow;
  try {
    const deadline = performance.now() + 60000;
    while (!game.miguelitoPhaseLab || !game.miguelitoSim?.trichodermaColonies || !game.miguelito25DMode) {
      if (performance.now() > deadline) throw Error('O jogo não terminou de carregar. Execute npm run build e recarregue.');
      await delay(100);
    }
    const style = game.document.createElement('style'); style.textContent = '.phase-lab,.phase-lab-toggle,#phase-card{display:none!important}'; game.document.head.append(style);
    if (!game.document.getElementById('debug')?.classList.contains('hidden')) for (const type of ['keydown', 'keyup']) game.dispatchEvent(new game.KeyboardEvent(type, { code: 'Tab', key: 'Tab', bubbles: true }));
    ready = true;
    for (const id of ['restart', 'mode', 'exudate', 'trichoderma', 'bacillus', 'pseudomonas', 'root']) $(id).disabled = false;
    await restart(); setInterval(renderDiagnostics, 250);
  } catch (error) { $('status').textContent = error.message; }
  finally { restoreLabConfig(); }
});
$('configuration').addEventListener('submit', event => { event.preventDefault(); restart(); });
$('exudate').addEventListener('click', goExudate);
for (const type of ['trichoderma', 'bacillus', 'pseudomonas']) $(type).addEventListener('click', () => goOrganism(type));
$('root').addEventListener('click', goRoot);
$('mode').addEventListener('click', () => { game.miguelito25DMode(!game.miguelito25DMode()); frame.focus(); });
$('fullscreen').addEventListener('click', () => frame.parentElement.requestFullscreen());
window.addEventListener('pagehide', restoreLabConfig);
localStorage.setItem(PHASE_LAB_STORAGE_KEY, JSON.stringify(configuration()));
frame.src = new URL('dist/index.html?render=25d&phaseLab=1', document.baseURI).href;
