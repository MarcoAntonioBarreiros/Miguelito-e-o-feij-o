// Fonte única de todos os textos narrados durante a partida (toast).
//
// Cada entrada: { kind, scope?, cardId?, text: string | (params) => string }
//
// kind
//   science → liga o que se vê ao conceito; 1× por campanha; sempre tem cardId
//   hint    → instrução quando a ação falha ou o jogador trava; 1× por fase
//   danger  → ameaça imediata; 1× por fase (ou `always`); interrompe o que está
//             em tela
//   system  → feedback de botão do usuário (som, paralaxe, erro); sempre
//
// scope (padrão pelo kind): 'campaign' | 'phase' | 'always'
//
// Regras de texto: ≤ 60 caracteres, sem ponto final, sem números que o HUD já
// mostra. `tests/narrator.test.js` confere tudo isso. Para adicionar uma
// mensagem, veja docs/narration.md.

export const NARRATION_TEXT_LIMIT = 60;

export const FEATURE_LABELS = Object.freeze({
  doubleJump: 'salto duplo',
  dash: 'dash',
  phosphateSolubilization: 'solubilização de fosfato',
  mycorrhizaStructures: 'pontes micorrízicas',
  azospirillumRoots: 'escadas radiculares',
});

export const UNLOCK_CARD_IDS = Object.freeze({
  doubleJump: 'power-double-jump',
  dash: 'power-dash',
  phosphateSolubilization: 'power-pulse',
  mycorrhizaStructures: 'structure-mycorrhiza-path',
  azospirillumRoots: 'structure-lateral-root',
});

const unlockEntries = Object.fromEntries(Object.entries(FEATURE_LABELS).map(([feature, label]) => [
  `unlock.${feature}`,
  { kind: 'science', cardId: UNLOCK_CARD_IDS[feature], text: `Novo poder: ${label}` },
]));

export const NARRATION = Object.freeze({
  // 4.1 Mecânica, fase e sistema ---------------------------------------------
  'inoculum.recruited': { kind: 'hint', scope: 'campaign', cardId: 'action-inoculation',
    text: 'Recrutado! Leve até uma raiz e aperte E' },
  'inoculum.no-root': { kind: 'hint',
    text: 'Chegue mais perto de uma raiz' },
  'exudate.empty': { kind: 'hint',
    text: 'Sem exsudatos: colete as gotas verdes' },
  'exudate.gradient': { kind: 'science', cardId: 'action-exudate',
    text: 'Exsudatos atraem micróbios móveis' },
  'route.high': { kind: 'hint', scope: 'campaign',
    text: 'Rotas altas escondem recursos extras' },
  ...unlockEntries,
  'goal.blocked': { kind: 'hint', scope: 'always',
    text: ({ message = 'Faltam objetivos: veja a lista' } = {}) => message },
  'p1.module-done': { kind: 'hint', scope: 'campaign',
    text: 'Biofilme formado: a saída se abriu' },
  'p1.final-done': { kind: 'hint', scope: 'campaign',
    text: 'Prova concluída: biofilme na saída' },
  'p1.support-root': { kind: 'hint', scope: 'campaign',
    text: 'Surgiu uma raiz de apoio' },
  'p1.exit-blocked': { kind: 'hint', scope: 'always',
    text: ({ missing = 'complete o objetivo' } = {}) => `Saída bloqueada: ${missing}` },
  'system.sound-on': { kind: 'system', text: 'Som ativado' },
  'system.sound-off': { kind: 'system', text: 'Som desativado' },
  'system.sound-failed': { kind: 'system', text: 'Não foi possível ativar o som' },
  'system.recovery-off': { kind: 'system', text: 'Plataformas de segurança desligadas' },
  'system.recovery-on': { kind: 'system', text: 'Plataformas de segurança religadas' },
  'system.parallax-on': { kind: 'system', text: 'Paralaxe biológico ativado' },
  'system.parallax-off': { kind: 'system', text: 'Paralaxe biológico desativado' },
  'system.lighting-on': { kind: 'system', text: 'Luz e atmosfera ativadas' },
  'system.lighting-off': { kind: 'system', text: 'Luz e atmosfera desativadas' },
  'system.loop-error': { kind: 'system', text: 'Um sistema falhou; Tab mostra o erro' },

  // 4.2 Rhizobium, nitrogênio e Azospirillum ---------------------------------
  'rhizobium.curl': { kind: 'science', cardId: 'structure-nodule',
    text: 'Pelo radicular se curva ao redor do Rhizobium' },
  'rhizobium.thread': { kind: 'science', cardId: 'structure-nodule',
    text: 'Fio de infecção: bactérias entram na raiz' },
  'rhizobium.primordium': { kind: 'science', cardId: 'structure-nodule',
    text: 'Primórdio: a raiz inicia um novo órgão' },
  'rhizobium.young': { kind: 'science', cardId: 'structure-nodule',
    text: 'Nódulo jovem: surgem os bacteroides' },
  'rhizobium.mature': { kind: 'science', cardId: 'process-fbn',
    text: 'Nódulo maduro: FBN ativa' },
  'rhizobium.no-host': { kind: 'hint',
    text: 'Rhizobium só forma nódulo em raiz' },
  'nitrogen.root-grew': { kind: 'science', cardId: 'process-fbn',
    text: 'Com nitrogênio, a raiz cresceu' },
  // Texto fixo: tests/azospirillum-mycorrhiza.test.js confere a string.
  'azo.coinoculation': { kind: 'science', cardId: 'organism-azospirillum',
    text: 'Co-inoculação: FBN potencializada' },
  'azo.ladder-start': { kind: 'science', cardId: 'structure-lateral-root',
    text: 'Fitormônios: raízes laterais brotando' },
  'azo.ladder-ready': { kind: 'hint', scope: 'campaign',
    text: 'Escada radicular pronta: suba' },

  // 4.3 Bacillus, micorriza, Pseudomonas e fósforo ---------------------------
  'bacillus.checkpoint': { kind: 'science', cardId: 'organism-bacillus',
    text: 'Bacillus: seu novo ponto de retorno' },
  'bacillus.biofilm': { kind: 'science', cardId: 'structure-biofilm',
    text: 'Biofilme de Bacillus: nova zona segura' },
  'bacillus.mature': { kind: 'science', cardId: 'structure-biofilm',
    text: 'Biofilme maduro protege a raiz' },
  'bacillus.sporulation': { kind: 'science', cardId: 'organism-bacillus',
    text: 'Pouco carbono: Bacillus formou endósporos' },
  'bacillus.reactivation': { kind: 'science', cardId: 'organism-bacillus',
    text: 'Exsudatos reativaram os endósporos' },
  'bacillus.j2-repelled': { kind: 'science', cardId: 'structure-biofilm',
    text: 'Biofilme repeliu os J2 grudados' },
  'myco.bridge-start': { kind: 'science', cardId: 'structure-mycorrhiza-path',
    text: 'Hifas começam a ponte entre as raízes' },
  'myco.bridge-ready': { kind: 'hint', scope: 'campaign',
    text: 'Ponte micorrízica pronta: atravesse' },
  'pseudo.no-iron': { kind: 'hint',
    text: 'Sem Fe³⁺ ao alcance da Pseudomonas' },
  'pseudo.chelate': { kind: 'science', cardId: 'process-siderophore',
    text: 'Sideróforo capturou Fe³⁺ para a colônia' },

  // 4.4 Trichoderma, Rhizoctonia e fungo oportunista -------------------------
  'tricho.rhizoc-detect': { kind: 'science', cardId: 'process-mycoparasitism',
    text: 'Trichoderma localizou a Rhizoctonia' },
  'tricho.coil': { kind: 'science', cardId: 'process-mycoparasitism',
    text: 'Enovelamento: a hifa envolve o patógeno' },
  'tricho.mycoparasitism-done': { kind: 'science', cardId: 'process-mycoparasitism',
    text: 'Micoparasitismo: Rhizoctonia desestruturada' },
  'tricho.exhausted': { kind: 'hint',
    text: 'Colônia exausta: dê exsudatos a ela' },
  'rhizoc.attack': { kind: 'danger', cardId: 'organism-rhizoctonia',
    text: 'Hifa de ataque! Saia do halo vermelho' },
  'fungus.attached': { kind: 'danger', cardId: 'organism-opportunistic-fungus',
    text: 'Hifas grudaram em você: ficou lento' },

  // 4.5 Meloidogyne ----------------------------------------------------------
  'melo.hatch': { kind: 'science', cardId: 'structure-egg-mass',
    text: 'Ovos eclodiram: J2 buscam uma raiz' },
  'melo.penetration': { kind: 'science', cardId: 'organism-meloidogyne-j2',
    text: 'Um J2 está penetrando a raiz' },
  'melo.feeding-site': { kind: 'science', cardId: 'structure-gall',
    text: 'Células gigantes: a galha se forma' },
  'melo.new-eggs': { kind: 'science', cardId: 'structure-egg-mass',
    text: 'Nova massa de ovos: outro ciclo' },
  'melo.female-died': { kind: 'science', cardId: 'organism-meloidogyne-female',
    text: 'Fêmea morreu; a galha permanece' },
  'melo.female-protected': { kind: 'hint', scope: 'campaign',
    text: 'Fêmea protegida: ataque ovos e J2' },
  // Primeira aparição de cada patógeno na fase: um id por patógeno, para um
  // não calar o outro.
  'arrival.ralstonia': { kind: 'danger',
    text: ({ where = 'pelo solo' } = {}) => `Ralstonia chegando ${where}` },
  'arrival.meloidogyne': { kind: 'danger',
    text: ({ where = 'pelo solo' } = {}) => `J2 chegando ${where}` },
  'survival.j2-carried': { kind: 'danger', scope: 'campaign', cardId: 'organism-meloidogyne-j2',
    text: 'Um J2 grudou em você: ficou lento' },
  'survival.j2-dropped': { kind: 'science', cardId: 'organism-meloidogyne-j2',
    text: 'O J2 caiu e busca a raiz abaixo' },
  'tricho.melo-detect-eggs': { kind: 'science', cardId: 'process-mycoparasitism',
    text: 'Trichoderma achou uma massa de ovos' },
  'tricho.melo-detect-j2': { kind: 'science', cardId: 'process-mycoparasitism',
    text: 'Trichoderma achou um J2 livre' },
  'tricho.melo-eggs-done': { kind: 'science', cardId: 'structure-egg-mass',
    text: 'Ovos inviabilizados: geração interrompida' },
  'tricho.melo-j2-lysed': { kind: 'science', cardId: 'process-mycoparasitism',
    text: 'J2 lisado antes de entrar na raiz' },

  // 4.6 Ralstonia ------------------------------------------------------------
  'ralst.entry': { kind: 'science', cardId: 'process-ralstonia-entry',
    text: 'Ralstonia entrou nos vasos da raiz' },
  'ralst.vascular': { kind: 'science', cardId: 'process-vascular-obstruction',
    text: 'Xilema colonizado: o transporte cai' },
  'ralst.critical': { kind: 'science', cardId: 'process-vascular-obstruction',
    text: 'Murcha crítica: prevenir era melhor' },
  'ralst.focus-superficial': { kind: 'hint', scope: 'campaign',
    text: 'Feche a porta antes do xilema' },
  'ralst.focus-containment': { kind: 'hint', scope: 'campaign', cardId: 'process-ralstonia-containment',
    text: 'Já no xilema: agora é conter' },
  'ralst.neutralized': { kind: 'science', cardId: 'organism-ralstonia',
    text: 'Neutralizada antes de entrar nos vasos' },
  'ralst.contained': { kind: 'science', cardId: 'process-ralstonia-containment',
    text: 'Infecção contida: a raiz segue funcional' },
  'ralst.spread-warning': { kind: 'danger', scope: 'always',
    text: 'Disseminação! Proteja a raiz marcada' },
  'ralst.spread-blocked-healed': { kind: 'science', cardId: 'process-ralstonia-spread',
    text: 'Bloqueada: raiz cicatrizada, sem porta' },
  'ralst.spread-blocked-protected': { kind: 'science', cardId: 'process-ralstonia-spread',
    text: 'Bloqueada pela proteção biológica' },
  'ralst.spread-arrived': { kind: 'danger',
    text: 'Novo foco superficial: ainda dá para prevenir' },

  // 4.7 Raiz e dano ----------------------------------------------------------
  'root.support-lost': { kind: 'science', cardId: 'process-root-health',
    text: 'Raiz fraca cede sob seu peso' },
  'root.collapse': { kind: 'danger', cardId: 'process-root-collapse',
    text: 'Raiz em colapso' },
  'survival.defeated': { kind: 'danger', scope: 'always',
    text: ({ source = 'patógeno' } = {}) => `Vencido por ${source}` },
});

export function narrationText(entry, params = {}) {
  if (!entry) return '';
  return typeof entry.text === 'function' ? entry.text(params) : entry.text;
}
