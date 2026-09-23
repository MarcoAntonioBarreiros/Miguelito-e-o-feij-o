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
- Elementos de progresso usam brilho e partículas, não ícones explicativos.

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
