using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Rendering.Universal;

// Standalone visual composition. No JS rules or physics have been ported here.
public sealed class RhizosphereDemo : MonoBehaviour
{
    public bool animateGrowth = true;
    public bool dynamicLights = true;
    public bool showParticles = true;
    public bool showHud = true;
    Camera view;
    Material lit, unlit;
    Light2D key, cyan, ambient;
    Transform distant, foreground;
    Sprite pebble, mote;
    float clock, growthClock = 15, frameAverage;
    readonly List<Sheet> sheets = new List<Sheet>();
    readonly List<Tendril> tendrils = new List<Tendril>();
    readonly List<Drifter> motes = new List<Drifter>();
    readonly List<UnityEngine.Object> transient = new List<UnityEngine.Object>();

    sealed class Sheet
    {
        public SpriteRenderer renderer;
        public Sprite[] frames;
        public float fps, phase;
    }
    sealed class Tendril
    {
        public Mesh mesh;
        public Vector3[] path;
        public float width, delay;
        public Color color;
        public bool hypha;
        public Vector3[] vertices, normals;
        public Vector4[] tangents;
        public Vector2[] uvs;
        public Color[] colors;
        public int[] indices;
    }
    sealed class Drifter
    {
        public Transform transform;
        public Vector3 origin;
        public float phase, speed;
    }

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Bootstrap()
    {
        if (FindObjectOfType<RhizosphereDemo>() == null)
            new GameObject("Miguelito | URP visual study").AddComponent<RhizosphereDemo>();
    }

    void Awake()
    {
        foreach (Camera camera in FindObjectsOfType<Camera>()) camera.gameObject.SetActive(false);
        foreach (Light2D light in FindObjectsOfType<Light2D>()) light.gameObject.SetActive(false);
        UnityEngine.Random.InitState(4042026);
        Application.targetFrameRate = 60;
        lit = Keep(new Material(RequireShader("Universal Render Pipeline/2D/Sprite-Lit-Default")));
        unlit = Keep(new Material(RequireShader("Universal Render Pipeline/2D/Sprite-Unlit-Default")));
        view = new GameObject("Cinematic orthographic camera").AddComponent<Camera>();
        view.transform.SetParent(transform);
        view.transform.position = new Vector3(0, 0, -15);
        view.orthographic = true;
        view.orthographicSize = 5.4f;
        view.backgroundColor = new Color(.012f, .028f, .032f);
        view.clearFlags = CameraClearFlags.SolidColor;
        view.allowHDR = true;
        view.gameObject.AddComponent<UniversalAdditionalCameraData>().renderPostProcessing = false;

        distant = new GameObject("Distant soil | parallax 0.16").transform;
        distant.SetParent(transform);
        foreground = new GameObject("Near silhouettes | parallax 0.72").transform;
        foreground.SetParent(transform);
        Texture2D backdrop = Resources.Load<Texture2D>("Original/backgrounds/miguelito-rhizosphere");
        if (backdrop == null) throw new InvalidOperationException("Original rhizosphere background is missing.");
        Sprite background = Keep(Sprite.Create(backdrop, new Rect(0, 0, backdrop.width, backdrop.height), Vector2.one * .5f, 100));
        SpriteRenderer back = Place("Original painted background", background, new Vector3(0, .7f, 5), -100, Color.white, false, distant);
        float height = 11.2f;
        back.transform.localScale = Vector3.one * (height / background.bounds.size.y);

        pebble = MakeReliefSprite(96, false);
        mote = MakeReliefSprite(24, true);
        for (int i = 0; i < 80; i++)
        {
            float x = UnityEngine.Random.Range(-13f, 13f);
            float y = UnityEngine.Random.Range(-4.8f, -3.5f);
            float size = UnityEngine.Random.Range(.15f, .65f);
            SpriteRenderer rock = Place("Soil aggregate " + i, pebble, new Vector3(x, y, 0), 0,
                Color.Lerp(new Color(.2f, .13f, .08f), new Color(.46f, .33f, .17f), UnityEngine.Random.value));
            rock.transform.localScale = new Vector3(size * 1.7f, size, 1);
            rock.transform.rotation = Quaternion.Euler(0, 0, UnityEngine.Random.Range(-40, 40));
            if (i % 12 == 0)
            {
                ShadowCaster2D shadow = rock.gameObject.AddComponent<ShadowCaster2D>();
                shadow.castsShadows = true;
                shadow.selfShadows = false;
                shadow.useRendererSilhouette = true;
            }
        }

        // Primary roots and root hairs remain ribbons facing the camera, never 3D characters.
        AddBranch(new Vector3(6, 6, .2f), new Vector3(5.2f, -4.3f, .2f), .53f, new Color(.76f, .51f, .25f), false, 0);
        AddBranch(new Vector3(5.4f, 1.2f, .1f), new Vector3(1.7f, -3.7f, .1f), .28f, new Color(.68f, .43f, .21f), false, 1);
        AddBranch(new Vector3(5.3f, -.4f, .1f), new Vector3(9.2f, -3.7f, .1f), .23f, new Color(.68f, .43f, .21f), false, 2);
        AddBranch(new Vector3(-9, 5.8f, 1), new Vector3(-7.9f, -3.9f, 1), .39f, new Color(.32f, .30f, .19f), false, 0);
        for (int i = 0; i < 28; i++)
        {
            float x = UnityEngine.Random.Range(-5.5f, 5.2f);
            float y = UnityEngine.Random.Range(-3.6f, -.4f);
            AddBranch(new Vector3(5.2f, -2.8f, -.15f), new Vector3(x, y, -.15f), UnityEngine.Random.Range(.022f, .052f),
                Color.Lerp(new Color(.34f, .92f, .66f), new Color(.68f, .94f, .81f), UnityEngine.Random.value), true, i * .14f);
        }
        for (int i = 0; i < 15; i++)
        {
            float y = 3.8f - i * .48f;
            AddBranch(new Vector3(5.4f, y, .05f), new Vector3(4.2f - UnityEngine.Random.value, y - .7f, .05f), .035f,
                new Color(.64f, .51f, .26f), false, 2 + i * .1f);
        }

        // Sprite frame rectangles and timings are copied from the original JS catalogs.
        AddSheet("Miguelito", "miguelito/idle", 8, 6, new Vector3(-3.4f, -3.65f, -.4f), 2.05f, 224, 379);
        AddSheet("Micorriza", "organisms/micorriza", 24, 10, new Vector3(1.3f, -2.9f, -.4f), 1.55f);
        AddSheet("Pseudomonas", "organisms/pseudomonas", 24, 10, new Vector3(-.4f, -3.15f, -.45f), 1.35f);
        AddSheet("Rhizobium", "organisms/rhizobium", 12, 6, new Vector3(6.7f, -2.65f, -.4f), 1.4f);
        AddSheet("Trichoderma", "organisms/trichoderma", 12, 7, new Vector3(-6.4f, -3.25f, -.3f), 1.35f);

        for (int i = 0; i < 95; i++)
        {
            Vector3 position = new Vector3(UnityEngine.Random.Range(-11f, 11f), UnityEngine.Random.Range(-4f, 5.2f), UnityEngine.Random.Range(-2f, 3f));
            SpriteRenderer spore = Place("Suspended organic particle", mote, position, 8,
                new Color(.47f, .98f, .74f, UnityEngine.Random.Range(.13f, .5f)), false);
            spore.transform.localScale = Vector3.one * UnityEngine.Random.Range(.025f, .065f);
            motes.Add(new Drifter { transform = spore.transform, origin = position, phase = UnityEngine.Random.value * 20, speed = UnityEngine.Random.Range(.06f, .17f) });
        }
        for (int i = 0; i < 11; i++)
        {
            SpriteRenderer near = Place("Foreground blurred aggregate", pebble, new Vector3(-12 + i * 2.6f, -5.4f, -4), 40,
                new Color(.015f, .037f, .03f, .94f), false, foreground);
            near.transform.localScale = new Vector3(2.7f, 1.25f + UnityEngine.Random.value, 1);
        }
        ambient = new GameObject("Ambient fill").AddComponent<Light2D>();
        ambient.transform.SetParent(transform);
        ambient.lightType = Light2D.LightType.Global;
        ambient.color = new Color(.48f, .65f, .60f);
        ambient.intensity = .48f;
        key = PointLight("Golden root key | shadows", new Vector3(3.2f, 3.4f, -1), new Color(1, .68f, .32f), 1.8f, 10, true);
        cyan = PointLight("Living mycorrhizal fill", new Vector3(-2.2f, -1.1f, -1), new Color(.25f, .88f, .76f), 1.1f, 7, false);
        PointLight("Root rim", new Vector3(8.5f, -1.8f, -1), new Color(.5f, .77f, 1), .8f, 5, false);
        string[] args = Environment.GetCommandLineArgs();
        for (int i = 0; i < args.Length - 1; i++)
            if (args[i] == "--capture") StartCoroutine(Capture(args[i + 1]));
    }

    Shader RequireShader(string name)
    {
        Shader shader = Shader.Find(name);
        if (shader == null) throw new InvalidOperationException("Missing URP shader: " + name + ". Run Miguelito/Prepare assets and scene before building.");
        return shader;
    }
    T Keep<T>(T value) where T : UnityEngine.Object { transient.Add(value); return value; }

    SpriteRenderer Place(string name, Sprite sprite, Vector3 position, int order, Color color, bool receivesLight = true, Transform parent = null)
    {
        GameObject obj = new GameObject(name);
        obj.transform.SetParent(parent == null ? transform : parent);
        obj.transform.position = position;
        SpriteRenderer renderer = obj.AddComponent<SpriteRenderer>();
        renderer.sprite = sprite;
        renderer.sortingOrder = order;
        renderer.color = color;
        renderer.sharedMaterial = receivesLight ? lit : unlit;
        return renderer;
    }

    void AddSheet(string name, string resource, int count, float fps, Vector3 position, float bodyHeight, float contentHeight = 400, float baseline = 360)
    {
        Texture2D texture = Resources.Load<Texture2D>("Original/" + resource);
        if (texture == null || texture.width % count != 0) throw new InvalidOperationException("Invalid original sprite sheet " + resource);
        int frameWidth = texture.width / count;
        Sprite[] frames = new Sprite[count];
        for (int i = 0; i < count; i++)
            frames[i] = Keep(Sprite.Create(texture, new Rect(i * frameWidth, 0, frameWidth, texture.height),
                new Vector2(.5f, 1 - baseline / 400), contentHeight / bodyHeight));
        SpriteRenderer renderer = Place(name + " | original animation", frames[0], position, 5, Color.white);
        sheets.Add(new Sheet { renderer = renderer, frames = frames, fps = fps, phase = UnityEngine.Random.Range(0, 4f) });
        SpriteRenderer contact = Place(name + " | soft contact shadow", mote, position + new Vector3(.18f, -.06f, .05f), 3, new Color(0, 0, 0, .55f), false);
        contact.transform.localScale = new Vector3(bodyHeight * .65f, bodyHeight * .13f, 1);
    }

    Sprite MakeReliefSprite(int size, bool soft)
    {
        Texture2D color = Keep(new Texture2D(size, size, TextureFormat.RGBA32, false));
        Texture2D normal = Keep(new Texture2D(size, size, TextureFormat.RGBA32, false, true));
        Color[] colors = new Color[size * size], normals = new Color[size * size];
        for (int y = 0; y < size; y++) for (int x = 0; x < size; x++)
        {
            float px = (x + .5f) / size * 2 - 1, py = (y + .5f) / size * 2 - 1;
            float radius = Mathf.Sqrt(px * px + py * py);
            float alpha = soft ? Mathf.Pow(Mathf.Clamp01(1 - radius), 1.8f) : Mathf.Clamp01((1 - radius) * size * .3f);
            float grain = .65f + Mathf.PerlinNoise(x * .12f + 21, y * .12f) * .35f;
            colors[y * size + x] = new Color(grain, grain, grain, alpha);
            Vector3 n = new Vector3(px * .8f, py * .8f, Mathf.Sqrt(Mathf.Max(.08f, 1 - radius * radius))).normalized;
            normals[y * size + x] = new Color(n.x * .5f + .5f, n.y * .5f + .5f, n.z * .5f + .5f, 1);
        }
        color.SetPixels(colors); color.Apply(); normal.SetPixels(normals); normal.Apply();
        return Keep(Sprite.Create(color, new Rect(0, 0, size, size), Vector2.one * .5f, size, 0, SpriteMeshType.FullRect, Vector4.zero, false,
            new[] { new SecondarySpriteTexture { name = "_NormalMap", texture = normal } }));
    }

    void AddBranch(Vector3 from, Vector3 to, float width, Color color, bool hypha, float delay)
    {
        Vector3[] path = new Vector3[65];
        Vector3 direction = to - from;
        Vector3 side = new Vector3(-direction.y, direction.x).normalized;
        float phase = UnityEngine.Random.value * 9;
        for (int i = 0; i < path.Length; i++)
        {
            float t = i / (float)(path.Length - 1);
            path[i] = Vector3.Lerp(from, to, t) + side * Mathf.Sin(t * Mathf.PI) * Mathf.Sin(t * 7 + phase) * (hypha ? .22f : .4f);
        }
        Mesh mesh = Keep(new Mesh { name = hypha ? "Growing hypha ribbon" : "Growing root ribbon" });
        GameObject branch = new GameObject(mesh.name);
        branch.transform.SetParent(transform);
        branch.AddComponent<MeshFilter>().sharedMesh = mesh;
        MeshRenderer renderer = branch.AddComponent<MeshRenderer>();
        renderer.sharedMaterial = lit;
        renderer.sortingOrder = hypha ? 2 : 1;
        mesh.MarkDynamic();
        tendrils.Add(new Tendril {
            mesh = mesh, path = path, width = width, color = color, hypha = hypha, delay = delay,
            vertices = new Vector3[path.Length * 2], normals = new Vector3[path.Length * 2],
            tangents = new Vector4[path.Length * 2], uvs = new Vector2[path.Length * 2],
            colors = new Color[path.Length * 2], indices = new int[(path.Length - 1) * 6]
        });
    }

    Light2D PointLight(string name, Vector3 position, Color color, float intensity, float radius, bool shadows)
    {
        Light2D light = new GameObject(name).AddComponent<Light2D>();
        light.transform.SetParent(transform);
        light.transform.position = position;
        light.lightType = Light2D.LightType.Point;
        light.color = color;
        light.intensity = intensity;
        light.pointLightInnerRadius = radius * .08f;
        light.pointLightOuterRadius = radius;
        light.shadowsEnabled = shadows;
        light.shadowIntensity = .58f;
        // URP14 exposes normalMapQuality as get-only; configure its serialized backing data.
        JsonUtility.FromJsonOverwrite("{\"m_ComponentVersion\":1,\"m_UseNormalMap\":true,\"m_NormalMapQuality\":" +
            (int)Light2D.NormalMapQuality.Accurate + ",\"m_NormalMapDistance\":1.4}", light);
        return light;
    }

    void UpdateRibbon(Tendril branch, float growth)
    {
        int samples = branch.path.Length;
        Vector3[] vertices = branch.vertices, normals = branch.normals;
        Vector4[] tangents = branch.tangents;
        Vector2[] uvs = branch.uvs;
        Color[] colors = branch.colors;
        int[] indices = branch.indices;
        for (int i = 0; i < samples; i++)
        {
            float t = i / (float)(samples - 1);
            float grownIndex = Mathf.Min(t, growth) * (samples - 1);
            int p = Mathf.Min((int)grownIndex, samples - 2);
            Vector3 center = Vector3.Lerp(branch.path[p], branch.path[p + 1], grownIndex - p);
            Vector3 along = (branch.path[Mathf.Min(p + 1, samples - 1)] - branch.path[Mathf.Max(p - 1, 0)]).normalized;
            Vector3 side = new Vector3(-along.y, along.x, 0);
            float width = branch.width * Mathf.Pow(1 - t * .93f, .65f);
            for (int edge = 0; edge < 2; edge++)
            {
                int v = i * 2 + edge;
                vertices[v] = center + side * width * (edge == 0 ? -.5f : .5f);
                normals[v] = Vector3.back;
                tangents[v] = new Vector4(1, 0, 0, 1);
                uvs[v] = new Vector2(edge, t);
                colors[v] = Color.Lerp(branch.color * .65f, branch.color, edge);
                colors[v].a = t <= growth ? 1 : 0;
            }
            if (i < samples - 1)
            {
                int k = i * 6, v = i * 2;
                indices[k] = v; indices[k + 1] = v + 2; indices[k + 2] = v + 1;
                indices[k + 3] = v + 1; indices[k + 4] = v + 2; indices[k + 5] = v + 3;
            }
        }
        branch.mesh.Clear(); branch.mesh.vertices = vertices; branch.mesh.normals = normals;
        branch.mesh.tangents = tangents; branch.mesh.uv = uvs; branch.mesh.colors = colors; branch.mesh.triangles = indices;
        branch.mesh.RecalculateBounds();
    }

    void Update()
    {
        clock += Time.deltaTime;
        frameAverage = Mathf.Lerp(frameAverage, Time.unscaledDeltaTime, .04f);
        if (animateGrowth) growthClock += Time.deltaTime;
        if (Input.GetKeyDown(KeyCode.Space)) growthClock = 0;
        if (Input.GetKeyDown(KeyCode.G)) animateGrowth = !animateGrowth;
        if (Input.GetKeyDown(KeyCode.L)) dynamicLights = !dynamicLights;
        if (Input.GetKeyDown(KeyCode.P)) showParticles = !showParticles;
        if (Input.GetKeyDown(KeyCode.H)) showHud = !showHud;
        float horizontal = (Input.GetKey(KeyCode.D) ? 1 : 0) - (Input.GetKey(KeyCode.A) ? 1 : 0);
        Vector3 position = view.transform.position;
        position.x = Mathf.Clamp(position.x + horizontal * Time.deltaTime * 3, -3.5f, 3.5f);
        position.y = Mathf.Sin(clock * .16f) * .06f;
        view.transform.position = position;
        distant.localPosition = new Vector3(position.x * .16f, 0, 0);
        foreground.localPosition = new Vector3(-position.x * .72f, 0, 0);
        foreach (Sheet sheet in sheets) sheet.renderer.sprite = sheet.frames[(int)((clock + sheet.phase) * sheet.fps) % sheet.frames.Length];
        foreach (Tendril branch in tendrils)
            if (growthClock < 20 || branch.mesh.vertexCount == 0)
                UpdateRibbon(branch, Mathf.Clamp01((growthClock - branch.delay) / (branch.hypha ? 8 : 11)));
        key.enabled = cyan.enabled = dynamicLights;
        if (dynamicLights)
        {
            key.transform.localPosition = new Vector3(3.2f + Mathf.Sin(clock * .23f) * 1.6f, 3.4f, -1);
            cyan.intensity = 1.05f + Mathf.Sin(clock * .7f) * .12f;
        }
        foreach (Drifter particle in motes)
        {
            particle.transform.gameObject.SetActive(showParticles);
            particle.transform.position = particle.origin + new Vector3(Mathf.Sin(clock * .2f + particle.phase) * .28f, Mathf.Sin(clock * particle.speed + particle.phase) * .5f, 0);
        }
    }

    void OnGUI()
    {
        if (!showHud) return;
        GUI.color = new Color(.06f, .13f, .13f, .94f);
        GUI.DrawTexture(new Rect(18, 18, 560, 100), Texture2D.whiteTexture);
        GUI.color = new Color(.87f, .95f, .86f);
        GUI.Label(new Rect(32, 28, 530, 25), "MIGUELITO  |  RIZOSFERA 2,5D  |  UNITY URP 14");
        GUI.Label(new Rect(32, 54, 530, 22), "Estudo visual: sprites originais, sem migracao de mecanicas.");
        GUI.Label(new Rect(32, 80, 530, 22), "A/D camera   ESPACO crescer   L luzes   P particulas   G pausa   H painel");
        GUI.Label(new Rect(22, Screen.height - 32, 780, 24), "Frame atual (tempo de CPU, sem GPU): " + (frameAverage * 1000).ToString("F1") + " ms | dados para observacao local; nao e benchmark comparativo");
    }

    IEnumerator Capture(string destination)
    {
        showHud = false;
        yield return new WaitForSecondsRealtime(4);
        yield return new WaitForEndOfFrame();
        string path = Path.GetFullPath(destination);
        Directory.CreateDirectory(Path.GetDirectoryName(path));
        ScreenCapture.CaptureScreenshot(path);
        Debug.Log("Requested real GPU capture: " + path);
    }

    void OnDestroy()
    {
        foreach (UnityEngine.Object value in transient) if (value != null) Destroy(value);
    }
}
