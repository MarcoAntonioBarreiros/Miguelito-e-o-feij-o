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

Etapas seguintes: combos (salas encadeadas), desvio opcional com lugar
reservado pelo diretor, e patógenos e dificuldade crescente nas fases seguintes.
