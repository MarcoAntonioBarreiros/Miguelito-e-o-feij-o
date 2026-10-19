# Fase 9: prevenção, contenção e recuperação da progressão

Branch de teste: `fix/phase9-ralstonia-softlock`, baseada em `769edb2`.
Esta entrega não publica nem altera a branch main.

## Correção

A fase continua exigindo uma prevenção e uma contenção vascular. Agora são
oportunidades independentes: o primeiro inóculo ambiental chega visivelmente a
uma raiz reservada à prevenção, com carga vascular zero; outra raiz já possui
uma infecção vascular preexistente. O segundo encontro começa quando Miguelito
se aproxima da raiz, respeitando a distância vertical e o período de graça.
Assim, prevenir a primeira infecção não impede cumprir a contenção depois.

O planejamento procedural garante Bacillus na aproximação da prevenção e
Bacillus/Pseudomonas, ferro acessível e exsudatos perto da contenção. Usa os
sistemas normais de coleta, recrutamento, inoculação, sideróforos e reposição
de exsudatos. Não concede marcos nem muda a geometria das plataformas.

A raiz final exige controlar as disseminações **atuais**. O total histórico de
disseminações continua sendo registrado, mas não condena a partida para sempre.
Eventos em aviso/trânsito, focos secundários sem controle e recaídas críticas
bloqueiam a saída; neutralizar ou conter os focos secundários permite recuperá-la.
Uma fonte contida não é forçada a disseminar para cumprir uma demonstração.
Focos contidos abaixo do limiar crítico liberam a capacidade de novas chegadas.

O painel local informa falta de colônias, vigor ou ferro. A raiz final indica o
marco que ainda falta. Não foram alterados física, arte, cristais nem VFX.

## Como testar

Na pasta do repositório, com Node.js disponível:

```powershell
git switch fix/phase9-ralstonia-softlock
npm run build
node scripts/preview-phase9.cjs
```

Abra <http://127.0.0.1:4184/experiments/phase9-ralstonia/>.
A página inicia diretamente na fase 9 e oferece seed, reinício, alternância
2D/WebGL e atalhos de posição para prevenção, contenção e raiz final.
Os atalhos não concedem recursos, tratamentos ou objetivos. A configuração
salva do laboratório de fases é restaurada após preparar a prévia.

1. Colete exsudatos, recrute Bacillus com E e inocule a primeira raiz antes da
   entrada vascular. Mantenha as colônias alimentadas até registrar a prevenção.
2. Na raiz de contenção, recrute/inocule Pseudomonas e Bacillus. Mantenha o vigor
   com exsudatos; o ferro próximo participa da recuperação por sideróforos.
3. Com prevenção e contenção registradas e nenhuma disseminação pendente ou
   foco crítico, aproxime-se da raiz final para concluir.
4. Também teste a ordem inversa e outras seeds. Prevenir cedo deve continuar
   sendo uma jogada válida.

## Validação

- 171 testes direcionados passaram, incluindo as duas ordens dos encontros,
  recuperação após disseminação, recaída, chegadas ambientais e HUD.
- O planejamento foi verificado em 100 seeds procedurais, incluindo recursos,
  determinismo, idempotência e preservação das plataformas.
- Navegador: prévia em 2D/WebGL, atalhos, troca de fase e recursos reais sem
  erros de JavaScript ou arquivos ausentes.
- Uma sequência no jogo compilado coletou recursos, recrutou/inoculou os
  microrganismos, conquistou ambos os marcos e concluiu pelo bloqueio real da
  raiz final. Apenas os deslocamentos foram encurtados com teleporte; não é
  uma validação completa da travessia da fase.
- O smoke global foi executado e continua falhando na asserção preexistente
  `source: queued Bacillus card should open after stable support`, reproduzida
  também no main. Não foi alterado o tutorial geral para contornar essa falha.

Os testes específicos podem ser repetidos com `npm run test:phase-nine-ralstonia`.
As alterações ficam isoladas nesta branch; voltar ao main restaura o jogo
anterior sem aplicar esta correção à publicação.
