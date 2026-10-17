// Dados de uma cena exportada do jogo web (experimental/2_5d/tools/export-scene.cjs).
// Coordenadas em pixels do jogo: x para a direita, y para BAIXO, como no Canvas.
// A conversao para unidades Unity (100 px = 1 unidade, y para cima) fica em Px.
using System;
using UnityEngine;

namespace Miguelito25D
{
    [Serializable] public class PlatformData { public float x, y, w, h; public string type; public bool oneWay; }
    [Serializable] public class PointData { public float x, y; }
    [Serializable] public class RectData { public float x, y, w, h; }
    [Serializable] public class AgentData { public string type; public float x, y, size, height, homeX, homeY, radius, phase; }
    [Serializable] public class TileData { public string file; public float x, width; }
    [Serializable] public class TerrainData { public float y0, height; public TileData[] tiles; }

    [Serializable]
    public class LevelData
    {
        public int phase;
        public string title;
        public float x0, x1, top, bottom;
        public PlatformData[] platforms;
        public PointData[] exudates;
        public PointData[] checkpoints;
        public RectData[] hazards;
        public AgentData[] agents;
        public TerrainData terrain;

        public static LevelData Load()
        {
            var text = Resources.Load<TextAsset>("level");
            if (text == null) { Debug.LogError("[Miguelito25D] Resources/level.json nao encontrado"); return null; }
            return JsonUtility.FromJson<LevelData>(text.text);
        }
    }

    public static class Px
    {
        public const float PPU = 100f;
        public static Vector3 World(float x, float y, float z = 0f) => new Vector3(x / PPU, -y / PPU, z);
        public static float ToUnits(float px) => px / PPU;
    }
}
