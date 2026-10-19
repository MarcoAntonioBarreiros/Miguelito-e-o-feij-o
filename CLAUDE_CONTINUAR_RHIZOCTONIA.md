# Continuidade: micélio orgânico de Rhizoctonia

Registro final de 19/10/2026. Implementação e validação experimental concluídas.
Primeiro checkpoint enviado: `6598012`; consultar `git log -1` para o commit
final. Nenhuma alteração desta entrega foi publicada na main.

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
- Na conferência final, main já estava em **`e1a84c246b6a885ddecb894811e6e44c6d7cb88a`**.
  Os novos commits de nódulos, radar, túneis, diretor da fase 10 e fases 11+
  **não estão nesta branch experimental**. A correção da fase 9 (`624b7c8`)
  agora já está na main; não reaplicar essa branch separadamente.
- Não misturar o checkout antigo `miguelito-webgl-fixes` com esta entrega.
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

## Evidências concluídas e limites da validação

- **150 testes direcionados aprovados no lote final** (zero falhas, 22 s),
  incluindo a guarda da física. O arquivo `tests/rhizoctonia-mycelium.test.js`
  completo tem **13 testes aprovados**, incluindo loop com `sim.step` e comportamento
  legado com e sem stun. Não afirmar que a suíte global inteira passou.
- O harness isolado de 600 passos compara os dois controles com/sem desenho
  (RNG, colonização, combate, dano, vigor, áudio e objetivos). Não apresentar
  isso como 600 frames do jogo completo.
- **Ensaio completo da fase 6 passou no Chrome**, WebGL e troca para Canvas.
  Colonização natural: 16,7% → 40,3% → 76,4% → 90,2%; contato/enovelamento;
  lise 57,2% / colonização 39,2%; eliminação em 6%, rede restante zero.
  Coleta, recrutamento e inoculação com E reais; atalhos mudaram apenas a posição
  de Miguelito, sem editar HP, estoques, dano, taxas ou objetivos. Zero mortes.
- JSON do ensaio: **zero erros JS, de console, HTTP ou de requisição**.
- Sete capturas e JSON versionados em
  [docs/evidence/rhizoctonia-mycelium](docs/evidence/rhizoctonia-mycelium/README.md).
  Galeria: `docs/evidence/rhizoctonia-mycelium/index.html`.
- Script reproduzível: `scripts/validate-rhizoctonia-phase6.cjs`.
  Logs brutos locais: `work/rhizoctonia-qa/` (ignorados no Git).
- Renderer final faz culling antes de construir o modelo e agrupa traços em
  lotes de seis segmentos; mantém limites de geometria. Não houve benchmark
  comparativo de FPS em hardware móvel.
- Smoke global final: **timeout do Chrome, exit 124**. Houve também registro
  anterior de falha do fixture Bacillus descrito abaixo. Não declarar aprovação
  global; repetir depois da integração com a main mais nova.

Uma asserção incorreta do script exigia dano final menor que o dano ANTES da
intervenção. Foi corrigida e o ensaio terminou, sem alterar a biologia para passar.
A lesão pode crescer durante busca/contato e continuar após eliminar o fungo.
No jogo existente, root-health-gameplay pode republicar dano residual depois
da redução imediata pelo controle específico. Isso não foi alterado: o visual
acompanha os valores reais e não finge cura instantânea.

Para reproduzir, iniciar o servidor acima e executar (requer Playwright):

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/Users/marco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node scripts/validate-rhizoctonia-phase6.cjs
```

Saída nova: `outputs/rhizoctonia-phase6/`, ignorada no Git.
Não usar `RHIZO_LOW_LOAD=1` para validar expansão avançada.

## Validação e integração no main

Leia AGENTS.md. Gere dist exclusivamente com `npm run build`. Execute os testes
novos e os relacionados a fase 6, organismos, hifas, áudio biológico, objetivos,
biofilme e recuperação. Execute `node tests/browser-smoke.cjs`: historicamente
há falha preexistente em `source: queued Bacillus card should open after stable
support`; registrar se continuar, não declarar suíte global aprovada nem mexer
no tutorial geral para contornar isso.

**Próxima etapa pendente: integrar a main mais nova e testar essa integração.**
Criar branch de integração a partir da main atual e mesclar esta branch
experimental inteira. Preservar novos hunks de `app.js`, `physics.js`,
`package.json` e demais sistemas; não copiar arquivos inteiros sobre main.
Resolver conflitos de dist regenerando com `npm run build`. Repetir os testes
relacionados, o smoke e o ensaio real da fase 6. A validação acima refere-se à
base `0471e82`, não aos commits posteriores que chegaram à main.

Revisar o diff relativo à main atual e conferir sprites, texturas, objetivos,
dificuldade e sistemas novos. Fazer commit da integração e publicar por push
normal apenas depois da validação; nunca force-push/reset nem substituir main
pela base antiga. Main aciona automaticamente
`.github/workflows/deploy-pages.yml`; acompanhar o run até success e conferir
o jogo público com `?render=25d&v=<sha>` e o buildstamp correspondente.

Não publicar uma versão com teste/QA pendente sem deixar essa situação explícita.
Se precisar reverter depois da publicação, reverter somente o commit de
integração desta entrega. Não voltar main até `0471e82`.
