// Revisao dos cartoes didaticos (20/10/2026). DADOS, ainda nao ligados ao jogo.
//
// Regras (verificadas em tests/tutorial-text-revision.test.js):
//   - corpo de cada pagina: ate 140 caracteres (duas frases curtas);
//   - no maximo 2 topicos por pagina, cada um com ate 60 caracteres;
//   - titulo com ate 32 caracteres;
//   - `more`: paginas de continuacao (mesmas regras). Elas aparecem logo depois
//     da pagina de origem e herdam o mesmo indice: os desbloqueios do manifesto
//     (pageUnlocks) continuam valendo sem remapear nada.
//
// Base: revisao do GPT (Miguelito_Ajustes_Enxutos.json), com as 27 correcoes
// cientificas aplicadas; as tres longas demais foram divididas. As demais
// paginas foram enxugadas para caber no limite.

export const TEXT_LIMITS = Object.freeze({ title: 32, body: 140, points: 2, point: 60 });

const p = (title, body, points = [], more = []) => ({ title, body, points, more });
const m = (body, points = []) => ({ body, points });

export const PAGE_REVISION = {
  'system-welcome': [
    p('Bem-vindo à rizosfera', 'Você encolheu até virar um micróbio! A rizosfera é o solo junto às raízes, onde micróbios competem, cooperam e influenciam a planta.'),
    p('Cartões de descoberta', 'Quando algo novo aparece, o jogo pausa e abre um cartão. Nada se move enquanto você lê.',
      ['Use as setas para avançar ou voltar.', 'Os cartões descobertos ficam no GUIA.']),
    p('Ciência + videogame', 'Algumas ações são processos reais. Outras são metáforas de plataforma para tornar visível o que é microscópico.',
      ['O cartão diz o que é real e o que foi adaptado.']),
  ],
  'action-exudate': [
    p('Pacotes químicos da raiz', 'Exsudatos são açúcares, aminoácidos, ácidos orgânicos e sinais liberados pela raiz. Eles agitam a vida ao redor dela.'),
    p('Alimento e mensagem', 'Exsudatos alimentam micróbios e funcionam como sinais: a raiz influencia quem se aproxima e quem fica.',
      ['Atraem aliados benéficos.', 'Também atraem invasores, como juvenis de nematoides.']),
    p('Poder no jogo', 'Colete as gotas verdes e aperte E para liberar um exsudato. Ele recruta micróbios e alimenta colônias.'),
    p('Estratégia', 'Use perto do aliado que quer recrutar ou de uma colônia enfraquecida. Exsudato é recurso: escolha o lugar.'),
  ],
  'action-inoculation': [
    p('O que significa?', 'Inocular é aplicar microrganismos a sementes, solo ou plantas. Para funcionar, eles precisam sobreviver e se estabelecer.'),
    p('Poder no jogo', 'Recrute um aliado, leve-o até a raiz certa e aperte E. O resultado depende da espécie e do lugar.',
      ['Rhizobium precisa de raiz compatível.', 'Bacillus constrói biofilmes protetores.']),
    p('Escolha antes de agir', 'Pergunte: qual raiz está ameaçada, que função falta e onde o aliado terá alimento para continuar ativo?'),
    p('Estratégia', 'Proteger antes da invasão custa menos do que recuperar depois. Espalhe os aliados pelos pontos úteis.'),
  ],
  'power-double-jump': [
    p('Novo movimento', 'O segundo salto, dado no ar, ganha altura ou corrige a trajetória. Ele abre rotas que pareciam impossíveis.'),
    p('Como usar', 'Um toque no pulo salta; outro toque no ar faz o salto duplo.',
      ['Cedo: mais altura.', 'Tarde: corrige a queda ou alcança a borda.']),
    p('Metáfora biológica', 'O salto duplo é mecânica de videogame. Ele simboliza os novos caminhos que um sistema radicular maior oferece.'),
  ],
  'power-dash': [
    p('Novo movimento', 'O dash lança Miguelito na horizontal: cruza vãos, escapa de ataques e alcança plataformas antes do perigo.'),
    p('Como usar', 'Acione o dash correndo ou no ar, na direção escolhida. Planeje a aterrissagem antes de acelerar.'),
    p('Quando fica bloqueado', 'Contaminação forte ou dois J2 agarrados bloqueiam o dash. Limpe-se num biofilme e livre-se dos passageiros.'),
    p('Metáfora biológica', 'O dash é mecânica de plataforma: representa mais mobilidade numa rede de raízes funcional.'),
  ],
  'power-jetpack': [
    p('Decole com estratégia', 'Segure o pulo no ar para pairar ou subir. Pulsos curtos rendem mais do que segurar sem parar.',
      ['Toque curto continua sendo só salto.']),
    p('Recarregue na raiz', 'Pare sobre uma raiz saudável para recarregar. Quanto mais saudável, mais carga.',
      ['Abaixo de 70% de saúde, a raiz não recarrega.']),
    p('Rede de aliados', 'Nódulos, Azospirillum, micorriza, Bacillus e Pseudomonas mantêm as raízes saudáveis e a recarga funcionando.'),
    p('Metáfora biológica', 'A mochila não existe no solo. Ela representa que raízes vigorosas sustentam mais atividade na rizosfera.'),
  ],
  'power-pulse': [
    p('Selecione o poder', 'Escolha Solubilização P no seletor (seta para baixo). Assim o E passa a carregar e disparar o pulso.'),
    p('Segure para carregar', 'Segure E perto de uma colônia madura da cepa solubilizadora. Exsudatos recarregam a colônia mais rápido.',
      ['Ao soltar, a carga fica guardada.']),
    p('Mova-se e dispare', 'Com a carga guardada, ande e salte à vontade. Toque E de novo para disparar para onde Miguelito olha.',
      ['A bola de luz dissolve o fosfato do mineral.']),
    p('Complete a missão', 'Missão: libere o fosfato e use a micorriza para levá-lo à raiz.', [],
      [m('Na natureza, a raiz também pode absorver o fosfato diretamente.', ['O pulso não elimina patógenos.'])]),
  ],
  'process-root-health': [
    p('Leia o estado da raiz', 'Cada raiz tem saúde própria. Cor, fluxo e barra mostram se ela está bem ou perto do colapso.',
      ['Saudável 75–100% · Estressada 50–74%', 'Comprometida 25–49% · Colapso abaixo de 25%']),
    p('O que causa dano?', 'Meloidogyne, Rhizoctonia e Ralstonia prejudicam os tecidos. Algumas deixam sequelas que reduzem o máximo.'),
    p('O que ajuda?', 'Nódulos e micorrizas ajudam na nutrição; biofilmes reduzem novos danos.', [],
      [m('Nenhum aliado recupera na hora o tecido que já morreu.')]),
    p('Saúde local e Vigor', 'A saúde é de cada raiz. O Vigor da Planta soma todo o sistema e aparece na parte aérea e na colheita.'),
  ],
  'process-root-recovery': [
    p('Sinais de recuperação', 'Fluxo verde-dourado, pelos de volta e contorno vivo: a raiz está recuperando função, aos poucos.'),
    p('Como acontece no jogo', 'Controle os agressores e mantenha os aliados ativos para a raiz recuperar a função.', [],
      [m('Tecido morto não se regenera: novas raízes podem compensar as perdas.')]),
    p('Limites do reparo', 'A raiz não passa do máximo recuperável. Galhas e murcha avançada deixam sequelas.'),
    p('Missão do jogador', 'Não espere a plataforma ceder: tire a pressão, restaure o fluxo e estabilize a comunidade antes de seguir.'),
  ],
  'process-root-collapse': [
    p('Alerta de colapso', 'Uma raiz muito comprometida afunda, oscila e cede sob Miguelito. Os sinais aparecem antes da queda.'),
    p('Base biológica', 'Doenças enfraquecem os tecidos da raiz. A plataforma que cede é a metáfora visual desse prejuízo.'),
    p('Consequência no jogo', 'O apoio some por instantes, corta rotas e pode jogar Miguelito em áreas perigosas.'),
    p('Como evitar', 'Controle a causa do dano e favoreça a micorriza madura, que dá estabilidade. Raiz em colapso é prioridade.'),
  ],
  'organism-rhizobium': [
    p('Um aliado especialista', 'Rhizobium forma uma parceria com o feijoeiro. Quando há compatibilidade, a planta cria nódulos para abrigar as bactérias.',
      ['Nem todo Rhizobium serve para qualquer planta.']),
    p('A raiz abre o caminho', 'A raiz libera sinais; rizóbios compatíveis respondem com fatores Nod. O pelo radicular se curva e forma um fio de infecção.'),
    p('Fábrica viva de nitrogênio', 'Nos nódulos, a nitrogenase dos bacteroides transforma N₂ em amônia. A planta recebe nitrogênio e fornece carbono.',
      ['A leghemoglobina ajuda a controlar o oxigênio.']),
    p('Poder no jogo', 'Recrute Rhizobium, leve até uma raiz e inocule. O nódulo cresce por etapas e, ativo, recupera a raiz e o Vigor.'),
    p('Estratégia', 'Mantenha exsudatos e proteja a raiz. Sem carbono ou com murcha vascular, o nódulo maduro para de fixar.',
      ['Azospirillum ajuda, mas não substitui Rhizobium.']),
  ],
  'organism-azospirillum': [
    p('Morador da superfície', 'Azospirillum vive no rizoplano e no solo junto à raiz. Diferente de Rhizobium, não forma nódulos.'),
    p('Arquiteto das raízes', 'Algumas estirpes de Azospirillum produzem AIA, um fitormônio que pode estimular raízes laterais e pelos radiculares.'),
    p('Poder no jogo', 'Depois da inoculação, ramificações crescem como uma escada viva. Cada degrau só aguenta Miguelito quando maduro.'),
    p('Ajuda com nitrogênio', 'Azospirillum fixa um pouco de nitrogênio, bem menos que um nódulo. Perto de Rhizobium, pode ajudar a parceria.'),
    p('Estratégia', 'Inocule onde precisa de uma nova rota e use exsudatos para guiar o crescimento. Proteja a raiz jovem.'),
  ],
  'organism-mycorrhiza': [
    p('Uma parceria obrigatória', 'Fungos micorrízicos arbusculares vivem associados às raízes e dependem do carbono da planta para completar o ciclo.'),
    p('Exploradora do solo', 'Hifas finíssimas vão além dos pelos radiculares e alcançam nutrientes pouco móveis, sobretudo fósforo.'),
    p('Centro de trocas', 'Dentro do córtex, o fungo forma arbúsculos muito ramificados. Neles, a planta recebe nutrientes e entrega carbono.'),
    p('Poder no jogo', 'A rede forma pontes horizontais e leva fosfato até a raiz. Arbúsculos maduros ajudam a recuperar a raiz.'),
    p('Ciência e metáfora', 'Hifas reais ligam regiões e transportam recursos, mas não aguentariam uma pessoa. As pontes são metáfora.'),
  ],
  'organism-bacillus': [
    p('Um sobrevivente', 'Algumas células de Bacillus sobrevivem ao estresse formando endósporos. Com condições melhores, germinam.',
      ['Endósporo é sobrevivência, não reprodução.']),
    p('Fortaleza microbiana', 'Células ativas aderem à raiz e produzem uma matriz coletiva: o biofilme. Algumas estirpes também ativam defesas.'),
    p('Poder no jogo', 'No jogo, biofilmes maduros protegem ferimentos, repelem J2, reduzem patógenos e limpam Miguelito.',
      ['Biofilme também é ponto de retorno (checkpoint).']),
    p('Alimente a defesa', 'Exsudatos alimentam a colônia. Sob estresse, Bacillus reduz a atividade ou forma endósporos.', [],
      [m('Com recursos de novo, a proteção retorna.')]),
    p('Estratégia', 'Posicione Bacillus antes da invasão, sobre ferimentos e rotas de entrada. Barreira pronta vale mais.'),
  ],
  'organism-pseudomonas': [
    p('Exploradora veloz', 'Pseudomonas são bactérias móveis da rizosfera. Algumas produzem sideróforos, moléculas que capturam ferro.'),
    p('Disputa por ferro', 'O ferro é essencial e escasso. Ao capturá-lo, Pseudomonas fica mais forte e limita quem depende dele.'),
    p('Poder no jogo', 'A colônia envia sideróforos aos depósitos de Fe³⁺. O ferro trazido forma uma reserva que enfraquece fungos.'),
    p('Não é ataque direto', 'Capturar ferro pode enfraquecer alguns competidores sem matá-los. Pseudomonas muda a disputa a seu favor.'),
    p('Estratégia', 'Inocule perto de raízes ameaçadas e de depósitos de ferro. Dê tempo para os sideróforos irem e voltarem.'),
  ],
  'organism-trichoderma': [
    p('Fungo aliado', 'Trichoderma reúne fungos comuns no solo. Suas hifas exploram o ambiente em busca de espaço, alimento e alvos.'),
    p('Arsenal de biocontrole', 'Conforme a estirpe, compete por recursos, produz enzimas ou faz micoparasitismo: reconhece e ataca outro fungo.'),
    p('Poder no jogo', 'As hifas caçam Rhizoctonia, fungos oportunistas, massas de ovos e J2 expostos. Cada ataque gasta atividade.'),
    p('Escolha o alvo certo', 'Trichoderma não alcança a fêmea de Meloidogyne dentro da raiz e não controla Ralstonia, que é bactéria.'),
    p('Estratégia', 'Mantenha a colônia alimentada e perto do alvo. Bacillus e Pseudomonas enfraquecem o inimigo antes.'),
  ],
  'organism-phosphate-solubilizer': [
    p('Uma habilidade de cepa', 'Nem todo Bacillus solubiliza fósforo. Esta fase apresenta uma cepa especializada nisso.'),
    p('Química do mineral', 'Ácidos orgânicos e prótons mudam o ambiente do mineral e liberam, aos poucos, o fosfato preso.'),
    p('Carregue o poder', 'A colônia madura acumula metabólitos para o pulso. Exsudatos aceleram; dormência e endósporos interrompem.'),
    p('Poder no jogo', 'Use a reserva para carregar e disparar o pulso. O alvo é o depósito de fosfato, não um patógeno.'),
    p('Trabalho em equipe', 'Nesta fase, a bactéria libera fosfato e a micorriza o leva à raiz.', [],
      [m('Na natureza, a raiz também pode absorver o fosfato diretamente.')]),
  ],
  'organism-opportunistic-fungus': [
    p('Invasor de oportunidade', 'Fungos oportunistas aproveitam ferimentos, estresse e desequilíbrio. Atacam raízes já enfraquecidas.'),
    p('Rede em expansão', 'As hifas crescem pelas pontas e ramificam. Perto de um alvo a rede adensa e solta novos esporos.'),
    p('Perigo para Miguelito', 'Hifas grudam na roupa e nas pernas. A contaminação deixa Miguelito lento e, alta, tira Vitalidade.'),
    p('Como escapar', 'Afaste-se da rede e passe num biofilme de Bacillus para se limpar. Pseudomonas enfraquece o fungo.'),
    p('Estratégia', 'Não atravesse o centro da colônia sem saída. Enfraquecer a fonte vale mais do que se limpar toda hora.'),
  ],
  'organism-rhizoctonia': [
    p('Patógeno persistente', 'Rhizoctonia sobrevive no solo como micélio e estruturas resistentes. Achando tecido favorável, infecta.'),
    p('Ataque à superfície', 'As hifas formam estruturas de infecção e degradam o tecido. As lesões abrem portas para outros invasores.'),
    p('Poder inimigo', 'O foco se espalha pela raiz, tira saúde e lança investidas de hifas contra Miguelito.'),
    p('Equipe de controle', 'Bacillus forma barreira, Pseudomonas tira vigor e Trichoderma ataca o fungo. Cada um age numa frente.'),
    p('Estratégia', 'Contenha as bordas antes do centro. Feridas de Rhizoctonia podem deixar Ralstonia entrar: o tempo conta.'),
  ],
  'organism-ralstonia': [
    p('Portas de entrada', 'Ralstonia sobrevive no solo e causa murcha. Entra por ferimentos ou pontos frágeis, como a saída de raízes laterais.',
      ['Lesões de nematoides e fungos aumentam o risco.', 'Na superfície, ainda dá para barrar a invasão.']),
    p('Ponto sem volta', 'No xilema, a bactéria se multiplica nos vasos. No jogo, a missão muda de prevenir para conter.',
      ['No jogo, a carga vascular pode cair, mas não zera.', 'Trichoderma não controla bactéria.']),
    p('Encanamento obstruído', 'No xilema, Ralstonia se multiplica e produz exopolissacarídeos.', [],
      [m('Isso e as respostas da planta prejudicam o fluxo de água e causam a murcha.', ['Menos transporte reduz FBN e recuperação.'])]),
    p('Defesa em duas linhas', 'No jogo, Bacillus protege áreas vulneráveis e Pseudomonas reduz a pressão bacteriana.', [],
      [m('Juntos, ajudam a evitar a invasão e a conter o avanço.')]),
    p('Bloqueie a disseminação', 'Uma raiz muito colonizada pode ameaçar outra. O jogo avisa antes: proteja a raiz-alvo nessa janela.'),
  ],
  'organism-meloidogyne-j2': [
    p('O invasor móvel', 'O J2 é o juvenil infectivo do nematoide-das-galhas. Ele eclode e procura no solo os sinais de uma raiz.'),
    p('Entrada na raiz', 'O J2 penetra a raiz e escolhe um lugar para se alimentar. Ali induz células gigantes que o alimentam.'),
    p('Poder inimigo', 'J2 livres procuram raízes e podem se agarrar em Miguelito. Dentro da raiz, iniciam uma galha.'),
    p('Janela de controle', 'Bacillus reduz a penetração; Trichoderma só pega J2 expostos. Depois que entram, não dá mais para alcançar.'),
    p('Estratégia', 'Priorize massas de ovos perto das raízes. Um J2 evitado agora impede uma galha e muitos ovos depois.'),
  ],
  'organism-meloidogyne-female': [
    p('Escondida no tecido', 'Depois de instalar o sítio de alimentação, a fêmea cresce e fica parada dentro da raiz, protegida.'),
    p('Uma central de drenagem', 'As células gigantes alimentam a fêmea com recursos da planta. Essa drenagem e as alterações prejudicam a raiz.'),
    p('Poder inimigo', 'A fêmea reduz a recuperação, baixa de vez a saúde máxima da raiz e prepara uma nova massa de ovos.'),
    p('Por que não dá para atacar?', 'Trichoderma não alcança a fêmea dentro da raiz. A hora certa é antes: ovos, eclosão e J2 no solo.'),
    p('Estratégia', 'Trate cada fêmea como sequela. Controle a próxima geração e proteja as raízes ainda livres.'),
  ],
  'structure-nodule': [
    p('Não é uma bolinha grudada', 'O nódulo é um órgão novo, formado pela raiz na simbiose. Tem tecidos próprios e ligação com os vasos.'),
    p('Abrigo especial', 'Dentro do nódulo, bacteroides fixam N₂. A planta dá carbono e controla o oxigênio para a nitrogenase.'),
    p('Poder no jogo', 'O nódulo cresce por estágios. Maduro e ativo, recupera a raiz e aumenta o Vigor da Planta.'),
    p('Maduro não é ativo', 'Falta de carbono, dano na raiz ou murcha podem desligar o nódulo sem destruí-lo. Observe o fluxo.'),
  ],
  'process-fbn': [
    p('Um gás difícil de usar', 'O ar tem muito N₂, mas a planta não consegue usá-lo diretamente. Certas bactérias têm nitrogenase, que o transforma em amônia.'),
    p('Dentro do nódulo', 'A nitrogenase gasta muita energia e não tolera oxigênio. A leghemoglobina mantém o oxigênio na medida.'),
    p('Da atmosfera à planta', 'O nitrogênio fixado vira aminoácidos, proteínas, ácidos nucleicos e clorofila.'),
    p('Efeito no jogo', 'FBN ativa recupera a raiz e aumenta pontuação e Vigor. Carbono, saúde e transporte definem quanto se fixa.'),
  ],
  'structure-biofilm': [
    p('Cidade microscópica', 'Biofilme é uma comunidade de células grudadas numa superfície, envolvidas por uma matriz que elas produzem.'),
    p('Por que viver em grupo?', 'A matriz ajuda a ficar, a se comunicar e a resistir a mudanças. E mantém células úteis junto à raiz.'),
    p('Poder no jogo', 'Biofilmes maduros protegem ferimentos, repelem J2, reduzem patógenos, limpam Miguelito e são checkpoints.'),
    p('Mantenha a fortaleza', 'A proteção cresce com a maturação. Sob estresse, a colônia perde atividade e a barreira enfraquece.'),
  ],
  'process-siderophore': [
    p('Um gancho químico', 'Sideróforos são moléculas liberadas quando falta ferro. Prendem o Fe³⁺ e voltam a ser captadas pela célula.'),
    p('Missão de busca', 'No jogo, o sideróforo vai buscar ferro e volta. Na natureza, ele se difunde, liga Fe³⁺ e é captado como complexo.'),
    p('Efeito ecológico', 'Capturar ferro favorece o produtor. Quem não usa o complexo encontra menos ferro para crescer.'),
    p('Poder no jogo', 'Sideróforos abastecem a reserva de Pseudomonas. Reserva maior enfraquece mais as ameaças próximas.'),
  ],
  'process-iron-competition': [
    p('O recurso disputado', 'Quando os sideróforos trazem Fe³⁺ para Pseudomonas, sobra menos ferro para o fungo naquela região.'),
    p('O inimigo perde força', 'Sem ferro disponível, alguns fungos crescem menos e produzem menos esporos. Nem todos reagem igual.'),
    p('Efeito no jogo', 'O fungo gruda menos, a contaminação sobe mais devagar e as hifas presas em Miguelito se soltam fácil.'),
    p('Lição estratégica', 'Biocontrole nem sempre é matar. Mudar o acesso a recursos pode tornar uma passagem perigosa controlável.'),
  ],
  'process-ralstonia-entry': [
    p('A porta de entrada', 'Ralstonia aproveita ferimentos de nematoides, fungos ou danos mecânicos.', [],
      [m('Também pode entrar onde surgem raízes laterais, mesmo sem ferida visível.')]),
    p('Contagem regressiva', 'Antes de entrar, a população cresce na superfície. Essa é a janela de prevenção.'),
    p('Feche a porta', 'Ponha Bacillus sobre o ferimento para fazer uma barreira e use Pseudomonas para reduzir a pressão.'),
  ],
  'process-vascular-obstruction': [
    p('Invasão do vaso', 'No xilema, Ralstonia se multiplica e produz exopolissacarídeos que ocupam o caminho da água.'),
    p('Murcha com água no solo', 'A planta murcha mesmo com água ao redor: o problema é o transporte por dentro, não a fonte.'),
    p('Efeito em cadeia', 'Menos fluxo reduz FBN, recuperação, recarga da propulsão e estabilidade. Uma obstrução afeta tudo.'),
    p('Missão do jogador', 'Depois da entrada, impeça a carga de crescer. Conter preserva parte do transporte.'),
  ],
  'process-ralstonia-containment': [
    p('A missão mudou', 'Dentro do xilema, nenhum aliado do jogo elimina Ralstonia. O desafio é manter a raiz funcionando.'),
    p('Crescimento zero', 'No jogo, Bacillus e Pseudomonas podem conter Ralstonia, sem eliminá-la.', [],
      [m('Na planta real, uma infecção vascular instalada é difícil de controlar.')]),
    p('O que é preservado', 'A raiz contida mantém parte do transporte e da estabilidade. Isso protege nódulos, rotas e o Vigor.'),
    p('Controle contínuo', 'Se os aliados enfraquecem, a bactéria volta a avançar. Contenção é equilíbrio, não troféu.'),
  ],
  'process-ralstonia-spread': [
    p('Saída da raiz doente', 'Uma raiz muito colonizada solta bactérias no solo ao redor. É a exsudação bacteriana da murcha.'),
    p('Qualquer raiz corre risco', 'Raízes feridas são mais vulneráveis, mas Ralstonia também entra onde surgem raízes laterais.',
      ['Sem ferida não significa sem risco.']),
    p('Alerta de chegada', 'O jogo avisa antes. Use o tempo para proteger a raiz-alvo com Bacillus e reforçar com Pseudomonas.'),
    p('Vitória preventiva', 'Bloquear a disseminação evita que um foco vire problema da fase. Defender a próxima raiz pode valer mais.'),
  ],
  'structure-arbuscule': [
    p('Uma árvore na célula', 'O arbúsculo é uma hifa muito ramificada dentro das células do córtex. O formato aumenta a área de troca.'),
    p('Troca sem destruir', 'A hifa fica envolvida pela membrana da célula. Fungo e planta trocam nutrientes sem matar a célula.'),
    p('Poder no jogo', 'Arbúsculos maduros recebem o fosfato da rede e o passam à raiz. Também ajudam na recuperação.'),
    p('Estrutura temporária', 'Arbúsculos se formam, funcionam, envelhecem e são renovados enquanto a associação continua.'),
  ],
  'structure-mycorrhiza-path': [
    p('Abra uma nova rota', 'Exsudatos perto da borda orientam o crescimento de uma ponte horizontal. Madura, ela pode ser atravessada.'),
    p('Inspiração biológica', 'Hifas reais exploram poros, ligam regiões e transportam nutrientes. Isso inspirou a ponte do jogo.'),
    p('Metáfora de plataforma', 'Uma hifa real não aguentaria Miguelito. A ponte amplia a conexão microscópica num caminho jogável.'),
    p('Estratégia', 'Veja se há plataforma ao alcance antes de gastar exsudato. A ponte só funciona depois de madura.'),
  ],
  'structure-lateral-root': [
    p('Nasce por dentro', 'A raiz lateral começa nos tecidos internos. O primórdio cresce, atravessa as camadas e emerge.'),
    p('Por que novas raízes?', 'Cada ramificação explora mais solo, absorve mais e oferece novas superfícies para micróbios.'),
    p('Poder no jogo', 'Azospirillum e exsudatos guiam o crescimento. Em 100%, a raiz lateral aguenta Miguelito e abre rota.'),
    p('Ciência e velocidade', 'O jogo acelera um processo bem mais lento. Usar a raiz como plataforma é metáfora.'),
  ],
  'structure-egg-mass': [
    p('A próxima geração', 'A fêmea deposita os ovos numa matriz gelatinosa na superfície da raiz, que os mantém juntos.'),
    p('O que acontece dentro?', 'O J1 faz a primeira muda ainda no ovo. Quem eclode é o J2, o estágio infectivo.'),
    p('Poder inimigo', 'Cada massa libera vários J2. Trichoderma pode envolvê-la, reduzir a eclosão e inviabilizar ovos.'),
    p('Alvo prioritário', 'Neutralizar uma massa evita muitas perseguições. Atacar a fonte rende mais do que caçar cada J2.'),
  ],
  'structure-gall': [
    p('Como surge uma galha?', 'O nematoide induz células gigantes que o alimentam. O tecido ao redor aumenta de volume e forma a galha.'),
    p('Custo para a planta', 'A galha desvia recursos, altera o fluxo de água e nutrientes e exige muito da raiz.'),
    p('Poder inimigo', 'Galhas maduras baixam de vez a saúde máxima da raiz, mais ainda quando a fêmea começa a pôr ovos.'),
    p('Por que prevenir?', 'Eliminar os J2 do solo não desfaz galhas já formadas. Proteger a raiz antes da invasão é a melhor estratégia.'),
  ],
  'process-mycoparasitism': [
    p('Caçada entre hifas', 'Micoparasitismo é quando um fungo reconhece outro fungo e o usa como alvo, antes mesmo do contato.'),
    p('Cerco microscópico', 'Trichoderma cresce até o patógeno, se enrola nas hifas e libera enzimas que degradam a parede celular.'),
    p('Poder no jogo', 'A hifa verde alcança a Rhizoctonia e conclui a lise se a colônia mantiver atividade suficiente.'),
    p('Trabalho em equipe', 'Com Bacillus e Pseudomonas enfraquecendo o foco, Trichoderma gasta menos para completar o ataque.'),
  ],
};

// Ciclos: so 13 cartoes mantem ciclo. O ciclo NAO entra na primeira
// apresentacao: aparece no fim da fase indicada (cartao de revisao) e depois
// fica no GUIA. Cada etapa tem legenda propria (ate 70 caracteres).
// Os demais cartoes perdem o ciclo.
const s = (label, caption) => ({ label, caption });
export const CYCLE_REVISION = {
  'organism-bacillus': { phase: 1, label: 'Ciclo do Bacillus', steps: [
    s('Célula ativa', 'A célula cresce e se divide perto da raiz.'),
    s('Biofilme', 'As células aderem e produzem a matriz que protege a raiz.'),
    s('Endósporo', 'Sob estresse, algumas células viram endósporos resistentes.'),
    s('Germinação', 'Com alimento de novo, o endósporo germina e volta a crescer.'),
  ] },
  'organism-rhizobium': { phase: 2, label: 'Formação do nódulo', steps: [
    s('Reconhecimento', 'A raiz libera sinais; o rizóbio responde com fatores Nod.'),
    s('Fio de infecção', 'O pelo se curva e um fio leva as bactérias para dentro.'),
    s('Nódulo', 'A planta forma o nódulo e as bactérias viram bacteroides.'),
    s('FBN', 'A nitrogenase transforma N₂ em amônia para a planta.'),
  ] },
  'process-fbn': { phase: 2, label: 'Do ar para a planta', steps: [
    s('N₂ do ar', 'O nitrogênio do ar é abundante, mas a planta não o usa.'),
    s('Nitrogenase', 'A enzima quebra a ligação forte do N₂, gastando energia.'),
    s('Amônia', 'O produto é amônia, uma forma que a planta aproveita.'),
    s('Planta', 'Vira aminoácidos, proteínas e clorofila.'),
  ] },
  'organism-azospirillum': { phase: 3, label: 'Novas raízes', steps: [
    s('Colonização', 'Azospirillum se instala na superfície da raiz.'),
    s('AIA', 'Produz AIA, um fitormônio de crescimento.'),
    s('Raízes laterais', 'Novas ramificações e pelos aumentam o alcance da raiz.'),
  ] },
  'organism-mycorrhiza': { phase: 4, label: 'Ciclo da micorriza', steps: [
    s('Contato', 'A hifa encontra a raiz guiada por sinais químicos.'),
    s('Córtex', 'O fungo cresce entre as células internas da raiz.'),
    s('Arbúsculo', 'Dentro da célula, planta e fungo trocam carbono e nutrientes.'),
    s('Rede no solo', 'Hifas externas buscam fósforo longe da raiz.'),
  ] },
  'organism-pseudomonas': { phase: 5, label: 'A caça ao ferro', steps: [
    s('Colonização', 'Pseudomonas se instala perto da raiz.'),
    s('Sideróforo', 'Libera moléculas que procuram ferro.'),
    s('Captura de Fe³⁺', 'O sideróforo prende o ferro com força.'),
    s('Retorno', 'A célula recolhe o ferro; o competidor fica sem.'),
  ] },
  'organism-opportunistic-fungus': { phase: 5, label: 'Ciclo do oportunista', steps: [
    s('Esporo', 'O esporo chega a uma raiz enfraquecida.'),
    s('Contato', 'Germina e as hifas aderem ao tecido.'),
    s('Colonização', 'A rede cresce pelas pontas e ramifica.'),
    s('Novos esporos', 'A rede madura libera esporos para outras raízes.'),
  ] },
  'organism-trichoderma': { phase: 6, label: 'Micoparasitismo', steps: [
    s('Reconhecimento', 'Trichoderma detecta o fungo-alvo antes do contato.'),
    s('Enrolamento', 'A hifa cresce até o alvo e se enrola nele.'),
    s('Enzimas', 'Enzimas degradam a parede celular do alvo.'),
    s('Lise', 'O fungo-alvo é destruído.'),
  ] },
  'organism-rhizoctonia': { phase: 6, label: 'Ciclo da Rhizoctonia', steps: [
    s('Solo', 'Sobrevive no solo como micélio e escleródios.'),
    s('Almofada de infecção', 'As hifas formam estruturas que penetram a raiz.'),
    s('Lesão', 'O tecido é degradado e a raiz perde função.'),
    s('Persistência', 'Escleródios garantem a volta na próxima oportunidade.'),
  ] },
  'organism-phosphate-solubilizer': { phase: 7, label: 'Caminho do fósforo', steps: [
    s('Ácidos', 'A bactéria libera ácidos orgânicos junto ao mineral.'),
    s('Fosfato livre', 'Parte do fosfato preso se solta no solo.'),
    s('Raiz', 'A micorriza leva o fosfato até a raiz.'),
  ] },
  'organism-meloidogyne-j2': { phase: 8, label: 'Invasão do J2', steps: [
    s('Eclosão', 'O J2 sai do ovo e procura uma raiz.'),
    s('Penetração', 'Entra na raiz e migra até um bom ponto.'),
    s('Células gigantes', 'Induz células gigantes que o alimentam.'),
  ] },
  'organism-meloidogyne-female': { phase: 8, label: 'Ciclo do Meloidogyne', steps: [
    s('Ovo', 'O J1 se desenvolve e muda dentro do ovo.'),
    s('J2', 'O juvenil infectivo eclode e busca uma raiz.'),
    s('Galha', 'Dentro da raiz, induz células gigantes e a galha cresce.'),
    s('Fêmea', 'A fêmea cresce parada e protegida no tecido.'),
    s('Massa de ovos', 'Ela deposita centenas de ovos: o ciclo recomeça.'),
  ] },
  'organism-ralstonia': { phase: 9, label: 'Ciclo da murcha', steps: [
    s('Solo e água', 'Ralstonia sobrevive no solo e na água.'),
    s('Entrada', 'Entra por feridas ou pela saída de raízes laterais.'),
    s('Xilema', 'Multiplica-se nos vasos e produz exopolissacarídeos.'),
    s('Murcha', 'O fluxo de água cai e a planta murcha.'),
    s('Disseminação', 'A raiz doente solta bactérias que ameaçam outras raízes.'),
  ] },
};

// Cartoes novos, curtos, abertos na primeira vez que a situacao acontece.
// `trigger` descreve o evento (a ligacao no codigo vem na etapa de integracao).
export const NEW_CARDS = {
  'action-selection': {
    category: 'Como jogar', title: 'O que o E faz?', subtitle: 'Escolha a ação antes de agir', glyph: 'E', accent: '#ffd36f',
    trigger: 'primeira vez com duas ou mais opções no seletor (fase 1)',
    pages: [
      p('Uma ação por vez', 'O E faz a ação mostrada no seletor: inocular um aliado, soltar exsudato e, mais tarde, o pulso.'),
      p('Troque a ação', 'Aperte seta para baixo (ou o botão de troca no celular) para passar à próxima opção.'),
    ],
  },
  'hazard-necrotic-zone': {
    category: 'Perigo', title: 'Zona necrótica', subtitle: 'O fundo da rizosfera é tecido morto', glyph: '!', accent: '#ff7a7a',
    trigger: 'primeira vez que a zona aparece na tela (fase 1)',
    pages: [
      p('Não caia', 'Lá embaixo há tecido morto tomado por fungos. Cair nela tira toda a Vitalidade de Miguelito.'),
      p('Volte ao biofilme', 'Depois da queda, Miguelito volta ao último biofilme ativado. Ative os biofilmes pelo caminho.'),
    ],
  },
  'status-contamination': {
    category: 'Estado de Miguelito', title: 'Contaminado!', subtitle: 'Hifas e esporos grudados no corpo', glyph: '✳', accent: '#f2a6c6',
    trigger: 'primeira vez com contaminação fúngica ou infecção acima de 20% (fase 5)',
    pages: [
      p('O que está acontecendo', 'Hifas grudaram em Miguelito. Rosadas são do fungo oportunista; castanhas, da Rhizoctonia.',
        ['Quanto mais hifas, mais lento e mais fraco.']),
      p('Como se limpar', 'Fique dentro de um biofilme maduro de Bacillus. As hifas secam e caem.',
        ['Longe do fungo, a contaminação também cai aos poucos.']),
    ],
  },
  'status-j2-carried': {
    category: 'Estado de Miguelito', title: 'J2 agarrado', subtitle: 'Nematoides pegando carona', glyph: 'J2', accent: '#cdb68f',
    trigger: 'primeiro J2 agarrado em Miguelito (fase 8)',
    pages: [
      p('Carona indesejada', 'O J2 se agarrou na perna de Miguelito e pode ser levado até outra raiz.',
        ['Com dois J2, o dash fica bloqueado.']),
      p('Como se livrar', 'Passe por um biofilme maduro de Bacillus: ele repele os J2.'),
    ],
  },
  'event-calm': {
    category: 'Interação', title: 'Calmaria', subtitle: 'Acalmar em vez de matar', glyph: '☀', accent: '#ffb3a1',
    trigger: 'primeira calmaria formada (Pseudomonas + Bacillus próximos)',
    pages: [
      p('Acalmar, não matar', 'Muitas vezes as bactérias benéficas não matam os patógenos: elas os acalmam.'),
      p('Por que funciona', 'Juntas, Pseudomonas e Bacillus deixam a planta em alerta (resistência induzida). O patógeno fica, mas não avança.'),
      p('No jogo', 'Inocule as duas na mesma raiz ou em raízes vizinhas. Dentro da luz, os patógenos param de atacar.',
        ['Alimente as colônias para a calmaria durar.']),
    ],
  },
  'hud-radar': {
    category: 'Como jogar', title: 'Radar de patógenos', subtitle: 'Ameaças fora da tela', glyph: '◎', accent: '#ffcf66',
    trigger: 'primeiro sinal do radar na borda da tela (fase 8)',
    pages: [
      p('Leia o sinal', 'A seta na borda aponta uma ameaça fora da tela. Quanto maior, mais perto ela está.',
        ['Claro pulsando: chegando · Âmbar: instalada', 'Vermelho com "!": infecção vascular']),
    ],
  },
};

// Mudancas de posicao/gatilho (integracao).
export const PLACEMENT_CHANGES = [
  { card: 'power-jetpack', from: 'fase 5, bloco 0 (junto com o fungo)', to: 'quando a propulsão fica disponível pela primeira vez' },
  { card: 'process-mycoparasitism', from: 'fase 6, bloco 4', to: 'vira parte do Trichoderma; abre no primeiro ataque de Trichoderma' },
  { card: 'todos os ciclos', from: 'última página da primeira apresentação', to: 'cartão de revisão no fim da fase; depois no GUIA' },
  { card: 'páginas liberadas depois', from: 'entram no GUIA em silêncio', to: 'selo "novo" no GUIA e aviso curto' },
];

// Narracoes revisadas (GPT).
export const NARRATION_REVISION = {
  'azo.coinoculation': 'Co-inoculação pode favorecer a FBN',
  'bacillus.reactivation': 'Exsudatos estimularam a germinação',
  'ralst.neutralized': 'Ralstonia barrada antes do xilema',
  'ralst.spread-blocked-healed': 'Disseminação contida: raiz protegida',
};
