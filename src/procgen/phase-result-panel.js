// RESULTADO DA COLHEITA: painel do fim da fase, ao lado do feijoeiro.
// Mostra a nota (0-100), as moedas ganhas, de onde vieram os pontos e uma dica
// do pilar mais fraco. Continuar segue a campanha; Fazendinha abre a loja e
// volta para ca.

const STYLE = `
#phase-result { position: fixed; z-index: 230; right: max(24px, env(safe-area-inset-right)); top: 50%; transform: translateY(-50%);
  width: min(380px, calc(100vw - 32px)); padding: 18px 20px 16px; border-radius: 22px 22px 22px 8px;
  background: linear-gradient(160deg,#3a1a11,#2a130d 60%); border: 1px solid rgba(255,214,170,.22); box-shadow: 0 24px 60px rgba(0,0,0,.55);
  color: #fbeedd; font-family: 'Tutorial Atkinson','Atkinson Hyperlegible',system-ui,sans-serif; animation: phase-result-in .4s cubic-bezier(.2,1.3,.4,1); }
#phase-result[hidden] { display: none; }
@keyframes phase-result-in { from { opacity: 0; transform: translate(16px,-50%); } }
#phase-result .pr-eyebrow { color: #dcbfa3; font: 700 10px/1.3 inherit; letter-spacing: .12em; text-transform: uppercase; }
#phase-result .pr-head { display: flex; align-items: flex-end; gap: 12px; margin: 6px 0 2px; }
#phase-result .pr-score { font: 800 3rem/1 'Tutorial Grandstander','Grandstander',system-ui; color: #fff4e2; }
#phase-result .pr-score small { font-size: 1.1rem; color: #dcbfa3; }
#phase-result .pr-coins { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px;
  background: rgba(255,195,90,.14); color: #ffd36f; font: 800 1.15rem/1 system-ui; }
#phase-result .pr-coin { display: inline-block; width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff2a8, #f2b63c 60%, #b97a17); box-shadow: inset 0 0 0 2px #c98a1d; }
#phase-result .pr-label { margin: 2px 0 12px; font-weight: 800; }
#phase-result .pr-label[data-state="0"] { color: #e3b46a; }
#phase-result .pr-label[data-state="1"] { color: #9fe07a; }
#phase-result .pr-label[data-state="2"] { color: #6ce7df; }
#phase-result .pr-rows { display: grid; gap: 7px; margin: 0 0 10px; padding: 0; list-style: none; }
#phase-result .pr-row { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; font-size: .9rem; }
#phase-result .pr-row b { font-variant-numeric: tabular-nums; }
#phase-result .pr-bar { grid-column: 1 / -1; height: 6px; border-radius: 3px; background: rgba(255,255,255,.08); overflow: hidden; }
#phase-result .pr-bar i { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg,#ffc35a,#b9dd7e,#6ce7df); }
#phase-result .pr-row--group { color: #dcbfa3; font-size: .78rem; text-transform: uppercase; letter-spacing: .08em; margin-top: 4px; }
#phase-result .pr-hint { margin: 0 0 6px; color: #ffd36f; font-size: .85rem; line-height: 1.35; }
#phase-result .pr-total { margin: 0 0 12px; color: #dcbfa3; font-size: .8rem; }
#phase-result .pr-actions { display: flex; gap: 10px; justify-content: flex-end; }
#phase-result button { border-radius: 999px; padding: 10px 18px; font: 800 1rem/1 'Tutorial Grandstander','Grandstander',system-ui; cursor: pointer; }
#phase-result .pr-farm { background: transparent; color: #fbeedd; border: 1.5px solid rgba(255,214,170,.35); }
#phase-result .pr-continue { background: #ffc35a; color: #3a1608; border: 0; box-shadow: 0 4px 0 #b3651f; }
@media (max-width: 700px) {
  #phase-result { top: auto; bottom: max(12px, env(safe-area-inset-bottom)); right: 16px; transform: none; padding: 14px 16px; }
  @keyframes phase-result-in { from { opacity: 0; transform: translateY(16px); } }
  #phase-result .pr-score { font-size: 2.3rem; }
}
`;

function ensureStyle() {
  if (document.getElementById('phase-result-style')) return;
  const style = document.createElement('style');
  style.id = 'phase-result-style';
  style.textContent = STYLE;
  document.head.appendChild(style);
}

function row(label, points, max) {
  const pct = max ? Math.round(Math.max(0, Math.min(1, points / max)) * 100) : 0;
  return `<li class="pr-row"><span>${label}</span><b>${points}/${max}</b><span class="pr-bar"><i style="width:${pct}%"></i></span></li>`;
}

export function createPhaseResultPanel({ onContinue = () => {}, onFarm = () => {} } = {}) {
  let root = null;

  function ensureDom() {
    if (root) return;
    ensureStyle();
    root = document.createElement('section');
    root.id = 'phase-result';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Resultado da colheita');
    document.body.appendChild(root);
    root.addEventListener('click', event => {
      if (event.target.closest('.pr-continue')) { hide(); onContinue(); }
      else if (event.target.closest('.pr-farm')) onFarm();
    });
    window.addEventListener('keydown', event => {
      if (!root || root.hidden || document.getElementById('farm-overlay')?.hidden === false) return;
      // Enter num botao focado faz o que o botao diz; fora dele, Continuar
      if (root.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON') return;
      if (event.code === 'Enter' || event.code === 'NumpadEnter') {
        event.preventDefault(); event.stopImmediatePropagation();
        hide(); onContinue();
      }
    }, true);
  }

  function show(report, { credited = true, pending = 0, sold = 0, total = null, visited = false } = {}) {
    ensureDom();
    const b = report.breakdown;
    const pillars = b.harvest.pillars.map(p => row(p.label, p.points, p.max)).join('');
    root.innerHTML = `
      <div class="pr-eyebrow">Resultado da colheita · Fase ${report.displayPhase ?? report.phase}</div>
      <div class="pr-head">
        <div class="pr-score">${report.score}<small>/100</small></div>
        <div class="pr-coins" title="Moedas da colheita"><span class="pr-coin"></span>+${report.coinsEarned}</div>
      </div>
      <p class="pr-label" data-state="${report.plantState}">${report.summaryLabel}</p>
      <ul class="pr-rows">
        ${row('Objetivos da fase', b.objectives.points, b.objectives.max)}
        <li class="pr-row pr-row--group"><span>Colheita</span><b>${b.harvest.points}/${b.harvest.max}</b></li>
        ${pillars}
      </ul>
      ${report.hint ? `<p class="pr-hint">${report.hint}</p>` : ''}
      <p class="pr-total">${!credited ? 'Esta lavoura já tinha sido plantada. '
        : pending > 0 ? `A lavoura está pronta: colha na fazendinha para receber ${pending} moedas.`
        : sold > 0 ? `Colheita vendida: +${sold} moedas.${Number.isFinite(total) ? ` Na fazendinha: ${total}.` : ''}`
        : visited ? 'Colheita recebida na fazendinha.' : ''}</p>
      <div class="pr-actions">
        <button type="button" class="pr-farm">${pending > 0 ? 'Colher na fazendinha' : 'Fazendinha'}</button>
        <button type="button" class="pr-continue">Continuar</button>
      </div>`;
    root.hidden = false;
    root.querySelector('.pr-continue').focus();
  }

  function hide() { if (root) root.hidden = true; }

  return {
    show,
    hide,
    setVisible(visible) { if (root) root.hidden = !visible; },
    get isOpen() { return Boolean(root && !root.hidden); },
  };
}
