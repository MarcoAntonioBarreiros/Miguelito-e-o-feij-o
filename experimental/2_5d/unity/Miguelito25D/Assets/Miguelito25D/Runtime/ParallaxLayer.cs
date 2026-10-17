// Paralaxe por camada (ortografica): cada camada segue uma fracao da camera.
using UnityEngine;

namespace Miguelito25D
{
    /// <summary>Camada que se move uma fracao do deslocamento da camera.</summary>
    public class ParallaxLayer : MonoBehaviour
    {
        public Transform cam;
        [Range(0, 1)] public float follow = .5f; // 1 = presa a camera (infinitamente longe)
        Vector3 start, camStart;
        bool init;

        void LateUpdate()
        {
            if (cam == null) return;
            if (!init) { start = transform.position; camStart = cam.position; init = true; }
            Vector3 d = cam.position - camStart;
            transform.position = new Vector3(start.x + d.x * follow, start.y + d.y * follow, start.z);
        }
    }
}
