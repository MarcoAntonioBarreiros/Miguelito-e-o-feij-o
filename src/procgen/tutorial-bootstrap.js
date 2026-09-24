export function ensureTutorialInterface() {
  if (!document.querySelector('[data-tutorial-styles]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './src/procgen/tutorial-overlay.css?v=20260924-orbital-rounded-5';
    link.dataset.tutorialStyles = 'true';
    document.head.appendChild(link);
  }

  let root = document.getElementById('tutorial-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'tutorial-root';
    document.body.appendChild(root);
  }

  let desktopButton = document.getElementById('tutorial-library-button');
  if (!desktopButton) {
    desktopButton = document.createElement('button');
    desktopButton.id = 'tutorial-library-button';
    desktopButton.type = 'button';
    desktopButton.setAttribute('aria-label', 'Abrir biblioteca didática');
    desktopButton.title = 'Biblioteca didática — tecla H';
    desktopButton.innerHTML = '<span aria-hidden="true">◈</span><span>GUIA</span>';
    document.body.appendChild(desktopButton);
  }

  // O ◈ do celular mora no menu de pausa, como a primeira opção. Sem o menu
  // (página antiga), cai na barra de ferramentas como antes.
  const pauseOptions = document.getElementById('pause-options');
  const tools = document.getElementById('mobile-tools');
  const host = pauseOptions || tools;
  if (host && !document.querySelector('[data-mobile-action="tutorial"]')) {
    const mobileButton = document.createElement('button');
    mobileButton.className = 'mobile-tool';
    mobileButton.type = 'button';
    mobileButton.dataset.mobileAction = 'tutorial';
    mobileButton.setAttribute('aria-label', 'Abrir biblioteca didática');
    mobileButton.title = 'Biblioteca didática';
    mobileButton.textContent = '◈';
    if (pauseOptions) {
      const row = document.createElement('label');
      row.className = 'pause-row';
      row.append(mobileButton);
      row.insertAdjacentHTML('beforeend', '<span>Guia didático <kbd>H</kbd></span>');
      pauseOptions.prepend(row);
    } else {
      const debugButton = tools.querySelector('[data-mobile-action="debug"]');
      tools.insertBefore(mobileButton, debugButton || tools.firstChild);
    }
  }

  return { root, desktopButton };
}
