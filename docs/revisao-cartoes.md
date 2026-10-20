# Revisão dos cartões didáticos

Gerado de `src/procgen/tutorial-text-revision.js`. Ligado ao jogo em `tutorial-registry.js` (textos, ciclos e cartões novos), `tutorial-flow.js` (regras de abertura, selo "novo"), `tutorial-manager.js` (revisão do fim da fase) e `tutorial-triggers.js` (gatilhos). Limites: corpo ≤ 140 caracteres, até 2 tópicos de ≤ 60, título ≤ 32. Páginas marcadas "continuação" aparecem logo depois da original.

## 1. Mudanças de posição

- **power-jetpack**: fase 5, bloco 0 (junto com o fungo) → quando a propulsão fica disponível pela primeira vez
- **process-mycoparasitism**: fase 6, bloco 4 → vira parte do Trichoderma; abre no primeiro ataque de Trichoderma
- **todos os ciclos**: última página da primeira apresentação → cartão de revisão no fim da fase; depois no GUIA
- **páginas liberadas depois**: entram no GUIA em silêncio → selo "novo" no GUIA e aviso curto

## 2. Ciclos (13) — aparecem no fim da fase, como revisão, e depois no GUIA

Cada etapa: o que acontece e, quando há termo novo, o que ele é (até 140 caracteres).

### Bacillus — Ciclo do Bacillus (fim da fase 1)

1. **Célula ativa** — Perto da raiz, a célula se alimenta de exsudatos, cresce e se divide em duas. Assim a população aumenta.
2. **Biofilme** — As células grudam na raiz e produzem uma matriz pegajosa. Esse conjunto, o biofilme, forma uma camada que protege a raiz.
3. **Endósporo** — Sem alimento, a célula forma um endósporo: uma cápsula dura e dormente que resiste à seca, ao calor e à falta de comida.
4. **Germinação** — Com exsudatos de novo, o endósporo germina: a cápsula se abre e sai uma célula ativa, pronta para crescer e se dividir.

### Rhizobium — Formação do nódulo (fim da fase 2)

1. **Reconhecimento** — A raiz libera flavonoides, sinais químicos. O rizóbio responde com fatores Nod, moléculas que dizem à planta: sou parceiro.
2. **Fio de infecção** — O pelo da raiz se curva e prende as bactérias. Por dentro dele cresce um tubo, o fio de infecção, que as leva para dentro.
3. **Nódulo** — A raiz forma um órgão novo, o nódulo. Lá dentro, as bactérias mudam de forma e viram bacteroides, as fixadoras de nitrogênio.
4. **FBN** — Nos bacteroides, a enzima nitrogenase transforma o N₂ do ar em amônia. Em troca, a planta fornece açúcares à bactéria.

### Fixação biológica de nitrogênio — Do ar para a planta (fim da fase 2)

1. **N₂ do ar** — Quase 80% do ar é nitrogênio (N₂). Mas a planta não usa o N₂: seus dois átomos estão presos por uma ligação tripla.
2. **Nitrogenase** — A nitrogenase é a enzima que quebra essa ligação. Gasta muita energia e para com oxigênio: a leghemoglobina o controla.
3. **Amônia** — O N₂ quebrado vira amônia (NH₃), uma forma de nitrogênio que a planta consegue absorver e usar.
4. **Planta** — Com a amônia, a planta produz aminoácidos, proteínas e clorofila. Por isso as folhas ficam verdes e a planta cresce.

### Azospirillum — Novas raízes (fim da fase 3)

1. **Colonização** — Azospirillum vive grudado na superfície da raiz, o rizoplano. Diferente do rizóbio, ele não forma nódulos.
2. **AIA** — Azospirillum produz AIA, um hormônio vegetal do grupo das auxinas. Ele avisa a raiz que é hora de crescer e ramificar.
3. **Raízes laterais** — Com mais AIA, nascem raízes laterais e pelos radiculares. A raiz explora mais solo e absorve mais água e nutrientes.

### Micorriza arbuscular — Ciclo da micorriza (fim da fase 4)

1. **Contato** — A raiz libera estrigolactonas, sinais que atraem o fungo. A hifa, o fio fino do fungo, cresce em direção à raiz.
2. **Córtex** — A hifa entra na raiz e cresce no córtex, a camada de células logo abaixo da superfície, sem causar doença.
3. **Arbúsculo** — Dentro da célula, a hifa se ramifica como uma arvorezinha: o arbúsculo. Ali a planta entrega açúcar e recebe fósforo.
4. **Rede no solo** — Hifas externas se espalham pelo solo, bem além da raiz. Elas alcançam fósforo e água onde a raiz não chega.

### Pseudomonas — A caça ao ferro (fim da fase 5)

1. **Colonização** — Pseudomonas se instala na raiz e se alimenta de exsudatos. Ela disputa esse espaço com outros micróbios.
2. **Sideróforo** — Com pouco ferro por perto, ela libera sideróforos: moléculas que saem da célula para procurar e agarrar ferro no solo.
3. **Captura de Fe³⁺** — O sideróforo prende o ferro (Fe³⁺) com muita força. Os outros micróbios não conseguem tirar esse ferro dele.
4. **Retorno** — A célula reconhece o sideróforo carregado e recolhe o ferro. Sem ferro, o fungo competidor perde força.

### Fungo oportunista — Ciclo do oportunista (fim da fase 5)

1. **Esporo** — Esporos funcionam como sementes do fungo, levados pela água e pelo solo. Eles esperam uma raiz enfraquecida.
2. **Contato** — O esporo germina e solta uma hifa, um fio fino do fungo. Ela adere à superfície da raiz e começa a entrar no tecido.
3. **Colonização** — A hifa cresce pela ponta e se ramifica, formando uma rede: o micélio. O fungo se alimenta do tecido da raiz.
4. **Novos esporos** — O micélio maduro produz novos esporos. Eles se espalham e podem infectar outras raízes enfraquecidas.

### Trichoderma — Micoparasitismo (fim da fase 6)

1. **Reconhecimento** — Trichoderma percebe sinais químicos do fungo-alvo antes do contato. A hifa então cresce na direção dele.
2. **Enrolamento** — A hifa de Trichoderma chega ao alvo e se enrola nele, como uma trepadeira. Assim fica presa e pronta para atacar.
3. **Enzimas** — Ela libera quitinases e glucanases, enzimas que digerem a parede celular do alvo, feita de quitina e glucanos.
4. **Lise** — Sem parede, a célula do alvo se rompe: é a lise. Trichoderma aproveita os nutrientes e a raiz fica livre.

### Rhizoctonia — Ciclo da Rhizoctonia (fim da fase 6)

1. **Solo** — Rhizoctonia vive no solo como micélio (rede de hifas) e escleródios. Ela se espalha crescendo, quase sem formar esporos.
2. **Almofada de infecção** — Na raiz, as hifas se juntam numa almofada de infecção: um tufo que se prende ao tecido e abre caminho para dentro.
3. **Lesão** — O fungo libera enzimas que degradam as células. Surge uma lesão escura, e a raiz perde a capacidade de levar água.
4. **Persistência** — O fungo forma escleródios: bolinhas duras de hifas que resistem anos no solo. Com raiz por perto, germinam e atacam.

### Bacillus — cepa solubilizadora — Caminho do fósforo (fim da fase 7)

1. **Ácidos** — Muito fósforo do solo está preso em minerais, como o fosfato de cálcio. A bactéria libera ácidos orgânicos junto deles.
2. **Fosfato livre** — Os ácidos dissolvem o mineral e soltam o fosfato. Livre na água do solo, ele pode ser absorvido.
3. **Raiz** — As hifas da micorriza alcançam o fosfato liberado e o levam até a raiz. Com fósforo, a planta produz energia e cresce.

### Meloidogyne — juvenil J2 — Invasão do J2 (fim da fase 8)

1. **Eclosão** — J2 é o juvenil de segundo estágio: um verme microscópico que sai do ovo e nada na água do solo atrás de uma raiz.
2. **Penetração** — Com o estilete, uma agulha na boca, o J2 perfura a ponta da raiz. Lá dentro, migra até perto dos vasos.
3. **Células gigantes** — O J2 injeta substâncias que transformam células da raiz em células gigantes. Elas viram a fonte de alimento dele.

### Meloidogyne — fêmea adulta — Ciclo do Meloidogyne (fim da fase 8)

1. **Ovo** — Dentro do ovo, o juvenil de primeiro estágio (J1) se desenvolve e troca de pele. Ele já sai do ovo como J2.
2. **J2** — O J2 eclode, procura uma raiz e entra nela. Esse é o único estágio que se move pelo solo.
3. **Galha** — As células gigantes e o tecido ao redor incham e formam a galha, um caroço na raiz. A raiz passa a levar menos água.
4. **Fêmea** — O juvenil cresce, perde a forma de verme e vira uma fêmea arredondada. Ela fica parada, presa às células gigantes.
5. **Massa de ovos** — A fêmea põe centenas de ovos numa geleia, a massa de ovos, na superfície da raiz. Dali sai a próxima geração.

### Ralstonia — Ciclo da murcha (fim da fase 9)

1. **Solo e água** — Ralstonia é uma bactéria que sobrevive no solo e na água de irrigação. Ela espera uma porta de entrada na raiz.
2. **Entrada** — Entra por ferimentos ou pelas aberturas onde nascem as raízes laterais. Dali chega ao xilema.
3. **Xilema** — Xilema são os vasos que levam água da raiz às folhas. Ali a bactéria se multiplica e produz uma goma, o exopolissacarídeo.
4. **Murcha** — A goma e as bactérias entopem os vasos. A água não sobe, e a planta murcha mesmo com o solo úmido.
5. **Disseminação** — A raiz doente libera bactérias no solo e na água. Elas podem chegar a outras raízes e reiniciar a infecção.

**Perdem o ciclo:** Rizosfera Viva, Exsudato radicular, Inoculação, Salto duplo, Dash, Propulsão da Rizósfera, Pulso de solubilização, Saúde da raiz, Recuperação radicular, Perda de sustentação, Nódulo radicular, Biofilme, Sideróforo, Pseudomonas × fungo oportunista, Entrada pelo ferimento, Obstrução do xilema, Contenção vascular, Disseminação bacteriana, Arbúsculo, Ponte micorrízica horizontal, Raiz lateral, Massa de ovos de Meloidogyne, Galha radicular, Micoparasitismo.

## 3. Cartões novos

### O que o E faz? (Como jogar)
*Abre:* primeira vez com duas ou mais opções no seletor (fase 1)

**1. Uma ação por vez** — O E faz a ação mostrada no seletor: inocular um aliado, soltar exsudato e, mais tarde, o pulso.
**2. Troque a ação** — Aperte seta para baixo (ou o botão de troca no celular) para passar à próxima opção.

### Zona necrótica (Perigo)
*Abre:* primeira vez que a zona aparece na tela (fase 1)

**1. Não caia** — Lá embaixo há tecido morto tomado por fungos. Cair nela tira toda a Vitalidade de Miguelito.
**2. Volte ao biofilme** — Depois da queda, Miguelito volta ao último biofilme ativado. Ative os biofilmes pelo caminho.

### Contaminado! (Estado de Miguelito)
*Abre:* primeira vez com contaminação fúngica ou infecção acima de 20% (fase 5)

**1. O que está acontecendo** — Hifas grudaram em Miguelito. Rosadas são do fungo oportunista; castanhas, da Rhizoctonia.
  - Quanto mais hifas, mais lento e mais fraco.
**2. Como se limpar** — Fique dentro de um biofilme maduro de Bacillus. As hifas secam e caem.
  - Longe do fungo, a contaminação também cai aos poucos.

### J2 agarrado (Estado de Miguelito)
*Abre:* primeiro J2 agarrado em Miguelito (fase 8)

**1. Carona indesejada** — O J2 se agarrou na perna de Miguelito e pode ser levado até outra raiz.
  - Com dois J2, o dash fica bloqueado.
**2. Como se livrar** — Passe por um biofilme maduro de Bacillus: ele repele os J2.

### Calmaria (Interação)
*Abre:* primeira calmaria formada (Pseudomonas + Bacillus próximos)

**1. Acalmar, não matar** — Muitas vezes as bactérias benéficas não matam os patógenos: elas os acalmam.
**2. Por que funciona** — Juntas, Pseudomonas e Bacillus deixam a planta em alerta (resistência induzida). O patógeno fica, mas não avança.
**3. No jogo** — Inocule as duas na mesma raiz ou em raízes vizinhas. Dentro da luz, os patógenos param de atacar.
  - Alimente as colônias para a calmaria durar.

### Radar de patógenos (Como jogar)
*Abre:* primeiro sinal do radar na borda da tela (fase 8)

**1. Leia o sinal** — A seta na borda aponta uma ameaça fora da tela. Quanto maior, mais perto ela está.
  - Claro pulsando: chegando · Âmbar: instalada
  - Vermelho com "!": infecção vascular

## 4. Textos das páginas (atual → novo)

### Rizosfera Viva

| # | Atual | Novo |
|---|---|---|
| 1 | **Bem-vindo à rizosfera** — Você encolheu até o tamanho de um microrganismo. Aqui, a superfície da raiz é um mundo vivo: bactérias, fungos e nematoides competem, cooperam e mudam a saúde da planta. | **Bem-vindo à rizosfera** — Você encolheu até virar um micróbio! A rizosfera é o solo junto às raízes, onde micróbios competem, cooperam e influenciam a planta. |
| 2 | **Cartões de descoberta** — Quando algo importante aparece pela primeira vez, o jogo pausa e abre um cartão. Leia no seu ritmo: nenhuma ameaça continua se movendo enquanto o cartão estiver aberto.<br>• Use as setas para avançar ou voltar.<br>• Os cartões descobertos ficam guardados na Biblioteca. | **Cartões de descoberta** — Quando algo novo aparece, o jogo pausa e abre um cartão. Nada se move enquanto você lê.<br>• Use as setas para avançar ou voltar.<br>• Os cartões descobertos ficam no GUIA. |
| 3 | **Ciência + videogame** — Algumas ações representam processos biológicos reais. Outras são metáforas de plataforma criadas para transformar fenômenos microscópicos em desafios visíveis e jogáveis.<br>• O cartão explica o que é real e o que foi adaptado.<br>• Observar o cenário ajuda a entender a estratégia. | **Ciência + videogame** — Algumas ações são processos reais. Outras são metáforas de plataforma para tornar visível o que é microscópico.<br>• O cartão diz o que é real e o que foi adaptado. |

### Exsudato radicular

| # | Atual | Novo |
|---|---|---|
| 1 | **Pacotes químicos da raiz** — Exsudatos são compostos liberados pelas raízes, como açúcares, aminoácidos, ácidos orgânicos e moléculas sinalizadoras. Eles criam uma zona de intensa atividade ao redor da raiz. | **Pacotes químicos da raiz** — Exsudatos são açúcares, aminoácidos, ácidos orgânicos e sinais liberados pela raiz. Eles agitam a vida ao redor dela. |
| 2 | **Alimento e mensagem** — Esses compostos alimentam parte da microbiota e também funcionam como sinais. A raiz influencia quais organismos se aproximam, permanecem e atuam na rizosfera.<br>• Podem favorecer aliados benéficos.<br>• Também podem atrair organismos indesejados, como juvenis de nematoides. | **Alimento e mensagem** — Exsudatos alimentam micróbios e funcionam como sinais: a raiz influencia quem se aproxima e quem fica.<br>• Atraem aliados benéficos.<br>• Também atraem invasores, como juvenis de nematoides. |
| 3 | **Poder no jogo** — Pressione E para liberar um exsudato. Ele recruta microrganismos, sustenta colônias e orienta o crescimento de algumas estruturas. | **Poder no jogo** — Colete as gotas verdes e aperte E para liberar um exsudato. Ele recruta micróbios e alimenta colônias. |
| 4 | **Estratégia** — Use perto do aliado que deseja recrutar ou de uma colônia que esteja perdendo atividade. Durante uma infestação, evite lançar exsudatos sem proteção perto de raízes vulneráveis.<br>• Exsudato é recurso: escolha o local antes de usar.<br>• Colônias ativas transformam carbono em funções úteis. | **Estratégia** — Use perto do aliado que quer recrutar ou de uma colônia enfraquecida. Exsudato é recurso: escolha o lugar. |

### Inoculação

| # | Atual | Novo |
|---|---|---|
| 1 | **O que significa?** — Inocular é introduzir deliberadamente um microrganismo em um ambiente, superfície ou hospedeiro. No campo, isso pode ser feito em sementes, sulcos, solo ou plantas. | **O que significa?** — Inocular é aplicar microrganismos a sementes, solo ou plantas. Para funcionar, eles precisam sobreviver e se estabelecer. |
| 2 | **Poder no jogo** — Depois de recrutar um organismo, transporte-o até a raiz ou plataforma desejada e pressione E. O resultado depende da espécie e do local escolhido.<br>• Rhizobium precisa de uma raiz compatível para formar nódulos.<br>• Bacillus constrói biofilmes protetores.<br>• Pseudomonas explora ferro e reduz a força de competidores.<br>• Trichoderma cresce em direção a alvos expostos. | **Poder no jogo** — Recrute um aliado, leve-o até a raiz certa e aperte E. O resultado depende da espécie e do lugar.<br>• Rhizobium precisa de raiz compatível.<br>• Bacillus constrói biofilmes protetores. |
| 3 | **Escolha antes de agir** — Inocular não é apenas soltar um personagem. Pergunte: qual raiz está ameaçada, qual função está faltando e onde o organismo terá alimento para permanecer ativo? | **Escolha antes de agir** — Pergunte: qual raiz está ameaçada, que função falta e onde o aliado terá alimento para continuar ativo? |
| 4 | **Estratégia** — Proteger uma raiz antes da invasão costuma custar menos do que recuperá-la depois. Distribua aliados em pontos úteis em vez de concentrar todos no mesmo lugar. | **Estratégia** — Proteger antes da invasão custa menos do que recuperar depois. Espalhe os aliados pelos pontos úteis. |

### Salto duplo

| # | Atual | Novo |
|---|---|---|
| 1 | **Novo movimento** — O segundo salto permite ganhar altura ou corrigir a trajetória quando Miguelito já está no ar. Ele abre rotas que antes pareciam impossíveis. | **Novo movimento** — O segundo salto, dado no ar, ganha altura ou corrige a trajetória. Ele abre rotas que pareciam impossíveis. |
| 2 | **Como usar** — Toque curto no botão de pulo para saltar; dois toques curtos para o salto duplo. Cada toque age na hora.<br>• Use o segundo salto cedo para ganhar altura.<br>• Use tarde para corrigir uma queda ou alcançar a borda.<br>• Manter o botão de pulo pressionado no ar aciona a propulsão, quando desbloqueada. | **Como usar** — Um toque no pulo salta; outro toque no ar faz o salto duplo.<br>• Cedo: mais altura.<br>• Tarde: corrige a queda ou alcança a borda. |
| 3 | **Metáfora biológica** — O salto duplo é uma mecânica de videogame. Ele simboliza as novas possibilidades de exploração criadas quando o sistema radicular desenvolve mais caminhos. | **Metáfora biológica** — O salto duplo é mecânica de videogame. Ele simboliza os novos caminhos que um sistema radicular maior oferece. |

### Dash

| # | Atual | Novo |
|---|---|---|
| 1 | **Novo movimento** — O dash lança Miguelito rapidamente na horizontal. Ele serve para atravessar vãos, escapar de ataques e alcançar plataformas antes que uma ameaça feche o caminho. | **Novo movimento** — O dash lança Miguelito na horizontal: cruza vãos, escapa de ataques e alcança plataformas antes do perigo. |
| 2 | **Como usar** — Escolha a direção e acione o dash durante a corrida ou no ar. Planeje onde vai aterrissar: velocidade sem destino pode levar direto para outro risco. | **Como usar** — Acione o dash correndo ou no ar, na direção escolhida. Planeje a aterrissagem antes de acelerar. |
| 3 | **Quando fica bloqueado** — Contaminação fúngica intensa ou o transporte de dois juvenis J2 pode impedir o dash temporariamente. Limpe a contaminação e livre-se dos passageiros indesejados. | **Quando fica bloqueado** — Contaminação forte ou dois J2 agarrados bloqueiam o dash. Limpe-se num biofilme e livre-se dos passageiros. |
| 4 | **Metáfora biológica** — O dash é uma mecânica de plataforma. No jogo, ele representa maior mobilidade em uma rede radicular funcional, não um processo literal da planta. | **Metáfora biológica** — O dash é mecânica de plataforma: representa mais mobilidade numa rede de raízes funcional. |

### Propulsão da Rizósfera

| # | Atual | Novo |
|---|---|---|
| 1 | **Decole com estratégia** — Mantenha o botão de pulo pressionado enquanto estiver no ar para pairar ou ganhar altura. Solte para economizar energia — pulsos curtos costumam render mais distância do que segurar sem parar.<br>• Toque curto ainda é só salto.<br>• É o TEMPO segurando no ar que aciona a propulsão. | **Decole com estratégia** — Segure o pulo no ar para pairar ou subir. Pulsos curtos rendem mais do que segurar sem parar.<br>• Toque curto continua sendo só salto. |
| 2 | **Recarregue na raiz** — Fique apoiado sobre uma raiz elegível. A saúde da raiz define o limite da carga, e organismos benéficos podem acelerar a recarga.<br>• Abaixo de 70% de saúde, a raiz não consegue fornecer energia.<br>• Raízes totalmente saudáveis podem completar o tanque. | **Recarregue na raiz** — Pare sobre uma raiz saudável para recarregar. Quanto mais saudável, mais carga.<br>• Abaixo de 70% de saúde, a raiz não recarrega. |
| 3 | **Rede de aliados** — Nódulos, Azospirillum, micorriza, Bacillus e Pseudomonas contribuem de maneiras diferentes para manter a raiz funcional. Uma comunidade equilibrada transforma o cenário em uma rede de recarga. | **Rede de aliados** — Nódulos, Azospirillum, micorriza, Bacillus e Pseudomonas mantêm as raízes saudáveis e a recarga funcionando. |
| 4 | **Metáfora biológica** — A mochila propulsora não existe no solo. Ela representa, como recurso de videogame, que raízes vigorosas sustentam mais atividade e abrem novas possibilidades na rizosfera. | **Metáfora biológica** — A mochila não existe no solo. Ela representa que raízes vigorosas sustentam mais atividade na rizosfera. |

### Pulso de solubilização

| # | Atual | Novo |
|---|---|---|
| 1 | **Selecione o poder** — Escolha Solubilização P no seletor. Somente essa opção transforma o comando E em uma ação de carregar, guardar e disparar. | **Selecione o poder** — Escolha Solubilização P no seletor (seta para baixo). Assim o E passa a carregar e disparar o pulso. |
| 2 | **Segure para carregar** — Segure E perto de uma colônia madura da cepa solubilizadora para carregar. A carga usa a reserva de metabólitos da colônia, que se recupera mais rápido quando recebe exsudatos.<br>• Solte o botão quando a carga estiver pronta.<br>• O pulso fica guardado: você não perde a carga ao soltar. | **Segure para carregar** — Segure E perto de uma colônia madura da cepa solubilizadora. Exsudatos recarregam a colônia mais rápido.<br>• Ao soltar, a carga fica guardada. |
| 3 | **Mova-se e dispare** — Com o pulso guardado, mova-se e mire livremente — andar, saltar e trocar de plataforma não gastam a carga. Toque E novamente para disparar na direção atual de Miguelito.<br>• A direção é a que Miguelito olha no momento do disparo.<br>• O efeito alcança depósitos de fosfato e libera o P pouco disponível. | **Mova-se e dispare** — Com a carga guardada, ande e salte à vontade. Toque E de novo para disparar para onde Miguelito olha.<br>• A bola de luz dissolve o fosfato do mineral. |
| 4 | **Complete a missão** — Solubilizar não significa transportar. O fosfato permanece no local até que uma rede micorrízica funcional o leve ao arbúsculo e à raiz.<br>• O pulso não elimina patógenos.<br>• Solubilização e transporte são tarefas diferentes. | **Complete a missão** — Missão: libere o fosfato e use a micorriza para levá-lo à raiz.<br>*continuação:* Na natureza, a raiz também pode absorver o fosfato diretamente.<br>• O pulso não elimina patógenos. |

### Saúde da raiz

| # | Atual | Novo |
|---|---|---|
| 1 | **Leia o estado da raiz** — Cada raiz possui saúde própria. A aparência, o fluxo interno e as barras indicam se ela está saudável, estressada, comprometida ou próxima do colapso.<br>• Saudável: 75–100%.<br>• Estressada: 50–74%.<br>• Comprometida: 25–49%.<br>• Em colapso: abaixo de 25%. | **Leia o estado da raiz** — Cada raiz tem saúde própria. Cor, fluxo e barra mostram se ela está bem ou perto do colapso.<br>• Saudável 75–100% · Estressada 50–74%<br>• Comprometida 25–49% · Colapso abaixo de 25% |
| 2 | **O que causa dano?** — Meloidogyne, Rhizoctonia, Ralstonia e outras pressões reduzem a função dos tecidos. Algumas deixam sequelas que diminuem até o máximo recuperável. | **O que causa dano?** — Meloidogyne, Rhizoctonia e Ralstonia prejudicam os tecidos. Algumas deixam sequelas que reduzem o máximo. |
| 3 | **O que ajuda?** — Nódulos ativos, arbúsculos, biofilmes e controle de patógenos favorecem a recuperação. Nenhum aliado resolve tudo sozinho: observe qual problema está ativo. | **O que ajuda?** — Nódulos e micorrizas ajudam na nutrição; biofilmes reduzem novos danos.<br>*continuação:* Nenhum aliado recupera na hora o tecido que já morreu. |
| 4 | **Saúde local e Vigor da Planta** — A saúde pertence a cada raiz. O Vigor da Planta reúne o resultado de todo o sistema e influencia a aparência da parte aérea e a futura colheita. | **Saúde local e Vigor** — A saúde é de cada raiz. O Vigor da Planta soma todo o sistema e aparece na parte aérea e na colheita. |

### Recuperação radicular

| # | Atual | Novo |
|---|---|---|
| 1 | **Sinais de recuperação** — Fluxos verde-dourados, retorno dos pelos e contorno mais vivo indicam que a raiz está recuperando função. A mudança é gradual, não instantânea. | **Sinais de recuperação** — Fluxo verde-dourado, pelos de volta e contorno vivo: a raiz está recuperando função, aos poucos. |
| 2 | **Como acontece no jogo** — Controle a causa do dano e mantenha os aliados adequados ativos. Nódulos ajudam no suporte metabólico, micorriza melhora aquisição e sustentação, e biofilmes reduzem novas agressões. | **Como acontece no jogo** — Controle os agressores e mantenha os aliados ativos para a raiz recuperar a função.<br>*continuação:* Tecido morto não se regenera: novas raízes podem compensar as perdas. |
| 3 | **Limites do reparo** — Uma raiz não ultrapassa seu máximo recuperável. Galhas maduras podem deixar sequelas permanentes, enquanto murcha vascular avançada reduz fortemente a capacidade de recuperação. | **Limites do reparo** — A raiz não passa do máximo recuperável. Galhas e murcha avançada deixam sequelas. |
| 4 | **Missão do jogador** — Não espere a plataforma começar a ceder. Interrompa a pressão, restaure o fluxo e estabilize a comunidade antes de seguir para a próxima região. | **Missão do jogador** — Não espere a plataforma ceder: tire a pressão, restaure o fluxo e estabilize a comunidade antes de seguir. |

### Perda de sustentação

| # | Atual | Novo |
|---|---|---|
| 1 | **Alerta de colapso** — Uma raiz criticamente comprometida pode afundar, oscilar e ceder sob Miguelito. Os sinais visuais aparecem antes da queda completa. | **Alerta de colapso** — Uma raiz muito comprometida afunda, oscila e cede sob Miguelito. Os sinais aparecem antes da queda. |
| 2 | **Base biológica** — Doenças radiculares prejudicam continuidade, resistência e função dos tecidos. O cedimento como plataforma é uma metáfora visual criada para tornar esse prejuízo jogável. | **Base biológica** — Doenças enfraquecem os tecidos da raiz. A plataforma que cede é a metáfora visual desse prejuízo. |
| 3 | **Consequência no jogo** — O apoio pode desaparecer por alguns instantes, interromper rotas e lançar Miguelito para áreas perigosas. | **Consequência no jogo** — O apoio some por instantes, corta rotas e pode jogar Miguelito em áreas perigosas. |
| 4 | **Como evitar** — Controle a causa do dano e favoreça estruturas que aumentem estabilidade, como micorriza madura. Uma raiz em colapso exige prioridade, não apenas passagem rápida. | **Como evitar** — Controle a causa do dano e favoreça a micorriza madura, que dá estabilidade. Raiz em colapso é prioridade. |

### Rhizobium

| # | Atual | Novo |
|---|---|---|
| 1 | **Um aliado especialista** — Rhizobium representa bactérias capazes de formar uma parceria muito próxima com leguminosas, como o feijoeiro. Quando existe compatibilidade, elas entram na raiz e participam da construção de um novo órgão: o nódulo.<br>• Nem todo Rhizobium funciona com qualquer planta.<br>• A parceria começa com reconhecimento químico. | **Um aliado especialista** — Rhizobium forma uma parceria com o feijoeiro. Quando há compatibilidade, a planta cria nódulos para abrigar as bactérias.<br>• Nem todo Rhizobium serve para qualquer planta. |
| 2 | **A raiz abre o caminho** — Sinais liberados pela raiz atraem células compatíveis. Um pelo radicular se curva, e a planta produz um fio de infecção que conduz as bactérias para o interior enquanto o primórdio do nódulo começa a crescer. | **A raiz abre o caminho** — A raiz libera sinais; rizóbios compatíveis respondem com fatores Nod. O pelo radicular se curva e forma um fio de infecção. |
| 3 | **Fábrica viva de nitrogênio** — No nódulo maduro, as bactérias tornam-se bacteroides. A nitrogenase converte N₂ atmosférico em compostos nitrogenados usados pela planta para produzir aminoácidos, proteínas e outras moléculas essenciais.<br>• A planta fornece açúcares e energia.<br>• A leghemoglobina ajuda a controlar o oxigênio. | **Fábrica viva de nitrogênio** — Nos nódulos, a nitrogenase dos bacteroides transforma N₂ em amônia. A planta recebe nitrogênio e fornece carbono.<br>• A leghemoglobina ajuda a controlar o oxigênio. |
| 4 | **Poder no jogo** — Recrute Rhizobium, leve-o até uma raiz compatível e inocule. O nódulo cresce por etapas; quando fica ativo, favorece a recuperação da raiz e aumenta o Vigor da Planta. | **Poder no jogo** — Recrute Rhizobium, leve até uma raiz e inocule. O nódulo cresce por etapas e, ativo, recupera a raiz e o Vigor. |
| 5 | **Estratégia** — Mantenha exsudatos disponíveis e preserve o transporte da raiz. Um nódulo pode estar maduro e ainda assim perder atividade quando falta carbono ou quando a murcha vascular interrompe o abastecimento.<br>• Proteja a raiz durante a formação do nódulo.<br>• Azospirillum pode reforçar a parceria, mas não substitui Rhizobium. | **Estratégia** — Mantenha exsudatos e proteja a raiz. Sem carbono ou com murcha vascular, o nódulo maduro para de fixar.<br>• Azospirillum ajuda, mas não substitui Rhizobium. |

### Azospirillum

| # | Atual | Novo |
|---|---|---|
| 1 | **Morador da superfície** — Azospirillum representa bactérias associativas que vivem no rizoplano e no solo próximo à raiz. Ao contrário de Rhizobium, elas não precisam construir nódulos para permanecer perto da planta. | **Morador da superfície** — Azospirillum vive no rizoplano e no solo junto à raiz. Diferente de Rhizobium, não forma nódulos. |
| 2 | **Arquiteto do sistema radicular** — Algumas estirpes produzem ou alteram sinais semelhantes a fitormônios. Isso pode estimular raízes laterais e pelos radiculares, ampliando a área explorada pela planta. | **Arquiteto das raízes** — Algumas estirpes de Azospirillum produzem AIA, um fitormônio que pode estimular raízes laterais e pelos radiculares. |
| 3 | **Poder no jogo** — Depois da inoculação, novas ramificações crescem como uma escada viva. Cada segmento só sustenta Miguelito quando completa sua maturação. | **Poder no jogo** — Depois da inoculação, ramificações crescem como uma escada viva. Cada degrau só aguenta Miguelito quando maduro. |
| 4 | **Ajuda com nitrogênio** — A fixação associativa pode contribuir com pequenas quantidades de nitrogênio, mas não equivale à FBN de um nódulo. Na mesma região, Azospirillum pode favorecer o desempenho de Rhizobium. | **Ajuda com nitrogênio** — Azospirillum fixa um pouco de nitrogênio, bem menos que um nódulo. Perto de Rhizobium, pode ajudar a parceria. |
| 5 | **Estratégia** — Inocule onde novas rotas são necessárias e use exsudatos para orientar o crescimento. Proteja a raiz jovem até que as ramificações estejam maduras e estáveis. | **Estratégia** — Inocule onde precisa de uma nova rota e use exsudatos para guiar o crescimento. Proteja a raiz jovem. |

### Micorriza arbuscular

| # | Atual | Novo |
|---|---|---|
| 1 | **Uma parceria obrigatória** — Fungos micorrízicos arbusculares formam uma associação íntima com raízes. Eles dependem de uma planta hospedeira para completar o ciclo e recebem carbono produzido pela fotossíntese. | **Uma parceria obrigatória** — Fungos micorrízicos arbusculares vivem associados às raízes e dependem do carbono da planta para completar o ciclo. |
| 2 | **Exploradora do solo** — Hifas muito finas avançam além da região alcançada pelos pelos radiculares. Essa rede encontra pequenos espaços e nutrientes pouco móveis, especialmente fósforo. | **Exploradora do solo** — Hifas finíssimas vão além dos pelos radiculares e alcançam nutrientes pouco móveis, sobretudo fósforo. |
| 3 | **Centro de trocas** — Dentro das células do córtex, o fungo forma arbúsculos highly ramificados. Neles, planta e fungo trocam nutrientes através de uma grande área de contato. | **Centro de trocas** — Dentro do córtex, o fungo forma arbúsculos muito ramificados. Neles, a planta recebe nutrientes e entrega carbono. |
| 4 | **Poder no jogo** — A rede micorrízica forma pontes horizontais e transporta fosfato liberado até o arbúsculo e a raiz. Arbúsculos maduros também ajudam na recuperação e estabilidade. | **Poder no jogo** — A rede forma pontes horizontais e leva fosfato até a raiz. Arbúsculos maduros ajudam a recuperar a raiz. |
| 5 | **Ciência e metáfora** — Hifas reais conectam regiões e transportam recursos, mas não sustentariam uma pessoa. As pontes são uma metáfora de plataforma para tornar a rede visível e explorável. | **Ciência e metáfora** — Hifas reais ligam regiões e transportam recursos, mas não aguentariam uma pessoa. As pontes são metáfora. |

### Bacillus

| # | Atual | Novo |
|---|---|---|
| 1 | **Um sobrevivente microscópico** — Bacillus representa bactérias capazes de formar endósporos. Quando o ambiente fica desfavorável, algumas células entram em um estado resistente e aguardam condições melhores. | **Um sobrevivente** — Algumas células de Bacillus sobrevivem ao estresse formando endósporos. Com condições melhores, germinam.<br>• Endósporo é sobrevivência, não reprodução. |
| 2 | **Fortaleza microbiana** — Células ativas podem aderir à raiz e produzir uma matriz coletiva: o biofilme. Algumas estirpes também liberam compostos antimicrobianos e estimulam respostas de defesa da planta. | **Fortaleza microbiana** — Células ativas aderem à raiz e produzem uma matriz coletiva: o biofilme. Algumas estirpes também ativam defesas. |
| 3 | **Poder no jogo** — Biofilmes maduros protegem ferimentos, reduzem o avanço de patógenos, repelem J2, limpam contaminação de Miguelito e funcionam como pontos de retorno. | **Poder no jogo** — No jogo, biofilmes maduros protegem ferimentos, repelem J2, reduzem patógenos e limpam Miguelito.<br>• Biofilme também é ponto de retorno (checkpoint). |
| 4 | **Alimente a defesa** — Exsudatos fornecem carbono para crescimento e manutenção. Sem alimento, a colônia perde atividade e pode esporular, reduzindo temporariamente a proteção. | **Alimente a defesa** — Exsudatos alimentam a colônia. Sob estresse, Bacillus reduz a atividade ou forma endósporos.<br>*continuação:* Com recursos de novo, a proteção retorna. |
| 5 | **Estratégia** — Posicione Bacillus antes da invasão, especialmente sobre ferimentos e rotas de entrada. Uma barreira pronta é mais eficiente do que tentar reconstruí-la durante o ataque. | **Estratégia** — Posicione Bacillus antes da invasão, sobre ferimentos e rotas de entrada. Barreira pronta vale mais. |

### Pseudomonas

| # | Atual | Novo |
|---|---|---|
| 1 | **Exploradora veloz** — Pseudomonas representa bactérias móveis da rizosfera. Algumas estirpes fluorescentes produzem sideróforos, moléculas com grande capacidade de capturar ferro. | **Exploradora veloz** — Pseudomonas são bactérias móveis da rizosfera. Algumas produzem sideróforos, moléculas que capturam ferro. |
| 2 | **Disputa por um recurso raro** — O ferro é essencial, mas costuma estar pouco disponível. Ao recuperá-lo, Pseudomonas melhora sua própria competitividade e pode limitar organismos que dependem do mesmo recurso. | **Disputa por ferro** — O ferro é essencial e escasso. Ao capturá-lo, Pseudomonas fica mais forte e limita quem depende dele. |
| 3 | **Poder no jogo** — A colônia envia sideróforos até depósitos de Fe³⁺. Quando eles retornam com ferro, formam uma reserva que enfraquece fungos e ajuda a suprimir ou conter ameaças próximas. | **Poder no jogo** — A colônia envia sideróforos aos depósitos de Fe³⁺. O ferro trazido forma uma reserva que enfraquece fungos. |
| 4 | **Não é ataque direto** — Pseudomonas não precisa destruir o inimigo. Ela muda o campo de batalha, deixando menos ferro disponível e reduzindo crescimento, aderência ou agressividade. | **Não é ataque direto** — Capturar ferro pode enfraquecer alguns competidores sem matá-los. Pseudomonas muda a disputa a seu favor. |
| 5 | **Estratégia** — Inocule perto de raízes ameaçadas e de depósitos alcançáveis. Dê tempo para os sideróforos completarem a viagem antes que a doença avance. | **Estratégia** — Inocule perto de raízes ameaçadas e de depósitos de ferro. Dê tempo para os sideróforos irem e voltarem. |

### Trichoderma

| # | Atual | Novo |
|---|---|---|
| 1 | **Fungo aliado** — Trichoderma reúne fungos filamentosos comuns no solo e na rizosfera. Suas hifas crescem, ramificam e exploram o ambiente em busca de espaço, nutrientes e possíveis alvos. | **Fungo aliado** — Trichoderma reúne fungos comuns no solo. Suas hifas exploram o ambiente em busca de espaço, alimento e alvos. |
| 2 | **Arsenal de biocontrole** — Dependendo da espécie e da estirpe, pode competir por recursos, produzir metabólitos e enzimas ou realizar micoparasitismo: reconhecer e atacar outro fungo. | **Arsenal de biocontrole** — Conforme a estirpe, compete por recursos, produz enzimas ou faz micoparasitismo: reconhece e ataca outro fungo. |
| 3 | **Poder no jogo** — Hifas procuram Rhizoctonia, fungos oportunistas, massas de ovos e J2 ainda expostos. Cada ataque consome atividade da colônia, que precisa de recursos para continuar. | **Poder no jogo** — As hifas caçam Rhizoctonia, fungos oportunistas, massas de ovos e J2 expostos. Cada ataque gasta atividade. |
| 4 | **Escolha o alvo certo** — Trichoderma atua melhor contra estruturas acessíveis. Ele não alcança uma fêmea de Meloidogyne protegida dentro da raiz e não é o controle correto para Ralstonia, que é bactéria. | **Escolha o alvo certo** — Trichoderma não alcança a fêmea de Meloidogyne dentro da raiz e não controla Ralstonia, que é bactéria. |
| 5 | **Estratégia** — Mantenha a colônia alimentada e aproxime-a do alvo. Bacillus e Pseudomonas podem enfraquecer o campo inimigo e reduzir o custo do ataque. | **Estratégia** — Mantenha a colônia alimentada e perto do alvo. Bacillus e Pseudomonas enfraquecem o inimigo antes. |

### Bacillus — cepa solubilizadora

| # | Atual | Novo |
|---|---|---|
| 1 | **Uma habilidade de cepa** — Nem todo Bacillus solubiliza fósforo com a mesma eficiência. Esta fase apresenta uma cepa especializada, diferente das colônias protetoras comuns. | **Uma habilidade de cepa** — Nem todo Bacillus solubiliza fósforo. Esta fase apresenta uma cepa especializada nisso. |
| 2 | **Química ao redor do mineral** — Ácidos orgânicos, prótons e outros metabólitos alteram o microambiente do depósito. Com isso, parte do fosfato pouco disponível é liberada gradualmente. | **Química do mineral** — Ácidos orgânicos e prótons mudam o ambiente do mineral e liberam, aos poucos, o fosfato preso. |
| 3 | **Carregue o poder** — Uma colônia madura acumula uma reserva própria de metabólitos. Exsudatos aceleram a produção; dormência e endósporos interrompem o abastecimento. | **Carregue o poder** — A colônia madura acumula metabólitos para o pulso. Exsudatos aceleram; dormência e endósporos interrompem. |
| 4 | **Poder no jogo** — Use a reserva para carregar e disparar o pulso de solubilização. O alvo correto é o depósito de fosfato, não um patógeno. | **Poder no jogo** — Use a reserva para carregar e disparar o pulso. O alvo é o depósito de fosfato, não um patógeno. |
| 5 | **Trabalho em equipe** — A cepa solubiliza o P, mas não o entrega à planta. Depois da liberação, a micorriza precisa transportar o fosfato até o arbúsculo e à raiz. | **Trabalho em equipe** — Nesta fase, a bactéria libera fosfato e a micorriza o leva à raiz.<br>*continuação:* Na natureza, a raiz também pode absorver o fosfato diretamente. |

### Fungo oportunista

| # | Atual | Novo |
|---|---|---|
| 1 | **Invasor de oportunidade** — Este cartão representa fungos que se beneficiam de ferimentos, estresse ou desequilíbrio. Eles não precisam ser os primeiros causadores do dano: podem aproveitar uma raiz já vulnerável. | **Invasor de oportunidade** — Fungos oportunistas aproveitam ferimentos, estresse e desequilíbrio. Atacam raízes já enfraquecidas. |
| 2 | **Rede em expansão** — As hifas crescem pelas pontas e formam ramificações laterais. Perto de um alvo, a rede se torna mais densa; partes maduras podem liberar novos esporos. | **Rede em expansão** — As hifas crescem pelas pontas e ramificam. Perto de um alvo a rede adensa e solta novos esporos. |
| 3 | **Perigo para Miguelito** — Hifas e esporos aderem à roupa e às pernas. A contaminação reduz aceleração, velocidade e salto; em níveis altos, também retira Vitalidade aos poucos. | **Perigo para Miguelito** — Hifas grudam na roupa e nas pernas. A contaminação deixa Miguelito lento e, alta, tira Vitalidade. |
| 4 | **Como escapar** — Afaste-se da rede e procure um biofilme de Bacillus para limpeza mais rápida. Mais tarde, Pseudomonas pode reduzir o vigor do fungo pela competição por ferro. | **Como escapar** — Afaste-se da rede e passe num biofilme de Bacillus para se limpar. Pseudomonas enfraquece o fungo. |
| 5 | **Estratégia** — Não atravesse o centro da colônia sem uma rota de saída. Reduzir a fonte de esporos é melhor do que apenas limpar Miguelito repetidamente. | **Estratégia** — Não atravesse o centro da colônia sem saída. Enfraquecer a fonte vale mais do que se limpar toda hora. |

### Rhizoctonia

| # | Atual | Novo |
|---|---|---|
| 1 | **Patógeno persistente** — Rhizoctonia representa fungos de solo capazes de sobreviver como micélio e estruturas resistentes. Quando encontram tecido favorável, retomam o crescimento e iniciam a infecção. | **Patógeno persistente** — Rhizoctonia sobrevive no solo como micélio e estruturas resistentes. Achando tecido favorável, infecta. |
| 2 | **Ataque à superfície** — As hifas avançam sobre a raiz, formam estruturas de infecção e degradam o tecido. As lesões reduzem a saúde e ainda podem abrir portas para outros invasores. | **Ataque à superfície** — As hifas formam estruturas de infecção e degradam o tecido. As lesões abrem portas para outros invasores. |
| 3 | **Poder inimigo** — No jogo, o foco se espalha pela plataforma, reduz a saúde da raiz e lança investidas hifais contra Miguelito. Quanto mais tempo permanece ativo, maior o território perdido. | **Poder inimigo** — O foco se espalha pela raiz, tira saúde e lança investidas de hifas contra Miguelito. |
| 4 | **Equipe de controle** — Bacillus forma uma barreira local, Pseudomonas reduz vigor por competição, e Trichoderma realiza micoparasitismo. Cada aliado ataca uma parte diferente do problema. | **Equipe de controle** — Bacillus forma barreira, Pseudomonas tira vigor e Trichoderma ataca o fungo. Cada um age numa frente. |
| 5 | **Estratégia** — Interrompa as bordas de expansão antes de enfrentar o centro. Feridas deixadas por Rhizoctonia também podem permitir a entrada de Ralstonia, por isso o tempo importa. | **Estratégia** — Contenha as bordas antes do centro. Feridas de Rhizoctonia podem deixar Ralstonia entrar: o tempo conta. |

### Ralstonia

| # | Atual | Novo |
|---|---|---|
| 1 | **A porta é o ferimento** — Ralstonia representa o complexo de espécies associado à murcha bacteriana. Ela sobrevive no solo e na água e não perfura uma raiz íntegra: usa ferimentos como porta de entrada.<br>• Lesões de nematoides e Rhizoctonia aumentam o risco.<br>• Enquanto está na superfície, ainda é possível bloquear a invasão. | **Portas de entrada** — Ralstonia sobrevive no solo e causa murcha. Entra por ferimentos ou pontos frágeis, como a saída de raízes laterais.<br>• Lesões de nematoides e fungos aumentam o risco.<br>• Na superfície, ainda dá para barrar a invasão. |
| 2 | **Ponto sem volta** — Ao alcançar o xilema, a bactéria se multiplica dentro dos vasos condutores. No jogo, a infecção interna não pode ser apagada: a missão muda de prevenir para conter.<br>• A carga vascular pode diminuir, mas nunca volta a zero.<br>• Trichoderma não é o controle correto, pois Ralstonia é bactéria. | **Ponto sem volta** — No xilema, a bactéria se multiplica nos vasos. No jogo, a missão muda de prevenir para conter.<br>• No jogo, a carga vascular pode cair, mas não zera.<br>• Trichoderma não controla bactéria. |
| 3 | **Encanamento obstruído** — Células bacterianas e exopolissacarídeos ocupam os vasos. A planta murcha mesmo com água no solo porque o transporte interno foi bloqueado.<br>• Menos transporte reduz FBN e recuperação.<br>• Em estado crítico, a raiz perde estabilidade. | **Encanamento obstruído** — No xilema, Ralstonia se multiplica e produz exopolissacarídeos.<br>*continuação:* Isso e as respostas da planta prejudicam o fluxo de água e causam a murcha.<br>• Menos transporte reduz FBN e recuperação. |
| 4 | **Defesa em duas linhas** — Bacillus protege ferimentos com uma barreira local. Pseudomonas reduz a pressão e ajuda na contenção. Juntos, podem impedir a entrada ou manter uma raiz infectada ainda funcional. | **Defesa em duas linhas** — No jogo, Bacillus protege áreas vulneráveis e Pseudomonas reduz a pressão bacteriana.<br>*continuação:* Juntos, ajudam a evitar a invasão e a conter o avanço. |
| 5 | **Bloqueie a disseminação** — Uma raiz muito colonizada pode liberar bactérias e ameaçar outra raiz ferida. O jogo avisa antes da chegada: proteja o alvo durante essa janela para cancelar a nova infecção. | **Bloqueie a disseminação** — Uma raiz muito colonizada pode ameaçar outra. O jogo avisa antes: proteja a raiz-alvo nessa janela. |

### Meloidogyne — juvenil J2

| # | Atual | Novo |
|---|---|---|
| 1 | **O invasor móvel** — J2 é o juvenil infectivo do nematoide-das-galhas. Ele eclode da massa de ovos e se desloca pelo solo em busca de sinais liberados por uma raiz hospedeira. | **O invasor móvel** — O J2 é o juvenil infectivo do nematoide-das-galhas. Ele eclode e procura no solo os sinais de uma raiz. |
| 2 | **Entrada na raiz** — Ao encontrar a raiz, o J2 penetra o tecido e migra até escolher um local de alimentação. Ali induz células gigantes que passam a fornecer recursos ao nematoide. | **Entrada na raiz** — O J2 penetra a raiz e escolhe um lugar para se alimentar. Ali induz células gigantes que o alimentam. |
| 3 | **Poder inimigo** — J2 livres procuram raízes e podem aderir à roupa de Miguelito como transporte passivo. Depois da penetração, iniciam uma galha e ficam protegidos pelo tecido. | **Poder inimigo** — J2 livres procuram raízes e podem se agarrar em Miguelito. Dentro da raiz, iniciam uma galha. |
| 4 | **Janela de controle** — Bacillus pode reduzir atração e penetração. Trichoderma pode interceptar apenas juvenis ainda expostos. Depois que entram, perseguir o J2 deixa de ser uma opção. | **Janela de controle** — Bacillus reduz a penetração; Trichoderma só pega J2 expostos. Depois que entram, não dá mais para alcançar. |
| 5 | **Estratégia** — Priorize massas de ovos e rotas próximas às raízes. Um único J2 evitado agora pode impedir uma galha, uma fêmea adulta e muitos novos ovos depois. | **Estratégia** — Priorize massas de ovos perto das raízes. Um J2 evitado agora impede uma galha e muitos ovos depois. |

### Meloidogyne — fêmea adulta

| # | Atual | Novo |
|---|---|---|
| 1 | **Escondida no tecido** — Após estabelecer o sítio de alimentação, a fêmea cresce muito e permanece sedentária dentro da raiz. Seu corpo fica protegido enquanto continua retirando recursos da planta. | **Escondida no tecido** — Depois de instalar o sítio de alimentação, a fêmea cresce e fica parada dentro da raiz, protegida. |
| 2 | **Uma central de drenagem** — As células gigantes permanecem metabolicamente ativas e desviam água, nutrientes e fotoassimilados. A região alterada também prejudica o funcionamento dos tecidos próximos. | **Uma central de drenagem** — As células gigantes alimentam a fêmea com recursos da planta. Essa drenagem e as alterações prejudicam a raiz. |
| 3 | **Poder inimigo** — No jogo, a fêmea reduz a recuperação, diminui permanentemente a saúde máxima da raiz e prepara uma nova massa de ovos. | **Poder inimigo** — A fêmea reduz a recuperação, baixa de vez a saúde máxima da raiz e prepara uma nova massa de ovos. |
| 4 | **Por que não dá para atacar?** — Trichoderma não alcança a fêmea protegida dentro da raiz. O momento decisivo ocorre antes: na massa de ovos, durante a eclosão e enquanto o J2 ainda está fora. | **Por que não dá para atacar?** — Trichoderma não alcança a fêmea dentro da raiz. A hora certa é antes: ovos, eclosão e J2 no solo. |
| 5 | **Estratégia** — Trate cada fêmea como uma sequela já instalada. Controle as próximas gerações e proteja as raízes ainda livres para impedir que o ciclo se repita. | **Estratégia** — Trate cada fêmea como sequela. Controle a próxima geração e proteja as raízes ainda livres. |

### Nódulo radicular

| # | Atual | Novo |
|---|---|---|
| 1 | **Não é uma bolinha grudada** — O nódulo é um órgão novo formado pela própria raiz durante a simbiose com bactérias compatíveis. Ele possui tecidos organizados e conexão com o sistema vascular da planta. | **Não é uma bolinha grudada** — O nódulo é um órgão novo, formado pela raiz na simbiose. Tem tecidos próprios e ligação com os vasos. |
| 2 | **Abrigo de alta tecnologia biológica** — Dentro do nódulo, bactérias diferenciadas em bacteroides realizam FBN. A planta fornece carbono e cria condições para a nitrogenase funcionar sem excesso de oxigênio. | **Abrigo especial** — Dentro do nódulo, bacteroides fixam N₂. A planta dá carbono e controla o oxigênio para a nitrogenase. |
| 3 | **Poder no jogo** — O nódulo cresce por estágios. Quando amadurece e permanece ativo, ajuda a recuperar a raiz e aumenta o Vigor da Planta. | **Poder no jogo** — O nódulo cresce por estágios. Maduro e ativo, recupera a raiz e aumenta o Vigor da Planta. |
| 4 | **Maduro não significa ativo** — Falta de carbono, danos na raiz ou murcha vascular podem desligar a atividade mesmo sem destruir o nódulo. Observe o fluxo e o estado da estrutura. | **Maduro não é ativo** — Falta de carbono, dano na raiz ou murcha podem desligar o nódulo sem destruí-lo. Observe o fluxo. |

### Fixação biológica de nitrogênio

| # | Atual | Novo |
|---|---|---|
| 1 | **Um gás difícil de usar** — O ar contém muito N₂, mas a planta não consegue aproveitar diretamente essa molécula estável. Certos microrganismos possuem o complexo nitrogenase, capaz de iniciar sua conversão. | **Um gás difícil de usar** — O ar tem muito N₂, mas a planta não consegue usá-lo diretamente. Certas bactérias têm nitrogenase, que o transforma em amônia. |
| 2 | **Dentro do nódulo** — A nitrogenase exige muita energia e é sensível ao oxigênio. A leghemoglobina ajuda a manter oxigênio suficiente para a respiração, mas baixo o bastante para proteger o processo. | **Dentro do nódulo** — A nitrogenase gasta muita energia e não tolera oxigênio. A leghemoglobina mantém o oxigênio na medida. |
| 3 | **Da atmosfera para a planta** — O nitrogênio fixado entra em rotas metabólicas e ajuda na formação de aminoácidos, proteínas, ácidos nucleicos e clorofila. | **Da atmosfera à planta** — O nitrogênio fixado vira aminoácidos, proteínas, ácidos nucleicos e clorofila. |
| 4 | **Efeito no jogo** — FBN ativa contribui para recuperação da raiz, pontuação ecológica e Vigor da Planta. Compatibilidade, carbono, saúde e transporte vascular determinam quanto o nódulo consegue produzir. | **Efeito no jogo** — FBN ativa recupera a raiz e aumenta pontuação e Vigor. Carbono, saúde e transporte definem quanto se fixa. |

### Biofilme

| # | Atual | Novo |
|---|---|---|
| 1 | **Cidade microscópica** — Um biofilme é uma comunidade de células aderidas a uma superfície e envolvidas por uma matriz produzida pelos próprios microrganismos. | **Cidade microscópica** — Biofilme é uma comunidade de células grudadas numa superfície, envolvidas por uma matriz que elas produzem. |
| 2 | **Por que viver em grupo?** — A matriz melhora permanência, comunicação e resistência a variações ambientais. Ela também mantém células e moléculas úteis próximas da raiz. | **Por que viver em grupo?** — A matriz ajuda a ficar, a se comunicar e a resistir a mudanças. E mantém células úteis junto à raiz. |
| 3 | **Poder no jogo** — Biofilmes maduros de Bacillus protegem ferimentos, repelem J2, reduzem patógenos, limpam Miguelito e funcionam como checkpoints. | **Poder no jogo** — Biofilmes maduros protegem ferimentos, repelem J2, reduzem patógenos, limpam Miguelito e são checkpoints. |
| 4 | **Mantenha a fortaleza** — A proteção aumenta durante a maturação. Sem carbono, a colônia perde atividade e pode formar endósporos, deixando a barreira temporariamente mais fraca. | **Mantenha a fortaleza** — A proteção cresce com a maturação. Sob estresse, a colônia perde atividade e a barreira enfraquece. |

### Sideróforo

| # | Atual | Novo |
|---|---|---|
| 1 | **Um gancho químico** — Sideróforos são moléculas secretadas quando o ferro está pouco disponível. Elas se ligam fortemente ao Fe³⁺ e formam um complexo que pode ser recuperado pela célula produtora. | **Um gancho químico** — Sideróforos são moléculas liberadas quando falta ferro. Prendem o Fe³⁺ e voltam a ser captadas pela célula. |
| 2 | **Missão de busca** — A molécula sai da colônia, encontra o depósito, captura ferro e retorna. Esse percurso transforma um processo químico invisível em uma missão visível no jogo. | **Missão de busca** — No jogo, o sideróforo vai buscar ferro e volta. Na natureza, ele se difunde, liga Fe³⁺ e é captado como complexo. |
| 3 | **Efeito ecológico** — Capturar ferro beneficia o produtor e muda a competição. Organismos que não conseguem usar o complexo encontram menos ferro livre para crescer. | **Efeito ecológico** — Capturar ferro favorece o produtor. Quem não usa o complexo encontra menos ferro para crescer. |
| 4 | **Poder no jogo** — Sideróforos de Pseudomonas abastecem a reserva da colônia. Quanto melhor a reserva, maior a capacidade de reduzir o vigor de ameaças próximas. | **Poder no jogo** — Sideróforos abastecem a reserva de Pseudomonas. Reserva maior enfraquece mais as ameaças próximas. |

### Pseudomonas × fungo oportunista

| # | Atual | Novo |
|---|---|---|
| 1 | **O recurso disputado** — Depois que os sideróforos capturam Fe³⁺ e retornam à Pseudomonas, sobra menos ferro acessível ao fungo dentro daquela região. | **O recurso disputado** — Quando os sideróforos trazem Fe³⁺ para Pseudomonas, sobra menos ferro para o fungo naquela região. |
| 2 | **O inimigo perde força** — Com limitação de ferro, as hifas crescem mais devagar, ramificam menos e produzem menos esporos. A colônia continua existindo, mas fica menos agressiva. | **O inimigo perde força** — Sem ferro disponível, alguns fungos crescem menos e produzem menos esporos. Nem todos reagem igual. |
| 3 | **Efeito no jogo** — A aproximação e a aderência diminuem, a contaminação cresce mais lentamente e hifas já presas em Miguelito se soltam com maior facilidade. | **Efeito no jogo** — O fungo gruda menos, a contaminação sobe mais devagar e as hifas presas em Miguelito se soltam fácil. |
| 4 | **Lição estratégica** — Biocontrole nem sempre significa matar. Alterar recursos e relações ecológicas pode transformar uma passagem perigosa em uma área controlável. | **Lição estratégica** — Biocontrole nem sempre é matar. Mudar o acesso a recursos pode tornar uma passagem perigosa controlável. |

### Entrada pelo ferimento

| # | Atual | Novo |
|---|---|---|
| 1 | **A porta de entrada** — Ralstonia não perfura uma raiz íntegra. Lesões de nematoides, feridas de Rhizoctonia, rupturas de crescimento ou danos mecânicos criam acessos ao interior. | **A porta de entrada** — Ralstonia aproveita ferimentos de nematoides, fungos ou danos mecânicos.<br>*continuação:* Também pode entrar onde surgem raízes laterais, mesmo sem ferida visível. |
| 2 | **Contagem regressiva biológica** — Antes da entrada, a população cresce sobre a superfície. Esse intervalo é a janela de prevenção: depois que a bactéria alcança o xilema, a infecção não pode ser desfeita no jogo. | **Contagem regressiva** — Antes de entrar, a população cresce na superfície. Essa é a janela de prevenção. |
| 3 | **Feche a porta** — Coloque Bacillus sobre o ferimento para formar uma barreira local e use Pseudomonas para reduzir a pressão bacteriana ao redor. | **Feche a porta** — Ponha Bacillus sobre o ferimento para fazer uma barreira e use Pseudomonas para reduzir a pressão. |

### Obstrução do xilema

| # | Atual | Novo |
|---|---|---|
| 1 | **Invasão do vaso** — Dentro do xilema, Ralstonia se multiplica e produz exopolissacarídeos. Células e material viscoso passam a ocupar o espaço por onde a água deveria circular. | **Invasão do vaso** — No xilema, Ralstonia se multiplica e produz exopolissacarídeos que ocupam o caminho da água. |
| 2 | **Murcha com água no solo** — A raiz pode estar cercada de água e ainda assim a parte aérea murchar. O problema não é a fonte: é o transporte bloqueado por dentro. | **Murcha com água no solo** — A planta murcha mesmo com água ao redor: o problema é o transporte por dentro, não a fonte. |
| 3 | **Efeito em cadeia** — Menos fluxo reduz FBN, recuperação, recarga da propulsão e estabilidade da plataforma. Uma única obstrução afeta vários sistemas ao mesmo tempo. | **Efeito em cadeia** — Menos fluxo reduz FBN, recuperação, recarga da propulsão e estabilidade. Uma obstrução afeta tudo. |
| 4 | **Missão do jogador** — Depois da entrada, o objetivo é impedir que a carga continue crescendo. Conter preserva parte do transporte, mesmo sem eliminar a bactéria. | **Missão do jogador** — Depois da entrada, impeça a carga de crescer. Conter preserva parte do transporte. |

### Contenção vascular

| # | Atual | Novo |
|---|---|---|
| 1 | **A missão mudou** — Depois que Ralstonia entra no xilema, nenhum organismo do jogo elimina completamente a infecção. O desafio passa a ser manter a raiz funcional. | **A missão mudou** — Dentro do xilema, nenhum aliado do jogo elimina Ralstonia. O desafio é manter a raiz funcionando. |
| 2 | **Crescimento zero** — Bacillus e Pseudomonas sustentados podem fazer a população parar de aumentar e recuar um pouco. A carga vascular diminui, mas nunca volta a zero. | **Crescimento zero** — No jogo, Bacillus e Pseudomonas podem conter Ralstonia, sem eliminá-la.<br>*continuação:* Na planta real, uma infecção vascular instalada é difícil de controlar. |
| 3 | **O que é preservado** — Uma raiz contida mantém parte do transporte, da recuperação e da estabilidade. Isso pode ser suficiente para proteger nódulos, rotas e o Vigor da Planta. | **O que é preservado** — A raiz contida mantém parte do transporte e da estabilidade. Isso protege nódulos, rotas e o Vigor. |
| 4 | **Controle precisa continuar** — Se os aliados perdem atividade, a bactéria volta a avançar. Contenção é um equilíbrio mantido, não um troféu permanente. | **Controle contínuo** — Se os aliados enfraquecem, a bactéria volta a avançar. Contenção é equilíbrio, não troféu. |

### Disseminação bacteriana

| # | Atual | Novo |
|---|---|---|
| 1 | **Saída da raiz doente** — Uma raiz muito colonizada pode extravasar bactérias para o solo ao redor. Esse fluxo representa a exsudação bacteriana associada à murcha. | **Saída da raiz doente** — Uma raiz muito colonizada solta bactérias no solo ao redor. É a exsudação bacteriana da murcha. |
| 2 | **O alvo não é qualquer raiz** — A nova contaminação exige uma porta de entrada. Raízes íntegras resistem melhor; raízes feridas são os alvos vulneráveis. | **Qualquer raiz corre risco** — Raízes feridas são mais vulneráveis, mas Ralstonia também entra onde surgem raízes laterais.<br>• Sem ferida não significa sem risco. |
| 3 | **Alerta de chegada** — O jogo anuncia a ameaça antes da contaminação. Use esse tempo para proteger o ferimento com Bacillus e reforçar a supressão com Pseudomonas. | **Alerta de chegada** — O jogo avisa antes. Use o tempo para proteger a raiz-alvo com Bacillus e reforçar com Pseudomonas. |
| 4 | **Vitória preventiva** — Bloquear a disseminação evita que um foco local se transforme em problema de toda a fase. Defender a próxima raiz pode ser mais importante do que insistir na raiz já muito doente. | **Vitória preventiva** — Bloquear a disseminação evita que um foco vire problema da fase. Defender a próxima raiz pode valer mais. |

### Arbúsculo

| # | Atual | Novo |
|---|---|---|
| 1 | **Uma árvore dentro da célula** — O arbúsculo é uma estrutura hifal extremamente ramificada formada dentro de células do córtex radicular. Seu formato amplia muito a área de contato. | **Uma árvore na célula** — O arbúsculo é uma hifa muito ramificada dentro das células do córtex. O formato aumenta a área de troca. |
| 2 | **Troca sem invasão destrutiva** — A hifa fica envolvida pela membrana da célula hospedeira. Assim, fungo e planta trocam nutrientes sem que o fungo simplesmente destrua a célula. | **Troca sem destruir** — A hifa fica envolvida pela membrana da célula. Fungo e planta trocam nutrientes sem matar a célula. |
| 3 | **Poder no jogo** — Arbúsculos maduros recebem o fosfato trazido pela rede e o transferem à raiz. Eles também favorecem recuperação e sustentação. | **Poder no jogo** — Arbúsculos maduros recebem o fosfato da rede e o passam à raiz. Também ajudam na recuperação. |
| 4 | **Estrutura temporária** — Arbúsculos se formam, funcionam, envelhecem e são renovados. Uma micorriza ativa depende da manutenção contínua da associação. | **Estrutura temporária** — Arbúsculos se formam, funcionam, envelhecem e são renovados enquanto a associação continua. |

### Ponte micorrízica horizontal

| # | Atual | Novo |
|---|---|---|
| 1 | **Abra uma nova rota** — Exsudatos liberados perto da borda podem orientar o crescimento de uma ponte horizontal. Quando a estrutura amadurece, ela se torna atravessável. | **Abra uma nova rota** — Exsudatos perto da borda orientam o crescimento de uma ponte horizontal. Madura, ela pode ser atravessada. |
| 2 | **Inspiração biológica** — Hifas reais exploram poros, conectam regiões e transportam nutrientes pela rede. Essa capacidade de ligação inspirou a ponte do jogo. | **Inspiração biológica** — Hifas reais exploram poros, ligam regiões e transportam nutrientes. Isso inspirou a ponte do jogo. |
| 3 | **Metáfora de plataforma** — Uma hifa real não sustentaria Miguelito. A espessura e a resistência visíveis foram ampliadas para transformar conectividade microscópica em caminho jogável. | **Metáfora de plataforma** — Uma hifa real não aguentaria Miguelito. A ponte amplia a conexão microscópica num caminho jogável. |
| 4 | **Estratégia** — Procure outra plataforma ao alcance antes de gastar exsudato. Proteja a região enquanto o feixe cresce: a ponte só funciona depois da maturação. | **Estratégia** — Veja se há plataforma ao alcance antes de gastar exsudato. A ponte só funciona depois de madura. |

### Raiz lateral

| # | Atual | Novo |
|---|---|---|
| 1 | **Nasce por dentro** — Raízes laterais começam em tecidos internos da raiz principal. O primórdio cresce, atravessa as camadas externas e emerge como uma nova ramificação. | **Nasce por dentro** — A raiz lateral começa nos tecidos internos. O primórdio cresce, atravessa as camadas e emerge. |
| 2 | **Por que a planta cria novas raízes?** — Cada ramificação amplia a área explorada, cria novos pontos de absorção e oferece novas superfícies para a interação com microrganismos. | **Por que novas raízes?** — Cada ramificação explora mais solo, absorve mais e oferece novas superfícies para micróbios. |
| 3 | **Poder no jogo** — Azospirillum e exsudatos orientam o desenvolvimento. Quando a raiz lateral atinge 100%, passa a sustentar Miguelito e abre uma nova rota. | **Poder no jogo** — Azospirillum e exsudatos guiam o crescimento. Em 100%, a raiz lateral aguenta Miguelito e abre rota. |
| 4 | **Ciência e velocidade** — O jogo acelera um processo que, na planta, leva muito mais tempo. O uso como plataforma é uma metáfora visual do ganho de arquitetura. | **Ciência e velocidade** — O jogo acelera um processo bem mais lento. Usar a raiz como plataforma é metáfora. |

### Massa de ovos de Meloidogyne

| # | Atual | Novo |
|---|---|---|
| 1 | **A próxima geração** — A fêmea adulta deposita ovos em uma matriz gelatinosa associada à superfície da raiz. Essa massa protege e mantém juntos muitos descendentes. | **A próxima geração** — A fêmea deposita os ovos numa matriz gelatinosa na superfície da raiz, que os mantém juntos. |
| 2 | **O que acontece dentro?** — O desenvolvimento começa no ovo. O J1 realiza a primeira muda ainda protegido, e o J2 infectivo é o estágio que finalmente eclode. | **O que acontece dentro?** — O J1 faz a primeira muda ainda no ovo. Quem eclode é o J2, o estágio infectivo. |
| 3 | **Poder inimigo** — Cada massa pode liberar vários J2, multiplicando os pontos de invasão. Trichoderma pode envolver a massa, reduzir a eclosão e inviabilizar ovos gradualmente. | **Poder inimigo** — Cada massa libera vários J2. Trichoderma pode envolvê-la, reduzir a eclosão e inviabilizar ovos. |
| 4 | **Alvo prioritário** — Neutralizar uma massa evita várias perseguições futuras. No jogo, atacar a fonte costuma ser mais eficiente do que correr atrás de cada J2 separado. | **Alvo prioritário** — Neutralizar uma massa evita muitas perseguições. Atacar a fonte rende mais do que caçar cada J2. |

### Galha radicular

| # | Atual | Novo |
|---|---|---|
| 1 | **Não é um tumor comum** — A galha é o aumento do tecido associado ao sítio de alimentação induzido por Meloidogyne. Células gigantes especializadas passam a alimentar o nematoide. | **Como surge uma galha?** — O nematoide induz células gigantes que o alimentam. O tecido ao redor aumenta de volume e forma a galha. |
| 2 | **Custo para a planta** — A infecção desvia recursos, altera o fluxo de água e nutrientes e mantém uma região metabolicamente exigente dentro da raiz. | **Custo para a planta** — A galha desvia recursos, altera o fluxo de água e nutrientes e exige muito da raiz. |
| 3 | **Poder inimigo** — Galhas maduras reduzem permanentemente a saúde máxima da raiz. A penalidade aumenta quando a fêmea se desenvolve e inicia a oviposição. | **Poder inimigo** — Galhas maduras baixam de vez a saúde máxima da raiz, mais ainda quando a fêmea começa a pôr ovos. |
| 4 | **Por que prevenir?** — Eliminar J2 externos não desfaz uma galha já estabelecida. Proteger a raiz antes da penetração é a única forma de evitar essa sequela. | **Por que prevenir?** — Eliminar os J2 do solo não desfaz galhas já formadas. Proteger a raiz antes da invasão é a melhor estratégia. |

### Micoparasitismo

| # | Atual | Novo |
|---|---|---|
| 1 | **Caçada entre hifas** — Micoparasitismo ocorre quando um fungo encontra outro fungo e passa a explorá-lo como alvo. O reconhecimento acontece antes do contato direto. | **Caçada entre hifas** — Micoparasitismo é quando um fungo reconhece outro fungo e o usa como alvo, antes mesmo do contato. |
| 2 | **Cerco microscópico** — Trichoderma pode crescer em direção ao patógeno, aderir, enrolar-se nas hifas e liberar enzimas que degradam componentes da parede celular. | **Cerco microscópico** — Trichoderma cresce até o patógeno, se enrola nas hifas e libera enzimas que degradam a parede celular. |
| 3 | **Poder no jogo** — A hifa verde alcança Rhizoctonia, reduz sua colonização e conclui a lise se a colônia mantiver atividade suficiente durante o ataque. | **Poder no jogo** — A hifa verde alcança a Rhizoctonia e conclui a lise se a colônia mantiver atividade suficiente. |
| 4 | **Trabalho em equipe** — Bacillus e Pseudomonas enfraquecem o foco de outras maneiras. Quando o alvo já está pressionado, Trichoderma gasta menos atividade para completar o ataque. | **Trabalho em equipe** — Com Bacillus e Pseudomonas enfraquecendo o foco, Trichoderma gasta menos para completar o ataque. |

## 5. Narrações

- `azo.coinoculation`: Co-inoculação pode favorecer a FBN
- `bacillus.reactivation`: Exsudatos estimularam a germinação
- `ralst.neutralized`: Ralstonia barrada antes do xilema
- `ralst.spread-blocked-healed`: Disseminação contida: raiz protegida
