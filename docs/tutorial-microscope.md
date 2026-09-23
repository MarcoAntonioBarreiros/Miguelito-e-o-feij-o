# Cartões com microscópio

A referência visual é `miguelito-fase1 (1).html`, incluído no repositório. O
overlay usa o grid 250px/texto, a paleta marrom, a moldura circular, a sombra,
o arredondamento assimétrico e a entrada `cardIn` desse protótipo. Atkinson
Hyperlegible e Grandstander são servidas de `assets/ui/tutorial/fonts`, com
suas licenças OFL, sem depender de rede.

`tutorial-microscope.js` mantém o campo óptico de `renderScope` do protótipo,
mas usa os mesmos sprites e cadências da fase: `organismSprites` e os
renderizadores de Bacillus. Um espécime em foco e dois em segundo plano
mostram a arte animada do jogo. O arbúsculo usa `drawArbuscule`; as rotinas
privadas de nódulo/FBN, fêmea/ovos e sideróforo foram transpostas dos módulos
da fase sem importar seus sistemas de atualização. Exsudatos usam o núcleo,
halo e pulsação do renderer. Nenhum renderer, asset ou estado da fase muda.

O manager inicia um único requestAnimationFrame ao abrir um cartão, mantém
o relógio independente da pausa do jogo e cancela a animação ao fechar ou
abrir a biblioteca. Trocar páginas não cria outro loop. A preferência por
movimento reduzido desacelera o campo e remove a animação de entrada.

O cartão tem altura determinada pelo conteúdo, sem reservar 600px. O ciclo
fica em uma página própria, como um percurso gráfico com setas suaves, sem
números ou caixas; sua ordem semântica permanece acessível. `tutorial-card-pages.js`
divide tópicos extensos em páginas de até dois itens, conservando exatamente
os textos. Essa paginação é apenas visual: IDs, índices persistidos, catálogo,
desbloqueios e exports anteriores não mudam. Não se revela conteúdo bloqueado.

O primeiro cabeçalho apresenta o subtítulo original; nos seguintes ele indica
o assunto da página. Dentro de cada página, apenas o texto rola quando falta
altura. Em telas estreitas o microscópio vai acima do texto e a navegação usa
contador e anterior/próxima; os pontos aparecem em desktop para até seis
páginas. Cartões de uma página dispensam controles redundantes.

O botão principal preserva as proporções do protótipo e usa “Continuar”, com
centralização óptica do texto; seu aria-label distingue avançar, finalizar e
voltar à biblioteca.

`tests/tutorial-card-pages.test.js` verifica a preservação de todos os textos,
títulos, tópicos e ciclos, além do isolamento dos desbloqueios científicos.

Os testes antigos de PNGs e de coordenadas/cores da folha descrevem a
apresentação substituída e permanecem intactos. São incompatíveis com o novo
design; não devem ser confundidos com regressões de conteúdo ou fluxo.
