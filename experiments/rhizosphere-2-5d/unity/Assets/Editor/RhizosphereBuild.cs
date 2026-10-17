using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

public static class RhizosphereBuild
{
    const string ScenePath = "Assets/Scenes/Rhizosphere.unity";

    [MenuItem("Miguelito/Prepare assets and scene")]
    public static void Prepare()
    {
        foreach (string path in AssetDatabase.FindAssets("t:Texture2D", new[] { "Assets/Resources/Original" }).Select(AssetDatabase.GUIDToAssetPath))
        {
            TextureImporter importer = AssetImporter.GetAtPath(path) as TextureImporter;
            if (importer == null) continue;
            // 7680px original strips must not be silently reduced to default 2048px.
            importer.textureType = TextureImporterType.Default;
            importer.maxTextureSize = 8192;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.filterMode = FilterMode.Bilinear;
            importer.sRGBTexture = true;
            importer.isReadable = false;
            importer.SaveAndReimport();
        }
        RenderPipelineAsset pipeline = AssetDatabase.LoadAssetAtPath<RenderPipelineAsset>("Assets/Settings/UniversalRP.asset");
        if (pipeline == null) throw new InvalidOperationException("UniversalRP.asset is missing.");
        GraphicsSettings.defaultRenderPipeline = pipeline;
        for (int i = 0; i < QualitySettings.names.Length; i++)
        {
            QualitySettings.SetQualityLevel(i);
            QualitySettings.renderPipeline = pipeline;
        }
        QualitySettings.SetQualityLevel(0);
        string[] names = { "Universal Render Pipeline/2D/Sprite-Lit-Default", "Universal Render Pipeline/2D/Sprite-Unlit-Default" };
        var graphicsSettings = new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/GraphicsSettings.asset")[0]);
        SerializedProperty shaders = graphicsSettings.FindProperty("m_AlwaysIncludedShaders");
        foreach (string name in names)
        {
            Shader shader = Shader.Find(name);
            if (shader == null) throw new InvalidOperationException("URP package did not provide " + name);
            bool found = false;
            for (int i = 0; i < shaders.arraySize; i++)
                found |= shaders.GetArrayElementAtIndex(i).objectReferenceValue == shader;
            if (!found)
            {
                int index = shaders.arraySize;
                shaders.InsertArrayElementAtIndex(index);
                shaders.GetArrayElementAtIndex(index).objectReferenceValue = shader;
            }
        }
        graphicsSettings.ApplyModifiedPropertiesWithoutUndo();
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        new GameObject("Miguelito | visual scene bootstrap").AddComponent<RhizosphereDemo>();
        Directory.CreateDirectory("Assets/Scenes");
        EditorSceneManager.SaveScene(scene, ScenePath);
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
        PlayerSettings.companyName = "Miguelito Experimental";
        PlayerSettings.productName = "Miguelito Rhizosphere URP Study";
        PlayerSettings.defaultScreenWidth = 1600;
        PlayerSettings.defaultScreenHeight = 900;
        PlayerSettings.colorSpace = ColorSpace.Linear;
        AssetDatabase.SaveAssets();
        Debug.Log("Prepared original sprites and standalone URP2D visual scene.");
    }

    [MenuItem("Miguelito/Build Windows visual demo")]
    public static void BuildWindows()
    {
        Prepare();
        Directory.CreateDirectory("Builds/Windows");
        BuildReport report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
            scenes = new[] { ScenePath }, locationPathName = "Builds/Windows/MiguelitoRhizosphere.exe",
            target = BuildTarget.StandaloneWindows64, options = BuildOptions.Development
        });
        Record(report, "Windows");
    }

    [MenuItem("Miguelito/Build WebGL visual demo")]
    public static void BuildWebGL()
    {
        Prepare();
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
        PlayerSettings.WebGL.decompressionFallback = false;
        Directory.CreateDirectory("Builds/WebGL");
        BuildReport report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
            scenes = new[] { ScenePath }, locationPathName = "Builds/WebGL",
            target = BuildTarget.WebGL, options = BuildOptions.Development
        });
        Record(report, "WebGL");
    }

    static void Record(BuildReport report, string target)
    {
        Directory.CreateDirectory("Evidence");
        File.WriteAllText("Evidence/build-" + target + ".txt",
            "Result: " + report.summary.result + "\nBytes: " + report.summary.totalSize +
            "\nSeconds: " + report.summary.totalTime.TotalSeconds +
            "\nWarnings: " + report.summary.totalWarnings + "\nErrors: " + report.summary.totalErrors);
        if (report.summary.result != BuildResult.Succeeded) throw new Exception("Unity build failed: " + report.summary.result);
    }
}
