# Revisão visual 02 — fidelidade ao jogo original

A referência Unity fornecida pelo usuário mostrou que a primeira POC WebGL havia alterado demais a leitura artística: câmera distante, sprites pequenos, iluminação que lavava a paleta e raízes/solo muito volumosos. A revisão corrige a apresentação mantendo a simulação e as mecânicas existentes.

| Elemento | Primeira POC | Revisão 02 |
|---|---|---|
| Miguelito na tela | Aproximadamente 6% da altura | 12,5% no desktop, preservando os 64 px de arte e caixa 32×48 |
| Câmera | Perspectiva distante, pés muito baixos | Ortográfica; personagem em x≈41%, pés em y≈62% |
| Plataformas | Volumes arredondados genéricos | Tecido celular e paleta originais via `paintRootTissue/paintRootCondition`, borda fina, pelos e profundidade de 14 px |
| Raízes de cenário | Tubos de 26–74 px e massas no primeiro plano | Paths de `growPlantRoots`, diâmetro máximo de 14 px e três profundidades |
| Cor dos personagens | PBR + ACES e luzes fortes alteravam o albedo | Albedo original sem tone mapping, resposta de luz limitada a 8%, sem tintura global verde |
| Atmosfera | Luz geral e vários feixes esverdeados | Fundo azul escuro, um feixe suave e poeira discreta |
| Interface | Texto editorial e painel grandes | Interface mínima; ajustes recolhidos por padrão |

O volume 2,5D permanece nos tubos com normais, na profundidade das plataformas, nas sombras e na paralaxe. A câmera ortográfica mantém a escala ilustrada; nenhum personagem foi reconstruído em 3D. Os dois módulos novos são `platform-art.js` e `root-art.js`; importam as rotinas gráficas existentes, sem alterar `src/`.

## Verificação

Quatro testes do adapter passaram novamente. Onze verificações no navegador passaram, incluindo uma nova checagem da projeção real do enquadramento, painel recolhido, input, salto, pausa, crescimento da ponte e controles de materiais. Zero erros de console, rede ou execução.

Na amostra de cinco segundos após aquecimento: Edge 155 headless, Intel Arc, 1440×900, DPR 1; qualidade alta ≈59,7 FPS, p95≈16,9 ms e 98 draw calls; leve ≈60 FPS e 78 draw calls. São observações desta máquina, não uma comparação de performance contra a imagem Unity. A distribuição inclui `evidence/browser-validation.json` da revisão; os números da primeira POC em outros documentos são históricos.

## Referência Unity e limites

A captura fornecida pelo usuário mostra um preview Unity real com melhor fidelidade artística que a primeira POC WebGL. Ela passa a orientar a comparação visual. A tentativa batchmode documentada anteriormente não executou esse projeto do Claude e não o avaliou. Não se infere da captura uma comparação equivalente de FPS ou um diagnóstico da licença atual do projeto dele.

Ainda há ajustes possíveis na distribuição dos microrganismos e na composição das raízes; suas posições continuam vinculadas à simulação, sem deslocar apenas os desenhos para obter uma captura melhor. Esta revisão não altera a campanha completa, a branch `main`, o site publicado ou o projeto Unity.
