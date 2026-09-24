# Narração in-game

Texto que aparece **durante a partida** no `#toast`. Os cartões do GUIA
(tutoriais) não entram aqui: eles são a explicação da primeira vez e a
consulta depois; a narração só liga o que se vê ao conceito, avisa de perigo
ou diz o que falhou.

Implementação: `src/procgen/narrator.js` (árbitro) e
`src/procgen/narration-catalog.js` (todos os textos). Testes:
`tests/narrator.test.js`.

## Classes

Toda mensagem pertence a uma classe (`kind`):

| Classe | `kind` | Escopo padrão | Interrompe? | Uso |
|---|---|---|---|---|
| Ciência | `science` | 1× por campanha | não | Liga o que se vê ao conceito. Sempre tem `cardId` (◈ abre o cartão). |
| Instrução | `hint` | 1× por fase | não | Só quando a ação falha ou o jogador trava. |
| Perigo | `danger` | 1× por fase (ou `always`) | **sim** | Ameaça imediata. |
| Sistema | `system` | sempre | não | Som, paralaxe, plataformas de segurança, erro, placar da fase. |
| Estado | — | — | — | **Nunca vira toast.** Fica no ícone, medidor ou visual que já existe. |

Escopos:

- `campaign`: guardado em `campaign.narrationSeen` (mesmo `sessionStorage` da
  campanha). Rejogar uma fase já vencida não repete ciência. Reiniciar a
  campanha zera.
- `phase`: zerado a cada fase (`narrator.resetPhase()` em `initGame`).
- `always`: pode repetir, mas o mesmo id respeita 6 s de intervalo (sistema
  não tem intervalo: é resposta a botão).

## Regras do narrador

1. Id inexistente ou já dito no escopo → ignorado.
2. Ciência cujo cartão está aberto ou na fila do GUIA → não aparece e fica
   marcada como dita. Se o cartão abrir logo depois do toast, o toast sai.
3. Fila de no máximo 3 itens, por prioridade `danger > hint > science >
   system`. Ciência expira em 8 s na fila; instrução em 5 s; sistema em 4 s.
4. Perigo substitui o que está em tela na hora.
5. Tempo em tela: `clamp(1,8 + 0,05 × caracteres, 2,5, 5)` s. Nada troca a
   mensagem antes disso, exceto perigo.
6. Uma mensagem só conta como dita depois de 1,5 s em tela; interrompida
   antes, pode voltar na próxima ocorrência.
7. O narrador só avança com o mundo: cartão aberto congela a narração.

O toast mostra `◈` quando a mensagem tem `cardId`. Tocar nele pausa o jogo e
abre o cartão no GUIA (`window.miguelitoTutorial.openCard`).

## Regras de texto

- **≤ 60 caracteres** (≈ 2 linhas no celular em retrato).
- Sem ponto final.
- Sem números que o HUD já mostra (corações, porcentagens de medidor).
- Sem jargão de desenvolvimento ("chunk", "vigor persistente", "respawn").
- Linguagem de associação e tendência (ver `microbiology-rules.md`).

## Como adicionar uma mensagem

1. Acrescente a entrada em `NARRATION` (`narration-catalog.js`):

   ```js
   'grupo.evento': { kind: 'science', cardId: 'structure-biofilm',
     text: 'Frase curta sem ponto final' },
   ```

   Texto dinâmico é uma função: `text: ({ source }) => \`Vencido por ${source}\``.
   Nesse caso, inclua os parâmetros de pior caso em `WORST_CASE_PARAMS` no
   teste.
2. No módulo, chame `narrate(state, 'grupo.evento', params)` no ponto da
   transição (uma vez por evento, não por quadro). Não escreva em
   `state.toast` nem crie cooldown próprio para o toast.
3. Rode `node --test tests/narrator.test.js`: ele confere limite de
   caracteres, ponto final, `cardId` válido e jargão.

Sem narrador registrado (testes unitários com `state` literal), `narrate`
escreve o texto direto no toast, como antes.

## Nomes dos organismos

O nome de um organismo só aparece no mundo **antes** da apresentação dele, como
sinal a investigar ("Sinal biológico", "Comunidade microbiana móvel"). Depois
que o organismo foi descoberto, nem as comunidades móveis, nem as cenas de
encontro, nem as colônias inoculadas voltam a mostrar o nome. Quem identifica o
organismo é a forma dele e o chip do HUD: o item selecionado para o E mostra o
retrato do organismo (primeiro quadro do mesmo sprite do mundo), com nome e
quantidade.

## Rótulos no mundo

Rótulos desenhados no canvas são classe **Estado**: não passam pelo narrador e
devem ser curtos o bastante para caber num celular em retrato. Exemplos:
"↓ INOCULE BACILLUS AQUI", "Sem N: nodule a raiz anterior", "Ralstonia
adiante", "colônia exausta". A porta de entrada da Ralstonia não vira texto no
mundo: a cor do rótulo de estágio segue as cores do painel contextual
(`RALSTONIA_DOOR_COLORS`).

O medidor do vigor das colônias de Trichoderma chama-se **Biocontrole** (T):
o mecanismo que o jogo mostra é micoparasitismo (enovelamento e lise), não
antibiose.
