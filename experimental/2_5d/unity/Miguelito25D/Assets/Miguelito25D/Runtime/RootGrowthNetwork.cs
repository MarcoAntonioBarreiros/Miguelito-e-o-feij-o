// Crescimento organico de raizes e hifas — porte de experimental/2_5d/gl/growth.js.
//
// Mesma regra de crescimento (direcao-base + ruido, gravitropismo tardio das
// laterais, ramificacao subapical, pelos radiculares na zona de maturacao).
// Cada segmento vira um quadrilatero numa malha unica, desenhada com o
// Sprite-Lit-Default do URP 2D: as luzes 2D e o normal map "tubular" (textura
// de 1 x 64 gerada aqui) dao o volume. A tangente de cada vertice e a direcao
// do segmento, entao a normal gira junto com a raiz.
using System.Collections.Generic;
using UnityEngine;

namespace Miguelito25D
{
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public class RootGrowthNetwork : MonoBehaviour
    {
        public enum Kind { Root, Hypha }

        class Tip
        {
            public Vector2 p; public float angle, baseAngle, wander, width, speed, maxLength, length, acc, along, delay, lastBranch, nextBranch;
            public int generation; public Kind kind;
        }

        public Color rootColor = new Color(.81f, .67f, .45f);
        public Color hyphaColor = new Color(.85f, .78f, .93f);
        public int maxSegments = 9000;
        public int seed = 1;
        public float tint = 1f;      // escurece camadas de fundo
        public float desaturate = 0f;

        readonly List<Tip> tips = new List<Tip>();
        readonly List<Vector3> verts = new List<Vector3>();
        readonly List<Vector2> uvs = new List<Vector2>();
        readonly List<Vector4> tangents = new List<Vector4>();
        readonly List<Color> colors = new List<Color>();
        readonly List<int> tris = new List<int>();
        Mesh mesh;
        System.Random rng;
        bool dirty;
        int segments;

        float R() => (float)(rng ??= new System.Random(seed)).NextDouble();

        void Awake()
        {
            mesh = new Mesh { name = "Raizes e hifas" };
            mesh.MarkDynamic();
            mesh.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
            GetComponent<MeshFilter>().sharedMesh = mesh;
        }

        public static Material CreateMaterial()
        {
            var shader = Shader.Find("Universal Render Pipeline/2D/Sprite-Lit-Default");
            var mat = new Material(shader) { name = "RaizLit (gerado)" };
            mat.SetTexture("_MainTex", CellTexture());
            mat.SetTexture("_NormalMap", TubeNormal());
            return mat;
        }

        // celulas do cortex: fileiras alongadas defasadas, parede suave
        static Texture2D CellTexture()
        {
            const int w = 64, h = 32;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Repeat, name = "celulas" };
            var px = new Color[w * h];
            for (int y = 0; y < h; y++)
            {
                float rr = y / (float)h * 4f;
                int row = Mathf.FloorToInt(rr);
                float cx = rr - row;
                for (int x = 0; x < w; x++)
                {
                    float al = x / (float)w * 2f + row * .5f;
                    float cy = al - Mathf.Floor(al);
                    float wall = Mathf.SmoothStep(0, 1, cx / .16f) * Mathf.SmoothStep(0, 1, (1 - cx) / .16f)
                               * Mathf.SmoothStep(0, 1, cy / .07f) * Mathf.SmoothStep(0, 1, (1 - cy) / .07f);
                    float v = Mathf.Lerp(.8f, 1f, wall);
                    px[y * w + x] = new Color(v, v, v, 1);
                }
            }
            tex.SetPixels(px);
            tex.Apply(true);
            return tex;
        }

        // normal tangente de um tubo: atravessando (v) a normal gira de -1 a 1
        static Texture2D TubeNormal()
        {
            const int h = 64;
            var tex = new Texture2D(4, h, TextureFormat.RGBA32, false, true) { wrapMode = TextureWrapMode.Clamp, name = "tubo_n" };
            var px = new Color[4 * h];
            for (int y = 0; y < h; y++)
            {
                float a = (y + .5f) / h * 2f - 1f;
                float z = Mathf.Sqrt(Mathf.Max(0, 1 - a * a));
                // x no R e A=1: o UnpackNormal do URP aceita RGB e DXT5nm assim
                for (int x = 0; x < 4; x++) px[y * 4 + x] = new Color(.5f, a * .5f + .5f, z * .5f + .5f, 1f);
            }
            tex.SetPixels(px);
            tex.Apply(false);
            return tex;
        }

        /// <summary>Nova ponta; posicao em pixels do jogo (y para baixo), angulo com y para cima.</summary>
        public void Spawn(Vector2 px, float angle, Kind kind, float width, float speed, float maxLength, int generation = 0, float delay = 0)
        {
            tips.Add(new Tip
            {
                p = new Vector2(px.x, -px.y), angle = angle, baseAngle = angle, kind = kind, width = width, speed = speed,
                maxLength = maxLength, generation = generation, delay = delay,
                nextBranch = kind == Kind.Root ? 70 + R() * 90 : 26 + R() * 40,
            });
        }

        static float AngleTo(float from, float to) => Mathf.Atan2(Mathf.Sin(to - from), Mathf.Cos(to - from));

        void AddSegment(Vector2 a, Vector2 b, float w0, float w1, float along, Kind kind, bool hair)
        {
            if (segments >= maxSegments) return;
            Vector2 d = (b - a).normalized;
            Vector2 n = new Vector2(-d.y, d.x);
            int i = verts.Count;
            float k = 1f / Px.PPU;
            verts.Add((a - n * w0 * .5f) * k); verts.Add((a + n * w0 * .5f) * k);
            verts.Add((b - n * w1 * .5f) * k); verts.Add((b + n * w1 * .5f) * k);
            float u0 = along / 34f, u1 = (along + (b - a).magnitude) / 34f;
            uvs.Add(new Vector2(u0, 0)); uvs.Add(new Vector2(u0, 1)); uvs.Add(new Vector2(u1, 0)); uvs.Add(new Vector2(u1, 1));
            // w = -1: bitangente = +n, igual ao sentido em que v cresce
            var t = new Vector4(d.x, d.y, 0, -1);
            for (int j = 0; j < 4; j++) tangents.Add(t);
            Color c = kind == Kind.Root ? rootColor * (hair ? .8f : 1f) : hyphaColor;
            float g = c.r * .2126f + c.g * .7152f + c.b * .0722f;
            c = Color.Lerp(c, new Color(g, g, g), desaturate) * tint;
            c.a = kind == Kind.Hypha ? .8f : 1f;
            for (int j = 0; j < 4; j++) colors.Add(c);
            tris.Add(i); tris.Add(i + 1); tris.Add(i + 2); tris.Add(i + 2); tris.Add(i + 1); tris.Add(i + 3);
            segments++;
            dirty = true;
        }

        public void Prewarm(float seconds)
        {
            for (float s = 0; s < seconds; s += 1f / 15f) Grow(1f / 15f);
            Flush();
        }

        void Update()
        {
            Grow(Mathf.Min(Time.deltaTime, .1f));
            Flush();
        }

        void Grow(float dt)
        {
            const float segLen = 6f;
            for (int i = tips.Count - 1; i >= 0; i--)
            {
                var t = tips[i];
                if (t.delay > 0) { t.delay -= dt; continue; }
                t.acc += t.speed * dt;
                while (t.acc >= segLen)
                {
                    t.acc -= segLen;
                    bool root = t.kind == Kind.Root;
                    t.wander = t.wander * .9f + (R() - .5f) * (root ? .22f : .7f);
                    if (root && t.generation > 0) t.baseAngle += AngleTo(t.baseAngle, -Mathf.PI / 2) * .004f;
                    float ang = t.angle + t.wander * (root ? .12f : .3f);
                    ang += AngleTo(ang, t.baseAngle) * (root ? .1f : .04f);
                    t.angle = ang;
                    Vector2 next = t.p + new Vector2(Mathf.Cos(ang), Mathf.Sin(ang)) * segLen;
                    float w0 = t.width * Mathf.Max(.25f, 1 - t.length / t.maxLength);
                    float w1 = t.width * Mathf.Max(.25f, 1 - (t.length + segLen) / t.maxLength);
                    AddSegment(t.p, next, w0, w1, t.along, t.kind, false);
                    t.along += segLen; t.length += segLen;
                    if (root && t.length > 40 && R() < .45f && t.width < 9)
                    {
                        float back = 18 + R() * 22;
                        Vector2 h = t.p - new Vector2(Mathf.Cos(ang), Mathf.Sin(ang)) * back;
                        float side = R() < .5f ? 1 : -1;
                        float ha = ang + side * (1.2f + R() * .5f);
                        float hl = 4 + R() * 6;
                        AddSegment(h, h + new Vector2(Mathf.Cos(ha), Mathf.Sin(ha)) * hl, .6f, .3f, 0, Kind.Root, true);
                    }
                    t.p = next;
                    if (t.length - t.lastBranch > t.nextBranch && t.generation < (root ? 2 : 4))
                    {
                        t.lastBranch = t.length;
                        t.nextBranch = root ? 80 + R() * 120 : 22 + R() * 46;
                        float side = R() < .5f ? 1 : -1;
                        float ba = root ? -Mathf.PI / 2 + side * (1.05f + R() * .35f) : ang + side * (.5f + R() * .7f);
                        tips.Add(new Tip
                        {
                            p = t.p, angle = ba, baseAngle = ba, kind = t.kind,
                            width = t.width * (root ? .55f : .85f), speed = t.speed * (root ? .8f : .95f),
                            maxLength = t.maxLength * (root ? .45f : .7f), generation = t.generation + 1,
                            delay = root ? .8f + R() * 1.5f : .05f + R() * .3f,
                            nextBranch = root ? 70 + R() * 90 : 26 + R() * 40,
                        });
                    }
                    if (t.length >= t.maxLength) { tips.RemoveAt(i); break; }
                }
            }
        }

        void Flush()
        {
            if (!dirty) return;
            dirty = false;
            mesh.SetVertices(verts);
            mesh.SetUVs(0, uvs);
            mesh.SetTangents(tangents);
            mesh.SetColors(colors);
            mesh.SetTriangles(tris, 0, false);
            mesh.RecalculateBounds();
            var b = mesh.bounds; b.Expand(1f); mesh.bounds = b;
        }
    }
}
