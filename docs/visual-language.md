# Visual Language

O protótipo usa Canvas 2D com uma rizosfera fantástica, colorida e orgânica. A estética atual é canônica para tarefas de refatoração.

## Paleta funcional

- Fundo subterrâneo: azuis/verde-petróleo escuros e roxo profundo.
- Solo/plataformas: marrons terrosos com highlights quentes.
- Energia biológica: ciano, verde-lima, rosa e laranja.
- Minerais/fósforo: azul claro, cinza mineral e dourado.

## Formas

- Microrganismos são desenhados proceduralmente com flagelos, hifas, colônias, halos e partículas.
- Plataformas sólidas têm bordas orgânicas arredondadas.

## Geometria da rizosfera

Camada em `src/render/rhizosphere-geometry.js`, chamada por `platformVisuals.drawWorld`. Só desenho: o colisor continua sendo o retângulo da plataforma, os tipos `soil`/`root` não mudam, e o topo de toda forma desenhada fica exatamente em `platform.y`. Referência: `miguelito-fase1 (1).html`.

- Solo (`soil`): topo de uma massa contínua que desce até o fundo da tela, com paredes irregulares. Os vãos viram barrancos em V que nunca fecham, então a zona letal continua visível.
- Raiz (`root`): agregado de rizobainha, isto é, solo preso à raiz com a textura de pedras e grãos, contorno irregular, base desfeita em grãos soltos e pelos radiculares saindo por baixo. A raiz lateral visível (14–20 px, textura celular, contraste pleno) entra pelo lado da raiz principal, corre pela borda de cima parcialmente enterrada e sai na outra ponta com a coifa curvada para baixo. Os pelos ficam no terço perto da ponta.
- Efeitos sobre a raiz: nódulos, fluxo e bloqueio da Ralstonia, J2 interno e estado de saúde são desenhados na raiz visível por `visibleRootRect(platform)` / `rootEffectY(platform, y)`. As galhas e o fungo já nasciam na borda de cima. Os sistemas continuam lendo a plataforma inteira.
- Raízes principais: descem da superfície, que é a linha do colo de `finalRootCollar` (a mesma da cinemática final), e afinam para baixo. Usam a textura em faixas verticais com a paleta apagada `MUTED_ROOT_PALETTE` (menos saturação e contraste, sem véu). Cada bloco `root` se liga à principal mais próxima por uma lateral fina e sinuosa (`LINK_ROOT_PALETTE`), com ramificações de 2ª ordem. As plantas ficam nos vãos, uma a cada no máximo 720 px, e cada bloco tem uma principal a até 380 px. No colo de cada principal há um feijoeiro menor (`drawBeanPlant`), sem brilho.
- Raiz-objetivo (`drawFinalRoot`): mesma textura celular, com a aura dourada e o filamento por cima.
- Teto: faixa de solo entre a superfície e a caverna, 230 px acima da plataforma mais alta ao alcance. Na cinemática final ela fica sob o céu.
- Texturas compartilhadas em `src/render/root-tissue.js`. `?geo=0` volta aos blocos antigos (lido em `src/render/geometry-preference.js`).

## Luz e atmosfera

Camada em `src/render/rhizosphere-lighting.js`, desenhada no fim do `renderWorld` (depois dos organismos, antes do rótulo). É só visual: não lê nem escreve nada usado por física, coleta, tutoriais ou áudio.

- Escuridão por profundidade e vinheta, em 1/4 da resolução, recortada por luzes do jogador, exsudatos, cristais, checkpoints, biofilmes, microrganismos da ecologia e raiz-objetivo.
- Feixes de luz vindos da superfície, com partículas em suspensão; posições derivadas da seed da fase.
- Halos aditivos na cor de cada fonte (cor do perfil de movimento para microrganismos).
- Sombra de contato sob as plataformas e borda superior iluminada (`renderPlatformDepth`, logo após `platformVisuals.drawWorld`).
- Raízes finas em primeiro plano, penduradas do topo da tela, com parallax 1,32 e comprimento limitado a 17% da altura.
- Entra suavemente ao começar a jogar; some na introdução e na cinemática final.
- `?luz=0` abre sem a camada; a tecla `L` alterna durante o jogo. `window.miguelitoLighting.lastRenderMs` mede o custo do quadro.

## Cuidados

- Não trocar layout, escala, iluminação ou composição sem tarefa explícita de design.
- Não substituir microrganismos proceduralmente desenhados por sprites estáticos sem decisão de direção de arte.
- Manter a leitura dos poderes no HUD igual à versão canônica.
