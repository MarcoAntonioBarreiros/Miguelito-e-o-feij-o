# Cartões com microscópio

A referência visual é `miguelito-fase1 (1).html`, incluído no repositório. O
overlay usa o grid 250px/texto, a paleta marrom, a moldura circular, a sombra,
o arredondamento assimétrico e a entrada `cardIn` desse protótipo. Atkinson
Hyperlegible e Grandstander são servidas de `assets/ui/tutorial/fonts`, com
suas licenças OFL, sem depender de rede.

`tutorial-microscope.js` adapta diretamente `renderScope`, `glow`, os desenhos
de Rhizobium, Azospirillum, Bacillus, fungos e exsudatos do protótipo. Os demais
campos são representações esquemáticas: bactérias, hifas, tecido, quelagem,
ovos e nematoides. O mapa de IDs visuais permanece nesse módulo, sem mudanças
nos catálogos científicos. Não é uma simulação quantitativa de biologia.

O manager inicia um único requestAnimationFrame ao abrir um cartão, mantém
o relógio independente da pausa do jogo e cancela a animação ao fechar ou
abrir a biblioteca. Trocar páginas não cria outro loop. A preferência por
movimento reduzido desacelera o campo e remove a animação de entrada.

Título, microscópio e navegação permanecem estáveis. Texto, tópicos e ciclo
compartilham uma região rolável; cada página começa no topo. Abaixo de 640px,
o microscópio fica acima do conteúdo. Pontos, contador, botão anterior e
botão próximo preservam a navegação de todas as páginas desbloqueadas.

Os testes antigos de PNGs e de coordenadas/cores da folha descrevem a
apresentação substituída e permanecem intactos. São incompatíveis com o novo
design; não devem ser confundidos com regressões de conteúdo ou fluxo.
