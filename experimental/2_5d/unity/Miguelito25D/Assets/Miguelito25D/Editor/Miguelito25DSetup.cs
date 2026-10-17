// Prepara o projeto: importacao dos sprites originais (fatiados como no jogo
// web, com o normal map gerado como textura secundaria _NormalMap) e a cena
// Rizosfera25D. Roda sozinho na primeira abertura; depois, pelo menu
// Miguelito > Montar cena 2,5D.
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Miguelito25D.EditorTools
{
    [InitializeOnLoad]
    public static class Miguelito25DSetup
    {
        const string Root = "Assets/Miguelito25D";
        const string Art = Root + "/Resources/Art";
        const string ScenePath = Root + "/Scenes/Rizosfera25D.unity";

        // folha -> (quadros, pivo y). Pivo y = 1 - baseline do jogo para o pe pisar no chao.
        static readonly Dictionary<string, (int frames, float pivotY)> Sheets = new Dictionary<string, (int, float)>
        {
            { "miguelito/run", (8, 1f - 379f / 400f) },
            { "miguelito/idle", (8, 1f - 379f / 400f) },
            { "miguelito/hurt", (8, 1f - 381f / 400f) },
            { "miguelito/celebrate", (8, 1f - 381f / 400f) },
            { "organisms/rhizobium", (12, .5f) },
            { "organisms/azospirillum", (12, .5f) },
            { "organisms/ralstonia", (12, .5f) },
            { "organisms/rhizoctonia", (12, .5f) },
            { "organisms/micorriza", (24, .5f) },
            { "organisms/oportunista", (12, .5f) },
            { "organisms/pseudomonas", (24, .5f) },
            { "organisms/nematoide", (12, .5f) },
            { "organisms/trichoderma", (12, .5f) },
        };

        // bacillus.png: quadros de largura variavel, mesma tabela de bacillus-sprite.js
        static readonly int[] BacillusFrames =
        {
            12,63, 96,63, 179,63, 262,62, 345,63, 428,63, 511,63, 594,63, 677,62, 760,62, 842,63, 924,65, 1006,67, 1088,69,
            1170,72, 1252,74, 1335,75, 1417,76, 1499,78, 1582,78, 1665,78, 1749,77, 1832,77, 1915,77, 1998,78, 2081,78,
            2165,77, 2249,76, 2333,75, 2417,74, 2501,72, 2586,68, 2670,66, 2754,65, 2838,64, 2922,63, 3006,62, 3090,62,
            3173,63, 3256,63, 3339,63, 3423,62, 3506,63, 3589,63,
        };

        static Miguelito25DSetup()
        {
            EditorApplication.delayCall += () =>
            {
                if (!File.Exists(ScenePath) && Directory.Exists(Art)) Build();
            };
        }

        [MenuItem("Miguelito/Montar cena 2,5D")]
        public static void Build()
        {
            CheckPipeline();
            ConfigureArt();
            CreateScene();
        }

        static void CheckPipeline()
        {
            var asset = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
            if (asset == null)
            {
                Debug.LogError("[Miguelito25D] O projeto nao usa URP. Crie o projeto pelo modelo '2D (URP)' do Unity Hub.");
                return;
            }
            var so = new SerializedObject(asset);
            var list = so.FindProperty("m_RendererDataList");
            bool is2D = list != null && list.arraySize > 0 && list.GetArrayElementAtIndex(0).objectReferenceValue is Renderer2DData;
            if (!is2D) Debug.LogError("[Miguelito25D] O renderizador padrao nao e o 2D Renderer: luzes 2D e sombras 2D nao vao aparecer.");
            asset.supportsHDR = true;
            EditorUtility.SetDirty(asset);
        }

        static void ConfigureArt()
        {
            if (!Directory.Exists(Art)) { Debug.LogError("[Miguelito25D] faltam os sprites em " + Art + " (rode setup_unity_project.sh)"); return; }
            AssetDatabase.Refresh();
            var files = Directory.GetFiles(Art, "*.png", SearchOption.AllDirectories).Select(f => f.Replace('\\', '/')).ToList();

            // 1. normal maps primeiro: precisam existir como NormalMap antes de virar textura secundaria
            foreach (var f in files.Where(f => f.EndsWith("_n.png")))
            {
                var imp = (TextureImporter)AssetImporter.GetAtPath(f);
                if (imp == null) continue;
                imp.textureType = TextureImporterType.NormalMap;
                imp.maxTextureSize = 8192;
                imp.textureCompression = TextureImporterCompression.CompressedHQ;
                imp.SaveAndReimport();
            }

            // 2. sprites
            foreach (var f in files.Where(f => !f.EndsWith("_n.png")))
            {
                var imp = (TextureImporter)AssetImporter.GetAtPath(f);
                if (imp == null) continue;
                string key = f.Substring(Art.Length + 1).Replace(".png", "");
                imp.textureType = TextureImporterType.Sprite;
                imp.spritePixelsPerUnit = 100;
                imp.maxTextureSize = 8192;
                imp.mipmapEnabled = true;
                imp.alphaIsTransparency = true;
                imp.textureCompression = TextureImporterCompression.CompressedHQ;
                var size = TextureSize(f);

                List<SpriteRect> rects = null;
                if (Sheets.TryGetValue(key, out var sheet))
                {
                    imp.spriteImportMode = SpriteImportMode.Multiple;
                    float fw = size.x / (float)sheet.frames;
                    rects = Enumerable.Range(0, sheet.frames).Select(i => new SpriteRect
                    {
                        name = Path.GetFileName(key) + "_" + i,
                        rect = new Rect(i * fw, 0, fw, size.y),
                        alignment = SpriteAlignment.Custom,
                        pivot = new Vector2(.5f, sheet.pivotY),
                        spriteID = GUID.Generate(),
                    }).ToList();
                }
                else if (key == "bacillus/bacillus" || key == "bacillus/inoculated_bacillus")
                {
                    imp.spriteImportMode = SpriteImportMode.Multiple;
                    rects = new List<SpriteRect>();
                    for (int i = 0; i < BacillusFrames.Length / 2; i++)
                        rects.Add(new SpriteRect
                        {
                            name = Path.GetFileName(key) + "_" + i,
                            rect = new Rect(BacillusFrames[i * 2], 0, BacillusFrames[i * 2 + 1], size.y),
                            alignment = SpriteAlignment.Center,
                            pivot = new Vector2(.5f, .5f),
                            spriteID = GUID.Generate(),
                        });
                }
                else
                {
                    imp.spriteImportMode = SpriteImportMode.Single;
                    var settings = new TextureImporterSettings();
                    imp.ReadTextureSettings(settings);
                    settings.spriteAlignment = key.StartsWith("terrain/") ? (int)SpriteAlignment.TopLeft : (int)SpriteAlignment.Center;
                    imp.SetTextureSettings(settings);
                }
                imp.SaveAndReimport();

                // fatiamento pela API atual (TextureImporter.spritesheet foi removido)
                var factory = new SpriteDataProviderFactories();
                factory.Init();
                var dp = factory.GetSpriteEditorDataProviderFromObject(imp);
                dp.InitSpriteEditorDataProvider();
                if (rects != null)
                {
                    dp.SetSpriteRects(rects.ToArray());
                    var ids = dp.GetDataProvider<ISpriteNameFileIdDataProvider>();
                    ids?.SetNameFileIdPairs(rects.Select(r => new SpriteNameFileIdPair(r.name, r.spriteID)));
                }
                var nmPath = f.Replace(".png", "_n.png");
                var nm = AssetDatabase.LoadAssetAtPath<Texture2D>(nmPath);
                var secondary = dp.GetDataProvider<ISecondaryTextureDataProvider>();
                if (secondary != null)
                    secondary.textures = nm != null
                        ? new[] { new SecondarySpriteTexture { name = "_NormalMap", texture = nm } }
                        : new SecondarySpriteTexture[0];
                dp.Apply();
                imp.SaveAndReimport();
            }
        }

        static Vector2Int TextureSize(string assetPath)
        {
            var bytes = File.ReadAllBytes(assetPath);
            // cabecalho IHDR do PNG: largura e altura em big-endian nos bytes 16..23
            int w = bytes[16] << 24 | bytes[17] << 16 | bytes[18] << 8 | bytes[19];
            int h = bytes[20] << 24 | bytes[21] << 16 | bytes[22] << 8 | bytes[23];
            return new Vector2Int(w, h);
        }

        static void CreateScene()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
            foreach (var l in Object.FindObjectsOfType<Light>()) Object.DestroyImmediate(l.gameObject);
            var cam = Camera.main;
            cam.orthographic = true;
            cam.orthographicSize = 720f / 1.45f / 2f / 100f;
            cam.transform.position = new Vector3(0, 0, -10);
            new GameObject("Rizosfera25D").AddComponent<Rizosfera25DBootstrap>();
            EditorSceneManager.SaveScene(scene, ScenePath);
            var scenes = EditorBuildSettings.scenes.Where(s => s.path != ScenePath).ToList();
            scenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
            Debug.Log("[Miguelito25D] cena pronta: " + ScenePath + " — aperte Play.");
        }
    }
}
