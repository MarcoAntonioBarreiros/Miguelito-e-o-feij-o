# Biofilme de Bacillus sobre a raiz

A branch experimental substitui a representação radial do biofilme por uma película longitudinal de matriz extracelular (EPS), com bacilos dos sprites originais. A raiz continua sendo desenhada pelo renderizador existente; a película usa sua faixa superficial como suporte e não altera colisores, raios de proteção ou mecânicas.

## Progressão biológica e visual

A fonte de desenvolvimento é `colony.bacillusState.maturity`, calculada pelo ciclo de vida real em `bacillus-bioprotection.js`. Vigor, exsudatos e quantidade de organismos continuam regulando a taxa original. `colony.growth` e `film.growth` não substituem a maturidade: esses campos genéricos avançam mais rapidamente e não representam o amadurecimento do Bacillus.

Os quatro aspectos visuais se sobrepõem continuamente: primeiros bacilos aderidos, ilhas de EPS nas microcolônias, união e expansão ao longo da superfície, e espessamento/pequenos reflexos na maturação. O tempo anima somente o movimento discreto e os brilhos; não expande a película sem progresso biológico. O princípio vem dos nódulos de Rhizobium: a geometria acompanha o progresso simulado, sem copiar a forma dos nódulos.

O limiar original de funcionalidade é **42% de maturidade**. Nessa passagem a matriz já aparece conectada; o filme ainda pode se expandir até amadurecer a partir de **72%**. O renderer lê `film.functional` diretamente, incluindo a perda de função por baixo vigor/esporulação aplicada pelo sistema de segurança. Esporos não mantêm película hidratada. Sons, objetivos, antibiose, proteção e demais interações continuam sendo decididos pelos sistemas existentes.

## Renderização

`src/render/bacillus-biofilm.js` compartilha o perfil superficial entre Canvas 2D e WebGL. No WebGL o pacote local de cor e relevo permite iluminação da matriz; o fallback 2D utiliza o mesmo desenho de cor/transparência. Não há dependência de uma imagem nova da raiz nem recorte das referências anexadas. O cache é local à película e os detalhes são limitados para evitar uma textura adicional do tamanho da tela ou excesso de partículas.

## Teste da fase 1

Na raiz do checkout experimental, execute:

```powershell
npm run build
node scripts/preview-bacillus-film.cjs
```

Abra [a prévia integrada](http://127.0.0.1:4185/experiments/bacillus-film/). Ela inicia a fase 1 do jogo real com seed reproduzível. Os botões apenas deslocam Miguelito até recursos, encontro e raiz marcada; não concedem inóculo, maturidade nem objetivos. Colete exsudato, lance-o com **E** perto de Bacillus, espere o recrutamento, vá à raiz marcada e use **↓** para selecionar Bacillus e **E** para inocular. Um novo exsudato alimenta a colônia. O painel lê os valores reais; **G** ou o botão alterna 2D/WebGL. Reiniciar permite repetir a formação desde a adesão.

Teste automatizado focado:

```powershell
node --test tests/bacillus-biofilm-visual.test.js
```

Os testes verificam progressão sem antecipar a função, união da matriz no limiar real, expansão longitudinal, limite do hospedeiro, estabilidade temporal, esporulação e ausência de mutações nos objetos biológicos. Capturas durante a partida devem registrar maturidade, modo e funcionalidade junto aos quatro estágios; os estágios visuais são contínuos, não quatro animações independentes.

## Validação realizada na branch

Foram aprovados 253 testes direcionados, além de três novos testes de limites do cache: deslocar câmera/raiz sem repintura, não alocar/enviar filmes fora da tela e limitar as texturas locais de cor e relevo a 1024 × 160 px mesmo num hospedeiro de 2000 px com oito fontes. Isso verifica limites de custo; não substitui uma medição de desempenho em cada aparelho.

No navegador, a fase 1 real percorreu coleta, recrutamento, inoculação e formação, com capturas dos quatro aspectos:

| Captura | Maturidade real | Funcional |
| --- | ---: | --- |
| Adesão | 10,05% | Não |
| Microcolônia | 30,14% | Não |
| Expansão | 50,66% | Sim |
| Maturação | 80,10% | Sim |

A primeira observação funcional ocorreu em **42,667%**, com o objetivo da raiz introdutória aprovado pela simulação. Esse é o primeiro quadro observado acima do limiar original de 42%, não um novo limiar. Também foi conferida a versão 2D do filme maduro. Os atalhos encurtaram deslocamentos; a prévia não concedeu inóculo nem preencheu a maturidade. As evidências locais estão em `work/bacillus-film-qa/captures/`.

O `tests/browser-smoke.cjs` global continua falhando no caso preexistente `source: queued Bacillus card should open after stable support`, relativo à apresentação do tutorial. Essa falha não foi corrigida no escopo gráfico e a suíte global não é declarada aprovada.
