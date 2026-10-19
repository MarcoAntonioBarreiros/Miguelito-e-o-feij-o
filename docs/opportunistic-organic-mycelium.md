# Micélio orgânico do fungo oportunista — fase 5

Branch experimental: `experiment/opportunistic-organic-mycelium`. Base inspecionada: `e1a84c2`, versão de `main` encontrada ao iniciar este trabalho. Esta tarefa não autoriza publicar a branch nem misturar as experiências anteriores de Rhizoctonia automaticamente.

## Estado biológico que deve continuar sendo a autoridade

O sistema real fica em `src/procgen/opportunistic-fungus.js`. Cada grupo de agentes `oportunista` compartilha uma rede com `segments`, `tips`, `lesions`, `spores`, uma raiz hospedeira e um gerador aleatório determinístico próprio. As hifas reais já são persistentes: os segmentos antigos não são recalculados. O alongamento ocorre em incrementos de 3,3 unidades, num acumulador de 4,6 passos por segundo multiplicado pela resposta de crescimento, respeitando o orçamento existente de 140 segmentos e 10 pontas.

As respostas a `agent.ironLimitation` são calculadas por `fungalResponse`: `vigor`, `growth`, `branching`, `sporulation` e `adhesion`. A média da limitação entre os agentes do foco determina a resposta da rede. As colônias de Pseudomonas só aplicam pressão real se houver reserva de ferro capturado, vigor e alcance espacial. A simples presença de um halo não deve ser interpretada como controle completo.

A inibição por ferro não elimina o fungo: o vigor mínimo configurado é 0,25. Uma representação visual correta preserva as hifas formadas, reduz o brilho e a atividade apical e acompanha a menor taxa real de produção de esporos. Não deve inventar morte, remover colisões nem zerar a biomassa.

A produção de esporos já usa `response.sporulation`, o número de lesões alcançadas, um acumulador, o mínimo de 35 segmentos e o teto de 12 esporos por foco. Os mesmos esporos participam da contaminação do jogador. A renderização deve mostrar esses objetos reais, sem gerar substitutos decorativos que alterem o entendimento da atividade biológica.

Os pontos de colonização existentes passam `reached` para verdadeiro e `maturity` para 1 no instante de chegada. Essa maturidade também é um estado legado; a melhoria visual interpola a aparência após a chegada sem retardar a interação, os esporos ou qualquer objetivo. Pontos ainda não alcançados não devem parecer lesões completas. A expansão precisa permanecer na faixa da própria raiz hospedeira, nunca construir pontes entre plataformas.

## Trichoderma: contato, enovelamento e regressão

O ataque genérico contra o oportunista fica em `src/procgen/trichoderma-growth.js` e reutiliza `hyphal-growth.js`. A rede antagonista publica `metadata.targetId`, `contactLocked`, `contact`, `lysis`, `stage`, `completed`, `aborted` e `exhausted`. O contato e a lise são estados reais; o sistema de desenho deve lê-los, sem acelerar o ataque, aumentar o combustível, modificar o vigor da colônia nem mudar os limiares.

Na conclusão, o sistema remove um agente do foco de cada vez. Portanto uma rede com vários agentes não deve desaparecer integralmente ao terminar o primeiro ataque. A regressão visual precisa ponderar os agentes restantes e a lise dos alvos efetivamente atacados. A informação de conclusão pode permanecer como resíduo visual do mesmo evento durante a transição; isso não cria uma nova população nem mantém um foco biologicamente ativo.

Os enovelamentos devem ficar apoiados nas hifas oportunistas existentes. Não podem ser órbitas circulares ao redor do sprite. O trajeto de busca e seus tempos continuam sendo os do ataque real; a apresentação local do contato pode se adaptar ao substrato micelial sem modificar as posições usadas nas regras de combate.

## Limites de escopo

- Preservar integralmente os sprites e sua animação; a película de colonização e os filamentos são camadas adicionais sobre a raiz original.
- Não alterar taxas de dano, contaminação, aderência, recuperação do jogador, esporulação biológica, marcos de controle, objetivos ou dificuldade.
- Não consumir aleatoriedade global no desenho nem avançar o gerador `network.random` da simulação.
- Não alterar os perfis de micorrizas ou Trichoderma em `hyphal-growth.js` para obter um efeito visual localizado no oportunista.
- Cores magenta/vinho dessaturadas e filamentos de espessura variável substituem a bainha neon; nada de chuva permanente de partículas.
- Caches de desenho e diagnósticos devem ser externos ao estado biológico e ter orçamento limitado por foco.

## Validação

O teste específico `tests/opportunistic-mycelium-visual.test.js` cobre associação a crescimento, maturação e lise, preservação da geometria já construída e invariância da simulação com o desenho ativado ou desativado. Os testes existentes de fase 5, limites verticais das hifas, áudio biológico, sprites e objetivos devem continuar passando.

Executado com sucesso em 19/10/2026: `node --test tests/opportunistic-mycelium-visual.test.js`, **7 testes aprovados**. Um deles executa 2.500 passos a 60 Hz nos controladores reais de fungo, sideróforos e Trichoderma, com dois agentes em um mesmo foco. O ensaio compara desenho ligado/desligado e exige igualdade exata de estados, contaminação, dano, esporos, recursos, marcos de controle, vigor das colônias, eventos de áudio e consumo do RNG. Também confirma que houve rede estabelecida, esporulação, pressão de ferro real e eliminação por Trichoderma; não é uma comparação em um estado inerte. As colônias e os depósitos são condições iniciais do fixture de teste. Esse ensaio isolado não é apresentado como uma partida completa no navegador.

Os outros testes verificam pureza do desenho e dos diagnósticos; interpolação apical limitada a segmentos existentes e à superfície da raiz; maturação visual contínua de uma lesão que acabou de ser alcançada; perda gradual de vigor sob limitação de ferro sem lise inventada; regressão proporcional a cada agente realmente atacado/removido; e ausência de falsa lise em ataques abortados ou exauridos.

O ensaio no navegador precisa registrar os estados reais junto às capturas: número de segmentos/pontas, lesões alcançadas, esporos, respostas `vigor/growth/branching/sporulation`, média da limitação de ferro e `contact/lysis` dos ataques. Separar a prova de inibição por Pseudomonas da prova de lise por Trichoderma evita atribuir regressão ao mecanismo errado. As capturas precisam vir do jogo integrado da fase 5, e não de uma cena sintética.

Resultados executados e instruções de continuidade são registrados no manifesto da raiz do repositório. O documento deve distinguir testes unitários, ensaio integrado de controladores e validação visual no navegador; nenhum desses substitui silenciosamente os outros.
