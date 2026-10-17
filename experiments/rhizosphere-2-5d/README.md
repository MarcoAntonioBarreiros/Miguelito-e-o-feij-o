# Miguelito · Sob a superfície — experimento 2,5D

Prova visual **Three.js r186 / WebGL2** sobre o código existente. Branch `experiment/rhizosphere-2-5d`, base `f118a303f6cefb2c20d77ff4bf23826fbcd31005`. Nenhuma modificação em `src/`, `dist/`, entradas principais ou workflow de publicação. Não é uma migração completa das dez fases.

## Executar no checkout da branch

Requer Node.js 22+ e navegador com WebGL2. Na pasta deste arquivo:

```sh
npm ci
npm start
```

Abra **http://127.0.0.1:4173**. `npm ci` prepara uma cópia local do Three.js; a demo não consulta CDN em runtime. A distribuição ZIP já inclui essa cópia: nela basta executar `INICIAR.cmd` ou `npm start` na pasta extraída, sem instalar pacotes. O servidor atende somente em loopback. Não abrir o HTML por `file://`, pois módulos ES precisam de HTTP.

Controles: **A/D ou setas** movem; **Espaço** salta (inclui salto duplo desbloqueado na fase); **E** usa a inoculação original; **R** reinicia crescimento; **P** pausa; **B** alterna a luz cinematográfica e luz uniforme; **H** oculta a interface. Em tela estreita há botões de toque. Aguarde aproximadamente sete segundos até a ponte estar madura. Não há áudio nesta POC: o simulador usa seu adaptador silencioso original.

O painel permite alternar três paletas, intensidade, sombra projetada, normal maps, paralaxe e partículas. O modo leve reduz DPR, shadow map de 2048 para 1024, partículas de 500 para 180 e desliga bloom. Atualiza também a resolução dos render targets. O resultado em celular físico ainda precisa ser medido.

## O que foi efetivamente implementado

- Recorte da **fase 4**, com geração e decoração originais e seed explícita. Plataformas de partida/destino conservam o vão de 325 px, alturas e geometria do gerador. O adapter inicia Miguelito junto à estreia da micorriza para evitar repetir a campanha anterior.
- `createSimulator`, `createPhysicsSystem`, regras biológicas e a ponte de `mycorrhiza-structures.js` rodam diretamente dos módulos existentes. O adapter passa uma vez por quadro o mesmo `dt` variável limitado a 0,1 s. A caixa continua **32×48**; nenhuma colisão é calculada pelo Three.js.
- A ponte cresce pelo sistema original e só ganha os colliders quando amadurece. Seus colliders não são desenhados como blocos: a apresentação usa uma fita sobre seus pontos. Andar sobre ela continua sendo decidido pela física original.
- Miguelito usa `idle`, `run`, `hurt` e `celebrate` originais; derrota segura o frame 4 de hurt a 24 fps. Os estados sem folha usam a corrida como fallback visual. Recorte, baseline, compensação de `contentHeight` e cadência de corrida vêm do catálogo. Microrganismos usam as folhas, fases, sentidos e escalas existentes; Bacillus conserva seus 44 retângulos próprios.
- PNGs originais preservados; o atlas da GPU apenas reempacota os pixels 1:1. Folhas longas usam até oito colunas e adaptam a grade ao `MAX_TEXTURE_SIZE`. Mínimo prático de textura: 2048. São mantidos os arquivos fonte sem retoque ou substituição por personagens 3D.
- Luz direcional quente móvel com shadow map PCF, preenchimentos pontuais ciano/âmbar, luz local de Miguelito, superfícies que recebem sombras e recortes alfa que projetam silhuetas. Câmera perspectiva frontal; personagens continuam sendo planos.
- Materiais de solo e raízes com normal map procedural, microtextura, rugosidade e iluminação PBR. Não existem normal maps dos personagens no repositório; esta POC não finge tê-los produzido. A arte dos personagens recebe luz em planos com normais frontais.
- Raízes decorativas em curvas com espessura variável, crescimento por draw range, estratos em profundidade, paralaxe, névoa, feixes estilizados, partículas em lote e bloom moderado. Os feixes são planos transparentes, não ray marching volumétrico. As raízes decorativas não criam colliders.

### Fixtures e limites explícitos

Uma colônia micorrízica madura e uma nuvem inicial de exsudatos são **condições autorais da demonstração**; permitem iniciar a conexão imediatamente. `E` continua passando pela interação real. Três redes adicionais de filamentos usam `createHyphalNetwork/updateHyphalNetwork` originais, mas são marcadas **visualOnly**: não são um snapshot das redes privadas em closures do sistema de micorriza. Raízes volumétricas são decoração, não uma nova regra de crescimento do jogo.

A geometria da fase é seeded; a biologia original ainda usa `Math.random`, portanto não se promete replay determinístico de todo o ecossistema. A apresentação cobre o trecho de micorriza e organismos em roaming. Nem todos os efeitos dos dez níveis, HUD completo, patógenos, galhas, tutoriais e áudio foram adaptados para WebGL. A simulação já os reúne, mas isso não equivale a uma campanha integralmente renderizada.

## Testes e medições

```sh
npm test
```

Quatro testes de adapter: geração real e ponte que sustenta Miguelito; movimento/salto e borda de input; interação E original; comparação diferencial do estado físico com `engine.step` usando os mesmos tempos variáveis, incluindo os limites do delta. Não há cópia alternativa da física.

O teste opcional de navegador requer Playwright e servidor aberto:

```sh
npm install --no-save --package-lock=false playwright
node browser-test.cjs
```

`BROWSER_PATH` pode apontar para um navegador instalado; `PLAYWRIGHT_MODULE` para um módulo já existente; `EVIDENCE_DIR` escolhe a saída. O teste percorre movimento, salto, pausa, controles de render e recriação da ponte; captura imagens e registra intervalos reais de RAF, GPU e draw calls. As amostras são de cinco segundos após aquecimento. O FPS da interface não é um timer GPU nem comprova desempenho em outros dispositivos.

Na execução inicial de 17/10/2026, Edge 155 headless, 1440×900, DPR 1, Intel Arc: cerca de **60 FPS / p95 16,8 ms** nos dois presets. Os resultados finais completos acompanham `browser-validation.json` na entrega. O teste a 390×844 valida layout/toque em desktop; não é benchmark de celular físico.

## Reproduzir a distribuição

Depois de `npm ci`:

```sh
node package-demo.cjs CAMINHO_PARA_NOVA_PASTA
```

Preserva `src/`, copia assets visuais e prepara vendor offline. Não copia áudio ou altera a versão publicada. O arquivo `original-assets.sha256.json` da distribuição permite verificar que os arquivos da arte são idênticos aos originais.

## Unity e decisão

O projeto em [`unity/`](unity/README.md) implementa uma composição URP 2D comparável, sem portar gameplay. Unity 2022.3.44f1 e suporte WebGL/Windows foram encontrados; a licença local impediu importação e build. Os C# compilaram via Roslyn contra assemblies Unity/URP instalados, mas **não houve render, teste visual, FPS ou executável Unity**. As instruções permitem abrir, preparar cena e gerar builds após ativar a licença.

Recomenda-se seguir incrementalmente com **Three.js sobre o simulador existente**. Ele oferece luz, sombra, normais e profundidade sem reescrever física, geração ou microbiologia. PixiJS é uma alternativa forte para sprites e composição 2D, mas o pedido de materiais, profundidade e sombras torna o Three.js mais direto nesta POC. PixiJS não foi implementado nem benchmarkado aqui. Unity oferece um fluxo de autoria integrado que pode justificar migração em outro contexto; o benefício visual adicional ainda não foi demonstrado nesta máquina, enquanto o custo de portar os sistemas é concreto.

O próximo passo técnico seria extrair snapshots somente de leitura dos 28 módulos que também desenham em Canvas, incorporar seus efeitos ao renderer e validar fase por fase. Essa etapa completa não foi iniciada. A comparação detalhada e o projeto de migração estão no relatório da entrega.

Fontes oficiais: [MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html), [sombras](https://threejs.org/manual/en/shadows.html), [URP 14 Light2D](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/api/UnityEngine.Rendering.Universal.Light2D.html), [limites WebGL Unity 2022.3](https://docs.unity3d.com/2022.3/Documentation/Manual/webgl-technical-overview.html).
