// Organismo vagando perto do ponto de origem, com a folha original animada.
// Movimento simplificado: microbe-ecology.js (taxia por exsudato, recrutamento,
// seguimento do jogador, antibiose) NAO foi portado — e parte do custo da
// migracao estimado no relatorio.
using UnityEngine;

namespace Miguelito25D
{
    public class MicrobeAgent : MonoBehaviour
    {
        public Sprite[] frames;
        public float fps = 7f;
        public float heightPx = 60f;
        public Vector2 homePx;
        public float radiusPx = 120f;
        public float phase;
        Vector2 posPx, velPx;
        SpriteRenderer sr;
        float t;

        void Start()
        {
            sr = gameObject.AddComponent<SpriteRenderer>();
            sr.sortingOrder = 40;
            posPx = homePx;
            t = phase * 3.7f;
        }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, .1f);
            t += dt;
            // passeio browniano amortecido + mola fraca para casa
            Vector2 wander = new Vector2(Mathf.PerlinNoise(t * .35f, phase) - .5f, Mathf.PerlinNoise(phase, t * .35f) - .5f) * 90f;
            Vector2 home = (homePx - posPx) * .25f;
            velPx = Vector2.Lerp(velPx, wander + home, 1 - Mathf.Pow(.2f, dt));
            posPx += velPx * dt;
            transform.position = Px.World(posPx.x, posPx.y + Mathf.Sin(t * 2f + phase) * 3f, 0f);
            if (frames == null || frames.Length == 0) return;
            sr.sprite = frames[Mathf.FloorToInt(t * fps) % frames.Length];
            float s = heightPx / sr.sprite.rect.height;
            // espelhar pela escala para o normal map acompanhar
            transform.localScale = new Vector3(velPx.x < 0 ? -s : s, s, 1);
        }
    }
}
