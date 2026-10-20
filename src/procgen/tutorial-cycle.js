// Cada etapa traz a propria legenda (tutorial-text-revision.js): nenhuma etapa
// fica "bloqueada" nem cai em texto generico.
export function tutorialCycleStep(card, index) {
  const step = card?.cycle?.[index];
  if (!step) return null;
  return typeof step === 'string' ? { label: step, caption: '' } : step;
}

export function tutorialCycleLayout(count, narrow = false) {
  if (!count) return { height: 0, positions: [], path: '', arrows: [] };
  const top = count <= 3 ? count : Math.ceil(count / 2);
  const positions = Array.from({ length: count }, (_, index) => {
    const row = narrow ? Math.floor(index / 2) : Number(index >= top);
    const length = narrow ? Math.min(2, count - row * 2) : row ? count - top : top;
    const local = narrow ? index % 2 : row ? index - top : index;
    const column = row % 2 ? length - 1 - local : local;
    return { x: length === 1 ? 175 : (narrow ? 90 : 58) + column / (length - 1) * (narrow ? 202 : 234), y: 64 + row * 156 };
  });
  let path = `M${positions[0].x} ${positions[0].y}`;
  const arrows = [];
  for (let index = 1; index < count; index++) {
    const a = positions[index - 1], b = positions[index];
    if (a.y === b.y) {
      path += ` H${b.x}`;
      arrows.push({ x: (a.x + b.x) / 2, y: a.y, angle: b.x > a.x ? 0 : 180 });
    } else {
      const right = a.x > 175;
      const edge = right ? 366 : 12;
      path += ` Q${edge} ${a.y} ${edge} ${a.y + 75} V${b.y - 75} Q${edge} ${b.y} ${b.x} ${b.y}`;
      arrows.push({ x: edge, y: (a.y + b.y) / 2, angle: 90 });
    }
  }
  return { height: positions.at(-1).y + 80, positions, path, arrows };
}

export function createTutorialCycle(block, onChange) {
  const svg = block.querySelector('svg'), list = block.querySelector('ol');
  const caption = block.querySelector('.tutorial-cycle-caption');
  const detail = block.querySelector('.tutorial-cycle-detail');
  const detailTitle = detail.querySelector('strong'), detailBody = detail.querySelector('span');
  const media = window.matchMedia('(max-width: 400px)');
  let card = null, selected = 0;
  const colors = ['#ffc35a', '#e5d874', '#b9dd7e', '#a9dec3', '#86dfd1', '#6ce7df'];
  const element = (tag, attrs) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  function select(index, notify = true) {
    selected = index;
    [...list.querySelectorAll('button')].forEach((button, i) => button.setAttribute('aria-pressed', i === selected));
    // Continuar fecha o cartao: as etapas se escolhem tocando nelas.
    caption.textContent = `Etapa ${selected + 1} de ${card.cycle.length} · toque nas etapas`;
    const step = tutorialCycleStep(card, selected);
    detailTitle.textContent = step.label + '. ';
    detailBody.textContent = step.caption;
    if (notify) onChange();
  }
  function render() {
    const layout = tutorialCycleLayout(card.cycle.length, media.matches);
    block.classList.toggle('tutorial-cycle-block--narrow', media.matches);
    block.style.setProperty('--cycle-ratio', `400 / ${layout.height}`);
    svg.setAttribute('viewBox', `0 0 400 ${layout.height}`);
    svg.replaceChildren(); list.replaceChildren();
    const defs = element('defs', {}), gradient = element('linearGradient', { id: 'tutorial-orbital-flow', x1: '0', y1: '0', x2: '.4', y2: '1' });
    for (const [offset, color] of [['0', '#ffc35a'], ['.45', '#b9dd7e'], ['1', '#6ce7df']]) gradient.append(element('stop', { offset, 'stop-color': color }));
    defs.append(gradient); svg.append(defs);
    svg.append(element('path', { d: layout.path, class: 'tutorial-orbital-base' }), element('path', { d: layout.path, class: 'tutorial-orbital-flow' }));
    for (const arrow of layout.arrows) svg.append(element('path', { d: 'M-4 -5 L4 0 L-4 5 Z', class: 'tutorial-orbital-arrow', transform: `translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})` }));
    card.cycle.forEach((_, index) => {
      const step = tutorialCycleStep(card, index).label;
      const row = document.createElement('li'), button = document.createElement('button');
      row.className = 'tutorial-cycle-step';
      row.style.left = layout.positions[index].x / 4 + '%';
      row.style.top = layout.positions[index].y / layout.height * 100 + '%';
      row.style.setProperty('--stage-color', colors[Math.round(index / Math.max(1, card.cycle.length - 1) * 5)]);
      button.type = 'button'; button.className = 'tutorial-cycle-stage';
      button.setAttribute('aria-label', `Etapa ${index + 1}: ${step}`);
      const node = document.createElement('span'), label = document.createElement('span');
      node.className = 'tutorial-cycle-node'; node.textContent = String(index + 1).padStart(2, '0'); node.setAttribute('aria-hidden', 'true');
      label.className = 'tutorial-cycle-step-label'; label.textContent = step;
      button.append(node, label); row.append(button); list.append(row);
      button.addEventListener('click', () => select(index));
    });
    select(selected, false);
  }
  media.addEventListener('change', () => { if (card && !block.hidden) render(); });
  return {
    show(nextCard) {
      block.hidden = !nextCard?.cycle?.length;
      if (block.hidden) { card = null; selected = 0; return; }
      if (card?.id !== nextCard.id) selected = 0;
      card = nextCard;
      render();
    },
    move(delta) {
      if (!card || block.hidden || selected + delta < 0 || selected + delta >= card.cycle.length) return false;
      select(selected + delta);
      detail.scrollIntoView({ block: 'nearest' });
      return true;
    },
    get index() { return selected; },
    get length() { return card && !block.hidden ? card.cycle.length : 0; },
  };
}
