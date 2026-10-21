// CARA DA LAVOURA PELA NOTA DA COLHEITA
//
// Quatro niveis de arte (o feijoeiro do boletim continua com os tres estados
// de phase-score.js; a lavoura tem um a mais, o feijoal seco):
//   super (>= 85)     fileiras viçosas
//   saudavel (60-84)  com flores, amarelando pouco
//   doente (35-59)    folhas manchadas
//   seco (< 35)       murcho
// Usado no fim de fase (phase-finale.js) e na fazendinha (farm-scene.js).

export const FIELD_LEVEL = Object.freeze({ SECO: 0, DOENTE: 1, SAUDAVEL: 2, SUPER: 3 });

export function fieldLevelFromScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return FIELD_LEVEL.SAUDAVEL;
  if (value >= 85) return FIELD_LEVEL.SUPER;
  if (value >= 60) return FIELD_LEVEL.SAUDAVEL;
  if (value >= 35) return FIELD_LEVEL.DOENTE;
  return FIELD_LEVEL.SECO;
}

// Arquivos em assets/farm, por nivel. As variacoes se alternam ao longo da
// fileira. No super, o fim de fase usa a fileira da frente (feijao-1) e a
// fazendinha mantem as quatro fileiras em perspectiva.
export const FIELD_ART = Object.freeze([
  Object.freeze(['feijao-seco-1.webp']),
  Object.freeze(['feijao-doente-1.webp', 'feijao-doente-2.webp']),
  Object.freeze(['feijao-saudavel-1.webp', 'feijao-saudavel-2.webp', 'feijao-saudavel-3.webp']),
  Object.freeze(['feijao-1.webp']),
]);
