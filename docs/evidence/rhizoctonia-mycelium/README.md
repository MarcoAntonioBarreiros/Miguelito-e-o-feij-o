# Evidências da fase 6

Capturas do jogo integrado na fase 6, em 19/10/2026, sobre a base 0471e82 e com o renderer final desta branch. Coleta, recrutamento, inoculação e biologia reais. Atalhos mudaram só a posição do jogador. A main recebeu novos commits depois dessa base; a integração ainda precisa ser validada.

[Galeria local](index.html) · [Relatório bruto](report.json)

| Captura | Colonização | Dano real | Contato | Lise |
|---|---:|---:|---:|---:|
| [Foco inicial](01-focus-initial.png) | 16.7% | 43.4% | 0.0% | 0.0% |
| [Expansão e ramificação](02-expansion.png) | 40.3% | 43.4% | 0.0% | 0.0% |
| [Colonização avançada e necrose](03-necrosis.png) | 76.4% | 53.6% | 0.0% | 0.0% |
| [Contato e enovelamento de Trichoderma](04-trichoderma-coils.png) | 90.2% | 63.7% | 48.9% | 0.0% |
| [Lise e regressão](05-regression.png) | 39.2% | 64.6% | 100.0% | 57.2% |
| [Fungo eliminado, lesão residual real](06-controlled.png) | 6.0% | 46.8% | 100.0% | 100.0% |
| [Compatibilidade Canvas 2D](07-canvas-compatibility.png) | 6.0% | 64.7% | 100.0% | 100.0% |

O ensaio terminou sem erros JavaScript, de console, HTTP ou de requisição, e sem mortes do jogador. O dano pode permanecer após eliminar o fungo; as capturas conservam os valores reais.

Reprodução: iniciar `node scripts/preview-rhizoctonia.cjs` na raiz do checkout e executar `node scripts/validate-rhizoctonia-phase6.cjs` com Playwright disponível. Detalhes no [guia para Claude](../../../CLAUDE_CONTINUAR_RHIZOCTONIA.md).
