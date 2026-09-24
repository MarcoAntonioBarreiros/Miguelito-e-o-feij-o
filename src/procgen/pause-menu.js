// Menu de pausa: os ajustes (som, luz, paralaxe, plataformas de segurança,
// informações técnicas, guia, recomeçar) saíram da tela de jogo e moram aqui.
// Na tela ficam só pausa, tela cheia e zoom.
//
// Pausar não mexe em `state.gameState`: o loop consulta `isOpen` e deixa de
// avançar o mundo, pelo mesmo caminho que o tutorial usa para congelar a
// partida (advanceGameplayFrame).
export function createPauseMenu({
  root = document.getElementById('pause-menu'),
  toggleButton = document.querySelector('[data-mobile-action="pause"]'),
  canOpen = () => true,
  onChange = () => {},
} = {}) {
  let open = false;

  function setOpen(next) {
    if (!root || next === open) return open;
    if (next && !canOpen()) return open;
    open = next;
    root.hidden = !open;
    document.documentElement.classList.toggle('pause-open', open);
    toggleButton?.setAttribute('aria-expanded', String(open));
    toggleButton?.classList.toggle('active', open);
    if (open) root.querySelector('[data-pause-action="resume"]')?.focus();
    else if (root.contains(document.activeElement)) document.activeElement.blur();
    onChange(open);
    return open;
  }

  toggleButton?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    toggleButton.blur();
    setOpen(!open);
  });
  // O toque no botão não pode virar pulo nem desbloqueio de áudio no listener
  // global do jogo.
  for (const type of ['pointerdown', 'touchstart']) {
    toggleButton?.addEventListener(type, event => event.stopPropagation(), { passive: true });
    root?.addEventListener(type, event => event.stopPropagation(), { passive: true });
  }

  root?.querySelector('[data-pause-action="resume"]')?.addEventListener('click', event => {
    event.preventDefault();
    setOpen(false);
  });
  // Tocar no fundo escuro, fora do painel, também continua o jogo.
  root?.addEventListener('click', event => {
    if (event.target === root) setOpen(false);
  });
  // Recomeçar e abrir o guia saem do menu: o guia pausa o jogo sozinho.
  root?.querySelector('[data-mobile-action="reset"]')?.addEventListener('click', () => setOpen(false));
  window.addEventListener('miguelito:tutorial-open', () => setOpen(false));

  return {
    get isOpen() { return open; },
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
  };
}
