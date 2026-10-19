# Continuidade para Claude: fungo oportunista da fase 5

Registro em 19/10/2026. Este arquivo deve ser atualizado a cada checkpoint.
O usuário pediu que a continuidade não dependa do histórico do chat.

## Pedido e limites

Melhorar exclusivamente crescimento, colonização, maturação e regressão visual
do micélio oportunista da fase 5. Preservar **todos os sprites**, raízes, cenário,
danos, contaminação, dificuldade, objetivos, controle biológico, áudio e RNG.
Não produzir uma demonstração separada nem trocar a arte. Capturar no jogo real:
início/ramificação, rede madura/esporos, inibição por Pseudomonas e contato,
enovelamento/lise por Trichoderma. Permanecer em branch experimental.

## Git e execução

- Repositório: `MarcoAntonioBarreiros/Miguelito-e-o-feij-o`.
- Branch: **`experiment/opportunistic-organic-mycelium`**.
- Base da main: **`e1a84c246b6a885ddecb894811e6e44c6d7cb88a`**.
- Checkout: `C:/Users/marco/Documents/Codex/2026-10-17/acesse-o-reposit-rio-https-github/work/miguelito-opportunistic-mycelium`.
- Não integrar a branch Rhizo inteira: seu experimento tem uma base anterior.
  Apenas reutilizamos princípios de desenho passivo e enovelamento apoiado em
  hifas reais. Nenhuma correção biológica da Rhizo é necessária para esta tarefa.
- Não alterar main, não force-push, não substituir main por checkout antigo.

Leia AGENTS.md. Gerar dist somente por `npm run build`. Preview integrado:
`node scripts/preview-opportunistic.cjs`, porta 4187, página
`http://127.0.0.1:4187/experiments/opportunistic-mycelium/`.

## Fontes reais e implementação

`opportunistic-fungus.js` mantém a biologia original: segmentos de 3,3 px,
4,6 iterações/s multiplicadas por `response.growth`, 140 segmentos / 10 pontas
por foco. Cada zona agrupa vários agentes em uma rede. `lesion.reached` passa
a true e `lesion.maturity` a 1 no encontro; não alteramos esse marco mecânico.
Esporos reais são criados a partir de lesões alcançadas, após 34 segmentos,
até 12 por foco. Seus trajetos, colisões e vida são preservados.

Pseudomonas captura Fe³⁺ de depósitos reais por sideróforos e publica
`agent.ironLimitation`. `fungalResponse` já determina vigor, crescimento,
ramificação, esporulação e adesão, com vigor mínimo .25. Ferro limita, mas não
elimina o fungo. Não transformar baixa disponibilidade de ferro em lise.

Trichoderma genérico (`trichoderma-growth.js`) tem rede por agente-alvo:
`metadata.contact`, `contactLocked`, `lysis`, estágios e remoção do agente em
`completeAttack`. Em um foco com quatro agentes, eliminar um não elimina os
outros três. O visual usa fração de agentes removidos e lise atual ponderada;
não inventa redução de `response.vigor` nem altera recompensas/objetivos.

Novo `src/render/opportunistic-mycelium.js` guarda somente apresentação em
WeakMap. Usa segmentos/pontas reais, interpolação entre pontos já existentes,
curvas suaves, variação de largura/transparência e paleta rosada terrosa.
Mapeia o desenho para `visibleRootRect`, sem alterar colisões. Pontos alcançados
amadurecem visualmente com a resposta real de crescimento; vigor de exibição
acompanha suavemente o vigor real. Cada esporo desenhado continua sendo uma
entidade real, inclusive durante controle; não esconder perigos para simular
uma redução de esporulação que a biologia não produziu.

APIs: `syncOpportunisticVisual`, `opportunisticVisualSnapshot`,
`opportunisticContactPaths`, `drawOpportunisticMycelium`. Sem RNG global nem
consumo de `network.random`. `opportunisticFungus.visualSnapshot(networkOuKey)`
e `contactPaths(targetId)` fornecem diagnóstico/caminhos de leitura.

Novo `src/render/opportunistic-mycoparasitism.js` apoia hélices de Trichoderma
em caminhos reais, proporcionais ao contato/lise. A haste de busca permanece;
apenas a representação orbital genérica foi substituída. `trichoderma.networks`
expõe array para leitura; `setTargetVisualProvider` conecta os dois desenhos.
`simulator.js` faz essa ligação sem mudar ordem do loop. `hyphal-growth.js`
recebe somente opções de render optativas; seus defaults e update são iguais.

## Estado deste checkpoint

- Código principal implementado; ainda conferir aparência no navegador.
- **107 testes dirigidos aprovados**, incluindo invariância de 2.500
  passos de controles reais com desenho ligado/desligado. Esse harness usa
  colônias de fixture; não substitui o playtest integrado da fase 5.
- Preview/QA e testes de maturação adicionais em preparação. **Não declarar
  capturas, build final ou validação WebGL concluídos antes de executá-los.**
- Pendências: playtest real com Pseudomonas e Trichoderma, capturas/JSON,
  testes relacionados, build, smoke global, revisão de orçamento e diff.

**Particularidade da campanha:** a fase 5 remove Trichoderma dos encontros;
ele estreia na fase 6. Portanto o ensaio Pseudomonas usa a fase 5 normal, e o
ensaio Trichoderma usa um preset explicitamente identificado no preview que
acrescenta o organismo de teste e usa recrutamento/inoculação e controle reais.
Não adicionar Trichoderma à campanha publicada para obter a captura. Registrar
o fixture no JSON e nas legendas, sem apresentá-lo como roteiro normal da fase 5.

## Como continuar e eventualmente publicar

1. Conferir `git status`, `git log -1` e os arquivos desta branch. A documentação
   técnica fica em `docs/opportunistic-organic-mycelium.md`.
2. Gerar dist e abrir o preview. Usar atalhos apenas para mover Miguelito;
   coletar/recrutar/inocular pelos controles reais, sem editar vigor, estoques,
   danos, objetivos, taxa biológica ou HP para produzir evidência.
3. Conferir `visualSnapshot` versus `response`, número de segmentos/esporos,
   lesões alcançadas, ferro/reserva férrica e metadados de Trichoderma. Guardar
   capturas e relatório JSON versionados em `docs/evidence/opportunistic-mycelium/`.
4. Rodar testes novos, fase 5, hifas/limites, sprites, áudio e objetivos. Rodar
   `node tests/browser-smoke.cjs`; relatar falhas/timeout em vez de afirmar
   aprovação global. Não corrigir sistemas não relacionados só para passar.
5. Revisar diff: nenhuma imagem substituída, nenhuma regra biológica alterada,
   nenhum consumo extra de RNG. Commit/push nesta branch, atualizar este MD.
6. A publicação não foi solicitada neste pedido: manter experimental. Se o
   usuário posteriormente aprovar publicar, atualizar origin/main e integrar
   preservando seus commits novos, reconstruir dist, repetir a fase 5 e testes,
   fazer push normal e acompanhar `.github/workflows/deploy-pages.yml`.

Para reverter uma publicação futura, reverter somente o commit de integração
desta entrega. Nunca voltar a main inteira até a base antiga.
