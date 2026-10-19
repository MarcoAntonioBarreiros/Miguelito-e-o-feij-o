# Continuidade: micélio orgânico de Rhizoctonia

## Pedido e autorização

O usuário pediu uma implementação integrada ao jogo real, na fase 6, em branch
experimental. Preservar sprites, raízes, plataformas, combate, objetivos e áudio;
não introduzir esporulação. Depois pediu este arquivo para o Claude continuar,
se necessário, e integrar/publicar no main quando a entrega estiver validada.

Durante a execução foi encontrado um bloqueio preexistente: o controlador
moderno fixa `stun=999` para prender o foco à raiz, enquanto a física legada
reduzia colonização em `.025/s` por esse stun. O usuário **autorizou
explicitamente corrigir esse bloqueio nesta branch**. Não confundir isso com
autorização para rebalancear outras regras.

## Git e execução local

- Repositório: `MarcoAntonioBarreiros/Miguelito-e-o-feij-o`.
- Branch: `experiment/rhizoctonia-organic-mycelium`.
- Base publicada ao iniciar: `0471e82` (biofilme de Bacillus já aprovado).
- Checkout Windows: `C:/Users/marco/Documents/Codex/2026-10-17/acesse-o-reposit-rio-https-github/work/miguelito-rhizoctonia-mycelium`.
- Não misturar a branch antiga `fix/phase9-ralstonia-softlock` nem o checkout
  `miguelito-webgl-fixes` com esta entrega.
- Servidor local: `node scripts/preview-rhizoctonia.cjs`.
- Jogo integrado, fase 6: <http://127.0.0.1:4186/experiments/rhizoctonia-mycelium/>.

## Implementação feita

`src/render/rhizoctonia-mycelium.js` mantém grafo persistente em WeakMap por
inimigo, com RNG próprio. Extensão apical e ramificação dependem de aumentos
reais de `enemy.colonization`; relógio de render não aumenta biomassa. Pontos
locais acompanham a faixa real da raiz (`visibleRootRect`, 14–20 px). Limites:
720 pontos e 34 ramos por foco; bifurcações aproximadamente 84–96 graus.
Lise/queda de colonização reduzem integridade, com lacunas e perda das pontas.
Lesões orgânicas usam `rootDamage/rootHealth`, sem pintar outra raiz.

`src/render/rhizoctonia-mycoparasitism.js` faz hélices finas de Trichoderma
sobre hifas reais, usando contato/lise do controle existente. Os antigos aros
orbitais foram removidos. Sprite de Rhizoctonia e extremos do ataque permanecem.
O ataque recebeu apenas uma conexão visual curta à rede.

`hyphal-growth.createHyphalTip` aceita RNG opcional; o padrão e a sequência dos
outros fungos permanecem Math.random. Não usar RNG global no modelo visual.
O app expõe `sim.rhizoctoniaControl.visualSnapshot(enemy)` para diagnóstico.

Correção biológica autorizada: `rhizoctonia-control.ensure` marca
`enemy.rhizoctoniaManaged=true`. Em `physics.updateRhizoctonia`, apenas a linha
legada que altera colonização é ignorada para esse marcador. As taxas modernas,
cooldowns, dano, carga/lunge, recompensas e objetivos não foram rebalanceados;
inimigos legados sem marcador continuam com seu comportamento anterior.

## Evidências e pendências no momento deste registro

- 119 testes existentes direcionados passaram antes da última guarda na física.
- 11 testes novos do modelo/integração foram preparados em
  `tests/rhizoctonia-mycelium.test.js`. Reexecutar no estado final.
- O harness de 600 passos compara os dois controles com/sem desenho (RNG,
  colonização, combate, dano, vigor, áudio e objetivo). É um harness isolado,
  não deve ser descrito como 600 frames do jogo completo.
- Após a correção autorizada, o navegador já observou crescimento natural:
  colonização 16,2% → 40,2% → 76,4%, sem alterar taxas/estoques/estatísticas.
  A coleta, recrutamento e inoculação reais de Trichoderma produziram contato
  51,7%, lise 56,3%, regressão para 38,8% e eliminação a 6%.
- Capturas e logs locais: `work/rhizoctonia-qa/`; não são versionados.
  Script usado: `work/rhizoctonia-qa/playthrough.cjs`.
- Esse ensaio parou numa **asserção incorreta do script**: exigia dano final
  menor que o dano ANTES da intervenção. A raiz continuou sofrendo lesão durante
  a busca/contato. Eliminar o fungo não obriga cura instantânea. Não modificar
  `root-health-gameplay.js` para fazer essa asserção passar. Comparar a biomassa
  e os valores reais; conservar a cicatriz enquanto o dano real existir.

Antes de integrar: concluir o ensaio com relatório JSON, conferir os quatro
momentos visualmente, comparar 2D/WebGL e testar a guarda da física num loop
completo (gerenciado cresce, legado com stun mantém regressão). Conferir custo
de pintura em colonização alta; agrupar traços se necessário, sem mudar biologia.
Atualizar este registro e `docs/rhizoctonia-organic-mycelium.md` com os resultados.

## Validação e integração no main

Leia AGENTS.md. Gere dist exclusivamente com `npm run build`. Execute os testes
novos e os relacionados a fase 6, organismos, hifas, áudio biológico, objetivos,
biofilme e recuperação. Execute `node tests/browser-smoke.cjs`: historicamente
há falha preexistente em `source: queued Bacillus card should open after stable
support`; registrar se continuar, não declarar suíte global aprovada nem mexer
no tutorial geral para contornar isso.

Após testes, revisar `git diff origin/main...HEAD` e conferir que sprites,
texturas, objetivos e demais sistemas não foram alterados. Fazer commit e push
da branch. Para integrar, atualizar origin/main e verificar se é ancestral do
commit aprovado. Se main avançou, preservar as alterações novas e resolver a
integração em branch; nunca usar force-push. Main aciona automaticamente
`.github/workflows/deploy-pages.yml`; acompanhar o run até success e conferir
o jogo público com `?render=25d&v=<sha>` e o buildstamp correspondente.

Não publicar uma versão com teste/QA pendente sem deixar essa situação explícita.
