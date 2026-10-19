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

## Correção do bloqueio de crescimento, autorizada pelo usuário

O loop completo tinha dois escritores de colonização. O controlador moderno
fixava `stun=999` para manter o foco aderido; a física legada interpretava esse
stun como uma causa de regressão, subtraindo `.025/s` e aplicando um piso `.12`.
A queda superava o avanço natural e impedia validar expansão espontânea.

Após explicar o conflito, o usuário autorizou corrigir esse bloqueio nesta
branch. O controlador marca os focos que gerencia com `rhizoctoniaManaged`.
Somente para eles, a física não aplica sua atualização legada de colonização.
As taxas modernas, os danos e os tempos de ataque não foram rebalanceados.
Inimigos legados sem esse marcador mantêm crescimento/regressão anteriores.

Dois testes específicos percorrem `sim.step` junto ao controle moderno e
verificam essa separação, além do comportamento legado com e sem stun. O teste
visual isolado de 600 passos continua sendo descrito como harness isolado.
A validação no navegador usa crescimento natural, coleta e inoculação reais.
Eliminar o fungo não representa cura instantânea: a cicatriz continua visível
quando `rootDamage/rootHealth` ainda indicam lesão. Não alteramos a recuperação
para fazer a raiz parecer saudável antes da simulação.

## Resultado registrado em 19/10/2026

Foram aprovados 150 testes direcionados no lote final (zero falhas), incluindo
a guarda na física. O arquivo novo completo tem 13 testes aprovados.
O ensaio integrado no Chrome percorreu crescimento natural, coleta, recrutamento,
inoculação, contato, enovelamento, lise e eliminação, sem erros de JavaScript,
console ou requisições. A colonização passou por 16,7%, 40,3%, 76,4% e 90,2%;
depois regrediu para 39,2% durante lise e chegou a 6% com eliminação, sem hifas
íntegras restantes. Também foi conferida a troca para Canvas 2D.

As [sete capturas e o relatório da simulação](evidence/rhizoctonia-mycelium/README.md)
estão versionados. A galeria pode ser aberta no servidor local em
`/docs/evidence/rhizoctonia-mycelium/`. O ensaio reproduzível fica em
`scripts/validate-rhizoctonia-phase6.cjs`, com caminhos de Playwright/Chrome
configuráveis por ambiente. Ver o [guia de continuidade](../CLAUDE_CONTINUAR_RHIZOCTONIA.md).

A execução final do smoke global terminou em timeout do Chrome (exit 124),
portanto não há aprovação da suíte global. O desenho agrupa traços, faz culling
e limita a geometria; não foi medido FPS comparativo em aparelhos móveis.

Esta validação usa a base `0471e82`. A main avançou para `e1a84c2` durante o
trabalho; esses commits novos não foram incorporados ao experimento. É preciso
integrar em branch a partir da main mais nova, preservar as mudanças dela,
regenerar dist e repetir a validação antes de publicar.
