# Miguelito: decisão técnica para a rizosfera 2,5D

Análise do código em **17/10/2026**, baseada no commit [`f118a303f6cefb2c20d77ff4bf23826fbcd31005`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/tree/f118a303f6cefb2c20d77ff4bf23826fbcd31005). As referências abaixo são fixadas nesse commit. Este documento distingue capacidades documentadas, achados de código, testes executados e estimativas; não transforma uma capacidade de engine em resultado visual medido.

**Recomendação de arquitetura:** manter a simulação JavaScript e evoluir a apresentação com Three.js, usando personagens e microrganismos como planos animados com os PNG originais. Isso atende profundidade, luzes, materiais e raízes com volume sem exigir personagens tridimensionais. A Unity URP tem ferramentas artísticas fortes, mas seu benefício precisa superar uma migração de física, geração, microbiologia, tutorial, áudio e testes. A auditoria não encontrou uma limitação estrutural que obrigue essa migração.

## O que realmente existe no repositório

O jogo usa Canvas 2D e módulos ES, sem dependências de produção declaradas. Há um protótipo fixo antigo e uma campanha procedural mais extensa. A entrada publicada usa a variante procedural: o workflow constrói `dist/index.html`, copia os assets e publica pelo GitHub Pages quando há push em `main`. Assim, a experiência experimental deve permanecer em entrada e branch próprias, sem executar o workflow de publicação. Ver [`package.json`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/package.json#L5), [`deploy-pages.yml`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/.github/workflows/deploy-pages.yml#L3) e [`AGENTS.md`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/AGENTS.md#L5).

Inventário local, sem contar `dist/`, cópias HTML legadas ou bibliotecas externas:

| Conjunto | Arquivos | Linhas físicas |
|---|---:|---:|
| `src/**/*.js` | 137 | 54.115 |
| `src/procgen/**/*.js` — subconjunto de `src` | 104 | 44.549 |
| `src/render/**/*.js` — subconjunto de `src` | 17 | 6.125 |
| `tests/**/*test.js` | 70 | 24.609 |

Linhas físicas incluem comentários e linhas vazias: são uma medida de dimensão, não uma estimativa automática de horas. `assets/` contém **106 arquivos / 60,30 MiB**, sendo **21 PNG**, **79 OGG**, três TTF e três arquivos de documentação/texto. Os 79 OGG somam aproximadamente 29,30 MiB. Esses totais representam arquivos de origem, não transferência comprimida nem memória de GPU.

O manifesto contém **dez fases principais e um prólogo**, não dez cenas estáticas independentes: há trechos autorais, trechos procedurais, desbloqueios, encontros e desafios de validação. A fase 4 introduz micorriza; a fase 7 trata fósforo; a fase 9 traz Ralstonia; a fase 10 integra o ecossistema. Ver [`campaign-manifest.js`, fases 1–4](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/campaign-manifest.js#L279), [fases 5–8](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/campaign-manifest.js#L506) e [fases 9–10](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/campaign-manifest.js#L712).

## Reaproveitamento e acoplamentos

O melhor ponto de integração é `createSimulator()`: reúne estado, inputs, física e sistemas biológicos, oferece `setInputs()` e `step(dt)` e permite áudio silencioso nos testes. Sua sequência de atualização é relevante: prepara recursos, atualiza física, ecologia, inoculantes, nitrogênio, fósforo, patógenos e objetivos em uma ordem explícita. Trocar de renderer não exige alterar essa ordem. Ver [`simulator.js`, construção](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/simulator.js#L83) e [`step(dt)`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/simulator.js#L403).

Entretanto, **não basta substituir `renderer.js`**. A busca por chamadas diretas de Canvas encontrou 28 módulos de `src/procgen/` que também desenham: entre eles micorriza, Trichoderma, raízes de Azospirillum, galhas, Ralstonia, nodulação, fósforo e ecologia. O compositor chama esses renderizadores separadamente em [`app.js`, `renderWorld()`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/app.js#L1882). Além disso, algumas redes de hifas ficam em closures; os getters públicos mostram contagens, mas não todos os pontos. Ver [`mycorrhiza-growth.js`, retorno público](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/mycorrhiza-growth.js#L392) e [`trichoderma-growth.js`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/trichoderma-growth.js#L506).

A modernização precisa de uma interface visual pequena, que exponha geometrias e estados para leitura e mantenha a simulação como dona deles. Evitar mover regras para shaders. O crescimento renderizado deve consumir pontos, maturidade e contatos calculados pelo sistema biológico; o mesh decorativo não pode virar a nova fonte de colisões ou antecipar uma ponte jogável.

| Subsistema | Modernização WebGL | Migração Unity URP |
|---|---|---|
| PNGs e OGGs | Reutilização direta dos arquivos | Reimportação dos mesmos arquivos; ajustar importadores, compressão, slices e atlas |
| Catálogos de sprites | Reutilizar metadados e seleção; adaptar a atualização de UV | Exportar metadados para assets/JSON e recriar player de animação em C# |
| Física e controles | Conservar `physics.js`, inputs e caixas | Portar algoritmo e semântica para C#; não substituir automaticamente por `Rigidbody2D` |
| Dez fases e geração | Conservar módulos JS e validadores | Exportar dados puros; portar gerador, validadores e integrações; não recriar dez mapas à mão |
| Microbiologia | Conservar `update(dt)` e estado; extrair adaptadores de render | Portar estados, regras, ordem de atualização e testes de comportamento |
| Hifas e raízes | Reusar os algoritmos; representar pontos por fitas/meshes, com orçamento | Portar algoritmos; gerar meshes/ribbons; preservar relações com pontes e contatos |
| HUD e tutoriais | Preservar HTML/CSS, cartões e fluxo, com ajustes de câmera | Recriar interface e interações em UI Toolkit/uGUI ou manter overlay web com integração adicional |
| Áudio | Reutilizar Web Audio, manifestos e eventos | Manter arquivos; reimplementar mixagem, prioridades, desbloqueio web, transições e gatilhos |
| Saves | Conservar chave/formato e semântica | Importar/validar save existente ou oferecer migração explícita; PlayerPrefs não lê automaticamente o save atual |
| Testes Node | Permanecem úteis e executáveis | Converter testes para C#/Unity e usar fixtures JS como referência diferencial |

### A física é parte do gerador

Há caixa de colisão de **32 × 48**, movimento horizontal calibrado até **245 px/s**, gravidade **1.180 px/s²** e velocidade vertical limitada a **720 px/s**. O código inclui aceleração, coyote time, jump buffer, salto duplo, dash, mochila, colisões e respawn. A arte é normalizada separadamente da caixa. Ver [`player-sprite.js`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/render/player-sprite.js#L66) e [`physics.js`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/physics.js#L235).

O gerador mede primitivas de movimento executando **esse simulador a 60 Hz** e usa agentes para validar travessias. Uma física Unity apenas “parecida” pode invalidar uma fase procedural: obstáculos que eram alcançáveis podem deixar de ser. Ver [`primitives.js`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/primitives.js#L1), [`agents.js`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/agents.js#L1) e [`traversal-edge-physics.js`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/traversal-edge-physics.js#L42).

O loop de jogo atual usa `dt` variável limitado a 0,1 s, enquanto validadores usam 1/60 s. Uma evolução visual deve inicialmente conservar essa política; adotar passo fixo em toda a campanha seria uma mudança adicional que exige regressão própria. Ver [`app.js`, loop](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/app.js#L1943).

### Arte e animação que já podem ser preservadas

Miguelito tem quatro PNGs de **2.560 × 400**, oito quadros de **320 × 400** por folha: idle, run, hurt e celebrate. Defeat reutiliza hurt com um quadro de retenção. Estados sem folha têm fallback; não se deve anunciar uma animação própria de pulo/dash que o acervo ainda não contém. Os metadados registram `baseline`, `contentHeight`, fps e normalização — idle ocupa 224 px do quadro e run 347 px. Copiar apenas o recorte sem esses dados faz o personagem variar de tamanho e flutuar. Ver [`player-skins.js`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/render/player-skins.js#L21) e [`player-sprite.js`, fase de animação](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/render/player-sprite.js#L126).

As nove folhas principais de organismos usam a mesma célula de 320 × 400. A maioria tem 12 quadros; micorriza e Pseudomonas têm 24, em folhas de **7.680 × 400**. Bacillus tem outro formato, com recorte próprio. Ver [`organism-sprites.js`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/render/organism-sprites.js#L1) e [`bacillus-sprite.js`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/render/bacillus-sprite.js#L1).

Para dispositivos cujo tamanho máximo de textura não comporte 7.680 px, reempacotar os quadros em múltiplas linhas sem reamostrar os pixels. Consultar a capacidade real no WebGL; na Unity, evitar reduzir a folha inteira pelo `Max Size` de importação. Preservar pixels não exige preservar o arranjo horizontal do arquivo no atlas de GPU.

O repositório **não contém normal maps identificados no inventário**. Eles precisam ser produzidos como assets complementares: primeiro para solo e raízes, onde trazem mais retorno; depois para personagens, caso a iluminação justifique. Converter luminância diretamente em altura é aproximação, pois cor de roupa e contorno não são relevo. Validar mapas por quadro para não haver cintilação, manter luz ambiente suficiente e limitar especularidade para preservar a ilustração.

### O motor atual já tem atmosfera e crescimento

Já existem paralaxe, feixes, partículas, halos, sombra de contato, camada de escuridão em 1/4 da resolução e primeiro plano. São composições de Canvas, não um pipeline PBR com normais e mapas de sombra. A evolução precisa superar esse patamar real, não comparar com um suposto Canvas sem efeitos. Ver [`rhizosphere-lighting.js`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/render/rhizosphere-lighting.js#L1) e [`rhizosphere-parallax.js`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/render/rhizosphere-parallax.js#L1).

Hifas já têm crescimento de pontas, ruído suave, tropismo, ramificação, contatos e limites de orçamento: micorriza usa por padrão até 18 ramos/430 pontos; Trichoderma, 24/560. Isso pode alimentar uma fita em WebGL com largura e cor por maturidade. Não há necessidade de reinventar o algoritmo como animação de partículas. Atenção: embora o gerador de fases tenha PRNG próprio, o crescimento usa `Math.random()` em vários pontos; não há determinismo integral de toda a biologia apenas escolhendo a seed da fase. Ver [`hyphal-growth.js`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/hyphal-growth.js#L19) e [`random.js`](https://github.com/MarcoAntonioBarreiros/Miguelito-e-o-feij-o/blob/f118a303f6cefb2c20d77ff4bf23826fbcd31005/src/procgen/random.js#L1).

## Comparação das alternativas

Esta tabela compara adequação técnica ao projeto. Nenhuma linha afirma FPS, tempo de carregamento ou superioridade visual que não tenha sido medido nas demonstrações.

| Critério | PixiJS | Three.js | Unity URP |
|---|---|---|---|
| Sprites originais | Muito natural: sprites, atlas, ordenação e batching | Planos com UV animada; exige controle de transparência, âncora e materiais | SpriteRenderer/quad, Sprite Atlas e clips; exige reproduzir metadados atuais |
| Profundidade | Camadas/paralaxe e deformações; volume requer shader/mesh específico | Geometria de cenário, câmera ortográfica e planos em Z de forma direta | 2D Renderer ou Forward com cenário volumétrico e câmera ortográfica |
| Luz e normal maps | Exige pipeline adicional/customizado e verificação de versão dos plugins | Materiais e luzes integrados; shaders próprios para arte ilustrada quando necessário | Ferramentas integradas para luzes, sombras, normal maps e pós-processamento |
| Sombras | Contato/silhueta customizados; não assumir sombra 3D pronta | Mapas de sombra para meshes; sprite recortado requer alpha test/depth material coerente | ShadowCaster2D no 2D Renderer ou sombras de meshes no Forward; são pipelines distintos |
| Hifas e raízes | Fitam-se bem em meshes 2D; programar extrusão/luz | Ribbons/tubos e normais, mantendo simulação 2D | Meshes procedurais/C#, Shader Graph; portar algoritmo antes de validar comportamento |
| Desempenho potencial | Bom para muitos sprites com batching; filtros/overdraw cobram custo | Flexível; limitar draw calls, luzes com sombra, transparência e reconstrução de geometria | Ferramentas de profiling e batching; runtime/URP também exigem orçamento de fill rate e luzes |
| Desenvolvimento | Menor distância conceitual do Canvas; mais trabalho no pipeline de luz avançada | Melhor ajuste para o conjunto de prioridades visuais desta POC | Editor favorece iteração artística; maior distância da simulação atual |
| Manutenção | Uma linguagem; dependência de filtros/plugins deve ser controlada | Uma linguagem; renderer e shaders adicionais sob responsabilidade do projeto | C# mais assets/configuração/editor; duplicar JS+C# durante migração aumenta manutenção |
| Web | Deploy estático, HUD DOM, integração com página existente | Deploy estático; WebGL2 nas versões atuais; fallback/erro amigável em contexto indisponível | Build WebAssembly/arquivos de dados, importação e configuração de servidor; validar plataforma-alvo |
| Preservação mecânica | Reuso direto do JS | Reuso direto do JS | Portabilidade dos dados; código de mecânicas precisa migração e regressão |

**Por que Three.js nesta prova:** a prioridade inclui materiais com normais, luzes, sombras e volume orgânico, além de sprites. `MeshStandardMaterial` tem suporte a normal map e rugosidade; normal map muda a iluminação, não a silhueta. O `WebGLRenderer` atual usa WebGL2 e não suporta WebGL1 desde r163. Instâncias podem reduzir draw calls para geometria repetida. Esses recursos favorecem um cenário em camadas com personagens ilustrados, mantendo colisões em X/Y. Ver [material oficial](https://threejs.org/docs/pages/MeshStandardMaterial.html), [renderer oficial](https://threejs.org/docs/pages/WebGLRenderer.html) e [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).

**Quando escolher PixiJS:** se o alvo final privilegiar sprites numerosos, câmera estritamente 2D e luzes estilizadas em poucos passes. A documentação recomenda spritesheets e alerta para custo de filtros e quebras de batching por blend modes. O plugin público `@pixi/lights` documenta diffuse/normals/lights em três camadas; seu `package.json` consultado declara peers `@pixi/* ^7.0.0` e `@pixi/layers ^2.0.1`. Não se deve presumir que seja um componente pronto e compatível com Pixi v8: fixar uma combinação validada ou implementar um pipeline v8 próprio é parte do esforço. Ver [performance PixiJS v8](https://pixijs.com/8.x/guides/concepts/performance-tips), [plugin Lights](https://github.com/pixijs-userland/lights) e [dependências do plugin](https://raw.githubusercontent.com/pixijs-userland/lights/main/package.json).

## O que a Unity ofereceria e o que precisaria ser portado

Na Unity 2022.3, a referência coerente é **URP 14**, correspondente à geração do Editor instalado nesta sessão. O **2D Renderer** permite sprites iluminados, texturas secundárias de normais/máscaras, `Light2D`, sombras de `ShadowCaster2D` e volume de luz. Essas capacidades são documentadas; mapas secundários devem estar alinhados às mesmas UVs dos sprites. Ver [texturas secundárias URP 14](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/SecondaryTextures.html), [propriedades de Light2D](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/2DLightProperties.html) e [ShadowCaster2D](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/2DShadows.html).

Para uma cena com raízes em tubos, solo em relevo e sombras com profundidade, **URP Forward com quads animados** é outra opção válida. Ela preserva sprites e permite usar materiais/iluminação 3D no ambiente. Não confundir `Light2D`/`Sprite-Lit-Default` com o sistema Forward: escolher o renderer por câmera e material, verificando compatibilidade, é decisão de implementação. Um cenário só de planos pode usar o 2D Renderer com menos customização; uma cena com bastante volume pode favorecer Forward.

Uma migração séria teria estes componentes:

1. **Camada de dados:** exportar manifesto das fases, catálogo microbiológico, tuning, sprites e áudio para formatos de dados. Preservar identificadores e chaves do save. Gerar uma fase em JSON é útil para comparar uma cena, mas não equivale a portar geração procedural em runtime.
2. **Núcleo C# testável:** portar física e PRNG com aritmética de 32 bits equivalente a `Math.imul`/operações bitwise, manter referência entre hospedeiro e colônia e respeitar a ordem de atualização do simulador. Adotar `double` onde for necessário para a comparação; não pressupor equivalência numérica automática.
3. **Biologia:** portar nodulação/FBN, raízes de Azospirillum, micorriza, Trichoderma, sideróforos, Bacillus, fósforo, fungos, Meloidogyne, Ralstonia, patógenos, recuperação e pontuação. Os sistemas incluem preparação e atualização em momentos diferentes; copiar somente a fórmula central omite interações.
4. **Geração e validação:** portar grafo lógico, montagem geométrica, planejamento vertical, rotas, desvios opcionais e agentes que comprovam travessia. Validar múltiplas seeds das dez fases.
5. **Apresentação:** importer e atlas, animação com os mesmos anchors/baselines/fallbacks, meshes de crescimento, câmera, luzes, UI, cartões, input móvel e áudio.
6. **Paridade:** executar fixtures de input/tempo em JS e C#, comparar posição/velocidade/eventos/objetivos/recursos e depois percorrer as dez fases. Ganho visual sem essa paridade não preserva o jogo.

Uma ponte `.jslib` que mantenha a simulação JavaScript fora da Unity poderia reduzir a primeira portabilidade no WebGL, mas criaria dois runtimes, contratos de dados e integração específica da web. Transferir o mundo inteiro como JSON a cada frame seria especialmente inadequado. Isso não deve ser apresentado como migração simples nem resolve distribuição nativa.

A documentação **específica de Unity 2022.3** informa limitações de áudio WebGL, ausência de threads C# e ausência de suporte oficial a dispositivos móveis nessa versão. O alvo móvel precisa de validação concreta ou outra versão do Editor; não transferir afirmações de Unity 6 para o Editor 2022.3 instalado. Ver [overview oficial WebGL 2022.3](https://docs.unity3d.com/2022.3/Documentation/Manual/webgl-technical-overview.html). Isso não prova que uma build falhe em todo celular; delimita suporte e risco.

## Estimativa de esforço e critério de decisão

Estimativas de engenharia, **não medições desta sessão**, para uma pessoa experiente na tecnologia escolhida, trabalhando com o acervo existente e sem criar novos personagens. Um dia corresponde a aproximadamente seis horas de trabalho técnico concentrado. Incluem integração e regressão; não incluem expansão de conteúdo, retrabalho de arte extenso, acessibilidade completa nem certificação de plataformas.

| Escopo depois da POC | Faixa plausível | Premissas e maior incerteza |
|---|---:|---|
| Integrar Three.js a uma fase representativa com física/biologia existentes | 5–12 dias | Adaptadores de render, materiais, recortes, câmera, orçamento de crescimento e regressão |
| Levar a apresentação WebGL às dez fases, com níveis de qualidade e testes web | 15–35 dias adicionais | Abranger 28 módulos que desenham e validar efeitos/legibilidade em várias máquinas |
| Cena PixiJS com luz avançada e normais equivalentes | 6–15 dias | Compatibilidade do pipeline de iluminação é a maior incerteza; efeitos simples são mais baratos |
| Vertical slice Unity com física fiel e subset biológico comparável | 15–30 dias | Importação, C#, dados e testes de paridade; uma cena decorativa custa menos e prova menos |
| Migração Unity de toda a campanha com regressão | 50–100 dias no total | Aproximadamente 10–20 semanas; regras cruzadas, geração, UI/áudio/saves e dez fases dominam |

As faixas não devem ser somadas como um orçamento fechado nem deduzidas apenas do número de linhas. Um inventário de testes e um piloto de paridade de física refinariam a estimativa. A migração integral não foi iniciada.

**Gate recomendado:** continuar com o renderer WebGL se ele atingir a linguagem artística desejada em uma cena jogável e se o tempo de frame permanecer dentro do orçamento nos dispositivos-alvo. Só reabrir a migração se uma POC Unity equivalente produzir vantagem material repetível — por exemplo, tempo menor de criação de cenas para a equipe, efeitos essenciais inviáveis no orçamento web escolhido ou demanda confirmada por plataformas nativas — suficiente para pagar a portabilidade e sua regressão.

O teste comparável deve fixar câmera, resolução e DPR, quantidade de organismos/hifas/partículas, número de luzes e sombras, qualidade das texturas e percurso de input. Após aquecimento, medir ao menos 60 s: mediana e p95 de tempo de frame, draw calls, triângulos, memória/transferência, carregamento e eventuais pausas de geração. Registrar hardware/browser e se a GPU é por software. A média de FPS exibida em uma única máquina não estabelece superioridade entre engines. Em 60 fps o orçamento total é 16,7 ms; em 30 fps, 33,3 ms. Esses números são metas aritméticas, não resultados do jogo.

## Resultado concreto da tentativa Unity

Foi encontrado **Unity Editor 2022.3.44f1**, com módulos Windows e WebGL, e **URP 14.0.11**. O projeto experimental está em [`unity/`](unity/README.md), incluindo sprites originais, scripts C#, configuração de packages e ferramentas para preparar a cena/build. É um estudo visual da rizosfera; não contém a física nem a microbiologia portadas.

A tentativa real de executar o Editor em batchmode foi interrompida **antes da importação/compilação do projeto**, por licença inválida: o log registra `Machine bindings don't match`, `Token not found in cache` e `No valid Unity Editor license found`. A evidência está em [`unity-batchmode-license.log`](unity/Evidence/unity-batchmode-license.log).

Como verificação técnica parcial, **os dois arquivos C# compilaram sem erros via Roslyn**, usando os assemblies managed do Editor instalado e os assemblies URP do cache do template Universal 2D. A evidência está em [`csharp-reference-check.log`](unity/Evidence/csharp-reference-check.log). Isso valida sintaxe, tipos e referências de API; não valida importação de assets, resolução de pacotes, shaders, aparência, sombras executadas na GPU, FPS ou build de Player.

**Não houve renderização nem build executável Unity nesta sessão.** Logo, não existe captura visual Unity ou benchmark Unity que permita declarar uma vitória gráfica ou de desempenho sobre Three.js. O código/configuração da cena foi entregue para abrir após a licença ser ativada, com instruções de Play, build Windows/WebGL e captura real. A falta de teste não é uma inferioridade gráfica demonstrada da URP; é uma limitação concreta da comparação disponível.

## Validação executada nesta auditoria

Em Node **24.18.0**, no checkout base, foram executados sem alterar o código:

```text
node --test tests/campaign-manifest.test.js tests/organism-sprites.test.js \
  tests/player-animation-phase.test.js tests/rhizosphere-parallax.test.js \
  tests/rhizosphere-lighting.test.js tests/hyphal-vertical-bounds.test.js
```

Resultado: **57 testes passaram; zero falhas**, duração reportada de aproximadamente 6,65 s. Cobrem manifesto, grade/frame de sprites, continuidade de animação, limites verticais de hifas, paralaxe e isolamento da camada de iluminação. Não representam execução de toda a suíte, playtest das dez fases ou benchmark. O comando acima usa continuação de linha ilustrativa; no PowerShell pode ser executado em uma única linha.

Os resultados visuais e de runtime da demonstração WebGL são registrados no README e nos arquivos de validação do pacote experimental. A recomendação de manter JavaScript/Three.js considera o código e o esforço de preservação; uma eventual vantagem visual da URP ainda requer a execução do projeto Unity e medição equivalente.

## Resultado da prova WebGL

A prova executável usa a geração real da fase 4, 109 agentes microbiológicos e os sprites originais, com física delegada ao simulador existente. A ponte amadurece pelo sistema micorrízico original e seus colliders sustentam Miguelito; uma colônia e um estímulo de exsudatos iniciais são fixtures declaradas. Filamentos decorativos adicionais usam o algoritmo original, mas não representam leitura das redes privadas em closures. As raízes em volume são apresentação, sem novas colisões.

Quatro testes do adapter passaram, incluindo equivalência diferencial com `engine.step` para os mesmos tempos de quadro variáveis. Dez verificações no navegador passaram, sem erros de console, rede ou runtime: carregamento WebGL2, maturação da ponte, caixa original, movimento, salto, pausa, controles visuais, comparação de luz, modo leve e layout de toque. O teste de layout a 390×844 foi executado no desktop; não mede um celular físico.

| Medição real | Qualidade alta | Qualidade leve |
|---|---:|---:|
| FPS médio após aquecimento | 60,00 | 60,00 |
| p95 do intervalo entre frames | 16,8 ms | 16,8 ms |
| Draw calls na amostra | 264 | 259 |
| Triângulos na amostra | 59.298 | 59.549 |

Ambiente: Windows 11, Edge 155 headless, WebGL2 via ANGLE/D3D11, **Intel Arc**, viewport 1440×900, DPR 1. Amostras curtas de cinco segundos após aquecimento; intervalo de RAF sem ocultar stalls por clamp, não um timer GPU isolado. A variação de triângulos decorre do estado vivo e da câmera, portanto não é um ensaio A/B determinístico. O teto de 60 Hz limita o que se pode concluir: o preset leve não provou FPS superior nesta máquina. Não há comparação quantitativa com Unity ou PixiJS, nem teste físico móvel; o protocolo de 60 s acima permanece recomendado para a decisão de produção.

Evidências: [registro completo](evidence/browser-validation.json). Capturas PNG da execução acompanham o pacote de entrega. A cena implementa luz/sombra dinâmica, normal maps procedurais de solo/raízes, paralaxe, partículas e crescimento. Personagens permanecem planos ilustrados, sem normal maps autorados por frame. Feixes atmosféricos são planos estilizados, não simulação volumétrica completa.

**Decisão após a POC:** evoluir o renderer com Three.js e preservar o núcleo JavaScript. Já há resultado visual executável sem portar as mecânicas, e a máquina testada sustenta o orçamento de 60 Hz neste recorte. Não há evidência visual ou de desempenho suficiente para justificar abandonar o motor atual pela Unity. Isso mantém aberta uma futura avaliação URP após ativar a licença e executar uma cena equivalente; não equivale a declarar que a Unity tenha qualidade inferior.
