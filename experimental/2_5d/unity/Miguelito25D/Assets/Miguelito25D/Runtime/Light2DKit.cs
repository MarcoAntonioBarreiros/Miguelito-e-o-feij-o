// Criacao de luzes 2D e sombras em tempo de execucao (URP 14 / Unity 2022.3).
//
// Parte das opcoes do Light2D e do ShadowCaster2D so tem setter no Inspector
// (campos serializados privados). Em vez de montar a cena a mao no editor, os
// campos sao preenchidos por reflexao — com aviso no console se algum nome
// mudar numa versao futura do URP, em vez de falhar em silencio.
using System;
using System.Linq;
using System.Reflection;
using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace Miguelito25D
{
    public static class Light2DKit
    {
        const BindingFlags Flags = BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public;

        public static bool SetField(object target, string name, object value)
        {
            var type = target.GetType();
            FieldInfo field = null;
            for (var t = type; t != null && field == null; t = t.BaseType) field = t.GetField(name, Flags);
            if (field == null) { Debug.LogWarning($"[Miguelito25D] campo {type.Name}.{name} nao existe nesta versao do URP"); return false; }
            if (field.FieldType.IsEnum && value is string s) value = Enum.Parse(field.FieldType, s);
            field.SetValue(target, value);
            return true;
        }

        static int[] AllSortingLayers() => SortingLayer.layers.Select(l => l.id).ToArray();

        public static Light2D Global(GameObject go, Color color, float intensity)
        {
            var light = go.AddComponent<Light2D>();
            light.lightType = Light2D.LightType.Global;
            light.color = color;
            light.intensity = intensity;
            SetField(light, "m_ApplyToSortingLayers", AllSortingLayers());
            return light;
        }

        public static Light2D Point(GameObject go, Color color, float intensity, float innerRadius, float outerRadius,
            bool shadows = false, float shadowIntensity = .8f, float volume = 0f, float falloff = .55f)
        {
            var light = go.AddComponent<Light2D>();
            light.lightType = Light2D.LightType.Point;
            light.color = color;
            light.intensity = intensity;
            light.pointLightInnerRadius = innerRadius;
            light.pointLightOuterRadius = outerRadius;
            light.falloffIntensity = falloff;
            SetField(light, "m_ApplyToSortingLayers", AllSortingLayers());
            // normal maps: modo preciso, com a luz "acima" do plano
            SetField(light, "m_NormalMapQuality", "Accurate");
            SetField(light, "m_NormalMapDistance", 1.2f);
            SetField(light, "m_ShadowIntensityEnabled", shadows);
            SetField(light, "m_ShadowIntensity", shadowIntensity);
            SetField(light, "m_LightVolumeIntensityEnabled", volume > 0f);
            SetField(light, "m_LightVolumeIntensity", volume);
            return light;
        }

        public static Light2D Spot(GameObject go, Color color, float intensity, float outerRadius, float innerAngle, float outerAngle,
            bool shadows, float volume)
        {
            var light = Point(go, color, intensity, outerRadius * .15f, outerRadius, shadows, .9f, volume, .35f);
            light.pointLightInnerAngle = innerAngle;
            light.pointLightOuterAngle = outerAngle;
            return light;
        }

        /// <summary>Sombra com o contorno informado (pontos locais, em unidades).</summary>
        public static ShadowCaster2D ShadowShape(GameObject go, Vector2[] localPath)
        {
            var caster = go.AddComponent<ShadowCaster2D>();
            caster.selfShadows = false;
            caster.useRendererSilhouette = false;
            SetField(caster, "m_ApplyToSortingLayers", AllSortingLayers());
            SetField(caster, "m_ShapePath", localPath.Select(p => (Vector3)p).ToArray());
            // hash novo forca a malha da sombra a ser refeita no proximo quadro
            SetField(caster, "m_ShapePathHash", UnityEngine.Random.Range(1, int.MaxValue));
            return caster;
        }
    }
}
