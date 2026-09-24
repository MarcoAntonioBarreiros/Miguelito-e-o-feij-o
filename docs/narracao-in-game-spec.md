# Especificação — Narração in-game enxuta (toasts e rótulos)

Repositório: `MarcoAntonioBarreiros/Miguelito-e-o-feij-o` (repositório de trabalho; não mexer no `Miguelito-Game` original).
Escopo: texto que aparece **durante a partida** — `#toast`, `#hud-alerts`, rótulos desenhados no canvas e subtítulo do cartão de abertura da fase. **Fora do escopo:** conteúdo dos cartões tutoriais/GUIA (só são referenciados por id).

Referências de linha valem para o commit `ba16535`. Localize pelo texto citado se as linhas tiverem mudado.

---

## 1. Problema

1. **Um canal, ~25 escritores, nenhum árbitro.** Cada módulo grava direto em `state.toast` com cooldown próprio (1,6–2,6 s). Uma mensagem de 5,5 s pode ser sobrescrita 0,1 s depois por outro módulo.
2. **Sem memória de "já dito".** Quase tudo repete a cada ocorrência (7 mensagens por fêmea de Meloidogyne, 5 etapas por nódulo, "perdeu N corações" a cada dano, "Solubilização parcial" a cada impacto, "Selecionado…" a cada troca).
3. **Redundância com outras camadas** (corações, chips, medidores, rótulos, cinemática final).
4. **O conteúdo científico já está nos 37 cartões do GUIA**, e quase todos esses cartões já disparam automaticamente no primeiro contato (`tutorial-triggers.js`). Hoje o jogador recebe cartão **e** toast no mesmo momento, e depois só toast repetido.
5. Jargão de desenvolvimento visível ("chunk de aquisição", "vigor persistente"), strings sem acento e dois pontos de imprecisão científica.

## 2. Regra

Toda mensagem pertence a **uma** classe:

| Classe | `kind` | Escopo padrão | Pode interromper? | Uso |
|---|---|---|---|---|
| Ciência | `science` | 1× por campanha | não | Liga o que se vê ao conceito. Sempre tem `cardId` (◈ abre o cartão). |
| Instrução | `hint` | 1× por fase | não | Só quando a ação falha ou o jogador trava. |
| Perigo | `danger` | 1× por fase (ou `always`) | **sim** | Ameaça imediata. |
| Sistema | `system` | sempre | não | Som/luz/paralaxe/erro — feedback de botão do usuário. |
| Estado | — | — | — | **Nunca vira toast.** Fica no ícone, medidor ou visual que já existe. |

Limite de texto: **≤ 60 caracteres** (≈ 2 linhas no celular em retrato). Sem ponto final. Sem números que o HUD já mostra.

**Supressão pelo cartão:** se o `cardId` da mensagem de ciência estiver aberto (`tutorial.currentCardId`) ou na fila (`tutorial.pendingCards[].cardId`) no momento do `say`, a mensagem não aparece e é marcada como dita. O cartão é a explicação da primeira vez; o GUIA é a consulta.

## 3. Arquitetura

### 3.1 `src/procgen/narration-catalog.js` (novo)

Fonte única de todos os textos. Marco revisa este arquivo, não os módulos.

```js
// Cada entrada: { kind, scope?, cardId?, text: string | (params) => string }
export const NARRATION = Object.freeze({
  'rhizobium.curl': { kind: 'science', cardId: 'structure-nodule',
    text: 'Pelo radicular se curva ao redor do Rhizobium' },
  'survival.defeated': { kind: 'danger', scope: 'always',
    text: ({ source }) => `Vencido por ${source}` },
  // … tabela completa na seção 4
});
```

### 3.2 `src/procgen/narrator.js` (novo)

```js
export function createNarrator({ state, campaign, getTutorial, catalog = NARRATION })
// → { say(id, params?), update(dt), resetPhase(), current, queue, diagnostics() }

const narrators = new WeakMap();
export function registerNarrator(state, narrator) { narrators.set(state, narrator); }

// Chamado pelos módulos. Sem narrador registrado (testes unitários com `state`
// literal, simuladores auxiliares do gerador), cai no comportamento antigo.
export function narrate(state, id, params = {}) {
  const narrator = narrators.get(state);
  if (narrator) return narrator.say(id, params);
  const entry = NARRATION[id];
  if (!entry) return false;
  state.toast = typeof entry.text === 'function' ? entry.text(params) : entry.text;
  state.toastTime = 4;
  return true;
}
```

Comportamento de `say`:

1. Entrada inexistente ou `kind: 'state'` → ignora.
2. Já dita no escopo (`campaign` → `campaign.narrationSeen`; `phase` → conjunto interno zerado em `resetPhase()`; `always` → só um intervalo mínimo de 6 s por id) → ignora.
3. `science` com `cardId` aberto ou pendente no GUIA → marca como dita e ignora.
4. Enfileira. Fila máx. 3 itens, ordenada por prioridade `danger > hint > science > system`. Itens de ciência expiram após 8 s na fila; instruções após 5 s (falam do que está acontecendo agora).
5. `danger` substitui a mensagem atual imediatamente.

Comportamento de `update(dt)` (só roda quando o mundo avança — cartão aberto congela a narração; ver `tests/tutorial-runtime.test.js:596`):

- Tempo em tela: `clamp(1.8 + 0.05 × caracteres, 2.5, 5.0)` s.
- Nenhuma mensagem é trocada por outra antes do fim, exceto por `danger`.
- A marcação "dita" acontece quando a mensagem fica ≥ 1,5 s em tela. Se um perigo a interromper antes disso, ela não é marcada e pode voltar na próxima ocorrência.
- Escreve em `state.toast`, `state.toastTime` e `state.toastCardId` (novo).

### 3.3 Integração

- `simulator.js`: criar o narrador junto do `state`, `registerNarrator(state, narrator)`, chamar `narrator.update(dt)` no mesmo passo onde hoje está `if (state.toastTime > 0) state.toastTime -= dt;` (linha 448). Expor `sim.narrator`.
- `app.js › initGame`: `sim.narrator.resetPhase()`.
- `getTutorial: () => window.miguelitoTutorial` (o manager nasce depois do simulador).
- Os módulos que hoje têm `announce()`/`toast()` locais passam a chamar `narrate(state, id, params)`. Remover os `lastToastAt`/cooldowns locais que só serviam ao toast. Manter flags que controlam **lógica** (ex.: `focus.announcedVascular` pode continuar evitando reentrada).

### 3.4 Persistência

`campaign-progression.js`: adicionar `narrationSeen: []` em `blankCampaign`, `campaignSnapshot` e na restauração de `createCampaign`. `resetCampaign` zera. Mesmo `sessionStorage` da campanha (Phase Lab continua sem storage).

### 3.5 UI do toast (`app.js` ~1968 e `index.html`)

- Markup: `<span class="toast-text">…</span><button class="toast-card" aria-label="Abrir no GUIA">◈</button>`. O botão só aparece quando há `toastCardId`.
- `#toast` continua `pointer-events: none`; só `.toast-card` recebe `pointer-events: auto`, com área de toque ≥ 40 px em `.touch-device`.
- Clique → `window.miguelitoTutorial.openCard(cardId)` (já pausa o jogo e revela as páginas).
- A comparação `sim.state.toast !== lastToast` passa a considerar também `toastCardId`.
- **Não** esconder `#toast` durante a cinemática final — `tests/phase-finale.test.js` exige que ele continue visível. A redundância do fim de fase é resolvida removendo as mensagens (seção 4.1).

## 4. Catálogo — mensagem por mensagem

Legenda do destino: **REMOVER** = apagar a atribuição a `state.toast` (a informação já está em outra camada). Textos novos já estão no limite de 60 caracteres.

### 4.1 Mecânica, fase e sistema

| id | Onde (atual) | Texto atual (resumo) | kind / escopo | cardId | Texto novo |
|---|---|---|---|---|---|
| `inoculum.recruited` | `beneficial-inoculants.js:192`, `trichoderma-recruitment.js:74` | "X recrutado: leve a comunidade até uma raiz e pressione E novamente…" / "Trichoderma recrutado: a colônia seguirá…" | hint / campanha | `action-inoculation` | Recrutado! Leve até uma raiz e aperte E |
| `inoculum.no-root` | `beneficial-inoculants.js:376` | "Inoculação impossível: aproxime Miguelito…" | hint / fase | — | Chegue mais perto de uma raiz |
| — | `beneficial-inoculants.js:398` | "Inoculantes depositados… vigor persistente" | — | — | **REMOVER** |
| — | `trichoderma-colonies.js:91` | "Trichoderma inoculado: N propágulos…" | — | — | **REMOVER** |
| — | `inoculum-selection.js:57-61` | "Selecionado: …" (a cada troca) | — | — | **REMOVER** (o chip mostra o item) |
| `exudate.empty` | `ecological-gameplay.js:64` | "Sem exsudatos: Colete gotas verdes…" | hint / fase | — | Sem exsudatos: colete as gotas verdes |
| `exudate.gradient` | `ecological-gameplay.js:95` | "Gradiente de exsudatos: A nuvem atrai…" | science | `action-exudate` | Exsudatos atraem micróbios móveis |
| `route.high` | `app.js:1756` | "Rotas altas podem esconder recursos extras." | hint / campanha | — | Rotas altas escondem recursos extras |
| `unlock.<feature>` | `simulator.js:181` (e `physics.js:459` se alcançado) | `zone.unlockDesc` (até 210 caracteres, com controles) | science | ver abaixo | `Novo poder: ${FEATURE_LABELS[feature]}` |
| — | `simulator.js:216-218` | "Respawn no último biofilme…" / "Retorno ao último ponto seguro." | — | — | **REMOVER** |
| — | `goal-system.js:34` | "Fase N concluída: o sistema radicular atual será substituído" | — | — | **REMOVER** |
| — | `app.js:1573` | "Fase N: X pontos · saúde…" | — | — | **REMOVER** (a cinemática já mostra, `phase-finale.js:388-397`) |
| `goal.blocked` | `goal-system.js:70` + guarda em `app.js:812` | "A raiz final exige a reserva mínima de ferro…" / "…aguarda a conclusão do objetivo ecológico indicado." | hint / always | — | fase 5: Falta ferro e controlar o fungo · demais: Faltam objetivos: veja a lista |
| `p1.module-done` | `phase-one-vertical-slice.js:204` | "Módulo concluído: recrutamento, inoculação e biofilme confirmados." | hint / campanha | — | Biofilme formado: a saída se abriu |
| `p1.final-done` | idem | "Prova final concluída: a raiz de saída recebeu…" | hint / campanha | — | Prova concluída: biofilme na saída |
| `p1.support-root` | `phase-one-vertical-slice.js:242` | "Checkpoint demonstrado: uma raiz de apoio surgiu…" | hint / campanha | — | Surgiu uma raiz de apoio |
| `p1.exit-blocked` | `phase-one-vertical-slice.js:254` | "Saída bloqueada: volte à raiz… com halo amarelo…" | hint / always | — | `Saída bloqueada: ${missing}` com `missing` = "forme o biofilme na raiz amarela" / "inocule Bacillus na raiz amarela" / "complete o objetivo" |
| `system.*` | `app.js:1479,1486,1631,1662,1679,2129` | Som/luz/paralaxe/recuperação/erro | system / always | — | Manter os textos atuais |

Mapeamento `unlock.<feature>` → `cardId`: `doubleJump` → `power-double-jump`; `dash` → `power-dash`; `phosphateSolubilization` → `power-pulse`; `mycorrhizaStructures` → `structure-mycorrhiza-path`; `azospirillumRoots` → `structure-lateral-root`. Como esses cartões disparam no próprio desbloqueio (`tutorial-triggers.js:253-257`), a supressão pelo cartão fará o toast raramente aparecer — é o comportamento desejado.

### 4.2 Rhizobium, nitrogênio e Azospirillum

| id | Onde | Texto atual (resumo) | kind / escopo | cardId | Texto novo |
|---|---|---|---|---|---|
| `rhizobium.curl` | `rhizobium-nodulation.js:142` | "Sinalização simbiótica: o pelo radicular…" | science | `structure-nodule` | Pelo radicular se curva ao redor do Rhizobium |
| `rhizobium.thread` | `:147` | "Fio de infecção: as bactérias avançam…" | science | `structure-nodule` | Fio de infecção: bactérias entram na raiz |
| `rhizobium.primordium` | `:152` | "Primórdio nodular: células da raiz…" | science | `structure-nodule` | Primórdio: a raiz inicia um novo órgão |
| `rhizobium.young` | `:155` | "Nódulo jovem: … bacteroides." | science | `structure-nodule` | Nódulo jovem: surgem os bacteroides |
| `rhizobium.mature` | `:162` | "Nódulo maduro: leghemoglobina…" | science | `process-fbn` | Nódulo maduro: FBN ativa |
| `rhizobium.no-host` | `:96` | "Rhizobium sem hospedeiro…" | hint / fase | — | Rhizobium só forma nódulo em raiz |
| `nitrogen.root-grew` | `nitrogen-root.js:461` | "FBN ativa: o nitrogenio sustentou…" | science | `process-fbn` | Com nitrogênio, a raiz cresceu |
| `azo.coinoculation` | `azospirillum-nitrogen.js:113` | "Co-inoculação: FBN potencializada" | science | `organism-azospirillum` | Co-inoculação: FBN potencializada (**manter idêntico** — `tests/azospirillum-mycorrhiza.test.js:520`) |
| `azo.ladder-start` | `azospirillum-root-growth.js:928` | "Azospirillum inoculado: fitormônios…" | science | `structure-lateral-root` | Fitormônios: raízes laterais brotando |
| `azo.ladder-ready` | `:982` | "Escada radicular madura: todos os degraus…" | hint / campanha | — | Escada radicular pronta: suba |

Observação: a memória por sítio (`site.announced`) do Rhizobium deixa de ser necessária para o toast — o escopo de campanha faz as 5 etapas aparecerem só no primeiro nódulo.

### 4.3 Bacillus, micorriza, Pseudomonas e fósforo

| id | Onde | Texto atual (resumo) | kind / escopo | cardId | Texto novo |
|---|---|---|---|---|---|
| `bacillus.checkpoint` | `physics.js:487` (ramo `first`) | "Colônia resistente de Bacillus: … funciona como checkpoint." | science | `organism-bacillus` | Bacillus: seu novo ponto de retorno |
| — | `physics.js:487` (ramo não-`first`) | "Checkpoint de Bacillus ativado…" | — | — | **REMOVER** (som e visual bastam) |
| `bacillus.biofilm` | `ecological-gameplay.js:206` | "Biofilme de Bacillus: A matriz aderida…" | science | `structure-biofilm` | Biofilme de Bacillus: nova zona segura |
| — | `ecological-gameplay.js:296` | "Zona segura de Bacillus: Checkpoint ativado…" | — | — | **REMOVER** (duplica o anterior) |
| `bacillus.mature` | `bacillus-bioprotection.js:198` | "Biofilme maduro de Bacillus…" | science | `structure-biofilm` | Biofilme maduro protege a raiz |
| `bacillus.sporulation` | `:202` | "Esporulação de Bacillus: com pouco carbono…" | science | `organism-bacillus` | Pouco carbono: Bacillus formou endósporos |
| `bacillus.reactivation` | `:206` | "Reativação de Bacillus: novos exsudatos…" | science | `organism-bacillus` | Exsudatos reativaram os endósporos |
| — | `pathogen-survival.js:451` | "Zona segura de Bacillus: um coração…" | — | — | **REMOVER** (animação do coração) |
| `bacillus.j2-repelled` | `pathogen-survival.js:329` | "Biofilme de Bacillus repeliu N J2…" | science | `structure-biofilm` | Biofilme repeliu os J2 grudados |
| `myco.bridge-start` | `mycorrhiza-structures.js:229` | "Micorriza orientada: hifas finas…" | science | `structure-mycorrhiza-path` | Hifas começam a ponte entre as raízes |
| `myco.bridge-ready` | `:363` | "Ponte micorrízica madura…" | hint / campanha | — | Ponte micorrízica pronta: atravesse |
| `pseudo.no-iron` | `pseudomonas-siderophores.js:228` | "Pseudomonas liberou sideróforos, mas não há Fe³⁺…" | hint / fase | — | Sem Fe³⁺ ao alcance da Pseudomonas |
| `pseudo.chelate` | `:259` | "Complexo sideróforo–Fe³⁺ formado…" | science | `process-siderophore` | Sideróforo capturou Fe³⁺ para a colônia |
| — | `phosphate-solubilization.js:582` | "Deposito esgotado…" | — | — | **REMOVER** |
| — | `phosphate-solubilization.js:590` | "Solubilizacao parcial: X%." | — | — | **REMOVER** |

### 4.4 Trichoderma, Rhizoctonia e fungo oportunista

| id | Onde | Texto atual (resumo) | kind / escopo | cardId | Texto novo |
|---|---|---|---|---|---|
| `tricho.rhizoc-detect` | `trichoderma-rhizoctonia-control.js:140` | "Trichoderma reconheceu um foco de Rhizoctonia…" | science | `process-mycoparasitism` | Trichoderma localizou a Rhizoctonia |
| `tricho.coil` | `:233` | "Contato estabelecido: … enovelamento…" | science | `process-mycoparasitism` | Enovelamento: a hifa envolve o patógeno |
| `tricho.mycoparasitism-done` | `:271` e `trichoderma-growth.js:229` | "Micoparasitismo concluído…" (+ "recuperou 14% de vigor…") | science | `process-mycoparasitism` | Micoparasitismo: Rhizoctonia desestruturada |
| `tricho.exhausted` | `trichoderma-rhizoctonia-control.js:188`, `trichoderma-growth.js:195`, `trichoderma-meloidogyne-control.js:172` | "Ataque interrompido…" / "Colônia exaurida…" (3 módulos, mesmo evento) | hint / fase | — | Colônia exausta: dê exsudatos a ela |
| `rhizoc.attack` | `rhizoctonia-control.js:225` | "Rhizoctonia: a borda da colônia lançou uma hifa de ataque…" | danger / fase | `organism-rhizoctonia` | Hifa de ataque! Saia do halo vermelho |
| — | `rhizoctonia-control.js:275` | "Controle de Rhizoctonia: Bacillus…, Pseudomonas…, Trichoderma…" | — | — | **REMOVER** (conteúdo do cartão `organism-rhizoctonia`) |
| `fungus.attached` | `ecological-gameplay.js:165`, `opportunistic-fungus.js:525` | "Contaminação oportunista…" / "Contaminação fúngica…" (mesmo evento) | danger / fase | `organism-opportunistic-fungus` | Hifas grudaram em você: ficou lento |

### 4.5 Meloidogyne

| id | Onde | Texto atual (resumo) | kind / escopo | cardId | Texto novo |
|---|---|---|---|---|---|
| `melo.hatch` | `meloidogyne-lifecycle.js:496` | "Eclosão de Meloidogyne: juvenis J2…" | science | `structure-egg-mass` | Ovos eclodiram: J2 buscam uma raiz |
| `melo.penetration` | `:564` | "Penetração radicular…" | science | `organism-meloidogyne-j2` | Um J2 está penetrando a raiz |
| — | `:576` | "Migração interna…" | — | — | **REMOVER** (coberto por penetração) |
| `melo.feeding-site` | `:596` | "Sítio de alimentação: células gigantes…" | science | `structure-gall` | Células gigantes: a galha se forma |
| `melo.new-eggs` | `:649` | "Nova massa de ovos…" | science | `structure-egg-mass` | Nova massa de ovos: outro ciclo |
| `melo.female-died` | `:667` | "A fêmea morreu de velhice…" | science | `organism-meloidogyne-female` | Fêmea morreu; a galha permanece |
| `melo.female-protected` | `:680` | "Fêmea adulta de Meloidogyne: protegida…" | hint / campanha | — | Fêmea protegida: ataque ovos e J2 |
| `arrival.first` | `pathogen-arrival.js:685` | "Inóculo de Ralstonia atravessando…" / "Juvenis J2 de Meloidogyne entrando…" | danger / fase | — | Ralstonia: `Ralstonia chegando ${where}` · Meloidogyne: `J2 chegando ${where}` |
| — | `pathogen-arrival.js:882` | "J2 aproximando-se da raiz" | — | — | **REMOVER** |
| `survival.j2-carried` | `pathogen-survival.js:300` | "Transporte de J2: o juvenil aderiu à roupa…" | danger / campanha | `organism-meloidogyne-j2` | Um J2 grudou em você: ficou lento |
| `survival.j2-dropped` | `:365` | "Dispersão passiva: um J2 transportado…" | science | `organism-meloidogyne-j2` | O J2 caiu e busca a raiz abaixo |
| `tricho.melo-detect` | `trichoderma-meloidogyne-control.js:127` | "Trichoderma detectou uma massa de ovos…" / "…um J2 livre…" | science | `process-mycoparasitism` | ovo: Trichoderma achou uma massa de ovos · J2: Trichoderma achou um J2 livre |
| `tricho.melo-eggs-done` | `:201` | "Massa de ovos neutralizada…" | science | `structure-egg-mass` | Ovos inviabilizados: geração interrompida |
| `tricho.melo-j2-lysed` | `:219` | "J2 lisado por Trichoderma…" | science | `process-mycoparasitism` | J2 lisado antes de entrar na raiz |

`ORIGIN_LABEL` (`pathogen-arrival.js:373`): encurtar `below` para "por baixo" e `necrotic` para "de tecido necrosado".

### 4.6 Ralstonia

| id | Onde | Texto atual (resumo) | kind / escopo | cardId | Texto novo |
|---|---|---|---|---|---|
| `ralst.entry` | `ralstonia-vascular-wilt.js:1087` | "Entrada de Ralstonia…" | science | `process-ralstonia-entry` | Ralstonia entrou nos vasos da raiz |
| `ralst.vascular` | `:1125` | "Colonização vascular ativa…" | science | `process-vascular-obstruction` | Xilema colonizado: o transporte cai |
| `ralst.critical` | `:1129` | "Murcha vascular crítica: Bacillus e Pseudomonas agora apenas…" | science | `process-vascular-obstruction` | Murcha crítica: prevenir era melhor |
| — | `:974` | "Raiz em murcha crítica: o colapso vascular…" (a cada ciclo de dano) | — | — | **REMOVER** (o dano já comunica) |
| `ralst.focus-role` | `:722` | "Foco superficial: feche a porta…" / "A bactéria já entrou no xilema…" | hint / campanha (id por papel) | `process-ralstonia-containment` no papel `containment` | superficial: Feche a porta antes do xilema · contenção: Já no xilema: agora é conter |
| `ralst.neutralized` | `:867` | "Infecção superficial neutralizada…" | science | `organism-ralstonia` | Neutralizada antes de entrar nos vasos |
| `ralst.contained` | `:882` | "Infecção vascular contida…" | science | `process-ralstonia-containment` | Infecção contida: a raiz segue funcional |
| `ralst.spread-warning` | `:1304` | "Disseminação bacteriana: proteja a raiz marcada…" | danger / always | — | Disseminação! Proteja a raiz marcada |
| `ralst.spread-blocked` | `:1362` | "Disseminação bloqueada: raiz cicatrizada…" / "…proteção biológica…" | science (id por variante) | `process-ralstonia-spread` | cicatrizada: Bloqueada: raiz cicatrizada, sem porta · protegida: Bloqueada pela proteção biológica |
| `ralst.spread-arrived` | `:1394` | "A disseminação chegou: nasceu um novo foco…" | danger / fase | — | Novo foco superficial: ainda dá para prevenir |

### 4.7 Raiz e dano

| id | Onde | Texto atual (resumo) | kind / escopo | cardId | Texto novo |
|---|---|---|---|---|---|
| `root.support-lost` | `root-health-gameplay.js:184` | "A raiz perdeu sustentação…" | science | `process-root-health` | Raiz fraca cede sob seu peso |
| `root.collapse` | `:242` | "Raiz em colapso…" | danger / fase | `process-root-collapse` | Raiz em colapso |
| — | `:243-244` | "Recuperação visível…" / "A raiz melhorou para o estado X." | — | — | **REMOVER** (medidor R e visual) |
| — | `pathogen-survival.js:250` | "X: Miguelito perdeu N corações." | — | — | **REMOVER** (HUD de corações) |
| `survival.defeated` | `pathogen-survival.js:269` | "Miguelito foi vencido por X. Retorno ao último biofilme ativo." | danger / always | — | `Vencido por ${source}` |

## 5. Rótulos no mundo e HUD (classe Estado — sem narrador)

| Onde | Atual | Mudança |
|---|---|---|
| `app.js:1271-1274` `phaseIntroText` | "Desbloqueios desta fase: X. Cada poder só será exigido depois do chunk de aquisição." | `Nesta fase: ${names}` — remover a segunda frase |
| `app.js:1262-1268` `FEATURE_LABELS` | "Solubilizacao de fosfato" | "solubilização de fosfato" (e padronizar minúsculas: "dash") |
| `goal-system.js:124` | subtítulo "Gerando um novo sistema radicular" quando concluída | remover (manter "Alcance o córtex luminoso" antes de concluir) |
| `beneficial-inoculants.js:664-668` | `${short} — ${stage}` + "Fixação associativa de N" (9 px) | só `${profile.short}`; o estágio já está no halo |
| `trichoderma-colonies.js:232-233` | "colônia inoculada / ativa / exaurida" | desenhar só quando `colony.exhausted` ("colônia exausta") |
| `opportunistic-fungus.js:682` | "Vigor fúngico X%" | remover o texto (manter a barra, se desejado) |
| `mycorrhiza-growth.js:380` | "Esporo de micorriza arbuscular" / "Hifas extrarradiculares com tropismo" | "Esporo de micorriza" / "Hifas de micorriza" |
| `nitrogen-root.js:561-563` | "Raiz recebendo N · X%" / "Raiz subdesenvolvida · forme o nódulo na raiz anterior" | com progresso: sem rótulo (a raiz cresce à vista) · sem progresso: "Sem N: nodule a raiz anterior" |
| `phase-one-vertical-slice.js:318,329-330` | "↓ LANCE O EXSUDATO PARA RECRUTAR BACILLUS AQUI" / "↓ ALVO DA FASE — INOCULE BACILLUS AQUI" / "↓ ALVO DA PROVA — FORME O BIOFILME AQUI" | "↓ LANCE EXSUDATO AQUI" / "↓ INOCULE BACILLUS AQUI" / "↓ FORME O BIOFILME AQUI" (as versões atuais passam da largura de um celular em retrato) |
| `ralstonia-vascular-wilt.js:1780` | "Porta aberta / Porta fechando / Entrada bloqueada" sob o estágio | remover o texto; a cor do rótulo de estágio (linha 1775) passa a indicar a porta (mesmas cores de `hud-context.js`) |
| `ralstonia-vascular-wilt.js:1829-1832` | "Contaminação superficial adiante" / "Infecção vascular adiante" | "Ralstonia adiante" |
| `app.js:2022-2031` (alerta) | "Disseminação para raiz adiante · X s" | remover o chip; a contagem já aparece no mundo (`ralstonia-vascular-wilt.js:1876`) |
| `app.js:2032-2038` (alerta) | "Ralstonia: N focos · N contidos · transporte X%" | remover em `.touch-device`; a lista de objetivos já cobre |
| `hud-context.js` (medidor "Antibiose", símbolo A) | mede `trichodermaColonies.vigorAverage` | renomear para "Biocontrole", símbolo "T" (ver 6.1) |

Rótulos que **ficam como estão**: nomes de comunidades e o "Sinal biológico" de micróbio desconhecido, estágios da galha e "ovos N", "N₂ / NH₄⁺" do nódulo, "Escada radicular X%", "ponte micorrízica X%", "Teste/Inocule Azospirillum nesta raiz", "RAIZ PRINCIPAL", selo de papel da Ralstonia (some em 1,2 s) e contagem regressiva sobre a raiz-alvo.

## 6. Correções de conteúdo

1. **Antibiose → Biocontrole.** O medidor mostra o vigor das colônias de Trichoderma, e o mecanismo que o jogo apresenta é micoparasitismo (enovelamento e lise), não antibiose.
2. **Pulso de fósforo** (`campaign-progression.js:284`): "A raiz saudável libera a enzima do pulso…" atribui o efeito à raiz e a uma enzima. Na mecânica, quem carrega o pulso é a cepa solubilizadora, e a solubilização de P inorgânico se deve sobretudo a ácidos orgânicos microbianos. Com a seção 4.1 esse `desc` deixa de ser exibido; se ele não for usado em nenhum outro lugar, remover os campos `desc` de `unlockEvents` (linhas 266-289) em vez de mantê-los desatualizados.

## 7. Testes

Novo `tests/narrator.test.js`:

- Todo texto do catálogo tem ≤ 60 caracteres (funções testadas com parâmetros de pior caso: maior `source`, maior `where`, maior `missing`, maior `names`).
- Todo `science` tem `cardId`, e todo `cardId` existe em `tutorial-registry.js`.
- `science` aparece uma vez por campanha; sobrevive a `campaignSnapshot` → `createCampaign`; `resetCampaign` zera.
- `hint` com escopo de fase volta após `resetPhase()`.
- `science` não aparece quando o cartão correspondente está aberto ou pendente, e fica marcado como dito.
- Nada sobrescreve uma mensagem antes do tempo mínimo, exceto `danger`.
- Mensagem interrompida antes de 1,5 s não é marcada como dita.
- A fila respeita a prioridade e descarta itens expirados.
- `narrate()` sem narrador registrado mantém o comportamento antigo.

Existentes a observar:
- `tests/azospirillum-mycorrhiza.test.js:520` e `tests/phase-one-vertical-slice.test.js:241` usam `state` literal. Passam pelo caminho sem narrador, desde que os textos "Co-inoculação: FBN potencializada" e a mensagem da guarda continuem sendo repassados sem alteração.
- `tests/tutorial-runtime.test.js:596`: `toastTime` não muda com cartão aberto. `narrator.update` só roda quando o mundo avança.
- `tests/phase-finale.test.js:495`: `#toast` não pode ser escondido na cinemática.

`npm test` verde em todos os commits.

## 8. Ordem de commits

1. Narrador, catálogo, UI com ◈, persistência e `tests/narrator.test.js` (nenhum módulo migrado ainda).
2. Migração por grupo, um commit por grupo: 4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6 → 4.7.
3. Rótulos e HUD (seção 5).
4. Correções de conteúdo (seção 6) e `docs/narration.md`, descrevendo as classes e como adicionar uma mensagem (o `AGENTS.md` pede atualizar `docs/` quando a mecânica muda).
5. `npm run build` e push, para testar pelo GitHub Pages.

## 9. Critérios de aceite

- Rejogar uma fase já concluída na mesma campanha: nenhum toast de ciência; só perigo e instruções de falha.
- Celular em retrato: nenhum toast passa de 2 linhas.
- Nenhuma mensagem some antes do tempo mínimo, exceto quando um perigo a substitui.
- Tocar em ◈ pausa o jogo e abre o cartão correto no GUIA.
- Fim de fase: o placar aparece uma única vez, no cartão da cinemática.
- Nenhuma string visível com jargão de desenvolvimento ou sem acento.
