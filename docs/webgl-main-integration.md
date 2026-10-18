# Integração das melhorias visuais com os VFX atuais

Base da integração: `c84a499d97b668734d2ce9819bedbc13187b286b`, main de 18/10/2026 com os efeitos do Claude.

## Preservação da main

Os arquivos `src/render/vfx-particles.js`, `src/procgen/app.js` e `src/procgen/beneficial-inoculants.js` permanecem idênticos à base. Isso preserva os presets, desenhos, tempos, disparos de inoculação, avisos de vigor, celebração e onda da raiz final. Também foi preservada a remoção das luzes permanentes das colônias no renderizador WebGL.

A revisão local de partículas rejeitada, incluindo seus hooks, lotes e módulos, não faz parte desta integração. Ela permanece separada no checkout experimental anterior. As rotinas de biofilme, antibiose, difusão e Trichoderma são as mesmas da main atual.

## Melhorias incorporadas

- Feixes volumétricos em coordenadas de mundo, com intensidade estável ao mudar o zoom.
- Poeira cintilante em uma faixa mais larga alinhada ao centro visível dos feixes.
- Raízes contínuas e orgânicas, preservando o tecido pintado do primeiro plano.
- Quatro famílias de raízes decorativas no paralaxe, com troncos mais robustos e ramificações assimétricas.
- Aura suave da raiz final e os catorze indicadores orbitais cintilantes aprovados.
- Sprites no mesmo plano das plataformas, eliminando a profundidade acumulada a cada desenho.
- Medidor, bico e jato ancorados à mochila de cada quadro, espelhados com o personagem e compostos após o corpo.

Colisores, física, geometria lógica, dez fases, progressão e regras biológicas permanecem na versão da main.

## Validação

O build do jogo autônomo e dos módulos opcionais WebGL foi gerado a partir desta integração. Os 200 testes focados de câmera, jogador, propulsão, raízes, textura, iluminação e final de fase passaram.

A comparação de navegador usa os arquivos reais do `dist` da main e da integração, em sessões isoladas. Inclui inoculação por E de Bacillus, Pseudomonas e micorriza; também reproduz as APIs de celebração/onda da main após concluir o objetivo. As amostras cobrem 0; 0,2; 0,6; 1,2; 2,2; 3,5; 8 e 12 segundos. O relógio e a câmera são controlados apenas pelo harness; o produto não recebe instrumentação de teste. As cenas também cobrem mudança de zoom, retorno de outra região, modo nativo e alternância 2D/WebGL.

As 32 amostras passaram na comparação exata de contagem, duração, pixels visíveis e checksum da imagem isolada de VFX. A entrada aleatória dos efeitos foi isolada no harness para que novos consumidores de aleatoriedade do cenário não alterassem o replay. Não houve erros de JavaScript/GL nas oito cenas; os efeitos de inoculação estavam encerrados em 3,5 segundos e os da celebração encerrados em oito segundos nos replays usados. Os catorze indicadores orbitais aprovados continuam presentes na raiz final.

A execução de todos os arquivos `*.test.js` terminou com 1.158 testes: 1.141 passaram e 17 falharam. Os sete arquivos com falhas foram executados também no checkout limpo de `c84a499`: os mesmos 17 testes falharam, sem diferenças na lista de falhas. São verificações anteriores de áudio, cartão mobile/tutorial e geração/travessia; esta integração não altera os arquivos desses sistemas.

O comando `npm test` interrompe na primeira dessas falhas: o teste de áudio espera `BIOLOGICAL_BUS_SCALE = 0.9`, enquanto o valor atual é `1.25`. O smoke oficial de navegador também para no cartão enfileirado de Bacillus por considerar o jogador sem suporte. Ambos os resultados foram reproduzidos na main limpa; o smoke visual específico da integração e dos VFX passou, conforme descrito acima.

## Reversão

A integração parte da main atual e deve entrar como uma mudança isolada. Para desfazê-la, reverta seu commit de integração/merge; não use force push nem restaure a branch experimental antiga sobre a main. O commit `c84a499` permanece como ponto de retorno que inclui os VFX do Claude, também preservado na branch remota `backup/main-before-webgl-improvements-20261018`.
