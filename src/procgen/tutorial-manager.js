import { tutorialDisplayPages, isTutorialGamePage } from './tutorial-card-pages.js';
import { createTutorialMicroscope } from './tutorial-microscope.js';
import { getTutorialCard, tutorialCardIds, tutorialCards } from './tutorial-registry.js';
import { tutorialPacing } from './campaign-manifest.js';
import { createTutorialFlow } from './tutorial-flow.js';
import { getCardsTaughtBeforePhase } from './tutorial-prior-knowledge.js';
import {
  createAutomaticTutorialSafetyGate,
  createPendingTutorialQueue,
  platformHasActiveTutorialCollision,
  stabilizePlayerForAutomaticTutorial,
} from './tutorial-presentation.js';

export const TUTORIAL_STORAGE_KEYS = Object.freeze({
  seen: 'miguelito:tutorial:seen:v3',
  unlocked: 'miguelito:tutorial:unlocked:v3',
  pages: 'miguelito:tutorial:pages:v3',
});

const LEGACY_STORAGE_KEYS = Object.freeze([
  'miguelito:tutorial:seen:v1',
  'miguelito:tutorial:unlocked:v1',
  'miguelito:tutorial:seen:v2',
  'miguelito:tutorial:unlocked:v2',
  TUTORIAL_STORAGE_KEYS.seen,
  TUTORIAL_STORAGE_KEYS.unlocked,
  TUTORIAL_STORAGE_KEYS.pages,
]);

export function isHardReloadShortcut(event) {
  const commandKey = Boolean(event.ctrlKey || event.metaKey);
  return (event.code === 'F5' && commandKey)
    || (event.code === 'KeyR' && commandKey && event.shiftKey);
}

export function isTutorialAdvanceShortcut(event) {
  return event.code === 'Enter' && !event.repeat;
}

function isReloadShortcut(event) {
  return event.code === 'F5'
    || (event.code === 'KeyR' && Boolean(event.ctrlKey || event.metaKey));
}

function readStoredSet(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch (_) {
    return new Set();
  }
}

function readStoredPages(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (_) {
    return {};
  }
}

function writeStoredSet(key, set) {
  try {
    sessionStorage.setItem(key, JSON.stringify([...set]));
  } catch (_) {
    // O jogo continua funcionando mesmo quando o navegador bloqueia armazenamento da sessão.
  }
}

function removeStoredSet(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (_) {
    // O reset visual continua disponível mesmo sem acesso ao armazenamento local.
  }
}

function removeLegacyLocalProgress() {
  try {
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
  } catch (_) {
    // Versões anteriores podem permanecer quando o navegador bloqueia o armazenamento.
  }
}

function removeStoredTutorialProgress() {
  for (const key of LEGACY_STORAGE_KEYS) removeStoredSet(key);
}

function setText(element, value) {
  if (element) element.textContent = value || '';
}

export function createTutorialManager({ state }) {
  const mount = document.getElementById('tutorial-root');
  if (!mount) throw new Error('Elemento #tutorial-root não encontrado.');

  mount.innerHTML = `
    <style>
      /* Relativas ao documento tanto no desenvolvimento quanto no build inline. */
      @font-face { font-family: 'Tutorial Atkinson'; font-style: normal; font-weight: 400; font-display: swap; src: url('./assets/ui/tutorial/fonts/atkinson-regular.ttf') format('truetype'); }
      @font-face { font-family: 'Tutorial Atkinson'; font-style: normal; font-weight: 700; font-display: swap; src: url('./assets/ui/tutorial/fonts/atkinson-bold.ttf') format('truetype'); }
      @font-face { font-family: 'Tutorial Grandstander'; font-style: normal; font-weight: 800; font-display: swap; src: url('./assets/ui/tutorial/fonts/grandstander-bold.ttf') format('truetype'); }
    </style>
    <div class="tutorial-overlay" hidden aria-hidden="true">
      <div class="tutorial-backdrop"></div>
      <section class="tutorial-panel" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
        <button class="tutorial-close" type="button" aria-label="Fechar cartão">×</button>
        <div class="tutorial-card-view">
          <canvas class="tutorial-scope" width="440" height="440" aria-hidden="true"></canvas>
          <div class="tutorial-paper-content">
            <header class="tutorial-header">
              <div class="tutorial-heading-meta">
                <span class="tutorial-category"></span>
                <span class="tutorial-new-badge">Novo</span>
              </div>
              <h1 id="tutorial-title" class="tutorial-title"></h1>
              <p class="tutorial-subtitle"></p>
            </header>
            <main class="tutorial-page">
              <div class="tutorial-page-scroll" tabindex="0" role="region" aria-label="Conteúdo do cartão">
                <h2 class="tutorial-page-title"></h2>
                <p class="tutorial-page-body"></p>
                <aside class="tutorial-callout" aria-labelledby="tutorial-callout-title" hidden>
                  <h2 id="tutorial-callout-title" class="tutorial-callout-title"></h2>
                  <p class="tutorial-callout-body"></p>
                  <ul class="tutorial-page-points"></ul>
                </aside>
                <div class="tutorial-cycle-block">
                  <span class="tutorial-cycle-label"></span>
                  <svg class="tutorial-cycle-path" aria-hidden="true"></svg>
                  <ol class="tutorial-cycle"></ol>
                </div>
              </div>
            </main>
            <footer class="tutorial-footer">
              <button class="tutorial-button tutorial-prev" type="button" aria-label="Página anterior">←</button>
              <div class="tutorial-pagination">
                <div class="tutorial-page-dots" aria-label="Páginas do cartão"></div>
                <span class="tutorial-page-counter" aria-live="polite" aria-atomic="true"></span>
              </div>
              <button class="tutorial-button tutorial-next" type="button" aria-label="Próxima página"><span class="tutorial-button-label">Continuar</span></button>
            </footer>
          </div>
        </div>

        <div class="tutorial-library-view" hidden>
          <header class="tutorial-library-header">
            <div>
              <span class="tutorial-category">Biblioteca didática</span>
              <h1 id="tutorial-library-title" class="tutorial-library-title">Descobertas da rizosfera</h1>
              <p class="tutorial-library-description">Reabra os cartões encontrados nesta sessão da campanha.</p>
            </div>
            <div class="tutorial-library-count"></div>
          </header>
          <div class="tutorial-library-grid"></div>
          <p class="tutorial-library-empty" hidden>Nenhum cartão foi descoberto ainda.</p>
          <footer class="tutorial-library-footer">
            <button class="tutorial-button tutorial-reset-seen" type="button">Reiniciar progresso didático</button>
            <button class="tutorial-button tutorial-library-close" type="button">Voltar ao jogo</button>
          </footer>
          <p class="tutorial-library-status" aria-live="polite"></p>
        </div>
      </section>
    </div>
  `;

  const overlay = mount.querySelector('.tutorial-overlay');
  const panel = mount.querySelector('.tutorial-panel');
  const cardView = mount.querySelector('.tutorial-card-view');
  const libraryView = mount.querySelector('.tutorial-library-view');
  const closeButton = mount.querySelector('.tutorial-close');
  const category = mount.querySelector('.tutorial-card-view .tutorial-category');
  const newBadge = mount.querySelector('.tutorial-new-badge');
  const title = mount.querySelector('.tutorial-title');
  const subtitle = mount.querySelector('.tutorial-subtitle');
  const microscope = createTutorialMicroscope(mount.querySelector('.tutorial-scope'));
  const cycleLabel = mount.querySelector('.tutorial-cycle-label');
  const cycle = mount.querySelector('.tutorial-cycle');
  const cycleBlock = mount.querySelector('.tutorial-cycle-block');
  const pageCounter = mount.querySelector('.tutorial-page-counter');
  const pageTitle = mount.querySelector('.tutorial-page-title');
  const pageBody = mount.querySelector('.tutorial-page-body');
  const pagePoints = mount.querySelector('.tutorial-page-points');
  const callout = mount.querySelector('.tutorial-callout');
  const calloutTitle = mount.querySelector('.tutorial-callout-title');
  const calloutBody = mount.querySelector('.tutorial-callout-body');
  const pageDots = mount.querySelector('.tutorial-page-dots');
  const pageScroll = mount.querySelector('.tutorial-page-scroll');
  const previousButton = mount.querySelector('.tutorial-prev');
  const nextButton = mount.querySelector('.tutorial-next');
  const libraryGrid = mount.querySelector('.tutorial-library-grid');
  const libraryEmpty = mount.querySelector('.tutorial-library-empty');
  const libraryCount = mount.querySelector('.tutorial-library-count');
  const libraryClose = mount.querySelector('.tutorial-library-close');
  const resetSeenButton = mount.querySelector('.tutorial-reset-seen');
  const libraryStatus = mount.querySelector('.tutorial-library-status');
  const desktopLibraryButton = document.getElementById('tutorial-library-button');
  const mobileLibraryButton = document.querySelector('[data-mobile-action="tutorial"]');

  removeLegacyLocalProgress();
  const bootstrapSeen = Array.isArray(state.campaign?.tutorialBootstrapSeen)
    ? state.campaign.tutorialBootstrapSeen
    : [];
  const flow = createTutorialFlow({
    seen: [...new Set([
      ...readStoredSet(TUTORIAL_STORAGE_KEYS.seen),
      ...bootstrapSeen,
    ])],
    unlocked: [...readStoredSet(TUTORIAL_STORAGE_KEYS.unlocked)],
    pages: readStoredPages(TUTORIAL_STORAGE_KEYS.pages),
  });
  let activeId = null;
  let pageIndex = 0;
  let mode = 'closed';
  let previousGameState = 'play';
  let returnToLibrary = false;
  let activeFirstSeen = false;
  let activeAutomaticEntry = null;
  let pausedSupport = null;
  let resumeFramesRemaining = 0;
  const heldDuringTutorial = new Set();
  const pendingTutorials = createPendingTutorialQueue();
  const safetyGate = createAutomaticTutorialSafetyGate({ state });

  function persist() {
    const snapshot = flow.snapshot();
    writeStoredSet(TUTORIAL_STORAGE_KEYS.seen, new Set(snapshot.seen));
    writeStoredSet(TUTORIAL_STORAGE_KEYS.unlocked, new Set(snapshot.unlocked));
    try {
      sessionStorage.setItem(TUTORIAL_STORAGE_KEYS.pages, JSON.stringify(snapshot.pages));
    } catch (_) {
      // As páginas continuam válidas na sessão atual mesmo sem persistência.
    }
  }

  function pauseGame() {
    if (mode === 'closed') {
      previousGameState = state.gameState === 'tutorial' ? 'play' : state.gameState;
    }
    state.gameState = 'tutorial';
    document.documentElement.classList.add('tutorial-open');
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    window.dispatchEvent(new CustomEvent('miguelito:tutorial-open', {
      detail: { automatic: Boolean(activeAutomaticEntry) },
    }));
  }

  function resumeGame() {
    if (
      activeAutomaticEntry
      && pausedSupport
      && platformHasActiveTutorialCollision(pausedSupport, state)
    ) {
      stabilizePlayerForAutomaticTutorial(state, pausedSupport);
    } else if (state.player) {
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.dashTime = 0;
      state.player.jumpBuffer = 0;
      state.jumpHeldLast = false;
    }
    microscope.stop();
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('tutorial-open');
    panel.classList.remove('tutorial-panel--card', 'tutorial-panel--library');
    state.gameState = previousGameState === 'tutorial' ? 'play' : previousGameState;
    mode = 'closed';
    activeId = null;
    returnToLibrary = false;
    activeAutomaticEntry = null;
    pausedSupport = null;
    resumeFramesRemaining = 1;
    safetyGate.reset('tutorial-closed');
    window.dispatchEvent(new CustomEvent('miguelito:tutorial-close', {
      detail: { blockedInputCodes: [...heldDuringTutorial] },
    }));
    heldDuringTutorial.clear();
  }

  function renderCycle(card) {
    const steps = card.cycle || [];
    if (cycleBlock) {
      cycleBlock.hidden = steps.length === 0;
    }
    cycle.replaceChildren();
    if (steps.length === 0) return;
    setText(cycleLabel, card.cycleLabel || 'Ciclo ou etapas');
    cycle.classList.toggle('tutorial-cycle--long', steps.length > 5);

    const topCount = steps.length <= 3 ? steps.length : Math.ceil(steps.length / 2);
    const bottomCount = steps.length - topCount;
    const narrow = window.matchMedia('(max-width: 400px)').matches;
    const height = narrow ? Math.ceil(steps.length / 2) * 90 : bottomCount ? 180 : 90;
    cycleBlock.classList.toggle('tutorial-cycle-block--narrow', narrow);
    cycleBlock.style.setProperty('--cycle-height', height + 'px');
    const path = mount.querySelector('.tutorial-cycle-path');
    path.setAttribute('viewBox', '0 0 420 ' + height);
    path.setAttribute('preserveAspectRatio', 'none');
    path.replaceChildren();
    const svgElement = (name, attributes) => {
      const element = document.createElementNS('http://www.w3.org/2000/svg', name);
      for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
      return element;
    };
    const defs = svgElement('defs', {});
    const marker = svgElement('marker', { id: 'tutorial-cycle-arrow', markerWidth: 7, markerHeight: 7,
      refX: 5, refY: 3, orient: 'auto', markerUnits: 'userSpaceOnUse' });
    marker.appendChild(svgElement('path', { d: 'M1 1 L4 3 L1 5', fill: 'none', stroke: '#c99a62', 'stroke-width': 1 }));
    defs.appendChild(marker); path.appendChild(defs);
    const positions = steps.map((_, index) => {
      if (narrow) {
        const band = Math.floor(index / 2);
        const column = band % 2 ? 1 - index % 2 : index % 2;
        return { x: (column + .5) * 210, y: band * 90 + 70, lower: false, count: 2 };
      }
      const lower = index >= topCount;
      const count = lower ? bottomCount : topCount;
      const column = lower ? bottomCount - 1 - (index - topCount) : index;
      return { x: (column + .5) / count * 420, y: lower ? 110 : 70, lower, count };
    });
    for (const [index, step] of steps.entries()) {
      const position = positions[index];
      const row = document.createElement('li');
      row.className = 'tutorial-cycle-step' + (position.lower ? ' tutorial-cycle-step--lower' : '');
      row.style.left = (position.x / 420 * 100) + '%';
      row.style.width = (100 / position.count) + '%';
      if (narrow) row.style.top = (position.y - 70) + 'px';
      row.textContent = step;
      cycle.appendChild(row);
      const next = positions[index + 1];
      if (!next) continue;
      let d;
      if (position.y === next.y) {
        const direction = next.x > position.x ? 1 : -1;
        d = 'M' + (position.x + direction * 10) + ' ' + position.y + ' H' + (next.x - direction * 12);
      } else if (narrow) {
        const right = position.x > 210;
        const edge = right ? 406 : 14;
        const bend = right ? 388 : 32;
        const direction = right ? 1 : -1;
        d = `M${position.x + direction * 10} ${position.y} H${bend} Q${edge} ${position.y} ${edge} ${position.y + 18} V${next.y - 18} Q${edge} ${next.y} ${bend} ${next.y} H${next.x + direction * 12}`;
      } else {
        d = 'M' + (position.x + 10) + ' 70 H388 Q406 70 406 88 V92 Q406 110 388 110 H' + (next.x + 12);
      }
      path.appendChild(svgElement('path', { d, fill: 'none', stroke: 'rgba(201,154,98,.5)',
        'stroke-width': 1, 'marker-end': 'url(#tutorial-cycle-arrow)' }));
    }
  }

  window.matchMedia('(max-width: 400px)').addEventListener('change', () => {
    if (mode === 'card' && displayPages()[pageIndex]?.kind === 'cycle') renderCycle(getTutorialCard(activeId));
  });

  function displayPages() {
    return tutorialDisplayPages(getTutorialCard(activeId), flow.pagesFor(activeId));
  }

  function renderDots(card) {
    pageDots.replaceChildren();
    for (const [index] of displayPages().entries()) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `tutorial-page-dot${index === pageIndex ? ' active' : ''}`;
      dot.setAttribute('aria-label', `Ir para página ${index + 1}`);
      if (index === pageIndex) dot.setAttribute('aria-current', 'page');
      dot.addEventListener('click', () => {
        pageIndex = index;
        renderCard();
      });
      pageDots.appendChild(dot);
    }
  }

  function renderCard() {
    const card = getTutorialCard(activeId);
    if (!card) return;
    const availablePages = displayPages();
    if (!availablePages.length) return;
    pageIndex = Math.min(pageIndex, availablePages.length - 1);
    const currentPage = availablePages[pageIndex];
    const pagePosition = pageIndex;
    cardView.dataset.pageKind = currentPage.kind;
    const gamePage = currentPage.kind !== 'cycle' && isTutorialGamePage(currentPage);
    cardView.dataset.pageTone = gamePage ? 'game' : 'science';
    title.classList.toggle('tutorial-title--scientific', /^organism-(rhizobium|azospirillum|bacillus|pseudomonas|trichoderma|rhizoctonia|ralstonia|meloidogyne)/.test(card.id));

    panel.style.setProperty('--tutorial-accent', card.accent || '#70e5d6');
    setText(category, card.category);
    setText(title, card.title);
    setText(subtitle, pageIndex === 0 || gamePage ? card.subtitle : currentPage.title);
    microscope.show(card.id);
    setText(pageCounter, `${pagePosition + 1} / ${availablePages.length}`);
    setText(pageTitle, currentPage.title);
    pageTitle.hidden = pageIndex > 0 || gamePage || Boolean(currentPage.callout);
    setText(pageBody, currentPage.body);
    if (newBadge) newBadge.hidden = !activeFirstSeen;

    const highlighted = currentPage.callout || (gamePage ? currentPage : null);
    const highlightedPoints = highlighted?.points || currentPage.points || [];
    callout.hidden = !highlighted && !highlightedPoints.length;
    setText(calloutTitle, highlighted?.title || (currentPage.body ? 'Em destaque' : currentPage.title));
    setText(calloutBody, highlighted?.body);
    calloutBody.hidden = !highlighted?.body;
    pagePoints.replaceChildren();
    for (const point of highlightedPoints) {
      const item = document.createElement('li');
      item.textContent = point;
      pagePoints.appendChild(item);
    }
    pagePoints.hidden = !highlightedPoints.length;

    renderCycle(currentPage.kind === 'cycle' ? card : { cycle: [] });
    pageBody.hidden = !currentPage.body || gamePage;
    pageDots.parentElement.hidden = availablePages.length <= 1;
    pageDots.parentElement.classList.toggle('tutorial-pagination--many', availablePages.length > 6);
    previousButton.hidden = availablePages.length <= 1;
    renderDots(card);

    // A pagina nova comeca do comeco. Sem isto a rolagem da pagina anterior
    // vazava: quem tivesse descido ate o fim de uma pagina longa abria a
    // seguinte ja no meio do texto, sem nada acima indicando que havia mais.
    if (pageScroll) pageScroll.scrollTop = 0;

    const finalPage = pagePosition >= availablePages.length - 1;
    const nextActionLabel = finalPage
      ? (returnToLibrary ? 'Voltar à biblioteca' : 'Continuar')
      : 'Próxima página';

    nextButton.setAttribute('aria-label', nextActionLabel);
    nextButton.title = nextActionLabel;
    setText(nextButton.querySelector('.tutorial-button-label'), finalPage ? nextActionLabel : 'Continuar');
    nextButton.dataset.action = finalPage ? 'finish' : 'next';

    previousButton.disabled = pagePosition === 0;
    previousButton.setAttribute('aria-label', 'Página anterior');
    previousButton.title = 'Página anterior';
  }

  function openCard(id, {
    fromLibrary = false,
    firstSeen = !flow.hasSeen(id),
    automaticEntry = null,
    support = null,
  } = {}) {
    const card = getTutorialCard(id);
    if (!card) return false;
    if (!flow.isUnlocked(id)) flow.revealAll(id);
    const availablePages = flow.pagesFor(id);
    if (!availablePages.length) return false;
    if (!automaticEntry) pendingTutorials.removeCard(id);
    persist();
    activeAutomaticEntry = automaticEntry;
    pausedSupport = support;
    pauseGame();
    panel.setAttribute('aria-labelledby', 'tutorial-title');
    panel.classList.add('tutorial-panel--card');
    panel.classList.remove('tutorial-panel--library');
    mode = 'card';
    activeId = id;
    pageIndex = 0;
    returnToLibrary = fromLibrary;
    activeFirstSeen = firstSeen;
    cardView.hidden = false;
    libraryView.hidden = true;
    closeButton.hidden = false;
    renderCard();
    requestAnimationFrame(() => nextButton.focus());
    return true;
  }

  function finishActiveCard() {
    if (activeId) {
      flow.markSeen(activeId);
      persist();
    }
    if (returnToLibrary) {
      openLibrary();
      return;
    }
    resumeGame();
  }

  function nextPage() {
    const card = getTutorialCard(activeId);
    if (!card) return;
    const availablePages = displayPages();
    if (pageIndex < availablePages.length - 1) {
      pageIndex++;
      renderCard();
      return;
    }
    finishActiveCard();
  }

  function previousPage() {
    if (pageIndex <= 0) return;
    pageIndex--;
    renderCard();
  }

  function createLibraryCard(id) {
    const card = tutorialCards[id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tutorial-library-card';
    button.style.setProperty('--card-accent', card.accent || '#70e5d6');

    const icon = document.createElement('span');
    icon.className = 'tutorial-library-card-glyph';
    icon.textContent = card.glyph;

    const copy = document.createElement('span');
    copy.className = 'tutorial-library-card-copy';
    const name = document.createElement('strong');
    name.textContent = card.title;
    const type = document.createElement('small');
    type.textContent = card.category;
    copy.append(name, type);

    const unread = document.createElement('span');
    unread.className = 'tutorial-library-card-state';
    unread.textContent = flow.hasSeen(id) ? '✓' : 'NOVO';

    button.append(icon, copy, unread);
    button.addEventListener('click', () => openCard(id, { fromLibrary: true, firstSeen: !flow.hasSeen(id) }));
    return button;
  }

  function renderLibrary() {
    libraryGrid.replaceChildren();
    const ids = tutorialCardIds.filter(id => flow.isUnlocked(id));
    ids.forEach(id => libraryGrid.appendChild(createLibraryCard(id)));
    libraryEmpty.hidden = ids.length > 0;
    setText(libraryCount, `${ids.length} / ${tutorialCardIds.length} descobertos`);
  }

  function openLibrary() {
    microscope.stop();
    panel.setAttribute('aria-labelledby', 'tutorial-library-title');
    pauseGame();
    panel.classList.remove('tutorial-panel--card');
    panel.classList.add('tutorial-panel--library');
    mode = 'library';
    activeId = null;
    returnToLibrary = false;
    cardView.hidden = true;
    libraryView.hidden = false;
    closeButton.hidden = true;
    setText(libraryStatus, '');
    renderLibrary();
    requestAnimationFrame(() => libraryClose.focus());
  }

  function closeLibrary() {
    resumeGame();
  }

  function enqueueAutomaticTutorial(action, triggerId, context) {
    const repeatAllowed = Boolean(context.force);
    if (flow.hasSeen(action.cardId) && !repeatAllowed) return false;
    return pendingTutorials.enqueue({
      cardId: action.cardId,
      triggerId,
      presentationId: action.presentationId,
      payload: context.payload ?? null,
      triggerContext: { ...context },
      queuedAt: performance.now(),
      repeatAllowed,
    });
  }

  function trigger(id, context = {}) {
    if (
      pendingTutorials.hasTrigger(id)
      || activeAutomaticEntry?.triggerId === id
    ) return false;

    const action = flow.handle(id, {
      ...context,
      panelOpen: mode !== 'closed',
      nowSeconds: Number.isFinite(context.nowSeconds) ? context.nowSeconds : performance.now() / 1000,
    });
    if (!action.handled) return false;
    persist();
    if (action.diagnostic) {
      window.dispatchEvent(new CustomEvent(tutorialPacing.diagnosticEventName, {
        detail: action.diagnostic,
      }));
    }
    if (action.open || (action.mandatoryFirstAppearance && action.reason === 'panel-open')) {
      enqueueAutomaticTutorial(action, id, context);
    }
    return true;
  }

  function updateAutomaticPresentation(dt = 0) {
    if (mode !== 'closed') {
      safetyGate.reset('panel-open');
      return false;
    }
    if (resumeFramesRemaining > 0) {
      resumeFramesRemaining--;
      safetyGate.reset('resume-frame');
      return false;
    }

    let pending = pendingTutorials.peek();
    while (pending && flow.hasSeen(pending.cardId) && !pending.repeatAllowed) {
      pendingTutorials.shift();
      pending = pendingTutorials.peek();
    }
    if (!pending) {
      safetyGate.reset('empty-queue');
      return false;
    }

    const safety = safetyGate.inspect(dt);
    if (!safety.safe || !platformHasActiveTutorialCollision(safety.support, state)) return false;
    if (!stabilizePlayerForAutomaticTutorial(state, safety.support)) {
      safetyGate.reset('stabilization-failed');
      return false;
    }

    const entry = pendingTutorials.shift();
    safetyGate.reset('tutorial-opening');
    return openCard(entry.cardId, {
      firstSeen: !flow.hasSeen(entry.cardId),
      automaticEntry: entry,
      support: safety.support,
    });
  }

  // Ao entrar numa fase, tudo que fases anteriores ensinaram passa a valer como
  // já visto: o cartão continua disponível no GUIA, mas não volta a interromper
  // a partida. É o equivalente didático dos poderes persistentes da campanha.
  // Organismos que estreiam nesta fase não são tocados aqui.
  function syncPriorKnowledge(phase) {
    const recorded = [];
    for (const cardId of getCardsTaughtBeforePhase(phase)) {
      if (flow.hasSeen(cardId)) continue;
      if (flow.markSeen(cardId)) recorded.push(cardId);
    }
    if (recorded.length) persist();
    return recorded;
  }

  function clearStoredTutorialProgress() {
    flow.clear();
    pendingTutorials.clear();
    activeAutomaticEntry = null;
    pausedSupport = null;
    safetyGate.reset('progress-cleared');
    removeStoredTutorialProgress();
  }

  function resetTutorialProgress() {
    clearStoredTutorialProgress();
    trigger('system-welcome', {
      force: true,
      tutorialMode: 'guided',
      affectsPacing: false,
    });
    setText(libraryStatus, 'Progresso apagado. Ao voltar, a apresentação será exibida novamente.');
    renderLibrary();
    window.dispatchEvent(new CustomEvent('miguelito:tutorial-reset'));
  }

  previousButton.addEventListener('click', previousPage);
  nextButton.addEventListener('click', nextPage);
  closeButton.addEventListener('click', finishActiveCard);
  libraryClose.addEventListener('click', closeLibrary);
  resetSeenButton.addEventListener('click', resetTutorialProgress);
  desktopLibraryButton?.addEventListener('click', openLibrary);
  mobileLibraryButton?.addEventListener('click', event => {
    event.preventDefault();
    openLibrary();
  });
  window.addEventListener('miguelito:tutorial-library', openLibrary);

  window.addEventListener('keydown', event => {
    if (isHardReloadShortcut(event)) {
      clearStoredTutorialProgress();
      return;
    }
    if (isReloadShortcut(event)) return;

    if (mode === 'closed') {
      if (event.code === 'KeyH' || event.code === 'F1') {
        event.preventDefault();
        event.stopImmediatePropagation();
        openLibrary();
      }
      return;
    }

    if (event.code) heldDuringTutorial.add(event.code);
    if (event.code === 'Tab') {
      const controls = [...panel.querySelectorAll('button:not(:disabled), [tabindex="0"]')]
        .filter(element => element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      event.stopImmediatePropagation();
      return;
    }
    if (pageScroll.contains(document.activeElement)
      && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Space'].includes(event.code)) {
      event.stopImmediatePropagation();
      return;
    }
    if (panel.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON'
      && ['Enter', 'Space'].includes(event.code)) {
      if (event.repeat) event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.code === 'Escape') {
      if (mode === 'library') closeLibrary();
      else finishActiveCard();
    } else if (mode === 'card' && isTutorialAdvanceShortcut(event)) {
      nextPage();
    }
  }, true);
  window.addEventListener('keyup', event => {
    if (event.code) heldDuringTutorial.delete(event.code);
  }, true);

  return {
    get isOpen() { return mode !== 'closed'; },
    get currentCardId() { return activeId; },
    get discoveredCount() { return flow.discoveredCount; },
    get pendingCount() { return pendingTutorials.length; },
    get pendingCards() { return pendingTutorials.snapshot(); },
    get safetyDiagnostics() { return safetyGate.diagnostics(); },
    hasSeen: id => flow.hasSeen(id),
    isUnlocked: id => flow.isUnlocked(id),
    getUnlockedPages: id => flow.pagesFor(id),
    trigger,
    updateAutomaticPresentation,
    syncPriorKnowledge,
    openCard: id => openCard(id, { fromLibrary: false, firstSeen: !flow.hasSeen(id) }),
    openLibrary,
    resetTutorialProgress,
    resetAutomaticTutorials: resetTutorialProgress,
    markSeen(id) {
      const changed = flow.markSeen(id);
      if (changed) persist();
      return changed;
    },
  };
}
