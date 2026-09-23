// Paginação exclusivamente visual. Índices persistidos e desbloqueios do catálogo
// continuam pertencendo ao tutorial-flow, sem remapear o progresso da campanha.
export function tutorialDisplayPages(card, unlockedIndexes) {
  if (!card) return [];
  const pages = [];
  for (const sourceIndex of unlockedIndexes) {
    const page = card.pages[sourceIndex];
    if (!page) continue;
    const points = page.points || [];
    const separatePoints = points.length > 2
      || page.body.length + points.join('').length > 280;
    pages.push({ ...page, sourceIndex, kind: 'content', points: separatePoints ? [] : points });
    if (separatePoints) {
      for (let index = 0; index < points.length; index += 2) {
        pages.push({ sourceIndex, kind: 'details', title: page.title, body: '', points: points.slice(index, index + 2) });
      }
    }
  }
  if (pages.length && card.cycle?.length) {
    pages.push({ kind: 'cycle', title: card.cycleLabel || 'Ciclo ou etapas', body: '', points: [], cycle: card.cycle });
  }
  return pages;
}
