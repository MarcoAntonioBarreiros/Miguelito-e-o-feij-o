// Exsudato: luz verde que pulsa; ao ser coletado dispara o crescimento de hifas
// e uma raiz lateral (o mesmo evento visual da versao WebGL).
using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace Miguelito25D
{
    public class Exudate : MonoBehaviour
    {
        public Vector2 posPx;
        public MiguelitoController player;
        public System.Action<Vector2> onCollected;
        Light2D glow;
        SpriteRenderer sr;
        bool taken;
        float t;

        void Start()
        {
            sr = GetComponent<SpriteRenderer>();
            glow = GetComponentInChildren<Light2D>();
            t = posPx.x * .01f;
        }

        void Update()
        {
            if (taken) return;
            t += Time.deltaTime;
            float bob = Mathf.Sin(t * 2f) * 7f;
            transform.position = Px.World(posPx.x, posPx.y + bob, 0f);
            if (glow) glow.intensity = 1.6f + .3f * Mathf.Sin(t * 3f);
            if (player == null) return;
            var c = new Vector2(player.x + 16, player.y + 24);
            if ((c - new Vector2(posPx.x, posPx.y + bob)).magnitude < 34f)
            {
                taken = true;
                onCollected?.Invoke(posPx);
                gameObject.SetActive(false);
            }
        }
    }
}
