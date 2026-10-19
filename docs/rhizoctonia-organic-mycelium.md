# Micélio superficial de Rhizoctonia

Experimento na branch `experiment/rhizoctonia-organic-mycelium`, partindo do
`main` `0471e82`. Não publica nem altera a versão em produção.

## Fontes de verdade

- `src/procgen/rhizoctonia-control.js` continua calculando colonização,
  contenção por Bacillus, limitação de ferro por Pseudomonas, dano e ataque.
- `src/procgen/trichoderma-rhizoctonia-control.js` continua responsável por
  detecção, busca, contato, lise, vigor, eliminação, recompensas e áudio.
- `src/procgen/root-health-gameplay.js` mantém saúde, recuperação e sustentação
  da raiz. Não foi substituído por um estado de saúde visual.
- `src/render/rhizoctonia-mycelium.js` lê esses dados e mantém apenas geometria
  em um `WeakMap`. Não escreve na raiz, no inimigo ou nas colônias.
- `src/render/rhizoctonia-mycoparasitism.js` constrói hélices apoiadas em hifas
  existentes, usando os valores reais de contato e lise.

O aumento de `enemy.colonization` libera extensão apical e ramificações
persistentes. Vértices antigos não mudam de posição. As ramificações nascem
próximas de 90 graus e se curvam ao eixo da raiz, sem ligar plataformas por
pontes suspensas. Os pontos são locais ao hospedeiro; acompanham deslocamento,
escala e a faixa de tecido fornecida por `visibleRootRect`, geralmente de
14–20 pixels no modo de geometria atual.

`bacillusControl`, `ironLimitation`, `contained` e `trichodermaSuppression`
atenuam a atividade das pontas. Queda real de colonização e aumento de
`trichodermaLysis` reduzem a integridade da rede persistente. Necrose responde
ao dano/saúde reais: eliminar o patógeno não pinta automaticamente uma raiz
curada. O sprite original do patógeno e os extremos mecânicos da hifa de ataque
permanecem os mesmos. Não há esporulação de Rhizoctonia.

Há limites de 720 pontos e 34 ramos por foco e descarte de pintura fora do
viewport. A geometria usa RNG próprio. A infraestrutura de `hyphal-growth.js`
fornece os utilitários de ruído, ângulo e ponta; a opção de RNG local não muda
o padrão `Math.random` dos outros fungos. Tempo de animação sozinho não cria
extensão, colonização, dano, cura ou controle.

## Teste no jogo real

Na raiz do checkout:

```sh
npm run build
node scripts/preview-rhizoctonia.cjs
```

Abrir `http://127.0.0.1:4186/experiments/rhizoctonia-mycelium/`.
A página carrega o jogo integrado em `dist`, diretamente na fase 6, com a
configuração normal. Os atalhos movem somente Miguelito. Estoques,
recrutamento, inoculação, tratamentos e objetivos continuam sendo os da partida.
As preferências anteriores do Phase Lab são restauradas; ele não salva
progresso da campanha.

1. Usar **Ir ao foco** para observar a colonização inicial.
2. Acompanhar colonização, dano e geometria nas leituras ao vivo.
3. Coletar o exsudato com movimento, lançar com E junto ao Trichoderma e
   aguardar o recrutamento. Selecionar Trichoderma e inocular com E perto do foco.
4. Observar contato, enovelamento, lise e integridade restante da rede.
5. Comparar Canvas 2D e WebGL sem reiniciar a biologia.

## Verificação automatizada

```sh
node --test tests/rhizoctonia-mycelium.test.js
```

Os testes cobrem persistência apical, ausência de crescimento pelo relógio,
limites do tecido, bifurcações, orçamentos, efeitos de controles reais,
regressão, necrose independente, RNG, imutabilidade e hélices sobre o substrato.
Um harness de 600 passos dos dois controles específicos, com colônia criada
pela API real de Trichoderma, compara desenho ligado/desligado: colonização,
ataques, dano, vigor, contato/lise, eliminação, áudio, RNG e objetivos são iguais.
Esse harness isolado não substitui a validação do loop completo no navegador.

## Limitação biológica preexistente

Na configuração atual há dois escritores de colonização: o controle específico
e `physics.updateRhizoctonia`. O controle específico fixa `stun=999` para manter
o foco aderido; o caminho legado da física interpreta esse valor como uma
causa de regressão. Assim, no loop completo, o foco pode regredir naturalmente
em vez de avançar, mesmo sem Bacillus ou Pseudomonas. O visual respeita essa
queda e não inventa expansão com um temporizador.

A captura de um estado avançado preparado para inspeção visual deve ser
identificada como tal; não equivale a demonstrar progressão espontânea na
partida. Corrigir essa concorrência altera a dinâmica biológica e precisa ser
tratado explicitamente, em vez de ser escondido nesta troca gráfica.
