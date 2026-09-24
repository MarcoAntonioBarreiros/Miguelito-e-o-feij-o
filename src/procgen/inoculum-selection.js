const LABELS = Object.freeze({
  rhizobium: 'Rhizobium',
  azospirillum: 'Azospirillum',
  bacillus: 'Bacillus',
  pseudomonas: 'Pseudomonas',
  myco: 'Micorriza',
  trichoderma: 'Trichoderma',
});

// Uma unica selecao decide qual acao responde ao E.
export function createInoculumSelection({ state, input, inoculants, trichodermaColonies, entities = null }) {
  let index = 0;
  let cycleHeldLast = false;

  function options() {
    const list = [];
    for (const [type, agents] of inoculants.followerGroups()) {
      list.push({ kind: 'organism', type, count: agents.length, label: LABELS[type] || type });
    }
    const trichoderma = trichodermaColonies?.followerCount || 0;
    if (trichoderma > 0) {
      list.push({ kind: 'trichoderma', type: 'trichoderma', count: trichoderma, label: LABELS.trichoderma });
    }
    const exudates = state.player.exudates || 0;
    if (exudates > 0) list.push({ kind: 'exudate', type: 'exudate', count: exudates, label: 'Exsudato' });
    if (state.player.canPhosphateSolubilization) {
      const reserve = state.bacillusBioprotection?.solubilizerEntries
        ?.reduce((sum, entry) => sum + (entry.phosphateMetaboliteReserve || 0), 0) || 0;
      list.push({
        kind: 'phosphate-solubilization',
        type: 'phosphate-solubilization',
        count: `${Math.round(Math.min(1, reserve) * 100)}%`,
        label: 'Solubilização P',
      });
    }
    return list;
  }

  function current() {
    const list = options();
    if (!list.length) return null;
    if (index >= list.length) index = 0;
    return list[index];
  }

  function isSelected(kind, type) {
    const selected = current();
    if (!selected) return false;
    if (kind === 'organism') return selected.kind === 'organism' && selected.type === type;
    return selected.kind === kind;
  }

  function cycle() {
    const list = options();
    // Uma opção só: a seta não muda nada, então não há o que sinalizar.
    if (list.length < 2) return false;
    index = (index + 1) % list.length;
    // Depois da troca REAL do índice. `prepare` já filtra a tecla segurada, e
    // `options()` sozinho nunca chega aqui.
    // Sem toast: o chip do HUD já mostra o item escolhido.
    entities?.interactionFx?.('uiSelectionCycle', { gain: 1, rate: 1 });
    return true;
  }

  function prepare() {
    if (state.gameState !== 'play') return;
    const pressed = Boolean(input.keys.ArrowDown);
    if (pressed && !cycleHeldLast) cycle();
    cycleHeldLast = pressed;
  }

  function reset() {
    index = 0;
    cycleHeldLast = false;
  }

  return {
    prepare,
    reset,
    cycle,
    options,
    isSelected,
    get current() { return current(); },
    get summary() {
      const selected = current();
      if (!selected) return '';
      const total = options().length;
      const position = total > 1 ? ` ${index + 1}/${total}` : '';
      return `${selected.label} (${selected.count})${position}`;
    },
  };
}
