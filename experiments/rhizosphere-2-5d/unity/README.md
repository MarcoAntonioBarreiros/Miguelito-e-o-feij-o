# Miguelito — estudo de rizosfera em Unity URP

Projeto experimental standalone para Unity **2022.3.44f1**, **URP 14.0.11**, Renderer 2D. Não inicia uma migração de gameplay. A cena é uma composição visual de micorriza/rizosfera comparável à direção artística da fase 4; não é uma execução da fase 4 original.

## Estado real da validação

O Editor foi encontrado com módulos Windows e WebGL. A tentativa real em batchmode parou antes de importar/compilar o projeto por licença inválida: `Machine bindings don't match`, `Token not found in cache` e `No valid Unity Editor license found. Please activate your license.` Veja `Evidence/unity-batchmode-license.log`.

Os dois arquivos C# **compilaram sem erros** via Roslyn contra os assemblies managed do Editor instalado e os assemblies URP do cache de seu template Universal 2D. Veja `Evidence/csharp-reference-check.log`. Essa checagem de referências valida C# e APIs; **não** comprova importação de assets, resolução de pacotes, shaders, imagem, FPS, sombras na GPU nem build de Player. Não foi produzido executável Unity nem captura Unity, e não há benchmark Unity nesta entrega. A demonstração executável entregue no projeto principal é a versão WebGL/Three.js.

## Preparar os sprites originais sem duplicá-los no repositório

Esta cópia experimental guarda somente código e configuração. Antes de abrir o Editor, execute a partir desta pasta:

```powershell
.\tools\copy-original-assets.ps1
```

O script localiza os nove PNGs na pasta assets da raiz deste mesmo repositório, confere os SHA-256 registrados e os copia para Assets/Resources/Original. Essa pasta de cópias locais é ignorada pelo Git. A miniatura embutida do template padrão da Unity foi omitida desta cópia textual; a cena e as configurações de renderização foram mantidas. Para apenas conferir as fontes, use -VerifyOnly. Nenhum download é necessário e os originais não são alterados.

## Abrir e experimentar após ativar a licença

1. No Unity Hub, adicione esta pasta como projeto e abra com 2022.3.44f1. O projeto fixa URP 14.0.11, fornecido com esse Editor; suas dependências podem exigir a primeira resolução de pacotes.
2. Execute **Miguelito → Prepare assets and scene**. O menu configura o Renderer 2D, os shaders incluídos no build e importadores de imagens, e salva `Assets/Scenes/Rhizosphere.unity`.
3. Pressione **Play**. `RhizosphereDemo` monta a composição ao iniciar. A cena entregue também tem bootstrap de runtime; o menu prepara os importadores antes da primeira avaliação.
4. **A/D** move a câmera para observar paralaxe. **Espaço** reinicia o crescimento; **G** pausa o crescimento; **L** alterna as luzes principais; **P** alterna partículas; **H** oculta o painel.
5. Use **Miguelito → Build Windows visual demo** ou **Build WebGL visual demo**. Os builds serão escritos em `Builds/Windows` e `Builds/WebGL`. O segundo usa compressão desativada para facilitar um servidor estático local; isso não representa o tamanho final otimizado.

Alternativa PowerShell, a partir desta pasta:

```powershell
.\tools\build-unity.ps1 -Target Prepare
.\tools\build-unity.ps1 -Target Windows
.\tools\build-unity.ps1 -Target WebGL
```

Depois de um build Windows bem-sucedido, `Builds/Windows/MiguelitoRhizosphere.exe --capture Evidence/unity-real-render.png` solicita uma captura real da GPU após quatro segundos. Não use `-nographics` para executar/capturar o Player. O arquivo deve ser inspecionado antes de considerar a comparação visual validada.

Para repetir apenas a checagem C# sem licença do Editor:

```powershell
.\tools\verify-references.ps1
```

Essa checagem depende do cache de template do Editor instalado e não substitui as etapas de Play e build.

## Implementação incluída

- Texturas e frames originais de Miguelito, micorriza, Pseudomonas, Rhizobium e Trichoderma; nenhum personagem reconstruído em 3D. Todas as quatro folhas do Miguelito são preparadas pelo script de cópia; a composição usa idle. Os PNGs preparados mantêm os bytes originais, registrados em `Evidence/original-assets.sha256.json`.
- Animação por recortes da tira horizontal: Miguelito 8 quadros/6 fps; micorriza e Pseudomonas 24/10 fps; Rhizobium 12/6 fps; Trichoderma 12/7 fps. O idle do Miguelito usa `contentHeight=224`, baseline 379/400, mantendo a diferença real de escala da arte. `run`, `hurt` e `celebrate` estão disponíveis, mas não são acionados por controles de gameplay neste estudo.
- Luzes URP `Light2D`: preenchimento global, key quente móvel, preenchimento ciano oscilante e rim azul. Sombras 2D reais são configuradas em sete agregados de solo, usando `ShadowCaster2D`. Sombras de contato dos personagens são sprites suaves estilizados; não são projeções físicas de modelos 3D.
- Normal maps secundários nos agregados do solo, gerados de uma superfície arredondada procedural; nenhuma normal dos personagens foi inventada. Normal map de personagem de produção exigiria autoria por frame e revisão artística.
- 47 fitas de raízes/hifas, com 65 amostras cada e buffers reutilizados, crescimento progressivo e ramificação autorada; 95 partículas animadas; camadas de paralaxe. As fitas estão no shader Sprite Lit da URP, com UVs, tangentes e cor por vértice. A integração visual desse shader com MeshRenderer ainda requer verificação real no Editor.
- Cenário pintado original preservado ao fundo, câmera ortográfica e silhuetas próximas. A iluminação é 2D e a profundidade é de composição; não há conversão de personagens para volumes.

As folhas de micorriza/Pseudomonas têm 7680×400 pixels. O menu força Max Size 8192 e desativa compressão/mipmaps para evitar redução silenciosa para 2048; uma distribuição de produção deveria repacotar frames em atlas e medir memória/transferência. Todas as imagens carregam via `Resources` nesta prova; Addressables/atlases são uma etapa posterior, não implementada.

## O que falta para uma comparação justa

Após ativação, verificar importação e imagem; conferir as normais e a silhueta das sombras; capturar 1600×900; medir CPU/GPU, draw calls, RAM/VRAM e transferência da build WebGL no mesmo hardware, cena, câmera e número de partículas da demonstração Three.js. O contador na tela observa o intervalo de frames local e não é um benchmark isolado de GPU.

A composição não contém física, colisões, IA, save, áudio ou microbiologia. Migrar o jogo exigiria portar os sistemas JavaScript, manter a caixa física 32×48 independente da arte, reproduzir a integração temporal e validar as dez fases. A vantagem de ferramentas de luz/sombra e autoria da Unity é plausível; seu custo e benefício não foram medidos visualmente nesta máquina por causa da licença.

## Referências técnicas

- [URP 14 — Light2D e propriedades de normal map/sombra](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/api/UnityEngine.Rendering.Universal.Light2D.html)
- [URP 14 — ShadowCaster2D](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/api/UnityEngine.Rendering.Universal.ShadowCaster2D.html)
- [URP 14 — normal maps e Secondary Textures](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/SecondaryTextures.html)
- [Unity 2022.3 — Sprite.Create e texturas secundárias](https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Sprite.Create.html)
- [Unity 2022.3 — limites técnicos de WebGL](https://docs.unity3d.com/2022.3/Documentation/Manual/webgl-technical-overview.html)
- [Unity 2022.3 — ponte JavaScript/WebGL](https://docs.unity3d.com/2022.3/Documentation/Manual/webgl-interactingwithbrowserscripting.html)

O código fonte URP 14.0.11 incluído em `Editor/Data/Resources/PackageManager/BuiltInPackages` foi conferido para os campos serializados de Light2D e o shader de sprites. A ponte JavaScript existe, mas conservar todos os sistemas JS por uma ponte C#/JS adicionaria sincronização e manutenção; não foi implementada nem testada.

Sprites e background: repositório original de MarcoAntonioBarreiros/Miguelito-e-o-feij-o. A licença do repositório foi preservada em `ORIGINAL-LICENSE`.
