import { createDefaultPhaseLabConfig, PHASE_LAB_STORAGE_KEY } from '../../src/procgen/phase-lab-config.js';

const $ = id => document.getElementById(id);
const frame = $('game');
const originalLabConfig = localStorage.getItem(PHASE_LAB_STORAGE_KEY);
const phases = ['Biofilme', 'Fixação de nitrogênio', 'Azospirillum', 'Micorrizas', 'Proteção biológica', 'Sideróforos', 'Fosfato', 'Nematoides', 'Ralstonia', 'Integração'];
for (const [index, name] of phases.entries()) $('phase').add(new Option(`${index + 1} · ${name}`, index + 1));
$('phase').value = '9';
let game = null;
let ready = false;

function restoreLabConfig() {
  if (originalLabConfig === null) localStorage.removeItem(PHASE_LAB_STORAGE_KEY);
  else localStorage.setItem(PHASE_LAB_STORAGE_KEY, originalLabConfig);
}

function configForSelection() {
  const config = createDefaultPhaseLabConfig(Number($('phase').value));
  config.seed = $('seed').value.trim() || 'ralstonia-preview-9';
  return config;
}

function state() { return game?.miguelitoSim?.state; }
function runtime() { return game?.miguelitoSim?.ralstoniaControl; }
function encounterRoot(role) {
  return state()?.level?.ralstoniaTeachingEncounters?.[role]?.root
    || runtime()?.foci?.find(focus => focus.role === role)?.root
    || null;
}
function ordinaryPlatforms() {
  return (state()?.level?.platforms || []).filter(platform => (
    Number.isFinite(platform.x) && Number.isFinite(platform.y)
    && platform.w > 35 && !platform.recovery && !platform.mycorrhizaStructure
    && !platform.azospirillumStructure && !platform.azospirillumLadderStep
    && !platform.nitrogenRootCollider && !platform.nitrogenRootStructure
    && !platform.temporary && platform.routeScope !== 'optional'
    && !platform.collapsed && !(platform.collisionDisabledUntil > state().time)
  ));
}
function resourceOnPlatform(item, platform) {
  const host = item.hostPlatformId ?? item.platformId;
  const platformId = platform.platformId ?? platform.id;
  if (host != null && platformId != null && host === platformId) return true;
  return item.x >= platform.x && item.x <= platform.x + platform.w
    && Math.abs((item.y ?? platform.y) - platform.y) < 180;
}
function approachPlatform(root) {
  const st = state();
  const lesson = Object.values(st.level.ralstoniaTeachingEncounters || {}).find(entry => entry.root === root);
  const plannedResources = [...(lesson?.resources?.encounters || []), ...(lesson?.resources?.exudates || [])];
  const plannedHosts = plannedResources.map(item => item?.platform).filter(platform => (
    platform && platform !== root && platform.x < root.x && ordinaryPlatforms().includes(platform)
  )).sort((a, b) => b.x - a.x);
  if (plannedHosts.length) return plannedHosts[0];
  const candidates = ordinaryPlatforms().filter(platform => platform !== root && platform.x < root.x)
    .sort((a, b) => b.x - a.x);
  // Prefer the immediate approach, retaining nearby natural recruits/carbon.
  // Never move, award, collect or regenerate a resource from this page.
  const nearby = candidates.filter(platform => root.x - (platform.x + platform.w) < 1100);
  const withResources = nearby.find(platform => (
    (st.level.microbeEncounters || []).some(item => resourceOnPlatform(item, platform)
      && ['bacillus', 'pseudomonas', 'azospirillum'].includes(item.id || item.type))
    || (st.level.exudates || []).some(item => !item.taken && resourceOnPlatform(item, platform))
  ));
  return withResources || candidates[0] || root;
}
function clearInputs() {
  game.miguelitoSim.setInputs({});
  for (const code of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyE', 'ShiftLeft']) {
    game.dispatchEvent(new game.KeyboardEvent('keyup', { key: code, code, bubbles: true }));
  }
}
function dismissOpening() {
  const st = state();
  for (const entry of st.level.phaseProfile?.presentations || []) game.miguelitoTutorial?.markSeen?.(entry.cardId);
  if (game.miguelitoTutorial?.isOpen) {
    game.dispatchEvent(new game.KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
    game.dispatchEvent(new game.KeyboardEvent('keyup', { code: 'Escape', key: 'Escape', bubbles: true }));
  }
  st.introFall = null;
  st.gameState = 'play';
  const pause = game.document.getElementById('pause-menu');
  if (pause && !pause.hidden) pause.querySelector('[data-pause-action="resume"]')?.click();
}
function moveTo(platform, desiredX, message, { focus = true } = {}) {
  const st = state();
  if (!platform) throw Error('Nenhuma plataforma segura encontrada para este atalho.');
  if (st.player.alive === false || st.respawnTimer > 0) {
    $('status').textContent = 'Aguarde Miguelito renascer antes de usar um atalho.';
    return;
  }
  clearInputs();
  dismissOpening();
  const x = Math.max(platform.x + 8, Math.min(platform.x + platform.w - st.player.w - 8, desiredX));
  Object.assign(st.player, {
    x, y: platform.y - st.player.h, vx: 0, vy: 0, onGround: true,
    facing: 1, supportPlatform: platform, dashTime: 0, jetpackActive: false,
  });
  game.miguelitoCamera?.setZoom?.(1.5);
  st.cameraX = x - (st.visibleWorldWidth || 850) * .35;
  st.cameraY = st.player.y - (st.visibleWorldHeight || 480) * .61;
  $('status').textContent = message;
  if (focus) frame.focus();
}
function goToEncounter(role, options) {
  const root = encounterRoot(role);
  if (!root) {
    $('status').textContent = `Fase ${state().campaign.phase} · encontro de ${role === 'prevention' ? 'prevenção' : 'contenção'} indisponível nesta seed.`;
    return;
  }
  const platform = approachPlatform(root);
  moveTo(platform, platform.x + Math.min(platform.w * .35, 110),
    role === 'prevention'
      ? 'Aproximação da prevenção · colete e recrute antes de chegar à raiz exposta.'
      : 'Aproximação da contenção · a infecção já está no xilema; mantenha o controle e alimente as colônias.', options);
}
function goToGoal() {
  const st = state();
  const goal = st.level.goal;
  if (!goal) return;
  // Stay outside the goal trigger: the player must walk to the cortex, and
  // the unchanged objective guard decides whether the phase can complete.
  const targetX = goal.x - (goal.radius || 85) - st.player.w - 65;
  const platforms = ordinaryPlatforms();
  const platform = platforms.find(p => targetX >= p.x && targetX + st.player.w <= p.x + p.w)
    || platforms.filter(p => p.x + p.w < goal.x).sort((a, b) => b.x - a.x)[0];
  moveTo(platform, Math.min(targetX, platform?.x + platform?.w - st.player.w - 8),
    'Raiz final · caminhe até o córtex para verificar os objetivos. Nenhum requisito foi preenchido pelo atalho.');
}
function applyPhase() {
  if (!ready) return;
  try {
    game.miguelitoPhaseLab.applyConfig(configForSelection());
    restoreLabConfig();
    dismissOpening();
    if (encounterRoot('prevention')) goToEncounter('prevention', { focus: false });
    else {
      const platform = ordinaryPlatforms().sort((a, b) => a.x - b.x)[0];
      moveTo(platform, platform.x + 50, `Fase ${state().campaign.phase} · jogo livre`, { focus: false });
    }
    renderDiagnostics();
  } catch (error) {
    $('status').textContent = error.message;
  } finally { restoreLabConfig(); }
}

const percent = value => Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';
const number = value => Number.isFinite(value) ? value.toFixed(2) : '—';
function focusDiagnostic(role) {
  const control = runtime();
  const root = encounterRoot(role);
  const focus = control?.foci?.find(entry => entry.root === root);
  if (!root) return null;
  const card = document.createElement('article'); card.className = 'focus-card';
  const heading = document.createElement('h3');
  const snapshot = focus ? control.rootSnapshot(root) : null;
  heading.textContent = `${role === 'prevention' ? 'Prevenção' : 'Contenção'} · trecho ${root.logicIndex ?? '?'} · ${snapshot?.reading || focus?.state || 'aguardando chegada ambiental'}`;
  card.append(heading);
  const colonies = (game.miguelitoSim.beneficialInoculants?.colonies || []).filter(colony => colony.platform === root);
  const entries = [...(game.miguelitoSim.pseudomonasSiderophores?.colonyStates?.values?.() || [])]
    .filter(entry => entry.colony?.platform === root);
  const add = (text, className = '') => { const p = document.createElement('p'); p.textContent = text; p.className = className; card.append(p); };
  add(`Saúde ${percent(root.rootHealth ?? 1)} · carbono disponível ${percent(root.carbonAvailability)} · colônias ${colonies.length}`);
  if (focus) add(`Superfície ${percent(focus.surfaceLoad)} · xilema ${percent(focus.vascularLoad)} · ferimento ${percent(focus.woundOpening)} · ${focus.activationState}`);
  const colonyText = colonies.map(colony => `${colony.type}: vigor ${percent(colony.vigor)}${colony.dormant ? ' (dormente)' : ''}`).join(' · ');
  add(colonyText || 'Sem colônias nesta raiz. Recrute com exsudato e inocule com E.');
  if (entries.length) add(`Reserva de ferro local: ${entries.map(entry => number(entry.ironReserve)).join(' / ')}`);
  const advice = [];
  if (snapshot?.supportHint) advice.push(snapshot.supportHint);
  if (colonies.some(colony => colony.dormant || colony.vigor < .45)) advice.push('Vigor baixo: emita um novo pulso de exsudato perto das colônias.');
  else if (colonies.length) advice.push('Acompanhe o vigor: o controle precisa de carbono ao longo do tempo.');
  if (colonies.some(colony => colony.type === 'pseudomonas') && (!entries.length || entries.every(entry => (entry.ironReserve || 0) < .1))) advice.push('Pseudomonas ainda precisa capturar ferro dos depósitos locais.');
  if ((state().player.exudates ?? 0) <= 0) advice.push('Sem exsudato no inventário: colete os recursos disponíveis ou renováveis.');
  if (focus?.contained || focus?.neutralized) advice.push('Controle obtido. Os marcos permanecem; uma recaída pode reabrir os requisitos de segurança.');
  if (advice.length) add(advice.join(' '), 'advice');
  return card;
}
function renderDiagnostics() {
  if (!ready) return;
  const st = state(); const control = runtime();
  $('prevention').disabled = !encounterRoot('prevention');
  $('containment').disabled = !encounterRoot('containment');
  $('goal').disabled = !st.level.goal;
  const unresolved = control?.unresolvedSpreadCount;
  $('progress').textContent = `Prevenções ${control?.preventedCount ?? 0}/1 · contenções ${control?.containedCount ?? 0}/1 · disseminações no histórico ${control?.successfulSpreadCount ?? 0} · pendentes agora ${unresolved ?? '—'} · focos críticos ${control?.criticalCount ?? 0} · tempo ${Math.floor(st.time)}s`;
  const cards = ['prevention', 'containment'].map(focusDiagnostic).filter(Boolean);
  if (!cards.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'Os encontros de Ralstonia são apresentados na fase 9. Esta fase segue as suas próprias condições.'; cards.push(p); }
  $('foci').replaceChildren(...cards);
  $('mode').textContent = game.miguelito25DMode?.() ? 'Comparar em 2D' : 'Comparar em WebGL';
}

frame.addEventListener('load', async () => {
  game = frame.contentWindow;
  try {
    const deadline = performance.now() + 60000;
    while (!game.miguelitoPhaseLab || !game.miguelitoSim?.ralstoniaControl || !game.miguelito25DMode) {
      if (performance.now() > deadline) throw Error('O jogo não terminou de carregar. Execute o build e recarregue a prévia.');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const style = game.document.createElement('style');
    style.textContent = '.phase-lab,.phase-lab-toggle,#phase-card,#title-screen{display:none!important}';
    game.document.head.append(style);
    if (!game.document.getElementById('debug')?.classList.contains('hidden')) {
      game.dispatchEvent(new game.KeyboardEvent('keydown', { code: 'Tab', key: 'Tab', bubbles: true }));
      game.dispatchEvent(new game.KeyboardEvent('keyup', { code: 'Tab', key: 'Tab', bubbles: true }));
    }
    ready = true;
    for (const id of ['restart', 'mode']) $(id).disabled = false;
    applyPhase();
    setInterval(renderDiagnostics, 350);
  } catch (error) { $('status').textContent = error.message; }
  finally { restoreLabConfig(); }
});
$('configuration').addEventListener('submit', event => { event.preventDefault(); applyPhase(); });
$('phase').addEventListener('change', applyPhase);
$('prevention').addEventListener('click', () => goToEncounter('prevention'));
$('containment').addEventListener('click', () => goToEncounter('containment'));
$('goal').addEventListener('click', goToGoal);
$('mode').addEventListener('click', () => { game.miguelito25DMode(!game.miguelito25DMode()); frame.focus(); });
$('fullscreen').addEventListener('click', () => frame.parentElement.requestFullscreen());
window.addEventListener('pagehide', restoreLabConfig);

// This port has an isolated origin. Restore any pre-existing lab preference
// immediately after boot/config changes; ordinary campaign saves are unused.
localStorage.setItem(PHASE_LAB_STORAGE_KEY, JSON.stringify(configForSelection()));
frame.src = '../../dist/index.html?render=25d&phaseLab=1';
