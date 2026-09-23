// Paginação exclusivamente visual. Índices persistidos e desbloqueios do catálogo
// continuam pertencendo ao tutorial-flow, sem remapear o progresso da campanha.
export function isTutorialGamePage(page) {
  return /no jogo|como usar|poder inimigo|novo movimento|missão do jogador/i.test(page.title);
}

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
  // A apresentação aproxima conceito e aplicação, como no cartão de referência.
  // Só usa uma instrução que já foi desbloqueada; não duplica seu conteúdo.
  const introduction = pages[0];
  const gameIndex = pages.findIndex(page => page.body && isTutorialGamePage(page));
  if (introduction?.sourceIndex === 0 && gameIndex > 0 && !isTutorialGamePage(introduction)) {
    const game = pages.splice(gameIndex, 1)[0];
    introduction.callout = game;
    if (introduction.body.length + game.body.length > 320 || introduction.points.length) {
      const sentence = introduction.body.match(/^.*?[.!?](?:\s+|$)/u)?.[0];
      const lead = sentence && sentence.length < introduction.body.length ? sentence : introduction.body;
      const remainder = introduction.body.slice(lead.length);
      if (remainder || introduction.points.length) {
        pages.splice(1, 0, { sourceIndex: introduction.sourceIndex, kind: 'content',
          title: introduction.title, body: remainder, points: introduction.points });
        introduction.body = lead;
        introduction.points = [];
      }
    }
  }
  if (pages.length && card.cycle?.length) {
    pages.push({ kind: 'cycle', title: card.cycleLabel || 'Ciclo ou etapas', body: '', points: [], cycle: card.cycle });
  }
  return pages;
}
