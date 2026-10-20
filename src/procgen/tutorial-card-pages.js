// Paginação exclusivamente visual. Índices persistidos e desbloqueios do catálogo
// continuam pertencendo ao tutorial-flow, sem remapear o progresso da campanha.
export function isTutorialGamePage(page) {
  return /no jogo|como usar|poder inimigo|novo movimento|missão do jogador/i.test(page.title);
}

function cyclePage(card) {
  return { kind: 'cycle', title: card.cycleLabel || 'Ciclo', body: '', points: [], cycle: card.cycle };
}

// `includeCycle`: o ciclo so aparece depois de revisado no fim da fase (GUIA).
// `cycleOnly`: o cartao de revisao do fim da fase mostra so o ciclo.
export function tutorialDisplayPages(card, unlockedIndexes, { includeCycle = false, cycleOnly = false } = {}) {
  if (!card) return [];
  if (cycleOnly) return card.cycle?.length ? [cyclePage(card)] : [];
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
    // Continuação: mesma página de origem, mesmo título, logo em seguida.
    for (const extra of page.more || []) {
      pages.push({ sourceIndex, kind: 'content', continued: true, title: page.title, body: extra.body, points: extra.points || [] });
    }
  }
  // A apresentação aproxima conceito e aplicação, como no cartão de referência.
  // Só usa uma instrução que já foi desbloqueada; não duplica seu conteúdo.
  // Com os textos curtos, a junção só acontece quando cabe inteira: se a
  // introdução tem tópicos ou continuação, cada uma fica na sua página (antes a
  // introdução era cortada e sobrava uma frase solta numa página própria).
  const introduction = pages[0];
  const gameIndex = pages.findIndex(page => page.body && !page.continued && isTutorialGamePage(page));
  const continues = index => pages[index + 1]?.continued && pages[index + 1].sourceIndex === pages[index].sourceIndex;
  if (introduction?.sourceIndex === 0 && gameIndex > 0
    && !isTutorialGamePage(introduction)
    && !introduction.points.length && !continues(0) && !continues(gameIndex)
    && introduction.body.length + pages[gameIndex].body.length <= 320) {
    introduction.callout = pages.splice(gameIndex, 1)[0];
  }
  if (includeCycle && pages.length && card.cycle?.length) pages.push(cyclePage(card));
  return pages;
}
