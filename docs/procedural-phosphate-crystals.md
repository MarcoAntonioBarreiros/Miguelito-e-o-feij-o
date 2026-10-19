# Cristais de fosfato procedurais

Cristais aprovados visualmente na branch `feat/procedural-phosphate-crystals`, baseada em `d591b2c`. A integração substitui somente o desenho dos depósitos de fosfato no jogo. A abertura normal da campanha permanece; o início direto na fase 7 pertence à prévia de inspeção descrita abaixo.

## Teste direto, sem percorrer a campanha

```sh
npm run build
node scripts/preview-crystals.cjs
```

Abra <http://127.0.0.1:4183/experiments/phosphate-crystals/>. O jogo real inicia na fase 7, com Miguelito ao lado do depósito e a física pausada para inspeção. A câmera, a iluminação e a cintilação continuam ativas. O seletor permite trocar entre as dez fases; a fase 7 volta diretamente ao fosfato.

- **Jogar a partir daqui** devolve a física e os controles do jogo. É a fase real, com os poderes e regras definidos pelo Phase Lab.
- **Ir aos cristais** posiciona o jogador ao lado de um depósito intacto. Se houver vários, percorre cada um.
- **Comparar em 2D/WebGL** compara o mesmo mineral nos dois renderizadores.
- **Reserva** simula visualmente a dissolução, incluindo o estado depletado. Esse controle altera apenas a sessão de teste; não gera progresso de campanha, recompensas ou transporte.
- **Gerar novas variações** muda a semente visual dos depósitos, preservando o layout da fase.
- A coleção inferior exibe cinco formações nas proporções usadas no jogo e uma amostra mais larga do mesmo gerador.

A prévia usa o Phase Lab existente e restaura sua configuração local após a inicialização e após trocar de fase. Não lê nem sobrescreve o save da campanha. O wrapper de inspeção está em `experiments/`; não é incluído no jogo publicado pelo build.

## Desenho

`src/render/phosphate-crystals.js` gera a anatomia por semente: três famílias de coroas, um prisma dominante, brotos laterais inclinados, facetas rosa/violeta, inclusões angulares e fragmentos minerais na base. Não utiliza imagens prontas nem `Math.random()`; a mesma identidade/coordenada produz a mesma formação, independentemente do quadro ou estoque. Assim o desenho não interfere na aleatoriedade do jogo ou dos VFX do Claude.

O desenho da base abre até 1,65 vez a largura original, para dentro da plataforma; a borda direita permanece ancorada ao mesmo ponto. As coordenadas, caixa de colisão padrão de **58 × 210**, estoque, poderes, pulsos, transporte micorrízico e objetivos não mudam. O prisma central mantém a altura durante uma dissolução parcial para indicar o bloqueio que ainda existe. Os brotos laterais encolhem e aparecem fissuras nas facetas; ao esgotar, o depósito inteiro desaparece pelo `broken` já existente.

O corpo é rasterizado a 2× e guardado em `WeakMap` por depósito. A imagem é reconstruída somente quando a identidade, dimensão ou estoque muda. Apenas reflexos pequenos e assíncronos são desenhados a cada quadro. O mesmo desenho é usado no Canvas 2D e na superfície `fx` capturada pelo WebGL, sem outro shader ou biblioteca. Os VFX de eventos permanecem intactos.

## Validação

O build passou, assim como 63 testes de desenho determinístico, preservação de dados/RNG, dissolução, solubilização, estoque, transporte e Phase Lab. A inspeção de navegador cobre entrada na fase 7, seletor 7 → 4 → 7, troca 2D/WebGL e reservas de 100%, 40% e 0%, sem erros de JavaScript ou recursos ausentes.

O smoke geral exigido pelo repositório foi executado e continua parando no cartão enfileirado de Bacillus (`queued Bacillus card should open after stable support`), a mesma falha de tutorial já reproduzida na main antes desta branch. A alteração não toca nesse sistema.

Para desfazer a publicação, reverta apenas o commit de integração dos cristais, sem force push. A main anterior (`d591b2c`, que inclui os VFX do Claude e as melhorias WebGL aprovadas) fica preservada na branch remota `backup/main-before-phosphate-crystals-20261018`.
