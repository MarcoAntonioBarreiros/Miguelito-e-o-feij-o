# Colheita (pontuação da fase) e fazendinha

## Pontuação da fase (0–100) — `src/procgen/phase-score.js`

`buildPhaseScoreReport({ phase, objectives, metrics })` é a única dona da nota.
`buildPhaseReport()` (app.js) só coleta as métricas que o jogo já calcula.

| Bloco | Pontos | O que mede |
|---|---|---|
| Objetivos da fase | 40 | objetivos cumpridos / total (a raiz final só libera com todos, então ao concluir vem cheio) |
| Colheita | 60 | o quanto o jogador usou as mecânicas biológicas, dividido igualmente entre os pilares que existem na fase |

Pilares da colheita (cada um de 0 a 1):

- **Nitrogênio** (fase 2+): nódulos maduros ativos (2 = cheio) e FBN total (taxa 2 = cheio). Co-inocular com Azospirillum aumenta a FBN.
- **Fósforo** (fase 4+): fosfato que chegou à raiz (estoque ou transporte pela micorriza).
- **Biocontrole** (sempre): média dos componentes que existem na fase — biofilmes funcionais, raízes protegidas por Bacillus, fungo oportunista controlado (5+), patógenos acalmados pela calmaria (5+), Rhizoctonia neutralizada (6+), massas de ovos neutralizadas (8+), Ralstonia prevenida/contida/bloqueada (9+).
- **Saúde das raízes** (sempre): saúde média das raízes (60%), ausência de infestação de nematoide (20%), transporte no xilema (20%).

Fase 1: biocontrole e saúde valem 30 cada; fases 2–3: 20 cada; fase 4 em diante: 15 cada. Mortes não entram na nota.

Moedas: `coinsEarned = score` (1 ponto = 1 moeda).

Feijoeiro: abaixo de 60 doente; 60–84 saudável; 85+ super saudável.

O `ecologicalScore` (objetivo da fase 10) continua em `ecological-score.js`, separado.

## Fim de fase

feijoeiro → painel **Resultado da colheita** (nota, moedas, objetivos, pilares, dica do pilar mais fraco) → Fazendinha (opcional) → Continuar → revisão dos ciclos → próxima fase.

A fase não avança mais sozinha: espera o Continuar. O Phase Lab mantém o fluxo antigo e não paga moedas.

## Fazendinha — `src/farm/`

- `farm-items.js`: catálogo (Cerca de madeira 30, Caixa d'água 70, Viveiro pequeno 120) com arte provisória em canvas.
- `farm-state.js`: moedas, colheitas creditadas, itens sem lugar e 4 espaços; `localStorage` em `miguelito:farm:v1`.
- `farm-view.js`: cena 2D frontal (céu, morro, casinha, canteiro e 4 espaços clicáveis) e a lojinha.

Crédito único: cada colheita tem o id `semente-da-campanha:fase-N`; um id já pago não paga de novo (recarga da página, fase repetida).

Também abre pelo menu de pausa (Fazendinha). O canteiro mostra o feijoeiro da última colheita.

## Arte da lavoura por nota — `src/farm/bean-field.js`

`fieldLevelFromScore(score)`: seca (<35), doente (35–59), saudável (60–84), super (≥85). O feijoeiro do boletim continua com os três estados de `phase-score.js`.

Arquivos em `assets/farm`: `feijao-seco-1`, `feijao-doente-1..2`, `feijao-saudavel-1..3` (as variações se alternam ao longo da fileira) e, no super, `feijao-1` (fim de fase) / `feijao-1..4` (fazendinha). Substitui o tingimento por filtro/shader.

Na fazendinha a lavoura só aparece quando há colheita pendente (fim de fase interrompido antes da colheitadeira); normalmente fica a área arada.
