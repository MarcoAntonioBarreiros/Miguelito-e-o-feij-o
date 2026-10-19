# Diretor de salas (fase 10)

A fase 10 é montada por uma receita decidida **antes** da geometria
(`src/procgen/phase-director.js`), em vez de gerar a rota e depois procurar
espaço para os desafios.

- **Salas** (geometria autoral, construída em `generateLevel`):
  - `ascent`: degrau de 240 a 330 px, aberto pela escada de Azospirillum;
  - `drop`: queda forte num passo só (170 a 260 px);
  - `nitrogenGate`: trio da FBN, que só o nódulo completa;
  - `dashTunnel`: túnel baixo com vão (anda → Dash/propulsor → anda);
  - `phosphateTunnel`: túnel bloqueado por cristal, com ou sem vão, e colônia de Bacillus pronta antes;
  - `bridge`: vão da ponte de micorriza.
- **Ligações:** 2 a 3 blocos entre salas, quase planos e com relevo local. O desnível fica dentro das salas, sem rampas lentas.
- **Regras da receita:**
  - sem a mesma sala duas vezes seguidas;
  - cada sala disponível aparece ao menos uma vez;
  - subida e queda se alternam conforme a altura.

  As salas evitam checkpoints, estreias e encontros de travessia.
- **Túneis:** o gerador reserva o par de blocos de terra (`tunnelRoomRole`), e `installLowTunnels` instala o teto e o cristal exatamente ali. A raiz nitrogenada e o desvio opcional não usam esses pares.
- `?v=silhueta` volta ao plano vertical antigo (zonas longas), para comparar.

## Combos (Etapa 2)

Salas encadeadas com 1 bloco entre elas, no máximo 2 por fase:
- torre: duas subidas seguidas;
- nodula-e-sobe: portão N e depois subida;
- cai-no-tunel: queda e depois túnel com Dash;
- dissolve-e-cai: túnel de fosfato e depois queda;
- ponte-e-fosfato: ponte e depois túnel de fosfato.

## Desvio opcional com lugar reservado (Etapa 2)

Em fases com espaço (fora da janela sobram 12 ou mais chunks), o diretor
reserva uma janela de 17 chunks perto do começo ou do fim da fase.
- Dentro dela só entram salas planas ou de queda: portão N, ponte e queda. Túnel e subida ficam de fora, porque o desvio passa por cima da rota.
- O gerador marca a partida (`detourSocket: 'start'`, raiz larga).
- O retorno (`'rejoin'`) é o primeiro bloco comum a 4300 px ou mais do centro da partida que não fique abaixo do bloco anterior.
- O planejador do desvio tenta esse par primeiro.

Medido em 60 sementes: 38 fases tiveram janela, e o desvio saiu em todas menos uma (no total, 39 das 60 fases têm desvio, cerca de 65%, contra cerca de 50% no sistema antigo). As fases curtas ficam sem desvio e com mais salas.

Se o sorteio não trouxe um dos túneis, uma sala plana fora da janela vira o
túnel que faltou.

## Focos de patógeno (Etapa 3)

O diretor marca até 2 raízes já infectadas em blocos de ligação (perto de
35% e 70% da fase), sem mudar a geometria. O bloco anterior recebe o
organismo de controle (`src/procgen/pathogen-focus-rooms.js`):
- **Ralstonia:** infecção vascular já instalada, o mesmo encontro de contenção da fase 9. Antes dela vêm Bacillus, Pseudomonas, 3 exsudatos e ferro.
- **Meloidogyne:** massa de ovos na raiz, que só começa a eclodir quando o jogador chega a 560 px. Antes dela vêm Trichoderma e 2 exsudatos.

As chegadas dinâmicas por pressão do solo continuam; os focos somam a elas.
Nenhum bloqueia a saída da fase 10 (o teste final é pontuação + raiz final).
O radar mostra os dois desde o começo da fase.

## Fases 11, 12...

Ao concluir a fase 10, um painel oferece "Próxima fase". O botão gera a
fase 10 com semente nova (`campaign.extraPhase`, salvo), mostrada como
Fase 11, 12...
