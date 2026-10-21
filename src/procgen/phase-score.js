// PONTUACAO DA FASE (0-100) E MOEDAS DA COLHEITA
// ===============================================
//
// Uma funcao so, sem DOM nem estado: recebe as metricas que o jogo ja calcula
// (app.js > buildPhaseReport) e devolve nota, moedas, estado do feijoeiro e o
// "porque" da nota.
//
//   Objetivos .......... 40  cumprir os objetivos da fase (a raiz final so libera
//                            com eles, entao ao concluir isto vem cheio)
//   Colheita ........... 60  quanto o jogador USOU as mecanicas biologicas:
//                              Nitrogenio  · nodulos ativos e FBN
//                              Fosforo     · fosfato que chegou a raiz
//                              Biocontrole · biofilmes, raizes protegidas e
//                                            patogenos contidos
//                              Saude       · raizes saudaveis, sem infestacao
//                                            e com xilema funcionando
//
// Os 60 pontos da colheita sao divididos igualmente entre os pilares que EXISTEM
// na fase (fase 1: biocontrole e saude, 30 cada; da fase 4 em diante os quatro,
// 15 cada). Assim a fase 1 tambem pode chegar a 100, e cada mecanica nova passa
// a valer moedas quando aparece. Mortes nao entram: desempenho aqui e o que o
// jogador fez pela planta, nao quantas vezes caiu.
//
// Moedas = nota (1 ponto, 1 moeda): a regra mais facil de o jogador entender.
//
// O ecologicalScore da fase 10 e outra coisa (objetivo daquela fase) e continua
// intacto em ecological-score.js.

export const SCORE_WEIGHTS = Object.freeze({ objectives: 40, harvest: 60 });

// Fase em que cada pilar/componente passa a existir na campanha (manifesto).
// Fases procedurais (10+) tem tudo.
const PILLAR_FROM = Object.freeze({ nitrogen: 2, phosphorus: 4, biocontrol: 1, health: 1 });
const BIOCONTROL_FROM = Object.freeze({
  biofilm: 1, protection: 1, fungus: 5, calm: 5, rhizoctonia: 6, eggs: 8, ralstonia: 9,
});

export const PILLAR_LABEL = Object.freeze({
  nitrogen: 'Nitrogênio', phosphorus: 'Fósforo', biocontrol: 'Biocontrole', health: 'Saúde das raízes',
});

// Dica curta para o pilar mais fraco: o caminho para uma colheita maior.
const PILLAR_HINT = Object.freeze({
  nitrogen: 'Mais nódulos ativos fixando N₂ rendem colheita maior',
  phosphorus: 'Leve mais fosfato até a raiz com a micorriza',
  biocontrol: 'Biofilmes e aliados contra patógenos rendem mais',
  health: 'Raízes saudáveis e sem infestação rendem mais',
});

export const PLANT_LABEL = Object.freeze(['Feijoeiro doente', 'Feijoeiro saudável', 'Feijoeiro super saudável']);

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const ratio = (value, full) => clamp01((Number(value) || 0) / full);
const mean = values => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);

function available(fromPhase, phase) {
  return !Number.isInteger(phase) || phase >= fromPhase;
}

/** Cada pilar de 0 a 1, ou null quando a mecanica ainda nao existe na fase. */
export function harvestPillars(phase, m = {}) {
  const pillars = {};
  pillars.nitrogen = available(PILLAR_FROM.nitrogen, phase)
    ? ratio(m.activeMatureNoduleCount, 2) * .5 + ratio(m.totalFixationRate, 2) * .5
    : null;
  pillars.phosphorus = available(PILLAR_FROM.phosphorus, phase)
    ? clamp01(Math.max(Number(m.rootPhosphateStock) || 0, Number(m.mycorrhizalPhosphateTransported) || 0))
    : null;
  const bio = [];
  if (available(BIOCONTROL_FROM.biofilm, phase)) bio.push(ratio(m.functionalBiofilmCount, 2));
  if (available(BIOCONTROL_FROM.protection, phase)) bio.push(ratio(m.protectedRootCount, 3));
  if (available(BIOCONTROL_FROM.fungus, phase)) bio.push(ratio(m.controlledOpportunisticFungusCount, 2));
  if (available(BIOCONTROL_FROM.calm, phase)) bio.push(ratio(m.calmedPathogenCount, 3));
  if (available(BIOCONTROL_FROM.rhizoctonia, phase)) bio.push(ratio(m.neutralizedRhizoctoniaCount, 2));
  if (available(BIOCONTROL_FROM.eggs, phase)) bio.push(ratio(m.neutralizedEggMassCount, 2));
  if (available(BIOCONTROL_FROM.ralstonia, phase)) bio.push(ratio(m.ralstoniaControlCount, 3));
  pillars.biocontrol = mean(bio);
  pillars.health = clamp01(m.rootHealth ?? 1) * .6
    + (1 - clamp01(m.infestation)) * .2
    + clamp01(m.vascularTransport ?? 1) * .2;
  return pillars;
}

export function plantStateFromPhaseScore(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 1;
  if (score < 60) return 0;
  if (score >= 85) return 2;
  return 1;
}

export function coinsFromScore(score) {
  return Math.max(0, Math.round(Number(score) || 0));
}

/**
 * @param {{phase:number, objectives:{passed:number,total:number}, metrics:object}} input
 */
export function buildPhaseScoreReport({ phase, objectives = {}, metrics = {} } = {}) {
  const total = Math.max(0, objectives.total || 0);
  const passed = Math.max(0, Math.min(total, objectives.passed || 0));
  const objectiveRatio = total ? passed / total : 1;
  const objectivePoints = Math.round(objectiveRatio * SCORE_WEIGHTS.objectives);

  const pillars = harvestPillars(phase, metrics);
  const active = Object.entries(pillars).filter(([, value]) => value !== null);
  const share = SCORE_WEIGHTS.harvest / active.length;
  const harvest = active.map(([id, value]) => ({
    id,
    label: PILLAR_LABEL[id],
    points: Math.round(value * share),
    max: Math.round(share),
    ratio: value,
  }));
  // Soma pelas razoes (nao pelos arredondados) para o total nao "perder" pontos.
  const harvestPoints = Math.round(active.reduce((sum, [, value]) => sum + value * share, 0));
  const score = Math.max(0, Math.min(100, objectivePoints + harvestPoints));
  const plantState = plantStateFromPhaseScore(score);
  const weakest = [...harvest].sort((a, b) => a.ratio - b.ratio)[0];

  return {
    score,
    coinsEarned: coinsFromScore(score),
    plantState,
    summaryLabel: PLANT_LABEL[plantState],
    hint: weakest && weakest.ratio < .8 ? PILLAR_HINT[weakest.id] : '',
    breakdown: {
      objectives: { points: objectivePoints, max: SCORE_WEIGHTS.objectives, passed, total },
      harvest: { points: harvestPoints, max: SCORE_WEIGHTS.harvest, pillars: harvest },
    },
  };
}
