// Camera ortografica com o mesmo enquadramento do jogo: zoom 1,45 sobre 720 px
// de altura logica, antecipacao na direcao do olhar e suavizacao exponencial
// (camera-view.js). Paralaxe e feita pelas camadas, nao pela projecao.
using UnityEngine;

namespace Miguelito25D
{
    [RequireComponent(typeof(Camera))]
    public class CameraRig : MonoBehaviour
    {
        public MiguelitoController target;
        public float zoom = 1.45f;
        public float logicalHeight = 720f;
        public float minX, maxX = 4200f, topY = 0f, bottomY = 900f;
        float camX, camY;
        bool init;

        void LateUpdate()
        {
            var cam = GetComponent<Camera>();
            float visH = logicalHeight / zoom;
            float visW = visH * cam.aspect;
            cam.orthographicSize = visH / 2f / Px.PPU;
            if (target == null) return;
            float dt = Mathf.Min(Time.deltaTime, .1f);
            float cx = target.x + 16f, cy = target.y + 24f;
            float look = target.facing * (58f + Mathf.Clamp(Mathf.Abs(target.vx) * .34f, 0, 120));
            float tx = Mathf.Clamp(cx + look - visW * .5f, minX, Mathf.Max(minX, maxX - visW));
            float ty = Mathf.Clamp(cy - visH * .61f, topY, Mathf.Max(topY, bottomY - visH));
            if (!init) { camX = tx; camY = ty; init = true; }
            camX = Mathf.Lerp(camX, tx, 1 - Mathf.Pow(.004f, dt));
            camY = Mathf.Lerp(camY, ty, 1 - Mathf.Pow(.012f, dt));
            transform.position = Px.World(camX + visW / 2f, camY + visH / 2f, -10f);
        }
    }
}
