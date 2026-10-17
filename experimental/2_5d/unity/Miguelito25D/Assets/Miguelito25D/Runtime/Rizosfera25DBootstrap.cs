// Monta a cena 2,5D a partir da fase exportada do jogo web.
//
// Mesma composicao da versao WebGL, com as ferramentas nativas do URP 2D:
// Light2D (pontuais, cones da superficie com volume, global), ShadowCaster2D
// nas plataformas, normal maps como textura secundaria dos sprites, Volume de
// pos-processamento (bloom, ACES, vinheta) e ParticleSystem.
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Miguelito25D
{
    public class Rizosfera25DBootstrap : MonoBehaviour
    {
        static readonly Dictionary<string, (string sheet, float fps)> Sheets = new Dictionary<string, (string, float)>
        {
            { "rhizobium", ("organisms/rhizobium", 6) },
            { "azospirillum", ("organisms/azospirillum", 7) },
            { "myco", ("organisms/micorriza", 10) },
            { "pseudomonas", ("organisms/pseudomonas", 10) },
            { "trichoderma", ("organisms/trichoderma", 7) },
            { "oportunista", ("organisms/oportunista", 7) },
            { "rhizoctonia", ("organisms/rhizoctonia", 7) },
            { "bacillus", ("bacillus/bacillus", 12) },
        };

        static readonly Dictionary<string, Color> AgentLight = new Dictionary<string, Color>
        {
            { "rhizobium", new Color(.35f, 1f, .92f) },
            { "azospirillum", new Color(.42f, .62f, 1f) },
            { "myco", new Color(.82f, .58f, 1f) },
            { "bacillus", new Color(.7f, 1f, .45f) },
            { "pseudomonas", new Color(.3f, .95f, .85f) },
        };

        LevelData level;
        MiguelitoController player;
        RootGrowthNetwork far, mid, hyphae;
        Transform camT;

        static Sprite[] Frames(string path)
        {
            var sprites = Resources.LoadAll<Sprite>("Art/" + path);
            return sprites.OrderBy(s =>
            {
                int i = s.name.LastIndexOf('_');
                return i >= 0 && int.TryParse(s.name.Substring(i + 1), out int n) ? n : 0;
            }).ToArray();
        }

        void Start()
        {
            level = LevelData.Load();
            if (level == null) return;
            var cam = Camera.main;
            camT = cam.transform;
            cam.orthographic = true;
            cam.backgroundColor = new Color(.006f, .03f, .038f);
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.GetUniversalAdditionalCameraData().renderPostProcessing = true;

            BuildPost();
            Light2DKit.Global(new GameObject("Luz global (ambiente)"), new Color(.42f, .58f, .62f), .30f);
            BuildBackground();
            BuildGrowth();
            BuildTerrain();
            BuildPlayer();
            var rig = cam.gameObject.AddComponent<CameraRig>();
            rig.target = player;
            rig.minX = level.x0; rig.maxX = level.x1;
            rig.topY = level.top - 420f; rig.bottomY = level.bottom + 260f;
            BuildShafts();
            BuildExudates();
            BuildAgents();
            BuildParticles();
        }

        void BuildPost()
        {
            var go = new GameObject("Pos-processamento");
            var vol = go.AddComponent<Volume>();
            vol.isGlobal = true;
            var profile = ScriptableObject.CreateInstance<VolumeProfile>();
            var bloom = profile.Add<Bloom>(true);
            bloom.threshold.Override(.95f); bloom.intensity.Override(.9f); bloom.scatter.Override(.65f);
            var tone = profile.Add<Tonemapping>(true);
            tone.mode.Override(TonemappingMode.ACES);
            var vig = profile.Add<Vignette>(true);
            vig.intensity.Override(.33f); vig.smoothness.Override(.45f);
            var ca = profile.Add<ColorAdjustments>(true);
            ca.postExposure.Override(.35f); ca.contrast.Override(8f); ca.saturation.Override(6f);
            var smh = profile.Add<ShadowsMidtonesHighlights>(true);
            smh.shadows.Override(new Vector4(.92f, 1.02f, 1.06f, 0f));
            smh.highlights.Override(new Vector4(1.04f, 1f, .95f, 0f));
            var grain = profile.Add<FilmGrain>(true);
            grain.intensity.Override(.12f);
            vol.profile = profile;
        }

        void BuildBackground()
        {
            var sprite = Resources.Load<Sprite>("Art/backgrounds/miguelito-rhizosphere");
            if (sprite == null) return;
            var go = new GameObject("Fundo (pano da rizosfera)");
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = -100;
            sr.color = new Color(.55f, .62f, .64f);
            float visH = 720f / 1.45f;
            float s = visH * 1.35f / sprite.rect.height;
            go.transform.localScale = new Vector3(s, s, 1);
            go.transform.position = Px.World(level.x0 - 300f, level.top - 420f + visH * .62f, 5f);
            var p = go.AddComponent<ParallaxLayer>();
            p.cam = camT; p.follow = .9f;
        }

        RootGrowthNetwork Network(string name, int order, int seed, float tint, float desat, float follow)
        {
            var go = new GameObject(name);
            var mr = go.AddComponent<MeshRenderer>();
            go.AddComponent<MeshFilter>();
            mr.sharedMaterial = RootGrowthNetwork.CreateMaterial();
            mr.sortingOrder = order;
            var net = go.AddComponent<RootGrowthNetwork>();
            net.seed = seed; net.tint = tint; net.desaturate = desat;
            if (follow > 0) { var p = go.AddComponent<ParallaxLayer>(); p.cam = camT; p.follow = follow; }
            return net;
        }

        void BuildGrowth()
        {
            var rnd = new System.Random(4242);
            float R() => (float)rnd.NextDouble();
            far = Network("Raizes ao fundo (paralaxe .35)", -60, 11, .42f, .5f, .35f);
            mid = Network("Raizes intermediarias (paralaxe .18)", -40, 23, .62f, .3f, .18f);
            hyphae = Network("Hifas micorrizicas", -5, 37, 1f, 0f, 0f);
            for (float x = level.x0 - 200; x < level.x1 + 1400; x += 300 + R() * 300)
                far.Spawn(new Vector2(x, level.top - 420), -Mathf.PI / 2 + (R() - .5f) * .35f, RootGrowthNetwork.Kind.Root, 6 + R() * 5, 34, 1500 + R() * 500);
            for (float x = level.x0; x < level.x1 + 800; x += 520 + R() * 520)
                mid.Spawn(new Vector2(x, level.top - 380), -Mathf.PI / 2 + (R() - .5f) * .4f, RootGrowthNetwork.Kind.Root, 8 + R() * 4, 30, 1300 + R() * 400);
            foreach (var p in level.platforms)
            {
                if (R() < .6f) continue;
                var c = new Vector2(p.x + p.w * (.2f + R() * .6f), p.y + p.h * .75f);
                for (int k = 0; k < 2; k++)
                    hyphae.Spawn(c, -Mathf.PI / 2 + (R() - .5f) * 2.2f, RootGrowthNetwork.Kind.Hypha, 1.1f, 40, 120 + R() * 120);
            }
            // a fase nao comeca vazia: as raizes ja cresceram antes do jogador chegar
            far.Prewarm(40); mid.Prewarm(26); hyphae.Prewarm(4);
        }

        void BuildTerrain()
        {
            var root = new GameObject("Terreno (desenhado pelo jogo, relido pela luz)").transform;
            foreach (var tile in level.terrain.tiles)
            {
                var name = System.IO.Path.GetFileNameWithoutExtension(tile.file);
                var sprite = Resources.Load<Sprite>("Art/terrain/" + name);
                if (sprite == null) { Debug.LogWarning("[Miguelito25D] faltou " + name); continue; }
                var go = new GameObject(name);
                go.transform.SetParent(root);
                go.transform.position = Px.World(tile.x, level.terrain.y0, 0f);
                var sr = go.AddComponent<SpriteRenderer>();
                sr.sprite = sprite;
                sr.sortingOrder = 0;
            }
            // sombras: o corpo de cada plataforma, um pouco recolhido nas bordas
            var shadows = new GameObject("Sombras das plataformas").transform;
            foreach (var p in level.platforms)
            {
                var go = new GameObject($"sombra {p.type} {p.x:0}");
                go.transform.SetParent(shadows);
                go.transform.position = Px.World(p.x, p.y, 0f);
                float w = Px.ToUnits(p.w), h = Px.ToUnits(p.h), inset = .06f;
                Light2DKit.ShadowShape(go, new[]
                {
                    new Vector2(inset, -inset * .5f), new Vector2(w - inset, -inset * .5f),
                    new Vector2(w - inset * 2, -h + inset), new Vector2(inset * 2, -h + inset),
                });
            }
            // zona necrotica no fundo (o jogo desenha com renderer.necroticZone)
            foreach (var hz in level.hazards)
            {
                var go = new GameObject("zona necrotica");
                var sr = go.AddComponent<SpriteRenderer>();
                sr.sprite = GlowSprite(new Color(.55f, .08f, .32f), false);
                sr.sortingOrder = 5;
                go.transform.position = Px.World(hz.x + hz.w / 2, hz.y + hz.h / 2, 0f);
                go.transform.localScale = new Vector3(hz.w / 64f, hz.h / 64f * 1.6f, 1);
            }
        }

        void BuildPlayer()
        {
            var go = new GameObject("Miguelito");
            player = go.AddComponent<MiguelitoController>();
            player.runFrames = Frames("miguelito/run");
            player.idleFrames = Frames("miguelito/idle");
            player.platforms = level.platforms.ToList();
            player.minX = level.x0; player.maxX = level.x1;
            var first = level.platforms.OrderBy(p => p.x).First();
            player.x = first.x + 30; player.y = first.y - 60;
            var lantern = new GameObject("Lanterna");
            lantern.transform.SetParent(go.transform, false);
            lantern.transform.localPosition = new Vector3(.3f, .45f, 0);
            Light2DKit.Point(lantern, new Color(1f, .82f, .58f), 1.0f, .3f, 4.4f, shadows: true, shadowIntensity: .75f, volume: .04f);
            player.onJump = pos => Burst(pos, new Color(.85f, 1f, .76f), 8);
        }

        void BuildShafts()
        {
            var root = new GameObject("Feixes da superficie").transform;
            var rnd = new System.Random(77);
            for (float x = level.x0 + 300; x < level.x1 + 600; x += 640 + (float)rnd.NextDouble() * 360)
            {
                var go = new GameObject("feixe");
                go.transform.SetParent(root);
                go.transform.position = Px.World(x, level.top - 260, 0f);
                go.transform.rotation = Quaternion.Euler(0, 0, 180f + ((float)rnd.NextDouble() - .5f) * 24f);
                Light2DKit.Spot(go, new Color(.55f, .82f, 1f), 1.15f, 16f, 18f, 58f, shadows: true, volume: .1f);
            }
        }

        Sprite glowCache, discCache;
        Sprite GlowSprite(Color c, bool disc)
        {
            if (disc && discCache) return discCache;
            if (!disc && glowCache) return glowCache;
            const int n = 64;
            var tex = new Texture2D(n, n, TextureFormat.RGBA32, false);
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float d = new Vector2(x - n / 2f + .5f, y - n / 2f + .5f).magnitude / (n / 2f);
                    float a = disc ? Mathf.Clamp01((1 - d) * 3f) * .6f + Mathf.Exp(-d * d * 6f) * .4f : Mathf.Clamp01(1 - d * d);
                    tex.SetPixel(x, y, new Color(1, 1, 1, a));
                }
            tex.Apply();
            var s = Sprite.Create(tex, new Rect(0, 0, n, n), new Vector2(.5f, .5f), 100f);
            if (disc) discCache = s; else glowCache = s;
            return s;
        }

        void BuildExudates()
        {
            foreach (var e in level.exudates)
            {
                var go = new GameObject("exsudato");
                var sr = go.AddComponent<SpriteRenderer>();
                sr.sprite = GlowSprite(Color.white, true);
                sr.color = new Color(1.4f, 1.9f, 1.0f); // HDR: o bloom pega
                sr.sortingOrder = 30;
                go.transform.localScale = Vector3.one * .3f;
                var lightGo = new GameObject("luz");
                lightGo.transform.SetParent(go.transform, false);
                Light2DKit.Point(lightGo, new Color(.7f, 1f, .42f), 1.6f, .1f, 2.6f, shadows: true, shadowIntensity: .7f, volume: .08f);
                var ex = go.AddComponent<Exudate>();
                ex.posPx = new Vector2(e.x, e.y);
                ex.player = player;
                ex.onCollected = OnExudate;
            }
        }

        void OnExudate(Vector2 p)
        {
            for (int k = 0; k < 7; k++)
                hyphae.Spawn(p, Random.value * Mathf.PI * 2, RootGrowthNetwork.Kind.Hypha, 1.2f, 70, 110 + Random.value * 140);
            mid.Spawn(p + new Vector2(30, -120), -Mathf.PI / 2 + (Random.value - .5f) * 1.4f, RootGrowthNetwork.Kind.Root, 5, 55, 360, 1);
            Burst(p, new Color(.8f, 1f, .5f), 22);
        }

        void BuildAgents()
        {
            var root = new GameObject("Organismos").transform;
            var lit = new List<Vector2>();
            foreach (var a in level.agents)
            {
                if (!Sheets.TryGetValue(a.type, out var info)) continue;
                var frames = Frames(info.sheet);
                if (frames.Length == 0) continue;
                var go = new GameObject(a.type);
                go.transform.SetParent(root);
                var m = go.AddComponent<MicrobeAgent>();
                m.frames = frames; m.fps = info.fps;
                m.heightPx = a.height > 0 ? a.height : 60;
                m.homePx = new Vector2(a.x, a.y);
                m.radiusPx = a.radius; m.phase = a.phase;
                // colonia vira uma luz so
                var pos = new Vector2(a.x, a.y);
                if (AgentLight.TryGetValue(a.type, out var col) && lit.Count < 14 && !lit.Any(q => (q - pos).magnitude < 110))
                {
                    lit.Add(pos);
                    var lg = new GameObject("bioluminescencia");
                    lg.transform.SetParent(go.transform, false);
                    Light2DKit.Point(lg, col, .45f, .05f, 1.7f);
                }
            }
        }

        ParticleSystem burst;
        void Burst(Vector2 px, Color c, int count)
        {
            if (burst == null) return;
            var ep = new ParticleSystem.EmitParams { position = Px.World(px.x, px.y, 0f), startColor = c, applyShapeToPosition = true };
            burst.Emit(ep, count);
        }

        void BuildParticles()
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/2D/Sprite-Lit-Default"));
            mat.mainTexture = GlowSprite(Color.white, false).texture;
            ParticleSystem Make(string name, int order, float size, Color color, int max, float rate, Vector3 box, float zFollow)
            {
                var go = new GameObject(name);
                go.transform.SetParent(camT, false);
                go.transform.localPosition = new Vector3(0, 0, 10);
                var ps = go.AddComponent<ParticleSystem>();
                ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
                var main = ps.main;
                main.loop = true; main.duration = 10; main.maxParticles = max;
                main.startLifetime = new ParticleSystem.MinMaxCurve(8f, 14f);
                main.startSpeed = 0f;
                main.startSize = new ParticleSystem.MinMaxCurve(size * .4f, size);
                main.startColor = color;
                main.simulationSpace = ParticleSystemSimulationSpace.World;
                main.prewarm = true;
                var em = ps.emission; em.rateOverTime = rate;
                var shape = ps.shape; shape.shapeType = ParticleSystemShapeType.Box; shape.scale = box;
                var noise = ps.noise; noise.enabled = true; noise.strength = .15f; noise.frequency = .2f; noise.scrollSpeed = .05f;
                var vel = ps.velocityOverLifetime; vel.enabled = true; vel.y = new ParticleSystem.MinMaxCurve(-.04f, .02f);
                var fade = ps.colorOverLifetime; fade.enabled = true;
                var g = new Gradient();
                g.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) },
                          new[] { new GradientAlphaKey(0, 0), new GradientAlphaKey(1, .2f), new GradientAlphaKey(1, .8f), new GradientAlphaKey(0, 1) });
                fade.color = g;
                var r = go.GetComponent<ParticleSystemRenderer>();
                r.sharedMaterial = mat; r.sortingOrder = order;
                ps.Play();
                return ps;
            }
            Make("Poeira mineral (fundo)", -30, .05f, new Color(1f, .92f, .78f, .55f), 700, 60, new Vector3(16, 9, 1), 0);
            Make("Esporos", 45, .07f, new Color(.75f, .92f, 1f, .5f), 160, 12, new Vector3(16, 9, 1), 0);
            burst = Make("Faiscas", 55, .08f, Color.white, 300, 0, new Vector3(.3f, .3f, .1f), 0);
            var bm = burst.main; bm.startLifetime = new ParticleSystem.MinMaxCurve(.4f, .9f); bm.startSpeed = new ParticleSystem.MinMaxCurve(.6f, 1.6f);
            var bsh = burst.shape; bsh.shapeType = ParticleSystemShapeType.Circle; bsh.radius = .05f;
            var bem = burst.emission; bem.rateOverTime = 0;
            burst.transform.SetParent(null);
        }
    }
}
